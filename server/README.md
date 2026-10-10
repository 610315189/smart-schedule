# 后端部署说明（微信订阅消息推送）

## 一、这个服务做什么

让用户在**不打开小程序**的情况下，也能在课前收到一条微信服务通知。

```
小程序设置页点「开启课前通知」
        ↓ wx.requestSubscribeMessage（用户授权一次）
小程序上传课表  →  POST /api/schedule
        ↓
后端每 30 秒扫描一次：下一节课距现在 ≤ 用户设定的提前分钟数？
        ↓ 是
POST /api/push/test 或定时任务 → 微信订阅消息 → 用户收到通知
```

## 二、零依赖部署

服务只用 Node 内置模块，**不需要 `npm install`**。

```bash
cd server
cp .env.example .env      # Windows: copy .env.example .env
# 编辑 .env 填入 WX_APPID / WX_SECRET / WX_TEMPLATE_ID
node src/index.js
```

启动后输出：

```
==============================================
 智能课表后端已启动
 监听端口：3000
 时区：UTC+8
 数据文件：.../server/data/db.json
==============================================
[reminder] 已启动，每 30 秒扫描一次
```

## 三、开通微信订阅消息（必做）

1. 登录 [微信公众平台](https://mp.weixin.qq.com) → **订阅消息 → 公共模板库**
2. 搜索并选用「**上课提醒**」类模板，或自建模板，字段建议：
   | 字段 | 类型 | 内容示例 |
   |---|---|---|
   | 课程名称 | `thing` | 程序设计基础 |
   | 上课时间 | `time` | 14:00 |
   | 上课地点 | `thing` | A301 |
   | 温馨提示 | `thing` | 还有 20 分钟上课，记得准时 |
3. 记下**模板 ID**，填到 `.env` 的 `WX_TEMPLATE_ID`
4. 把模板字段名填到 `.env`（默认是 `thing1` / `time2` / `thing3` / `thing4`）：
   ```
   TF_COURSE=thing1
   TF_TIME=time2
   TF_ROOM=thing3
   TF_TIP=thing4
   ```
5. 在公众平台 **开发管理 → 服务器域名** 里把后端域名加入 `request` 合法域名
   （本地调试可在开发者工具「详情 → 本地设置」勾选"不校验合法域名"）

## 四、配置小程序端

编辑 `miniprogram/config/index.js`：

```js
const SERVER = {
  baseUrl: 'https://你的域名',           // 建议 https
  subscribeTemplateId: '模板 ID',
};
```

配置后：
- 「设置 → 微信课前通知 → 开启课前通知」会真正调用 `wx.requestSubscribeMessage`
- 「设置 → 上传课表」会把课表同步到后端

## 五、接口一览

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/health` | 否 | 健康检查，返回用户数 |
| POST | `/api/login` | 否 | `{code}` → `{token, openid}` |
| POST | `/api/schedule` | Bearer | 上传课表 / 占用表 / 节次表 / 设置 |
| GET | `/api/schedule` | Bearer | 拉取课表 |
| POST | `/api/push/test` | Bearer | 立刻给自己发一条测试通知 |
| POST | `/api/scan` | Bearer | 手动触发一次扫描（调试用） |
| GET | `/api/status` | Bearer | 运行状态、下一节课、配置是否齐全 |

示例：

```bash
# 健康检查
curl http://127.0.0.1:3000/api/health

# 登录（DEV_MODE=true 时任意 code 都能换到 token）
curl -X POST http://127.0.0.1:3000/api/login \
  -H "Content-Type: application/json" -d "{\"code\":\"abc\"}"
```

## 六、环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 3000 | 监听端口 |
| `WX_APPID` / `WX_SECRET` | 空 | 小程序凭证 |
| `WX_TEMPLATE_ID` | 空 | 订阅消息模板 ID |
| `WX_PUSH_PAGE` | `pages/index/index` | 点击通知跳转页面 |
| `TF_COURSE/TF_TIME/TF_ROOM/TF_TIP` | `thing1/time2/thing3/thing4` | 模板字段名映射 |
| `SCAN_INTERVAL_MS` | 30000 | 扫描间隔 |
| `TZ_OFFSET_HOURS` | 8 | 时区偏移，中国大陆填 8 |
| `FINAL_PUSH` | false | 是否额外发一条"最后提醒" |
| `DEV_MODE` | false | 不校验微信 code，推送只打日志（仅本地调试） |
| `DATA_DIR` | `server/data` | 数据文件目录 |

## 七、生产部署建议

1. **进程守护**：用 `pm2 start src/index.js --name smart-schedule`，或写 systemd unit
2. **HTTPS**：微信要求 request 合法域名必须 https，建议 Nginx 反代 + 证书
3. **换存储**：`store.js` 是 JSON 文件存储，单机够用；多实例部署时把
   `userByToken` / `upsertUser` / `hasPushed` / `markPushed` 换成 Redis 或数据库实现即可，
   对外方法签名保持不变，其余代码无需改动
4. **定时精度**：扫描间隔建议 ≤ 60 秒；`reminder.js` 用"已推送去重"而不是时间窗口，
   所以即使某次扫描延迟也不会漏推

## 八、重要限制（务必了解）

微信订阅消息是**一次性订阅**：用户授权一次 → 只能发一条。
用户每打开一次小程序并授权，就多一次可发送的机会。

因此：

- 若用户长期不打开小程序，通知会因"次数用尽"而失败（错误码 `43101`）
- 服务端遇到 `43101` 会记录并停止对该条的重复重试，不会刷日志

真正"绝对不漏"的方案是**手机系统日历**（`wx.addPhoneCalendar`），
它由操作系统负责提醒，与小程序是否打开无关。建议两者一起用：

- 系统日历 → 保证一定会响
- 微信通知 → 附加的、更早的提醒
