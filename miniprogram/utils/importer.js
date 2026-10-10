/**
 * 课表文本解析（批量导入）
 * ---------------------------------------------------------------
 * 抽成独立模块便于单元测试，页面只负责 UI。
 *
 * 支持的写法：
 *  A) 逗号分隔：课程名,星期,起始节,结束节,教室,周次
 *     例：高等数学(上),周一,1,2,A301,1-16
 *  B) 空格/Tab 分隔：课程名 星期 节次范围 教室 [周次]
 *     例：程序设计基础 周三 5-6 A301 1-16周
 * 以 # 开头的行视为注释。
 */
const S = require('./schedule');

function parseLine(line) {
  let parts = String(line).split(/[,，\t]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  if (parts.length < 4) {
    parts = String(line).split(/\s+/).filter(Boolean);
  }
  if (parts.length < 4) return { error: '字段不足（至少需要 课程名/星期/节次/教室）' };

  let name, dayText, start, end, roomId, weekText;
  if (parts.length >= 6) {
    name = parts[0]; dayText = parts[1];
    start = parts[2]; end = parts[3];
    roomId = parts[4]; weekText = parts[5];
  } else if (parts.length === 5) {
    name = parts[0]; dayText = parts[1];
    const range = parsePeriodRange(parts[2]);
    if (!range) return { error: '节次无法识别：' + parts[2] };
    start = range[0]; end = range[1];
    roomId = parts[3]; weekText = parts[4];
  } else {
    name = parts[0]; dayText = parts[1];
    const range = parsePeriodRange(parts[2]);
    if (!range) return { error: '节次无法识别：' + parts[2] };
    start = range[0]; end = range[1];
    roomId = parts[3]; weekText = '1-16';
  }

  const day = parseDay(dayText);
  if (!day) return { error: '星期无法识别：' + dayText };

  const s = parseInt(start, 10);
  const e = parseInt(end, 10) || s;
  if (!s || s < 1) return { error: '起始节次无效：' + start };

  return {
    course: {
      name: String(name).trim(),
      day: day,
      start: s,
      end: Math.max(s, e),
      roomId: String(roomId || '').trim().toUpperCase(),
      weeks: S.normalizeWeeks(weekText || '1-16'),
      teacher: '',
      note: '',
    },
  };
}

function parsePeriodRange(text) {
  const t = String(text).replace(/[第节]/g, '').trim();
  const m = t.match(/^(\d+)\s*[-~到至]\s*(\d+)$/);
  if (m) return [Number(m[1]), Number(m[2])];
  const single = t.match(/^(\d+)$/);
  if (single) return [Number(single[1]), Number(single[1])];
  return null;
}

function parseDay(text) {
  const t = String(text).trim();
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
  const m = t.match(/([一二三四五六日天])/);
  if (m) return map[m[1]];
  const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
  if (n >= 1 && n <= 6) return n;
  if (n === 7 || n === 0) return 7;
  return null;
}

/**
 * 解析整段文本
 * @returns { courses, errors: [{line, text, error}], unknownRooms }
 */
function parseText(text, classrooms) {
  const lines = String(text || '').split(/\r?\n/);
  const courses = [];
  const errors = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw[0] === '#') continue;
    const r = parseLine(raw);
    if (r.error) errors.push({ line: i + 1, text: raw, error: r.error });
    else courses.push(r.course);
  }

  const unknownRooms = [];
  if (classrooms && classrooms.length) {
    const known = {};
    for (let i = 0; i < classrooms.length; i++) known[classrooms[i].id] = true;
    for (let i = 0; i < courses.length; i++) {
      if (courses[i].roomId && !known[courses[i].roomId] && unknownRooms.indexOf(courses[i].roomId) < 0) {
        unknownRooms.push(courses[i].roomId);
      }
    }
  }

  return { courses: courses, errors: errors, unknownRooms: unknownRooms };
}

module.exports = { parseLine, parseText, parseDay, parsePeriodRange };
