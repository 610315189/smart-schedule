/**
 * 手机系统日历同步（第三道保险里最可靠的一道）
 * ---------------------------------------------------------------
 * 小程序本身不能后台常驻，但把课程写进【手机系统日历】后，
 * 即使从不打开小程序，系统也会按设定时间响铃提醒 —— 这是防误课的关键。
 *
 * 使用 wx.addPhoneCalendar（基础库 2.15.0+，目前仅移动端真机有效，
 * 开发者工具内会直接走 fail，属正常现象）。
 */
const T = require('./time');
const S = require('./schedule');

function addOne(opts) {
  return new Promise(function (resolve) {
    wx.addPhoneCalendar({
      title: opts.title,
      startTime: opts.startTime,
      endTime: opts.endTime,
      alarm: true,
      alarmOffset: opts.alarmOffset,
      allDay: false,
      description: opts.description,
      location: opts.location,
      success: function () { resolve({ ok: true }); },
      fail: function (err) { resolve({ ok: false, err: err }); },
    });
  });
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

/**
 * 把课表同步到系统日历
 * @param {Array} courses   课程数组（已 normalize）
 * @param {Object} settings 设置
 * @param {Array} periods   节次表
 * @param {Object} opts
 *   opts.scope      'all' 整学期 | 'week' 仅本周 | 'nextWeek' 仅下周
 *   opts.week       指定周次（scope='week' 时）
 *   opts.onProgress function(done, total, title)
 *   opts.dryRun     只统计不真正写入
 * @returns {Promise<{total, success, failed, errors}>}
 */
async function syncToCalendar(courses, settings, periods, opts) {
  const o = opts || {};
  const scope = o.scope || 'all';
  const termStart = settings.termStartDate;
  const totalWeeks = settings.totalWeeks;
  const ahead = settings.aheadMinutes || 20;

  const tasks = [];
  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    let dates;
    if (scope === 'all') {
      dates = S.expandCourseDates(course, termStart, totalWeeks);
    } else {
      let week = o.week;
      if (!week) {
        const cur = T.getWeekIndex(new Date(), termStart);
        week = scope === 'nextWeek' ? cur + 1 : cur;
      }
      const days = T.weekDates(week, termStart);
      const d = days[Number(course.day) - 1];
      dates = (d && S.isWeekActive(course, week, totalWeeks)) ? [{ date: d, week: week }] : [];
    }
    for (let k = 0; k < dates.length; k++) {
      const t = S.periodRange(periods, course.start, course.end);
      const start = T.atTime(dates[k].date, t.start);
      const end = T.atTime(dates[k].date, t.end);
      tasks.push({
        title: course.name + (course.roomId ? ' @' + course.roomId : ''),
        startTime: T.toTimestamp(start),
        endTime: T.toTimestamp(end),
        alarmOffset: ahead * 60,
        description: [course.teacher ? '教师：' + course.teacher : '', course.note ? '备注：' + course.note : '',
          S.formatPeriods(course.start, course.end), S.formatWeeks(course.weeks)].filter(Boolean).join('；'),
        location: course.roomId || '',
        day: dates[k].date,
      });
    }
  }

  tasks.sort(function (a, b) { return a.startTime - b.startTime; });

  if (o.dryRun) {
    return { total: tasks.length, success: 0, failed: 0, errors: [], tasks: tasks };
  }

  let success = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const r = await addOne(t);
    if (r.ok) {
      success++;
    } else {
      failed++;
      const msg = (r.err && (r.err.errMsg || r.err.errmsg)) || '未知错误';
      if (errors.indexOf(msg) < 0) errors.push(msg);
      // 用户拒绝授权后继续调用只会一直失败，直接中断
      if (/auth deny|authorize|permission/i.test(msg)) {
        return { total: tasks.length, success: success, failed: tasks.length - success, errors: errors, aborted: true };
      }
    }
    if (typeof o.onProgress === 'function' && (i % 5 === 0 || i === tasks.length - 1)) {
      o.onProgress(i + 1, tasks.length, t.title);
    }
    await sleep(120);
  }

  return { total: tasks.length, success: success, failed: failed, errors: errors };
}

/**
 * 确保拿到日历写入授权；返回 true/false
 */
function ensureAuth() {
  return new Promise(function (resolve) {
    wx.getSetting({
      success: function (res) {
        const auth = res.authSetting || {};
        if (auth['scope.addPhoneCalendar'] === true) return resolve(true);
        if (auth['scope.addPhoneCalendar'] === false) {
          wx.showModal({
            title: '需要日历权限',
            content: '请在"设置-授权管理"中允许"添加到日历"，才能把课程写入手机日历。',
            confirmText: '去设置',
            success: function (r) {
              if (r.confirm) {
                wx.openSetting({
                  success: function (s) {
                    resolve(!!(s.authSetting && s.authSetting['scope.addPhoneCalendar']));
                  },
                  fail: function () { resolve(false); },
                });
              } else {
                resolve(false);
              }
            },
          });
          return;
        }
        resolve(true);
      },
      fail: function () { resolve(true); },
    });
  });
}

module.exports = {
  syncToCalendar,
  ensureAuth,
};
