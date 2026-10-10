/**
 * 微信接口封装（零依赖，只用 Node 内置 https）
 *  - code2session：小程序登录换 openid
 *  - getAccessToken：带缓存的接口调用凭证
 *  - sendSubscribeMessage：发送订阅消息（课前提醒）
 */
const https = require('https');
const CFG = require('./config');

let tokenCache = { value: '', expireAt: 0 };

function httpsJson(method, url, body) {
  return new Promise(function (resolve, reject) {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      method: method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {},
    };
    if (payload) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(options, function (res) {
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('返回内容不是 JSON：' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, function () { req.destroy(new Error('请求超时')); });
    if (payload) req.write(payload);
    req.end();
  });
}

/** 小程序登录：code -> openid */
async function code2session(code) {
  if (CFG.devMode) {
    return { openid: 'dev_' + code, session_key: 'dev', dev: true };
  }
  if (!CFG.appId || !CFG.appSecret) {
    throw new Error('未配置 WX_APPID / WX_SECRET');
  }
  const url = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + encodeURIComponent(CFG.appId) +
    '&secret=' + encodeURIComponent(CFG.appSecret) +
    '&js_code=' + encodeURIComponent(code) + '&grant_type=authorization_code';
  const r = await httpsJson('GET', url, null);
  if (r.errcode) throw new Error('微信登录失败 ' + r.errcode + ': ' + r.errmsg);
  return r;
}

/** access_token（微信侧有效期 7200 秒，这里提前 5 分钟过期重取） */
async function getAccessToken(force) {
  const now = Date.now();
  if (!force && tokenCache.value && tokenCache.expireAt > now) {
    return tokenCache.value;
  }
  if (CFG.devMode) {
    return 'dev_token';
  }
  if (!CFG.appId || !CFG.appSecret) {
    throw new Error('未配置 WX_APPID / WX_SECRET');
  }
  const url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' +
    encodeURIComponent(CFG.appId) + '&secret=' + encodeURIComponent(CFG.appSecret);
  const r = await httpsJson('GET', url, null);
  if (!r.access_token) {
    throw new Error('获取 access_token 失败：' + JSON.stringify(r));
  }
  tokenCache = { value: r.access_token, expireAt: now + (r.expires_in - 300) * 1000 };
  return tokenCache.value;
}

/**
 * 发送订阅消息
 * @param {String} openid
 * @param {Object} data  形如 { thing1: { value: '高等数学' }, time2: { value: '14:00' } }
 */
async function sendSubscribeMessage(openid, data, page) {
  if (CFG.devMode) {
    console.log('[wechat][DEV] 模拟发送订阅消息 ->', openid, JSON.stringify(data));
    return { errcode: 0, errmsg: 'ok(dev)' };
  }
  if (!CFG.templateId) throw new Error('未配置 WX_TEMPLATE_ID');
  const token = await getAccessToken();
  const url = 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' + token;
  const body = {
    touser: openid,
    template_id: CFG.templateId,
    page: page || CFG.page,
    miniprogram_state: process.env.WX_MINIPROGRAM_STATE || 'formal',
    lang: 'zh_CN',
    data: data,
  };
  let r = await httpsJson('POST', url, body);
  // access_token 失效时强制刷新重试一次
  if (r.errcode === 40001 || r.errcode === 42001) {
    const fresh = await getAccessToken(true);
    r = await httpsJson('POST', 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' + fresh, body);
  }
  return r;
}

module.exports = {
  httpsJson,
  code2session,
  getAccessToken,
  sendSubscribeMessage,
};
