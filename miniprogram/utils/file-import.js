/**
 * 课表文件导入
 * ---------------------------------------------------------------
 * 支持从微信聊天记录里选择文件并解析成课程：
 *   Excel  .xlsx（含共享字符串、合并单元格）
 *   Word   .docx（表格 / 段落）
 *   CSV    .csv
 *   文本   .txt
 *
 * 旧版 .xls / .doc（OLE2 二进制格式）无法在端上解析，会给出明确提示。
 */
const B = require('./bytes');
const ZIP = require('./zip');
const XLSX = require('./xlsx');
const DOCX = require('./docx');
const EX = require('./schedule-extract');
const DETECT = require('./table-detect');

const MAX_BYTES = 20 * 1024 * 1024; // 20MB，超过就拒绝，避免小程序内存溢出

/**
 * 智能提取：先让 table-detect 自己找课表区、判布局、对字段，
 * 全部失败时回退到常规识别，保证不会比之前更差。
 */
function extractSmart(rows, ctx) {
  let res = null;
  try {
    res = DETECT.extractSmart(rows, ctx);
  } catch (e) {
    res = null;
  }
  if (res && res.courses && res.courses.length) return res;

  const fallback = EX.extractFromTable(rows, ctx);
  if (fallback && fallback.courses && fallback.courses.length) {
    fallback.recognize = {
      method: '常规识别（智能路径未命中，已回退）',
      layout: fallback.layout,
      source: 'fallback',
      score: 0,
      confidence: 0,
    };
  }
  return fallback;
}

/** 识别文件类型 */
function detectFileType(bytes, fileName) {
  const b = B.toBytes(bytes);
  const name = String(fileName || '').toLowerCase();

  if (b.length >= 4 && B.tag4(b, 0) === 'PK\u0003\u0004') {
    // ZIP 容器：看内部结构区分 xlsx / docx / pptx
    try {
      const zip = ZIP.readZip(b);
      if (zip.has('xl/workbook.xml') || zip.names().some(function (n) { return /^xl\/worksheets\//.test(n); })) {
        return 'xlsx';
      }
      if (zip.has('word/document.xml') || zip.names().some(function (n) { return /^word\/document\d*\.xml$/.test(n); })) {
        return 'docx';
      }
      if (zip.has('ppt/presentation.xml')) return 'pptx';
      return 'zip';
    } catch (e) {
      return 'zip';
    }
  }

  if (ZIP.isOle2(b)) {
    if (/\.xls$/.test(name)) return 'xls-legacy';
    if (/\.doc$/.test(name)) return 'doc-legacy';
    return 'ole2';
  }

  if (/\.csv$/.test(name)) return 'csv';
  if (/\.txt$/.test(name)) return 'txt';
  if (/\.xlsx$/.test(name)) return 'xlsx';
  if (/\.docx$/.test(name)) return 'docx';
  if (/\.xls$/.test(name)) return 'xls-legacy';
  if (/\.doc$/.test(name)) return 'doc-legacy';

  // 无法判断时按纯文本处理（很多导出的课表就是纯文本）
  return 'txt';
}

/** 简易 CSV 解析（支持双引号包裹与转义） */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text).replace(/^\ufeff/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // 忽略，交给 \n 处理
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 统计替换字符，用于判断是否可能是 GBK 编码 */
function countBadChars(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0xfffd) n++;
  }
  return n;
}

/** 给一次提取结果打个可比较的分数 */
function resultScore(res) {
  if (!res || !res.courses || !res.courses.length) return 0;
  if (res.recognize && res.recognize.score) return res.recognize.score;
  return res.courses.length * 10;
}

/** 从 Excel 的所有工作表里挑出最像课表的那一个 */
function pickBestSheet(sheets, ctx) {
  let best = null;
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    if (!sheet.rows || !sheet.rows.length) continue;
    const res = extractSmart(sheet.rows, ctx);
    const score = resultScore(res);
    if (score > 0 && (!best || score > best.score)) {
      best = { sheet: sheet, result: res, score: score };
    }
  }
  return best;
}

/** 从 Word 的多个表格里挑出最像课表的那个 */
function pickBestTable(tables, ctx) {
  let best = null;
  for (let i = 0; i < tables.length; i++) {
    const res = extractSmart(tables[i], ctx);
    const score = resultScore(res);
    if (score > 0 && (!best || score > best.score)) {
      best = { table: tables[i], index: i, result: res, score: score };
    }
  }
  return best;
}

/**
 * 解析文件字节（纯函数，方便测试）
 * @param {Uint8Array|ArrayBuffer|String} input
 * @param {String} fileName
 * @param {Object} ctx { classrooms, periods, totalWeeks }
 * @returns {Object} { ok, fileType, courses, layout, warnings, ... }
 */
function parseBytes(input, fileName, ctx) {
  const context = ctx || {};
  const bytes = B.toBytes(input);

  if (!bytes.length) return fail('文件是空的');
  if (bytes.length > MAX_BYTES) {
    return fail('文件太大（' + Math.round(bytes.length / 1024 / 1024) + 'MB），请只保留课表内容后重试');
  }

  const type = detectFileType(bytes, fileName);

  if (type === 'xls-legacy') {
    return fail('这是旧版 .xls 格式，小程序无法直接读取。\n请在 Excel 中打开后「另存为 → Excel 工作簿(*.xlsx)」再导入。', type);
  }
  if (type === 'doc-legacy') {
    return fail('这是旧版 .doc 格式，小程序无法直接读取。\n请在 Word 中打开后「另存为 → Word 文档(*.docx)」再导入。', type);
  }
  if (type === 'ole2') {
    return fail('这是旧版 Office 二进制格式（.xls / .doc），请另存为 .xlsx 或 .docx 后导入。', type);
  }
  if (type === 'pptx') {
    return fail('检测到的是 PowerPoint 文件，请改用 Excel 或 Word 课表。', type);
  }
  if (type === 'zip') {
    return fail('这是压缩包，不是可识别的课表文件。请上传 .xlsx / .docx / .csv / .txt。', type);
  }

  if (type === 'xlsx') return parseXlsxBytes(bytes, fileName, context);
  if (type === 'docx') return parseDocxBytes(bytes, fileName, context);

  // 文本类
  const text = B.utf8Decode(bytes);
  const bad = countBadChars(text);
  const warnings = [];
  if (bad > 3) {
    warnings.push('文件可能不是 UTF-8 编码（检测到 ' + bad + ' 个乱码字符）。' +
      '如果课程名显示为乱码，请用 Excel/WPS 另存为「CSV UTF-8」格式后重试。');
  }

  if (type === 'csv') {
    const rows = parseCsv(text);
    const res = extractSmart(rows, context);
    if (res.courses.length) {
      return success('csv', res, warnings.concat(res.warnings || []), {
        rows: rows.length,
        layout: res.layout,
      });
    }
    // CSV 无表头时退回文本解析
    const textRes = EX.extractFromText(text, context);
    if (textRes.courses.length) {
      return success('csv', textRes, warnings.concat(['CSV 没有识别到表头，已按文本逐行解析']), { rows: rows.length });
    }
    return fail('CSV 里没有识别出课表结构。\n' + (res.warnings || []).join('\n'), 'csv');
  }

  const res = EX.extractFromText(text, context);
  if (!res.courses.length) {
    return fail('文本里没有识别出课表结构。每行需包含课程名、星期、节次，例如：\n' +
      '高等数学(上),周一,1,2,A301,1-16', 'txt');
  }
  return success('txt', res, warnings.concat(res.warnings || []), {
    errors: res.errors || [],
  });
}

function success(fileType, res, warnings, extra) {
  return Object.assign({
    ok: true,
    fileType: fileType,
    layout: res.layout,
    courses: res.courses || [],
    warnings: warnings || [],
    unknownRooms: res.unknownRooms || [],
    stats: res.stats || { total: (res.courses || []).length },
    recognize: res.recognize || null,
  }, extra || {});
}

function fail(message, fileType) {
  return {
    ok: false,
    fileType: fileType || 'unknown',
    error: message,
    courses: [],
    warnings: [],
    unknownRooms: [],
    stats: { total: 0 },
  };
}

function parseXlsxBytes(bytes, fileName, ctx) {
  let parsed;
  try {
    parsed = XLSX.parseXlsx(bytes);
  } catch (e) {
    return fail('Excel 解析失败：' + e.message, 'xlsx');
  }
  if (!parsed.sheets.length) return fail('Excel 里没有工作表', 'xlsx');

  const best = pickBestSheet(parsed.sheets, ctx);
  if (!best) {
    return fail('Excel 里没有识别出课表结构。\n' +
      '请确认表格第一行是表头（课程名称 / 星期 / 节次 / 教室 / 周次），\n' +
      '或者是"上方是星期、左侧是节次"的课表网格。\n' +
      '当前工作表：' + parsed.sheetNames.join('、'), 'xlsx');
  }

  const warnings = (best.result.warnings || []).slice();
  if (parsed.sheets.length > 1) {
    warnings.unshift('文件包含 ' + parsed.sheets.length + ' 个工作表，已自动选用「' +
      best.sheet.name + '」（识别出 ' + best.result.courses.length + ' 门课）');
  }

  return success('xlsx', best.result, warnings, {
    layout: best.result.layout,
    sheetNames: parsed.sheetNames,
    usedSheet: best.sheet.name,
  });
}

function parseDocxBytes(bytes, fileName, ctx) {
  let parsed;
  try {
    parsed = DOCX.parseDocx(bytes);
  } catch (e) {
    return fail('Word 解析失败：' + e.message, 'docx');
  }

  const warnings = [];

  if (parsed.tables.length) {
    const best = pickBestTable(parsed.tables, ctx);
    if (best) {
      if (parsed.tables.length > 1) {
        warnings.push('文档包含 ' + parsed.tables.length + ' 个表格，已自动选用第 ' +
          (best.index + 1) + ' 个（识别出 ' + best.result.courses.length + ' 门课）');
      }
      return success('docx', best.result, warnings.concat(best.result.warnings || []), {
        tables: parsed.tables.length,
        paragraphs: parsed.paragraphs.length,
      });
    }
    warnings.push('文档里的表格没有识别出课表结构，已尝试按正文文本解析');
  }

  // 没有表格 / 表格识别失败 -> 按正文文本
  const text = parsed.paragraphs.join('\n');
  const res = EX.extractFromText(text, ctx);
  if (!res.courses.length) {
    return fail('Word 文档里没有识别出课表。\n' +
      '支持的形式：\n' +
      '① 表格，表头为 课程名称/星期/节次/教室/周次\n' +
      '② 表格，上方是星期、左侧是节次的课表网格\n' +
      '③ 正文每行一条：高等数学 周一 1-2节 A301 1-16周', 'docx');
  }
  return success('docx', res, warnings.concat(res.warnings || []), {
    tables: parsed.tables.length,
    paragraphs: parsed.paragraphs.length,
  });
}

/* ==================== 与小程序文件系统交互 ==================== */

/** 读取本地文件为字节数组 */
function readFileBytes(filePath) {
  const fs = wx.getFileSystemManager();
  try {
    const ab = fs.readFileSync(filePath);
    if (ab instanceof ArrayBuffer) return new Uint8Array(ab);
    if (ab && ab.byteLength !== undefined) return new Uint8Array(ab);
    if (typeof ab === 'string') return B.binaryStringToBytes(ab);
  } catch (e) {
    // 老基础库不支持无 encoding 读取，降级为 binary 字符串
    const bin = fs.readFileSync(filePath, 'binary');
    return B.binaryStringToBytes(bin);
  }
  return new Uint8Array(0);
}

/**
 * 读取并解析一个本地文件
 * @param {String} filePath  wx.chooseMessageFile 返回的临时路径
 * @param {String} fileName  原始文件名（用于判断类型）
 * @param {Object} ctx
 */
function importFromPath(filePath, fileName, ctx) {
  let bytes;
  try {
    bytes = readFileBytes(filePath);
  } catch (e) {
    return fail('读取文件失败：' + (e.message || e.errMsg || '未知错误'));
  }
  return parseBytes(bytes, fileName, ctx);
}

module.exports = {
  MAX_BYTES,
  detectFileType,
  parseCsv,
  parseBytes,
  importFromPath,
  readFileBytes,
};
