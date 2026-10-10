const app = getApp();
const CFG = require('../../config/index');
const T = require('../../utils/time');
const S = require('../../utils/schedule');
const N = require('../../utils/notify');
const CAL = require('../../utils/calendar');
const api = require('../../utils/api');

const WEEK_COUNT_OPTIONS = [];
for (let i = 12; i <= 26; i++) WEEK_COUNT_OPTIONS.push(i + ' 周');

Page({
  data: {
    settings: {},
    termStart: '',
    totalWeeksIndex: 8,
    weekCountOptions: WEEK_COUNT_OPTIONS,
    courseCount: 0,
    occupancyCount: 0,
    classCount: 0,
    serverEnabled: false,
    hasTemplate: false,
    syncResult: '',
    busy: false,
    version: '1.0.0',
  },

  _g: null,

  onShow() {
    const g = app.data();
    this._g = g;
    const s = g.settings;
    const idx = Number(s.totalWeeks) - 12;
    this.setData({
      settings: s,
      termStart: s.termStartDate,
      totalWeeksIndex: Math.max(0, Math.min(idx, WEEK_COUNT_OPTIONS.length - 1)),
      courseCount: g.courses.length,
      occupancyCount: (g.occupancy || []).length,
      classCount: g.classrooms.length,
      serverEnabled: api.enabled(),
      hasTemplate: !!CFG.SERVER.subscribeTemplateId,
    });
  },

  /* ---------------- 学期设置 ---------------- */

  onTermNameInput(e) {
    this._save({ termName: e.detail.value });
  },

  onTermStartChange(e) {
    this._save({ termStartDate: e.detail.value });
    this.setData({ termStart: e.detail.value });
    wx.showToast({ title: '开学日期已更新', icon: 'success' });
  },

  onTotalWeeksChange(e) {
    const weeks = Number(WEEK_COUNT_OPTIONS[Number(e.detail.value)].replace(/[^0-9]/g, ''));
    this._save({ totalWeeks: weeks });
    this.setData({ totalWeeksIndex: Number(e.detail.value) });
  },

  /* ---------------- 提醒设置 ---------------- */

  onAheadChange(e) {
    this._save({ aheadMinutes: Number(e.detail.value) });
    this.setData({ 'settings.aheadMinutes': Number(e.detail.value) });
  },

  onFinalChange(e) {
    this._save({ finalAheadMinutes: Number(e.detail.value) });
    this.setData({ 'settings.finalAheadMinutes': Number(e.detail.value) });
  },

  onAutoPopupChange(e) {
    this._save({ autoPopupMinutes: Number(e.detail.value) });
    this.setData({ 'settings.autoPopupMinutes': Number(e.detail.value) });
  },

  onSwitch(e) {
    const field = e.currentTarget.dataset.field;
    const value = !!e.detail.value;
    this._save({ [field]: value });
    const patch = {};
    patch['settings.' + field] = value;
    this.setData(patch);
  },

  _save(patch) {
    app.saveSettings(patch);
    this._g = app.data();
  },

  /** 立刻按当前设置演示一次提醒（会震动并弹层） */
  testRemind() {
    const g = app.data();
    const now = new Date();
    const next = S.getNextClass(g.courses, g.classrooms, g.periods, now, g.settings);
    if (!next) {
      wx.showToast({ title: '近期没有课程，无法测试', icon: 'none' });
      return;
    }
    const alert = N.fireAlert(next, g.settings, 'main');
    wx.showModal({
      title: alert.title,
      content: alert.content + '\n\n（这是测试提醒，未计入提醒记录）',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  /* ---------------- 系统日历同步 ---------------- */

  syncCalendar(e) {
    const scope = e.currentTarget.dataset.scope;
    const g = app.data();
    if (!g.courses.length) {
      wx.showToast({ title: '课表为空', icon: 'none' });
      return;
    }
    if (this.data.busy) return;
    this.setData({ busy: true });

    CAL.ensureAuth().then((ok) => {
      if (!ok) {
        this.setData({ busy: false });
        return;
      }
      wx.showLoading({ title: '正在写入日历...', mask: true });
      CAL.syncToCalendar(g.courses, g.settings, g.periods, {
        scope: scope,
        onProgress: (done, total) => {
          wx.showLoading({ title: '写入 ' + done + '/' + total, mask: true });
        },
      }).then((r) => {
        wx.hideLoading();
        app.saveSettings({ lastCalendarSync: T.formatDate(new Date()) });
        const parts = ['共 ' + r.total + ' 条', '成功 ' + r.success, '失败 ' + r.failed];
        if (r.aborted) parts.push('（日历权限被拒绝，已中断）');
        if (r.errors && r.errors.length) parts.push('原因：' + r.errors.join('；'));
        this.setData({ busy: false, syncResult: parts.join('，') });
        wx.showModal({
          title: r.success ? '同步完成' : '同步未成功',
          content: parts.join('\n') + '\n\n提示：该功能需在手机真机上使用；开发者工具不支持。',
          showCancel: false,
        });
      }).catch(() => {
        wx.hideLoading();
        this.setData({ busy: false });
        wx.showToast({ title: '同步失败', icon: 'none' });
      });
    });
  },

  /* ---------------- 订阅消息 ---------------- */

  requestSubscribe() {
    const tmpl = CFG.SERVER.subscribeTemplateId;
    if (!tmpl) {
      wx.showModal({
        title: '还没有配置模板 ID',
        content: '订阅消息（课前微信服务通知）需要先在微信公众平台申请模板，' +
          '再把模板 ID 填入 config/index.js 的 SERVER.subscribeTemplateId，并部署 server/ 目录下的推送服务。\n\n' +
          '没有后端也不影响使用：手机日历 + 打开小程序时的提醒已经能覆盖大部分场景。',
        showCancel: false,
      });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [tmpl],
      success: (res) => {
        const ok = res[tmpl] === 'accept';
        app.saveSettings({ subscribed: ok });
        this.setData({ 'settings.subscribed': ok });
        wx.showToast({ title: ok ? '已开启课前通知' : '未授权', icon: ok ? 'success' : 'none' });
      },
      fail: (err) => {
        wx.showModal({ title: '订阅失败', content: err.errMsg || '未知错误', showCancel: false });
      },
    });
  },

  pushToServer() {
    if (!api.enabled()) {
      wx.showModal({
        title: '还没有配置后端地址',
        content: '请在 config/index.js 的 SERVER.baseUrl 填写已部署的服务地址（见 server/README.md）。',
        showCancel: false,
      });
      return;
    }
    const g = app.data();
    wx.showLoading({ title: '上传中...', mask: true });
    api.pushSchedule({
      courses: g.courses,
      occupancy: g.occupancy,
      periods: g.periods,
      settings: g.settings,
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '课表已上传', icon: 'success' });
    }).catch((err) => {
      wx.hideLoading();
      wx.showModal({
        title: '上传失败',
        content: (err && (err.errMsg || JSON.stringify(err.data))) || '请检查后端地址与网络',
        showCancel: false,
      });
    });
  },

  pullFromServer() {
    if (!api.enabled()) {
      wx.showToast({ title: '未配置后端地址', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '拉取中...', mask: true });
    api.pullSchedule().then((r) => {
      wx.hideLoading();
      if (!r || !r.courses || !r.courses.length) {
        wx.showToast({ title: '服务端没有数据', icon: 'none' });
        return;
      }
      wx.showModal({
        title: '覆盖本地课表？',
        content: '服务端有 ' + r.courses.length + ' 门课，将覆盖本机课表。',
        success: (res) => {
          if (!res.confirm) return;
          app.saveCourses(r.courses);
          if (r.occupancy) app.saveOccupancy(r.occupancy);
          this._g = app.data();
          this.onShow();
          wx.showToast({ title: '已同步', icon: 'success' });
        },
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '拉取失败', icon: 'none' });
    });
  },

  /* ---------------- 数据管理 ---------------- */

  exportData() {
    const g = app.data();
    const payload = {
      version: 1,
      exportAt: new Date().toISOString(),
      courses: g.courses,
      occupancy: g.occupancy,
      classrooms: g.classrooms,
      periods: g.periods,
      settings: g.settings,
    };
    wx.setClipboardData({
      data: JSON.stringify(payload),
      success: () => {
        wx.showModal({
          title: '已复制到剪贴板',
          content: '课表数据已复制为 JSON，可粘贴到备忘录或电脑上备份。',
          showCancel: false,
        });
      },
    });
  },

  importData() {
    wx.getClipboardData({
      success: (res) => {
        let obj = null;
        try {
          obj = JSON.parse(res.data);
        } catch (e) {
          wx.showModal({ title: '格式错误', content: '剪贴板内容不是有效的 JSON 数据。', showCancel: false });
          return;
        }
        if (!obj || !obj.courses) {
          wx.showModal({ title: '数据不完整', content: '缺少 courses 字段。', showCancel: false });
          return;
        }
        wx.showModal({
          title: '导入数据？',
          content: '将导入 ' + obj.courses.length + ' 门课程' +
            (obj.occupancy ? ('、' + obj.occupancy.length + ' 条占用记录') : '') + '，会覆盖当前数据。',
          success: (r) => {
            if (!r.confirm) return;
            app.saveCourses(obj.courses);
            if (obj.occupancy) app.saveOccupancy(obj.occupancy);
            if (obj.periods && obj.periods.length) app.savePeriods(obj.periods);
            if (obj.classrooms && obj.classrooms.length) app.saveClassrooms(obj.classrooms);
            if (obj.settings) app.saveSettings(obj.settings);
            this._g = app.data();
            this.onShow();
            wx.showToast({ title: '导入成功', icon: 'success' });
          },
        });
      },
      fail: () => wx.showToast({ title: '读取剪贴板失败', icon: 'none' }),
    });
  },

  clearRemindRecords() {
    N.clearReminded();
    wx.showToast({ title: '提醒记录已清空', icon: 'success' });
  },

  clearCourses() {
    wx.showModal({
      title: '清空课表',
      content: '将删除全部课程（教室字典保留）。确定吗？',
      success: (res) => {
        if (!res.confirm) return;
        app.saveCourses([]);
        this._g = app.data();
        this.onShow();
        wx.showToast({ title: '已清空', icon: 'success' });
      },
    });
  },

  restoreDemo() {
    wx.showModal({
      title: '恢复示例数据',
      content: '会用示例课表和示例教室占用表覆盖当前数据。',
      success: (res) => {
        if (!res.confirm) return;
        app.restoreDemo();
        this._g = app.data();
        this.onShow();
        wx.showToast({ title: '已恢复示例', icon: 'success' });
      },
    });
  },

  gotoEdit() {
    wx.navigateTo({ url: '/pages/course-edit/course-edit' });
  },

  showHelp() {
    wx.showModal({
      title: '使用说明',
      content: '1) 在「课表-批量导入」粘贴自己的课表；\n' +
        '2) 设置开学日期（第 1 周周一），周次才准确；\n' +
        '3) 打开小程序会自动提醒最近一节课，建议每学期点一次「同步到手机日历」，这样不打开小程序也会响；\n' +
        '4) 空教室查询默认只用你的课表推算，导入全校占用数据后才准确；\n' +
        '5) 教室字典在 data/classrooms.js，可自行增删。',
      showCancel: false,
    });
  },

  noop() {},
});
