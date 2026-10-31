#!/usr/bin/env node
/**
 * 网页版静态服务器（零依赖）
 * ---------------------------------------------------------------
 * 用法：
 *   node tools/serve-web.js            # 默认 8080 端口，局域网可访问
 *   PORT=9000 node tools/serve-web.js  # 自定义端口
 *
 * 启动后会打印本机所有可用的访问地址，手机连同一个 WiFi 即可打开。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', 'web');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.ics': 'text/calendar; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(function (name) {
    (ifaces[name] || []).forEach(function (info) {
      if (info.family === 'IPv4' && !info.internal) {
        out.push({ name: name, ip: info.address, score: scoreAddr(name, info.address) });
      }
    });
  });
  out.sort(function (a, b) { return b.score - a.score; });
  return out;
}

/** 虚拟网卡手机连不上，打分时排除；家用 WiFi 网段加权 */
function scoreAddr(name, ip) {
  const n = String(name).toLowerCase();
  let s = 0;
  if (/^192\.168\./.test(ip)) s += 100;
  else if (/^10\./.test(ip)) s += 80;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) s += 40;
  if (/vethernet|virtual|vmware|virtualbox|hyper-?v|loopback|wsl|docker|tap|tun/.test(n)) s -= 300;
  if (/wi-?fi|wlan|wireless|无线/.test(n)) s += 40;
  if (/ethernet|以太网|本地连接/.test(n)) s += 15;
  return s;
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const resolved = path.normalize(path.join(root, decoded));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

const server = http.createServer(function (req, res) {
  let urlPath = req.url || '/';
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  let filePath = safeJoin(ROOT, urlPath);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 禁止访问');
    return;
  }

  // 目录 -> index.html
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (e) { /* ignore */ }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>找不到 ' + urlPath + '</p><p><a href="./">返回首页</a></p>');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, function (err, buf) {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 读取失败');
      return;
    }

    // 给 HTML 注入本机局域网地址，页面里的「分享二维码」才能生成手机可访问的链接
    if (ext === '.html') {
      const ips = lanAddresses();
      const host = ips.length ? ips[0].ip : '';
      const inject = '<script>window.__SS_HOST__=' + JSON.stringify({
        lan: host,
        port: PORT,
      }) + ';</script>';
      let html = buf.toString('utf8');
      html = html.replace('</head>', inject + '\n</head>');
      const out = Buffer.from(html, 'utf8');
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': out.length,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(out);
      return;
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': buf.length,
      'Cache-Control': 'no-cache',
      // 允许被局域网内其它设备访问
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buf);
  });
});

server.listen(PORT, HOST, function () {
  const ips = lanAddresses();
  console.log('');
  console.log('  智能课表 · 网页版已启动');
  console.log('  ' + '-'.repeat(46));
  console.log('  本机访问：http://localhost:' + PORT);
  if (ips.length) {
    ips.forEach(function (x, i) {
      const tag = i === 0 ? '  ← 推荐（手机扫这个）' : '';
      console.log('  局域网访问：http://' + x.ip + ':' + PORT + '   （' + x.name + '）' + tag);
    });
  } else {
    console.log('  未检测到局域网地址');
  }
  console.log('  ' + '-'.repeat(46));
  console.log('  手机连同一个 WiFi，扫码或直接输入上面的局域网地址即可');
  console.log('  按 Ctrl+C 停止');
  console.log('');
});
