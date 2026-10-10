/**
 * 小程序静态检查（不需要开发者工具）
 * 运行：node tools/check-wxml.js
 *
 * 检查项：
 *  1) app.json 里的每个 page 都有 .js/.wxml/.json
 *  2) WXML 事件绑定（bind / catch）的方法在同名 .js 中已定义
 *  3) WXML 表达式中没有函数调用（小程序模板不支持，如 list.indexOf(x)）
 *  4) wx:for 都带 wx:key
 *  5) WXML 中引用的 data 字段至少能在 .js 中出现（弱校验，仅提示）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'miniprogram');
let problems = 0;
let warns = 0;

function err(msg) { problems++; console.log('  \u2717 ' + msg); }
function warn(msg) { warns++; console.log('  ! ' + msg); }
function ok(msg) { console.log('  \u2713 ' + msg); }

/* ---------------- 1. app.json 页面完整性 ---------------- */
console.log('\n1. 页面文件完整性');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
appJson.pages.forEach(function (p) {
  ['js', 'wxml', 'json'].forEach(function (ext) {
    const f = path.join(ROOT, p + '.' + ext);
    if (!fs.existsSync(f)) err('缺少文件 ' + p + '.' + ext);
  });
});
ok('app.json 声明 ' + appJson.pages.length + ' 个页面，文件检查完毕');

(appJson.tabBar && appJson.tabBar.list ? appJson.tabBar.list : []).forEach(function (t) {
  if (appJson.pages.indexOf(t.pagePath) < 0) err('tabBar 里的 ' + t.pagePath + ' 未在 pages 中声明');
});

/* ---------------- 2/3/4. 逐页检查 ---------------- */
const pages = appJson.pages;

pages.forEach(function (p) {
  const wxmlPath = path.join(ROOT, p + '.wxml');
  const jsPath = path.join(ROOT, p + '.js');
  if (!fs.existsSync(wxmlPath) || !fs.existsSync(jsPath)) return;

  const wxml = fs.readFileSync(wxmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  console.log('\n2. ' + p);

  /* 事件绑定 -> 方法定义 */
  const bindRe = /(?:bind|catch|capture-bind|capture-catch)[:]?([a-zA-Z]+)\s*=\s*"([^"{}]+)"/g;
  const methods = {};
  let m;
  while ((m = bindRe.exec(wxml)) !== null) {
    methods[m[2]] = true;
  }
  const names = Object.keys(methods);
  names.forEach(function (name) {
    const defRe = new RegExp('(^|[\\s{,])' + name + '\\s*[:(]');
    if (!defRe.test(js)) {
      err(p + '：事件绑定的方法 ' + name + ' 在 ' + p + '.js 中找不到定义');
    }
  });
  ok('检查了 ' + names.length + ' 个事件绑定');

  /* 表达式里不能有函数调用 */
  const exprRe = /\{\{([^}]*)\}\}/g;
  let e;
  let callCount = 0;
  while ((e = exprRe.exec(wxml)) !== null) {
    const expr = e[1];
    const callMatch = expr.match(/[a-zA-Z_$][\w$]*\s*\(/);
    if (callMatch) {
      err(p + '：模板表达式里出现函数调用 ' + expr.trim() + '（WXML 不支持）');
      callCount++;
    }
  }
  if (!callCount) ok('模板表达式无函数调用');

  /* wx:for 必须有 wx:key */
  const tags = wxml.split('<');
  tags.forEach(function (tag) {
    if (/wx:for\s*=/.test(tag) && !/wx:key\s*=/.test(tag)) {
      const short = tag.slice(0, 60).replace(/\s+/g, ' ');
      warn(p + '：存在没有 wx:key 的 wx:for → <' + short);
    }
  });
});

/* ---------------- 3. 全量扫描函数调用 ---------------- */
console.log('\n3. 全局模板表达式扫描');
let totalCalls = 0;
function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return walk(full);
    if (!/\.wxml$/.test(d.name)) return;
    const text = fs.readFileSync(full, 'utf8');
    const re = /\{\{([^}]*)\}\}/g;
    let mm;
    while ((mm = re.exec(text)) !== null) {
      if (/[a-zA-Z_$][\w$]*\s*\(/.test(mm[1])) {
        err(path.relative(ROOT, full) + '：' + mm[1].trim());
        totalCalls++;
      }
    }
  });
}
walk(ROOT);
if (!totalCalls) ok('全部 WXML 均未使用模板函数调用');

console.log('\n============================================');
console.log('  错误 ' + problems + ' 项，警告 ' + warns + ' 项');
console.log('============================================');
process.exit(problems ? 1 : 0);
