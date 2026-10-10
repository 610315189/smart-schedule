/**
 * 纯 JavaScript DEFLATE 解压（RFC 1951）+ CRC32
 * ---------------------------------------------------------------
 * 为什么需要它：
 *   .xlsx / .docx 本质是 ZIP 包，里面是 DEFLATE 压缩过的 XML。
 *   微信小程序没有内置的解压能力（FileSystemManager.unzip 在 iOS 上不可用），
 *   所以这里用纯 JS 实现一份，任何平台都能跑，不依赖任何第三方库。
 *
 * 算法参考 puff.c 的 canonical Huffman 解码流程，性能对本项目的
 * 数据量（几十 KB 的课表文件）完全够用。
 */

/* ---------------- 长度 / 距离基表 ---------------- */
const LEN_BASE = new Uint16Array([
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
]);
const LEN_EXTRA = new Uint8Array([
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
]);
const DIST_BASE = new Uint16Array([
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
]);
const DIST_EXTRA = new Uint8Array([
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
]);

/* ---------------- 位读取器 ---------------- */
function BitReader(data) {
  this.d = data;
  this.pos = 0;
  this.bitBuf = 0;
  this.bitCnt = 0;
}

BitReader.prototype.bits = function (n) {
  while (this.bitCnt < n) {
    if (this.pos >= this.d.length) throw new Error('DEFLATE 数据意外结束');
    this.bitBuf |= this.d[this.pos++] << this.bitCnt;
    this.bitCnt += 8;
  }
  const v = this.bitBuf & ((1 << n) - 1);
  this.bitBuf >>>= n;
  this.bitCnt -= n;
  return v;
};

/** 丢弃不足一字节的剩余位（stored 块需要字节对齐） */
BitReader.prototype.alignByte = function () {
  const drop = this.bitCnt & 7;
  this.bitBuf >>>= drop;
  this.bitCnt -= drop;
};

/** 字节对齐后直接读原始字节 */
BitReader.prototype.readBytes = function (n) {
  this.alignByte();
  const out = new Uint8Array(n);
  // 位缓冲里可能还留着完整字节
  let got = 0;
  while (this.bitCnt >= 8 && got < n) {
    out[got++] = this.bitBuf & 0xff;
    this.bitBuf >>>= 8;
    this.bitCnt -= 8;
  }
  const remain = n - got;
  if (this.pos + remain > this.d.length) throw new Error('stored 块数据不完整');
  for (let i = 0; i < remain; i++) out[got + i] = this.d[this.pos + i];
  this.pos += remain;
  return out;
};

/* ---------------- 输出缓冲 ---------------- */
function ByteWriter(cap) {
  this.buf = new Uint8Array(Math.max(cap || 1024, 64));
  this.len = 0;
}

ByteWriter.prototype._ensure = function (n) {
  if (this.len + n <= this.buf.length) return;
  let cap = this.buf.length;
  while (cap < this.len + n) cap *= 2;
  const nb = new Uint8Array(cap);
  nb.set(this.buf.subarray(0, this.len));
  this.buf = nb;
};

ByteWriter.prototype.push = function (b) {
  this._ensure(1);
  this.buf[this.len++] = b;
};

ByteWriter.prototype.append = function (arr) {
  this._ensure(arr.length);
  this.buf.set(arr, this.len);
  this.len += arr.length;
};

/** LZ77 回溯复制，dist 可能小于 len（会与自身重叠，必须逐字节） */
ByteWriter.prototype.copyBack = function (dist, len) {
  this._ensure(len);
  let src = this.len - dist;
  if (src < 0) throw new Error('DEFLATE 回溯距离越界');
  for (let i = 0; i < len; i++) {
    this.buf[this.len++] = this.buf[src++];
  }
};

ByteWriter.prototype.toUint8Array = function () {
  return this.buf.subarray(0, this.len);
};

/* ---------------- Huffman ---------------- */
function buildHuffman(lengths) {
  const counts = new Int32Array(16);
  for (let i = 0; i < lengths.length; i++) counts[lengths[i]]++;
  counts[0] = 0;

  // 检查码长集合是否合法（Kraft 不等式）
  let left = 1;
  for (let i = 1; i <= 15; i++) {
    left <<= 1;
    left -= counts[i];
    if (left < 0) throw new Error('Huffman 码长集合非法');
  }

  const offsets = new Int32Array(16);
  for (let i = 1; i < 15; i++) offsets[i + 1] = offsets[i] + counts[i];

  const symbols = new Uint16Array(lengths.length);
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i]) symbols[offsets[lengths[i]]++] = i;
  }
  return { counts: counts, symbols: symbols };
}

function decodeSymbol(br, table) {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len <= 15; len++) {
    code |= br.bits(1);
    const count = table.counts[len];
    if (code - first < count) return table.symbols[index + (code - first)];
    index += count;
    first = (first + count) << 1;
    code <<= 1;
  }
  throw new Error('Huffman 解码失败');
}

/* ---------------- 固定 Huffman 表 ---------------- */
let FIXED_LIT = null;
let FIXED_DIST = null;

function fixedTables() {
  if (!FIXED_LIT) {
    const lit = new Uint8Array(288);
    let i = 0;
    for (; i < 144; i++) lit[i] = 8;
    for (; i < 256; i++) lit[i] = 9;
    for (; i < 280; i++) lit[i] = 7;
    for (; i < 288; i++) lit[i] = 8;
    FIXED_LIT = buildHuffman(lit);
    FIXED_DIST = buildHuffman(new Uint8Array(30).fill(5));
  }
  return { lit: FIXED_LIT, dist: FIXED_DIST };
}

/* ---------------- 动态 Huffman 表 ---------------- */
const CLCL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function readDynamicTables(br) {
  const hlit = br.bits(5) + 257;
  const hdist = br.bits(5) + 1;
  const hclen = br.bits(4) + 4;

  const clLengths = new Uint8Array(19);
  for (let i = 0; i < hclen; i++) clLengths[CLCL_ORDER[i]] = br.bits(3);
  const clTable = buildHuffman(clLengths);

  const lengths = new Uint8Array(hlit + hdist);
  let i = 0;
  while (i < lengths.length) {
    const sym = decodeSymbol(br, clTable);
    if (sym < 16) {
      lengths[i++] = sym;
    } else if (sym === 16) {
      if (i === 0) throw new Error('DEFLATE 码长重复缺少前值');
      const prev = lengths[i - 1];
      let repeat = 3 + br.bits(2);
      while (repeat-- > 0 && i < lengths.length) lengths[i++] = prev;
    } else if (sym === 17) {
      let repeat = 3 + br.bits(3);
      while (repeat-- > 0 && i < lengths.length) lengths[i++] = 0;
    } else {
      let repeat = 11 + br.bits(7);
      while (repeat-- > 0 && i < lengths.length) lengths[i++] = 0;
    }
  }

  return {
    lit: buildHuffman(lengths.subarray(0, hlit)),
    dist: buildHuffman(lengths.subarray(hlit)),
  };
}

/* ---------------- 块解压 ---------------- */
function inflateBlock(br, out, litTable, distTable) {
  for (;;) {
    const sym = decodeSymbol(br, litTable);
    if (sym < 256) {
      out.push(sym);
      continue;
    }
    if (sym === 256) return; // 块结束
    const li = sym - 257;
    if (li >= LEN_BASE.length) throw new Error('非法的长度码 ' + sym);
    const length = LEN_BASE[li] + br.bits(LEN_EXTRA[li]);

    const dsym = decodeSymbol(br, distTable);
    if (dsym >= DIST_BASE.length) throw new Error('非法的距离码 ' + dsym);
    const distance = DIST_BASE[dsym] + br.bits(DIST_EXTRA[dsym]);

    out.copyBack(distance, length);
  }
}

/**
 * 解压 raw DEFLATE 数据
 * @param {Uint8Array} input
 * @returns {Uint8Array}
 */
function inflateRaw(input) {
  const br = new BitReader(input);
  const out = new ByteWriter(input.length * 4 + 64);
  let final = 0;
  do {
    final = br.bits(1);
    const type = br.bits(2);
    if (type === 0) {
      // 无压缩存储块
      const block = br.readBytes(4);
      const len = block[0] | (block[1] << 8);
      const nlen = block[2] | (block[3] << 8);
      if ((len ^ 0xffff) !== nlen) throw new Error('stored 块长度校验失败');
      out.append(br.readBytes(len));
    } else if (type === 1) {
      const f = fixedTables();
      inflateBlock(br, out, f.lit, f.dist);
    } else if (type === 2) {
      const t = readDynamicTables(br);
      inflateBlock(br, out, t.lit, t.dist);
    } else {
      throw new Error('非法的 DEFLATE 块类型 3');
    }
  } while (!final);
  return out.toUint8Array();
}

/**
 * 自动识别 zlib 包装（0x78 开头）或 gzip（0x1f 0x8b）后解压
 */
function inflateAuto(input) {
  if (input.length > 2 && input[0] === 0x1f && input[1] === 0x8b) {
    // gzip：跳过 10 字节头 + 可选额外字段
    let off = 10;
    const flg = input[3];
    if (flg & 0x04) { // FEXTRA
      const xlen = input[off] | (input[off + 1] << 8);
      off += 2 + xlen;
    }
    if (flg & 0x08) while (input[off++] !== 0) { /* FNAME */ }
    if (flg & 0x10) while (input[off++] !== 0) { /* FCOMMENT */ }
    if (flg & 0x02) off += 2; // FHCRC
    return inflateRaw(input.subarray(off));
  }
  if (input.length > 2 && (input[0] & 0x0f) === 8 && ((input[0] << 8 | input[1]) % 31 === 0)) {
    return inflateRaw(input.subarray(2)); // zlib 头 2 字节
  }
  return inflateRaw(input);
}

/* ---------------- CRC32 ---------------- */
let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c;
  }
  CRC_TABLE = t;
  return t;
}

function crc32(bytes, prev) {
  const t = crcTable();
  let c = (prev === undefined ? 0 : prev) ^ (-1);
  for (let i = 0; i < bytes.length; i++) {
    c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ (-1)) >>> 0;
}

module.exports = {
  inflateRaw,
  inflateAuto,
  crc32,
};
