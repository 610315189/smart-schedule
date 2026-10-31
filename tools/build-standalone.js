/**
 * 生成"单文件版"网页
 * ---------------------------------------------------------------
 * 把 CSS、JS、图标全部内联进一个 index.html，
 * 得到一个约 250KB 的独立 HTML 文件：
 *   · 可以直接双击用浏览器打开（file:// 也能跑）
 *   · 可以只上传这一个文件到任何静态空间 / 服务器
 *   · 可以发微信文件给同学，对方下载后用浏览器打开
 *
 * 用法：node tools/build-standalone.js
 * 产物：web/standalone.html
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const OUT = path.join(WEB, 'standalone.html');

function read(p) { return fs.readFileSync(path.join(WEB, p), 'utf8'); }
function readBase64(p) {
  return fs.readFileSync(path.join(WEB, p)).toString('base64');
}

let html = read('index.html');

/**
 * 用函数做替换。
 * 不能直接把源码当替换字符串传：源码里含 $& $1 等序列，
 * String.replace 会把它们当成特殊替换模式，从而悄悄改坏代码。
 */
function replacer(text) {
  return function () { return text; };
}

/* 1) 去掉 PWA 相关的独立文件引用（单文件用不到） */
html = html.replace(/\s*<link rel="manifest"[^>]*>/i, '');
html = html.replace(/\s*<link rel="icon"[^>]*>/i, '');
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/i, '');

/* 2) 内联图标 */
const icon192 = 'data:image/png;base64,' + readBase64('icons/icon-192.png');
html = html.replace('</head>', replacer(
  '  <link rel="icon" href="' + icon192 + '">\n' +
  '  <link rel="apple-touch-icon" href="' + icon192 + '">\n' +
  '</head>'));

/* 3) 内联 CSS（允许带 ?v= 版本参数） */
const css = read('css/app.css');
html = html.replace(/<link rel="stylesheet" href="css\/app\.css(?:\?[^"]*)?">/,
  replacer('<style>\n' + css + '\n</style>'));

/* 4) 内联 JS（顺序必须与 index.html 一致；允许带 ?v= 版本参数） */
const scripts = ['js/wx-shim.js', 'js/bundle.js', 'js/ics.js', 'js/ui.js', 'js/app.js'];
scripts.forEach(function (src) {
  const code = read(src);
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('<script src="' + escaped + '(?:\\?[^"]*)?"></script>');
  if (!re.test(html)) {
    throw new Error('index.html 里找不到 <script src="' + src + '">');
  }
  const inline = '<script>\n/* ==== ' + src + ' ==== */\n' +
    code.replace(/<\/script>/gi, '<\\/script>') + '\n</script>';
  html = html.replace(re, replacer(inline));
});

/* 5) 标题里标注单文件版 */
html = html.replace('<title>智能课表</title>', replacer('<title>智能课表（单文件版）</title>'));

fs.writeFileSync(OUT, html, 'utf8');
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log('已生成 ' + path.relative(ROOT, OUT) + '  (' + kb + ' KB)');
console.log('这个文件可以单独使用：双击打开、或上传到任意静态空间。');
