/**
 * 服务端配置
 * ---------------------------------------------------------------
 * 所有配置通过环境变量提供，也可以写进 server/.env 文件（本文件会自动加载）。
 * 复制 .env.example 为 .env 后填写即可。
 */
const fs = require('fs');
const path = require('path');

/** 极简 .env 加载（不引入第三方依赖） */
function loadEnvFile() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  text.split(/\r?\n/).forEach(function (line) {
    const s = line.trim();
    if (!s || s[0] === '#') return;
    const i = s.indexOf('=');
    if (i < 0) return;
    const key = s.slice(0, i).trim();
    let val = s.slice(i + 1).trim();
    if ((val[0] === '"' && val[val.length - 1] === '"') || (val[0] === "'" && val[val.length - 1] === "'")) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  });
}

loadEnvFile();

const CFG = {
  port: Number(process.env.PORT || 3000),
  /** 微信小程序 AppID / AppSecret */
  appId: process.env.WX_APPID || '',
  appSecret: process.env.WX_SECRET || '',
  /** 订阅消息模板 ID（公众平台-订阅消息-我的模板） */
  templateId: process.env.WX_TEMPLATE_ID || '',
  /** 点击通知后跳转的小程序页面 */
  page: process.env.WX_PUSH_PAGE || 'pages/index/index',

  /** 数据文件目录 */
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),

  /** 扫描间隔（毫秒）：建议 30-60 秒 */
  scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS || 30000),

  /** 时区偏移（小时）：中国大陆为 8 */
  tzOffsetHours: Number(process.env.TZ_OFFSET_HOURS || 8),

  /** 是否提前 alertMinutes 之外再补一次"最后提醒" */
  finalPush: String(process.env.FINAL_PUSH || 'false') === 'true',

  /** 开发模式：不校验微信 code，直接用 code 当 openid，方便本地联调 */
  devMode: String(process.env.DEV_MODE || 'false') === 'true',

  /** 订阅消息模板字段名映射：模板不同，字段名一般也不一样，按自己模板改 */
  templateFields: {
    course: process.env.TF_COURSE || 'thing1',
    time: process.env.TF_TIME || 'time2',
    room: process.env.TF_ROOM || 'thing3',
    tip: process.env.TF_TIP || 'thing4',
  },
};

module.exports = CFG;
