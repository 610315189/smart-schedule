/**
 * ZIP 容器解析
 * ---------------------------------------------------------------
 * .xlsx / .docx 都是 ZIP 包。这里实现最小可用的读取能力：
 *   末尾 EOCD -> 中央目录 -> 逐条读本地头 -> deflate 解压 -> CRC32 校验
 * 不依赖任何平台解压 API，也不依赖第三方库。
 */
const B = require('./bytes');
const INF = require('./inflate');

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/** 判断是否为 ZIP 容器（xlsx / docx / pptx 都是） */
function isZip(bytes) {
  const b = B.toBytes(bytes);
  return b.length >= 4 && B.tag4(b, 0) === 'PK\u0003\u0004';
}

/** 判断是否为旧版 Office 二进制格式（xls / doc，基于 OLE2 复合文档） */
function isOle2(bytes) {
  const b = B.toBytes(bytes);
  return b.length >= 8 && B.tag4(b, 0) === '\u00d0\u00cf\u0011\u00e0';
}

function findEOCD(b) {
  const min = Math.max(0, b.length - 65557);
  for (let i = b.length - 22; i >= min; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) {
      const commentLen = B.u16(b, i + 20);
      if (i + 22 + commentLen === b.length) return i;
    }
  }
  // 容错：注释长度不匹配时也接受
  for (let i = b.length - 22; i >= min; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) return i;
  }
  return -1;
}

/**
 * 解析 ZIP，返回可读归档对象
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {{entries: Object, order: String[], names: Function, has: Function, read: Function, text: Function}}
 */
function readZip(input) {
  const b = B.toBytes(input);
  if (b.length < 22) throw new Error('文件太小，不是有效的 ZIP 包');
  if (B.u32(b, 0) !== SIG_LOCAL && !isZip(b)) {
    throw new Error('不是有效的 ZIP 包（缺少 PK 头）');
  }

  const eocd = findEOCD(b);
  if (eocd < 0) throw new Error('ZIP 结构损坏：找不到中央目录结尾记录');

  const entryCount = B.u16(b, eocd + 10);
  const cdSize = B.u32(b, eocd + 12);
  const cdOffset = B.u32(b, eocd + 16);

  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error('暂不支持 ZIP64 格式的大文件');
  }
  if (cdOffset <= 0 || cdOffset + cdSize > b.length) {
    throw new Error('ZIP 结构损坏：中央目录位置非法');
  }

  const entries = {};
  const order = [];
  let p = cdOffset;

  for (let i = 0; i < entryCount; i++) {
    if (B.u32(b, p) !== SIG_CENTRAL) break;
    const flags = B.u16(b, p + 8);
    const method = B.u16(b, p + 10);
    const crc = B.u32(b, p + 16);
    const compSize = B.u32(b, p + 20);
    const uncompSize = B.u32(b, p + 24);
    const nameLen = B.u16(b, p + 28);
    const extraLen = B.u16(b, p + 30);
    const commentLen = B.u16(b, p + 32);
    const localOffset = B.u32(b, p + 42);
    const nameBytes = b.subarray(p + 46, p + 46 + nameLen);
    const name = B.utf8Decode(nameBytes);

    entries[name] = {
      name: name,
      flags: flags,
      method: method,
      crc: crc,
      compSize: compSize,
      uncompSize: uncompSize,
      localOffset: localOffset,
      encrypted: !!(flags & 0x1),
    };
    order.push(name);
    p += 46 + nameLen + extraLen + commentLen;
  }

  const archive = {
    entries: entries,
    order: order,
    names: function () { return order.slice(); },
    has: function (name) { return !!entries[name]; },

    /** 读取并解压一个条目 */
    read: function (name) {
      const e = entries[name];
      if (!e) throw new Error('ZIP 中不存在条目：' + name);
      if (e.encrypted) throw new Error('文件已加密，无法读取：' + name);

      const lh = e.localOffset;
      if (B.u32(b, lh) !== SIG_LOCAL) throw new Error('ZIP 条目本地头损坏：' + name);
      const nameLen = B.u16(b, lh + 26);
      const extraLen = B.u16(b, lh + 28);
      const start = lh + 30 + nameLen + extraLen;
      const end = start + e.compSize;
      if (end > b.length) throw new Error('ZIP 条目数据越界：' + name);

      const raw = b.subarray(start, end);
      let out;
      if (e.method === 0) {
        out = raw;
      } else if (e.method === 8) {
        out = INF.inflateRaw(raw);
      } else {
        throw new Error('不支持的压缩方式 ' + e.method + '（条目：' + name + '）');
      }

      // CRC 校验：能有效发现解压实现或数据损坏的问题
      if (e.crc && INF.crc32(out) !== e.crc) {
        throw new Error('CRC 校验失败，文件可能已损坏：' + name);
      }
      return out;
    },

    /** 读取并解码为 UTF-8 文本 */
    text: function (name) {
      return B.utf8Decode(archive.read(name));
    },
  };

  return archive;
}

module.exports = {
  isZip,
  isOle2,
  readZip,
};
