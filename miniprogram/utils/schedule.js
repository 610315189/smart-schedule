/**
 * 课表核心逻辑
 * ---------------------------------------------------------------
 * 只做纯计算，不碰 UI、不碰存储，方便单独测试与复用。
 */
const T = require('./time');
const CFG = require('../config/index');

const DEFAULT_TOTAL_WEEKS = 24;

const STATUS_TEXT = {
  done: '已结束',
  ongoing: '进行中',
  soon: '即将开始',
  upcoming: '待上课',
};

/** 补齐 / 规范化一门课，容忍导入数据缺字段 */
function normalizeCourse(raw, index) {
  const c = Object.assign({}, raw);
  c.id = c.id || 'c_' + Date.now() + '_' + (index || 0);
  c.name = (c.name || '未命名课程').trim();
  c.teacher = c.teacher || '';
  c.roomId = c.roomId || '';
  c.day = Number(c.day) || 1;
  c.start = Number(c.start) || 1;
  c.end = Number(c.end) || c.start;
  if (c.end < c.start) c.end = c.start;
  c.note = c.note || '';
  if (!c.color) c.color = CFG.COLORS[index % CFG.COLORS.length];
  // 周次：兼容 { start, end, parity } / 数组 / "1-16周" 字符串
  c.weeks = normalizeWeeks(c.weeks, c.weeksList);
  delete c.weeksList;
  return c;
}

/** 统一周次表示 */
function normalizeWeeks(weeks, weeksList) {
  if (Array.isArray(weeks)) {
    return { start: Math.min.apply(null, weeks.concat([1])), end: Math.max.apply(null, weeks.concat([1])), parity: 'custom', list: weeks.slice() };
  }
  if (typeof weeks === 'string') {
    const m = weeks.match(/(\d+)\s*[-~]\s*(\d+)/);
    const parity = /单/.test(weeks) ? 'odd' : (/双/.test(weeks) ? 'even' : 'all');
    if (m) return { start: Number(m[1]), end: Number(m[2]), parity: parity };
  }
  if (Array.isArray(weeksList) && weeksList.length) {
    return { start: Math.min.apply(null, weeksList), end: Math.max.apply(null, weeksList), parity: 'custom', list: weeksList.slice() };
  }
  if (weeks && typeof weeks === 'object') {
    return {
      start: Number(weeks.start) || 1,
      end: Number(weeks.end) || DEFAULT_TOTAL_WEEKS,
      parity: weeks.parity || 'all',
      list: Array.isArray(weeks.list) ? weeks.list.slice() : undefined,
    };
  }
  return { start: 1, end: DEFAULT_TOTAL_WEEKS, parity: 'all' };
}

/** 展开为具体周次数组 [1,2,3...] */
function weekListOf(weeks, totalWeeks) {
  const w = normalizeWeeks(weeks);
  const max = Math.max(totalWeeks || DEFAULT_TOTAL_WEEKS, w.end);
  if (w.parity === 'custom' && Array.isArray(w.list)) {
    return w.list.filter(function (n) { return n >= 1; }).sort(function (a, b) { return a - b; });
  }
  const out = [];
  for (let i = w.start; i <= w.end; i++) {
    if (w.parity === 'odd' && i % 2 === 0) continue;
    if (w.parity === 'even' && i % 2 !== 0) continue;
    out.push(i);
  }
  return out;
}

function isWeekActive(course, week, totalWeeks) {
  if (!week || week < 1) return false;
  return weekListOf(course.weeks, totalWeeks).indexOf(week) >= 0;
}

/** 周次中文描述，如 "1-16周" / "3-12周(单)" */
function formatWeeks(weeks) {
  const w = normalizeWeeks(weeks);
  if (w.parity === 'custom' && Array.isArray(w.list)) {
    return w.list.join(',') + '周';
  }
  let s = w.start + '-' + w.end + '周';
  if (w.parity === 'odd') s += '(单)';
  if (w.parity === 'even') s += '(双)';
  return s;
}

/** 节次时间信息 */
function periodInfo(periods, period) {
  for (let i = 0; i < periods.length; i++) {
    if (periods[i].period === period) return periods[i];
  }
  return null;
}

/** 起止节次 -> 起止时刻 */
function periodRange(periods, start, end) {
  const a = periodInfo(periods, start);
  const b = periodInfo(periods, end) || a;
  return {
    start: a ? a.start : '08:00',
    end: b ? b.end : (a ? a.end : '08:45'),
  };
}

/** 节次中文描述："第1-2节" */
function formatPeriods(start, end) {
  return start === end ? '第' + start + '节' : '第' + start + '-' + end + '节';
}

/** 某天某周的课程，按开始节次排序 */
function coursesOn(courses, day, week, totalWeeks) {
  const out = [];
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    if (Number(c.day) !== Number(day)) continue;
    if (!isWeekActive(c, week, totalWeeks)) continue;
    out.push(c);
  }
  return out.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
}

/** 某天的课程（自动算周次） */
function coursesOnDate(courses, date, termStartDate, totalWeeks) {
  const week = T.getWeekIndex(date, termStartDate);
  const day = T.getDayOfWeek(date);
  return { week: week, day: day, courses: coursesOn(courses, day, week, totalWeeks) };
}

/** 一门课在本学期实际发生的所有日期：[{ date, week }] */
function expandCourseDates(course, termStartDate, totalWeeks) {
  const weeks = weekListOf(course.weeks, totalWeeks);
  const out = [];
  for (let i = 0; i < weeks.length; i++) {
    const days = T.weekDates(weeks[i], termStartDate);
    const d = days[Number(course.day) - 1];
    if (d) out.push({ date: d, week: weeks[i] });
  }
  return out;
}

function roomOf(roomId, classrooms) {
  for (let i = 0; i < classrooms.length; i++) {
    if (classrooms[i].id === roomId) return classrooms[i];
  }
  return null;
}

function roomLabel(course, classrooms) {
  const r = roomOf(course.roomId, classrooms);
  return r ? (r.building ? r.building + ' ' + r.name : r.name) : (course.roomId || '教室待定');
}

/**
 * 今日时间轴：每节课 + 状态 + 今日空闲节次
 * status: done 已结束 | ongoing 进行中 | soon 即将开始 | upcoming 待上课
 */
function buildTimeline(courses, classrooms, periods, date, settings) {
  const totalWeeks = settings.totalWeeks;
  const r = coursesOnDate(courses, date, settings.termStartDate, totalWeeks);
  const now = new Date();
  const isToday = T.formatDate(date) === T.formatDate(now);
  const nowMin = T.dateToMinutes(now);
  const soonEdge = settings.aheadMinutes || 20;
  const list = [];
  const occupied = {};

  for (let i = 0; i < r.courses.length; i++) {
    const c = r.courses[i];
    const t = periodRange(periods, c.start, c.end);
    const sMin = T.toMinutes(t.start);
    const eMin = T.toMinutes(t.end);
    let status = 'upcoming';
    if (isToday) {
      if (nowMin > eMin) status = 'done';
      else if (nowMin >= sMin) status = 'ongoing';
      else if (sMin - nowMin <= soonEdge) status = 'soon';
    } else if (T.formatDate(date) < T.formatDate(now)) {
      status = 'done';
    }
    for (let p = c.start; p <= c.end; p++) occupied[p] = true;
    list.push({
      id: c.id,
      name: c.name,
      teacher: c.teacher,
      note: c.note,
      color: c.color,
      roomId: c.roomId,
      room: roomLabel(c, classrooms),
      start: c.start,
      end: c.end,
      periodText: formatPeriods(c.start, c.end),
      startTime: t.start,
      endTime: t.end,
      status: status,
      statusText: STATUS_TEXT[status] || '',
      weekText: formatWeeks(c.weeks),
      minutesToStart: Math.round(sMin - nowMin),
      minutesToEnd: Math.round(eMin - nowMin),
    });
  }

  // 今日空闲节次区间
  const freeSlots = [];
  let runStart = null;
  for (let p = 1; p <= periods.length; p++) {
    if (!occupied[p]) {
      if (runStart === null) runStart = p;
    } else if (runStart !== null) {
      freeSlots.push(slotOf(periods, runStart, p - 1));
      runStart = null;
    }
  }
  if (runStart !== null) freeSlots.push(slotOf(periods, runStart, periods.length));

  return { week: r.week, day: r.day, courses: list, freeSlots: freeSlots };
}

function slotOf(periods, start, end) {
  const t = periodRange(periods, start, end);
  return {
    start: start,
    end: end,
    periodText: formatPeriods(start, end),
    startTime: t.start,
    endTime: t.end,
  };
}

/** 正在上的课（没有则 null） */
function getCurrentClass(courses, classrooms, periods, now, settings) {
  const r = coursesOnDate(courses, now, settings.termStartDate, settings.totalWeeks);
  const nowMin = T.dateToMinutes(now);
  for (let i = 0; i < r.courses.length; i++) {
    const c = r.courses[i];
    const t = periodRange(periods, c.start, c.end);
    const sMin = T.toMinutes(t.start);
    const eMin = T.toMinutes(t.end);
    if (nowMin >= sMin && nowMin <= eMin) {
      return {
        course: c,
        date: now,
        startAt: T.atTime(now, t.start),
        endAt: T.atTime(now, t.end),
        startTime: t.start,
        endTime: t.end,
        room: roomLabel(c, classrooms),
        minutesLeft: Math.round(eMin - nowMin),
        minutesToEnd: Math.round(eMin - nowMin),
      };
    }
  }
  return null;
}

/**
 * 下一节课：从今天起向后查找（最多 21 天），返回尚未开始的最近一节课
 */
function getNextClass(courses, classrooms, periods, now, settings) {
  const totalWeeks = settings.totalWeeks;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = 0; offset <= 21; offset++) {
    const date = T.addDays(today, offset);
    const r = coursesOnDate(courses, date, settings.termStartDate, totalWeeks);
    if (!r.courses.length) continue;
    for (let i = 0; i < r.courses.length; i++) {
      const c = r.courses[i];
      const t = periodRange(periods, c.start, c.end);
      const startAt = T.atTime(date, t.start);
      if (startAt.getTime() <= now.getTime()) continue;
      const endAt = T.atTime(date, t.end);
      const minutesLeft = (startAt.getTime() - now.getTime()) / 60000;
      return {
        course: c,
        date: date,
        isToday: offset === 0,
        dayOffset: offset,
        week: r.week,
        startAt: startAt,
        endAt: endAt,
        startTime: t.start,
        endTime: t.end,
        minuteStart: T.toMinutes(t.start),
        minuteEnd: T.toMinutes(t.end),
        room: roomLabel(c, classrooms),
        roomId: c.roomId,
        periodText: formatPeriods(c.start, c.end),
        minutesLeft: Math.round(minutesLeft),
        minutesLeftExact: minutesLeft,
        dateLabel: offset === 0 ? '今天' : (offset === 1 ? '明天' : T.humanDate(date)),
        weekText: formatWeeks(c.weeks),
      };
    }
  }
  return null;
}

/** 冲突检测：同一天 + 节次重叠 + 周次有交集 */
function detectConflicts(courses) {
  const conflicts = [];
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i];
      const b = courses[j];
      if (Number(a.day) !== Number(b.day)) continue;
      if (a.start > b.end || b.start > a.end) continue;
      const wa = weekListOf(a.weeks);
      const wb = weekListOf(b.weeks);
      const share = wa.filter(function (w) { return wb.indexOf(w) >= 0; });
      if (share.length) {
        conflicts.push({
          a: a, b: b,
          weeks: share,
          message: a.name + ' 与 ' + b.name + ' 在' + T.WEEK_NAMES[a.day] + ' ' +
            formatPeriods(Math.max(a.start, b.start), Math.min(a.end, b.end)) + ' 冲突（' +
            formatWeeks(a.weeks) + '）',
        });
      }
    }
  }
  return conflicts;
}

/** 把任意来源的课程数组批量规范化 */
function normalizeAll(list) {
  const out = [];
  for (let i = 0; i < (list || []).length; i++) out.push(normalizeCourse(list[i], i));
  return out;
}

module.exports = {
  normalizeCourse,
  normalizeAll,
  normalizeWeeks,
  weekListOf,
  isWeekActive,
  formatWeeks,
  periodInfo,
  periodRange,
  formatPeriods,
  coursesOn,
  coursesOnDate,
  expandCourseDates,
  roomOf,
  roomLabel,
  buildTimeline,
  getCurrentClass,
  getNextClass,
  detectConflicts,
};
