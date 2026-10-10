/**
 * XLSX（Excel 2007+）解析
 * ---------------------------------------------------------------
 * 只做课表导入需要的事：把工作表读成二维字符串数组。
 * 重点处理：
 *   - sharedStrings 共享字符串表（含富文本片段拼接）
 *   - inlineStr / 公式结果 / 布尔 / 数字单元格
 *   - 稀疏单元格（按 r 属性还原真实行列位置）
 *   - 合并单元格（课表里大量使用，必须把左上角值铺满整个区域）
 */
const ZIP = require('./zip');
const XML = require('./xml');
const B = require('./bytes');

/** "C5" -> 列索引 2（0 基） */
function colIndexOf(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) n = n * 26 + (c - 64);
    else if (c >= 97 && c <= 122) n = n * 26 + (c - 96);
    else break;
  }
  return n - 1;
}

/** "C5" -> 行号 5（1 基） */
function rowIndexOf(ref) {
  const m = String(ref).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** 去掉浮点误差尾巴：1.0000000000000002 -> "1" */
function cleanNumber(s) {
  if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return s;
  const n = Number(s);
  if (!isFinite(n)) return s;
  if (n === Math.floor(n) && Math.abs(n) < 1e15) return String(Math.floor(n));
  return String(parseFloat(n.toFixed(10)));
}

function normalizePath(base, target) {
  if (!target) return '';
  if (target[0] === '/') return target.slice(1);
  const stack = base.split('/');
  stack.pop(); // 去掉文件名
  const parts = target.split('/');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '.' || parts[i] === '') continue;
    if (parts[i] === '..') stack.pop();
    else stack.push(parts[i]);
  }
  return stack.join('/');
}

/** 读取共享字符串表，返回 索引 -> 文本 */
function readSharedStrings(zip) {
  const out = [];
  if (!zip.has('xl/sharedStrings.xml')) return out;
  const doc = XML.parse(zip.text('xl/sharedStrings.xml'));
  const sst = XML.find(doc, 'sst');
  if (!sst) return out;
  const siList = XML.children(sst, 'si');
  for (let i = 0; i < siList.length; i++) {
    out.push(XML.textOf(siList[i]));
  }
  return out;
}

/** 读取工作簿结构：sheet 名 -> 文件路径 */
function readWorkbookSheets(zip) {
  const sheets = [];
  const rels = {};

  if (zip.has('xl/_rels/workbook.xml.rels')) {
    const relDoc = XML.parse(zip.text('xl/_rels/workbook.xml.rels'));
    const list = XML.findAll(relDoc, 'Relationship');
    for (let i = 0; i < list.length; i++) {
      const id = XML.attr(list[i], 'Id');
      const target = XML.attr(list[i], 'Target');
      if (id && target) rels[id] = normalizePath('xl/workbook.xml', target);
    }
  }

  if (zip.has('xl/workbook.xml')) {
    const doc = XML.parse(zip.text('xl/workbook.xml'));
    const sheetNodes = XML.findAll(doc, 'sheet');
    for (let i = 0; i < sheetNodes.length; i++) {
      const name = XML.attr(sheetNodes[i], 'name') || ('Sheet' + (i + 1));
      const rid = XML.attr(sheetNodes[i], 'id');
      let path = rid ? rels[rid] : '';
      if (!path || !zip.has(path)) path = 'xl/worksheets/sheet' + (i + 1) + '.xml';
      if (zip.has(path)) sheets.push({ name: name, path: path });
    }
  }

  // 兜底：没有 workbook.xml 时，直接按文件名收集
  if (!sheets.length) {
    const names = zip.names().filter(function (n) {
      return /^xl\/worksheets\/[^/]+\.xml$/.test(n);
    }).sort();
    names.forEach(function (n, i) {
      sheets.push({ name: 'Sheet' + (i + 1), path: n });
    });
  }
  return sheets;
}

/** 解析单个工作表的单元格，返回矩形二维数组 */
function readSheet(zip, path, sharedStrings) {
  const doc = XML.parse(zip.text(path));
  const sheetData = XML.find(doc, 'sheetData');
  const grid = {}; // "r,c" -> 文本
  let maxRow = 0;
  let maxCol = 0;

  if (sheetData) {
    const rows = XML.children(sheetData, 'row');
    for (let r = 0; r < rows.length; r++) {
      const rowNode = rows[r];
      const rowNum = Number(XML.attr(rowNode, 'r')) || (maxRow + 1);
      const cells = XML.children(rowNode, 'c');
      let autoCol = 0;
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k];
        const ref = XML.attr(c, 'r');
        const colNum = ref ? colIndexOf(ref) : autoCol;
        const rowIdx = ref ? (rowIndexOf(ref) || rowNum) : rowNum;
        autoCol = colNum + 1;

        const value = readCellValue(c, sharedStrings);
        if (value !== '') {
          grid[rowIdx + ',' + colNum] = value;
        }
        if (rowIdx > maxRow) maxRow = rowIdx;
        if (colNum > maxCol) maxCol = colNum;
      }
      if (rowNum > maxRow) maxRow = rowNum;
    }
  }

  // 合并单元格：把左上角的值铺满整个区域（课表跨节次/多列时必须）
  const merges = XML.findAll(doc, 'mergeCell');
  for (let i = 0; i < merges.length; i++) {
    const ref = XML.attr(merges[i], 'ref') || '';
    const parts = ref.split(':');
    if (parts.length !== 2) continue;
    const c1 = colIndexOf(parts[0]);
    const r1 = rowIndexOf(parts[0]);
    const c2 = colIndexOf(parts[1]);
    const r2 = rowIndexOf(parts[1]);
    if (!r1 || !r2) continue;
    const src = grid[r1 + ',' + c1];
    if (src === undefined || src === '') continue;
    for (let rr = r1; rr <= r2; rr++) {
      for (let cc = c1; cc <= c2; cc++) {
        if (grid[rr + ',' + cc] === undefined) grid[rr + ',' + cc] = src;
      }
    }
    if (r2 > maxRow) maxRow = r2;
    if (c2 > maxCol) maxCol = c2;
  }

  // 稀疏 map -> 矩形数组
  const out = [];
  for (let r = 1; r <= maxRow; r++) {
    const line = [];
    for (let c = 0; c <= maxCol; c++) {
      const v = grid[r + ',' + c];
      line.push(v === undefined ? '' : v);
    }
    out.push(line);
  }
  return out;
}

function readCellValue(c, sharedStrings) {
  const t = XML.attr(c, 't');

  if (t === 'inlineStr') {
    const is = XML.find(c, 'is');
    return is ? XML.textOf(is).trim() : '';
  }

  // 共享字符串
  if (t === 's') {
    const v = XML.find(c, 'v');
    const idx = v ? Number(XML.textOf(v)) : NaN;
    return isFinite(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx] : '';
  }

  const v = XML.find(c, 'v');
  if (!v) return '';
  const raw = XML.textOf(v);

  if (t === 'str') return raw;                // 公式的字符串结果
  if (t === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  if (t === 'e') return '';                   // 错误值忽略
  if (t === 'd') return raw;                  // ISO 日期字符串
  return cleanNumber(raw.trim());             // 默认按数字处理
}

/**
 * 解析 xlsx 文件
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {{sheets: Array<{name, rows}>, sheetNames: String[]}}
 */
function parseXlsx(input) {
  const bytes = B.toBytes(input);
  if (ZIP.isOle2(bytes)) {
    throw new Error('这是旧版 .xls 格式。请在 Excel 中「另存为」.xlsx 后再导入');
  }
  const zip = ZIP.readZip(bytes);
  if (zip.has('EncryptedPackage') || zip.has('EncryptionInfo')) {
    throw new Error('工作簿已加密，请先取消密码保护再导入');
  }

  const sharedStrings = readSharedStrings(zip);
  const sheetInfos = readWorkbookSheets(zip);
  if (!sheetInfos.length) throw new Error('Excel 文件里没有找到工作表');

  const sheets = [];
  for (let i = 0; i < sheetInfos.length; i++) {
    try {
      sheets.push({
        name: sheetInfos[i].name,
        rows: readSheet(zip, sheetInfos[i].path, sharedStrings),
      });
    } catch (e) {
      // 单个工作表失败不影响其它表
      sheets.push({ name: sheetInfos[i].name, rows: [], error: e.message });
    }
  }

  return {
    sheets: sheets,
    sheetNames: sheets.map(function (s) { return s.name; }),
  };
}

module.exports = {
  parseXlsx,
  colIndexOf,
  rowIndexOf,
  cleanNumber,
  normalizePath,
};
