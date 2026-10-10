/**
 * 轻量 XML 解析器
 * ---------------------------------------------------------------
 * 小程序没有 DOMParser，而 xlsx / docx 内部全是 XML，
 * 所以这里实现一个够用的解析器：
 *   - 支持元素、属性、文本、CDATA、注释、处理指令
 *   - 忽略命名空间前缀做匹配（w:  / x: 等），比较时只看局部名
 *   - 文本作为 #text 子节点保留，保证顺序正确
 */

const TEXT_NODE = '#text';

/** XML 实体解码 */
function decodeEntities(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, function (m, g) {
    if (g[0] === '#') {
      const code = (g[1] === 'x' || g[1] === 'X')
        ? parseInt(g.slice(2), 16)
        : parseInt(g.slice(1), 10);
      if (!isFinite(code) || code < 0) return m;
      try {
        return String.fromCodePoint(code);
      } catch (e) {
        return m;
      }
    }
    const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
    return map[g] !== undefined ? map[g] : m;
  });
}

/** 从 '<' 开始找到匹配的 '>'，跳过属性值里的引号内容 */
function findTagEnd(xml, start) {
  let i = start + 1;
  let quote = 0;
  while (i < xml.length) {
    const ch = xml[i];
    if (quote) {
      if (ch === quote) quote = 0;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
    i++;
  }
  return -1;
}

function isSpace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/** 解析 "<name a=\"1\" b='2'"（不含首尾尖括号） */
function parseTagContent(tag) {
  let i = 0;
  while (i < tag.length && !isSpace(tag[i])) i++;
  const name = tag.slice(0, i);
  const attrs = {};

  while (i < tag.length) {
    while (i < tag.length && isSpace(tag[i])) i++;
    if (i >= tag.length) break;

    let s = i;
    while (i < tag.length && !isSpace(tag[i]) && tag[i] !== '=') i++;
    const key = tag.slice(s, i);
    if (!key) { i++; continue; }

    const save = i;
    while (i < tag.length && isSpace(tag[i])) i++;
    if (tag[i] !== '=') {
      attrs[key] = '';
      i = save;
      continue;
    }
    i++; // 跳过 =
    while (i < tag.length && isSpace(tag[i])) i++;

    const q = tag[i];
    if (q === '"' || q === "'") {
      const e = tag.indexOf(q, i + 1);
      attrs[key] = e < 0 ? tag.slice(i + 1) : tag.slice(i + 1, e);
      i = e < 0 ? tag.length : e + 1;
    } else {
      const s2 = i;
      while (i < tag.length && !isSpace(tag[i])) i++;
      attrs[key] = tag.slice(s2, i);
    }
  }
  return { name: name, attrs: attrs };
}

function node(name, attrs) {
  return { name: name, attrs: attrs || {}, children: [] };
}

function textNode(text) {
  return { name: TEXT_NODE, attrs: {}, children: [], text: text };
}

/**
 * 解析 XML 文本为节点树
 * @returns {Object} 虚拟根节点 #root
 */
function parse(xml) {
  const root = node('#root');
  const stack = [root];
  const len = xml.length;
  let i = 0;

  while (i < len) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) {
      if (i < len) pushText(stack, xml.slice(i));
      break;
    }
    if (lt > i) pushText(stack, xml.slice(i, lt));

    // 注释
    if (xml.startsWith('<!--', lt)) {
      const e = xml.indexOf('-->', lt);
      i = e < 0 ? len : e + 3;
      continue;
    }
    // CDATA
    if (xml.startsWith('<![CDATA[', lt)) {
      const e = xml.indexOf(']]>', lt);
      const raw = e < 0 ? xml.slice(lt + 9) : xml.slice(lt + 9, e);
      stack[stack.length - 1].children.push(textNode(raw));
      i = e < 0 ? len : e + 3;
      continue;
    }
    // 处理指令 / DOCTYPE
    if (xml.startsWith('<?', lt)) {
      const e = xml.indexOf('?>', lt);
      i = e < 0 ? len : e + 2;
      continue;
    }
    if (xml.startsWith('<!', lt)) {
      const e = xml.indexOf('>', lt);
      i = e < 0 ? len : e + 1;
      continue;
    }

    const gt = findTagEnd(xml, lt);
    if (gt < 0) break;

    let inner = xml.slice(lt + 1, gt);
    const selfClosing = inner.length > 0 && inner[inner.length - 1] === '/';
    if (selfClosing) inner = inner.slice(0, -1);

    if (inner[0] === '/') {
      const closing = inner.slice(1).trim();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === closing) {
          stack.length = k;
          break;
        }
      }
    } else {
      const parsed = parseTagContent(inner);
      const n = node(parsed.name, parsed.attrs);
      stack[stack.length - 1].children.push(n);
      if (!selfClosing) stack.push(n);
    }
    i = gt + 1;
  }

  return root;
}

function pushText(stack, raw) {
  const t = decodeEntities(raw);
  if (!t) return;
  const top = stack[stack.length - 1];
  // 相邻文本合并，减少节点数
  const last = top.children[top.children.length - 1];
  if (last && last.name === TEXT_NODE) {
    last.text += t;
    return;
  }
  top.children.push(textNode(t));
}

/** 去掉命名空间前缀：w:tbl -> tbl */
function localName(name) {
  if (!name) return '';
  const i = name.indexOf(':');
  return i >= 0 ? name.slice(i + 1) : name;
}

function isElement(n) {
  return n.name !== TEXT_NODE;
}

/** 直接子元素中局部名匹配的 */
function children(node, name) {
  const out = [];
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i];
    if (isElement(c) && localName(c.name) === name) out.push(c);
  }
  return out;
}

/** 深度优先找第一个匹配的元素 */
function find(node, name) {
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i];
    if (!isElement(c)) continue;
    if (localName(c.name) === name) return c;
    const deeper = find(c, name);
    if (deeper) return deeper;
  }
  return null;
}

/** 深度优先收集所有匹配元素 */
function findAll(node, name, out) {
  const acc = out || [];
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i];
    if (!isElement(c)) continue;
    if (localName(c.name) === name) acc.push(c);
    findAll(c, name, acc);
  }
  return acc;
}

/** 拼接节点下的全部文本（按出现顺序，含后代） */
function textOf(node) {
  let s = '';
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i];
    if (c.name === TEXT_NODE) s += c.text;
    else s += textOf(c);
  }
  return s;
}

/** 取属性（忽略命名空间前缀） */
function attr(node, name) {
  if (!node || !node.attrs) return undefined;
  if (node.attrs[name] !== undefined) return node.attrs[name];
  const keys = Object.keys(node.attrs);
  for (let i = 0; i < keys.length; i++) {
    if (localName(keys[i]) === name) return node.attrs[keys[i]];
  }
  return undefined;
}

/** 属性存在性判断（如 <w:vMerge/> 无值也算存在） */
function hasAttr(node, name) {
  return attr(node, name) !== undefined;
}

module.exports = {
  TEXT_NODE,
  parse,
  localName,
  children,
  find,
  findAll,
  textOf,
  attr,
  hasAttr,
  decodeEntities,
  node,
  textNode,
};
