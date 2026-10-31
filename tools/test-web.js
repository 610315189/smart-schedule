/**
 * 网页版核心逻辑测试
 * 运行：node tools/test-web.js
 *
 * 用 Node 的 vm 模块模拟一个最小浏览器环境，加载 wx-shim.js + bundle.js，
 * 验证打包后的逻辑与小程序端行为一致。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web', 'js');
const SAMPLES = path.join(__dirname, 'samples');

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

/* ==================== 构造浏览器沙箱 ==================== */
const mem = {};
const localStorageMock = {
  _data: mem,
  get length() { return Object.keys(mem).length; },
  key: function (i) { return Object.keys(mem)[i]; },
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; },
};

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  localStorage: localStorageMock,
  navigator: { vibrate: function () { return true; } },
  Date: Date,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
};
const ctx = vm.createContext(sandbox);
vm.runInContext('var window = globalThis; var self = globalThis;', ctx);

// 用于把 Node 侧字节数组传进沙箱（跨 realm 的 Uint8Array 用宿主构造会不过 instanceof）
vm.runInContext('function __makeBytes(arr) { return new Uint8Array(arr); }', ctx);

function run(file) {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext(code, ctx, { filename: file });
}

section('1. 加载资源');
let loaded = true;
try {
  run(path.join(WEB, 'wx-shim.js'));
  ok(true, 'wx-shim.js 加载成功');
} catch (e) {
  loaded = false;
  ok(false, 'wx-shim.js 加载失败: ' + e.message);
}
try {
  run(path.join(WEB, 'bundle.js'));
  ok(true, 'bundle.js 加载成功');
} catch (e) {
  loaded = false;
  ok(false, 'bundle.js 加载失败: ' + e.message);
}
if (!loaded) { console.log('\n加载失败，后续测试跳过'); process.exit(1); }

const SS = vm.runInContext('SS', ctx);
const wxObj = vm.runInContext('wx', ctx);

section('2. 命名空间完整性');
['config', 'time', 'schedule', 'classroom', 'fileImport', 'detect', 'extract', 'notify', 'storage']
  .forEach(function (k) {
    ok(!!SS[k], 'window.SS.' + k + ' 存在', typeof SS[k]);
  });
ok(Object.keys(SS.__modules).length === 20, '共打包 20 个模块', Object.keys(SS.__modules).length);

section('3. wx 兼容层');
ok(typeof wxObj.getStorageSync === 'function', 'wx.getStorageSync 已实现');
ok(typeof wxObj.vibrateLong === 'function', 'wx.vibrateLong 已实现');
ok(typeof wxObj.createInnerAudioContext === 'function', 'wx.createInnerAudioContext 已实现');
ok(typeof wxObj.addPhoneCalendar === 'function', 'wx.addPhoneCalendar 已实现（退化为 .ics）');

// 存储往返
wxObj.setStorageSync('demo_key', { a: 1, b: '中文' });
const back = wxObj.getStorageSync('demo_key');
ok(back && back.a === 1 && back.b === '中文', 'localStorage 存取往返（含中文）', back);
ok(wxObj.getStorageSync('not_exist') === '', '不存在的 key 返回空串（与小程序一致）');
wxObj.removeStorageSync('demo_key');
ok(wxObj.getStorageSync('demo_key') === '', '删除后读到空串');

section('4. 日期与课表核心');
const T = SS.time;
const S = SS.schedule;
const NOW = new Date(2026, 9, 7, 13, 44, 0); // 2026-10-07 周三 13:44
ok(T.getWeekIndex(NOW, '2026-09-07') === 5, '2026-10-07 是第 5 周', T.getWeekIndex(NOW, '2026-09-07'));
ok(T.getDayOfWeek(NOW) === 3, '2026-10-07 是周三');
ok(T.toMinutes('14:00') === 840, 'toMinutes 正确');

const settings = {
  termStartDate: '2026-09-07', totalWeeks: 20,
  aheadMinutes: 20, finalAheadMinutes: 5, autoPopupMinutes: 30,
  popup: true, vibrate: true, sound: true,
};
const courses = SS.courses.COURSES;
const classrooms = SS.classrooms.CLASSROOMS;
const periods = SS.periods.DEFAULT_PERIODS;

const next = S.getNextClass(courses, classrooms, periods, NOW, settings);
ok(next && next.course.name === '程序设计基础', '算出下一节课', next && next.course.name);
ok(next && next.startTime === '14:00' && next.minutesLeft === 16,
  '下一节课 14:00，还剩 16 分钟', next && [next.startTime, next.minutesLeft]);

const timeline = S.buildTimeline(courses, classrooms, periods, new Date(2026, 9, 7), settings);
ok(timeline.courses.length === 3, '周三共 3 节课', timeline.courses.length);
ok(timeline.freeSlots.length >= 1, '能算出当日空堂', timeline.freeSlots.length);

section('5. 空教室算法');
const C = SS.classroom;
const free = C.queryFreeRooms({
  date: '2026-10-07', startPeriod: 5, endPeriod: 6,
  courses: courses, occupancy: SS.occupancy.OCCUPANCY,
  classrooms: classrooms, periods: periods, settings: settings, onlyStudy: true,
});
ok(free.free.length > 0, '能查出空闲教室', free.free.length);
const ids = free.free.map(function (r) { return r.id; });
ok(ids.indexOf('LIB-201') >= 0, '图书馆201 在空闲列表里');
ok(ids.indexOf('A301') < 0, 'A301 被自己的课占用，不在空闲列表');

const nowRooms = C.queryFreeRoomsNow({
  courses: courses, occupancy: SS.occupancy.OCCUPANCY,
  classrooms: classrooms, periods: periods, settings: settings,
  span: 2, onlyStudy: true, now: NOW,
});
ok(nowRooms.free.length > 0, '"现在去哪自习"返回结果', nowRooms.free.length);
ok(nowRooms.startPeriod === 5, '自动定位到第 5 节', nowRooms.startPeriod);

section('6. Excel / Word 解析（浏览器端能力核心）');
function loadBytes(name) {
  const buf = fs.readFileSync(path.join(SAMPLES, name));
  return vm.runInContext('__makeBytes(' + JSON.stringify(Array.from(buf)) + ')', ctx);
}

const ctxData = { classrooms: classrooms, periods: periods, totalWeeks: 16 };

const xlsxRes = SS.fileImport.parseBytes(loadBytes('sample-list.xlsx'), 'sample-list.xlsx', ctxData);
ok(xlsxRes.ok === true, 'xlsx 文件解析成功', xlsxRes.error);
ok(xlsxRes.courses.length === 6, '列表式 xlsx 解析出 6 门课', xlsxRes.courses.length);

const gridRes = SS.fileImport.parseBytes(loadBytes('sample-grid.xlsx'), 'sample-grid.xlsx', ctxData);
ok(gridRes.ok === true && gridRes.layout === 'grid', '网格式 xlsx 识别为 grid', gridRes.layout);

const realRes = SS.fileImport.parseBytes(loadBytes('sample-jwxt-real.xlsx'), 'sample-jwxt-real.xlsx', ctxData);
ok(realRes.ok === true && realRes.courses.length === 14, '真实教务系统文件解析出 14 门课',
  realRes.courses.length);

const docxRes = SS.fileImport.parseBytes(loadBytes('sample-grid.docx'), 'sample-grid.docx', ctxData);
ok(docxRes.ok === true && docxRes.courses.length > 0, 'docx 文件解析成功', docxRes.courses.length);

const csvText = '课程名称,星期,节次,教室,周次\n高等数学,周一,1-2,A301,1-16周\n';
const csvBytes = vm.runInContext('__makeBytes(' + JSON.stringify(Array.from(Buffer.from(csvText, 'utf8'))) + ')', ctx);
const csvRes = SS.fileImport.parseBytes(csvBytes, 'a.csv', ctxData);
ok(csvRes.ok === true && csvRes.courses.length === 1, 'CSV 解析成功', csvRes.courses.length);

section('7. 课前提醒引擎');
const N = SS.notify;
const st = N.evaluate(courses, classrooms, periods, settings, NOW);
ok(st.shouldAlert === true, '13:44 触发课前提醒');
ok(st.stage === 'main', '处于主提醒阶段', st.stage);
N.markReminded(st.alertKey);
ok(N.evaluate(courses, classrooms, periods, settings, NOW).shouldAlert === false,
  '同一节课不会重复提醒');
const fire = N.fireAlert(next, settings, 'final');
ok(fire.urgent === true && /马上/.test(fire.content), '最后提醒文案正确');

section('8. 与小程序端结果一致性');
// 同一份数据、同一时刻，网页 bundle 与源码直跑结果应完全一致
const SRC = path.join(ROOT, 'miniprogram');
const nodeS = require(path.join(SRC, 'utils/schedule.js'));
const nodeCourses = require(path.join(SRC, 'data/courses.js')).COURSES;
const nodeClassrooms = require(path.join(SRC, 'data/classrooms.js')).CLASSROOMS;
const nodePeriods = require(path.join(SRC, 'data/periods.js')).DEFAULT_PERIODS;
const nodeNext = nodeS.getNextClass(nodeCourses, nodeClassrooms, nodePeriods, NOW, settings);
ok(nodeNext && next && nodeNext.course.name === next.course.name &&
  nodeNext.startTime === next.startTime && nodeNext.minutesLeft === next.minutesLeft,
  '网页版与源码直跑的"下一节课"完全一致',
  { web: next && [next.course.name, next.startTime, next.minutesLeft],
    node: nodeNext && [nodeNext.course.name, nodeNext.startTime, nodeNext.minutesLeft] });

console.log('\n============================================');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail) {
  console.log('  失败项：');
  failures.forEach(function (f) { console.log('   - ' + f); });
}
console.log('============================================');
process.exit(fail ? 1 : 0);
