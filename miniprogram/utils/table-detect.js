/**
 * 课表智能识别
 * ---------------------------------------------------------------
 * 目标：用户丢进来一个教务系统导出的文件，程序自己搞清楚
 *   ① 课表在表格的哪一块（前面可能有标题、说明、空行，后面可能有备注）
 *   ② 采用哪种布局（每行一门课的列表式，还是"星期×节次"的网格）
 *   ③ 每一列分别是什么字段（有表头就认表头，没表头就靠列内数据特征推断）
 *
 * 做法：枚举候选方案 → 逐个真实提取 → 用「提取到的课程数 + 字段完整度 + 平均置信度」
 * 打分 → 选最优，并把识别依据一并返回，方便在界面上向用户解释。
 *
 * 依赖方向：table-detect → schedule-extract（单向，不会循环依赖）
 */
const EX = require('./schedule-extract');

/* ==================== 列画像 ==================== */

/** 取一行里最靠右的非空列索引 + 1 */
function rowWidth(row) {
  if (!row) return 0;
  for (let c = row.length - 1; c >= 0; c--) {
    if (String(row[c] === undefined || row[c] === null ? '' : row[c]).trim()) return c + 1;
  }
  return 0;
}

function maxWidth(rows) {
  let w = 0;
  for (let i = 0; i < rows.length; i++) {
    const rw = rowWidth(rows[i]);
    if (rw > w) w = rw;
  }
  return w;
}

/**
 * 给一列数据做"内容画像"：这一列看起来像什么字段
 * @param {Array<String>} values
 * @param {Object} ctx { classrooms, periods }
 */
function profileColumn(values, ctx) {
  const p = {
    n: 0, day: 0, period: 0, time: 0, weeks: 0, room: 0, roomKnown: 0,
    cn: 0, cnPure: 0, numeric: 0, avgLen: 0, maxLen: 0, distinct: 0,
    headerField: '', headerHits: 0, samples: [],
  };

  const nonEmpty = [];
  const uniq = {};
  for (let i = 0; i < (values || []).length; i++) {
    const s = String(values[i] === undefined || values[i] === null ? '' : values[i]).trim();
    if (!s) continue;
    nonEmpty.push(s);
    uniq[s] = 1;
  }
  p.n = nonEmpty.length;
  p.distinct = Object.keys(uniq).length;
  if (!p.n) return p;

  p.samples = nonEmpty.slice(0, 8);

  let lenSum = 0;
  for (let i = 0; i < nonEmpty.length; i++) {
    const s = nonEmpty[i];
    lenSum += s.length;
    if (s.length > p.maxLen) p.maxLen = s.length;

    // 课程名经常带括号或英文（"高等数学(上)"、"大学英语(II)"、"Python数据分析"），
    // 所以这里统计的是"含中文"而不是"纯中文"；教师列才要求纯中文。
    if (/[\u4e00-\u9fa5]/.test(s)) p.cn++;
    if (/^[\u4e00-\u9fa5]+$/.test(s)) p.cnPure++;
    if (/^-?\d+(\.\d+)?$/.test(s)) p.numeric++;

    if (EX.parseDayStrict(s) || EX.parseDayFromLoose(s)) p.day++;
    if (EX.parsePeriodLabel(s, ctx.periods)) p.period++;
    if (/\d{1,2}:\d{2}/.test(s)) p.time++;
    if (EX.parseWeeks(s)) p.weeks++;

    const hit = EX.extractRoomHit(s, ctx.classrooms);
    if (hit) {
      p.room++;
      if (hit.known) p.roomKnown++;
    }
  }
  p.avgLen = lenSum / p.n;

  // 表头特征：前几个非空值里有多少能匹配上字段名
  let hits = 0;
  let field = '';
  const probe = nonEmpty.slice(0, 5);
  for (let i = 0; i < probe.length; i++) {
    const f = EX.matchField(probe[i]);
    if (f) {
      hits++;
      if (!field) field = f;
    }
  }
  p.headerHits = hits;
  p.headerField = field;

  return p;
}

/** 逐列画像 */
function profileTable(rows, ctx, startRow) {
  const w = maxWidth(rows);
  const out = [];
  for (let c = 0; c < w; c++) {
    const col = [];
    for (let r = startRow || 0; r < rows.length; r++) col.push(rows[r] ? rows[r][c] : '');
    out.push(profileColumn(col, ctx));
  }
  return out;
}

/* ==================== 无表头时的列语义推断 ==================== */

/**
 * 仅凭列内数据特征推断每一列是什么字段。
 * 顺序很重要：先让特征最鲜明的字段（星期/周次/节次/教室）占位，
 * 最后再把剩下的、最像课程名的列定为课程名。
 */
function inferColumnsByProfile(rows, ctx) {
  const profiles = profileTable(rows, ctx, 0);
  const width = profiles.length;
  if (!width) return null;

  const used = {};
  const columns = {};
  const sources = {};
  const scores = {};

  function pick(field, weight, scorer) {
    let bestCol = -1;
    let bestScore = 0;
    for (let c = 0; c < width; c++) {
      if (used[c]) continue;
      const p = profiles[c];
      if (!p.n) continue;
      const s = scorer(p) * weight;
      if (s > bestScore) {
        bestScore = s;
        bestCol = c;
      }
    }
    if (bestCol >= 0 && bestScore >= 0.55) {
      columns[field] = bestCol;
      used[bestCol] = 1;
      sources[field] = 'content';
      scores[field] = Math.round(bestScore * 100) / 100;
      return true;
    }
    return false;
  }

  function ratio(count, p) { return p.n ? count / p.n : 0; }

  // 星期：绝大多数值都是星期
  pick('day', 1, function (p) { return ratio(p.day, p); });
  // 周次：出现"周"字
  pick('weeks', 1, function (p) { return ratio(p.weeks, p); });
  // 节次 / 时间：节次写法或 HH:mm
  pick('period', 1, function (p) {
    return Math.max(ratio(p.period, p), ratio(p.time, p) * 0.95);
  });
  // 教室：优先命中教室字典
  pick('room', 1, function (p) {
    return Math.max(ratio(p.roomKnown, p), ratio(p.room, p) * 0.8);
  });
  // 教师：短纯中文
  pick('teacher', 0.9, function (p) {
    const pure = ratio(p.cnPure, p);
    if (pure >= 0.85 && p.avgLen >= 2 && p.avgLen <= 4.5) return 0.8;
    return 0;
  });
  // 课程名：含中文、有一定长度、重复度不高
  pick('name', 1, function (p) {
    const cn = ratio(p.cn, p);
    if (cn < 0.35) return 0;
    if (p.avgLen < 3) return 0;
    if (p.numeric / p.n > 0.5) return 0;
    return Math.min(cn, 1) * 0.7 + Math.min(p.avgLen, 20) / 40;
  });

  // 必须有课程名，且至少能定位到星期或节次，否则这次推断不算数
  if (columns.name === undefined) return null;
  if (columns.day === undefined && columns.period === undefined) return null;

  return { columns: columns, sources: sources, scores: scores, profiles: profiles };
}

/* ==================== 区域检测 ==================== */

/** 一行是否"够稠密"（至少 2 个非空单元格） */
function isDenseRow(row) {
  let n = 0;
  for (let c = 0; c < (row ? row.length : 0); c++) {
    const s = String(row[c] === undefined || row[c] === null ? '' : row[c]).trim();
    if (s) n++;
    if (n >= 2) return true;
  }
  return false;
}

/**
 * 把表格切成若干个"数据块"（用空行分隔，允许中间有少量空行）
 * @returns {Array<[top, bottom]>}
 */
function detectRowBlocks(rows, maxGap) {
  const gap = maxGap === undefined ? 2 : maxGap;
  const blocks = [];
  let start = -1;
  let blanks = 0;

  for (let r = 0; r < rows.length; r++) {
    if (isDenseRow(rows[r])) {
      if (start < 0) start = r;
      blanks = 0;
    } else if (start >= 0) {
      blanks++;
      if (blanks > gap) {
        blocks.push([start, r - blanks]);
        start = -1;
        blanks = 0;
      }
    }
  }
  if (start >= 0) blocks.push([start, rows.length - 1 - blanks]);

  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i][1] - blocks[i][0] >= 1) out.push(blocks[i]);
  }
  return out;
}

/** 生成候选区域：整表 + 各个数据块 */
function buildRegions(rows) {
  const regions = [{ top: 0, bottom: rows.length - 1, kind: 'whole' }];
  const blocks = detectRowBlocks(rows);
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i][0] === 0 && blocks[i][1] === rows.length - 1) continue;
    regions.push({ top: blocks[i][0], bottom: blocks[i][1], kind: 'block' });
  }
  return regions;
}

/* ==================== 候选方案 ==================== */

function columnsKey(columns) {
  const keys = Object.keys(columns || {}).sort();
  return keys.map(function (k) { return k + ':' + columns[k]; }).join(',');
}

/**
 * 枚举所有候选方案
 * @returns {Array<Object>} 每个方案形如 { layout, headerRow, startRow, columns|dayColumns, source, label }
 */
function buildPlans(rows, ctx) {
  const plans = [];
  // 块太多时只分析最大的几块，避免碎片化表格拖慢识别
  const regions = buildRegions(rows)
    .sort(function (a, b) { return (b.bottom - b.top) - (a.bottom - a.top); })
    .slice(0, 6);

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const sub = rows.slice(region.top, region.bottom + 1);
    if (sub.length < 2) continue;
    const firstRowNo = region.top + 1; // 1 基行号，用于展示

    // A. 有表头的列表式
    const header = EX.findHeaderRow(sub, 15);
    if (header) {
      plans.push({
        layout: 'list',
        headerRow: region.top + header.headerRow,
        startRow: region.top + header.startRow,
        columns: header.columns,
        source: 'header',
        span: header.span,
        label: '识别到表头（第 ' + (firstRowNo + header.headerRow) + ' 行' +
          (header.span > 1 ? '，占 ' + header.span + ' 行' : '') + '）',
      });
    }

    // B. 星期 × 节次的课表网格
    const grids = EX.findGridHeaders(sub, 20);
    for (let k = 0; k < Math.min(grids.length, 2); k++) {
      plans.push({
        layout: 'grid',
        headerRow: region.top + grids[k].headerRow,
        dayColumns: grids[k].dayColumns,
        source: 'grid',
        label: '识别到课表网格（第 ' + (firstRowNo + grids[k].headerRow) + ' 行是星期）',
      });
    }

    // C. 没有表头时，靠列内数据特征推断
    const maxSkip = Math.min(3, sub.length - 2);
    let contentPlan = null;
    for (let skip = 0; skip <= maxSkip; skip++) {
      const body = sub.slice(skip);
      if (body.length < 2) continue;
      const infer = inferColumnsByProfile(body, ctx);
      if (!infer) continue;
      contentPlan = {
        layout: 'list',
        headerRow: region.top + skip - 1,
        startRow: region.top + skip,
        columns: infer.columns,
        source: 'content',
        inferred: infer,
        label: '按内容特征推断（无表头' + (skip ? '，跳过前 ' + skip + ' 行' : '') + '）',
      };
      break;
    }
    if (contentPlan) plans.push(contentPlan);
  }

  // 去重（同布局 + 同列映射 + 同行号只保留一个）
  const seen = {};
  const out = [];
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    const key = p.layout + '|' + (p.headerRow) + '|' +
      (p.layout === 'grid' ? p.dayColumns.map(function (d) { return d.col + ':' + d.day; }).join(',') : columnsKey(p.columns));
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(p);
  }
  return out.slice(0, 16);
}

/* ==================== 打分与选择 ==================== */

function avgConfidence(courses) {
  if (!courses.length) return 0;
  let sum = 0;
  for (let i = 0; i < courses.length; i++) sum += (courses[i]._confidence || 0);
  return sum / courses.length;
}

/** 给一次提取结果打分 */
function scoreResult(res, plan) {
  const n = res.courses.length;
  if (!n) return 0;

  let score = Math.min(n, 40) * 10;                    // 课程条数（封顶，避免大表碾压）
  score += avgConfidence(res.courses) * 60;            // 平均字段完整度
  if (res.stats && n) score += (res.stats.withRoom / n) * 25;
  if (plan.source === 'header') score += 30;           // 有表头最可信
  else if (plan.source === 'grid') score += 25;
  else score += 5;                                     // 纯内容推断略降权
  if (plan.layout === 'list') score += 8;

  // 同一门课在同一天被切成很多条，通常说明这次识别把结构搞错了 -> 扣分
  const seen = {};
  let dup = 0;
  for (let i = 0; i < res.courses.length; i++) {
    const c = res.courses[i];
    const key = c.name + '|' + c.day + '|' + (c.roomId || '');
    if (seen[key]) dup++;
    seen[key] = 1;
  }
  score -= dup * 12;

  return Math.round(score * 100) / 100;
}

/**
 * 分析表格：枚举方案 → 执行 → 打分排序
 * @returns {{ results: Array, diagnostics: Object }}
 */
function analyze(rows, ctx) {
  const plans = buildPlans(rows, ctx);
  const results = [];

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    let res = null;
    try {
      res = EX.extractFromTable(rows, ctx, plan);
    } catch (e) {
      res = null;
    }
    if (!res || !res.courses.length) continue;
    results.push({ plan: plan, res: res, score: scoreResult(res, plan) });
  }

  results.sort(function (a, b) { return b.score - a.score; });

  const diagnostics = {
    planCount: plans.length,
    regionCount: buildRegions(rows).length,
    rowCount: rows.length,
    colCount: maxWidth(rows),
  };

  return { results: results, diagnostics: diagnostics };
}

/**
 * 智能提取：自动找到课表区、判断布局、对齐字段
 * @returns {Object|null} 与 extractFromTable 一致的结果，另加 recognize 说明
 */
function extractSmart(rows, ctx) {
  const a = analyze(rows, ctx);
  if (!a.results.length) return null;

  const best = a.results[0];
  const res = best.res;

  res.recognize = {
    method: best.plan.label,
    layout: best.plan.layout,
    source: best.plan.source,
    score: best.score,
    confidence: Math.round(avgConfidence(res.courses) * 100) / 100,
    headerRow: best.plan.headerRow,
    columns: best.plan.columns || null,
    inferred: best.plan.inferred || null,
    alternatives: a.results.slice(1, 4).map(function (r) {
      return { method: r.plan.label, courses: r.res.courses.length, score: r.score };
    }),
    diagnostics: a.diagnostics,
  };

  return res;
}

module.exports = {
  rowWidth,
  maxWidth,
  profileColumn,
  profileTable,
  inferColumnsByProfile,
  detectRowBlocks,
  buildRegions,
  buildPlans,
  scoreResult,
  avgConfidence,
  analyze,
  extractSmart,
};
