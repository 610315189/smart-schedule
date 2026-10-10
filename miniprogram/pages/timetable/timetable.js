const app = getApp();
const S = require('../../utils/schedule');
const T = require('../../utils/time');
const C = require('../../utils/classroom');

const ROW_H = 112;      // 每个节次行高（rpx）
const TIME_COL_W = 88;  // 左侧节次列宽（rpx）
const DAY_AREA_W = 590; // 右侧天数区总宽（rpx）

Page({
  data: {
    week: 0,
    weekLabel: '',
    days: [],
    rows: [],
    cells: [],
    blocks: [],
    nowLine: -1,
    bodyHeight: 0,
    rowHeight: ROW_H,
    showWeekend: true,
    weekOptions: [],
    weekIndex: 0,
    conflictText: '',
    sheet: { show: false },
    todayIndex: -1,
  },

  _g: null,

  onLoad() {
    const g = app.data();
    this._g = g;
    const opts = [];
    for (let i = 1; i <= (g.settings.totalWeeks || 20); i++) opts.push('第 ' + i + ' 周');
    this.setData({ weekOptions: opts });
  },

  onShow() {
    this._g = app.data();
    const g = this._g;
    const cur = T.getWeekIndex(new Date(), g.settings.termStartDate);
    const week = this.data.week && this.data.week > 0 ? this.data.week : Math.max(1, Math.min(cur, g.settings.totalWeeks));
    this.render(week);
  },

  onHide() { this.setData({ sheet: { show: false } }); },

  /** 渲染指定周 */
  render(week) {
    const g = this._g;
    const periods = g.periods;
    const totalWeeks = g.settings.totalWeeks;
    const w = Math.max(1, Math.min(week, totalWeeks));
    const dates = T.weekDates(w, g.settings.termStartDate);
    const today = new Date();
    const todayStr = T.formatDate(today);

    const dayCount = this.data.showWeekend ? 7 : 5;
    const colW = DAY_AREA_W / dayCount;

    // ---- 表头：星期 + 日期 ----
    const days = [];
    for (let i = 0; i < dayCount; i++) {
      const d = dates[i];
      const ds = T.formatDate(d);
      days.push({
        day: i + 1,
        weekName: T.WEEK_NAMES[i + 1],
        dateLabel: (d.getMonth() + 1) + '/' + d.getDate(),
        isToday: ds === todayStr,
        width: colW,
      });
    }

    // ---- 左侧节次行 ----
    const rows = [];
    for (let i = 0; i < periods.length; i++) {
      rows.push({
        period: periods[i].period,
        start: periods[i].start,
        end: periods[i].end,
        section: periods[i].section,
        top: i * ROW_H,
      });
    }
    const bodyHeight = periods.length * ROW_H;

    // ---- 背景格子（用于点击空白格） ----
    const cells = [];
    for (let d = 1; d <= dayCount; d++) {
      for (let i = 0; i < periods.length; i++) {
        cells.push({
          key: 'cell_' + d + '_' + periods[i].period,
          day: d,
          period: periods[i].period,
          style: 'left:' + ((d - 1) * colW) + 'rpx;top:' + (i * ROW_H) + 'rpx;width:' + colW + 'rpx;height:' + ROW_H + 'rpx',
        });
      }
    }

    // ---- 课程块 ----
    const blocks = [];
    for (let d = 1; d <= dayCount; d++) {
      const dayCourses = S.coursesOn(g.courses, d, w, totalWeeks);
      for (let k = 0; k < dayCourses.length; k++) {
        const c = dayCourses[k];
        const idx = periodIndex(periods, c.start);
        const rowsSpan = Math.max(1, c.end - c.start + 1);
        const height = rowsSpan * ROW_H - 8;
        const t = S.periodRange(periods, c.start, c.end);
        blocks.push({
          key: c.id + '_' + d + '_' + w,
          id: c.id,
          day: d,
          name: c.name,
          room: c.roomId,
          teacher: c.teacher,
          note: c.note,
          color: c.color,
          periodText: S.formatPeriods(c.start, c.end),
          weekText: S.formatWeeks(c.weeks),
          timeText: t.start + '-' + t.end,
          start: c.start,
          end: c.end,
          isOngoing: false,
          style: 'left:' + ((d - 1) * colW + 3) + 'rpx;top:' + (idx * ROW_H + 4) + 'rpx;width:' +
            (colW - 6) + 'rpx;height:' + height + 'rpx;background:' + (c.color || '#2b5cff'),
        });
      }
    }

    // ---- 当前时间线（仅本周显示） ----
    let nowLine = -1;
    const isCurrentWeek = w === T.getWeekIndex(today, g.settings.termStartDate);
    if (isCurrentWeek && dayCount >= T.getDayOfWeek(today)) {
      const ctx = C.currentPeriodContext(periods, today);
      if (ctx.phase === 'in' && ctx.periodInfo) {
        const p = ctx.periodInfo;
        const idx = periodIndex(periods, p.period);
        const nowMin = T.dateToMinutes(today);
        const s = T.toMinutes(p.start);
        const e = T.toMinutes(p.end);
        const ratio = Math.max(0, Math.min(1, (nowMin - s) / Math.max(1, e - s)));
        nowLine = idx * ROW_H + ratio * ROW_H;
      }
    }

    // ---- 冲突提示 ----
    const conflicts = S.detectConflicts(g.courses);

    const first = dates[0];
    const last = dates[dayCount - 1];
    const weekLabel = '第 ' + w + ' 周 · ' + (first.getMonth() + 1) + '/' + first.getDate() +
      ' - ' + (last.getMonth() + 1) + '/' + last.getDate();

    this.setData({
      week: w,
      weekIndex: w - 1,
      weekLabel: weekLabel,
      days: days,
      rows: rows,
      cells: cells,
      blocks: blocks,
      nowLine: nowLine,
      bodyHeight: bodyHeight,
      conflictText: conflicts.length ? ('检测到 ' + conflicts.length + ' 处时间冲突：' + conflicts[0].message) : '',
      todayIndex: isCurrentWeek ? T.getDayOfWeek(today) : -1,
      sheet: this.data.sheet.show ? this.data.sheet : { show: false },
    });
  },

  prevWeek() { this.render(this.data.week - 1); },
  nextWeek() { this.render(this.data.week + 1); },
  backToNow() {
    const g = this._g;
    this.render(Math.max(1, T.getWeekIndex(new Date(), g.settings.termStartDate)));
  },
  onWeekPick(e) {
    this.render(Number(e.detail.value) + 1);
  },
  toggleWeekend() {
    const v = !this.data.showWeekend;
    this.setData({ showWeekend: v }, () => this.render(this.data.week));
  },

  /** 点击课程块 -> 课程详情 */
  onBlockTap(e) {
    const id = e.currentTarget.dataset.id;
    const g = this._g;
    let course = null;
    for (let i = 0; i < g.courses.length; i++) {
      if (g.courses[i].id === id) { course = g.courses[i]; break; }
    }
    if (!course) return;
    const t = S.periodRange(g.periods, course.start, course.end);
    const lines = [
      course.teacher ? '教师：' + course.teacher : '',
      '节次：' + S.formatPeriods(course.start, course.end) + '（' + t.start + '-' + t.end + '）',
      '周次：' + S.formatWeeks(course.weeks),
      course.note ? '备注：' + course.note : '',
    ].filter(Boolean);
    this.setData({
      sheet: {
        show: true,
        type: 'course',
        title: course.name,
        subtitle: course.roomId || '教室待定',
        lines: lines,
        courseId: course.id,
      },
    });
  },

  /** 点击空白格 -> 看这个时段哪里空 */
  onCellTap(e) {
    const day = Number(e.currentTarget.dataset.day);
    const period = Number(e.currentTarget.dataset.period);
    const g = this._g;
    const dates = T.weekDates(this.data.week, g.settings.termStartDate);
    const date = dates[day - 1];

    const res = C.queryFreeRooms({
      date: date,
      startPeriod: period,
      endPeriod: period,
      courses: g.courses,
      occupancy: g.occupancy,
      classrooms: g.classrooms,
      periods: g.periods,
      settings: g.settings,
      onlyStudy: true,
      sort: 'building',
    });

    const rooms = (res.free || []).slice(0, 8).map(function (r) {
      return { name: r.name, building: r.building, capacity: r.capacity, freeSpanText: r.freeSpanText };
    });

    this.setData({
      sheet: {
        show: true,
        type: 'rooms',
        title: T.WEEK_NAMES[day] + ' ' + S.formatPeriods(period, period) + ' 空教室',
        subtitle: T.formatDate(date) + ' · 共 ' + (res.free || []).length + ' 间可用',
        rooms: rooms,
        empty: rooms.length === 0,
      },
    });
  },

  closeSheet() { this.setData({ sheet: { show: false } }); },

  editCourse() {
    const id = this.data.sheet.courseId;
    this.setData({ sheet: { show: false } });
    wx.navigateTo({ url: '/pages/course-edit/course-edit?id=' + id });
  },

  gotoClassroom() {
    this.setData({ sheet: { show: false } });
    wx.switchTab({ url: '/pages/classroom/classroom' });
  },

  noop() {},
});

function periodIndex(periods, period) {
  for (let i = 0; i < periods.length; i++) {
    if (periods[i].period === Number(period)) return i;
  }
  return 0;
}
