const app = getApp();
const S = require('../../utils/schedule');
const T = require('../../utils/time');
const C = require('../../utils/classroom');
const CLS = require('../../data/classrooms');

const CAPACITY_OPTIONS = [
  { label: '不限', value: 0 },
  { label: '≥30 座', value: 30 },
  { label: '≥60 座', value: 60 },
  { label: '≥100 座', value: 100 },
  { label: '≥150 座', value: 150 },
];

const FACILITY_OPTIONS = [
  { id: 'socket', label: '有插座', active: false },
  { id: 'ac', label: '有空调', active: false },
  { id: 'projector', label: '有投影', active: false },
];

Page({
  data: {
    date: '',
    dateLabel: '',
    dayLabel: '',
    weekLabel: '',
    dateShortcuts: [],

    periodLabels: [],
    startIndex: 4,
    endIndex: 5,
    periodText: '',
    timeRangeText: '',

    buildingOptions: ['全部楼栋'],
    buildingIndex: 0,
    capacityOptions: CAPACITY_OPTIONS,
    capacityIndex: 0,
    onlyStudy: true,
    facilityOptions: FACILITY_OPTIONS,
    selectedFacilities: [],
    sort: 'building',
    sortOptions: [
      { id: 'building', label: '按楼栋' },
      { id: 'capacity', label: '按座位' },
      { id: 'freespan', label: '按空闲时长' },
    ],

    rooms: [],
    occupiedRooms: [],
    freeCount: 0,
    occupiedCount: 0,
    studyTotal: 0,
    timeHint: '',
    hasOccupancy: false,
    unknownRooms: [],

    detail: null,
    showDetail: false,
  },

  _g: null,
  _busy: null,
  _busyKey: '',

  onLoad() {
    const g = app.data();
    this._g = g;
    const labels = [];
    for (let i = 0; i < g.periods.length; i++) labels.push('第 ' + g.periods[i].period + ' 节');
    // 默认定位到"现在（或下一节）"，直接给出可自习的教室
    const ctx = C.currentPeriodContext(g.periods, new Date());
    const idx = Math.max(0, ctx.period - 1);
    const shortcuts = this.buildDateShortcuts();
    this.setData({
      periodLabels: labels,
      startIndex: idx,
      endIndex: Math.min(idx + 1, g.periods.length - 1),
      dateShortcuts: shortcuts,
      hasOccupancy: (g.occupancy || []).length > 0,
    }, () => this.pickDate(shortcuts[0].date));
  },

  onShow() {
    this._g = app.data();
    this.setData({ hasOccupancy: (this._g.occupancy || []).length > 0 });
    this.search();
  },

  buildDateShortcuts() {
    const out = [];
    const now = new Date();
    const names = ['今天', '明天', '后天'];
    for (let i = 0; i < 3; i++) {
      const d = T.addDays(now, i);
      out.push({ label: names[i], date: T.formatDate(d), offset: i });
    }
    return out;
  },

  pickDate(dateStr) {
    const d = T.parseDate(dateStr);
    const g = this._g;
    const week = T.getWeekIndex(d, g.settings.termStartDate);
    this.setData({
      date: dateStr,
      dateLabel: (d.getMonth() + 1) + '月' + d.getDate() + '日',
      dayLabel: T.WEEK_NAMES[T.getDayOfWeek(d)],
      weekLabel: '第 ' + Math.max(1, week) + ' 周',
    }, () => this.search());
  },

  onDateShortcut(e) {
    this.pickDate(e.currentTarget.dataset.date);
  },

  onDatePick(e) {
    this.pickDate(e.detail.value);
  },

  onStartPick(e) {
    const i = Number(e.detail.value);
    const end = Math.max(i, this.data.endIndex);
    this.setData({ startIndex: i, endIndex: end }, () => this.search());
  },

  onEndPick(e) {
    const i = Number(e.detail.value);
    const start = Math.min(i, this.data.startIndex);
    this.setData({ endIndex: i, startIndex: start }, () => this.search());
  },

  onBuildingPick(e) {
    this.setData({ buildingIndex: Number(e.currentTarget.dataset.index) }, () => this.search());
  },

  onCapacityPick(e) {
    this.setData({ capacityIndex: Number(e.currentTarget.dataset.index) }, () => this.search());
  },

  onSortPick(e) {
    this.setData({ sort: e.currentTarget.dataset.id }, () => this.search());
  },

  toggleOnlyStudy() {
    this.setData({ onlyStudy: !this.data.onlyStudy }, () => this.search());
  },

  toggleFacility(e) {
    const id = e.currentTarget.dataset.id;
    const opts = this.data.facilityOptions.map(function (o) {
      return { id: o.id, label: o.label, active: o.id === id ? !o.active : !!o.active };
    });
    const selected = opts.filter(function (o) { return o.active; }).map(function (o) { return o.id; });
    this.setData({ facilityOptions: opts, selectedFacilities: selected }, () => this.search());
  },

  /** 快捷时段：现在 / 上午 / 下午 / 晚上 / 连空 2 节 / 连空 3 节 */
  quickSelect(e) {
    const key = e.currentTarget.dataset.key;
    const g = this._g;
    const maxIdx = g.periods.length - 1;
    let s = this.data.startIndex;
    let en = this.data.endIndex;
    if (key === 'now') {
      const ctx = C.currentPeriodContext(g.periods, new Date());
      s = Math.max(0, ctx.period - 1);
      en = Math.min(s + 1, maxIdx);
    } else if (key === 'morning') { s = 0; en = 3; }
    else if (key === 'afternoon') { s = 4; en = 7; }
    else if (key === 'evening') { s = 8; en = maxIdx; }
    else if (key === 'span2') { en = Math.min(s + 1, maxIdx); }
    else if (key === 'span3') { en = Math.min(s + 2, maxIdx); }
    this.setData({ startIndex: Math.min(s, maxIdx), endIndex: Math.min(Math.max(en, s), maxIdx) },
      () => this.search());
  },

  search() {
    const g = this._g;
    if (!g) return;
    const periods = g.periods;
    const startPeriod = periods[this.data.startIndex] ? periods[this.data.startIndex].period : 1;
    const endPeriod = periods[this.data.endIndex] ? periods[this.data.endIndex].period : startPeriod;

    // 同一天的占用索引只算一次，筛选条件变化时复用
    const busyKey = this.data.date + '|' + startPeriod + '|' + endPeriod;
    if (this._busyKey !== busyKey) {
      this._busy = C.buildBusyMap(g.courses, g.occupancy, g.classrooms, this.data.date, g.settings);
      this._busyKey = busyKey;
    }

    const building = this.data.buildingIndex > 0
      ? this.data.buildingOptions[this.data.buildingIndex]
      : '';
    const capacity = CAPACITY_OPTIONS[this.data.capacityIndex].value;

    const res = C.queryFreeRooms({
      date: this.data.date,
      startPeriod: startPeriod,
      endPeriod: endPeriod,
      courses: g.courses,
      occupancy: g.occupancy,
      classrooms: g.classrooms,
      periods: periods,
      settings: g.settings,
      busyMap: this._busy,
      building: building,
      minCapacity: capacity,
      onlyStudy: this.data.onlyStudy,
      facilities: this.data.selectedFacilities,
      sort: this.data.sort,
    });

    // 楼栋下拉选项随教室字典生成
    const buildings = ['全部楼栋'].concat(res.buildings || []);

    const rooms = (res.free || []).map(function (r) {
      return {
        id: r.id,
        name: r.name,
        building: r.building,
        floor: r.floor,
        capacity: r.capacity,
        capacityText: r.capacity > 0 ? (r.capacity + ' 座') : '座位未知',
        typeLabel: r.typeLabel,
        facilityLabels: r.facilityLabels,
        freeSpanText: r.freeSpanText,
        runSpanText: r.runSpanText || '',
        currentRun: r.currentRun,
        freeRuns: r.freeRuns.slice(0, 4),
        freeRunCount: r.freeRuns.length,
        occupiedCount: r.occupiedToday.length,
      };
    });

    const studyTotal = g.classrooms.filter(function (r) { return r.openForStudy !== false; }).length;

    this.setData({
      buildingOptions: buildings,
      rooms: rooms,
      freeCount: rooms.length,
      occupiedCount: (res.occupied || []).length,
      studyTotal: studyTotal,
      unknownRooms: res.unknownRooms || [],
      periodText: S.formatPeriods(startPeriod, endPeriod),
      timeRangeText: res.timeRange.start + ' - ' + res.timeRange.end,
      timeHint: buildTimeHint(res, this.data.date),
    });
  },

  onRoomTap(e) {
    const id = e.currentTarget.dataset.id;
    const g = this._g;
    let room = null;
    for (let i = 0; i < g.classrooms.length; i++) {
      if (g.classrooms[i].id === id) { room = g.classrooms[i]; break; }
    }
    if (!room) return;
    const busyMap = this._busy || C.buildBusyMap(g.courses, g.occupancy, g.classrooms, this.data.date, g.settings);
    const runs = C.freeRuns(busyMap, id, g.periods);
    const occToday = (busyMap.byRoom[id] || []).map(function (r) {
      return {
        text: S.formatPeriods(r.start, r.end) + '  ' + r.name + (r.source === 'mine' ? '（我的课）' : ''),
      };
    }).sort();

    this.setData({
      showDetail: true,
      detail: {
        name: room.name,
        building: room.building,
        floor: room.floor,
        capacity: room.capacity,
        capacityText: room.capacity > 0 ? (room.capacity + ' 座') : '座位未知',
        typeLabel: CLS.TYPE_LABEL[room.type] || room.type || '',
        facilityLabels: (room.facilities || []).map(function (f) {
          return CLS.FACILITY_LABEL[f] || f;
        }),
        runs: runs,
        occupied: occToday,
        openForStudy: room.openForStudy !== false,
        dateLabel: this.data.dateLabel,
      },
    });
  },

  closeDetail() {
    this.setData({ showDetail: false, detail: null });
  },

  copyRoom() {
    const d = this.data.detail;
    if (!d) return;
    wx.setClipboardData({
      data: d.building + ' ' + d.name,
      success: () => wx.showToast({ title: '教室已复制', icon: 'success' }),
    });
  },

  gotoEdit() {
    wx.navigateTo({ url: '/pages/course-edit/course-edit' });
  },

  noop() {},
});

function buildTimeHint(res, dateStr) {
  const d = T.parseDate(dateStr);
  const isToday = T.formatDate(d) === T.formatDate(new Date());
  if (!isToday) return '';
  const nowMin = T.dateToMinutes(new Date());
  const s = T.toMinutes(res.timeRange.start);
  const e = T.toMinutes(res.timeRange.end);
  if (nowMin >= s && nowMin <= e) return '此刻就在该时段内';
  if (nowMin < s) return '距该时段还有 ' + Math.round(s - nowMin) + ' 分钟';
  return '该时段已经结束';
}
