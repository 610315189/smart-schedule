/**
 * 网页版构建脚本
 * ---------------------------------------------------------------
 * 把 miniprogram 下的「纯逻辑模块」（课表引擎、空教室算法、
 * Excel/Word 解析、inflate/zip/xml 等）打包成一个浏览器可直接
 * 加载的 bundle，源码一行不改。
 *
 * 这样小程序版和网页版共用同一套算法，不会出现"两边规则不一致"。
 *
 * 用法：node tools/build-web.js
 * 产物：web/js/bundle.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'miniprogram');
const OUT_DIR = path.join(ROOT, 'web', 'js');
const OUT = path.join(OUT_DIR, 'bundle.js');

/** 打包入口（其余依赖会自动递归收集） */
const ENTRY = [
  'config/index',
  'data/periods',
  'data/classrooms',
  'data/courses',
  'data/occupancy',
  'utils/time',
  'utils/bytes',
  'utils/inflate',
  'utils/zip',
  'utils/xml',
  'utils/xlsx',
  'utils/docx',
  'utils/schedule-extract',
  'utils/table-detect',
  'utils/file-import',
  'utils/importer',
  'utils/schedule',
  'utils/classroom',
  'utils/notify',
  'utils/storage',
];

/** 挂到 window.SS 上的命名空间 */
const EXPORTS = {
  config: 'config/index',
  periods: 'data/periods',
  classrooms: 'data/classrooms',
  courses: 'data/courses',
  occupancy: 'data/occupancy',
  time: 'utils/time',
  bytes: 'utils/bytes',
  inflate: 'utils/inflate',
  zip: 'utils/zip',
  xml: 'utils/xml',
  xlsx: 'utils/xlsx',
  docx: 'utils/docx',
  extract: 'utils/schedule-extract',
  detect: 'utils/table-detect',
  fileImport: 'utils/file-import',
  importer: 'utils/importer',
  schedule: 'utils/schedule',
  classroom: 'utils/classroom',
  notify: 'utils/notify',
  storage: 'utils/storage',
};

/** 把 require('./time') 这类相对路径解析成模块 id */
function resolveId(fromId, request) {
  const base = fromId.split('/');
  base.pop();
  const parts = String(request).split('/');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p || p === '.') continue;
    if (p === '..') base.pop();
    else base.push(p);
  }
  return base.join('/');
}

const REQ_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

/** 广度优先收集所有依赖 */
function collect(entries) {
  const mods = {};
  const queue = entries.slice();

  while (queue.length) {
    const id = queue.shift();
    if (mods[id]) continue;

    const file = path.join(SRC, id + '.js');
    if (!fs.existsSync(file)) {
      throw new Error('模块文件不存在: ' + id + ' (' + file + ')');
    }
    let src = fs.readFileSync(file, 'utf8');

    const deps = [];
    src = src.replace(REQ_RE, function (m, req) {
      const resolved = resolveId(id, req);
      deps.push(resolved);
      return 'require(' + JSON.stringify(resolved) + ')';
    });

    mods[id] = src;
    deps.forEach(function (d) { if (!mods[d]) queue.push(d); });
  }
  return mods;
}

function build() {
  const mods = collect(ENTRY);
  const ids = Object.keys(mods).sort();

  const lines = [];
  lines.push('/*!');
  lines.push(' * 智能课表 · 网页版核心逻辑 bundle');
  lines.push(' * 本文件由 tools/build-web.js 自动生成，请勿手工编辑。');
  lines.push(' * 源码位置：miniprogram/{config,data,utils}');
  lines.push(' * 生成时间：' + new Date().toISOString());
  lines.push(' * 模块数：' + ids.length);
  lines.push(' */');
  lines.push('(function (global) {');
  lines.push('  "use strict";');
  lines.push('  var __modules = {};');
  lines.push('  var __cache = {};');
  lines.push('  function __require(id) {');
  lines.push('    if (__cache[id]) return __cache[id].exports;');
  lines.push('    var m = { exports: {} };');
  lines.push('    __cache[id] = m;');
  lines.push('    var fn = __modules[id];');
  lines.push('    if (!fn) throw new Error("[bundle] 模块不存在: " + id);');
  lines.push('    fn(m, m.exports, __require);');
  lines.push('    return m.exports;');
  lines.push('  }');

  ids.forEach(function (id) {
    lines.push('');
    lines.push('  /* ---- ' + id + ' ---- */');
    lines.push('  __modules[' + JSON.stringify(id) + '] = function (module, exports, require) {');
    lines.push(mods[id]);
    lines.push('  };');
  });

  lines.push('');
  lines.push('  /* ---- 对外命名空间 ---- */');
  lines.push('  var SS = {};');
  Object.keys(EXPORTS).forEach(function (key) {
    lines.push('  SS[' + JSON.stringify(key) + '] = __require(' + JSON.stringify(EXPORTS[key]) + ');');
  });
  lines.push('  SS.__modules = __modules;');
  lines.push('  SS.__require = __require;');
  lines.push('  global.SS = SS;');
  lines.push('})(typeof window !== "undefined" ? window : globalThis);');
  lines.push('');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log('已生成 ' + path.relative(ROOT, OUT) + '  (' + kb + ' KB, ' + ids.length + ' 个模块)');
  ids.forEach(function (id) {
    console.log('  · ' + id + '  (' + (mods[id].length / 1024).toFixed(1) + ' KB)');
  });
}

build();
