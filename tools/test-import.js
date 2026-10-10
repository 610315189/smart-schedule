/**
 * Excel / Word / CSV 课表导入测试
 * 运行：node tools/test-import.js
 *
 * 用 tools/make-samples.py 生成的真实 Office 文件做端到端验证，
 * 并对解析器的各个零件做单元测试。
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'miniprogram');
const SAMPLES = path.join(__dirname, 'samples');

const B = require(path.join(BASE, 'utils/bytes.js'));
const ZIP = require(path.join(BASE, 'utils/zip.js'));
const XMLU = require(path.join(BASE, 'utils/xml.js'));
const XLSX = require(path.join(BASE, 'utils/xlsx.js'));
const DOCX = require(path.join(BASE, 'utils/docx.js'));
const EX = require(path.join(BASE, 'utils/schedule-extract.js'));
const FI = require(path.join(BASE, 'utils/file-import.js'));
const S = require(path.join(BASE, 'utils/schedule.js'));
const T = require(path.join(BASE, 'utils/time.js'));
const { CLASSROOMS } = require(path.join(BASE, 'data/classrooms.js'));
const { DEFAULT_PERIODS } = require(path.join(BASE, 'data/periods.js'));

const ctx = { classrooms: CLASSROOMS, periods: DEFAULT_PERIODS, totalWeeks: 16 };

let pass = 0;
let fail = 0;
const failures = [];

function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + label); }
  else {
    fail++; failures.push(label);
    console.log('  \u2717 ' + label + (extra !== undefined ? '   → ' + JSON.stringify(extra) : ''));
  }
}
function section(t) { console.log('\n' + t); }

/** 按文件名找解析出的课程 */
function findCourse(courses, name) {
  for (let i = 0; i < courses.length; i++) {
    if (courses[i].name.indexOf(name) >= 0) return courses[i];
  }
  return null;
}

function loadSample(name) {
  const p = path.join(SAMPLES, name);
  if (!fs.existsSync(p)) throw new Error('缺少样本文件 ' + name + '（请先运行 make-samples.py）');
  const buf = fs.readFileSync(p);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function analyze(name, opts) {
  return FI.parseBytes(loadSample(name), name, opts || ctx);
}

/* ==================== 0. 样本存在性 ==================== */
section('0. 测试样本');
const REQUIRED = [
  'sample-list.xlsx', 'sample-grid.xlsx', 'sample-grid-rows.xlsx', 'sample-multi-sheet.xlsx',
  'sample-inline.xlsx', 'sample-shared.xlsx', 'sample-not-a-schedule.xlsx',
  'sample-list.docx', 'sample-grid.docx', 'sample-text.docx',
  'sample-list.csv', 'sample-quoted.csv', 'sample-list.txt', 'sample-legacy.xls',
  'sample-messy.xlsx', 'sample-no-header.xlsx', 'sample-two-row-header.xlsx',
  'sample-multi-block.xlsx', 'sample-messy.docx', 'sample-shuffled.xlsx',
  'sample-cross-list.xlsx', 'sample-cross-grid.xlsx', 'sample-jwxt-real.xlsx',
];
let missing = REQUIRED.filter(function (n) { return !fs.existsSync(path.join(SAMPLES, n)); });
ok(missing.length === 0, REQUIRED.length + ' 个样本文件齐备', missing);

/* ==================== 1. 单元：文本解析零件 ==================== */
section('1. 解析零件单元测试');
ok(EX.parseDayStrict('星期一') === 1, 'parseDayStrict("星期一") = 1');
ok(EX.parseDayStrict('周二') === 2, 'parseDayStrict("周二") = 2');
ok(EX.parseDayStrict('三') === 3, 'parseDayStrict("三") = 3');
ok(EX.parseDayStrict('星期日') === 7, 'parseDayStrict("星期日") = 7');
ok(EX.parseDayStrict('Mon') === 1, 'parseDayStrict("Mon") = 1');
ok(EX.parseDayStrict('课程名称') === 0, 'parseDayStrict("课程名称") = 0（不误判）');
ok(EX.parseDayStrict('高等数学') === 0, 'parseDayStrict("高等数学") = 0（不误判）');

ok(JSON.stringify(EX.parsePeriodLabel('第1-2节', DEFAULT_PERIODS)) === '{"start":1,"end":2}',
  'parsePeriodLabel("第1-2节") = 1-2', EX.parsePeriodLabel('第1-2节', DEFAULT_PERIODS));
ok(JSON.stringify(EX.parsePeriodLabel('1-2', DEFAULT_PERIODS)) === '{"start":1,"end":2}',
  'parsePeriodLabel("1-2") = 1-2');
ok(JSON.stringify(EX.parsePeriodLabel('第一节', DEFAULT_PERIODS)) === '{"start":1,"end":1}',
  'parsePeriodLabel("第一节") = 1');
ok(JSON.stringify(EX.parsePeriodLabel('第10节', DEFAULT_PERIODS)) === '{"start":10,"end":10}',
  'parsePeriodLabel("第10节") = 10');
ok(JSON.stringify(EX.parsePeriodLabel('08:00-09:40', DEFAULT_PERIODS)) === '{"start":1,"end":2}',
  'parsePeriodLabel("08:00-09:40") 映射到 1-2 节', EX.parsePeriodLabel('08:00-09:40', DEFAULT_PERIODS));
ok(EX.parsePeriodLabel('上午', DEFAULT_PERIODS) === null, 'parsePeriodLabel("上午") = null');

const w1 = EX.parseWeeks('1-16周');
ok(w1 && w1.start === 1 && w1.end === 16 && w1.parity === 'all', 'parseWeeks("1-16周")');
const w2 = EX.parseWeeks('1-16周(单)');
ok(w2 && w2.parity === 'odd', 'parseWeeks("1-16周(单)") 识别为单周', w2 && w2.parity);
const w3 = EX.parseWeeks('1,3,5,7周');
ok(w3 && w3.parity === 'custom' && w3.list.length === 4 && w3.list[3] === 7,
  'parseWeeks("1,3,5,7周") 识别为枚举', w3 && w3.list);
ok(EX.parseWeeks('3-12') === null, 'parseWeeks("3-12") 默认不误判为周次');
const w4 = EX.parseWeeks('3-12', true);
ok(w4 && w4.start === 3 && w4.end === 12, 'parseWeeks("3-12", allowBare) 可用');
ok(EX.parseWeeks('高等数学') === null, 'parseWeeks("高等数学") = null');

const r1 = EX.extractRoomHit('高等数学 张建国 A301 1-16周', CLASSROOMS);
ok(r1 && r1.roomId === 'A301' && r1.known === true, '从文本识别出教室字典里的 A301',
  r1 && r1.roomId);
const r2 = EX.extractRoomHit('上课地点：B201', CLASSROOMS);
ok(r2 && r2.roomId === 'B201', '识别"地点：B201"', r2 && r2.roomId);
const r3 = EX.extractRoomHit('实验楼C105', CLASSROOMS);
ok(r3 && r3.roomId === 'C105', '识别"实验楼C105"', r3 && r3.roomId);
ok(EX.extractRoomHit('高等数学', CLASSROOMS) === null, '无教室时返回 null');

section('2. 单元格内容解析');
const c1 = EX.parseCellContent('高等数学(上)\n张建国\nA301\n1-16周', ctx);
ok(c1.length === 1, '单门课单元格解析出 1 条', c1.length);
ok(c1[0] && c1[0].name === '高等数学(上)', '课程名正确', c1[0] && c1[0].name);
ok(c1[0] && c1[0].teacher === '张建国', '教师正确', c1[0] && c1[0].teacher);
ok(c1[0] && c1[0].roomId === 'A301', '教室正确', c1[0] && c1[0].roomId);
ok(c1[0] && c1[0].weeks && c1[0].weeks.start === 1 && c1[0].weeks.end === 16, '周次正确');

const c2 = EX.parseCellContent('数据结构 刘伟 B301 1-16周', ctx);
ok(c2.length === 1 && c2[0].name === '数据结构' && c2[0].roomId === 'B301',
  '单行空格分隔的单元格也能解析', c2);

const c3 = EX.parseCellContent('程序设计基础\n刘伟\nA301\n1-16周\n数据结构\n王强\nB301\n1-16周', ctx);
ok(c3.length === 2, '一个格子里的两门课被拆开', c3.length);
ok(c3[0] && c3[0].name === '程序设计基础' && c3[1] && c3[1].name === '数据结构',
  '两门课的名称各自正确', c3.map(function (c) { return c.name; }));
ok(c3[1] && c3[1].roomId === 'B301' && c3[1].teacher === '王强',
  '第二门课的教室与教师归属正确', c3[1] && [c3[1].roomId, c3[1].teacher]);

// 单双周不同课放在同一格（真实教务课表常见）
const c4 = EX.parseCellContent(
  '程序设计基础\n刘伟\nA301\n1-16周(单)\n数据结构\n王强\nB301\n2-16周(双)', ctx);
ok(c4.length === 2, '单双周两门课被拆开', c4.length);
ok(c4[0] && c4[0].name === '程序设计基础' && c4[0].weeks && c4[0].weeks.parity === 'odd',
  '第一门为单周', c4[0] && [c4[0].name, c4[0].weeks]);
ok(c4[1] && c4[1].name === '数据结构' && c4[1].weeks && c4[1].weeks.parity === 'even',
  '第二门为双周，且没有被"(单)"污染', c4[1] && [c4[1].name, c4[1].weeks]);
ok(c4[1] && c4[1].roomId === 'B301', '第二门教室正确', c4[1] && c4[1].roomId);

// 单双周夹在数字与"周"之间的写法
const wOdd = EX.parseWeeks('1-16单周');
ok(wOdd && wOdd.start === 1 && wOdd.end === 16 && wOdd.parity === 'odd',
  'parseWeeks("1-16单周") 识别为单周', wOdd);
const wEven = EX.parseWeeks('2-16双周');
ok(wEven && wEven.parity === 'even', 'parseWeeks("2-16双周") 识别为双周', wEven);
const wBare = EX.parseWeeks('1-16周单');
ok(wBare && wBare.parity === 'odd', 'parseWeeks("1-16周单") 识别为单周', wBare);

/* ==================== 3. XML 解析器 ==================== */
section('3. XML 解析器');
const xd = XMLU.parse('<?xml version="1.0"?><root a="1"><w:p><w:t>你好</w:t></w:p><w:p><w:t>世界</w:t></w:p></root>');
ok(XMLU.findAll(xd, 't').length === 2, '按局部名匹配带命名空间的标签', XMLU.findAll(xd, 't').length);
ok(XMLU.find(xd, 'p').name === 'w:p', 'find 返回原始标签名', XMLU.find(xd, 'p').name);
ok(XMLU.textOf(XMLU.find(xd, 'root')) === '你好世界', 'textOf 按顺序拼接文本',
  XMLU.textOf(XMLU.find(xd, 'root')));
ok(XMLU.attr(XMLU.find(xd, 'root'), 'a') === '1', '属性读取正确');
const xe = XMLU.parse('<r><a x="&lt;1&gt;">A&amp;B</a><!--注释--><![CDATA[<raw>]]></r>');
ok(XMLU.textOf(XMLU.find(xe, 'a')) === 'A&B', '实体解码正确', XMLU.textOf(XMLU.find(xe, 'a')));
ok(XMLU.textOf(xe).indexOf('<raw>') >= 0, 'CDATA 原样保留');
ok(XMLU.textOf(xe).indexOf('注释') < 0, '注释被忽略');
const xs = XMLU.parse('<r><a/><b>1</b></r>');
const xsRoot = XMLU.find(xs, 'r');
ok(XMLU.children(xsRoot, 'a').length === 1 && XMLU.children(xsRoot, 'b').length === 1,
  '自闭合标签处理正确', { a: XMLU.children(xsRoot, 'a').length, b: XMLU.children(xsRoot, 'b').length });
ok(XMLU.textOf(xsRoot) === '1', '自闭合标签不产生多余文本', XMLU.textOf(xsRoot));

/* ==================== 4. ZIP 与 XLSX 底层 ==================== */
section('4. ZIP / XLSX 底层');
const xlsxBytes = loadSample('sample-list.xlsx');
ok(ZIP.isZip(xlsxBytes), 'xlsx 被识别为 ZIP 容器');
const zip = ZIP.readZip(xlsxBytes);
ok(zip.has('xl/workbook.xml'), '能定位 xl/workbook.xml');
ok(!zip.has('xl/sharedStrings.xml'), 'openpyxl 生成的样本使用 inlineStr（无共享字符串表）');
ok(zip.names().indexOf('[Content_Types].xml') >= 0, '能列出 ZIP 条目', zip.names().length + ' 个条目');
const contentTypes = zip.text('[Content_Types].xml');
ok(contentTypes.indexOf('spreadsheetml') >= 0, '解压并解码 XML 成功（含 CRC 校验）');
ok(XLSX.colIndexOf('A1') === 0 && XLSX.colIndexOf('C5') === 2 && XLSX.colIndexOf('AA1') === 26,
  '列号解析正确');
ok(XLSX.rowIndexOf('C5') === 5, '行号解析正确');
ok(XLSX.cleanNumber('1') === '1' && XLSX.cleanNumber('1.0000000000000002') === '1' &&
  XLSX.cleanNumber('3.5') === '3.5', '数字清洗正确', XLSX.cleanNumber('1.0000000000000002'));

const parsedXlsx = XLSX.parseXlsx(xlsxBytes);
ok(parsedXlsx.sheets.length === 1 && parsedXlsx.sheets[0].name === '我的课表',
  '工作簿名称正确', parsedXlsx.sheetNames);
ok(parsedXlsx.sheets[0].rows.length === 7, '读到 7 行（含表头）', parsedXlsx.sheets[0].rows.length);
ok(parsedXlsx.sheets[0].rows[0][0] === '课程名称', '首个单元格正确', parsedXlsx.sheets[0].rows[0][0]);
ok(parsedXlsx.sheets[0].rows[1][0] === '高等数学(上)', '共享字符串解析正确',
  parsedXlsx.sheets[0].rows[1][0]);

// 合并单元格填充
const gridParsed = XLSX.parseXlsx(loadSample('sample-grid.xlsx'));
ok(gridParsed.sheets[0].rows[2][0] === '1-2节', '纵向合并的节次列被铺满到下一行',
  gridParsed.sheets[0].rows[2][0]);
ok(gridParsed.sheets[0].rows[2][1] === '高等数学(上)\n张建国\nA301\n1-16周',
  '课程单元格合并后内容被复制到整块区域');

/* ==================== 5. Excel 导入端到端 ==================== */
section('5. Excel 列表式导入');
const list = analyze('sample-list.xlsx');
ok(list.ok === true, '解析成功');
ok(list.fileType === 'xlsx', '文件类型识别为 xlsx', list.fileType);
ok(list.layout === 'list', '识别为列表式布局', list.layout);
ok(list.courses.length === 6, '解析出 6 门课', list.courses.length);

const gs = findCourse(list.courses, '高等数学');
ok(gs && gs.day === 1 && gs.start === 1 && gs.end === 2, '高数：周一 1-2 节',
  gs && [gs.day, gs.start, gs.end]);
ok(gs && gs.roomId === 'A301' && gs.teacher === '张建国', '高数：教室与教师正确',
  gs && [gs.roomId, gs.teacher]);
ok(gs && gs.weeks && gs.weeks.start === 1 && gs.weeks.end === 16 && gs.weeks.parity === 'all',
  '高数：1-16 周');

const en = findCourse(list.courses, '大学英语');
ok(en && en.day === 1 && en.start === 3 && en.end === 4, '英语：周一 3-4 节（"3-4节"写法）',
  en && [en.day, en.start, en.end]);

const phy = findCourse(list.courses, '大学物理');
ok(phy && phy.day === 4 && phy.start === 7 && phy.end === 8, '物理：周四 7-8 节（"第7-8节"写法）',
  phy && [phy.day, phy.start, phy.end]);
ok(phy && phy.weeks && phy.weeks.parity === 'odd', '物理：单周', phy && phy.weeks);

const pe = findCourse(list.courses, '体育');
ok(pe && pe.weeks && pe.weeks.start === 3 && pe.weeks.end === 12, '体育：3-12 周', pe && pe.weeks);
ok(findCourse(list.courses, '计算机') === null, '（对照）不存在的课程返回 null');

const prog = findCourse(list.courses, '程序设计');
ok(prog && prog.weeks && prog.weeks.start === 1 && prog.weeks.end === 16,
  '程序设计：周次列写"1-16"（无"周"字）也能解析', prog && prog.weeks);

section('6. Excel 网格式导入（含合并单元格）');
const grid = analyze('sample-grid.xlsx');
ok(grid.ok === true && grid.layout === 'grid', '识别为网格式布局', grid.layout);
ok(grid.courses.length === 6, '解析出 6 门课', grid.courses.length);

const gGs = findCourse(grid.courses, '高等数学');
ok(gGs && gGs.day === 1 && gGs.start === 1 && gGs.end === 2,
  '合并单元格跨 1-2 节后合并为一门课', gGs && [gGs.day, gGs.start, gGs.end]);
ok(gGs && gGs.roomId === 'A301', '网格式：教室从单元格内文本提取', gGs && gGs.roomId);

const gDs = findCourse(grid.courses, '数据结构');
ok(gDs && gDs.day === 3 && gDs.start === 1 && gDs.end === 2, '数据结构：周三 1-2 节',
  gDs && [gDs.day, gDs.start, gDs.end]);

const gEn = findCourse(grid.courses, '大学英语');
ok(gEn && gEn.day === 2 && gEn.start === 3 && gEn.end === 4, '英语：周二 3-4 节',
  gEn && [gEn.day, gEn.start, gEn.end]);

const gPhy = findCourse(grid.courses, '大学物理');
ok(gPhy && gPhy.day === 4 && gPhy.weeks && gPhy.weeks.parity === 'odd',
  '物理：周四 + 单周', gPhy && [gPhy.day, gPhy.weeks]);
const gNet = findCourse(grid.courses, '计算机网络');
ok(gNet && gNet.day === 5 && gNet.start === 5 && gNet.end === 6, '计算机网络：周五 5-6 节',
  gNet && [gNet.day, gNet.start, gNet.end]);

section('7. Excel 网格式（节次列不合并，靠课程格跨行）');
const gridRows = analyze('sample-grid-rows.xlsx');
ok(gridRows.ok === true && gridRows.courses.length === 5, '解析出 5 门课', gridRows.courses.length);
const rGs = findCourse(gridRows.courses, '高等数学');
ok(rGs && rGs.start === 1 && rGs.end === 2, '相邻节次的同一门课被合并为 1-2 节',
  rGs && [rGs.start, rGs.end]);
ok(rGs && rGs.teacher === '张建国', '跨行合并后教师字段仍正确', rGs && rGs.teacher);
const rPhy = findCourse(gridRows.courses, '大学物理');
ok(rPhy && rPhy.start === 7 && rPhy.end === 8, '物理合并为 7-8 节', rPhy && [rPhy.start, rPhy.end]);
ok(rPhy && rPhy.name === '大学物理' && rPhy.teacher === '周立',
  '「周立」被正确识别为教师而不是拼进课程名', rPhy && [rPhy.name, rPhy.teacher]);

section('8. 多工作表 / inlineStr / sharedStrings / 无效文件');
const multi = analyze('sample-multi-sheet.xlsx');
ok(multi.ok === true && multi.usedSheet === '2026秋课表', '自动选用含课表的工作表', multi.usedSheet);
ok(multi.courses.length === 3, '多工作表样本解析出 3 门课', multi.courses.length);
ok(multi.warnings.join('').indexOf('2 个工作表') >= 0, '提示文件包含多个工作表', multi.warnings);

const inline = analyze('sample-inline.xlsx');
ok(inline.ok === true && inline.courses.length === 3, 'inlineStr 工作簿解析成功', inline.courses.length);
ok(findCourse(inline.courses, '高等数学') !== null, 'inlineStr 中文内容正确');
ok(!ZIP.readZip(loadSample('sample-inline.xlsx')).has('xl/sharedStrings.xml'),
  '（对照）inlineStr 样本确实没有共享字符串表');

const shared = analyze('sample-shared.xlsx');
ok(shared.ok === true && shared.courses.length === 3, 'sharedStrings 工作簿解析成功',
  shared.courses.length);
ok(ZIP.readZip(loadSample('sample-shared.xlsx')).has('xl/sharedStrings.xml'),
  '（对照）sharedStrings 样本确实有共享字符串表');
const shT = findCourse(shared.courses, '计算机网络');
ok(shT && shT.teacher === '郑楠' && shT.day === 5, 'sharedStrings 路径下字段完整', shT);

const bad = analyze('sample-not-a-schedule.xlsx');
ok(bad.ok === false, '无课表结构的文件返回失败');
ok(/没有识别出课表结构/.test(bad.error), '给出可读的失败原因', bad.error && bad.error.slice(0, 40));

/* ==================== 9. Word 导入 ==================== */
section('9. Word 导入');
const docxList = analyze('sample-list.docx');
ok(docxList.ok === true && docxList.fileType === 'docx', 'Word 列表式表格解析成功', docxList.fileType);
ok(docxList.courses.length === 4, '解析出 4 门课', docxList.courses.length);
const dGs = findCourse(docxList.courses, '高等数学');
ok(dGs && dGs.day === 1 && dGs.start === 1 && dGs.end === 2 && dGs.roomId === 'A301',
  'Word 表格：课程字段正确', dGs);
ok(dGs && dGs.teacher === '张建国', 'Word 表格：教师列正确', dGs && dGs.teacher);

const docxGrid = analyze('sample-grid.docx');
ok(docxGrid.ok === true && docxGrid.layout === 'grid', 'Word 网格式表格识别成功', docxGrid.layout);
ok(docxGrid.courses.length === 4, 'Word 网格式解析出 4 门课', docxGrid.courses.length);
const wGs = findCourse(docxGrid.courses, '高等数学');
ok(wGs && wGs.day === 1 && wGs.start === 1 && wGs.end === 2,
  'Word vMerge 纵向合并被正确继承并合并节次', wGs && [wGs.day, wGs.start, wGs.end]);
const wDs = findCourse(docxGrid.courses, '数据结构');
ok(wDs && wDs.day === 3, 'Word 网格式：数据结构在周三', wDs && wDs.day);

const docxText = analyze('sample-text.docx');
ok(docxText.ok === true && docxText.layout === 'text', 'Word 纯段落文本式解析成功', docxText.layout);
ok(docxText.courses.length === 5, '段落式解析出 5 门课', docxText.courses.length);
const tPhy = findCourse(docxText.courses, '大学物理');
ok(tPhy && tPhy.weeks && tPhy.weeks.parity === 'odd', '段落式："1-16单"识别为单周',
  tPhy && tPhy.weeks);

const docxRaw = DOCX.parseDocx(loadSample('sample-grid.docx'));
ok(docxRaw.tables.length === 1, 'DOCX 解析出 1 个表格', docxRaw.tables.length);
ok(docxRaw.tables[0].length === 7, '表格 7 行（含表头）', docxRaw.tables[0].length);
ok(docxRaw.tables[0][1][1].indexOf('高等数学') >= 0, '表格单元格文本正确');

/* ==================== 10. CSV / TXT ==================== */
section('10. CSV / TXT');
const csv = analyze('sample-list.csv');
ok(csv.ok === true && csv.fileType === 'csv', 'CSV 解析成功', csv.fileType);
ok(csv.courses.length === 3, '解析出 3 门课（含 UTF-8 BOM）', csv.courses.length);
ok(findCourse(csv.courses, '程序设计') !== null, 'CSV 中文内容正确');

const quoted = analyze('sample-quoted.csv');
ok(quoted.ok === true && quoted.courses.length === 2, '带引号的 CSV 解析出 2 门课', quoted.courses.length);
ok(findCourse(quoted.courses, '高等数学(上),含实验') !== null,
  '引号内的逗号被正确保留', quoted.courses.map(function (c) { return c.name; }));

const txt = analyze('sample-list.txt');
ok(txt.ok === true && txt.fileType === 'txt', 'TXT 解析成功', txt.fileType);
ok(txt.courses.length === 3, '解析出 3 门课（含注释行）', txt.courses.length);
const txtPhy = findCourse(txt.courses, '大学物理');
ok(txtPhy && txtPhy.day === 4 && txtPhy.start === 7 && txtPhy.end === 8 &&
  txtPhy.roomId === 'A201' && txtPhy.weeks.parity === 'odd',
  '自由式文本行（顺序不限）解析正确', txtPhy);

/* ==================== 11. 错误处理 ==================== */
section('11. 错误处理与边界');
const legacy = analyze('sample-legacy.xls');
ok(legacy.ok === false, '旧版 .xls 返回失败');
ok(/另存为/.test(legacy.error) && /xlsx/.test(legacy.error), '提示用户另存为 .xlsx', legacy.error);

const notZip = FI.parseBytes(new Uint8Array([1, 2, 3]), 'a.xlsx', ctx);
ok(notZip.ok === false, '伪装成 xlsx 的非 ZIP 文件被拒绝');

const empty = FI.parseBytes(new Uint8Array(0), 'a.xlsx', ctx);
ok(empty.ok === false && /空/.test(empty.error), '空文件被拒绝', empty.error);

const huge = FI.parseBytes(new Uint8Array(FI.MAX_BYTES + 1), 'big.xlsx', ctx);
ok(huge.ok === false && /太大/.test(huge.error), '超大文件被拒绝', huge.error);

const noWeeks = EX.parseCellContent('高等数学\n张建国\nA301', ctx);
ok(noWeeks.length === 1 && noWeeks[0].warnings.indexOf('未识别到周次') >= 0,
  '缺周次时给出警告', noWeeks[0] && noWeeks[0].warnings);

const noRoom = EX.parseCellContent('高等数学\n张建国\n1-16周', ctx);
ok(noRoom.length === 1 && noRoom[0].warnings.indexOf('未识别到教室') >= 0,
  '缺教室时给出警告', noRoom[0] && noRoom[0].warnings);

const unknownRoom = analyze('sample-grid.xlsx');
ok(unknownRoom.unknownRooms.length === 0, '样本里所有教室都在字典中（无未知教室）', unknownRoom.unknownRooms);

const emptyTable = EX.extractFromTable([], ctx);
ok(emptyTable.courses.length === 0 && emptyTable.layout === 'empty', '空表格返回 empty 布局');

const emptyRows = EX.extractFromTable([['', ''], ['', '']], ctx);
ok(emptyRows.courses.length === 0, '全空表格不产生课程');

/* ==================== 12. 与课表引擎打通 ==================== */
section('12. 导入结果接入课表引擎');
const NOW = new Date(2026, 9, 7, 13, 44, 0); // 第 5 周 周三 13:44
const settings = {
  termStartDate: '2026-09-07', totalWeeks: 20,
  aheadMinutes: 20, finalAheadMinutes: 5, autoPopupMinutes: 30,
};
const imported = list.courses.map(function (c, i) {
  return S.normalizeCourse({
    id: 'imp_' + i, name: c.name, teacher: c.teacher, roomId: c.roomId,
    day: c.day, start: c.start, end: c.end, weeks: c.weeks,
  }, i);
});
ok(imported.length === 6, '转换为标准课程对象', imported.length);
ok(imported.every(function (c) { return !!c.color && !!c.id; }), '每门课都补齐了 id 与颜色');

const next = S.getNextClass(imported, CLASSROOMS, DEFAULT_PERIODS, NOW, settings);
ok(next && next.course.name === '程序设计基础', '导入的课表能算出下一节课', next && next.course.name);
ok(next && next.startTime === '14:00' && next.minutesLeft === 16,
  '下一节课时间与剩余分钟正确', next && [next.startTime, next.minutesLeft]);

const timeline = S.buildTimeline(imported, CLASSROOMS, DEFAULT_PERIODS, new Date(2026, 9, 7), settings);
ok(timeline.courses.length >= 1, '周三时间轴有课', timeline.courses.length);
ok(timeline.freeSlots.length >= 1, '能算出当日空堂', timeline.freeSlots.length);

const conflicts = S.detectConflicts(imported);
ok(conflicts.length === 0, '导入的课表无冲突', conflicts.map(function (c) { return c.message; }));

// 交叉验证：内容完全一致的两个文件（一个列表式、一个网格式）必须解析出同一份课表
const crossList = analyze('sample-cross-list.xlsx');
const crossGrid = analyze('sample-cross-grid.xlsx');
function sig(courses) {
  return courses.map(function (c) {
    return c.name + '@' + c.day + '-' + c.start + '-' + c.end + '-' + c.roomId +
      '-' + (c.weeks ? (c.weeks.start + '~' + c.weeks.end + '/' + c.weeks.parity) : 'none');
  }).sort().join('|');
}
ok(crossList.courses.length === 5 && crossGrid.courses.length === 5,
  '交叉样本两侧都解析出 5 门课', [crossList.courses.length, crossGrid.courses.length]);
ok(sig(crossList.courses) === sig(crossGrid.courses),
  '列表式与网格式解析出完全一致的课表（含星期/节次/教室/周次）',
  { list: sig(crossList.courses), grid: sig(crossGrid.courses) });
ok(crossGrid.layout === 'grid' && crossList.layout === 'list',
  '两种布局被正确区分', [crossList.layout, crossGrid.layout]);

// 所有 Excel 样本产出的课程字段都合法
const allSamples = ['sample-list.xlsx', 'sample-grid.xlsx', 'sample-grid-rows.xlsx',
  'sample-multi-sheet.xlsx', 'sample-inline.xlsx', 'sample-shared.xlsx',
  'sample-cross-list.xlsx', 'sample-cross-grid.xlsx'];
let allValid = true;
let detail = '';
allSamples.forEach(function (name) {
  const r = analyze(name);
  r.courses.forEach(function (c) {
    if (!c.name || !c.day || !c.start || c.start > c.end || c.day < 1 || c.day > 7) {
      allValid = false;
      detail = name + ' -> ' + JSON.stringify(c);
    }
  });
});
ok(allValid, '所有 Excel 样本产出的课程字段都合法（名称/星期/节次区间）', detail);

/* ==================== 13. 智能识别 ==================== */
section('13. 智能识别：自动定位课表区与列语义');
const DETECT = require(path.join(BASE, 'utils/table-detect.js'));

// --- 零件：列画像 ---
const pd = DETECT.profileColumn(['周一', '周二', '周三', '周四'], ctx);
ok(pd.n === 4 && pd.day === 4, '列画像：一列全是星期 -> day 命中 4/4', pd.day);

const pw = DETECT.profileColumn(['1-16周', '1-16周', '3-12周'], ctx);
ok(pw.weeks === 3, '列画像：一列全是周次', pw.weeks);

const pm = DETECT.profileColumn(['高等数学(上)', '大学英语(II)', '数据结构'], ctx);
ok(pm.cn === 3, '列画像：带括号的课程名也算"含中文"', pm.cn);
ok(pm.cnPure === 1, '列画像：纯中文只算"数据结构"一条', pm.cnPure);

const pr = DETECT.profileColumn(['A301', 'B201', 'C105'], ctx);
ok(pr.roomKnown === 3, '列画像：教室字典命中 3/3', pr.roomKnown);

// --- 零件：模糊表头匹配 ---
ok(EX.matchField('科目') === 'name', '模糊表头：科目 -> 课程名');
ok(EX.matchField('上课时间') === 'time', '模糊表头：上课时间 -> 时间');
ok(EX.matchField('教学地点') === 'room', '模糊表头：教学地点 -> 教室');
ok(EX.matchField('授课教师') === 'teacher', '模糊表头：授课教师 -> 教师');
ok(EX.matchField('课程名字') === 'name', '模糊表头：容忍多余字');
ok(EX.matchField('周次') === 'weeks', '模糊表头：周次 -> 周次');
ok(EX.matchField('星期') === 'day', '模糊表头：星期 -> 星期');
ok(EX.matchField('') === '' && EX.matchField('高等数学') === '', '模糊表头：非表头文本不误判');

// --- 零件：行块切分 ---
const blocks = DETECT.detectRowBlocks([
  ['a', 'b'], ['c', 'd'], ['', ''], ['', ''], ['', ''], ['e', 'f'], ['g', 'h'],
]);
ok(blocks.length === 2, '空行把表格切成两块', blocks);

// --- 端到端：脏文件（标题 + 说明 + 空行 + 别名表头 + 备注） ---
const messy = analyze('sample-messy.xlsx');
ok(messy.ok === true && messy.courses.length === 5,
  '脏文件：跳过标题与说明，识别出全部 5 门课', messy.courses.length);
ok(messy.recognize && messy.recognize.source === 'header', '脏文件：识别依据是表头',
  messy.recognize && messy.recognize.source);
ok(/表头/.test(messy.recognize.method), '脏文件：说明里写清了靠第几行表头', messy.recognize.method);
ok(messy.recognize.confidence === 1, '脏文件：字段完整度 100%', messy.recognize.confidence);
const mGs = findCourse(messy.courses, '高等数学');
ok(mGs && mGs.day === 1 && mGs.start === 1 && mGs.end === 2 && mGs.roomId === 'A301' &&
  mGs.teacher === '张建国',
  '脏文件：存在序号列也不影响字段对齐', mGs);
const alts = (messy.recognize.alternatives || []).map(function (a) { return a.method; }).join('|');
ok(alts.indexOf('课表网格') < 0, '脏文件：普通数据行没有被误判成课表网格', alts);
ok(messy.courses.every(function (c) { return typeof c._confidence === 'number' && c._confidence > 0; }),
  '每条课程都带识别置信度');

// --- 端到端：完全没有表头 ---
const headerless = analyze('sample-no-header.xlsx');
ok(headerless.ok === true && headerless.courses.length === 5,
  '无表头：纯靠列内容特征识别出 5 门课', headerless.courses.length);
ok(headerless.recognize.source === 'content', '无表头：识别依据标记为内容特征',
  headerless.recognize.source);
const inf = headerless.recognize.inferred;
ok(inf && inf.columns.name === 0 && inf.columns.day === 1 && inf.columns.period === 2 &&
  inf.columns.room === 3 && inf.columns.weeks === 4 && inf.columns.teacher === 5,
  '无表头：六列的字段推断全部正确', inf && inf.columns);
const hPhy = findCourse(headerless.courses, '大学物理');
ok(hPhy && hPhy.weeks && hPhy.weeks.parity === 'odd' && hPhy.roomId === 'A201',
  '无表头：周次与教室解析正确', hPhy);

// --- 端到端：两行复合表头 ---
const twoRow = analyze('sample-two-row-header.xlsx');
ok(twoRow.ok === true && twoRow.courses.length === 3,
  '两行复合表头：识别出 3 门课', twoRow.courses.length);
ok(/占 2 行/.test(twoRow.recognize.method), '两行复合表头：说明里体现了表头占两行',
  twoRow.recognize.method);
const tGs = findCourse(twoRow.courses, '高等数学');
ok(tGs && tGs.teacher === '张建国' && tGs.roomId === 'A301' && tGs.weeks && tGs.weeks.end === 16,
  '两行复合表头：第二行的细分列（教师/教室/周次）全部对上', tGs);

// --- 端到端：同一 sheet 多块，课表在下半部分 ---
const multiBlock = analyze('sample-multi-block.xlsx');
ok(multiBlock.ok === true && multiBlock.courses.length === 3,
  '多块表格：只取课表那一块，3 门课', multiBlock.courses.length);
ok(findCourse(multiBlock.courses, '张三') === null, '多块表格：名单部分没有被当成课程');

// --- 端到端：Word 里表格前有一大段说明 ---
const messyDocx = analyze('sample-messy.docx');
ok(messyDocx.ok === true && messyDocx.courses.length === 3,
  'Word 多段说明 + 表格：识别出 3 门课', messyDocx.courses.length);

// --- 端到端：无表头且列顺序被打乱 ---
const shuffled = analyze('sample-shuffled.xlsx');
ok(shuffled.ok === true && shuffled.courses.length === 4,
  '无表头 + 列顺序打乱：仍识别出 4 门课', shuffled.courses.length);
const sGs = findCourse(shuffled.courses, '高等数学');
ok(sGs && sGs.roomId === 'A301' && sGs.day === 1 && sGs.start === 1 && sGs.end === 2,
  '列顺序打乱（教室/课程名/周次/星期/节次）：字段全部对上', sGs);

// --- 智能路径不能劣化原有能力 ---
const legacySamples = ['sample-list.xlsx', 'sample-grid.xlsx', 'sample-grid-rows.xlsx',
  'sample-cross-list.xlsx', 'sample-cross-grid.xlsx', 'sample-list.docx', 'sample-grid.docx'];
let legacyOk = true;
let legacyDetail = '';
legacySamples.forEach(function (name) {
  const r = analyze(name);
  if (!r.ok || !r.courses.length) {
    legacyOk = false;
    legacyDetail = name + ' 解析失败';
  }
});
ok(legacyOk, '智能识别上线后，7 个既有样本全部仍然正常', legacyDetail);

// --- 边界：课程名里含字段关键词时，不能被当成表头丢掉 ---
const kw = EX.extractFromTable([
  ['课程名称', '星期', '节次', '教室', '周次'],
  ['课程设计', '周一', '1-2', 'A301', '1-16周'],
  ['教师发展中心', '周二', '3-4', 'B201', '1-16周'],
  ['星期与时令', '周三', '5-6', 'A302', '1-16周'],
], ctx);
ok(kw.courses.length === 3, '课程名含"课程/教师/星期"等关键词时不会被误删',
  kw.courses.map(function (c) { return c.name; }));
ok(kw.courses[0].name === '课程设计', '含"课程"二字的课程名完整保留', kw.courses[0] && kw.courses[0].name);

// --- 边界：分页导出的重复表头行要被跳过 ---
const dup = EX.extractFromTable([
  ['课程名称', '星期', '节次', '教室', '周次'],
  ['高等数学', '周一', '1-2', 'A301', '1-16周'],
  ['课程名称', '星期', '节次', '教室', '周次'],
  ['大学物理', '周二', '3-4', 'B201', '1-16周'],
], ctx);
ok(dup.courses.length === 2, '分页重复的表头行被跳过，真实课程保留 2 条', dup.courses.length);

// --- 边界：表头行本身不能变成一门课 ---
const hdrOnly = EX.extractFromTable([
  ['课程名称', '星期', '节次', '教室', '周次'],
], ctx);
ok(hdrOnly.courses.length === 0, '只有表头没有数据时不产生课程', hdrOnly.courses.length);

/* ==================== 14. 真实教务系统导出文件 ==================== */
section('14. 真实教务系统文件（竖排节次 + ◇ 分隔 + 省略"周"字）');
const jwReal = analyze('sample-jwxt-real.xlsx');
ok(jwReal.ok === true, '真实文件解析成功', jwReal.error);
ok(jwReal.layout === 'grid', '识别为课表网格（"星期一~星期日"在第 3 行）', jwReal.layout);
ok(jwReal.courses.length === 14, '解析出 14 门课（周六 5-6 与 7-8 节的同一门课已合并）',
  jwReal.courses.length);

const jwGs = jwReal.courses.filter(function (c) { return c.name === '高等数学I'; })[0];
ok(jwGs && jwGs.day === 1 && jwGs.start === 1 && jwGs.end === 2, '高等数学I：周一 1-2 节',
  jwGs && [jwGs.day, jwGs.start, jwGs.end]);
ok(jwGs && jwGs.roomId === '经管教学楼308' && jwGs.teacher === '敖国艳',
  '高等数学I：教室与教师正确', jwGs && [jwGs.roomId, jwGs.teacher]);
ok(jwGs && jwGs.weeks && jwGs.weeks.start === 4 && jwGs.weeks.end === 17,
  '周次 "4-17"（不带"周"字）解析为 4-17 周', jwGs && jwGs.weeks);

const jwProg = jwReal.courses.filter(function (c) { return c.name === 'C语言程序设计'; });
ok(jwProg.length === 2, '同名课程在不同天保留为 2 条（周一、周二）', jwProg.length);
const jwMon = jwProg.filter(function (c) { return c.day === 1; })[0];
const jwTue = jwProg.filter(function (c) { return c.day === 2; })[0];
ok(jwMon && jwMon.roomId === '综合楼603', '教室 "综合楼603安博实验室二" 提取出 综合楼603',
  jwMon && jwMon.roomId);
ok(jwTue && jwTue.roomId === '综合602', '简写教室名 "综合602安博实验室一" 提取出 综合602',
  jwTue && jwTue.roomId);
ok(jwMon && jwMon.teacher === '马秀荣' && jwMon.name === 'C语言程序设计',
  '教室后缀"安博实验室二"没有污染课程名与教师', jwMon && [jwMon.name, jwMon.teacher]);

const jwNet = jwReal.courses.filter(function (c) { return c.name === '计算机应用基础'; })[0];
ok(jwNet && jwNet.start === 5 && jwNet.end === 8,
  '周六 5-6 与 7-8 节的同一门课合并为 5-8 节', jwNet && [jwNet.start, jwNet.end]);
ok(jwNet && jwNet.teacher === '谢春丽' && jwNet.roomId === '科技楼117',
  '含"机房"的教室段不会挤进教师字段', jwNet && [jwNet.teacher, jwNet.roomId]);

const jwMil = jwReal.courses.filter(function (c) { return c.name === '军事理论'; })[0];
ok(jwMil && jwMil.day === 1 && jwMil.start === 9 && jwMil.end === 10,
  '"第九十节"（竖排连写）解析为 9-10 节', jwMil && [jwMil.start, jwMil.end]);

ok(jwReal.unknownRooms.length === 8, '正确列出 8 间不在教室字典里的教室', jwReal.unknownRooms);
const jwFullConf = jwReal.courses.filter(function (c) { return c._confidence === 1; }).length;
ok(jwFullConf === 13, '13 门课字段完整（"体育预留时间"是占位符，置信度 0.4）', jwFullConf);

// 单元：竖排 / 连写节次
ok(JSON.stringify(EX.parsePeriodLabel('第\n一\n二\n节', DEFAULT_PERIODS)) === '{"start":1,"end":2}',
  '竖排「第/一/二/节」= 1-2 节');
ok(JSON.stringify(EX.parsePeriodLabel('第三四节', DEFAULT_PERIODS)) === '{"start":3,"end":4}',
  '"第三四节" = 3-4 节');
ok(JSON.stringify(EX.parsePeriodLabel('第九十节', DEFAULT_PERIODS)) === '{"start":9,"end":10}',
  '"第九十节" = 9-10 节（不会误判成 90）');
ok(JSON.stringify(EX.parsePeriodLabel('第十节', DEFAULT_PERIODS)) === '{"start":10,"end":10}',
  '"第十节" = 10 节');
ok(JSON.stringify(EX.parsePeriodLabel('第十二节', DEFAULT_PERIODS)) === '{"start":12,"end":12}',
  '"第十二节" = 12 节（不会误判成 1-2）');

// 单元：◇ 分隔的单元格
const jwSeg = EX.parseCellContent(' 高等数学I◇4-17(1,2节)◇经管教学楼308◇敖国艳', ctx);
ok(jwSeg.length === 1 && jwSeg[0].name === '高等数学I' && jwSeg[0].teacher === '敖国艳' &&
  jwSeg[0].roomId === '经管教学楼308' && jwSeg[0].weeks && jwSeg[0].weeks.end === 17,
  '◇ 分隔的单元格：课程名/周次/教室/教师四段全部归位', jwSeg[0]);
ok(JSON.stringify(jwSeg[0].weeks) === '{"start":4,"end":17,"parity":"all"}',
  '◇ 单元格里的 "4-17" 被当作周次而不是节次', jwSeg[0].weeks);

/* ==================== 15. 教室字典补充 ==================== */
section('15. 教室字典补充（让空教室查询覆盖导入进来的新教室）');
const CLS = require(path.join(BASE, 'utils/classroom.js'));

const g1 = CLS.guessClassroom('经管教学楼308');
ok(g1 && g1.building === '经管教学楼' && g1.floor === 3 && g1.openForStudy === true,
  'guessClassroom("经管教学楼308") 得到楼栋与楼层', g1);
const g2 = CLS.guessClassroom('综合602');
ok(g2 && g2.building === '综合' && g2.floor === 6, 'guessClassroom("综合602")', g2);
const g3 = CLS.guessClassroom('A301');
ok(g3 && g3.building === 'A' && g3.floor === 3, 'guessClassroom("A301")', g3);
const g4 = CLS.guessClassroom('LIB-201');
ok(g4 && g4.floor === 2, 'guessClassroom("LIB-201") 处理带连字符的编号', g4);
ok(CLS.guessClassroom('') === null, '空编号返回 null');

// 端到端：补充前这些教室完全不参与查询，补充后就能查到
const roomQuery = {
  date: '2026-10-05', startPeriod: 1, endPeriod: 2,
  courses: jwReal.courses, occupancy: [],
  periods: DEFAULT_PERIODS, settings: settings, onlyStudy: true,
};
const beforeFix = CLS.queryFreeRooms(Object.assign({}, roomQuery, { classrooms: CLASSROOMS }));
const beforeIds = beforeFix.free.concat(beforeFix.occupied).map(function (r) { return r.id; });
ok(beforeIds.indexOf('经管教学楼308') < 0,
  '（对照）不补充字典时，导入进来的教室根本不出现在查询结果里');

const jwGuessed = jwReal.unknownRooms.map(function (id) { return CLS.guessClassroom(id); })
  .filter(Boolean);
ok(jwGuessed.length === jwReal.unknownRooms.length, '8 间未知教室都被成功构造出条目',
  jwGuessed.length);

const mergedClassrooms = CLASSROOMS.concat(jwGuessed);
const afterFix = CLS.queryFreeRooms(Object.assign({}, roomQuery, { classrooms: mergedClassrooms }));
const afterIds = afterFix.free.concat(afterFix.occupied).map(function (r) { return r.id; });
ok(afterIds.indexOf('经管教学楼308') >= 0,
  '补充字典后，这些教室参与空教室查询', afterIds.slice(0, 6));
ok(afterFix.occupied.some(function (r) { return r.id === '经管教学楼308'; }),
  '周一 1-2 节的「经管教学楼308」被正确判定为占用（自己的课）',
  afterFix.occupied.map(function (r) { return r.id; }).slice(0, 6));
ok(afterFix.free.length > 0, '同时仍能查出其它空闲教室', afterFix.free.length);

/* ==================== 16. 模拟小程序文件系统读取 ==================== */
section('16. 模拟小程序文件系统读取（wx.getFileSystemManager）');
const samplePath = path.join(SAMPLES, 'sample-list.xlsx');

// 现代基础库：readFileSync 无 encoding 时返回 ArrayBuffer
global.wx = {
  getFileSystemManager: function () {
    return {
      readFileSync: function (p, enc) {
        const buf = fs.readFileSync(p);
        if (enc === 'binary') return buf.toString('latin1');
        return new Uint8Array(buf);
      },
    };
  },
};
const viaFs = FI.importFromPath(samplePath, 'sample-list.xlsx', ctx);
ok(viaFs.ok === true && viaFs.courses.length === 6, '通过 wx 文件系统接口读取并解析成功',
  viaFs.courses && viaFs.courses.length);
ok(viaFs.courses[0].name === '高等数学(上)', '读取路径下内容正确');

// 老基础库：只给 binary 字符串
global.wx = {
  getFileSystemManager: function () {
    return { readFileSync: function (p) { return fs.readFileSync(p).toString('latin1'); } };
  },
};
const viaBinary = FI.importFromPath(samplePath, 'sample-list.xlsx', ctx);
ok(viaBinary.ok === true && viaBinary.courses.length === 6,
  '旧基础库的 binary 字符串读取方式同样可用', viaBinary.courses && viaBinary.courses.length);

// 读取异常时给出友好错误
global.wx = {
  getFileSystemManager: function () {
    return { readFileSync: function () { throw new Error('file not found'); } };
  },
};
const broken = FI.importFromPath('/nope.xlsx', 'nope.xlsx', ctx);
ok(broken.ok === false && /读取文件失败/.test(broken.error), '读取失败时返回可读错误',
  broken.error);
delete global.wx;

console.log('\n============================================');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail) {
  console.log('  失败项：');
  failures.forEach(function (f) { console.log('   - ' + f); });
}
console.log('============================================');
process.exit(fail ? 1 : 0);
