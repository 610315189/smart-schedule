/**
 * 服务端课时计算
 * ---------------------------------------------------------------
 * 与小程序端 miniprogram/utils/schedule.js 保持一致的规则，
 * 但这里不依赖设备时区：统一按 config.tzOffsetHours（默认 UTC+8）计算墙上时间。
 */
const CFG = require('./config');

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

/** 取"目标时区"的墙上时间字段，不受服务器所在时区影响 */
function localParts(date) {
  const shifted = new Date((date || new Date()).getTime() + CFG.tzOffsetHours * 3600000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  const d = shifted.getUTCDate();
  return {
    y: y, m: m, d: d,
    dateStr: y + '-' + pad2(m) + '-' + pad2(d),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    dow: shifted.getUTCDay() === 0 ? 7 : shifted.getUTCDay(),
  };
}

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const p = String(hhmm).split(':');
  return Number(p[0]) * 60 + Number(p[1] || 0);
}

function parseDateToUTC(str) {
  const m = String(str || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fmtUTC(dt) {
  return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
}

/** 日期字符串加天数，返回 { str, dow } */
function dateAdd(str, n) {
  const dt = parseDateToUTC(str);
  dt.setUTCDate(dt.getUTCDate() + n);
  const dow = dt.getUTCDay() === 0 ? 7 : dt.getUTCDay();
  return { str: fmtUTC(dt), dow: dow };
}

function mondayOf(str) {
  const dt = parseDateToUTC(str);
  const dow = dt.getUTCDay() === 0 ? 7 : dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() - (dow - 1));
  return dt;
}

/** 第几周（第 1 周周一 = 第 1 周） */
function getWeekIndex(dateStr, termStartDate) {
  const start = parseDateToUTC(termStartDate);
  if (!start) return 1;
  const diffDays = Math.round((mondayOf(dateStr) - start) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

/** 兼容 { start, end, parity } 与字符串 */
function normalizeWeeks(weeks) {
  if (typeof weeks === 'string') {
    const m = weeks.match(/(\d+)\s*[-~]\s*(\d+)/);
    const parity = /单/.test(weeks) ? 'odd' : (/双/.test(weeks) ? 'even' : 'all');
    if (m) return { start: Number(m[1]), end: Number(m[2]), parity: parity };
  }
  if (weeks && typeof weeks === 'object') {
    return {
      start: Number(weeks.start) || 1,
      end: Number(weeks.end) || 20,
      parity: weeks.parity || 'all',
      list: Array.isArray(weeks.list) ? weeks.list : null,
    };
  }
  return { start: 1, end: 20, parity: 'all' };
}

function isWeekActive(course, week) {
  if (!week || week < 1) return false;
  const w = normalizeWeeks(course.weeks);
  if (Array.isArray(w.list)) return w.list.indexOf(week) >= 0;
  if (week < w.start || week > w.end) return false;
  if (w.parity === 'odd' && week % 2 === 0) return false;
  if (w.parity === 'even' && week % 2 !== 0) return false;
  return true;
}

function periodInfo(periods, period) {
  for (let i = 0; i < periods.length; i++) {
    if (Number(periods[i].period) === Number(period)) return periods[i];
  }
  return null;
}

function periodRange(periods, start, end) {
  const a = periodInfo(periods, start);
  const b = periodInfo(periods, end) || a;
  return {
    start: a ? a.start : '08:00',
    end: b ? b.end : (a ? a.end : '08:45'),
  };
}

/**
 * 找下一节课
 * @param {Object} user  含 courses / periods / settings
 * @param {Date}   now
 * @returns {Object|null} { course, dateStr, startTime, endTime, minutesLeft, week }
 */
function findNextClass(user, now) {
  const periods = user.periods || [];
  const settings = user.settings || {};
  const courses = (user.courses || []).slice().sort(function (a, b) {
    return Number(a.day) - Number(b.day) || Number(a.start) - Number(b.start);
  });
  if (!periods.length || !courses.length) return null;

  const p = localParts(now);
  for (let offset = 0; offset <= 21; offset++) {
    const day = dateAdd(p.dateStr, offset);
    const week = getWeekIndex(day.str, settings.termStartDate);
    for (let i = 0; i < courses.length; i++) {
      const c = courses[i];
      if (Number(c.day) !== day.dow) continue;
      if (!isWeekActive(c, week)) continue;
      const range = periodRange(periods, c.start, c.end);
      const startMin = toMinutes(range.start);
      const diff = offset * 1440 + startMin - p.minutes;
      if (diff > 0) {
        return {
          course: c,
          dateStr: day.str,
          offset: offset,
          week: week,
          startTime: range.start,
          endTime: range.end,
          minutesLeft: diff,
        };
      }
    }
  }
  return null;
}

/** 正在上的课（用于"正在上课"逻辑，可选） */
function findCurrentClass(user, now) {
  const periods = user.periods || [];
  const settings = user.settings || {};
  const p = localParts(now);
  const week = getWeekIndex(p.dateStr, settings.termStartDate);
  const list = (user.courses || []);
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (Number(c.day) !== p.dow) continue;
    if (!isWeekActive(c, week)) continue;
    const range = periodRange(periods, c.start, c.end);
    if (p.minutes >= toMinutes(range.start) && p.minutes <= toMinutes(range.end)) {
      return { course: c, dateStr: p.dateStr, week: week, startTime: range.start, endTime: range.end };
    }
  }
  return null;
}

module.exports = {
  localParts,
  toMinutes,
  dateAdd,
  getWeekIndex,
  normalizeWeeks,
  isWeekActive,
  periodInfo,
  periodRange,
  findNextClass,
  findCurrentClass,
};
