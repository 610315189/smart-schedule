/**
 * inflate / CRC32 正确性验证
 * 运行：node tools/test-inflate.js
 *
 * 用 Node 内置 zlib 压缩，再用小程序端的纯 JS 实现解压，逐字节比对。
 * 覆盖：随机数据、高重复数据、中文 UTF-8、空数据、各压缩级别、
 *      raw deflate / zlib 包装 / gzip 包装、CRC32。
 */
const zlib = require('zlib');
const path = require('path');

const INFLATE = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'inflate.js'));

let pass = 0;
let fail = 0;
const failures = [];

function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + label); }
  else {
    fail++; failures.push(label);
    console.log('  \u2717 ' + label + (extra !== undefined ? '   → ' + extra : ''));
  }
}

function eq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ---------------- 测试数据 ---------------- */
const cases = [];

// 1. 空数据
cases.push({ name: '空数据', data: Buffer.alloc(0) });

// 2. 单字节
cases.push({ name: '单字节', data: Buffer.from([0x41]) });

// 3. 短 ASCII
cases.push({ name: '短 ASCII 文本', data: Buffer.from('hello world', 'utf8') });

// 4. 中文 UTF-8（课程名场景）
cases.push({
  name: '中文课表文本',
  data: Buffer.from('高等数学(上) 张建国 A301 第1-2节 1-16周\n' +
    '大学英语(II) 李雯 A401 第3-4节 1-16周\n' +
    '程序设计基础 刘伟 A301 第5-6节 1-16周\n' +
    '数据结构与算法 刘伟 B301 第7-8节 1-16周\n', 'utf8'),
});

// 5. 高重复（触发大量 LZ77 回溯）
cases.push({ name: '高重复数据', data: Buffer.from('ABCD'.repeat(5000), 'utf8') });

// 6. 随机二进制（几乎不可压缩）
const rnd = Buffer.alloc(65536);
for (let i = 0; i < rnd.length; i++) rnd[i] = (i * 7919 + (i >> 3) * 31) & 0xff;
cases.push({ name: '伪随机二进制 64KB', data: rnd });

// 7. 大 XML（模拟 sheet1.xml）
const xmlParts = ['<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>'];
for (let r = 1; r <= 800; r++) {
  xmlParts.push('<row r="' + r + '">');
  for (let c = 0; c < 10; c++) {
    xmlParts.push('<c r="' + String.fromCharCode(65 + c) + r + '" t="s"><v>' + ((r * 10 + c) % 300) + '</v></c>');
  }
  xmlParts.push('</row>');
}
xmlParts.push('</sheetData></worksheet>');
cases.push({ name: '模拟 sheet XML（约 800 行）', data: Buffer.from(xmlParts.join(''), 'utf8') });

// 8. 触发长距离匹配（>32KB 距离）
const far = Buffer.concat([Buffer.alloc(40000, 0x20), Buffer.from('UNIQUE-MARKER-STRING', 'utf8')]);
cases.push({ name: '触发远距离回溯', data: far });

/* ---------------- 逐级别验证 ---------------- */
console.log('\n1. raw deflate 解压（zlib.deflateRawSync）');
[0, 1, 3, 6, 9].forEach(function (level) {
  let allOk = true;
  let detail = '';
  cases.forEach(function (c) {
    const compressed = zlib.deflateRawSync(c.data, { level: level });
    let out;
    try {
      out = INFLATE.inflateRaw(new Uint8Array(compressed));
    } catch (e) {
      allOk = false;
      detail = c.name + ' 抛异常: ' + e.message;
      return;
    }
    if (!eq(out, c.data)) {
      allOk = false;
      detail = c.name + ' 内容不一致（期望 ' + c.data.length + ' 字节，得到 ' + out.length + ' 字节）';
    }
  });
  ok(allOk, '压缩级别 ' + level + '：' + cases.length + ' 个样本全部还原', detail);
});

/* ---------------- zlib / gzip 包装 ---------------- */
console.log('\n2. 自动识别包装格式');
cases.forEach(function (c) {
  const z = zlib.deflateSync(c.data);
  const g = zlib.gzipSync(c.data);
  let okZ = false;
  let okG = false;
  try { okZ = eq(INFLATE.inflateAuto(new Uint8Array(z)), c.data); } catch (e) { okZ = false; }
  try { okG = eq(INFLATE.inflateAuto(new Uint8Array(g)), c.data); } catch (e) { okG = false; }
  ok(okZ && okG, c.name + '：zlib 与 gzip 包装均可解压');
});

/* ---------------- 错误处理 ---------------- */
console.log('\n3. 异常输入的处理');
let threw = false;
try {
  INFLATE.inflateRaw(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
} catch (e) { threw = true; }
ok(threw, '非法数据抛出明确异常而不是静默返回错误结果');

let noCrash = true;
try {
  INFLATE.inflateRaw(new Uint8Array(0));
} catch (e) { noCrash = false; }
ok(noCrash === false, '空输入同样抛出异常（不会死循环）');

/* ---------------- CRC32 ---------------- */
console.log('\n4. CRC32 校验');
// 标准测试向量
ok(INFLATE.crc32(Buffer.from('123456789', 'utf8')) === 0xcbf43926,
  'CRC32("123456789") = 0xCBF43926', '得到 0x' + INFLATE.crc32(Buffer.from('123456789')).toString(16));
ok(INFLATE.crc32(Buffer.alloc(0)) === 0, 'CRC32(空) = 0');
ok(INFLATE.crc32(Buffer.from('a', 'utf8')) === zlib.crc32 ? true : INFLATE.crc32(Buffer.from('a', 'utf8')) === 0xe8b7be43,
  'CRC32("a") = 0xE8B7BE43', '得到 0x' + INFLATE.crc32(Buffer.from('a')).toString(16));

// 与 Node 交叉验证（Node 20+ 有 zlib.crc32）
if (typeof zlib.crc32 === 'function') {
  let same = true;
  cases.forEach(function (c) {
    if (INFLATE.crc32(c.data) !== zlib.crc32(c.data)) same = false;
  });
  ok(same, 'CRC32 与 Node zlib.crc32 对所有样本一致');
} else {
  console.log('  - 当前 Node 无 zlib.crc32，跳过交叉验证');
}

// 增量 CRC（ZIP 校验用）
const part1 = Buffer.from('hello ', 'utf8');
const part2 = Buffer.from('world', 'utf8');
const inc = INFLATE.crc32(part2, INFLATE.crc32(part1, 0));
ok(inc === INFLATE.crc32(Buffer.concat([part1, part2])), '增量 CRC32 与整体计算一致');

console.log('\n============================================');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail) {
  console.log('  失败项：');
  failures.forEach(function (f) { console.log('   - ' + f); });
}
console.log('============================================');
process.exit(fail ? 1 : 0);
