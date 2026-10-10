const app = getApp();
const CFG = require('../../config/index');
const T = require('../../utils/time');
const S = require('../../utils/schedule');
const importer = require('../../utils/importer');
const FI = require('../../utils/file-import');
const CLS = require('../../utils/classroom');

const DAY_OPTIONS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const PARITY_OPTIONS = ['每周', '单周', '双周'];
const PARITY_VALUE = ['all', 'odd', 'even'];

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

Page({
  data: {
    tab: 'list',
    groups: [],
    total: 0,
    conflictText: '',

    roomOptions: [],
    dayOptions: DAY_OPTIONS,
    periodOptions: [],
    parityOptions: PARITY_OPTIONS,
    weekOptions: [],
    colors: CFG.COLORS,

    form: {
      show: false,
      isEdit: false,
      id: '',
      name: '',
      teacher: '',
      note: '',
      roomIndex: 0,
      dayIndex: 0,
      startIndex: 0,
      endIndex: 1,
      weekStartIndex: 0,
      weekEndIndex: 15,
      parityIndex: 0,
      colorIndex: 0,
    },

    importText: '',
    importPreview: [],
    importMessage: '',
    fileInfo: { name: '', path: '', sizeText: '' },
    fileMessage: '',
    fileMessageType: '',
    parsing: false,
    unknownRooms: [],
    unknownRoomText: '',
  },

  _g: null,

  onLoad(options) {
    this._g = app.data();
    this.initOptions();
    this.renderList();
    if (options && options.id) this.openEdit(options.id);
  },

  onShow() {
    this._g = app.data();
    this.renderList();
  },

  initOptions() {
    const g = this._g;
    const roomOptions = g.classrooms.map(function (r) {
      return (r.building ? r.building + ' ' : '') + r.name;
    });
    const periodOptions = g.periods.map(function (p) {
      return '第 ' + p.period + ' 节（' + p.start + '）';
    });
    const weekOptions = [];
    for (let i = 1; i <= (g.settings.totalWeeks || 20); i++) weekOptions.push('第 ' + i + ' 周');
    this.setData({ roomOptions: roomOptions, periodOptions: periodOptions, weekOptions: weekOptions });
  },

  renderList() {
    const g = this._g;
    const groups = [];
    for (let d = 1; d <= 7; d++) {
      const list = g.courses.filter(function (c) { return Number(c.day) === d; })
        .sort(function (a, b) { return a.start - b.start; });
      if (!list.length) continue;
      const courses = list.map(function (c) {
        const t = S.periodRange(g.periods, c.start, c.end);
        const known = !!S.roomOf(c.roomId, g.classrooms);
        return {
          id: c.id,
          name: c.name,
          teacher: c.teacher,
          roomId: c.roomId,
          unknownRoom: !known,
          color: c.color,
          periodText: S.formatPeriods(c.start, c.end),
          timeText: t.start + '-' + t.end,
          weekText: S.formatWeeks(c.weeks),
          note: c.note,
        };
      });
      groups.push({ day: d, label: T.WEEK_NAMES[d], courses: courses });
    }
    const conflicts = S.detectConflicts(g.courses);
    this.setData({
      groups: groups,
      total: g.courses.length,
      conflictText: conflicts.length ? ('检测到 ' + conflicts.length + ' 处冲突：' + conflicts[0].message) : '',
    });
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  /* ---------------- 表单 ---------------- */

  openAdd() {
    const g = this._g;
    this.setData({
      form: {
        show: true, isEdit: false, id: '', name: '', teacher: '', note: '',
        roomIndex: 0, dayIndex: 0, startIndex: 0, endIndex: 1,
        weekStartIndex: 0, weekEndIndex: Math.max(0, (g.settings.totalWeeks || 20) - 5),
        parityIndex: 0, colorIndex: 0,
      },
    });
  },

  openEdit(id) {
    const g = this._g;
    let c = null;
    for (let i = 0; i < g.courses.length; i++) {
      if (g.courses[i].id === id) { c = g.courses[i]; break; }
    }
    if (!c) return;
    let roomIndex = 0;
    for (let i = 0; i < g.classrooms.length; i++) {
      if (g.classrooms[i].id === c.roomId) { roomIndex = i; break; }
    }
    let startIndex = 0;
    let endIndex = 0;
    for (let i = 0; i < g.periods.length; i++) {
      if (g.periods[i].period === c.start) startIndex = i;
      if (g.periods[i].period === c.end) endIndex = i;
    }
    const w = S.normalizeWeeks(c.weeks);
    const colorIndex = Math.max(0, CFG.COLORS.indexOf(c.color));
    this.setData({
      form: {
        show: true, isEdit: true, id: c.id,
        name: c.name, teacher: c.teacher || '', note: c.note || '',
        roomIndex: roomIndex,
        dayIndex: Number(c.day) - 1,
        startIndex: startIndex,
        endIndex: endIndex,
        weekStartIndex: Math.max(0, w.start - 1),
        weekEndIndex: Math.max(0, w.end - 1),
        parityIndex: Math.max(0, PARITY_VALUE.indexOf(w.parity)),
        colorIndex: colorIndex,
      },
    });
  },

  closeForm() {
    this.setData({ 'form.show': false });
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['form.' + field] = e.detail.value;
    this.setData(patch);
  },

  onFormPicker(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['form.' + field] = Number(e.detail.value);
    this.setData(patch);
  },

  pickColor(e) {
    this.setData({ 'form.colorIndex': Number(e.currentTarget.dataset.index) });
  },

  onParityTap(e) {
    this.setData({ 'form.parityIndex': Number(e.currentTarget.dataset.index) });
  },

  saveForm() {
    const g = this._g;
    const f = this.data.form;
    if (!f.name || !f.name.trim()) {
      wx.showToast({ title: '请填写课程名', icon: 'none' });
      return;
    }
    if (f.startIndex > f.endIndex) {
      wx.showToast({ title: '结束节次不能早于起始节次', icon: 'none' });
      return;
    }
    if (f.weekStartIndex > f.weekEndIndex) {
      wx.showToast({ title: '结束周不能早于起始周', icon: 'none' });
      return;
    }
    const room = g.classrooms[f.roomIndex];
    const course = {
      id: f.isEdit ? f.id : ('c_' + Date.now()),
      name: f.name.trim(),
      teacher: (f.teacher || '').trim(),
      note: (f.note || '').trim(),
      roomId: room ? room.id : '',
      day: f.dayIndex + 1,
      start: g.periods[f.startIndex].period,
      end: g.periods[f.endIndex].period,
      weeks: {
        start: f.weekStartIndex + 1,
        end: f.weekEndIndex + 1,
        parity: PARITY_VALUE[f.parityIndex] || 'all',
      },
      color: CFG.COLORS[f.colorIndex],
    };
    const list = g.courses.slice();
    let found = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === course.id) { list[i] = course; found = true; break; }
    }
    if (!found) list.push(course);
    app.saveCourses(list);
    this._g = app.data();
    this.renderList();
    this.setData({ 'form.show': false });
    wx.showToast({ title: found ? '已保存' : '已添加', icon: 'success' });
  },

  deleteCourse(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除课程',
      content: '删除后不可恢复，确定继续吗？',
      success: (res) => {
        if (!res.confirm) return;
        const g = this._g;
        const list = g.courses.filter(function (c) { return c.id !== id; });
        app.saveCourses(list);
        this._g = app.data();
        this.renderList();
        wx.showToast({ title: '已删除', icon: 'success' });
      },
    });
  },

  /* ---------------- 从文件导入（Excel / Word / CSV） ---------------- */

  /** 从微信聊天记录里选一个课表文件 */
  chooseFile() {
    const self = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls', 'docx', 'doc', 'csv', 'txt'],
      success: function (res) {
        const f = (res.tempFiles || [])[0];
        if (!f) return;
        self.setData({
          fileInfo: {
            name: f.name || '未命名文件',
            path: f.path,
            sizeText: formatSize(f.size),
          },
          fileMessage: '',
          fileMessageType: '',
          importPreview: [],
          importMessage: '',
        });
        self.parseFile();
      },
      fail: function (err) {
        const msg = (err && (err.errMsg || err.errmsg)) || '';
        if (/cancel|取消/i.test(msg)) return;
        wx.showModal({
          title: '选择文件失败',
          content: msg || '请确认已授权，或在真机上从微信聊天记录中选择文件。',
          showCancel: false,
        });
      },
    });
  },

  /** 解析已选中的文件 */
  parseFile() {
    const info = this.data.fileInfo;
    if (!info.path) return;
    if (this.data.parsing) return;

    const g = this._g;
    this.setData({ parsing: true });
    wx.showLoading({ title: '正在解析...', mask: true });

    const self = this;
    // 让 loading 先渲染出来，再做同步解析
    setTimeout(function () {
      let r;
      try {
        r = FI.importFromPath(info.path, info.name, {
          classrooms: g.classrooms,
          periods: g.periods,
          totalWeeks: g.settings.totalWeeks,
        });
      } catch (e) {
        r = { ok: false, error: '解析异常：' + (e.message || String(e)) };
      }
      wx.hideLoading();
      self.setData({ parsing: false });
      self.applyFileResult(r);
    }, 60);
  },

  /** 展示解析结果
   *  @param {Object} r      file-import / importer 的统一结果
   *  @param {Object} opts   { fileMessage:false } 时把提示放到预览区而不是文件卡片
   */
  applyFileResult(r, opts) {
    const showMsg = !opts || opts.fileMessage !== false;

    if (!r || !r.ok) {
      this._parsed = null;
      const err = (r && r.error) || '解析失败';
      this.setData(showMsg
        ? { fileMessage: err, fileMessageType: 'error', importPreview: [], importMessage: '',
            unknownRooms: [], unknownRoomText: '' }
        : { fileMessage: '', fileMessageType: '', importPreview: [], importMessage: err,
            unknownRooms: [], unknownRoomText: '' });
      return;
    }

    const preview = r.courses.slice(0, 60).map(function (c, idx) {
      const warns = (c.warnings || []).filter(Boolean);
      return {
        idx: idx + 1,
        name: c.name,
        day: T.WEEK_NAMES[c.day] || '',
        periodText: S.formatPeriods(c.start, c.end),
        roomId: c.roomId || '未识别',
        roomMissing: !c.roomId,
        weekText: S.formatWeeks(c.weeks),
        teacher: c.teacher || '',
        confidence: Math.round((c._confidence === undefined ? 1 : c._confidence) * 100),
        warnings: warns.join('；'),
        hasWarning: warns.length > 0,
      };
    });

    const layoutText = { list: '列表式', grid: '课表网格', text: '文本行', empty: '空表' }[r.layout] || r.layout;
    const parts = ['✓ 识别出 ' + r.courses.length + ' 门课程（布局：' + layoutText + '）'];

    // 把智能识别的依据告诉用户，避免"黑箱"感
    const rc = r.recognize;
    if (rc && rc.method) {
      parts.push('🔍 ' + rc.method);
      if (rc.source === 'content' && rc.inferred && rc.inferred.columns) {
        const cnName = {
          name: '课程名', day: '星期', period: '节次', time: '时间',
          room: '教室', weeks: '周次', teacher: '教师', className: '班级',
        };
        const cols = rc.inferred.columns;
        const list = Object.keys(cols).map(function (f) {
          return (cnName[f] || f) + '=第' + (cols[f] + 1) + '列';
        });
        parts.push('   无表头，按列内容推断：' + list.join('、'));
      }
      if (rc.confidence) {
        parts.push('   字段完整度：' + Math.round(rc.confidence * 100) + '%');
      }
    }

    if (r.usedSheet) parts.push('使用工作表：' + r.usedSheet);
    if (r.unknownRooms && r.unknownRooms.length) {
      parts.push('⚠ 教室字典中没有：' + r.unknownRooms.join('、') + '\n  （这些教室不会出现在空教室结果里）');
    }
    (r.warnings || []).forEach(function (w) { parts.push('· ' + w); });
    if (r.courses.length > 60) parts.push('· 预览只显示前 60 条，导入时会全部写入');

    this._parsed = r.courses;
    const unknown = r.unknownRooms || [];
    const patch = {
      importPreview: preview,
      importMessage: '共 ' + r.courses.length + ' 门课程，确认无误后点下方按钮写入课表',
      unknownRooms: unknown,
      unknownRoomText: unknown.join('、'),
    };
    if (showMsg) {
      patch.fileMessage = parts.join('\n');
      patch.fileMessageType = 'ok';
    } else {
      patch.fileMessage = '';
      patch.fileMessageType = '';
    }
    this.setData(patch);
  },

  clearFile() {
    this._parsed = null;
    this.setData({
      fileInfo: { name: '', path: '', sizeText: '' },
      fileMessage: '',
      fileMessageType: '',
      importPreview: [],
      importMessage: '',
      unknownRooms: [],
      unknownRoomText: '',
    });
  },

  /**
   * 把课表里出现、但教室字典里没有的教室补进字典。
   * 不做这一步，这些教室不会出现在「空教室」查询结果里。
   */
  addUnknownRooms() {
    const list = this.data.unknownRooms || [];
    if (!list.length) return;

    const g = this._g || app.data();
    const classrooms = g.classrooms.slice();
    const existing = {};
    classrooms.forEach(function (r) { existing[r.id] = 1; });

    let added = 0;
    for (let i = 0; i < list.length; i++) {
      if (existing[list[i]]) continue;
      const room = CLS.guessClassroom(list[i]);
      if (!room) continue;
      classrooms.push(room);
      existing[list[i]] = 1;
      added++;
    }

    app.saveClassrooms(classrooms);
    this._g = app.data();
    this.initOptions();
    this.setData({ unknownRooms: [], unknownRoomText: '' });
    wx.showToast({ title: added ? ('已加入 ' + added + ' 间教室') : '无需补充', icon: 'success' });
  },

  /* ---------------- 粘贴文本导入 ---------------- */

  onImportInput(e) {
    this.setData({ importText: e.detail.value });
  },

  parseImport() {
    const g = this._g;
    const r = importer.parseText(this.data.importText || '', g.classrooms);

    const courses = r.courses.map(function (c) {
      return {
        name: c.name, teacher: c.teacher || '', roomId: c.roomId || '',
        day: c.day, start: c.start, end: c.end, weeks: c.weeks, warnings: [],
      };
    });

    const warnings = [];
    if (r.errors.length) {
      warnings.push('有 ' + r.errors.length + ' 行无法识别，已跳过（第 ' +
        r.errors[0].line + ' 行：' + r.errors[0].error + '）');
    }

    this.applyFileResult({
      ok: courses.length > 0,
      layout: 'text',
      courses: courses,
      warnings: warnings,
      unknownRooms: r.unknownRooms || [],
      error: '没有解析出任何课程。\n每行格式：课程名,星期,起始节,结束节,教室,周次\n例如：高等数学(上),周一,1,2,A301,1-16',
    }, { fileMessage: false });
  },

  doImport() {
    if (!this._parsed || !this._parsed.length) {
      wx.showToast({ title: '请先解析课表', icon: 'none' });
      return;
    }
    const self = this;
    wx.showActionSheet({
      itemList: ['追加到现有课表', '替换整个课表'],
      success: function (res) {
        const g = self._g;
        const stamped = self._parsed.map(function (c, i) {
          return Object.assign({}, c, { id: 'imp_' + Date.now() + '_' + i });
        });
        let list;
        if (res.tapIndex === 0) list = g.courses.concat(stamped);
        else if (res.tapIndex === 1) list = stamped;
        else return;

        app.saveCourses(list);
        self._g = app.data();
        self._parsed = null;
        self.renderList();
        self.setData({
          tab: 'list',
          importPreview: [],
          importMessage: '',
          importText: '',
          fileInfo: { name: '', path: '', sizeText: '' },
          fileMessage: '',
          fileMessageType: '',
          unknownRooms: [],
          unknownRoomText: '',
        });
        wx.showToast({ title: '导入完成', icon: 'success' });
      },
    });
  },

  useSample() {
    this.setData({
      importText: [
        '# 每行一条：课程名,星期,起始节,结束节,教室,周次',
        '高等数学(上),周一,1,2,A301,1-16',
        '大学英语,周一,3,4,A401,1-16',
        '程序设计基础,周三,5,6,A301,1-16',
        '数据结构,周三,7,8,B301,1-16',
        '大学物理,周四,3,4,A201,1-16',
        '计算机网络,周五,1,2,B201,1-16',
      ].join('\n'),
    });
  },

  noop() {},
});
