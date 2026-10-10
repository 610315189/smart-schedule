/**
 * 极简 JSON 文件存储
 * ---------------------------------------------------------------
 * 目的是让服务开箱即用、不依赖数据库。
 * 用户量变大或需要多实例部署时，把这里的读写替换成 Redis / MySQL 即可，
 * 对外暴露的方法签名保持不变。
 */
const fs = require('fs');
const path = require('path');
const CFG = require('./config');

const FILE = path.join(CFG.dataDir, 'db.json');

let cache = null;

function ensureDir() {
  if (!fs.existsSync(CFG.dataDir)) {
    fs.mkdirSync(CFG.dataDir, { recursive: true });
  }
}

function load() {
  if (cache) return cache;
  ensureDir();
  if (fs.existsSync(FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch (e) {
      console.error('[store] db.json 解析失败，已重置', e.message);
      cache = { users: {}, tokens: {}, pushed: {} };
    }
  } else {
    cache = { users: {}, tokens: {}, pushed: {} };
  }
  cache.users = cache.users || {};
  cache.tokens = cache.tokens || {};
  cache.pushed = cache.pushed || {};
  return cache;
}

let saveTimer = null;
/** 合并短时间内的多次写入，减少磁盘 IO */
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(function () {
    saveTimer = null;
    try {
      ensureDir();
      fs.writeFileSync(FILE, JSON.stringify(cache));
    } catch (e) {
      console.error('[store] 写入失败', e.message);
    }
  }, 300);
}

/** 进程退出前把未落盘的改动同步写入，避免丢数据 */
function flushSync() {
  if (!cache) return;
  try {
    ensureDir();
    fs.writeFileSync(FILE, JSON.stringify(cache));
  } catch (e) {
    console.error('[store] 退出时写入失败', e.message);
  }
}

process.on('exit', flushSync);
process.on('SIGINT', function () { flushSync(); process.exit(0); });
process.on('SIGTERM', function () { flushSync(); process.exit(0); });

function issueToken(openid) {  const db = load();
  const token = openid + '.' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  db.tokens[token] = { openid: openid, createdAt: Date.now() };
  save();
  return token;
}

function userByToken(token) {
  if (!token) return null;
  const db = load();
  const t = db.tokens[token];
  if (!t) return null;
  return db.users[t.openid] || null;
}

function upsertUser(openid, patch) {
  const db = load();
  const u = Object.assign({ openid: openid, createdAt: Date.now() }, db.users[openid] || {}, patch);
  u.updatedAt = Date.now();
  db.users[openid] = u;
  save();
  return u;
}

function allUsers() {
  const db = load();
  return Object.keys(db.users).map(function (k) { return db.users[k]; });
}

/** 推送去重：同一节课只推一次 */
function hasPushed(openid, key) {
  const db = load();
  return !!(db.pushed[openid] && db.pushed[openid][key]);
}

function markPushed(openid, key) {
  const db = load();
  if (!db.pushed[openid]) db.pushed[openid] = {};
  db.pushed[openid][key] = Date.now();
  // 清理 7 天前的记录
  const edge = Date.now() - 7 * 86400000;
  const keys = Object.keys(db.pushed[openid]);
  for (let i = 0; i < keys.length; i++) {
    if (db.pushed[openid][keys[i]] < edge) delete db.pushed[openid][keys[i]];
  }
  save();
}

module.exports = {
  FILE,
  load,
  save,
  flushSync,
  issueToken,
  userByToken,
  upsertUser,
  allUsers,
  hasPushed,
  markPushed,
};
