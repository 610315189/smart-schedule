/**
 * 时间与周次工具
 * ---------------------------------------------------------------
 * 约定：
 *  - day: 1=周一 … 7=周日
 *  - week: 学期第几周，从 1 开始；<1 表示开学前，>totalWeeks 表示学期结束后
 *  - "分钟数" 指当天 0 点起的分钟偏移，便于比较大小
 */

const WEEK_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEK_SHORT = ['', '一', '二', '三', '四', '五', '六', '日'];

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** 'YYYY-MM-DD' -> Date（本地 00:00），不依赖各端对日期字符串的解析差异 */
function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date) return new Date(str.getFullYear(), str.getMonth(), str.getDate());
  const m = String(str).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date -> 'YYYY-MM-DD' */
function formatDate(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

/** 'HH:mm' -> 当天分钟数 */
function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const parts = String(hhmm).split(':');
  return Number(parts[0]) * 60 + Number(parts[1] || 0);
}

/** Date -> 当天分钟数（含秒的零头） */
function dateToMinutes(date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/** 把日期与 'HH:mm' 合成完整 Date */
function atTime(date, hhmm) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const m = toMinutes(hhmm);
  d.setMinutes(m);
  return d;
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

/** 该日期所在周的周一 */
function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  return addDays(d, 1 - dow);
}

/** 1=周一 … 7=周日 */
function getDayOfWeek(date) {
  const dow = date.getDay();
  return dow === 0 ? 7 : dow;
}

/** 相对学期开始日期计算第几周（第 1 周周一 = 第 1 周） */
function getWeekIndex(date, termStartDate) {
  const start = parseDate(termStartDate);
  if (!start) return 1;
  const monday = getMonday(date);
  const ms = monday.getTime() - start.getTime();
  const days = Math.round(ms / 86400000);
  return Math.floor(days / 7) + 1;
}

/** 第 week 周（周一为基准）的 7 个日期 */
function weekDates(week, termStartDate) {
  const start = parseDate(termStartDate);
  const out = [];
  if (!start) return out;
  const monday = addDays(start, (week - 1) * 7);
  for (let i = 0; i < 7; i++) out.push(addDays(monday, i));
  return out;
}

/** '10月7日 周三' */
function humanDate(date) {
  return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + WEEK_NAMES[getDayOfWeek(date)];
}

/** 'HH:mm' 展示；分钟差 -> '20 分钟' / '1 小时 5 分钟' */
function humanDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return m + ' 分钟';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? h + ' 小时' : h + ' 小时 ' + rest + ' 分钟';
}

/** 秒级时间戳（wx.addPhoneCalendar 需要） */
function toTimestamp(date) {
  return Math.floor(date.getTime() / 1000);
}

module.exports = {
  WEEK_NAMES,
  WEEK_SHORT,
  pad2,
  parseDate,
  formatDate,
  toMinutes,
  dateToMinutes,
  atTime,
  addDays,
  getMonday,
  getDayOfWeek,
  getWeekIndex,
  weekDates,
  humanDate,
  humanDuration,
  toTimestamp,
};
