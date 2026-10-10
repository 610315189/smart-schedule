/**
 * DOCX（Word 2007+）解析
 * ---------------------------------------------------------------
 * 提取课表需要的内容：
 *   - 表格：二维文本数组（支持 gridSpan 横向合并、vMerge 纵向合并继承）
 *   - 段落：表格外的正文行（用于"一行一门课"的 Word 课表）
 */
const ZIP = require('./zip');
const XML = require('./xml');
const B = require('./bytes');

/** 段落文本：处理 w:t 文本、w:br 换行、w:tab 制表符 */
function paragraphText(p) {
  let s = '';
  (function walk(n) {
    for (let i = 0; i < n.children.length; i++) {
      const c = n.children[i];
      if (c.name === XML.TEXT_NODE) {
        s += c.text;
        continue;
      }
      const ln = XML.localName(c.name);
      if (ln === 't') {
        s += XML.textOf(c);
        continue;
      }
      if (ln === 'br' || ln === 'cr') {
        s += '\n';
        continue;
      }
      if (ln === 'tab') {
        s += '\t';
        continue;
      }
      walk(c);
    }
  })(p);
  return s;
}

/** 单元格文本：多个段落用 \n 连接（课表里一个格子常常放课程名/教师/教室多行） */
function cellText(tc) {
  const parts = [];
  const ps = XML.children(tc, 'p');
  for (let i = 0; i < ps.length; i++) {
    parts.push(paragraphText(ps[i]).replace(/\s+$/, ''));
  }
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts.join('\n');
}

/** 解析一个表格为二维数组 */
function parseTable(tbl) {
  const rows = XML.children(tbl, 'tr');
  const out = [];
  const pendingV = {}; // 列索引 -> 正在纵向合并的值

  for (let r = 0; r < rows.length; r++) {
    const tcs = XML.children(rows[r], 'tc');
    const line = [];
    let col = 0;

    for (let k = 0; k < tcs.length; k++) {
      const tc = tcs[k];
      const tcPr = XML.find(tc, 'tcPr');
      let span = 1;
      let vMerge = null;

      if (tcPr) {
        const gs = XML.find(tcPr, 'gridSpan');
        if (gs) span = Math.max(1, Number(XML.attr(gs, 'val')) || 1);
        const vm = XML.find(tcPr, 'vMerge');
        if (vm) vMerge = XML.attr(vm, 'val') || 'continue';
      }

      let text = cellText(tc);

      if (vMerge === 'restart') {
        // 合并起点，记住值
      } else if (vMerge && vMerge !== 'restart') {
        // 合并延续：继承上方的值
        if (pendingV[col] !== undefined && text === '') text = pendingV[col];
      } else {
        // 不参与纵向合并：清掉该列挂起的值
        delete pendingV[col];
      }

      for (let s = 0; s < span; s++) {
        line.push(text);
        if (vMerge === 'restart') pendingV[col + s] = text;
        col++;
      }
    }
    out.push(line);
  }

  return out;
}

/**
 * 解析 docx 文件
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {{paragraphs: String[], tables: Array, allText: String}}
 */
function parseDocx(input) {
  const bytes = B.toBytes(input);
  if (ZIP.isOle2(bytes)) {
    throw new Error('这是旧版 .doc 格式。请在 Word 中「另存为」.docx 后再导入');
  }
  const zip = ZIP.readZip(bytes);

  let docPath = 'word/document.xml';
  if (!zip.has(docPath)) {
    const hit = zip.names().filter(function (n) {
      return /^word\/document\d*\.xml$/.test(n);
    })[0];
    if (!hit) throw new Error('Word 文件结构异常：缺少 word/document.xml');
    docPath = hit;
  }

  const doc = XML.parse(zip.text(docPath));
  const body = XML.find(doc, 'body') || doc;

  const paragraphs = [];
  const tables = [];
  const allTextParts = [];

  // 只处理 body 的直接子节点，避免把表格内段落重复计入
  for (let i = 0; i < body.children.length; i++) {
    const c = body.children[i];
    if (c.name === XML.TEXT_NODE) continue;
    const ln = XML.localName(c.name);
    if (ln === 'p') {
      const t = paragraphText(c).trim();
      if (t) paragraphs.push(t);
    } else if (ln === 'tbl') {
      const table = parseTable(c);
      if (table.length) {
        tables.push(table);
        table.forEach(function (row) {
          const line = row.map(function (v) { return v.replace(/\n/g, ' '); }).join(' ');
          if (line.trim()) allTextParts.push(line);
        });
      }
    }
  }

  return {
    paragraphs: paragraphs,
    tables: tables,
    allText: paragraphs.concat(allTextParts).join('\n'),
  };
}

module.exports = {
  parseDocx,
  parseTable,
  paragraphText,
  cellText,
};
