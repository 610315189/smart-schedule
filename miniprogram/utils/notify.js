/**
 * 课前提醒引擎
 * ---------------------------------------------------------------
 * 小程序无法在后台常驻定时器，所以"防迟到"采用三道保险：
 *   1) 打开小程序时：自动检查 + 醒目弹层 + 震动（本文件）
 *   2) 手机系统日历：把整学期课程写进日历，系统级闹钟提醒（calendar.js）
 *   3) 微信订阅消息：由后端定时推送服务通知（server/）
 *
 * 本文件负责第 1 道保险，并做提醒去重，避免反复打扰。
 */
const T = require('./time');
const S = require('./schedule');
const storage = require('./storage');

let audioCtx = null;

/** 播放提示音（音频文件缺失时静默降级） */
function playAlertSound() {
  try {
    if (!audioCtx) {
      audioCtx = wx.createInnerAudioContext();
      audioCtx.src = '/assets/alert.wav';
      audioCtx.volume = 1;
    }
    audioCtx.stop();
    audioCtx.play();
  } catch (e) {
    /* 忽略：部分环境不支持 */
  }
}

function vibrate(long) {
  try {
    if (long) wx.vibrateLong();
    else wx.vibrateShort({ type: 'medium' });
  } catch (e) {
    /* ignore */
  }
}

/** 提醒去重键：同一节课同一天只提醒一次 */
function remindKey(next) {
  return next.course.id + '_' + T.formatDate(next.date) + '_' + next.course.start;
}

function hasReminded(key) {
  const map = storage.get(storage.KEYS.REMINDED, {}) || {};
  return !!map[key];
}

function markReminded(key) {
  const map = storage.get(storage.KEYS.REMINDED, {}) || {};
  map[key] = Date.now();
  // 顺手清理 3 天前的旧记录，避免存储膨胀
  const edge = Date.now() - 3 * 86400000;
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    if (map[keys[i]] < edge) delete map[keys[i]];
  }
  storage.set(storage.KEYS.REMINDED, map);
}

function clearReminded() {
  storage.set(storage.KEYS.REMINDED, {});
}

/**
 * 计算当前该展示的上下课状态
 * @returns { current, next, shouldAlert, alertKey, title, desc }
 */
function evaluate(courses, classrooms, periods, settings, now) {
  const n = now || new Date();
  const current = S.getCurrentClass(courses, classrooms, periods, n, settings);
  const next = S.getNextClass(courses, classrooms, periods, n, settings);

  let shouldAlert = false;
  let alertKey = '';
  let title = '';
  let desc = '';

  let stage = '';
  if (next && next.isToday && settings.popup) {
    const left = next.minutesLeftExact;
    const edge = settings.autoPopupMinutes || 30;
    const finalEdge = settings.finalAheadMinutes || 5;
    // 两级提醒：先是"准备出门"，临近时再来一次"快迟到了"
    if (left > 0 && left <= finalEdge) stage = 'final';
    else if (left > 0 && left <= edge) stage = 'main';
    if (stage) {
      alertKey = remindKey(next) + '_' + stage;
      if (!hasReminded(alertKey)) {
        shouldAlert = true;
      }
    }
  }

  if (next) {
    if (next.minutesLeft <= 1) {
      title = '马上上课了！';
    } else if (next.isToday) {
      title = '距 ' + next.course.name + ' 还有 ' + T.humanDuration(next.minutesLeft);
    } else {
      title = '下一节课：' + next.dateLabel + ' ' + next.startTime;
    }
    // 教室变更提醒：上一节课的教室与本节课相同则无需移动
    const sameRoom = current && current.course && current.course.roomId === next.course.roomId;
    if (current) {
      desc = '正在上《' + current.course.name + '》，' + current.endTime + ' 下课';
      if (!sameRoom) {
        desc += '，下节课需换到 ' + next.room;
      }
    } else {
      desc = next.periodText + ' ' + next.startTime + '-' + next.endTime + ' · ' + next.room;
    }
  } else {
    title = '近期没有课程安排';
    desc = '可以放心去自习，或检查一下课表设置';
  }

  return {
    current: current,
    next: next,
    shouldAlert: shouldAlert,
    alertKey: alertKey,
    stage: stage,
    title: title,
    desc: desc,
  };
}

/**
 * 触发提醒（震动 + 提示音），返回给页面展示的文案
 * 注意：弹层由页面自己渲染，这样样式可控
 */
function fireAlert(next, settings, stage) {
  if (settings.vibrate !== false) vibrate(true);
  if (settings.sound) playAlertSound();

  const left = Math.max(0, next.minutesLeft);
  const urgent = stage === 'final' || left <= (settings.finalAheadMinutes || 5);
  const lines = [];
  lines.push('《' + next.course.name + '》' + (left <= 0 ? '马上开始' : T.humanDuration(left) + '后开始'));
  lines.push(next.periodText + '  ' + next.startTime + '-' + next.endTime);
  lines.push('地点：' + next.room);
  if (next.course.teacher) lines.push('教师：' + next.course.teacher);
  if (next.course.note) lines.push('备注：' + next.course.note);
  if (urgent) lines.push('马上要上课了，请立即出发，不要迟到！');
  return {
    urgent: urgent,
    title: urgent ? '快迟到了！' : '上课提醒',
    content: lines.join('\n'),
    room: next.room,
    startTime: next.startTime,
    courseName: next.course.name,
  };
}

/**
 * 页面调用入口：检查并（按需）触发提醒
 * @param {Boolean} opts.silent 只判断不触发
 */
function checkAndRemind(courses, classrooms, periods, settings, opts) {
  const o = opts || {};
  const now = o.now || new Date();
  const state = evaluate(courses, classrooms, periods, settings, now);
  let alert = null;
  if (state.shouldAlert && !o.silent) {
    alert = fireAlert(state.next, settings, state.stage);
    if (!o.dryRun) markReminded(state.alertKey);
  }
  return { state: state, alert: alert };
}

/** 今日课程总览文案（用于每日首课前的"今天有什么课"提示） */
function todaySummary(courses, classrooms, periods, settings, date) {
  const d = date || new Date();
  const timeline = S.buildTimeline(courses, classrooms, periods, d, settings);
  if (!timeline.courses.length) {
    return { empty: true, title: '今天没有课', content: '可以安排自习或休息' };
  }
  const lines = [];
  for (let i = 0; i < timeline.courses.length; i++) {
    const c = timeline.courses[i];
    lines.push(c.startTime + ' ' + c.name + ' @ ' + c.room);
  }
  return {
    empty: false,
    title: '今天共 ' + timeline.courses.length + ' 节课',
    content: lines.join('\n'),
    first: timeline.courses[0],
    timeline: timeline,
  };
}

module.exports = {
  evaluate,
  fireAlert,
  checkAndRemind,
  todaySummary,
  vibrate,
  playAlertSound,
  remindKey,
  hasReminded,
  markReminded,
  clearReminded,
};
