/**
 * 后端接口封装（可选模块）
 * ---------------------------------------------------------------
 * 只在 config/index.js 里配置了 SERVER.baseUrl 时启用。
 * 后端负责：微信登录换 openid、保存课表、课前订阅消息推送。
 */
const CFG = require('../config/index');

let cachedToken = '';

function enabled() {
  return !!CFG.SERVER.baseUrl;
}

function request(path, method, data) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: CFG.SERVER.baseUrl + path,
      method: method || 'GET',
      data: data || {},
      header: {
        'content-type': 'application/json',
        Authorization: cachedToken ? 'Bearer ' + cachedToken : '',
      },
      timeout: 10000,
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject({ statusCode: res.statusCode, data: res.data });
      },
      fail: function (err) { reject(err); },
    });
  });
}

function wxLogin() {
  return new Promise(function (resolve, reject) {
    wx.login({
      success: function (res) { res.code ? resolve(res.code) : reject(res); },
      fail: reject,
    });
  });
}

/** 登录并缓存 token */
async function ensureToken() {
  if (cachedToken) return cachedToken;
  const code = await wxLogin();
  const r = await request('/api/login', 'POST', { code: code });
  cachedToken = r.token || '';
  return cachedToken;
}

/** 上传课表 + 提醒设置，供后端定时推送 */
async function pushSchedule(payload) {
  await ensureToken();
  return request('/api/schedule', 'POST', payload);
}

/** 拉取服务端保存的课表 */
async function pullSchedule() {
  await ensureToken();
  return request('/api/schedule', 'GET');
}

/** 测试推送：让后端立刻给自己发一条订阅消息 */
async function testPush() {
  await ensureToken();
  return request('/api/push/test', 'POST', {});
}

module.exports = {
  enabled,
  request,
  ensureToken,
  pushSchedule,
  pullSchedule,
  testPush,
};
