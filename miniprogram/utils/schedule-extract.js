/**
 * 课表结构识别引擎
 * ---------------------------------------------------------------
 * 输入：Excel 表格的二维数组 / Word 表格的二维数组 / 纯文本
 * 输出：标准课程对象数组
 *
 * 支持两大类课表布局：
 *  A) 列表式（每行一门课，有表头：课程名称 / 星期 / 节次 / 教室 / 周次）
 *  B) 网格式（第一行是星期一~星期日，第一列是节次，格子内写课程名、教师、教室、周次）
 *
 * 识别不出来的字段会退化为默认值，并在 _warnings 里说明，由页面提示用户确认。
 */
const T = require('./time');
const S = require('./schedule');

/* ==================== 基础文本工具 ==================== */

/** 全角转半角 + 去不可见字符 */
function norm(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/[\uFF01-\uFF5E]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    })
    .replace(/\u3000/g, ' ')
    .replace(/[\u200b-\u200f\ufeff]/g, '');
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isBlank(s) {
  return !s || !String(s).replace(/\s/g, '');
}

/* ==================== 星期 ==================== */

const DAY_CHAR = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };
const DAY_EN = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };

/**
 * 严格解析星期标签（只在整个单元格就是星期表示时才成功）
 * 用于表头行 / 行列标签，避免把普通文本误判成星期
 */
function parseDayStrict(text) {
  const t = norm(text).replace(/\s/g, '');
  if (!t || t.length > 8) return 0;

  let m = t.match(/^(?:星期|周|礼拜)([一二三四五六日天1-7])$/);
  if (m) return DAY_CHAR[m[1]] || Number(m[1]) || 0;

  if (/^[一二三四五六日天]$/.test(t)) return DAY_CHAR[t];
  if (/^[1-7]$/.test(t)) return Number(t);

  m = t.toLowerCase().match(/^(mon|tue|wed|thu|fri|sat|sun)/);
  if (m) return DAY_EN[m[1]];

  return 0;
}

/* ==================== 节次 ==================== */

const CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };

function cnToNum(s) {
  if (/^\d+$/.test(s)) return Number(s);
  if (s.length === 1 && CN_NUM[s]) return CN_NUM[s];
  if (s === '十') return 10;
  if (s === '十一') return 11;
  if (s === '十二') return 12;
  let m = s.match(/^十([一二三四五六七八九])$/);
  if (m) return 10 + CN_NUM[m[1]];
  m = s.match(/^([一二三四五六七八九])十$/);
  if (m) return CN_NUM[m[1]] * 10;
  return 0;
}

/**
 * 把"连写"的数字串拆成单个数字。
 * 教务系统常把一格跨两节写成竖排的「第 / 一 / 二 / 节」，
 * 去掉"第""节"后剩下 "一二"，需要还原成 [1,2]。
 */
function splitConsecutiveNumbers(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/[0-9]/.test(ch)) out.push(Number(ch));
    else if (CN_NUM[ch]) out.push(CN_NUM[ch]);
    else if (ch === '十') out.push(10);
    else return null;
  }
  return out.length ? out : null;
}

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const p = String(hhmm).split(':');
  return Number(p[0]) * 60 + Number(p[1] || 0);
}

/** 把 "08:00" 映射到节次编号 */
function periodByTime(timeStr, periods) {
  if (!periods || !periods.length) return 0;
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const min = Number(m[1]) * 60 + Number(m[2]);

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (min >= toMinutes(p.start) - 5 && min <= toMinutes(p.end) + 5) return p.period;
  }
  // 找不到就用最接近的节次开始时间
  let best = 0;
  let bestDiff = 1e9;
  for (let i = 0; i < periods.length; i++) {
    const d = Math.abs(toMinutes(periods[i].start) - min);
    if (d < bestDiff) { bestDiff = d; best = periods[i].period; }
  }
  return bestDiff <= 30 ? best : 0;
}

/**
 * 解析节次标签，如 "第1节" / "1-2节" / "1、2" / "08:00-09:40"
 * @returns {{start:Number,end:Number}|null}
 */
function parsePeriodLabel(text, periods) {
  const t = norm(text).replace(/\s+/g, '');
  if (!t || t.length > 24) return null;

  // 1) 时间格式
  const times = t.match(/\d{1,2}:\d{2}/g);
  if (times && periods && periods.length) {
    const a = periodByTime(times[0], periods);
    const b = times.length > 1 ? periodByTime(times[1], periods) : a;
    if (a) return { start: Math.min(a, b || a), end: Math.max(a, b || a) };
  }

  // 2) 节次编号
  let s = t.replace(/第/g, '').replace(/节|课时|堂课|课次/g, '');
  s = s.replace(/[（(].*?[)）]/g, '');
  if (!s || s.length > 10) return null;

  let m = s.match(/^([一二三四五六七八九十\d]+)\s*[-–—~～至到,，、]\s*([一二三四五六七八九十\d]+)$/);
  if (m) {
    const a = cnToNum(m[1]);
    const b = cnToNum(m[2]);
    if (a >= 1 && b >= 1 && a <= 20 && b <= 20) {
      return { start: Math.min(a, b), end: Math.max(a, b) };
    }
    return null;
  }

  m = s.match(/^([一二三四五六七八九十\d]+)$/);
  if (m) {
    const a = cnToNum(m[1]);
    if (a >= 1 && a <= 20) return { start: a, end: a };

    // 连写形式："第一二节" -> 1-2，"第九十节" -> 9-10
    const nums = splitConsecutiveNumbers(m[1]);
    if (nums && nums.length >= 2) {
      const first = nums[0];
      const last = nums[nums.length - 1];
      if (first >= 1 && last <= 20 && first <= last) {
        return { start: first, end: last };
      }
    }
  }
  return null;
}

/* ==================== 周次 ==================== */

// 允许"单/双"出现在数字与"周"之间：1-16周 / 1-16单周 / 2-16双周
const WEEK_RANGE_RE = /(\d{1,2})\s*[-–—~～至到]\s*(\d{1,2})\s*(?:单|双)?\s*周/g;
const WEEK_LIST_RE = /((?:\d{1,2}\s*[,，、]\s*)+\d{1,2})\s*(?:单|双)?\s*周/g;
const WEEK_SINGLE_RE = /(\d{1,2})\s*(?:单|双)?\s*周/g;

/** 周次后面紧跟的 (单)/(双)/(单周) 后缀，切分时要跟本段绑在一起 */
const WEEK_SUFFIX_RE = /^\s*[（(]\s*[单双]\s*周?\s*[)）]/;

function parityOf(text) {
  if (/单/.test(text)) return 'odd';
  if (/双/.test(text)) return 'even';
  return 'all';
}

/** 在文本中查找所有周次写法，带位置信息 */
function findAllWeeks(text) {
  const t = norm(text);
  const out = [];

  let m;
  const rangeRe = new RegExp(WEEK_RANGE_RE.source, 'g');
  while ((m = rangeRe.exec(t)) !== null) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a >= 1 && b >= 1 && a <= 30 && b <= 30) {
      out.push({ start: Math.min(a, b), end: Math.max(a, b), parity: parityOf(t), matched: m[0], index: m.index });
    }
  }

  const listRe = new RegExp(WEEK_LIST_RE.source, 'g');
  while ((m = listRe.exec(t)) !== null) {
    const list = m[1].split(/[,，、]/).map(function (x) { return parseInt(x, 10); })
      .filter(function (n) { return n >= 1 && n <= 30; });
    if (list.length >= 2) {
      out.push({
        start: Math.min.apply(null, list),
        end: Math.max.apply(null, list),
        parity: 'custom',
        list: list,
        matched: m[0],
        index: m.index,
      });
    }
  }

  // 单个周次：跳过已经被区间匹配覆盖的位置
  const singleRe = new RegExp(WEEK_SINGLE_RE.source, 'g');
  while ((m = singleRe.exec(t)) !== null) {
    const n = Number(m[1]);
    if (n < 1 || n > 30) continue;
    const overlap = out.some(function (w) {
      return m.index >= w.index && m.index < w.index + w.matched.length;
    });
    if (!overlap) {
      out.push({ start: n, end: n, parity: parityOf(t), matched: m[0], index: m.index });
    }
  }

  out.sort(function (a, b) { return a.index - b.index; });
  return out;
}

/** 解析周次（取第一个匹配） */
function parseWeeks(text, allowBare) {
  const all = findAllWeeks(text);
  if (all.length) return all[0];
  if (!allowBare) return null;

  const t = norm(text);
  const m = t.match(/(\d{1,2})\s*[-–—~～至到]\s*(\d{1,2})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a >= 1 && b <= 30 && a <= b) {
      return { start: a, end: b, parity: parityOf(t), matched: m[0], index: m.index };
    }
  }
  const single = t.match(/^(\d{1,2})$/);
  if (single) {
    const n = Number(single[1]);
    if (n >= 1 && n <= 30) return { start: n, end: n, parity: 'all', matched: t, index: 0 };
  }
  return null;
}

/* ==================== 教室 ==================== */

/**
 * 在文本中找教室。
 * 优先匹配教室字典里的编号（最可靠），其次用常见编号模式兜底。
 * @returns {{roomId:String, matched:String, known:Boolean}|null}
 */
function extractRoomHit(text, classrooms) {
  const raw = norm(text);
  if (!raw) return null;

  // 1) 教室字典匹配（按编号长度降序，避免 "A30" 抢先匹配 "A301"）
  if (classrooms && classrooms.length) {
    const sorted = classrooms.slice().sort(function (a, b) {
      return (b.id || '').length - (a.id || '').length;
    });
    const upper = raw.toUpperCase();
    for (let i = 0; i < sorted.length; i++) {
      const id = sorted[i].id;
      if (!id) continue;
      if (upper.indexOf(id.toUpperCase()) >= 0) {
        return { roomId: id, matched: id, known: true };
      }
    }
    // 再按显示名匹配（如 "图书馆201自习室"）
    for (let i = 0; i < sorted.length; i++) {
      const name = sorted[i].name;
      if (name && name.length >= 3 && raw.indexOf(name) >= 0) {
        return { roomId: sorted[i].id, matched: name, known: true };
      }
    }
  }

  // 2) 关键词后取值："地点：A301"
  let m = raw.match(/(?:上课地点|教学地点|授课地点|上课教室|教室|课室|地点|地址)\s*[:：]?\s*([^\s,，;；、|]{2,24})/);
  if (m) {
    const v = m[1].trim();
    if (v) return { roomId: v.toUpperCase(), matched: m[0], known: false };
  }

  // 3) 常见编号模式
  const patterns = [
    /(?:^|[\s（(【,，|])([东南西北]?[A-Za-z]{1,3}[-—]?\d{2,4})(?=$|[\s）)】,，;；|])/,
    /(第?[一二三四五六七八九十\d]{1,3}教(?:学楼)?[\s-]*[A-Za-z]?\d{2,4})/,
    /([\u4e00-\u9fa5]{2,8}(?:楼|馆|中心|校区)[A-Za-z]?[-—]?\d{1,4})/,
    // 楼名被简写掉的写法："综合602"、"科技117"、"经管308"
    /([\u4e00-\u9fa5]{2,4}\d{3,4})/,
    /(\d{1,2}[-—]\d{3,4})(?=$|[\s,，;；])/,
    /([A-Za-z]?\d{3,4}室)/,
  ];
  for (let i = 0; i < patterns.length; i++) {
    const hit = raw.match(patterns[i]);
    if (hit) return { roomId: hit[1].trim().toUpperCase(), matched: hit[1], known: false };
  }
  return null;
}

function extractRoom(text, classrooms) {
  const hit = extractRoomHit(text, classrooms);
  return hit ? hit.roomId : '';
}

/* ==================== 教师 ==================== */

/**
 * 判断是否像教师姓名。
 * 黑名单以"多字词"为主，避免把「周立」「李雯」这类姓名误杀；
 * 只保留人名中几乎不会出现的单字（节/楼/室/馆）。
 */
const NON_TEACHER = /实验|上机|理论|实践|必修|选修|公选|通识|考试|课程|教学|答疑|设计|概论|导论|原理|基础|数学|物理|英语|体育|化学|地理|历史|哲学|政治|经济|管理|法律|计算机|网络|编程|语言|结构|分析|算法|系统|方法|周次|周数|节次|教室|教学楼|机房|班级|学院|专业|方向|限选|任选|综合|职教|科技|工程|[节楼室馆房]/;

function isTeacherLike(text) {
  const t = norm(text).trim();
  if (!/^[\u4e00-\u9fa5]{2,4}$/.test(t)) return false;
  if (NON_TEACHER.test(t)) return false;
  return true;
}

/* ==================== 单元格内容解析 ==================== */

/**
 * 把一个单元格的文本解析成一门或多门课
 * @param {String} text  单元格原文（可能多行）
 * @param {Object} ctx   { classrooms, periods, totalWeeks }
 * @returns {Array<{name,teacher,roomId,weeks,warnings}>}
 */
function parseCellContent(text, ctx) {
  const raw = String(text === undefined || text === null ? '' : text).replace(/\r/g, '').trim();
  if (!raw) return [];

  // 一个格子里有两门课（常见于"单周上 A、双周上 B"或教务导出的拥挤格子）。
  // 判据：出现两个及以上周次写法时，按周次切分，每段一门课。
  const weekHits = findAllWeeks(raw);
  if (weekHits.length >= 2) {
    const segments = splitByWeeks(raw, weekHits);
    const out = [];
    for (let i = 0; i < segments.length; i++) {
      let seg = segments[i];
      let parsed = parseSingleCell(seg, ctx);
      // 该段没解析出课程名（例如周次写在了最前面），并入下一段重试
      while ((!parsed || !parsed.length) && i + 1 < segments.length) {
        i++;
        seg = seg + '\n' + segments[i];
        parsed = parseSingleCell(seg, ctx);
      }
      if (parsed && parsed.length) out.push.apply(out, parsed);
    }
    if (out.length) return out;
  }

  return parseSingleCell(raw, ctx);
}

/** 按周次出现的位置把文本切成多段，每段以周次结尾 */function splitByWeeks(raw, weekHits) {
  const parts = [];
  let start = 0;
  for (let i = 0; i < weekHits.length; i++) {
    const wh = weekHits[i];
    let end = wh.index + wh.matched.length;
    // "1-16周(单)" 里的 (单) 属于这一门课，要一起切进来，否则单双周信息会丢
    const suffix = raw.slice(end).match(WEEK_SUFFIX_RE);
    if (suffix) end += suffix[0].length;
    if (end <= start) continue;
    parts.push(raw.slice(start, end));
    start = end;
  }
  const tail = raw.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

/**
 * 把一个单元格拆成若干"信息片段"。
 * 分层降级：换行 → 菱形等强分隔符 → 竖线 → 空格/逗号。
 * 必须分层，因为教务系统常用 ◇ 分隔字段（"高等数学◇4-17(1,2节)◇A301"），
 * 而 "(1,2节)" 里的逗号一旦当成分隔符就会把节次拆坏。
 */
function splitCellSegments(raw) {
  const text = String(raw === undefined || raw === null ? '' : raw);
  let parts = text.split(/[\n\r]+/);
  if (parts.length <= 1) parts = text.split(/[◇◆○●■□▪▫·・]+/);
  if (parts.length <= 1) parts = text.split(/[|｜]+/);
  if (parts.length <= 1) parts = text.split(/[\s,，;；]+/);
  return parts.map(function (s) { return s.trim(); }).filter(Boolean);
}

/** 解析一格里的"一门课" */
function parseSingleCell(raw, ctx) {
  const lines = splitCellSegments(raw);

  const results = [];
  let cur = null;

  function ensure() {
    if (!cur) cur = { name: '', teacher: '', roomId: '', weeks: null, warnings: [] };
    return cur;
  }
  function flush() {
    if (cur && cur.name) results.push(cur);
    cur = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line)) continue;

    // 周次：先按带"周"字的标准写法，再退一步接受"4-17"这类省略"周"字的写法
    const weeks = parseWeeks(line) || parseWeeks(line, true);
    const roomHit = extractRoomHit(line, ctx.classrooms);

    if (weeks) {
      // 已经有一门带周次的课 -> 说明格子里是多门课
      if (cur && cur.weeks) flush();
      const c = ensure();
      c.weeks = { start: weeks.start, end: weeks.end, parity: weeks.parity };
      if (weeks.list) c.weeks.list = weeks.list;

      let remain = line.replace(weeks.matched, ' ');
      if (roomHit) {
        remain = remain.replace(new RegExp(escapeRegExp(roomHit.matched), 'i'), ' ');
        if (!c.roomId) c.roomId = roomHit.roomId;
      }
      remain = remain.replace(/[（(]\s*(?:单|双)?\s*周?\s*[)）]/g, ' ').trim();
      if (remain && !c.name) attachName(c, remain);
      else if (remain && isTeacherLike(remain) && !c.teacher) c.teacher = remain;
      continue;
    }

    // 纯教室行
    if (roomHit) {
      const remain = line.replace(new RegExp(escapeRegExp(roomHit.matched), 'i'), '').trim();
      if (!remain) {
        const c = ensure();
        if (!c.roomId) c.roomId = roomHit.roomId;
        continue;
      }
    }

    const c = ensure();

    // 课程名之后出现的"2-4 个纯汉字"视为教师
    if (c.name && !c.teacher && isTeacherLike(line)) {
      c.teacher = line;
      continue;
    }

    let rest = line;
    if (roomHit) {
      rest = rest.replace(new RegExp(escapeRegExp(roomHit.matched), 'i'), ' ').trim();
      if (!c.roomId) c.roomId = roomHit.roomId;
    }
    rest = rest.replace(/\s+/g, ' ').trim();
    if (!rest) continue;

    if (!c.name) {
      attachName(c, rest);
      continue;
    }
    // 该段里含教室信息时，剩下的文字属于教室描述
    //（"综合602安博实验室一" 去掉教室后剩 "安博实验室一"），
    // 不能再当成教师或课程名，否则会把课程名污染成 "计算机应用基础 谢春丽"
    if (roomHit) continue;
    if (!c.teacher && isTeacherLike(rest)) {
      c.teacher = rest;
      continue;
    }
    attachName(c, rest);
  }
  flush();

  // 收尾：处理只有名字没有任何其它信息的极端情况
  return results.map(function (c) {
    if (!c.roomId) c.warnings.push('未识别到教室');
    if (!c.weeks) c.warnings.push('未识别到周次');
    return c;
  });
}

function attachName(course, text) {
  const t = text.trim();
  if (!t) return;
  if (!course.name) course.name = t;
  else if (course.name.indexOf(t) < 0) course.name += ' ' + t;
}

/* ==================== 列表式课表 ==================== */

const FIELD_ALIASES = [
  { field: 'name', keys: ['课程名称', '课程名', '教学班名称', '课程', '科目', '名称'] },
  { field: 'weeks', keys: ['上课周次', '起止周', '周次', '周数', '上课周'] },
  { field: 'day', keys: ['上课星期', '星期几', '星期', '周几', '上课日'] },
  { field: 'period', keys: ['上课节次', '节次', '节数', '课节'] },
  { field: 'time', keys: ['上课时间', '时间段', '时间', '时段'] },
  { field: 'room', keys: ['上课地点', '上课教室', '教学地点', '授课地点', '教室', '地点', '课室'] },
  { field: 'teacher', keys: ['任课教师', '授课教师', '教师姓名', '教师', '老师'] },
  { field: 'className', keys: ['上课班级', '教学班', '班级', '行政班'] },
];

/** 表头里的修饰词，剥离后往往就是真正的字段名（"上课地点" -> "地点"） */
const HEADER_NOISE = /^(?:本|该|此)?(?:上课|教学|授课|任课|课程|科目)?(?:信息|情况|内容|安排|明细|一览|表)?$/;

/** 两个字符串的字符重合度，用于容忍异体字与多余字 */
function charOverlap(a, b) {
  if (!a || !b) return 0;
  const set = {};
  for (let i = 0; i < b.length; i++) set[b[i]] = 1;
  let hit = 0;
  for (let i = 0; i < a.length; i++) if (set[a[i]]) hit++;
  return hit / Math.max(a.length, 1);
}

/**
 * 把表头单元格文本映射成字段名。
 * 策略（依次尝试，取匹配到的最长别名，避免 "教室类型" 被 "教室" 抢走）：
 *   1) 完全相等
 *   2) 包含别名
 *   3) 剥离修饰词后再匹配
 *   4) 字符重合度兜底（容忍错别字）
 */
function matchField(text) {
  const raw = norm(text).replace(/\s/g, '');
  if (!raw || raw.length > 16) return '';

  let t = raw.replace(/[（(].*?[)）]/g, '');
  if (!t) t = raw;

  // 1) 完全相等
  for (let i = 0; i < FIELD_ALIASES.length; i++) {
    const keys = FIELD_ALIASES[i].keys;
    for (let k = 0; k < keys.length; k++) {
      if (t === keys[k]) return FIELD_ALIASES[i].field;
    }
  }

  // 2) 包含别名 —— 取最长的别名，最长的优先
  let bestField = '';
  let bestLen = 0;
  for (let i = 0; i < FIELD_ALIASES.length; i++) {
    const keys = FIELD_ALIASES[i].keys;
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k];
      if (key.length > bestLen && t.indexOf(key) >= 0) {
        bestLen = key.length;
        bestField = FIELD_ALIASES[i].field;
      }
    }
  }
  if (bestField) return bestField;

  // 3) 剥离修饰词
  const stripped = t.replace(/(?:上课|教学|授课|任课|课程|科目|日期|时间|地点|信息|情况|内容|安排|明细)/g, '');
  if (stripped && stripped !== t) {
    for (let i = 0; i < FIELD_ALIASES.length; i++) {
      const keys = FIELD_ALIASES[i].keys;
      for (let k = 0; k < keys.length; k++) {
        if (stripped === keys[k]) return FIELD_ALIASES[i].field;
      }
    }
  }

  // 4) 字符重合度兜底（只对 2-4 字的小词生效，避免误伤长句子）
  if (t.length >= 2 && t.length <= 4 && HEADER_NOISE.test(t) === false) {
    let field = '';
    let score = 0;
    for (let i = 0; i < FIELD_ALIASES.length; i++) {
      const keys = FIELD_ALIASES[i].keys;
      for (let k = 0; k < keys.length; k++) {
        const s = charOverlap(t, keys[k]);
        if (s >= 0.7 && s > score) {
          score = s;
          field = FIELD_ALIASES[i].field;
        }
      }
    }
    if (field) return field;
  }

  return '';
}

/** 判断文本是否"正好"是某个字段别名（用于识别重复表头） */
function isExactHeaderAlias(text) {
  const t = norm(text).replace(/\s/g, '').replace(/[（(].*?[)）]/g, '');
  if (!t || t.length > 16) return false;
  for (let i = 0; i < FIELD_ALIASES.length; i++) {
    const keys = FIELD_ALIASES[i].keys;
    for (let k = 0; k < keys.length; k++) {
      if (t === keys[k]) return true;
    }
  }
  return false;
}

/**
 * 判断这一行是不是"重复出现的表头行"。
 * 不能只看课程名单元格：像"课程设计""教师发展中心"这类正常内容也会包含字段关键词，
 * 那样会把真实课程整行丢掉。所以要求整行里多数单元格与别名**精确相等**。
 */
function looksLikeRepeatedHeader(row) {
  let exact = 0;
  let nonEmpty = 0;
  for (let c = 0; c < (row ? row.length : 0); c++) {
    const s = String(row[c] === undefined || row[c] === null ? '' : row[c]).trim();
    if (!s) continue;
    nonEmpty++;
    if (isExactHeaderAlias(s)) exact++;
  }
  return exact >= 3 && exact >= nonEmpty * 0.5;
}

/** 把一行单元格映射成 {field: col}，并记录命中数 */
function mapHeaderCells(row) {
  const columns = {};
  let hits = 0;
  const width = row ? row.length : 0;
  for (let c = 0; c < width; c++) {
    const f = matchField(row[c]);
    if (f && columns[f] === undefined) {
      columns[f] = c;
      hits++;
    }
  }
  return { columns: columns, hits: hits };
}

/**
 * 合并两行做"复合表头"。
 * 两行表头通常是「第一行大类 + 第二行细分」，所以 order 决定谁优先。
 */
function mergeHeaderRows(a, b, preferSecond) {
  const n = Math.max(a ? a.length : 0, b ? b.length : 0);
  const out = [];
  for (let c = 0; c < n; c++) {
    const va = a && a[c] !== undefined ? String(a[c]).trim() : '';
    const vb = b && b[c] !== undefined ? String(b[c]).trim() : '';
    if (!va) out.push(vb);
    else if (!vb) out.push(va);
    else out.push(preferSecond ? vb : va);
  }
  return out;
}

/** 给一个表头候选打分：有课程名 + 有时间类字段 + 命中数 */
function scoreHeaderCandidate(cand) {
  const cols = cand.columns;
  const hasName = cols.name !== undefined;
  const hasWhen = cols.day !== undefined || cols.period !== undefined || cols.time !== undefined;
  if (!hasName || !hasWhen) return 0;
  let score = cand.hits * 10;
  if (hasName) score += 40;
  if (cols.day !== undefined) score += 20;
  if (cols.period !== undefined || cols.time !== undefined) score += 20;
  if (cols.room !== undefined) score += 15;
  if (cols.weeks !== undefined) score += 15;
  if (cols.teacher !== undefined) score += 5;
  return score;
}

/**
 * 在表格里寻找最像表头的一行（找不到返回 null）
 * 支持单行表头与两行复合表头
 */
function findHeaderRow(rows, maxScan, minScore) {
  const limit = Math.min(rows.length, maxScan || 15);
  let best = null;

  for (let r = 0; r < limit; r++) {
    const variants = [];
    variants.push({ headRow: r, span: 1, cells: rows[r] });
    if (r + 1 < limit) {
      variants.push({ headRow: r, span: 2, cells: mergeHeaderRows(rows[r], rows[r + 1], true) });
      variants.push({ headRow: r, span: 2, cells: mergeHeaderRows(rows[r], rows[r + 1], false) });
    }

    for (let v = 0; v < variants.length; v++) {
      const cand = variants[v];
      const mapped = mapHeaderCells(cand.cells);
      const score = scoreHeaderCandidate(mapped);
      if (score <= 0) continue;
      // 越靠上的表头略微加权（前面通常是表格标题）
      const adjusted = score - cand.headRow * 2;
      if (adjusted < (minScore || 0)) continue;
      if (!best || adjusted > best.score) {
        best = {
          headerRow: cand.headRow,
          span: cand.span,
          startRow: cand.headRow + cand.span,
          columns: mapped.columns,
          hits: mapped.hits,
          score: adjusted,
        };
      }
    }
  }
  return best;
}

/**
 * 按给定的列映射提取数据行（列表式执行器）
 */
function extractRowsWithColumns(rows, startRow, columns, ctx) {
  const courses = [];
  const warnings = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || isBlank(row.join(''))) continue;

    const name = getCell(row, columns.name);
    if (!name || isBlank(name)) continue;
    // 跳过重复出现的表头行（分页导出时常见）
    if (looksLikeRepeatedHeader(row)) continue;

    const item = {
      name: name.replace(/\s+/g, ' ').trim(),
      teacher: columns.teacher !== undefined ? getCell(row, columns.teacher).trim() : '',
      roomId: '',
      weeks: null,
      day: 0,
      start: 0,
      end: 0,
      warnings: [],
      _source: '第 ' + (r + 1) + ' 行',
      _fromHeader: true,
    };

    // 星期
    if (columns.day !== undefined) {
      item.day = parseDayStrict(getCell(row, columns.day)) ||
        parseDayFromLoose(getCell(row, columns.day));
    } else if (columns.time !== undefined) {
      const d = parseDayFromLoose(getCell(row, columns.time));
      if (d) item.day = d;
    }

    // 节次（优先节次列，其次时间列）
    let period = null;
    if (columns.period !== undefined) {
      period = parsePeriodLabel(getCell(row, columns.period), ctx.periods);
    }
    if (!period && columns.time !== undefined) {
      const cell = getCell(row, columns.time);
      period = parsePeriodLabel(cell, ctx.periods);
      if (!period) {
        // "周三 1-2节" 之类的组合列
        const seg = cell.match(/[^\s]*\d+\s*[-–—~～至到]\s*\d+\s*节?/);
        if (seg) period = parsePeriodLabel(seg[0], ctx.periods);
      }
    }
    if (period) {
      item.start = period.start;
      item.end = period.end;
    }

    // 周次
    if (columns.weeks !== undefined) {
      const w = parseWeeks(getCell(row, columns.weeks), true);
      if (w) item.weeks = { start: w.start, end: w.end, parity: w.parity, list: w.list };
    }
    if (!item.weeks) {
      const w2 = parseWeeks(getCell(row, columns.weeks === undefined ? -1 : columns.weeks), true);
      if (w2) item.weeks = { start: w2.start, end: w2.end, parity: w2.parity, list: w2.list };
    }

    // 教室
    if (columns.room !== undefined) {
      const cell = getCell(row, columns.room);
      const hit = extractRoomHit(cell, ctx.classrooms);
      if (hit) item.roomId = hit.roomId;
      else if (!isBlank(cell)) item.roomId = cell.replace(/\s+/g, '').toUpperCase();
    }

    if (!item.day) item.warnings.push('未识别到星期');
    if (!item.start) item.warnings.push('未识别到节次');
    if (!item.roomId) item.warnings.push('未识别到教室');
    if (!item.weeks) item.warnings.push('未识别到周次');
    item._confidence = confidenceOf(item);

    if (!item.day || !item.start) {
      warnings.push('第 ' + (r + 1) + ' 行「' + item.name + '」缺少星期或节次，已跳过');
      continue;
    }
    courses.push(item);
  }

  return { courses: courses, warnings: warnings };
}

/** 单条课程的识别置信度（0-1） */
function confidenceOf(item) {
  let hit = 0;
  let total = 5;
  if (item.day) hit++;
  if (item.start) hit++;
  if (item.roomId) hit++;
  if (item.weeks) hit++;
  if (item.teacher) hit++;
  return Math.round((hit / total) * 100) / 100;
}

/**
 * 尝试按"列表式"解析
 * @param {Array} rows
 * @param {Object} ctx
 * @param {Object} [forced] 由智能识别给出的既定方案 { headerRow, startRow, columns }
 * @returns {{courses:Array, headerRow:Number, columns:Object}|null}
 */
function extractFromList(rows, ctx, forced) {
  let plan = forced;
  if (!plan) {
    plan = findHeaderRow(rows);
    if (!plan) return null;
  }
  const startRow = plan.startRow !== undefined ? plan.startRow : (plan.headerRow + 1);
  const res = extractRowsWithColumns(rows, startRow, plan.columns, ctx);
  return {
    courses: res.courses,
    headerRow: plan.headerRow,
    columns: plan.columns,
    warnings: res.warnings,
  };
}

function getCell(row, index) {
  if (index === undefined || index < 0 || !row) return '';
  const v = row[index];
  return v === undefined || v === null ? '' : String(v);
}

/** 宽松解析星期：在任意位置找 "星期一" / "周三" 等 */
function parseDayFromLoose(text) {
  const t = norm(text);
  if (!t) return 0;
  let m = t.match(/(?:星期|周|礼拜)\s*([一二三四五六日天1-7])/);
  if (m) return DAY_CHAR[m[1]] || Number(m[1]) || 0;
  m = t.toLowerCase().match(/\b(mon|tue|wed|thu|fri|sat|sun)/);
  if (m) return DAY_EN[m[1]];
  return 0;
}

/* ==================== 网格式课表 ==================== */

/**
 * 找出所有"像星期表头"的行，越像越靠前。
 * 星期列越多、重复越少、位置越靠上，越可能是真正的表头行。
 */
function findGridHeaders(rows, maxScan) {
  const limit = Math.min(rows.length, maxScan || 20);
  const out = [];

  for (let r = 0; r < limit; r++) {
    const cols = [];
    let nonEmpty = 0;
    for (let c = 0; c < rows[r].length; c++) {
      const raw = rows[r][c];
      if (String(raw === undefined || raw === null ? '' : raw).trim()) nonEmpty++;
      const d = parseDayStrict(raw);
      if (d) cols.push({ col: c, day: d });
    }
    // 真正表头行里星期占比很高；普通数据行偶尔出现一个"星期一"不应被当成网格表头
    const dayRatio = nonEmpty ? cols.length / nonEmpty : 0;
    if (cols.length >= 3 && dayRatio >= 0.5) {
      const seen = {};
      let dup = 0;
      for (let i = 0; i < cols.length; i++) {
        if (seen[cols[i].day]) dup++;
        seen[cols[i].day] = 1;
      }
      out.push({
        headerRow: r,
        dayColumns: cols,
        dayRatio: dayRatio,
        score: cols.length * 10 + dayRatio * 20 - dup * 15 - r * 2,
      });
    }
  }
  return out.sort(function (a, b) { return b.score - a.score; });
}

/** 按给定的星期表头提取网格里的课程 */
function extractGridWith(rows, headerRow, dayColumns, ctx) {
  const firstDayCol = dayColumns[0].col;
  const dayColSet = {};
  dayColumns.forEach(function (d) { dayColSet[d.col] = d.day; });

  const courses = [];
  const warnings = [];
  const periodColVotes = {};

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    // 节次标签通常在星期列左侧，取最靠左能解析出节次的列
    let period = null;
    let periodCol = -1;
    for (let c = 0; c < Math.max(firstDayCol, 1); c++) {
      const hit = parsePeriodLabel(row[c], ctx.periods);
      if (hit) {
        period = hit;
        periodCol = c;
        break;
      }
    }
    if (!period) continue;
    periodColVotes[periodCol] = (periodColVotes[periodCol] || 0) + 1;

    for (let c = firstDayCol; c < row.length; c++) {
      const day = dayColSet[c];
      if (!day) continue;
      const cell = row[c];
      if (isBlank(cell)) continue;

      const parsed = parseCellContent(cell, ctx);
      for (let k = 0; k < parsed.length; k++) {
        const p = parsed[k];
        if (!p.name) continue;
        const item = {
          name: p.name,
          teacher: p.teacher,
          roomId: p.roomId,
          weeks: p.weeks,
          day: day,
          start: period.start,
          end: period.end,
          warnings: p.warnings.slice(),
          _source: '第' + (r + 1) + '行第' + (c + 1) + '列',
          _fromHeader: false,
        };
        item._confidence = confidenceOf(item);
        courses.push(item);
      }
      if (!parsed.length) {
        warnings.push('第 ' + (r + 1) + ' 行第 ' + (c + 1) + ' 列内容无法识别：' + String(cell).slice(0, 20));
      }
    }
  }

  if (!courses.length) return null;

  let bestCol = -1;
  let bestVotes = 0;
  Object.keys(periodColVotes).forEach(function (k) {
    if (periodColVotes[k] > bestVotes) {
      bestVotes = periodColVotes[k];
      bestCol = Number(k);
    }
  });

  return {
    courses: courses,
    headerRow: headerRow,
    dayColumns: dayColumns,
    periodCol: bestCol,
    warnings: warnings,
  };
}

/**
 * 尝试按"网格课表"解析
 * @param {Object} [forced] 由智能识别给出的既定方案 { headerRow, dayColumns }
 */
function extractFromGrid(rows, ctx, forced) {
  let plan = forced;
  if (!plan) {
    const headers = findGridHeaders(rows);
    if (!headers.length) return null;
    plan = headers[0];
  }
  return extractGridWith(rows, plan.headerRow, plan.dayColumns, ctx);
}

/* ==================== 相邻区间合并 ==================== */

function weeksKey(w) {
  if (!w) return 'none';
  if (Array.isArray(w.list)) return w.list.join(',');
  return w.start + '-' + w.end + '-' + (w.parity || 'all');
}

/**
 * 合并同一门课被拆到多行（未使用合并单元格）的情况
 * 例如 "第1节" 和 "第2节" 两行都是同一门课 -> 合并成 1-2 节
 */
function mergeAdjacent(courses) {
  const groups = {};
  const order = [];

  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    const key = [c.name, c.day, c.roomId || '', c.teacher || '', weeksKey(c.weeks)].join('\u0001');
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(c);
  }

  const out = [];
  for (let i = 0; i < order.length; i++) {
    const list = groups[order[i]].slice().sort(function (a, b) { return a.start - b.start; });
    let cur = null;
    for (let k = 0; k < list.length; k++) {
      const c = list[k];
      if (cur && c.start <= cur.end + 1) {
        cur.end = Math.max(cur.end, c.end);
        // 合并后取更高的置信度（信息更全的那条行）
        if ((c._confidence || 0) > (cur._confidence || 0)) cur._confidence = c._confidence;
        if (c._source && cur._source && cur._source.indexOf(c._source) < 0) {
          cur._source += '、' + c._source;
        }
      } else {
        if (cur) out.push(cur);
        cur = {
          name: c.name,
          teacher: c.teacher,
          roomId: c.roomId,
          weeks: c.weeks,
          day: c.day,
          start: c.start,
          end: c.end,
          warnings: (c.warnings || []).slice(),
          _source: c._source,
          _confidence: c._confidence,
          _fromHeader: c._fromHeader,
        };
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

/* ==================== 对外主入口 ==================== */

function defaultWeeks(ctx) {
  return { start: 1, end: (ctx && ctx.totalWeeks) || 16, parity: 'all' };
}

function finalize(courses, ctx) {
  const out = [];
  const unknownRooms = [];

  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    if (!c.weeks) {
      c.weeks = defaultWeeks(ctx);
      c.warnings = (c.warnings || []).filter(function (w) { return w !== '未识别到周次'; });
      c.warnings.push('未识别到周次，已按 1-' + c.weeks.end + ' 周处理');
    }
    if (c.roomId && ctx.classrooms && ctx.classrooms.length) {
      const known = ctx.classrooms.some(function (r) { return r.id === c.roomId; });
      if (!known && unknownRooms.indexOf(c.roomId) < 0) unknownRooms.push(c.roomId);
    }
    if (c.name) out.push(c);
  }

  return {
    courses: out,
    unknownRooms: unknownRooms,
    stats: {
      total: out.length,
      withRoom: out.filter(function (c) { return !!c.roomId; }).length,
      withTeacher: out.filter(function (c) { return !!c.teacher; }).length,
    },
  };
}

/** 按智能识别给出的方案执行提取 */
function runPlan(rows, plan, ctx) {
  let raw = null;

  if (plan.layout === 'list') {
    raw = extractFromList(rows, ctx, {
      headerRow: plan.headerRow,
      startRow: plan.startRow !== undefined ? plan.startRow : plan.headerRow + 1,
      columns: plan.columns,
    });
  } else if (plan.layout === 'grid') {
    raw = extractFromGrid(rows, ctx, {
      headerRow: plan.headerRow,
      dayColumns: plan.dayColumns,
    });
  }
  if (!raw || !raw.courses.length) return null;

  const merged = mergeAdjacent(raw.courses);
  const fin = finalize(merged, ctx);
  return Object.assign({
    layout: plan.layout,
    headerRow: plan.headerRow,
    columns: plan.columns,
    dayColumns: plan.dayColumns,
    plan: plan,
  }, fin, { warnings: raw.warnings || [] });
}

/**
 * 从二维表格提取课程
 * @param {Array<Array<String>>} rows
 * @param {Object} ctx  { classrooms, periods, totalWeeks }
 * @param {Object} [plan] 智能识别给出的方案（不传则使用内置的常规识别）
 */
function extractFromTable(rows, ctx, plan) {
  const context = ctx || {};
  // 注意：这里不能过滤掉空行，否则行号会和智能识别给出的方案错位
  //（方案里的 headerRow / startRow 都是按原始行号算的）
  const all = (rows || []).map(function (r) {
    return (r || []).map(function (v) { return v === undefined || v === null ? '' : String(v); });
  });

  const hasContent = all.some(function (r) {
    return r.some(function (v) { return !isBlank(v); });
  });
  if (!hasContent) {
    return { courses: [], layout: 'empty', warnings: ['表格是空的'], unknownRooms: [], stats: { total: 0 } };
  }

  // 智能识别给出的方案优先
  if (plan && plan.layout) {
    const byPlan = runPlan(all, plan, context);
    if (byPlan && byPlan.courses.length) return byPlan;
  }

  // 常规识别：先列表式（有明确表头），再网格式
  const list = extractFromList(all, context);
  if (list && list.courses.length) {
    const merged = mergeAdjacent(list.courses);
    return Object.assign({ layout: 'list', headerRow: list.headerRow, columns: list.columns },
      finalize(merged, context), { warnings: list.warnings || [] });
  }

  const grid = extractFromGrid(all, context);
  if (grid && grid.courses.length) {
    const merged = mergeAdjacent(grid.courses);
    return Object.assign({ layout: 'grid', headerRow: grid.headerRow, dayColumns: grid.dayColumns },
      finalize(merged, context), { warnings: grid.warnings || [] });
  }

  return {
    courses: [],
    layout: 'unknown',
    warnings: ['没有识别出课表结构。请确认表格包含"课程名称/星期/节次/教室/周次"这样的表头，' +
      '或者是"上方是星期、左侧是节次"的课表网格。'],
    unknownRooms: [],
    stats: { total: 0 },
  };
}

/** 从纯文本提取课程（保留原有 CSV 位置式解析，再做自由式兜底） */
function extractFromText(text, ctx) {
  const context = ctx || {};
  const IMP = require('./importer');
  const lines = String(text || '').split(/\r?\n/);
  const courses = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw[0] === '#') continue;

    // 1) 位置式：课程名,星期,起始节,结束节,教室,周次
    const pos = IMP.parseLine(raw);
    if (!pos.error && pos.course.day && pos.course.start) {
      courses.push({
        name: pos.course.name,
        teacher: pos.course.teacher || '',
        roomId: pos.course.roomId || '',
        weeks: pos.course.weeks,
        day: pos.course.day,
        start: pos.course.start,
        end: pos.course.end,
        warnings: [],
        _source: '第 ' + (i + 1) + ' 行',
      });
      continue;
    }

    // 2) 自由式：从任意位置的星期/节次/周次/教室推断
    const free = parseFreeFormLine(raw, context);
    if (free) {
      free._source = '第 ' + (i + 1) + ' 行';
      courses.push(free);
    } else {
      errors.push({ line: i + 1, text: raw, error: '无法识别为一条课程记录' });
    }
  }

  const merged = mergeAdjacent(courses);
  return Object.assign({ layout: 'text', errors: errors }, finalize(merged, context));
}

/** 自由式单行解析：不看字段顺序 */
function parseFreeFormLine(line, ctx) {
  let rest = norm(line);
  const item = {
    name: '', teacher: '', roomId: '', weeks: null,
    day: 0, start: 0, end: 0, warnings: [],
  };

  const day = parseDayFromLoose(rest);
  if (day) {
    item.day = day;
    rest = rest.replace(/(?:星期|周|礼拜)\s*[一二三四五六日天1-7]/, ' ');
  }

  const weeks = parseWeeks(rest);
  if (weeks) {
    item.weeks = { start: weeks.start, end: weeks.end, parity: weeks.parity, list: weeks.list };
    rest = rest.replace(weeks.matched, ' ');
  }

  const roomHit = extractRoomHit(rest, ctx.classrooms);
  if (roomHit) {
    item.roomId = roomHit.roomId;
    rest = rest.replace(new RegExp(escapeRegExp(roomHit.matched), 'i'), ' ');
  }

  // 节次：优先 "1-2节" 这类；否则看剩下的裸数字
  const periodHit = rest.match(/第?\s*[一二三四五六七八九十\d]+\s*[-–—~～至到,，、]\s*[一二三四五六七八九十\d]+\s*节?/);
  if (periodHit) {
    const p = parsePeriodLabel(periodHit[0], ctx.periods);
    if (p) {
      item.start = p.start;
      item.end = p.end;
      rest = rest.replace(periodHit[0], ' ');
    }
  }

  const parts = rest.split(/[\s,，;；|、]+/).map(function (s) { return s.trim(); }).filter(Boolean);

  if (!item.start) {
    // 找连续的两个纯数字作为节次区间，或单个数字
    for (let i = 0; i < parts.length; i++) {
      if (/^\d{1,2}$/.test(parts[i])) {
        if (i + 1 < parts.length && /^\d{1,2}$/.test(parts[i + 1])) {
          const a = Number(parts[i]);
          const b = Number(parts[i + 1]);
          if (a >= 1 && b <= 20 && a <= b) {
            item.start = a;
            item.end = b;
            parts.splice(i, 2);
            break;
          }
        }
        const a = Number(parts[i]);
        if (a >= 1 && a <= 20) {
          item.start = a;
          item.end = a;
          parts.splice(i, 1);
          break;
        }
      }
    }
  }
  if (item.start && !item.end) item.end = item.start;

  // 教师：2-4 个纯汉字且不像课程名
  for (let i = 1; i < parts.length; i++) {
    if (isTeacherLike(parts[i]) && !item.teacher) {
      item.teacher = parts[i];
      parts.splice(i, 1);
      break;
    }
  }

  item.name = parts.join(' ').trim();
  if (!item.name || !item.day || !item.start) return null;

  if (!item.roomId) item.warnings.push('未识别到教室');
  if (!item.weeks) item.warnings.push('未识别到周次');
  return item;
}

module.exports = {
  norm,
  parseDayStrict,
  parseDayFromLoose,
  parsePeriodLabel,
  parseWeeks,
  findAllWeeks,
  extractRoom,
  extractRoomHit,
  isTeacherLike,
  parseCellContent,
  getCell,
  matchField,
  isExactHeaderAlias,
  looksLikeRepeatedHeader,
  mapHeaderCells,
  mergeHeaderRows,
  findHeaderRow,
  findGridHeaders,
  confidenceOf,
  extractFromList,
  extractFromGrid,
  extractRowsWithColumns,
  extractGridWith,
  extractFromTable,
  runPlan,
  extractFromText,
  mergeAdjacent,
  periodByTime,
};
