/**
 * 智能课表 · 网页版主应用
 * ---------------------------------------------------------------
 * 数据与算法来自 miniprogram（经 tools/build-web.js 打包成 SS 命名空间），
 * 这一层只负责：浏览器存储、DOM 渲染、事件、提醒、路由。
 */
(function () {
  'use strict';

  var SS = window.SS;
  var T = SS.time, S = SS.schedule, C = SS.classroom, N = SS.notify;
  var FI = SS.fileImport, ST = SS.storage, CFG = SS.config, ICS = SS.ics;
  var UI = window.UI;

  /* ============================================================
     一、数据层
     ============================================================ */

  function defaultSettings() {
    return {
      aheadMinutes: CFG.REMIND.aheadMinutes,
      finalAheadMinutes: CFG.REMIND.finalAheadMinutes,
      autoPopupMinutes: CFG.REMIND.autoPopupMinutes,
      vibrate: true,
      sound: true,
      popup: true,
      termName: CFG.TERM.name,
      termStartDate: CFG.TERM.startDate,
      totalWeeks: CFG.TERM.totalWeeks,
      notifyEnabled: false,
      lastCalendarSync: '',
    };
  }

  var data = {
    courses: [],
    classrooms: [],
    occupancy: [],
    periods: [],
    settings: defaultSettings(),
  };

  function initStorage() {
    if (ST.get(ST.KEYS.INITED, false)) return;
    ST.set(ST.KEYS.COURSES, S.normalizeAll(SS.courses.COURSES));
    ST.set(ST.KEYS.CLASSROOMS, SS.classrooms.CLASSROOMS);
    ST.set(ST.KEYS.OCCUPANCY, S.normalizeAll(SS.occupancy.OCCUPANCY));
    ST.set(ST.KEYS.PERIODS, SS.periods.DEFAULT_PERIODS);
    ST.set(ST.KEYS.SETTINGS, defaultSettings());
    ST.set(ST.KEYS.INITED, true);
  }

  function loadData() {
    data.courses = ST.get(ST.KEYS.COURSES, []) || [];
    data.classrooms = ST.get(ST.KEYS.CLASSROOMS, SS.classrooms.CLASSROOMS) || SS.classrooms.CLASSROOMS;
    data.occupancy = ST.get(ST.KEYS.OCCUPANCY, []) || [];
    data.periods = ST.get(ST.KEYS.PERIODS, SS.periods.DEFAULT_PERIODS) || SS.periods.DEFAULT_PERIODS;
    data.settings = ST.getSettings(defaultSettings());
    return data;
  }

  function saveCourses(list) {
    var normalized = S.normalizeAll(list);
    ST.set(ST.KEYS.COURSES, normalized);
    data.courses = normalized;
    return normalized;
  }

  function saveClassrooms(list) {
    ST.set(ST.KEYS.CLASSROOMS, list);
    data.classrooms = list;
  }

  function saveSettings(patch) {
    data.settings = Object.assign({}, data.settings, patch);
    ST.set(ST.KEYS.SETTINGS, data.settings);
    return data.settings;
  }

  function restoreDemo() {
    saveCourses(SS.courses.COURSES);
    saveClassrooms(SS.classrooms.CLASSROOMS);
    ST.set(ST.KEYS.OCCUPANCY, S.normalizeAll(SS.occupancy.OCCUPANCY));
    data.occupancy = ST.get(ST.KEYS.OCCUPANCY, []);
    saveSettings(defaultSettings());
  }

  /* ============================================================
     二、工具
     ============================================================ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return UI.esc(s); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function hms(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(total / 3600)) + ':' + pad(Math.floor((total % 3600) / 60)) + ':' + pad(total % 60);
  }

  function todayStr() { return T.formatDate(new Date()); }

  function currentWeek() {
    var w = T.getWeekIndex(new Date(), data.settings.termStartDate);
    return Math.max(1, Math.min(w, data.settings.totalWeeks || 20));
  }

  var FACILITY_LABEL = { socket: '插座', ac: '空调', projector: '投影', accessible: '无障碍' };

  function capacityText(n) { return n > 0 ? n + ' 座' : '座位未知'; }

  function roomMeta(r) {
    var parts = [];
    if (r.building) parts.push(r.building);
    if (r.floor) parts.push(r.floor + ' 楼');
    parts.push(capacityText(r.capacity));
    if (r.typeLabel) parts.push(r.typeLabel);
    return parts.join(' · ');
  }

  /* ============================================================
     三、路由与渲染入口
     ============================================================ */

  var view = {
    tab: 'today',
    week: 0,
    showWeekend: false,
    room: {
      date: todayStr(),
      startIndex: 0,
      endIndex: 1,
      building: '',
      capacity: 0,
      onlyStudy: true,
      facilities: [],
      sort: 'building',
    },
    importPreview: null,
    importFile: null,
  };

  var RENDERERS = {
    today: renderToday,
    timetable: renderTimetable,
    classroom: renderClassroom,
    import: renderImport,
    settings: renderSettings,
  };

  function render() {
    var fn = RENDERERS[view.tab] || renderToday;
    stopTick();
    $('#view').innerHTML = '';
    fn();
    syncTabbar();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function go(tab) {
    if (!RENDERERS[tab]) return;
    view.tab = tab;
    if (location.hash !== '#/' + tab) {
      try { history.replaceState(null, '', '#/' + tab); } catch (e) { location.hash = '#/' + tab; }
    }
    render();
  }

  function syncTabbar() {
    $$('#tabbar .tab').forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === view.tab;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    // 「导入」不是独立 tab，挂在课表页里；进入导入时点亮课表
    if (view.tab === 'import') {
      var tb = $('#tabbar .tab[data-tab="timetable"]');
      if (tb) tb.setAttribute('aria-selected', 'true');
    }
  }

  /* ============================================================
     四、今日视图
     ============================================================ */

  var tickTimer = null;
  var lastMinute = -1;

  function renderToday() {
    var now = new Date();
    var settings = data.settings;
    var timeline = S.buildTimeline(data.courses, data.classrooms, data.periods, now, settings);
    var next = S.getNextClass(data.courses, data.classrooms, data.periods, now, settings);
    var current = S.getCurrentClass(data.courses, data.classrooms, data.periods, now, settings);

    var html = '';
    html += heroHtml(now, current, next);
    html += studyHtml(now);
    html += timelineHtml(timeline);
    html += freeSlotsHtml(timeline);

    if (!data.courses.length) {
      html += '<div class="card"><div class="empty">还没有课表<br><button class="btn btn-primary mt12" data-action="go-import">导入课表</button></div></div>';
    }

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    $('#view').appendChild(wrap);

    startTick();
    maybeDailyBrief(timeline);
    checkRemind();
  }

  function heroHtml(now, current, next) {
    var week = T.getWeekIndex(now, data.settings.termStartDate);
    var weekText = '第 ' + Math.max(1, week) + ' 周';
    var dateLabel = T.humanDate(now);

    var mode = 'idle';
    var label = '';
    var lesson = null;
    var clock = '--:--:--';

    if (current) {
      mode = 'during';
      label = '正在上课 · 距离下课';
      lesson = {
        name: current.course.name,
        room: current.room,
        periodText: S.formatPeriods(current.course.start, current.course.end),
        startTime: current.startTime,
        endTime: current.endTime,
        teacher: current.course.teacher,
      };
      clock = hms(current.endAt.getTime() - now.getTime());
    } else if (next) {
      mode = next.isToday ? 'before' : 'idle';
      label = next.isToday ? '距离上课还有' : '下一节课在 ' + next.dateLabel;
      lesson = {
        name: next.course.name,
        room: next.room,
        periodText: next.periodText,
        startTime: next.startTime,
        endTime: next.endTime,
        teacher: next.course.teacher,
      };
      clock = hms(next.startAt.getTime() - now.getTime());
    }

    var html = '<section class="hero ' + mode + '" id="hero">';
    html += '<div class="hero-top"><span>' + esc(dateLabel) + '</span><span>' + esc(weekText) + '</span></div>';
    html += '<div class="hero-label" id="hero-label">' + esc(label || '近期没有课程安排') + '</div>';
    html += '<div class="hero-count" id="hero-clock">' + clock + '</div>';

    if (lesson) {
      html += '<div class="hero-course">' +
        '<div class="hero-name">' + esc(lesson.name) + '</div>' +
        '<div class="hero-meta">' + esc(lesson.periodText) + ' · ' + esc(lesson.startTime) + '-' + esc(lesson.endTime) + '</div>' +
        '<div class="hero-room">📍 ' + esc(lesson.room) + (lesson.teacher ? ' · ' + esc(lesson.teacher) : '') + '</div>' +
        '</div>';
      html += '<div class="hero-actions">' +
        '<button class="hero-btn" data-action="copy-room">复制教室</button>' +
        '<button class="hero-btn" data-action="export-ics">导出日历</button>' +
        '<button class="hero-btn" data-action="go-classroom">找空教室</button>' +
        '</div>';
    } else {
      html += '<div class="hero-actions">' +
        '<button class="hero-btn" data-action="go-import">导入课表</button>' +
        '<button class="hero-btn" data-action="go-classroom">找空教室</button>' +
        '</div>';
    }
    html += '</section>';
    return html;
  }

  function studyHtml(now) {
    var stu;
    try {
      stu = C.queryFreeRoomsNow({
        courses: data.courses, occupancy: data.occupancy, classrooms: data.classrooms,
        periods: data.periods, settings: data.settings, span: 2, onlyStudy: true,
        sort: 'freespan', now: now,
      });
    } catch (e) {
      return '';
    }
    if (!stu || !stu.free.length) return '';
    var rooms = stu.free.slice(0, 3);

    var html = '<section class="card"><div class="card-title"><span>现在去哪自习</span>' +
      '<span class="sub">' + esc(stu.periodText) + ' 空</span></div>';
    rooms.forEach(function (r) {
      html += '<div class="line"><div class="grow"><div class="strong">' + esc(r.name) + '</div>' +
        '<div class="tiny muted mt8">' + esc(roomMeta(r)) + '</div></div>' +
        '<span class="tag tag-green">' + esc(r.freeSpanText) + '</span></div>';
    });
    html += '<button class="btn btn-ghost mt12" data-action="go-classroom">查看全部空教室</button></section>';
    return html;
  }

  function timelineHtml(timeline) {
    var html = '<section class="card"><div class="card-title"><span>今日课程</span>' +
      '<span class="sub">共 ' + timeline.courses.length + ' 节</span></div>';
    if (!timeline.courses.length) {
      html += '<div class="empty">今天没有课，去自习吧</div>';
    }
    timeline.courses.forEach(function (c, i) {
      html += '<div class="line ' + (c.status === 'done' ? 'done' : '') + '">' +
        '<div class="tl-time">' + esc(c.startTime) + '<div class="end">' + esc(c.endTime) + '</div></div>' +
        '<div class="line-dot" style="background:' + esc(c.color) + '"></div>' +
        '<div class="grow"><div class="strong ellipsis">' + esc(c.name) + '</div>' +
        '<div class="tiny muted">' + esc(c.periodText) + ' · ' + esc(c.room) + '</div>' +
        (c.note ? '<div class="tiny muted">📌 ' + esc(c.note) + '</div>' : '') + '</div>' +
        '<span class="tl-status ' + esc(c.status) + '">' + esc(c.statusText) + '</span>' +
        '</div>';
    });
    html += '</section>';
    return html;
  }

  function freeSlotsHtml(timeline) {
    if (!timeline.freeSlots.length) return '';
    var html = '<section class="card"><div class="card-title"><span>今日空堂</span><span class="sub">没课的时间段</span></div>';
    timeline.freeSlots.forEach(function (s) {
      html += '<div class="line"><div class="grow"><div class="strong">' + esc(s.periodText) + '</div>' +
        '<div class="tiny muted">' + esc(s.startTime) + ' - ' + esc(s.endTime) + '</div></div>' +
        '<span class="tag tag-orange">空</span></div>';
    });
    html += '<button class="btn btn-ghost mt12" data-action="go-classroom">这些时段哪间教室空着</button></section>';
    return html;
  }

  /* ---------------- 倒计时与提醒 ---------------- */

  function startTick() {
    stopTick();
    tick();
    tickTimer = setInterval(tick, 1000);
  }
  function stopTick() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  function tick() {
    if (view.tab !== 'today') return;
    var now = new Date();
    var clockEl = $('#hero-clock');
    if (!clockEl) return;

    var current = S.getCurrentClass(data.courses, data.classrooms, data.periods, now, data.settings);
    var next = S.getNextClass(data.courses, data.classrooms, data.periods, now, data.settings);
    var labelEl = $('#hero-label');
    var heroEl = $('#hero');

    if (current) {
      clockEl.textContent = hms(current.endAt.getTime() - now.getTime());
      if (labelEl) labelEl.textContent = '正在上课 · 距离下课';
      if (heroEl) heroEl.className = 'hero during';
    } else if (next) {
      clockEl.textContent = hms(next.startAt.getTime() - now.getTime());
      if (labelEl) labelEl.textContent = next.isToday ? '距离上课还有' : '下一节课在 ' + next.dateLabel;
      if (heroEl) heroEl.className = 'hero ' + (next.isToday ? 'before' : 'idle');
    } else {
      clockEl.textContent = '--:--:--';
      if (labelEl) labelEl.textContent = '近期没有课程安排';
    }

    // 每分钟检查一次是否需要整页刷新（跨节次、跨天）
    var minute = now.getHours() * 60 + now.getMinutes();
    if (lastMinute !== -1 && minute !== lastMinute) {
      lastMinute = minute;
      render();
      return;
    }
    lastMinute = minute;

    // 每 15 秒检查提醒
    if (now.getSeconds() % 15 === 0) checkRemind();
  }

  var remindedThisSession = {};

  function checkRemind() {
    var r = N.checkAndRemind(data.courses, data.classrooms, data.periods, data.settings, { now: new Date() });
    if (!r.alert) return;
    showReminder(r.alert);
  }

  function showReminder(alert) {
    // 页面内红色横幅
    var banner = document.createElement('div');
    banner.className = 'alert-banner';
    banner.setAttribute('data-reminder', '1');
    banner.innerHTML = '<div class="t">' + esc(alert.title) + '</div>' +
      '<div class="small mt8" style="white-space:pre-line">' + esc(alert.content) + '</div>' +
      '<button class="btn btn-sm mt12" style="background:rgba(255,255,255,.22);color:#fff" data-action="dismiss-alert">知道了</button>';
    var viewEl = $('#view');
    if (viewEl.firstChild) viewEl.insertBefore(banner, viewEl.firstChild);
    else viewEl.appendChild(banner);

    // 浏览器通知
    if (data.settings.notifyEnabled && window.Notification && Notification.permission === 'granted') {
      try {
        new Notification(alert.title, { body: alert.content, tag: 'ss-reminder', renotify: true });
      } catch (e) { /* ignore */ }
    }
    // 震动 + 声音已由 notify.fireAlert 通过 shim 触发
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  var briefShownFor = '';

  function maybeDailyBrief(timeline) {
    if (!timeline.courses.length) return;
    var key = 'brief:' + todayStr();
    if (briefShownFor === key) return;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    briefShownFor = key;
  }

  /* ============================================================
     五、课表视图
     ============================================================ */

  function renderTimetable() {
    var week = view.week || currentWeek();
    view.week = week;
    var dayCount = view.showWeekend ? 7 : 5;
    var dates = T.weekDates(week, data.settings.termStartDate);
    var periods = data.periods;
    var today = new Date();
    var todayIndex = T.getDayOfWeek(today);
    var isCurrentWeek = week === T.getWeekIndex(today, data.settings.termStartDate);

    var html = '<section class="card">';
    html += '<div class="week-bar">' +
      '<button class="week-nav" data-action="week-prev">‹ 上周</button>' +
      '<div class="week-title">第 ' + week + ' 周 · ' +
      (dates[0].getMonth() + 1) + '/' + dates[0].getDate() + ' - ' +
      (dates[dayCount - 1].getMonth() + 1) + '/' + dates[dayCount - 1].getDate() + '</div>' +
      '<button class="week-nav" data-action="week-next">下周 ›</button></div>';

    html += '<div class="chips" style="margin-bottom:12px">' +
      '<button class="chip ' + (view.showWeekend ? '' : 'active') + '" data-action="toggle-weekend">只看周一~周五</button>' +
      '<button class="chip" data-action="week-now">回到本周</button>' +
      '<button class="chip" data-action="go-import">导入 / 编辑</button>' +
      '</div>';

    html += '<div class="tt-grid" style="grid-template-columns:40px repeat(' + dayCount + ',minmax(0,1fr))">';

    // 表头
    html += '<div class="tt-head"></div>';
    for (var d = 1; d <= dayCount; d++) {
      var dt = dates[d - 1];
      var isToday = isCurrentWeek && d === todayIndex;
      html += '<div class="tt-head' + (isToday ? ' today' : '') + '">' +
        '<b>' + T.WEEK_SHORT[d] + '</b><span>' + (dt.getMonth() + 1) + '/' + dt.getDate() + '</span></div>';
    }

    // 节次列 + 空格
    for (var p = 0; p < periods.length; p++) {
      var period = periods[p];
      html += '<div class="tt-period" style="grid-row:' + (p + 2) + ';grid-column:1">' +
        '<b>' + period.period + '</b><span>' + esc(period.start) + '</span></div>';
      for (var dd = 1; dd <= dayCount; dd++) {
        html += '<button class="tt-cell" style="grid-row:' + (p + 2) + ';grid-column:' + (dd + 1) + ';z-index:1"' +
          ' data-action="cell" data-day="' + dd + '" data-period="' + period.period + '"' +
          ' aria-label="第' + period.period + '节 周' + T.WEEK_SHORT[dd] + '"></button>';
      }
    }

    // 课程块
    data.courses.forEach(function (course) {
      if (course.day > dayCount) return;
      if (!S.isWeekActive(course, week, data.settings.totalWeeks)) return;
      var startIdx = 0;
      for (var i = 0; i < periods.length; i++) if (periods[i].period === course.start) startIdx = i;
      var span = 0;
      for (var k = 0; k < periods.length; k++) {
        if (periods[k].period >= course.start && periods[k].period <= course.end) span++;
      }
      span = Math.max(1, span);
      var t = S.periodRange(periods, course.start, course.end);
      html += '<button class="tt-block" style="grid-row:' + (startIdx + 2) + ' / span ' + span +
        ';grid-column:' + (course.day + 1) + ';background:' + esc(course.color) + '"' +
        ' data-action="course" data-id="' + esc(course.id) + '">' +
        '<div class="nm">' + esc(course.name) + '</div>' +
        '<div class="rm">' + esc(course.roomId || '') + '</div></button>';
    });

    html += '</div>';
    html += '<div class="tiny muted mt12" style="text-align:center">点空白格 → 看该时段空教室；点课程块 → 看详情</div>';
    html += '</section>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    $('#view').appendChild(wrap);
  }

  /* ============================================================
     六、空教室视图
     ============================================================ */

  function renderClassroom() {
    var rv = view.room;
    var periods = data.periods;
    if (!rv.date) rv.date = todayStr();

    if (rv.startIndex >= periods.length) rv.startIndex = 0;
    if (rv.endIndex >= periods.length) rv.endIndex = Math.min(1, periods.length - 1);

    var startPeriod = periods[rv.startIndex].period;
    var endPeriod = periods[rv.endIndex].period;

    var res = C.queryFreeRooms({
      date: rv.date, startPeriod: startPeriod, endPeriod: endPeriod,
      courses: data.courses, occupancy: data.occupancy, classrooms: data.classrooms,
      periods: periods, settings: data.settings,
      building: rv.building, minCapacity: rv.capacity,
      onlyStudy: rv.onlyStudy, facilities: rv.facilities, sort: rv.sort,
    });

    var d = T.parseDate(rv.date);
    var week = T.getWeekIndex(d, data.settings.termStartDate);
    var dayName = T.WEEK_NAMES[T.getDayOfWeek(d)];

    var html = '';

    // 日期与节次
    html += '<section class="card">';
    html += '<div class="chips">';
    [{ label: '今天', off: 0 }, { label: '明天', off: 1 }, { label: '后天', off: 2 }].forEach(function (x) {
      var ds = T.formatDate(T.addDays(new Date(), x.off));
      html += '<button class="chip ' + (ds === rv.date ? 'active' : '') + '" data-action="room-date" data-date="' + ds + '">' + x.label + '</button>';
    });
    html += '<button class="chip" data-action="room-date-pick">📅 ' + (d.getMonth() + 1) + '月' + d.getDate() + '日</button>';
    html += '</div>';

    html += '<div class="row gap8 mt12">';
    html += '<select class="select grow" data-action="room-start">';
    periods.forEach(function (p, i) {
      html += '<option value="' + i + '"' + (i === rv.startIndex ? ' selected' : '') + '>起：第 ' + p.period + ' 节</option>';
    });
    html += '</select>';
    html += '<select class="select grow" data-action="room-end">';
    periods.forEach(function (p, i) {
      html += '<option value="' + i + '"' + (i === rv.endIndex ? ' selected' : '') + '>止：第 ' + p.period + ' 节</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="chips mt12">';
    html += '<button class="chip" data-action="room-now">现在</button>';
    html += '<button class="chip" data-action="room-quick" data-key="morning">上午</button>';
    html += '<button class="chip" data-action="room-quick" data-key="afternoon">下午</button>';
    html += '<button class="chip" data-action="room-quick" data-key="evening">晚上</button>';
    html += '<button class="chip" data-action="room-quick" data-key="span2">连空 2 节</button>';
    html += '<button class="chip" data-action="room-quick" data-key="span3">连空 3 节</button>';
    html += '</div>';
    html += '</section>';

    // 筛选
    html += '<section class="card">';
    html += '<div class="tiny muted">教学楼</div><div class="chips mt8">';
    html += '<button class="chip ' + (rv.building === '' ? 'active' : '') + '" data-action="room-building" data-building="">全部</button>';
    (res.buildings || []).forEach(function (b) {
      html += '<button class="chip ' + (rv.building === b ? 'active' : '') + '" data-action="room-building" data-building="' + esc(b) + '">' + esc(b) + '</button>';
    });
    html += '</div>';

    html += '<div class="tiny muted mt12">座位数</div><div class="chips mt8">';
    [{ l: '不限', v: 0 }, { l: '≥30', v: 30 }, { l: '≥60', v: 60 }, { l: '≥100', v: 100 }].forEach(function (x) {
      html += '<button class="chip ' + (rv.capacity === x.v ? 'active' : '') + '" data-action="room-capacity" data-v="' + x.v + '">' + x.l + '</button>';
    });
    html += '</div>';

    html += '<div class="tiny muted mt12">设施</div><div class="chips mt8">';
    Object.keys(FACILITY_LABEL).slice(0, 3).forEach(function (f) {
      var on = rv.facilities.indexOf(f) >= 0;
      html += '<button class="chip ' + (on ? 'active' : '') + '" data-action="room-facility" data-f="' + f + '">' + FACILITY_LABEL[f] + '</button>';
    });
    html += '<button class="chip ' + (rv.onlyStudy ? 'active' : '') + '" data-action="room-onlystudy">仅可自习</button>';
    html += '</div></section>';

    // 统计
    html += '<div class="stat-bar">' +
      '<div class="stat-line">第 ' + Math.max(1, week) + ' 周 ' + dayName + ' · 第 ' + startPeriod + '-' + endPeriod + ' 节 ' +
      esc(res.timeRange.start) + '-' + esc(res.timeRange.end) + '</div>' +
      '<div class="stat-main"><span class="stat-num">' + res.free.length + '</span>' +
      '<span>间空闲</span><span class="stat-sub">可自习 ' + data.classrooms.filter(function (x) { return x.openForStudy !== false; }).length +
      ' 间 · 占用 ' + res.occupied.length + ' 间</span></div></div>';

    if (!data.occupancy.length) {
      html += '<div class="warn">⚠️ 未导入全校教室占用表，结果只按你自己的课表推算，可能偏多。' +
        '可在「设置 → 数据管理」导入。</div>';
    }
    if (res.unknownRooms && res.unknownRooms.length) {
      html += '<div class="warn">⚠️ 课表里有教室不在字典中：' + esc(res.unknownRooms.join('、')) +
        '。它们不会出现在结果里，可在「设置」里一键补充。</div>';
    }

    if (!res.free.length) {
      html += '<div class="card"><div class="empty">该条件下没有空闲教室，试试放宽节次或筛选</div></div>';
    }

    res.free.forEach(function (r, i) {
      html += '<button class="room-card" data-action="room-detail" data-id="' + esc(r.id) + '">' +
        '<div class="between"><div class="room-name">' + esc(r.name) + '</div>' +
        '<span class="tag tag-green">' + esc(r.freeSpanText) + '</span></div>' +
        (r.runSpanText ? '<div class="tiny muted mt8">🕒 ' + esc(r.runSpanText) + '</div>' : '') +
        '<div class="tiny muted mt8">' + esc(roomMeta(r)) + '</div>' +
        (r.facilityLabels && r.facilityLabels.length
          ? '<div class="mt8">' + r.facilityLabels.map(function (f) { return '<span class="tag tag-gray" style="margin-right:6px">' + esc(f) + '</span>'; }).join('') + '</div>'
          : '') +
        '<div class="tiny muted mt8">今日空堂：' + r.freeRuns.map(function (x) { return esc(x.periodText); }).join('、') + '</div>' +
        '</button>';
    });

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    $('#view').appendChild(wrap);
  }

  /* ============================================================
     七、导入视图
     ============================================================ */

  function renderImport() {
    var html = '';

    html += '<section class="card">' +
      '<div class="card-title"><span>从文件导入</span><span class="sub">Excel / Word / CSV</span></div>' +
      '<div class="tiny muted">支持 .xlsx .docx .csv .txt；旧版 .xls/.doc 请先另存为新格式。</div>' +
      '<div class="tiny muted mt8">表头含 课程名称/星期/节次/教室/周次，或"上方星期、左侧节次"的课表网格都可以。</div>' +
      '<div class="dropzone mt12" id="dropzone">' +
      '<div class="big">📄</div>' +
      '<div class="strong">点这里选文件</div>' +
      '<div class="tiny muted mt8">也可以把文件直接拖到这个框里</div>' +
      '<input type="file" id="file-input" accept=".xlsx,.docx,.csv,.txt,.xls,.doc" hidden>' +
      '</div>' +
      '<div id="file-result"></div>' +
      '</section>';

    html += '<section class="card">' +
      '<div class="card-title">粘贴文本导入</div>' +
      '<div class="tiny muted">每行一条：课程名,星期,起始节,结束节,教室,周次</div>' +
      '<textarea class="textarea mt8" id="paste-input" placeholder="高等数学(上),周一,1,2,A301,1-16&#10;程序设计基础 周三 5-6 A301 1-16周"></textarea>' +
      '<div class="row gap8 mt12">' +
      '<button class="btn btn-plain grow" data-action="paste-sample">填入示例</button>' +
      '<button class="btn btn-primary grow" data-action="paste-parse">解析</button>' +
      '</div></section>';

    html += '<div id="import-preview"></div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    $('#view').appendChild(wrap);

    bindFilePicker();
    if (view.importPreview) renderImportPreview(view.importPreview);
  }

  function bindFilePicker() {
    var zone = $('#dropzone');
    var input = $('#file-input');
    if (!zone || !input) return;

    zone.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault();
        zone.classList.add('over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault();
        zone.classList.remove('over');
      });
    });
    zone.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
  }

  function handleFile(file) {
    var MAX = FI.MAX_BYTES;
    if (file.size > MAX) {
      UI.alert({ title: '文件太大', content: '请只保留课表内容后重试（上限 ' + Math.round(MAX / 1024 / 1024) + 'MB）' });
      return;
    }
    var resultEl = $('#file-result');
    if (resultEl) resultEl.innerHTML = '<div class="tiny muted mt12">正在解析 ' + esc(file.name) + ' …</div>';

    var reader = new FileReader();
    reader.onload = function () {
      var bytes = new Uint8Array(reader.result);
      var res;
      try {
        res = FI.parseBytes(bytes, file.name, {
          classrooms: data.classrooms,
          periods: data.periods,
          totalWeeks: data.settings.totalWeeks,
        });
      } catch (e) {
        res = { ok: false, error: '解析异常：' + (e.message || e) };
      }
      if (resultEl) resultEl.innerHTML = '';
      showImportResult(res, file.name);
    };
    reader.onerror = function () {
      if (resultEl) resultEl.innerHTML = '';
      UI.alert({ title: '读取失败', content: '无法读取这个文件，请换一个试试。' });
    };
    reader.readAsArrayBuffer(file);
  }

  function showImportResult(res, fileName) {
    if (!res || !res.ok) {
      var msg = (res && res.error) || '解析失败';
      UI.sheet({
        title: '没有识别出课表',
        sub: fileName || '',
        bodyHtml: '<div class="tiny muted" style="white-space:pre-line">' + esc(msg) + '</div>',
        actions: [{ label: '知道了', style: 'primary' }],
      });
      return;
    }
    view.importPreview = res;
    renderImportPreview(res);
  }

  function renderImportPreview(res) {
    var box = $('#import-preview');
    if (!box) return;

    var layoutText = { list: '列表式', grid: '课表网格', text: '文本行' }[res.layout] || res.layout;
    var parts = ['识别出 ' + res.courses.length + ' 门课程（布局：' + layoutText + '）'];
    var rc = res.recognize;
    if (rc && rc.method) {
      parts.push('🔍 ' + rc.method);
      if (rc.source === 'content' && rc.inferred && rc.inferred.columns) {
        var names = { name: '课程名', day: '星期', period: '节次', time: '时间', room: '教室', weeks: '周次', teacher: '教师' };
        var cols = rc.inferred.columns;
        parts.push('按内容推断：' + Object.keys(cols).map(function (f) {
          return (names[f] || f) + '=第' + (cols[f] + 1) + '列';
        }).join('、'));
      }
      if (rc.confidence) parts.push('字段完整度：' + Math.round(rc.confidence * 100) + '%');
    }
    (res.warnings || []).forEach(function (w) { parts.push('· ' + w); });

    var html = '<section class="card">';
    html += '<div class="card-title"><span>解析预览</span><span class="sub">' + res.courses.length + ' 条</span></div>';
    html += '<div class="warn" style="white-space:pre-line">' + esc(parts.join('\n')) + '</div>';

    if (res.unknownRooms && res.unknownRooms.length) {
      html += '<div class="warn">⚠️ 有 ' + res.unknownRooms.length + ' 间教室不在教室字典里：' +
        esc(res.unknownRooms.slice(0, 8).join('、')) + (res.unknownRooms.length > 8 ? '…' : '') +
        '<br>不补进字典的话，它们不会出现在「空教室」查询结果里。' +
        '<br><button class="btn btn-sm btn-ghost mt8" data-action="add-unknown-rooms">一键加入教室字典</button></div>';
    }

    res.courses.slice(0, 40).forEach(function (c) {
      var conf = Math.round((c._confidence === undefined ? 1 : c._confidence) * 100);
      html += '<div class="preview-item">' +
        '<div class="between"><span class="strong">' + esc(c.name) + '</span>' +
        (conf < 100 ? '<span class="tag tag-orange">需确认 ' + conf + '%</span>' : '<span class="tag tag-green">完整</span>') +
        '</div>' +
        '<div class="tiny muted mt8">' + esc(T.WEEK_NAMES[c.day]) + ' ' + esc(S.formatPeriods(c.start, c.end)) +
        ' · ' + esc(c.roomId || '未识别') + (c.teacher ? ' · ' + esc(c.teacher) : '') +
        ' · ' + esc(S.formatWeeks(c.weeks)) + '</div>' +
        ((c.warnings && c.warnings.length) ? '<div class="tiny" style="color:var(--orange)">⚠ ' + esc(c.warnings.join('；')) + '</div>' : '') +
        '</div>';
    });
    if (res.courses.length > 40) {
      html += '<div class="tiny muted" style="padding:8px 0">预览只显示前 40 条，导入时会全部写入</div>';
    }

    html += '<div class="row gap8 mt12">' +
      '<button class="btn btn-plain grow" data-action="import-cancel">取消</button>' +
      '<button class="btn btn-ghost grow" data-action="import-append">追加导入</button>' +
      '<button class="btn btn-primary grow" data-action="import-replace">替换课表</button>' +
      '</div></section>';

    box.innerHTML = html;
  }

  function doImport(mode) {
    var res = view.importPreview;
    if (!res || !res.courses.length) return;
    var stamped = res.courses.map(function (c, i) {
      return Object.assign({}, c, { id: 'imp_' + Date.now() + '_' + i });
    });
    var list = mode === 'append' ? data.courses.concat(stamped) : stamped;
    saveCourses(list);
    view.importPreview = null;
    var conflicts = S.detectConflicts(list);
    UI.toast('已导入 ' + stamped.length + ' 门课程');
    if (conflicts.length) {
      setTimeout(function () {
        UI.alert({ title: '检测到时间冲突', content: conflicts.slice(0, 3).map(function (c) { return c.message; }).join('\n') });
      }, 300);
    }
    go('today');
  }

  /* ============================================================
     八、设置视图
     ============================================================ */

  function renderSettings() {
    var s = data.settings;
    var html = '';

    // 提醒
    html += '<section class="card"><div class="card-title"><span>上课提醒</span><span class="sub">防迟到</span></div>';
    html += '<div class="field"><div class="between"><div><div class="field-label">提前提醒</div>' +
      '<div class="field-hint">距上课多久提醒你出发</div></div><span class="field-value">' + s.aheadMinutes + ' 分钟</span></div>' +
      '<input type="range" min="5" max="60" step="5" value="' + s.aheadMinutes + '" data-action="set-ahead"></div>';
    html += '<div class="field"><div class="between"><div><div class="field-label">最后提醒</div>' +
      '<div class="field-hint">临出门前的二次提醒</div></div><span class="field-value">' + s.finalAheadMinutes + ' 分钟</span></div>' +
      '<input type="range" min="1" max="15" step="1" value="' + s.finalAheadMinutes + '" data-action="set-final"></div>';
    html += '<div class="field between"><div><div class="field-label">震动</div></div>' +
      '<input type="checkbox" ' + (s.vibrate ? 'checked' : '') + ' data-action="set-vibrate"></div>';
    html += '<div class="field between"><div><div class="field-label">提示音</div></div>' +
      '<input type="checkbox" ' + (s.sound ? 'checked' : '') + ' data-action="set-sound"></div>';
    html += '<div class="field between"><div><div class="field-label">页面内提醒横幅</div></div>' +
      '<input type="checkbox" ' + (s.popup ? 'checked' : '') + ' data-action="set-popup"></div>';
    html += '<button class="btn btn-ghost mt12" data-action="test-remind">测试一次提醒</button>';
    html += '</section>';

    // 浏览器通知 + 日历
    var permText = (window.Notification && Notification.permission) || 'unsupported';
    var permLabel = { granted: '已允许', denied: '已拒绝（需到浏览器设置里改）', default: '未申请', unsupported: '当前浏览器不支持' }[permText] || permText;

    html += '<section class="card"><div class="card-title"><span>系统提醒</span><span class="sub">关掉页面也能被提醒</span></div>';
    html += '<div class="field between"><div><div class="field-label">浏览器通知</div>' +
      '<div class="field-hint">授权后，页面在后台也能弹出系统通知</div></div>' +
      '<span class="field-value">' + esc(permLabel) + '</span></div>';
    html += '<button class="btn btn-ghost mt12" data-action="enable-notify">申请通知权限</button>';
    html += '<div class="divider"></div>';
    html += '<div class="tiny muted">把整学期课程导出成 .ics 日历文件，用手机打开即可导入系统日历。' +
      '之后即使不打开这个网页，手机也会在课前响铃——这是防误课最可靠的方式。</div>';
    html += '<button class="btn btn-primary mt12" data-action="export-ics">导出整学期课程到日历</button>';
    html += '</section>';

    // 学期
    html += '<section class="card"><div class="card-title">学期设置</div>';
    html += '<div class="field between"><div class="field-label">学期名称</div>' +
      '<input class="input" style="max-width:180px;text-align:right" value="' + esc(s.termName) + '" data-action="set-term-name"></div>';
    html += '<div class="field between"><div class="field-label">开学第一周周一</div>' +
      '<input class="input" type="date" style="max-width:180px" value="' + esc(s.termStartDate) + '" data-action="set-term-start"></div>';
    html += '<div class="field between"><div class="field-label">学期总周数</div>' +
      '<input class="input" type="number" min="8" max="30" style="max-width:110px;text-align:right" value="' + s.totalWeeks + '" data-action="set-total-weeks"></div>';
    html += '<div class="tiny muted mt8">开学日期填错会导致周次和单双周判断出错，请务必核对。</div></section>';

    // 数据
    var unknownRooms = collectUnknownRooms();
    html += '<section class="card"><div class="card-title">数据管理</div>';
    html += '<div class="field between"><span class="muted">课程数量</span><span class="strong">' + data.courses.length + ' 门</span></div>';
    html += '<div class="field between"><span class="muted">教室字典</span><span class="strong">' + data.classrooms.length + ' 间</span></div>';
    html += '<div class="field between"><span class="muted">全校占用记录</span><span class="strong">' + data.occupancy.length + ' 条</span></div>';

    if (unknownRooms.length) {
      html += '<div class="warn mt12">⚠️ 课表里有 ' + unknownRooms.length + ' 间教室不在字典中：' +
        esc(unknownRooms.slice(0, 6).join('、')) + (unknownRooms.length > 6 ? '…' : '') +
        '<br><button class="btn btn-sm btn-ghost mt8" data-action="add-unknown-rooms">一键加入教室字典</button></div>';
    }

    html += '<button class="btn btn-ghost mt12" data-action="go-import">导入 / 编辑课表</button>';
    html += '<div class="row gap8 mt12">' +
      '<button class="btn btn-plain grow" data-action="export-data">导出备份</button>' +
      '<button class="btn btn-plain grow" data-action="import-data">导入备份</button></div>';
    html += '<div class="row gap8 mt12">' +
      '<button class="btn btn-plain grow" data-action="restore-demo">恢复示例</button>' +
      '<button class="btn btn-danger grow" data-action="clear-courses">清空课表</button></div>';
    html += '<div class="tiny muted mt12">所有数据只保存在这台设备的浏览器里，不会上传到任何服务器。</div>';
    html += '</section>';

    // 关于
    html += '<section class="card"><div class="card-title">关于</div>' +
      '<div class="field between"><span class="muted">版本</span><span>网页版 1.0</span></div>' +
      '<div class="field between"><span class="muted">课表算法</span><span>与小程序版共用同一套</span></div>' +
      '<div class="field between"><span class="muted">离线可用</span><span>' +
      (('serviceWorker' in navigator) && location.protocol === 'https:' ? '已启用（PWA）' : '需 HTTPS 部署后启用') +
      '</span></div>' +
      '<button class="btn btn-plain mt12" data-action="add-to-home">添加到主屏幕</button>' +
      '</section>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    $('#view').appendChild(wrap);
  }

  function collectUnknownRooms() {
    var known = {};
    data.classrooms.forEach(function (r) { known[r.id] = 1; });
    var out = [];
    data.courses.forEach(function (c) {
      if (c.roomId && !known[c.roomId] && out.indexOf(c.roomId) < 0) out.push(c.roomId);
    });
    return out;
  }

  /* ============================================================
     九、交互动作
     ============================================================ */

  var actions = {
    'go-import': function () { go('import'); },
    'go-classroom': function () { go('classroom'); },

    'copy-room': function () {
      var next = S.getNextClass(data.courses, data.classrooms, data.periods, new Date(), data.settings);
      var current = S.getCurrentClass(data.courses, data.classrooms, data.periods, new Date(), data.settings);
      var room = (current && current.room) || (next && next.room);
      if (!room) return;
      copyText(room);
    },

    'dismiss-alert': function (el) {
      var banner = el.closest('.alert-banner');
      if (banner) banner.remove();
    },

    /* --- 课表 --- */
    'week-prev': function () { view.week = Math.max(1, (view.week || currentWeek()) - 1); render(); },
    'week-next': function () { view.week = Math.min(data.settings.totalWeeks, (view.week || currentWeek()) + 1); render(); },
    'week-now': function () { view.week = currentWeek(); render(); },
    'toggle-weekend': function () { view.showWeekend = !view.showWeekend; render(); },

    'course': function (el) {
      var id = el.getAttribute('data-id');
      var course = data.courses.filter(function (c) { return c.id === id; })[0];
      if (!course) return;
      var t = S.periodRange(data.periods, course.start, course.end);
      UI.sheet({
        title: course.name,
        sub: course.roomId || '教室待定',
        bodyHtml: '<div class="tiny muted" style="line-height:1.9">' +
          (course.teacher ? '教师：' + esc(course.teacher) + '<br>' : '') +
          '节次：' + esc(S.formatPeriods(course.start, course.end)) + '（' + esc(t.start) + '-' + esc(t.end) + '）<br>' +
          '周次：' + esc(S.formatWeeks(course.weeks)) + '<br>' +
          (course.note ? '备注：' + esc(course.note) : '') +
          '</div>',
        actions: [
          { label: '关闭', style: 'plain' },
          { label: '删除这门课', style: 'danger', onClick: function (close) {
            close();
            UI.confirm({ title: '删除课程', content: '确定删除「' + course.name + '」吗？' }).then(function (ok) {
              if (!ok) return;
              saveCourses(data.courses.filter(function (c) { return c.id !== id; }));
              UI.toast('已删除');
              render();
            });
          } },
        ],
      });
    },

    'cell': function (el) {
      var day = Number(el.getAttribute('data-day'));
      var period = Number(el.getAttribute('data-period'));
      var week = view.week || currentWeek();
      var dates = T.weekDates(week, data.settings.termStartDate);
      var date = dates[day - 1];
      var res = C.queryFreeRooms({
        date: date, startPeriod: period, endPeriod: period,
        courses: data.courses, occupancy: data.occupancy, classrooms: data.classrooms,
        periods: data.periods, settings: data.settings, onlyStudy: true, sort: 'building',
      });
      var rooms = (res.free || []).slice(0, 8);
      var body = rooms.length
        ? '<div class="tiny muted" style="line-height:1.9">' + rooms.map(function (r) {
            return esc(r.name) + '（' + esc(r.building) + ' · ' + capacityText(r.capacity) + '）';
          }).join('<br>') + '</div>'
        : '<div class="tiny muted">该时段没有可自习的空教室</div>';
      UI.sheet({
        title: T.WEEK_NAMES[day] + ' ' + S.formatPeriods(period, period) + ' 空教室',
        sub: T.formatDate(date) + ' · 共 ' + res.free.length + ' 间可用',
        bodyHtml: body,
        actions: [{ label: '关闭', style: 'plain' }, { label: '详细查询', style: 'primary', onClick: function (close) { close(); go('classroom'); } }],
      });
    },

    /* --- 空教室 --- */
    'room-date': function (el) { view.room.date = el.getAttribute('data-date'); render(); },
    'room-date-pick': function () {
      var input = document.createElement('input');
      input.type = 'date';
      input.value = view.room.date;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.addEventListener('change', function () {
        if (input.value) { view.room.date = input.value; render(); }
        document.body.removeChild(input);
      });
      input.click();
    },
    'room-now': function () {
      var ctx = C.currentPeriodContext(data.periods, new Date());
      var idx = Math.max(0, (ctx.period || 1) - 1);
      view.room.date = todayStr();
      view.room.startIndex = idx;
      view.room.endIndex = Math.min(idx + 1, data.periods.length - 1);
      render();
    },
    'room-quick': function (el) {
      var key = el.getAttribute('data-key');
      var max = data.periods.length - 1;
      var s = view.room.startIndex;
      if (key === 'morning') { s = 0; view.room.endIndex = Math.min(3, max); }
      else if (key === 'afternoon') { s = Math.min(4, max); view.room.endIndex = Math.min(7, max); }
      else if (key === 'evening') { s = Math.min(8, max); view.room.endIndex = max; }
      else if (key === 'span2') { view.room.endIndex = Math.min(s + 1, max); }
      else if (key === 'span3') { view.room.endIndex = Math.min(s + 2, max); }
      view.room.startIndex = s;
      if (view.room.endIndex < view.room.startIndex) view.room.endIndex = view.room.startIndex;
      render();
    },
    'room-building': function (el) { view.room.building = el.getAttribute('data-building') || ''; render(); },
    'room-capacity': function (el) { view.room.capacity = Number(el.getAttribute('data-v')) || 0; render(); },
    'room-facility': function (el) {
      var f = el.getAttribute('data-f');
      var i = view.room.facilities.indexOf(f);
      if (i >= 0) view.room.facilities.splice(i, 1);
      else view.room.facilities.push(f);
      render();
    },
    'room-onlystudy': function () { view.room.onlyStudy = !view.room.onlyStudy; render(); },

    'room-detail': function (el) {
      var id = el.getAttribute('data-id');
      var room = data.classrooms.filter(function (r) { return r.id === id; })[0];
      if (!room) return;
      var busy = C.buildBusyMap(data.courses, data.occupancy, data.classrooms, view.room.date, data.settings);
      var runs = C.freeRuns(busy, id, data.periods);
      var occ = (busy.byRoom[id] || []).map(function (r) {
        return S.formatPeriods(r.start, r.end) + '  ' + r.name + (r.source === 'mine' ? '（我的课）' : '');
      });
      var html = '<div class="tiny muted" style="line-height:2">' +
        '<b>空堂时段</b><br>' + (runs.length ? runs.map(function (x) {
          return esc(x.periodText) + '（' + esc(x.durationText) + '）';
        }).join('<br>') : '当天无空闲') +
        '<br><br><b>被占用</b><br>' + (occ.length ? occ.map(esc).join('<br>') : '当天没有被课表占用') +
        '</div>';
      UI.sheet({
        title: room.name,
        sub: roomMeta(room),
        bodyHtml: html,
        actions: [
          { label: '关闭', style: 'plain' },
          { label: '复制教室名', style: 'primary', onClick: function (close) { close(); copyText(room.name); } },
        ],
      });
    },

    /* --- 导入 --- */
    'paste-sample': function () {
      var ta = $('#paste-input');
      if (ta) ta.value = [
        '高等数学(上),周一,1,2,A301,1-16',
        '程序设计基础,周三,5,6,A301,1-16',
        '大学物理,周四,7,8,A201,1-16单',
      ].join('\n');
    },
    'paste-parse': function () {
      var ta = $('#paste-input');
      var text = ta ? ta.value : '';
      if (!text.trim()) { UI.toast('请先粘贴课表内容'); return; }
      var parsed = SS.importer.parseText(text, data.classrooms);
      var courses = parsed.courses.map(function (c) {
        return {
          name: c.name, teacher: c.teacher || '', roomId: c.roomId || '',
          day: c.day, start: c.start, end: c.end, weeks: c.weeks, warnings: [],
        };
      });
      showImportResult({
        ok: courses.length > 0,
        layout: 'text',
        courses: courses,
        warnings: parsed.errors.length ? ['有 ' + parsed.errors.length + ' 行无法识别，已跳过'] : [],
        unknownRooms: parsed.unknownRooms || [],
        error: '没有解析出课程。每行格式：课程名,星期,起始节,结束节,教室,周次',
      }, '粘贴的文本');
    },
    'import-append': function () { doImport('append'); },
    'import-replace': function () {
      UI.confirm({ title: '替换整个课表', content: '当前课表会被清空，确定吗？' }).then(function (ok) {
        if (ok) doImport('replace');
      });
    },
    'import-cancel': function () { view.importPreview = null; go('today'); },

    'add-unknown-rooms': function () {
      var unknown = collectUnknownRooms();
      if (view.importPreview && view.importPreview.unknownRooms) {
        view.importPreview.unknownRooms.forEach(function (r) {
          if (unknown.indexOf(r) < 0) unknown.push(r);
        });
      }
      if (!unknown.length) { UI.toast('没有需要补充的教室'); return; }
      var list = data.classrooms.slice();
      var existing = {};
      list.forEach(function (r) { existing[r.id] = 1; });
      var added = 0;
      unknown.forEach(function (id) {
        if (existing[id]) return;
        var room = C.guessClassroom(id);
        if (!room) return;
        list.push(room);
        existing[id] = 1;
        added++;
      });
      saveClassrooms(list);
      UI.toast('已加入 ' + added + ' 间教室');
      render();
    },

    /* --- 设置 --- */
    'set-ahead': function (el) { saveSettings({ aheadMinutes: Number(el.value) }); refreshFieldValue(el, el.value + ' 分钟'); },
    'set-final': function (el) { saveSettings({ finalAheadMinutes: Number(el.value) }); refreshFieldValue(el, el.value + ' 分钟'); },
    'set-vibrate': function (el) { saveSettings({ vibrate: el.checked }); },
    'set-sound': function (el) { saveSettings({ sound: el.checked }); },
    'set-popup': function (el) { saveSettings({ popup: el.checked }); },
    'set-term-name': function (el) { saveSettings({ termName: el.value }); },
    'set-term-start': function (el) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) {
        saveSettings({ termStartDate: el.value });
        UI.toast('开学日期已更新');
      }
    },
    'set-total-weeks': function (el) {
      var n = Number(el.value);
      if (n >= 8 && n <= 30) saveSettings({ totalWeeks: n });
    },

    'test-remind': function () {
      var next = S.getNextClass(data.courses, data.classrooms, data.periods, new Date(), data.settings);
      if (!next) { UI.toast('近期没有课程，无法测试'); return; }
      var alert = N.fireAlert(next, data.settings, 'main');
      showReminder(alert);
    },

    'enable-notify': function () {
      if (!window.Notification) {
        UI.alert({ title: '不支持', content: '当前浏览器不支持系统通知。可以改用「导出日历」的方式获得课前提醒。' });
        return;
      }
      Notification.requestPermission().then(function (perm) {
        if (perm === 'granted') {
          saveSettings({ notifyEnabled: true });
          UI.toast('已开启系统通知');
          render();
        } else {
          UI.alert({ title: '未获得授权', content: '浏览器拒绝了通知权限。可以改用「导出日历」的方式。' });
        }
      });
    },

    'export-ics': function () { exportICS(); },

    'export-data': function () {
      var payload = {
        version: 1,
        exportAt: new Date().toISOString(),
        courses: data.courses,
        classrooms: data.classrooms,
        occupancy: data.occupancy,
        periods: data.periods,
        settings: data.settings,
      };
      var text = JSON.stringify(payload, null, 2);
      downloadText(text, '智能课表备份-' + todayStr() + '.json', 'application/json');
      UI.toast('备份已下载');
    },
    'import-data': function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var obj = JSON.parse(reader.result);
            if (!obj || !obj.courses) throw new Error('缺少 courses 字段');
            UI.confirm({
              title: '导入备份',
              content: '将导入 ' + obj.courses.length + ' 门课程并覆盖当前数据，确定吗？',
            }).then(function (ok) {
              if (!ok) return;
              saveCourses(obj.courses);
              if (obj.classrooms && obj.classrooms.length) saveClassrooms(obj.classrooms);
              if (obj.occupancy) { ST.set(ST.KEYS.OCCUPANCY, obj.occupancy); data.occupancy = obj.occupancy; }
              if (obj.periods && obj.periods.length) { ST.set(ST.KEYS.PERIODS, obj.periods); data.periods = obj.periods; }
              if (obj.settings) saveSettings(obj.settings);
              UI.toast('导入完成');
              render();
            });
          } catch (e) {
            UI.alert({ title: '备份文件无效', content: String(e.message || e) });
          }
        };
        reader.readAsText(f);
      });
      input.click();
    },
    'restore-demo': function () {
      UI.confirm({ title: '恢复示例数据', content: '会用示例课表覆盖当前数据，确定吗？' }).then(function (ok) {
        if (!ok) return;
        restoreDemo();
        UI.toast('已恢复示例');
        render();
      });
    },
    'clear-courses': function () {
      UI.confirm({ title: '清空课表', content: '将删除全部课程，确定吗？' }).then(function (ok) {
        if (!ok) return;
        saveCourses([]);
        UI.toast('已清空');
        render();
      });
    },
    'add-to-home': function () {
      UI.sheet({
        title: '添加到主屏幕',
        sub: '像 App 一样从桌面启动',
        bodyHtml: '<div class="tiny muted" style="line-height:1.9">' +
          '<b>iPhone / iPad：</b>用 Safari 打开 → 点底部「分享」→「添加到主屏幕」<br><br>' +
          '<b>Android：</b>用 Chrome 打开 → 右上角菜单 →「添加到主屏幕」<br><br>' +
          '添加后从桌面图标打开，就没有浏览器地址栏了。</div>',
        actions: [{ label: '知道了', style: 'primary' }],
      });
    },
  };

  function refreshFieldValue(el, text) {
    var field = el.closest('.field');
    if (!field) return;
    var v = field.querySelector('.field-value');
    if (v) v.textContent = text;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { UI.toast('已复制：' + text); })
        .catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); UI.toast('已复制：' + text); }
    catch (e) { UI.toast(text); }
    document.body.removeChild(ta);
  }

  function downloadText(text, filename, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  /** 把整学期课程导出成 .ics */
  function exportICS() {
    if (!data.courses.length) { UI.toast('课表为空'); return; }
    var events = [];
    var ahead = data.settings.aheadMinutes || 20;
    data.courses.forEach(function (course) {
      var dates = S.expandCourseDates(course, data.settings.termStartDate, data.settings.totalWeeks);
      dates.forEach(function (item) {
        var t = S.periodRange(data.periods, course.start, course.end);
        var start = T.atTime(item.date, t.start);
        var end = T.atTime(item.date, t.end);
        events.push({
          title: course.name + (course.roomId ? ' @' + course.roomId : ''),
          startTime: Math.floor(start.getTime() / 1000),
          endTime: Math.floor(end.getTime() / 1000),
          description: [course.teacher ? '教师：' + course.teacher : '',
            course.note ? '备注：' + course.note : '',
            S.formatPeriods(course.start, course.end),
            S.formatWeeks(course.weeks)].filter(Boolean).join('；'),
          location: course.roomId || '',
          alarmOffset: ahead * 60,
        });
      });
    });

    UI.confirm({
      title: '导出 ' + events.length + ' 条课程',
      content: '会下载一个 .ics 文件。用手机打开它，系统会问是否导入日历——点「全部添加」即可。' +
        '\n\n导入后即使不打开这个网页，手机也会在课前 ' + ahead + ' 分钟提醒你。',
    }).then(function (ok) {
      if (!ok) return;
      ICS.download(events, '我的课表-' + todayStr() + '.ics');
      saveSettings({ lastCalendarSync: todayStr() });
      UI.toast('已生成日历文件');
    });
  }

  /* ============================================================
     十、事件绑定与启动
     ============================================================ */

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var tabBtn = e.target.closest('#tabbar .tab');
      if (tabBtn) {
        go(tabBtn.getAttribute('data-tab'));
        return;
      }
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var action = el.getAttribute('data-action');
      var fn = actions[action];
      if (!fn) return;
      // change 类控件走 input 事件，这里忽略
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
      fn(el, e);
    });

    document.addEventListener('input', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var action = el.getAttribute('data-action');
      if (action === 'set-ahead' || action === 'set-final') {
        var v = el.closest('.field').querySelector('.field-value');
        if (v) v.textContent = el.value + ' 分钟';
      }
    });

    document.addEventListener('change', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var action = el.getAttribute('data-action');
      var fn = actions[action];
      if (fn) fn(el, e);
    });

    document.addEventListener('select', function () {});
    // 下拉选择
    document.addEventListener('change', function (e) {
      var el = e.target.closest('select[data-action]');
      if (!el) return;
      var action = el.getAttribute('data-action');
      if (action === 'room-start') { view.room.startIndex = Number(el.value); if (view.room.endIndex < view.room.startIndex) view.room.endIndex = view.room.startIndex; render(); }
      if (action === 'room-end') { view.room.endIndex = Number(el.value); if (view.room.startIndex > view.room.endIndex) view.room.startIndex = view.room.endIndex; render(); }
    });

    window.addEventListener('hashchange', function () {
      var t = (location.hash || '').replace(/^#\//, '');
      if (t && RENDERERS[t] && t !== view.tab) { view.tab = t; render(); }
    });

    // 回到前台时刷新（跨节次、跨天）
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') render();
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    // 有些环境里 navigator.serviceWorker 存在但为 null，必须判空
    if (!navigator.serviceWorker || typeof navigator.serviceWorker.register !== 'function') return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      return; // 局域网 http 下浏览器不允许注册 SW
    }
    navigator.serviceWorker.register('sw.js').catch(function () { /* 静默失败，不影响功能 */ });
  }

  function boot() {
    initStorage();
    loadData();
    bindEvents();

    var initial = (location.hash || '').replace(/^#\//, '');
    view.tab = RENDERERS[initial] ? initial : 'today';
    render();

    registerSW();

    // 每秒刷新今日倒计时（仅今日视图）
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && view.tab === 'today') startTick();
      else stopTick();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
