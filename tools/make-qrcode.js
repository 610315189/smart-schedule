#!/usr/bin/env node
/**
 * 生成访问二维码
 * ---------------------------------------------------------------
 * 用法：
 *   node tools/make-qrcode.js                        # 自动用本机局域网 IP + 8080
 *   node tools/make-qrcode.js --url http://x.x.x.x   # 指定地址
 *   node tools/make-qrcode.js --out qr.png           # 指定输出文件
 *
 * 二维码图片来自公共接口 api.qrserver.com（只发送 URL 本身，不含任何个人信息）。
 * 如果你完全离线，也可以不生成二维码——直接把地址告诉同学即可。
 */
const https = require('https');
const os = require('os');
const fs = require('fs');
const path = require('path');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function lanIPs() {
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(function (name) {
    (ifaces[name] || []).forEach(function (info) {
      if (info.family === 'IPv4' && !info.internal) out.push({ name: name, ip: info.address });
    });
  });
  return out;
}

/**
 * 给网卡打分，挑出"手机最可能访问到"的那个。
 * 家用/办公 WiFi 通常是 192.168.x.x；虚拟网卡（Hyper-V / VMware / WSL）
 * 虽然也是私有地址，但手机根本连不上，必须排除。
 */
function scoreAddr(x) {
  const name = String(x.name).toLowerCase();
  let s = 0;
  if (/^192\.168\./.test(x.ip)) s += 100;
  else if (/^10\./.test(x.ip)) s += 80;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(x.ip)) s += 40;

  if (/vethernet|virtual|vmware|virtualbox|hyper-?v|loopback|wsl|docker|tap|tun/.test(name)) s -= 300;
  if (/wi-?fi|wlan|wireless|无线/.test(name)) s += 40;
  if (/ethernet|以太网|本地连接/.test(name)) s += 15;
  return s;
}

function bestAddr() {
  const ips = lanIPs().sort(function (a, b) { return scoreAddr(b) - scoreAddr(a); });
  return ips[0] || null;
}

const port = arg('port', '8080');
let target = arg('url', '');

if (!target) {
  const pick = bestAddr();
  if (!pick) {
    console.error('未检测到可用的局域网地址，请用 --url 手动指定');
    process.exit(1);
  }
  target = 'http://' + pick.ip + ':' + port + '/';
  console.log('选用网卡: ' + pick.name + ' (' + pick.ip + ')');
}

const out = arg('out', path.join(__dirname, '..', 'qrcode-lan.png'));

console.log('二维码目标地址: ' + target);

const api = 'https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=12&data=' +
  encodeURIComponent(target);

const req = https.get(api, { timeout: 15000 }, function (res) {
  if (res.statusCode !== 200) {
    console.error('在线二维码接口返回 HTTP ' + res.statusCode);
    res.resume();
    process.exit(2);
  }
  const chunks = [];
  res.on('data', function (c) { chunks.push(c); });
  res.on('end', function () {
    const buf = Buffer.concat(chunks);
    if (buf.length < 500) {
      console.error('返回内容异常（' + buf.length + ' 字节），可能不是图片');
      process.exit(2);
    }
    fs.writeFileSync(out, buf);
    console.log('已保存: ' + out + '  (' + (buf.length / 1024).toFixed(1) + ' KB)');
    console.log('');
    console.log('手机连同一个 WiFi，用相机/微信扫这个二维码即可打开。');
    console.log('如果打不开，检查：① 手机和电脑是否同一 WiFi；② 电脑防火墙是否放行 ' + port + ' 端口。');
  });
});
req.on('error', function (e) {
  console.error('网络不可达，无法在线生成二维码: ' + e.message);
  console.error('可以直接把地址发给同学：' + target);
  process.exit(2);
});
req.on('timeout', function () {
  req.destroy();
  console.error('请求超时');
  process.exit(2);
});
