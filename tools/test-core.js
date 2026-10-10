/**
 * 核心逻辑自测（Node 环境，mock 掉 wx API）
 * 运行：node tools/test-core.js
 *
 * 覆盖：周次/节次时间计算、下一节课、课前提醒、空教室反查、
 *      文本导入解析、系统日历展开、冲突检测。
 */
const path = require('path');

/* ---------------- mock 小程序运行环境 ---------------- */
const memory = {};
global.wx = {
  getStorageSync: function (k) { return memory[k] === undefined ? '' : memory[k]; },
  setStorageSync: function (k, v) { memory[k] = v; },
  removeStorageSync: function (k) { delete memory[k]; },
  vibrateLong: function () {},
  vibrateShort: function () {},
  createInnerAudioContext: function () {
    return { src: '', volume: 1, play: function () {}, stop: function () {} };
  },
};

const BASE = path.join(__dirname, '..', 'miniprogram');
const T = require(path.join(BASE, 'utils/time.js'));
const S = require(path.join(BASE, 'utils/schedule.js'));
const C = require(path.join(BASE, 'utils/classroom.js'));
const N = require(path.join(BASE, 'utils/notify.js'));
const IMP = require(path.join(BASE, 'utils/importer.js'));
const CFG = require(path.join(BASE, 'config/index.js'));
const { COURSES } = require(path.join(BASE, 'data/courses.js'));
const { CLASSROOMS } = require(path.join(BASE, 'data/classrooms.js'));
const { OCCUPANCY } = require(path.join(BASE, 'data/occupancy.js'));
const { DEFAULT_PERIODS } = require(path.join(BASE, 'data/periods.js'));

const courses = S.normalizeAll(COURSES);
const occupancy = S.normalizeAll(OCCUPANCY);
const periods = DEFAULT_PERIODS;
const settings = {
  aheadMinutes: 20, finalAheadMinutes: 5, autoPopupMinutes: 30, moveBufferMinutes: 10,
  vibrate: false, sound: false, popup: true, calendar: true,
  termName: CFG.TERM.name,
  termStartDate: CFG.TERM.startDate,
  totalWeeks: CFG.TERM.totalWeeks,
  subscribed: false,
  lastCalendarSync: '',
};

/* ---------------- 断言工具 ---------------- */
let pass = 0;
let fail = 0;
const failures = [];

function ok(cond, label, extra) {
  if (cond) {
    pass++;
    console.log('  \u2713 ' + label);
  } else {
    fail++;
    failures.push(label);
    console.log('  \u2717 ' + label + (extra !== undefined ? '   → ' + JSON.stringify(extra) : ''));
  }
}

function section(title) {
  console.log('\n' + title);
}

/* ---------------- 固定时间点：2026-10-07（周三）第 5 周 13:44 ---------------- */
const NOW = new Date(2026, 9, 7, 13, 44, 0);
const DATE = '2026-10-07';

section('1. 周次与日期计算');
ok(T.getWeekIndex(new Date(2026, 8, 7), settings.termStartDate) === 1, '开学日 2026-09-07 是第 1 周');
ok(T.getWeekIndex(NOW, settings.termStartDate) === 5, '2026-10-07 是第 5 周', T.getWeekIndex(NOW, settings.termStartDate));
ok(T.getDayOfWeek(NOW) === 3, '2026-10-07 是周三', T.getDayOfWeek(NOW));
ok(T.formatDate(NOW) === DATE, 'formatDate 输出 YYYY-MM-DD', T.formatDate(NOW));
ok(T.toMinutes('14:00') === 840, 'toMinutes("14:00") = 840', T.toMinutes('14:00'));
ok(T.weekDates(5, settings.termStartDate)[0].getDate() === 5, '第 5 周周一是 10 月 5 日',
  T.weekDates(5, settings.termStartDate)[0].toDateString());

section('2. 周次规则（单双周 / 区间）');
ok(S.isWeekActive(courses[0], 5, 20) === true, '高等数学第 5 周有课');
ok(S.isWeekActive(courses[7], 2, 20) === false, 'Python 数据分析第 2 周无课（3-12 周）');
ok(S.isWeekActive({ weeks: { start: 1, end: 10, parity: 'odd' } }, 4, 20) === false, '单周规则排除第 4 周');
ok(S.isWeekActive({ weeks: { start: 1, end: 10, parity: 'odd' } }, 5, 20) === true, '单周规则包含第 5 周');
ok(S.formatWeeks({ start: 1, end: 16, parity: 'all' }) === '1-16周', 'formatWeeks 输出 1-16周',
  S.formatWeeks({ start: 1, end: 16, parity: 'all' }));

section('3. 今日课表与下一节课');
const today = S.coursesOnDate(courses, NOW, settings.termStartDate, settings.totalWeeks);
ok(today.week === 5 && today.day === 3, '定位到第 5 周周三', today.week + '/' + today.day);
ok(today.courses.length === 3, '周三共 3 节课', today.courses.map(function (c) { return c.name; }));
ok(today.courses[0].name === '程序设计基础', '第一门是程序设计基础', today.courses[0].name);

const next = S.getNextClass(courses, CLASSROOMS, periods, NOW, settings);
ok(!!next, '能算出下一节课');
ok(next && next.course.name === '程序设计基础', '下一节课是程序设计基础', next && next.course.name);
ok(next && next.startTime === '14:00', '上课时间 14:00', next && next.startTime);
ok(next && next.minutesLeft === 16, '距上课 16 分钟', next && next.minutesLeft);
ok(next && next.room.indexOf('A301') >= 0, '教室含 A301', next && next.room);
ok(next && next.periodText === '第5-6节', '节次文案 第5-6节', next && next.periodText);

const during = S.getCurrentClass(courses, CLASSROOMS, periods, new Date(2026, 9, 7, 14, 30), settings);
ok(during && during.course.name === '程序设计基础', '14:30 时判定为正在上程序设计基础',
  during && during.course.name);
ok(!S.getCurrentClass(courses, CLASSROOMS, periods, NOW, settings), '13:44 时判定不在上课');

section('4. 课前提醒（防迟到核心）');
const st = N.evaluate(courses, CLASSROOMS, periods, settings, NOW);
ok(st.shouldAlert === true, '13:44 触发课前提醒（16 分钟 <= 30 分钟）');
ok(st.stage === 'main', '处于主提醒阶段', st.stage);
ok(/程序设计基础/.test(st.title), '提醒标题含课程名', st.title);
N.markReminded(st.alertKey);
const st2 = N.evaluate(courses, CLASSROOMS, periods, settings, NOW);
ok(st2.shouldAlert === false, '同一节课不会重复提醒（去重生效）');
const st3 = N.evaluate(courses, CLASSROOMS, periods, settings, new Date(2026, 9, 7, 13, 57, 0));
ok(st3.stage === 'final', '13:57 进入"最后提醒"阶段', st3.stage);
const fire = N.fireAlert(next, settings, 'final');
ok(fire.urgent === true, '最后提醒标记为紧急');
ok(/快迟到|马上/.test(fire.content), '紧急提醒文案包含催促语');

const noClass = N.evaluate(courses, CLASSROOMS, periods, settings, new Date(2026, 9, 12, 23, 0));
ok(typeof noClass.title === 'string' && noClass.title.length > 0, '无课时段仍有兜底文案', noClass.title);

section('5. 空教室反查');
const busy = C.buildBusyMap(courses, occupancy, CLASSROOMS, DATE, settings);
ok(busy.week === 5 && busy.day === 3, '占用索引定位到周三第 5 周');
ok(!!busy.busy['A301'] && !!busy.busy['A301'][5], 'A301 第 5 节被占用（我的课）');
ok(!!busy.busy['A301'] && busy.busy['A301'][5].source === 'mine', 'A301 占用来源标记为我的课');

const free56 = C.queryFreeRooms({
  date: DATE, startPeriod: 5, endPeriod: 6,
  courses: courses, occupancy: occupancy, classrooms: CLASSROOMS, periods: periods,
  settings: settings, onlyStudy: true,
});
const freeIds = free56.free.map(function (r) { return r.id; });
ok(freeIds.indexOf('A301') < 0, 'A301 第 5-6 节不在空闲列表（我的课占用）');
ok(freeIds.indexOf('B401') < 0, 'B401 第 5-6 节不在空闲列表（全校占用表标记）');
ok(freeIds.indexOf('LIB-201') >= 0, '图书馆 201 第 5-6 节空闲');
ok(freeIds.indexOf('LIB-202') >= 0, '图书馆 202 第 5-6 节空闲');
ok(freeIds.indexOf('A401') < 0, 'A401（不允许自习）被排除在结果外');
ok(free56.free.length > 0 && free56.free[0].freeSpanText === '第5-6节 空',
  '结果标注查询时段为空闲', free56.free[0] && free56.free[0].freeSpanText);
ok(free56.free[0] && /可连用/.test(free56.free[0].runSpanText),
  '额外提示可连用的空闲时段', free56.free[0] && free56.free[0].runSpanText);

const freeFull = C.queryFreeRooms({
  date: DATE, startPeriod: 5, endPeriod: 6,
  courses: [], occupancy: occupancy, classrooms: CLASSROOMS, periods: periods,
  settings: settings, onlyStudy: true,
});
ok(freeFull.free.map(function (r) { return r.id; }).indexOf('A301') >= 0,
  '不传自己的课表时 A301 变为空闲（说明占用来源确实被合并计算）');

const capacityFiltered = C.queryFreeRooms({
  date: DATE, startPeriod: 5, endPeriod: 6,
  courses: courses, occupancy: occupancy, classrooms: CLASSROOMS, periods: periods,
  settings: settings, onlyStudy: true, minCapacity: 200,
});
ok(capacityFiltered.free.every(function (r) { return r.capacity >= 200; }),
  '座位数筛选生效', capacityFiltered.free.map(function (r) { return r.capacity; }));

const buildingFiltered = C.queryFreeRooms({
  date: DATE, startPeriod: 5, endPeriod: 6,
  courses: courses, occupancy: occupancy, classrooms: CLASSROOMS, periods: periods,
  settings: settings, onlyStudy: true, building: '图书馆',
});
ok(buildingFiltered.free.length === 2, '按楼栋筛选出图书馆 2 间自习室',
  buildingFiltered.free.length);

const facilityFiltered = C.queryFreeRooms({
  date: DATE, startPeriod: 5, endPeriod: 6,
  courses: courses, occupancy: occupancy, classrooms: CLASSROOMS, periods: periods,
  settings: settings, onlyStudy: true, facilities: ['socket', 'ac'],
});
ok(facilityFiltered.free.every(function (r) {
  return r.facilities.indexOf('socket') >= 0 && r.facilities.indexOf('ac') >= 0;
}), '设施筛选（插座+空调）生效', facilityFiltered.free.map(function (r) { return r.id; }));

const ctx = C.currentPeriodContext(periods, NOW);
ok(ctx.phase === 'break' && ctx.period === 5, '13:44 处于课间，下一节是第 5 节',
  ctx.phase + '/' + ctx.period);

const nowRooms = C.queryFreeRoomsNow({
  courses: courses, occupancy: occupancy, classrooms: CLASSROOMS, periods: periods,
  settings: settings, span: 2, onlyStudy: true, now: NOW,
});
ok(nowRooms.free.length > 0, '"现在去哪自习"能返回结果', nowRooms.free.length);
ok(nowRooms.startPeriod === 5 && nowRooms.endPeriod === 6, '自动定位到第 5-6 节',
  nowRooms.startPeriod + '-' + nowRooms.endPeriod);

const runs = C.freeRuns(busy, 'LIB-201', periods);
ok(runs.length === 1 && runs[0].start === 1, '图书馆 201 全天连续空闲', JSON.stringify(runs));

section('6. 课表文本导入解析');
const parsed = IMP.parseText([
  '# 注释行会被忽略',
  '高等数学(上),周一,1,2,A301,1-16',
  '程序设计基础 周三 5-6 A301 1-16周',
  '大学物理,周四,3,4,A201,1-16单',
  '这条数据不完整',
].join('\n'), CLASSROOMS);
ok(parsed.courses.length === 3, '成功解析 3 条', parsed.courses.length);
ok(parsed.errors.length === 1, '识别出 1 条非法数据', parsed.errors.length);
ok(parsed.courses[0].day === 1 && parsed.courses[0].start === 1 && parsed.courses[0].end === 2,
  '逗号格式字段正确', JSON.stringify(parsed.courses[0]));
ok(parsed.courses[1].day === 3 && parsed.courses[1].start === 5 && parsed.courses[1].end === 6,
  '空格格式字段正确', JSON.stringify(parsed.courses[1]));
ok(parsed.courses[1].weeks.start === 1 && parsed.courses[1].weeks.end === 16,
  '周次"1-16周"解析正确', JSON.stringify(parsed.courses[1].weeks));
ok(parsed.courses[2].weeks.parity === 'odd', '"1-16单"识别为单周', JSON.stringify(parsed.courses[2].weeks));
ok(IMP.parseLine('A,B').error !== undefined, '字段不足时返回错误');

const unknown = IMP.parseText('英语,周二,1,2,Z999,1-16', CLASSROOMS);
ok(unknown.unknownRooms.length === 1 && unknown.unknownRooms[0] === 'Z999',
  '教室字典外的编号会被提示', unknown.unknownRooms);

section('7. 系统日历展开与冲突检测');
let expected = 0;
for (let i = 0; i < courses.length; i++) expected += S.weekListOf(courses[i].weeks, 20).length;
const allDates = [];
for (let i = 0; i < courses.length; i++) {
  allDates.push(S.expandCourseDates(courses[i], settings.termStartDate, 20));
}
const total = allDates.reduce(function (a, b) { return a + b.length; }, 0);
ok(total === expected, '整学期日历条目数 = 各课周次之和（' + expected + ' 条）', total);
ok(allDates[0].length === 16, '高等数学 1-16 周共 16 次课', allDates[0].length);
ok(T.formatDate(allDates[0][0].date) === '2026-09-07', '第一次课落在开学周周一',
  T.formatDate(allDates[0][0].date));

const conflicts = S.detectConflicts(courses);
ok(conflicts.length === 0, '示例课表无时间冲突', conflicts.map(function (c) { return c.message; }));

const fakeConflict = S.detectConflicts([
  { id: 'x', name: 'A课', day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'y', name: 'B课', day: 1, start: 2, end: 3, weeks: { start: 1, end: 16, parity: 'all' } },
]);
ok(fakeConflict.length === 1, '能检测出重叠节次冲突', fakeConflict.length);

section('8. 边界与非功能');
ok(S.normalizeAll([]).length === 0, '空课表不报错');
ok(S.getNextClass([], CLASSROOMS, periods, NOW, settings) === null, '无课时返回 null');
const week20 = S.getNextClass(courses, CLASSROOMS, periods, new Date(2027, 0, 1), settings);
ok(week20 === null, '学期结束后返回 null', week20);
const badRoom = S.roomLabel({ roomId: 'NOPE' }, CLASSROOMS);
ok(badRoom === 'NOPE', '未知教室回退为编号本身', badRoom);

const t0 = Date.now();
for (let i = 0; i < 200; i++) {
  C.queryFreeRooms({
    date: DATE, startPeriod: 5, endPeriod: 6,
    courses: courses, occupancy: occupancy, classrooms: CLASSROOMS, periods: periods,
    settings: settings, onlyStudy: true,
  });
}
const cost = Date.now() - t0;
ok(cost < 2000, '空教室查询 200 次耗时 ' + cost + 'ms（<2s）');

/* ---------------- 结果 ---------------- */
console.log('\n============================================');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail) {
  console.log('  失败项：');
  failures.forEach(function (f) { console.log('   - ' + f); });
}
console.log('============================================');
process.exit(fail ? 1 : 0);
