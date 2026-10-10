/**
 * 课前提醒扫描任务
 * ---------------------------------------------------------------
 * 每隔 scanIntervalMs 扫描一次全部用户：
 *   下一节课距现在的分钟数 <= 用户设置的 aheadMinutes，且这节课还没推送过
 *   → 发送一条订阅消息。
 *
 * 说明：微信订阅消息是"用户授权一次、可发一条"的机制。
 * 用户每次打开小程序都会重新授权（见小程序设置页），因此需要在
 * 小程序端引导用户"每次上课前打开一次"，或者改用长期订阅模板（仅特定行业开放）。
 */
const CFG = require('./config');
const store = require('./store');
const wechat = require('./wechat');
const S = require('./schedule');

let timer = null;
let running = false;

function truncate(str, max) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** 按模板要求组装 data */
function buildMessageData(next) {
  const f = CFG.templateFields;
  const tip = next.minutesLeft <= 1
    ? '马上开始，请立即前往教室'
    : '还有 ' + next.minutesLeft + ' 分钟上课，记得准时';
  const data = {};
  data[f.course] = { value: truncate(next.course.name, 20) };
  data[f.time] = { value: next.startTime };
  data[f.room] = { value: truncate(next.course.roomId || '教室待定', 20) };
  data[f.tip] = { value: truncate(tip, 20) };
  return data;
}

async function scanOnce(verbose) {
  if (running) return { skipped: true };
  running = true;
  const now = new Date();
  const users = store.allUsers();
  let pushed = 0;
  let checked = 0;
  const errors = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    if (!u.courses || !u.courses.length) continue;
    if (!u.settings || u.settings.subscribed === false) continue;
    checked++;

    const next = S.findNextClass(u, now);
    if (!next) continue;

    const ahead = (u.settings && u.settings.aheadMinutes) || 20;
    const finalAhead = (u.settings && u.settings.finalAheadMinutes) || 5;

    // 主提醒 +（可选）最后提醒
    const stages = [];
    if (next.minutesLeft <= ahead) stages.push('main');
    if (CFG.finalPush && next.minutesLeft <= finalAhead) stages.push('final');
    if (!stages.length) continue;

    for (let k = 0; k < stages.length; k++) {
      const stage = stages[k];
      const key = next.course.id + '_' + next.dateStr + '_' + next.course.start + '_' + stage;
      if (store.hasPushed(u.openid, key)) continue;

      try {
        if (stage === 'main') {
          const r = await wechat.sendSubscribeMessage(u.openid, buildMessageData(next));
          if (r && r.errcode && r.errcode !== 0) {
            errors.push(u.openid + ': ' + r.errcode + ' ' + r.errmsg);
            // 43101 = 用户未订阅/已用完订阅次数，标记避免反复重试
            if (r.errcode === 43101) store.markPushed(u.openid, key);
          } else {
            store.markPushed(u.openid, key);
            pushed++;
            if (verbose) {
              console.log('[reminder] 已推送', u.openid, next.course.name, next.startTime, next.minutesLeft + '分钟');
            }
          }
        } else {
          store.markPushed(u.openid, key);
        }
      } catch (e) {
        errors.push(u.openid + ': ' + e.message);
      }
    }

    // 只推送当天最近的课，避免一次扫出多节课
  }

  running = false;
  return { checked: checked, pushed: pushed, errors: errors };
}

function start() {
  if (timer) return;
  // 启动后延迟 5 秒跑第一次，避免和服务启动日志抢输出
  setTimeout(function () { scanOnce(false).catch(function () {}); }, 5000);
  timer = setInterval(function () {
    scanOnce(false).catch(function (e) { console.error('[reminder] 扫描异常', e.message); });
  }, CFG.scanIntervalMs);
  console.log('[reminder] 已启动，每 ' + Math.round(CFG.scanIntervalMs / 1000) + ' 秒扫描一次');
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  scanOnce,
  start,
  stop,
  buildMessageData,
};
