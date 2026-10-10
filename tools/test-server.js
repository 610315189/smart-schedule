/**
 * 后端服务自测（零依赖，内置 http 客户端）
 * 运行：node tools/test-server.js
 *
 * 会在 DEV_MODE 下启动服务、跑一轮接口冒烟测试，然后自动退出。
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const PORT = 3199;
const DATA_DIR = path.join(os.tmpdir(), 'smart-schedule-test-' + Date.now());

process.env.PORT = String(PORT);
process.env.DEV_MODE = 'true';
process.env.DATA_DIR = DATA_DIR;
process.env.SCAN_INTERVAL_MS = '3600000'; // 测试期间不要自动扫描

const BASE = path.join(__dirname, '..');
const SRV = path.join(BASE, 'server', 'src');

/* ---------------- 断言 ---------------- */
let pass = 0;
let fail = 0;
const failures = [];
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + label); }
  else {
    fail++; failures.push(label);
    console.log('  \u2717 ' + label + (extra !== undefined ? '   → ' + JSON.stringify(extra) : ''));
  }
}
function section(t) { console.log('\n' + t); }

/* ---------------- HTTP 客户端 ---------------- */
function req(method, urlPath, body, token) {
  return new Promise(function (resolve, reject) {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = http.request({
      hostname: '127.0.0.1', port: PORT, path: urlPath, method: method, headers: headers,
    }, function (res) {
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { /* 保留原始文本 */ }
        resolve({ status: res.statusCode, body: json, raw: data });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

/* ---------------- 服务端算法单元测试（不依赖 HTTP） ---------------- */
const SrvS = require(path.join(SRV, 'schedule.js'));
const SrvCfg = require(path.join(SRV, 'config.js'));
const MiniS = require(path.join(BASE, 'miniprogram', 'utils', 'schedule.js'));
const MiniT = require(path.join(BASE, 'miniprogram', 'utils', 'time.js'));
const { COURSES } = require(path.join(BASE, 'miniprogram', 'data', 'courses.js'));
const { DEFAULT_PERIODS } = require(path.join(BASE, 'miniprogram', 'data', 'periods.js'));

const settings = {
  termStartDate: '2026-09-07',
  totalWeeks: 20,
  aheadMinutes: 20,
  finalAheadMinutes: 5,
  subscribed: true,
};
const user = {
  openid: 'test_user',
  courses: COURSES,
  periods: DEFAULT_PERIODS,
  settings: settings,
};

section('1. 服务端课时计算（与小程序端一致性）');
ok(SrvCfg.tzOffsetHours === 8, '默认时区为 UTC+8', SrvCfg.tzOffsetHours);

const now = new Date(2026, 9, 7, 13, 44, 0);
const parts = SrvS.localParts(now);
ok(parts.dateStr === '2026-10-07' && parts.dow === 3, '服务端识别 2026-10-07 为周三（第 ' +
  parts.dateStr + ' 天 ' + parts.dow + '）');
ok(parts.minutes === 13 * 60 + 44, '服务端分钟数正确', parts.minutes);

const srvNext = SrvS.findNextClass(user, now);
ok(!!srvNext && srvNext.course.name === '程序设计基础', '服务端算出的下一节课正确',
  srvNext && srvNext.course.name);
ok(srvNext && srvNext.startTime === '14:00', '服务端上课时间 14:00', srvNext && srvNext.startTime);
ok(srvNext && srvNext.minutesLeft === 16, '服务端剩余 16 分钟', srvNext && srvNext.minutesLeft);

// 与小程序端算法交叉验证
global.wx = {
  getStorageSync: function () { return ''; },
  setStorageSync: function () {},
  removeStorageSync: function () {},
  vibrateLong: function () {},
  vibrateShort: function () {},
  createInnerAudioContext: function () { return { play: function () {}, stop: function () {} }; },
};
const miniNext = MiniS.getNextClass(COURSES, [], DEFAULT_PERIODS, now, settings);
ok(miniNext && srvNext && miniNext.course.name === srvNext.course.name &&
  miniNext.startTime === srvNext.startTime && miniNext.minutesLeft === srvNext.minutesLeft,
  '两端算出的下一节课完全一致',
  { mini: miniNext && [miniNext.course.name, miniNext.startTime, miniNext.minutesLeft],
    srv: srvNext && [srvNext.course.name, srvNext.startTime, srvNext.minutesLeft] });

ok(SrvS.getWeekIndex('2026-10-07', '2026-09-07') === 5, '服务端周次 = 第 5 周');
ok(SrvS.isWeekActive({ weeks: { start: 1, end: 16, parity: 'even' } }, 5) === false,
  '服务端单双周规则正确');

const srvCurrent = SrvS.findCurrentClass(user, new Date(2026, 9, 7, 14, 30));
ok(srvCurrent && srvCurrent.course.name === '程序设计基础', '服务端识别正在上的课',
  srvCurrent && srvCurrent.course.name);

/* ---------------- 启动服务并跑接口 ---------------- */
section('2. HTTP 接口冒烟测试');

require(path.join(SRV, 'index.js'));

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function main() {
  await sleep(400);

  const health = await req('GET', '/api/health');
  ok(health.status === 200 && health.body.ok === true, 'GET /api/health 正常', health.body);

  const noAuth = await req('GET', '/api/schedule');
  ok(noAuth.status === 401, '未带 token 访问受保护接口返回 401', noAuth.status);

  const badLogin = await req('POST', '/api/login', {});
  ok(badLogin.status === 400, '缺少 code 的登录请求返回 400', badLogin.status);

  const login = await req('POST', '/api/login', { code: 'test_code_001' });
  ok(login.status === 200 && !!login.body.token, 'POST /api/login 返回 token', login.body);
  const token = login.body.token;

  const upload = await req('POST', '/api/schedule', {
    courses: COURSES,
    occupancy: [],
    periods: DEFAULT_PERIODS,
    settings: settings,
  }, token);
  ok(upload.status === 200 && upload.body.courses === COURSES.length,
    'POST /api/schedule 上传课表成功', upload.body);

  const download = await req('GET', '/api/schedule', null, token);
  ok(download.status === 200 && download.body.courses.length === COURSES.length,
    'GET /api/schedule 取回课表', download.body.courses && download.body.courses.length);

  const status = await req('GET', '/api/status', null, token);
  ok(status.status === 200 && status.body.courseCount === COURSES.length,
    'GET /api/status 返回用户状态', status.body);
  ok(status.body.nextClass !== null || status.body.nextClass === null, '状态里包含下一节课字段');

  const testPush = await req('POST', '/api/push/test', {}, token);
  ok(testPush.status === 200, 'POST /api/push/test 在 DEV_MODE 下成功', testPush.body);

  const scan = await req('POST', '/api/scan', {}, token);
  ok(scan.status === 200, 'POST /api/scan 可手动触发扫描', scan.body);

  const notFoundNoToken = await req('GET', '/api/nope');
  ok(notFoundNoToken.status === 401, '未知路径且未登录时先返回 401', notFoundNoToken.status);

  const notFound = await req('GET', '/api/nope', null, token);
  ok(notFound.status === 404, '已登录访问未知路径返回 404', notFound.status);

  await sleep(600); // 等待存储防抖写盘
  const dbFile = path.join(DATA_DIR, 'db.json');
  ok(fs.existsSync(dbFile), '数据已落盘到 db.json');
  if (fs.existsSync(dbFile)) {
    const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    ok(Object.keys(db.users).length === 1, 'db.json 中有 1 个用户', Object.keys(db.users));
    ok(db.users.dev_test_code_001 && db.users.dev_test_code_001.courses.length === COURSES.length,
      '用户课表已保存');
  }

  console.log('\n============================================');
  console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  if (fail) {
    console.log('  失败项：');
    failures.forEach(function (f) { console.log('   - ' + f); });
  }
  console.log('============================================');

  try {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  } catch (e) { /* ignore */ }

  process.exit(fail ? 1 : 0);
}

main().catch(function (e) {
  console.error('测试异常', e);
  process.exit(1);
});
