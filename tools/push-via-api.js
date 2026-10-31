#!/usr/bin/env node
/**
 * 通过 Gitee API 推送网页版内容（不需要安装 git）
 * ---------------------------------------------------------------
 * 用途：把本地新增/修改的文件直接提交到 Gitee 仓库。
 * 因为 Gitee 没有公开的 git/blobs 接口，只能走 contents API，
 * 所以每个文件会产生一个提交（共二十几个）。
 *
 * 用法：
 *   1) 到 Gitee「设置 → 安全设置 → 私人令牌」生成令牌，勾选 projects 权限
 *   2) 运行：
 *        node tools/push-via-api.js
 *      按提示粘贴令牌（不会显示在屏幕上，也不会被保存）
 *
 *      也可以用环境变量：
 *        $env:GITEE_TOKEN="你的令牌"; node tools/push-via-api.js
 *
 *   3) 想只演练不真正提交，加 --dry-run
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const OWNER = 'lu-mingbo';
const REPO = 'smart-schedule';
const BRANCH = 'master';
const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

/** 需要新增或更新的文件（相对项目根目录） */
const UPLOAD = [
  // 网页版主体
  'web/index.html',
  'web/manifest.json',
  'web/sw.js',
  'web/standalone.html',
  'web/css/app.css',
  'web/js/wx-shim.js',
  'web/js/bundle.js',
  'web/js/ics.js',
  'web/js/ui.js',
  'web/js/app.js',
  'web/icons/icon-192.png',
  'web/icons/icon-512.png',
  'web/icons/icon-maskable-512.png',
  // 构建与测试脚本
  'tools/build-web.js',
  'tools/build-standalone.js',
  'tools/serve-web.js',
  'tools/make-qrcode.js',
  'tools/test-web.js',
  'tools/test-web-ui.js',
  // 文档
  'docs/网页版说明.md',
  'docs/推送到Gitee.md',
  // 根目录更新
  '.gitignore',
  'README.md',
];

/** 需要从远程删除的文件（含真实班级信息的隐私样本） */
const DELETE = [
  'tools/samples/sample-jwxt-real.xlsx',
];

function api(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://gitee.com/api/v5' + urlPath);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method: method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      timeout: 60000,
      headers: { 'User-Agent': 'smart-schedule-push', Accept: 'application/json' },
    };
    if (token) opts.headers.Authorization = 'token ' + token;
    if (payload) {
      opts.headers['Content-Type'] = 'application/json;charset=UTF-8';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(opts, function (res) {
      let d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () {
        let json = null;
        try { json = JSON.parse(d); } catch (e) { /* 保留原文 */ }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(json || {});
        else reject(new Error('HTTP ' + res.statusCode + '  ' + (d || '').slice(0, 300)));
      });
    });
    req.on('error', reject);
    req.on('timeout', function () { req.destroy(new Error('请求超时')); });
    if (payload) req.write(payload);
    req.end();
  });
}

/** 取远程文件当前的 sha（更新已有文件时必须带上） */
async function getRemoteSha(filePath, token) {
  try {
    const q = '?access_token=' + encodeURIComponent(token) + '&ref=' + encodeURIComponent(BRANCH);
    const r = await api('GET', '/repos/' + OWNER + '/' + REPO + '/contents/' +
      filePath.split('/').map(encodeURIComponent).join('/') + q, null, token);
    return r && r.sha ? r.sha : null;
  } catch (e) {
    return null;
  }
}

async function putFile(filePath, token) {
  const abs = path.join(ROOT, filePath);
  if (!fs.existsSync(abs)) {
    return { file: filePath, ok: false, msg: '本地文件不存在' };
  }
  const buf = fs.readFileSync(abs);
  const content = buf.toString('base64');
  const sha = await getRemoteSha(filePath, token);

  if (DRY_RUN) {
    return { file: filePath, ok: true, msg: (sha ? '更新' : '新增') + '（演练，未提交）' };
  }

  const body = {
    access_token: token,
    content: content,
    message: (sha ? 'update: ' : 'add: ') + filePath + '（网页版）',
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  await api('POST', '/repos/' + OWNER + '/' + REPO + '/contents/' +
    filePath.split('/').map(encodeURIComponent).join('/'), body, token);
  return { file: filePath, ok: true, msg: sha ? '已更新' : '已新增', size: buf.length };
}

async function delFile(filePath, token) {
  const abs = path.join(ROOT, filePath);
  const sha = await getRemoteSha(filePath, token);
  if (!sha) {
    // 即使本地没有，也尝试按远程 sha 删除
    return { file: filePath, ok: false, msg: '远程不存在该文件（无需删除）' };
  }
  if (DRY_RUN) return { file: filePath, ok: true, msg: '删除（演练，未提交）' };
  await api('DELETE', '/repos/' + OWNER + '/' + REPO + '/contents/' +
    filePath.split('/').map(encodeURIComponent).join('/'),
    { access_token: token, message: 'remove: ' + filePath + '（含个人信息，不应公开）', sha: sha, branch: BRANCH },
    token);
  return { file: filePath, ok: true, msg: '已删除' };
}

function askToken() {
  return new Promise(function (resolve) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('请粘贴 Gitee 私人令牌（输入后回车，不会回显）：', function (answer) {
      rl.close();
      resolve(String(answer || '').trim());
    });
  });
}

(async function main() {
  console.log('==================================================');
  console.log(' 推送网页版内容到 Gitee: ' + OWNER + '/' + REPO + '  (分支 ' + BRANCH + ')');
  console.log(' 待上传 ' + UPLOAD.length + ' 个文件，待删除 ' + DELETE.length + ' 个文件');
  if (DRY_RUN) console.log(' *** 演练模式：只检查，不实际提交 ***');
  console.log('==================================================\n');

  let token = process.env.GITEE_TOKEN || process.env.GITEE_ACCESS_TOKEN || '';
  if (!token) {
    token = await askToken();
  }
  if (!token) {
    console.error('没有提供令牌，已退出。');
    process.exit(1);
  }

  // 先验证令牌
  try {
    const me = await api('GET', '/user?access_token=' + encodeURIComponent(token), null, token);
    console.log('令牌有效，当前账号: ' + (me.login || me.name || '(未知)') + '\n');
  } catch (e) {
    console.error('令牌校验失败: ' + e.message);
    console.error('请确认：① 令牌权限包含 projects；② 没有多余空格。');
    process.exit(1);
  }

  let okCount = 0;
  let failCount = 0;

  // 1) 删除隐私文件
  if (DELETE.length) {
    console.log('--- 删除含个人信息的文件 ---');
    for (const f of DELETE) {
      try {
        const r = await delFile(f, token);
        console.log('  ' + (r.ok ? '✓' : '-') + ' ' + f + '  ' + r.msg);
        if (r.ok) okCount++;
      } catch (e) {
        failCount++;
        console.log('  ✗ ' + f + '  ' + e.message);
      }
    }
    console.log('');
  }

  // 2) 上传文件
  console.log('--- 上传网页版与文档 ---');
  let i = 0;
  for (const f of UPLOAD) {
    i++;
    try {
      const r = await putFile(f, token);
      console.log('  [' + i + '/' + UPLOAD.length + '] ' + (r.ok ? '✓' : '✗') + ' ' + f +
        '  ' + r.msg + (r.size ? ' (' + (r.size / 1024).toFixed(1) + ' KB)' : ''));
      if (r.ok) okCount++; else failCount++;
    } catch (e) {
      failCount++;
      console.log('  [' + i + '/' + UPLOAD.length + '] ✗ ' + f + '  ' + e.message);
    }
    // 轻微限速，避免触发 API 频率限制
    await new Promise(function (r) { setTimeout(r, 350); });
  }

  console.log('\n==================================================');
  console.log(' 完成：成功 ' + okCount + ' 项，失败 ' + failCount + ' 项');
  console.log(' 仓库地址: https://gitee.com/' + OWNER + '/' + REPO);
  if (failCount) {
    console.log(' 有失败项，可重新运行本脚本（已成功的文件会被识别为"更新"并覆盖）。');
  }
  console.log('==================================================');
  process.exit(failCount ? 1 : 0);
})().catch(function (e) {
  console.error('执行失败: ' + e.message);
  process.exit(1);
});
