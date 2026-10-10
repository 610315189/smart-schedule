/**
 * 字节处理工具
 * ---------------------------------------------------------------
 * 小程序里读文件拿到的是 ArrayBuffer / Uint8Array，而 xlsx、docx
 * 内部的 XML 都是 UTF-8，需要自己解码（不能依赖 TextDecoder 的可用性）。
 */

/** 小端 16 位 */
function u16(b, o) {
  return b[o] | (b[o + 1] << 8);
}

/** 小端 32 位（转成无符号） */
function u32(b, o) {
  return ((b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0);
}

/** 4 字节 ASCII 标签，用于识别文件类型 */
function tag4(b, o) {
  return String.fromCharCode(b[o] || 0, b[o + 1] || 0, b[o + 2] || 0, b[o + 3] || 0);
}

/**
 * UTF-8 解码（含 BOM 处理与非法字节容错）
 * @param {Uint8Array} b
 * @returns {String}
 */
function utf8Decode(b) {
  let i = 0;
  // 跳过 UTF-8 BOM
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3;

  const out = [];
  let buf = '';
  while (i < b.length) {
    const c = b[i++];
    let cp;
    if (c < 0x80) {
      cp = c;
    } else if (c < 0xc0) {
      cp = 0xfffd; // 非法起始字节
    } else if (c < 0xe0) {
      cp = ((c & 0x1f) << 6) | (b[i++] & 0x3f);
    } else if (c < 0xf0) {
      cp = ((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
    } else {
      cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
    }

    if (cp < 0x10000) {
      buf += String.fromCharCode(cp);
    } else {
      // 补充平面，转成代理对
      cp -= 0x10000;
      buf += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
    if (buf.length >= 4096) {
      out.push(buf);
      buf = '';
    }
  }
  out.push(buf);
  return out.join('');
}

/**
 * 把小程序 readFile(encoding:'binary') 返回的字符串转回字节数组
 * （每个字符代表一个 0-255 的字节）
 */
function binaryStringToBytes(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/**
 * 把任意输入统一成 Uint8Array
 * 支持：Uint8Array / ArrayBuffer / Array / binary 字符串
 */
function toBytes(input) {
  if (!input) return new Uint8Array(0);
  if (input instanceof Uint8Array) return input;
  if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) return new Uint8Array(input);
  if (Array.isArray(input)) return new Uint8Array(input);
  if (typeof input === 'string') return binaryStringToBytes(input);
  if (input.buffer && typeof input.byteLength === 'number' && input.byteOffset !== undefined) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return new Uint8Array(0);
}

/** 内存比较（测试用） */
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

module.exports = {
  u16,
  u32,
  tag4,
  utf8Decode,
  binaryStringToBytes,
  toBytes,
  bytesEqual,
};
