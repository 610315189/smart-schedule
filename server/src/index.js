/**
 * 智能课表后端服务（零依赖，Node 16+）
 * ---------------------------------------------------------------
 * 提供：
 *   POST /api/login          小程序登录（code -> openid -> token）
 *   POST /api/schedule       上传课表与提醒设置
 *   GET  /api/schedule       拉取课表
 *   POST /api/push/test      立刻发一条测试订阅消息
 *   POST /api/scan           手动触发一次扫描（调试）
 *   GET  /api/status         运行状态
 *   GET  /api/health         健康检查
 *
 * 启动：node src/index.js
 */
const http = require('http');
const CFG = require('./config');
const store = require('./store');
const wechat = require('./wechat');
const reminder = require('./reminder');
const S = require('./schedule');

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    req.on('data', function (c) {
      data += c;
      if (data.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('请求体过大'));
      }
    });
    req.on('end', function () {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function tokenOf(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}

const server = http.createServer(async function (req, res) {
  const u = new URL(req.url, 'http://localhost');
  const path = u.pathname;

  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });

  try {
    /* ---------- 无需登录 ---------- */
    if (path === '/api/health' && req.method === 'GET') {
      return send(res, 200, { ok: true, ts: Date.now(), users: store.allUsers().length });
    }

    if (path === '/api/login' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.code) return send(res, 400, { error: '缺少 code' });
      const session = await wechat.code2session(body.code);
      const token = store.issueToken(session.openid);
      store.upsertUser(session.openid, {});
      return send(res, 200, { token: token, openid: session.openid, dev: !!session.dev });
    }

    /* ---------- 以下接口需要 token ---------- */
    const user = store.userByToken(tokenOf(req));
    if (!user) return send(res, 401, { error: '未登录或 token 失效' });

    if (path === '/api/schedule' && req.method === 'POST') {
      const body = await readBody(req);
      if (!Array.isArray(body.courses)) return send(res, 400, { error: 'courses 必须是数组' });
      const saved = store.upsertUser(user.openid, {
        courses: body.courses,
        occupancy: body.occupancy || [],
        periods: body.periods || [],
        settings: body.settings || {},
      });
      return send(res, 200, { ok: true, courses: saved.courses.length });
    }

    if (path === '/api/schedule' && req.method === 'GET') {
      return send(res, 200, {
        courses: user.courses || [],
        occupancy: user.occupancy || [],
        periods: user.periods || [],
        settings: user.settings || {},
      });
    }

    if (path === '/api/push/test' && req.method === 'POST') {
      const next = S.findNextClass(user, new Date()) || {
        course: { id: 'test', name: '测试课程', roomId: 'A301', start: 1, end: 2 },
        startTime: '14:00',
        endTime: '14:45',
        dateStr: S.localParts(new Date()).dateStr,
        minutesLeft: 20,
      };
      const r = await wechat.sendSubscribeMessage(user.openid, reminder.buildMessageData(next));
      return send(res, 200, { ok: !r.errcode || r.errcode === 0, result: r });
    }

    if (path === '/api/scan' && req.method === 'POST') {
      const r = await reminder.scanOnce(true);
      return send(res, 200, r);
    }

    if (path === '/api/status' && req.method === 'GET') {
      const now = S.localParts(new Date());
      const next = S.findNextClass(user, new Date());
      return send(res, 200, {
        ok: true,
        serverTime: now.dateStr + ' ' + pad2(Math.floor(now.minutes / 60)) + ':' + pad2(now.minutes % 60),
        timezone: 'UTC+' + CFG.tzOffsetHours,
        devMode: CFG.devMode,
        templateConfigured: !!CFG.templateId,
        appIdConfigured: !!CFG.appId,
        courseCount: (user.courses || []).length,
        occupancyCount: (user.occupancy || []).length,
        nextClass: next ? {
          name: next.course.name,
          dateStr: next.dateStr,
          startTime: next.startTime,
          roomId: next.course.roomId,
          minutesLeft: next.minutesLeft,
        } : null,
      });
    }

    return send(res, 404, { error: '未知接口 ' + path });
  } catch (e) {
    console.error('[server] 处理失败', path, e.message);
    return send(res, 500, { error: e.message });
  }
});

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

server.listen(CFG.port, function () {
  console.log('==============================================');
  console.log(' 智能课表后端已启动');
  console.log(' 监听端口：' + CFG.port);
  console.log(' 时区：UTC+' + CFG.tzOffsetHours);
  console.log(' 数据文件：' + store.FILE);
  console.log(' AppID：' + (CFG.appId || '（未配置，DEV_MODE=' + CFG.devMode + '）'));
  console.log(' 模板 ID：' + (CFG.templateId || '（未配置，无法真实推送）'));
  console.log(' 开发模式：' + CFG.devMode);
  console.log(' 健康检查：http://127.0.0.1:' + CFG.port + '/api/health');
  console.log('==============================================');
  reminder.start();
});
