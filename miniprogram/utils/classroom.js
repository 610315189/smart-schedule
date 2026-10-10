/**
 * 空教室查询（可用于自习）
 * ---------------------------------------------------------------
 * 思路：把"教室全集 - 该时段被占用的教室" = 空教室。
 * 占用来源有两个，合并计算：
 *   1) 我的课表（courses）—— 只能看到自己班的占用
 *   2) 全校占用表（occupancy）—— 可选导入，数据越全结果越准
 *
 * 同时计算每间教室"今天的所有空堂时段"，方便判断哪间教室能连坐几个小时。
 */
const T = require('./time');
const S = require('./schedule');
const CLS = require('../data/classrooms');

function resolveDate(date) {
  if (!date) return new Date();
  return T.parseDate(date) || new Date();
}

/** 节次区间是否与 [s2,e2] 有交集 */
function overlaps(s1, e1, s2, e2) {
  return !(e1 < s2 || e2 < s1);
}

/**
 * 构建某天每间教室的占用索引
 * @returns { week, day, busy: { roomId: { [period]: {name, source} } }, byRoom: { roomId: [records] }, unknownRooms: [] }
 */
function buildBusyMap(courses, occupancy, classrooms, date, settings) {
  const d = resolveDate(date);
  const week = T.getWeekIndex(d, settings.termStartDate);
  const day = T.getDayOfWeek(d);
  const totalWeeks = settings.totalWeeks;
  const busy = {};
  const byRoom = {};
  const unknownRooms = [];
  const known = {};
  for (let i = 0; i < classrooms.length; i++) known[classrooms[i].id] = true;

  function addRecords(list, source) {
    for (let i = 0; i < (list || []).length; i++) {
      const c = list[i];
      if (Number(c.day) !== day) continue;
      if (!S.isWeekActive(c, week, totalWeeks)) continue;
      const roomId = c.roomId;
      if (!roomId) continue;
      if (!known[roomId] && unknownRooms.indexOf(roomId) < 0) unknownRooms.push(roomId);
      if (!busy[roomId]) busy[roomId] = {};
      for (let p = Number(c.start); p <= Number(c.end); p++) {
        if (!busy[roomId][p]) busy[roomId][p] = { name: c.name, source: source, period: p };
      }
      if (!byRoom[roomId]) byRoom[roomId] = [];
      byRoom[roomId].push({ name: c.name, start: c.start, end: c.end, source: source, teacher: c.teacher || '' });
    }
  }

  addRecords(courses, 'mine');
  addRecords(occupancy, 'school');

  return { date: d, week: week, day: day, busy: busy, byRoom: byRoom, unknownRooms: unknownRooms };
}

/** 某教室在 [start,end] 区间内是否全空（供外部按需调用） */
function isFree(busy, roomId, start, end) {
  const m = busy[roomId];
  if (!m) return true;
  for (let p = start; p <= end; p++) {
    if (m[p]) return false;
  }
  return true;
}

/** 某教室当天的空闲时段列表 */
function freeRuns(busyMap, roomId, periods) {
  const maxPeriod = periods.length ? periods[periods.length - 1].period : 0;
  const out = [];
  let runStart = null;
  for (let p = 1; p <= maxPeriod; p++) {
    const free = !busyMap.busy[roomId] || !busyMap.busy[roomId][p];
    if (free) {
      if (runStart === null) runStart = p;
    } else if (runStart !== null) {
      out.push(runOf(periods, runStart, p - 1));
      runStart = null;
    }
  }
  if (runStart !== null) out.push(runOf(periods, runStart, maxPeriod));
  return out;
}

function runOf(periods, start, end) {
  const t = S.periodRange(periods, start, end);
  let len = 0;
  for (let p = start; p <= end; p++) {
    const info = S.periodInfo(periods, p);
    if (info) {
      len += T.toMinutes(info.end) - T.toMinutes(info.start);
    }
  }
  return {
    start: start,
    end: end,
    periodText: S.formatPeriods(start, end),
    startTime: t.start,
    endTime: t.end,
    minutes: len,
    durationText: T.humanDuration(len),
  };
}

function facilityLabels(list) {
  const out = [];
  for (let i = 0; i < (list || []).length; i++) {
    out.push(CLS.FACILITY_LABEL[list[i]] || list[i]);
  }
  return out;
}

/**
 * 查询空闲教室
 * @param {Object} opts
 *  opt.date          查询日期（Date 或 'YYYY-MM-DD'），默认今天
 *  opt.startPeriod   起始节次
 *  opt.endPeriod     结束节次
 *  opt.courses       我的课表
 *  opt.occupancy     全校占用表
 *  opt.classrooms    教室字典
 *  opt.periods       节次表
 *  opt.settings      设置（termStartDate / totalWeeks）
 *  opt.building      楼栋筛选，'' = 全部
 *  opt.minCapacity   最小座位数
 *  opt.type          教室类型筛选
 *  opt.facilities    需要具备的设施 id 数组（全部满足）
 *  opt.onlyStudy     只看允许自习的教室，默认 true
 *  opt.sort          'building' 默认 | 'capacity' | 'freespan'
 */
function queryFreeRooms(opts) {
  const o = opts || {};
  const settings = o.settings || {};
  const classrooms = o.classrooms || [];
  const periods = o.periods || [];
  const d = resolveDate(o.date);
  const start = Number(o.startPeriod) || 1;
  const end = Number(o.endPeriod) || start;
  const onlyStudy = o.onlyStudy === undefined ? true : !!o.onlyStudy;
  const minCapacity = Number(o.minCapacity) || 0;
  const busyMap = o.busyMap || buildBusyMap(o.courses, o.occupancy, classrooms, d, settings);

  const free = [];
  const occupied = [];
  const skipped = [];

  for (let i = 0; i < classrooms.length; i++) {
    const room = classrooms[i];
    if (onlyStudy && room.openForStudy === false) {
      skipped.push(room);
      continue;
    }
    if (minCapacity && (room.capacity || 0) < minCapacity) continue;
    if (o.building && room.building !== o.building) continue;
    if (o.type && room.type !== o.type) continue;
    if (o.campus && room.campus !== o.campus) continue;
    if (o.facilities && o.facilities.length) {
      const fac = room.facilities || [];
      let ok = true;
      for (let k = 0; k < o.facilities.length; k++) {
        if (fac.indexOf(o.facilities[k]) < 0) { ok = false; break; }
      }
      if (!ok) continue;
    }

    const runs = freeRuns(busyMap, room.id, periods);
    const covering = pickRun(runs, start, end);
    const item = {
      id: room.id,
      name: room.name,
      building: room.building,
      campus: room.campus || '',
      floor: room.floor || 0,
      capacity: room.capacity || 0,
      type: room.type,
      typeLabel: CLS.TYPE_LABEL[room.type] || room.type,
      facilities: room.facilities || [],
      facilityLabels: facilityLabels(room.facilities),
      openForStudy: room.openForStudy !== false,
      freeRuns: runs,
      coveringRun: covering,
      occupiedToday: (busyMap.byRoom[room.id] || []).map(function (r) {
        return {
          name: r.name,
          periodText: S.formatPeriods(r.start, r.end),
          source: r.source,
          teacher: r.teacher,
        };
      }),
    };

    if (covering) {
      item.currentRun = covering;
      // 主文案强调"查询的这段是空的"，并额外给出能连用多久
      const querySpan = S.formatPeriods(start, end);
      item.freeSpanText = querySpan + ' 空';
      item.runSpanText = covering.periodText === querySpan
        ? ''
        : ('可连用 ' + covering.periodText + '（' + covering.durationText + '）');
      free.push(item);
    } else {
      occupied.push(item);
    }
  }

  const sortBy = o.sort || 'building';
  if (sortBy === 'capacity') {
    free.sort(function (a, b) { return (b.capacity || 0) - (a.capacity || 0); });
  } else if (sortBy === 'freespan') {
    free.sort(function (a, b) { return (b.coveringRun.minutes || 0) - (a.coveringRun.minutes || 0); });
  } else {
    free.sort(function (a, b) {
      if (a.building !== b.building) return a.building < b.building ? -1 : 1;
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.name < b.name ? -1 : 1;
    });
  }

  return {
    date: d,
    week: busyMap.week,
    day: busyMap.day,
    startPeriod: start,
    endPeriod: end,
    periodText: S.formatPeriods(start, end),
    timeRange: S.periodRange(periods, start, end),
    free: free,
    occupied: occupied,
    skipped: skipped,
    unknownRooms: busyMap.unknownRooms,
    buildings: collectBuildings(classrooms),
    busyMap: busyMap,
  };
}

/** 在空闲段列表中找出覆盖 [start,end] 的那一段 */
function pickRun(runs, start, end) {
  for (let i = 0; i < runs.length; i++) {
    if (runs[i].start <= start && runs[i].end >= end) return runs[i];
  }
  return null;
}

function collectBuildings(classrooms) {
  const out = [];
  for (let i = 0; i < classrooms.length; i++) {
    const b = classrooms[i].building;
    if (b && out.indexOf(b) < 0) out.push(b);
  }
  return out;
}

/** 当前时刻对应的节次；课间时返回下一节，便于"现在去哪儿自习" */
function currentPeriodContext(periods, now) {
  const n = now || new Date();
  const nowMin = T.dateToMinutes(n);
  let last = null;
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const s = T.toMinutes(p.start);
    const e = T.toMinutes(p.end);
    if (nowMin >= s && nowMin < e) return { period: p.period, phase: 'in', periodInfo: p };
    if (nowMin < s && !last) last = p;
  }
  if (last) return { period: last.period, phase: 'break', periodInfo: last };
  return { period: periods.length ? periods[periods.length - 1].period : 0, phase: 'after', periodInfo: null };
}

/** 现在（或下一节）去哪自习：返回空闲教室列表，默认查连续 2 节 */
function queryFreeRoomsNow(opts) {
  const o = opts || {};
  const periods = o.periods || [];
  const ctx = currentPeriodContext(periods, o.now || new Date());
  const span = o.span || 2;
  const maxPeriod = periods.length ? periods[periods.length - 1].period : 10;
  const start = ctx.period || 1;
  const end = Math.min(start + span - 1, maxPeriod);
  const res = queryFreeRooms(Object.assign({}, o, { startPeriod: start, endPeriod: end }));
  res.context = ctx;
  return res;
}

/**
 * 根据教室编号猜出一个教室条目。
 * 用于把"课表里出现、但教室字典里没有"的教室补进字典，
 * 否则这些教室不会出现在空教室查询结果里。
 *
 *   经管教学楼308 -> building "经管教学楼", floor 3
 *   综合602       -> building "综合",       floor 6
 *   A301          -> building "A",          floor 3
 */
function guessClassroom(id) {
  const s = String(id || '').trim();
  if (!s) return null;

  const base = {
    id: s,
    name: s,
    capacity: 0,
    type: 'normal',
    openForStudy: true,
    facilities: [],
  };

  const m = s.match(/^([\u4e00-\u9fa5A-Za-z\-]*?)[\s-]?(\d{3,4})$/);
  if (!m) {
    const letters = s.match(/^[\u4e00-\u9fa5A-Za-z]+/);
    base.building = letters ? letters[0] : '未分类';
    base.floor = 0;
    return base;
  }

  const num = m[2];
  base.building = m[1] || '未分类';
  base.floor = num.length >= 3 ? Number(num.slice(0, num.length - 2)) : 0;
  return base;
}

module.exports = {
  buildBusyMap,
  isFree,
  freeRuns,
  queryFreeRooms,
  queryFreeRoomsNow,
  currentPeriodContext,
  collectBuildings,
  guessClassroom,
};
