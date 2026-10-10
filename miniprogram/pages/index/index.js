const app = getApp();
const S = require('../../utils/schedule');
const T = require('../../utils/time');
const N = require('../../utils/notify');
const C = require('../../utils/classroom');
const storage = require('../../utils/storage');

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

/** 毫秒 -> HH:MM:SS */
function hms(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
}

Page({
  data: {
    dateLabel: '',
    weekText: '',
    mode: 'idle',
    countdownLabel: '',
    countdown: '--:--:--',
    lesson: null,
    timeline: [],
    freeSlots: [],
    studyRooms: [],
    studyContext: '',
    alert: null,
  },

  _timer: null,
  _tick: 0,
  _g: null,

  onShow() {
    this.refresh();
    this.startTimer();
  },

  onHide() { this.stopTimer(); },
  onUnload() { this.stopTimer(); },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  startTimer() {
    this.stopTimer();
    this._tick = 0;
    this._timer = setInterval(() => { this.tick(); }, 1000);
  },

  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  /** 全量刷新：数据、时间轴、提醒、空教室推荐 */
  refresh() {
    const g = app.data();
    this._g = g;
    const now = new Date();

    const timeline = S.buildTimeline(g.courses, g.classrooms, g.periods, now, g.settings);

    // 课前提醒（含两级提醒与去重）
    const remind = N.checkAndRemind(g.courses, g.classrooms, g.periods, g.settings, { now: now });
    const patch = {
      dateLabel: T.humanDate(now),
      weekText: '第 ' + Math.max(1, T.getWeekIndex(now, g.settings.termStartDate)) + ' 周',
      timeline: timeline.courses,
      freeSlots: timeline.freeSlots,
    };
    if (remind.alert) patch.alert = remind.alert;

    // 现在可以去哪自习
    try {
      const stu = C.queryFreeRoomsNow({
        courses: g.courses, occupancy: g.occupancy, classrooms: g.classrooms,
        periods: g.periods, settings: g.settings, span: 2, onlyStudy: true,
        sort: 'freespan', now: now,
      });
      const sctx = stu.context || {};
      patch.studyRooms = (stu.free || []).slice(0, 3).map(function (r) {
        return Object.assign({}, r, {
          capacityText: r.capacity > 0 ? (r.capacity + ' 座') : '座位未知',
        });
      });
      patch.studyContext = (sctx.phase === 'in' ? '当前第' + sctx.period + '节' : '下一节') +
        ' 起 ' + stu.periodText + ' 空';
    } catch (e) {
      console.error('[index] 空教室计算失败', e);
    }

    this.setData(patch, () => { this.updateHero(g, new Date()); });

    // 每天第一次打开时，先给一份"今天上什么课"的总览；有课前提醒时让位给提醒
    if (!remind.alert) this.maybeShowDailyBrief(timeline, now);
  },

  /** 每日课程总览（每天只弹一次） */
  maybeShowDailyBrief(timeline, now) {
    if (!timeline.courses.length) return;
    const key = 'ss_brief_' + T.formatDate(now);
    if (storage.get(key, false)) return;
    const upcoming = timeline.courses.filter(function (c) { return c.status !== 'done'; });
    if (!upcoming.length) return;
    storage.set(key, true);
    const lines = timeline.courses.map(function (c) {
      return c.startTime + '  ' + c.name + '  @ ' + c.room;
    });
    const first = upcoming[0];
    if (first.status === 'soon') N.vibrate(false);
    wx.showModal({
      title: '今天有 ' + timeline.courses.length + ' 节课',
      content: lines.join('\n'),
      confirmText: '知道了',
      showCancel: false,
    });
  },

  /** 每秒刷新倒计时 */
  tick() {
    const g = this._g;
    if (!g) return;
    const now = new Date();
    this._tick++;
    this.updateHero(g, now);
    if (this._tick % 15 === 0) {
      const remind = N.checkAndRemind(g.courses, g.classrooms, g.periods, g.settings, { now: now });
      if (remind.alert) this.setData({ alert: remind.alert });
    }
    // 整分钟时全量刷新，保证跨节次后时间轴状态正确
    if (this._tick % 60 === 0) this.refresh();
  },

  /** 顶部大字区：正在上课 / 即将上课 / 下一节课 */
  updateHero(g, now) {
    const current = S.getCurrentClass(g.courses, g.classrooms, g.periods, now, g.settings);
    if (current) {
      const c = current.course;
      this.setData({
        mode: 'during',
        countdownLabel: '正在上课 · 距离下课',
        countdown: hms(current.endAt.getTime() - now.getTime()),
        lesson: {
          name: c.name,
          room: current.room,
          roomId: c.roomId,
          color: c.color,
          teacher: c.teacher,
          note: c.note,
          periodText: S.formatPeriods(c.start, c.end),
          startTime: current.startTime,
          endTime: current.endTime,
          dateLabel: '今天',
        },
      });
      return;
    }

    const next = S.getNextClass(g.courses, g.classrooms, g.periods, now, g.settings);
    if (!next) {
      this.setData({
        mode: 'idle', countdownLabel: '近期没有课程安排', countdown: '--:--:--', lesson: null,
      });
      return;
    }
    const left = next.startAt.getTime() - now.getTime();
    const c = next.course;
    this.setData({
      mode: next.isToday ? 'before' : 'idle',
      countdownLabel: next.isToday ? '距离上课还有' : '下一节课在 ' + next.dateLabel,
      countdown: hms(left),
      lesson: {
        name: c.name,
        room: next.room,
        roomId: c.roomId,
        color: c.color,
        teacher: c.teacher,
        note: c.note,
        periodText: next.periodText,
        startTime: next.startTime,
        endTime: next.endTime,
        dateLabel: next.dateLabel,
      },
    });
  },

  /** 点击今日课程卡片：显示详情 */
  onCourseTap(e) {
    const item = this.data.timeline[e.currentTarget.dataset.index];
    if (!item) return;
    const lines = [
      item.periodText + '  ' + item.startTime + '-' + item.endTime,
      '地点：' + item.room,
    ];
    if (item.teacher) lines.push('教师：' + item.teacher);
    lines.push('周次：' + item.weekText);
    if (item.note) lines.push('备注：' + item.note);
    wx.showModal({
      title: item.name,
      content: lines.join('\n'),
      confirmText: '加入日历',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) this.addCourseToCalendar(item);
      },
    });
  },

  addCurrentToCalendar() {
    this.addCourseToCalendar(this.data.lesson);
  },

  copyRoom() {
    const lesson = this.data.lesson;
    if (!lesson) return;
    wx.setClipboardData({
      data: lesson.room + '（' + lesson.name + '）',
      success: () => wx.showToast({ title: '教室已复制', icon: 'success' }),
    });
  },

  /** 把展示中的这节课写入系统日历 */
  addCourseToCalendar(item) {
    const g = this._g || app.data();
    const course = this._findCourse(item);
    if (!course) {
      wx.showToast({ title: '未找到课程', icon: 'none' });
      return;
    }
    const today = new Date();
    const t = S.periodRange(g.periods, course.start, course.end);
    const start = T.atTime(today, t.start);
    const end = T.atTime(today, t.end);
    wx.addPhoneCalendar({
      title: course.name + (course.roomId ? ' @' + course.roomId : ''),
      startTime: T.toTimestamp(start),
      endTime: T.toTimestamp(end),
      alarm: true,
      alarmOffset: (g.settings.aheadMinutes || 20) * 60,
      description: course.teacher ? '教师：' + course.teacher : '',
      location: course.roomId || '',
      success: () => wx.showToast({ title: '已加入手机日历', icon: 'success' }),
      fail: (err) => {
        wx.showModal({
          title: '加入日历失败',
          content: '真机端首次使用需授权日历权限；开发者工具不支持该接口。\n\n' + (err.errMsg || ''),
          showCancel: false,
        });
      },
    });
  },

  _findCourse(item) {
    const g = this._g || app.data();
    if (!item) return null;
    for (let i = 0; i < g.courses.length; i++) {
      if (g.courses[i].name === item.name && g.courses[i].roomId === item.roomId) return g.courses[i];
    }
    return null;
  },

  gotoClassroom() {
    wx.switchTab({ url: '/pages/classroom/classroom' });
  },

  gotoEdit() {
    wx.navigateTo({ url: '/pages/course-edit/course-edit' });
  },

  closeAlert() {
    this.setData({ alert: null });
  },

  noop() {},
});
