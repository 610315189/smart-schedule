/*!
 * 智能课表 · 网页版核心逻辑 bundle
 * 本文件由 tools/build-web.js 自动生成，请勿手工编辑。
 * 源码位置：miniprogram/{config,data,utils}
 * 生成时间：2026-10-31T05:20:20.315Z
 * 模块数：20
 */
(function (global) {
  "use strict";
  var __modules = {};
  var __cache = {};
  function __require(id) {
    if (__cache[id]) return __cache[id].exports;
    var m = { exports: {} };
    __cache[id] = m;
    var fn = __modules[id];
    if (!fn) throw new Error("[bundle] 模块不存在: " + id);
    fn(m, m.exports, __require);
    return m.exports;
  }

  /* ---- config/index ---- */
  __modules["config/index"] = function (module, exports, require) {
/**
 * 全局配置中心
 * ---------------------------------------------------------------
 * 换学校 / 换学期时，通常只需要改这个文件 + data/ 目录下的三份数据。
 * 所有页面与工具函数都从这里读取配置，不要在各个页面里写死。
 */

/** 学期信息：startDate 必须是第 1 周的【周一】 */
const TERM = {
  name: '2026-2027 学年 第一学期',
  startDate: '2026-09-07',
  totalWeeks: 20,
};

/** 提醒策略（防迟到 / 防误课的核心参数） */
const REMIND = {
  /** 主提醒：距上课还有多少分钟时提醒 */
  aheadMinutes: 20,
  /** 二次提醒：临出门前的最后提醒 */
  finalAheadMinutes: 5,
  /** 进入小程序时，只要距上课小于该分钟数就自动弹提醒 */
  autoPopupMinutes: 30,
  /** 单节课时长兜底值（分钟），仅当节次表缺 end 时使用 */
  defaultLessonMinutes: 45,
  /** 课间提前多久提示"该去下一个教室了"（分钟） */
  moveBufferMinutes: 10,
};

/** 提醒方式开关（用户可在设置页覆盖） */
const NOTIFY_CHANNEL = {
  vibrate: true,   // 震动
  sound: true,     // 系统提示音（wx.vibrateLong + 音频）
  popup: true,     // 页面内醒目弹层
  calendar: true,  // 写入手机系统日历（离线最强保险）
};

/** 后端服务地址：留空则纯本地运行（提醒只在打开小程序时生效） */
const SERVER = {
  baseUrl: '',            // 例如 'https://api.example.com'
  subscribeTemplateId: '', // 微信公众平台申请到的订阅消息模板 ID
};

/** 主题色（课程块配色池，按课程自动分配） */
const COLORS = [
  '#2b5cff', '#12b886', '#f76707', '#7048e8',
  '#e64980', '#0ca678', '#f59f00', '#1098ad',
];

module.exports = {
  TERM,
  REMIND,
  NOTIFY_CHANNEL,
  SERVER,
  COLORS,
};

  };

  /* ---- data/classrooms ---- */
  __modules["data/classrooms"] = function (module, exports, require) {
/**
 * 教室字典
 * ---------------------------------------------------------------
 * 空教室查询的"全集"。学校所有可用于上课/自习的教室都要登记在这里，
 * 课表里出现的教室若不在本表中，查询结果会漏（页面会给出提示）。
 *
 * 字段说明：
 *  id        唯一编号，必须与课表里的 roomId 完全一致
 *  name      显示名，如 "A301"
 *  building  楼栋名，用于分组筛选
 *  campus    校区（有多校区时使用）
 *  floor     楼层，用于就近推荐
 *  capacity  座位数
 *  type      教室类型：normal 普通 / multimedia 多媒体 / lab 机房 / language 语音室 / drawing 制图室
 *  openForStudy 是否允许学生自习（部分实验室、办公室不开放，设为 false）
 *  facilities 设施标签：projector 投影 / ac 空调 / socket 插座 / accessible 无障碍
 */
const CLASSROOMS = [
  // ---------- 综合楼 A 座 ----------
  { id: 'A101', name: 'A101', building: '综合楼A座', campus: '主校区', floor: 1, capacity: 120, type: 'multimedia', openForStudy: true, facilities: ['projector', 'ac'] },
  { id: 'A102', name: 'A102', building: '综合楼A座', campus: '主校区', floor: 1, capacity: 120, type: 'multimedia', openForStudy: true, facilities: ['projector', 'ac'] },
  { id: 'A201', name: 'A201', building: '综合楼A座', campus: '主校区', floor: 2, capacity: 90, type: 'normal', openForStudy: true, facilities: ['socket'] },
  { id: 'A202', name: 'A202', building: '综合楼A座', campus: '主校区', floor: 2, capacity: 90, type: 'normal', openForStudy: true, facilities: ['socket'] },
  { id: 'A301', name: 'A301', building: '综合楼A座', campus: '主校区', floor: 3, capacity: 180, type: 'multimedia', openForStudy: true, facilities: ['projector', 'ac', 'socket'] },
  { id: 'A302', name: 'A302', building: '综合楼A座', campus: '主校区', floor: 3, capacity: 60, type: 'normal', openForStudy: true, facilities: [] },
  { id: 'A401', name: 'A401', building: '综合楼A座', campus: '主校区', floor: 4, capacity: 60, type: 'language', openForStudy: false, facilities: ['projector', 'ac'] },

  // ---------- 综合楼 B 座 ----------
  { id: 'B201', name: 'B201', building: '综合楼B座', campus: '主校区', floor: 2, capacity: 200, type: 'multimedia', openForStudy: true, facilities: ['projector', 'ac'] },
  { id: 'B301', name: 'B301', building: '综合楼B座', campus: '主校区', floor: 3, capacity: 100, type: 'normal', openForStudy: true, facilities: ['socket', 'ac'] },
  { id: 'B302', name: 'B302', building: '综合楼B座', campus: '主校区', floor: 3, capacity: 100, type: 'normal', openForStudy: true, facilities: ['socket'] },
  { id: 'B401', name: 'B401', building: '综合楼B座', campus: '主校区', floor: 4, capacity: 48, type: 'lab', openForStudy: false, facilities: ['projector', 'ac', 'socket'] },

  // ---------- 图书馆 ----------
  { id: 'LIB-201', name: '图书馆201自习室', building: '图书馆', campus: '主校区', floor: 2, capacity: 240, type: 'normal', openForStudy: true, facilities: ['ac', 'socket'] },
  { id: 'LIB-202', name: '图书馆202自习室', building: '图书馆', campus: '主校区', floor: 2, capacity: 160, type: 'normal', openForStudy: true, facilities: ['ac', 'socket'] },

  // ---------- 实验楼 ----------
  { id: 'C105', name: 'C105', building: '实验楼', campus: '主校区', floor: 1, capacity: 64, type: 'drawing', openForStudy: true, facilities: ['projector'] },
  { id: 'C201', name: 'C201', building: '实验楼', campus: '主校区', floor: 2, capacity: 40, type: 'lab', openForStudy: false, facilities: ['projector', 'ac', 'socket'] },
  { id: 'C202', name: 'C202', building: '实验楼', campus: '主校区', floor: 2, capacity: 40, type: 'lab', openForStudy: false, facilities: ['projector', 'ac', 'socket'] },
];

const TYPE_LABEL = {
  normal: '普通教室',
  multimedia: '多媒体',
  lab: '机房/实验室',
  language: '语音室',
  drawing: '制图室',
};

const FACILITY_LABEL = {
  projector: '投影',
  ac: '空调',
  socket: '插座',
  accessible: '无障碍',
};

module.exports = { CLASSROOMS, TYPE_LABEL, FACILITY_LABEL };

  };

  /* ---- data/courses ---- */
  __modules["data/courses"] = function (module, exports, require) {
/**
 * 我的课表（示例数据，首次启动会写入本地存储，之后可在"课表-编辑"里改）
 * ---------------------------------------------------------------
 * 字段说明：
 *  id        唯一 id，导入时若重复会被覆盖
 *  name      课程名
 *  teacher   任课教师（可空）
 *  roomId    教室编号，必须与 data/classrooms.js 里的 id 对应
 *  day       星期几，1=周一 … 7=周日
 *  start     起始节次（含）
 *  end       结束节次（含）；单节课时 start === end
 *  weeks     周次规则 { start, end, parity }，parity: all | odd | even
 *  color     课程块颜色（可空，会自动分配）
 *  note      备注，如 "带实验报告"
 */
const COURSES = [
  {
    id: 'c01', name: '高等数学(上)', teacher: '张建国', roomId: 'A301',
    day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#2b5cff', note: '带教材与习题册',
  },
  {
    id: 'c02', name: '大学英语(II)', teacher: '李雯', roomId: 'A401',
    day: 1, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#12b886', note: '',
  },
  {
    id: 'c03', name: '机器学习导论', teacher: '王海涛', roomId: 'B401',
    day: 1, start: 9, end: 10, weeks: { start: 1, end: 8, parity: 'all' },
    color: '#7048e8', note: '机房上机，需带校园卡',
  },
  {
    id: 'c04', name: '概率论与数理统计', teacher: '陈默', roomId: 'A202',
    day: 2, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#f76707', note: '',
  },
  {
    id: 'c05', name: '线性代数', teacher: '赵敏', roomId: 'B201',
    day: 2, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#1098ad', note: '',
  },
  {
    id: 'c06', name: '程序设计基础', teacher: '刘伟', roomId: 'A301',
    day: 3, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#2b5cff', note: '记得交第 3 次作业',
  },
  {
    id: 'c07', name: '数据结构与算法', teacher: '刘伟', roomId: 'B301',
    day: 3, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#e64980', note: '',
  },
  {
    id: 'c08', name: 'Python 数据分析(选修)', teacher: '孙倩', roomId: 'B401',
    day: 3, start: 9, end: 10, weeks: { start: 3, end: 12, parity: 'all' },
    color: '#0ca678', note: '实验课，需自带电脑',
  },
  {
    id: 'c09', name: '大学物理', teacher: '周立', roomId: 'A201',
    day: 4, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#f59f00', note: '',
  },
  {
    id: 'c10', name: '体育(羽毛球)', teacher: '吴强', roomId: 'C105',
    day: 4, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#12b886', note: '穿运动鞋',
  },
  {
    id: 'c11', name: '计算机网络', teacher: '郑楠', roomId: 'B201',
    day: 5, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#7048e8', note: '',
  },
  {
    id: 'c12', name: '思想道德与法治', teacher: '何静', roomId: 'A101',
    day: 5, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' },
    color: '#1098ad', note: '',
  },
];

module.exports = { COURSES };

  };

  /* ---- data/occupancy ---- */
  __modules["data/occupancy"] = function (module, exports, require) {
/**
 * 全校教室占用表（可选，但强烈建议导入真实数据）
 * ---------------------------------------------------------------
 * 只用"我的课表"反推空教室是不准的：你只能看到自己班的课，
 * 别的班级占用同一间教室你并不知道。
 *
 * 因此提供一个独立的全校占用数据源。获取方式（任选）：
 *  1) 教务系统导出的全校课表（含教室、周次、节次），提取这四个字段即可；
 *  2) 学校公开的教室借用 / 排课公示；
 *  3) 手动录入已知的长期占用（如"每周三 5-6 节 B401 有实验课"）。
 *
 * 字段与课程一致（不需要 teacher / color / note）：
 *  { id, name, roomId, day, start, end, weeks }
 *
 * 下方为演示用示例数据，请替换成本校真实数据。
 */
const OCCUPANCY = [
  // ---------- 周一 ----------
  { id: 'o101', name: '大学语文', roomId: 'A101', day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o102', name: '中国近现代史纲要', roomId: 'A102', day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o103', name: '离散数学', roomId: 'A201', day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o104', name: '英语听说', roomId: 'B301', day: 1, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o105', name: '工程制图', roomId: 'A301', day: 1, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o106', name: '管理学原理', roomId: 'B201', day: 1, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o107', name: '形势与政策', roomId: 'A302', day: 1, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o108', name: '数据库原理', roomId: 'B302', day: 1, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },

  // ---------- 周二 ----------
  { id: 'o201', name: '计算机导论', roomId: 'A101', day: 2, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o202', name: '大学物理实验', roomId: 'A201', day: 2, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o203', name: '操作系统', roomId: 'A202', day: 2, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o204', name: '数学分析', roomId: 'A301', day: 2, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o205', name: '大学英语(II)', roomId: 'B201', day: 2, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o206', name: '算法设计与分析', roomId: 'B301', day: 2, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o207', name: '羽毛球', roomId: 'C105', day: 2, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },

  // ---------- 周三 ----------
  { id: 'o301', name: '思想道德与法治', roomId: 'A101', day: 3, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o302', name: '高等数学(下)', roomId: 'A102', day: 3, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o303', name: '线性代数', roomId: 'A202', day: 3, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o304', name: '大学英语(I)', roomId: 'B201', day: 3, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o305', name: '数据结构', roomId: 'B301', day: 3, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o306', name: '软件工程', roomId: 'B401', day: 3, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o307', name: '概率论', roomId: 'A201', day: 3, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o308', name: '工程训练', roomId: 'C105', day: 3, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o309', name: '编译原理实验', roomId: 'C201', day: 3, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o310', name: '大学生心理健康', roomId: 'A302', day: 3, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },

  // ---------- 周四 ----------
  { id: 'o401', name: '高等数学(上)', roomId: 'A201', day: 4, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o402', name: '体育(篮球)', roomId: 'C202', day: 4, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o403', name: '大学物理实验', roomId: 'C201', day: 4, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o404', name: '财务管理', roomId: 'A102', day: 4, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o405', name: '计算机网络', roomId: 'B201', day: 4, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o406', name: '市场营销', roomId: 'A202', day: 4, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o407', name: '经济法', roomId: 'A101', day: 4, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o408', name: '移动应用开发', roomId: 'A301', day: 4, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o409', name: '大学英语(III)', roomId: 'B302', day: 4, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },

  // ---------- 周五 ----------
  { id: 'o501', name: '形势与政策', roomId: 'A101', day: 5, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o502', name: '概率论与数理统计', roomId: 'A202', day: 5, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o503', name: '高等数学(上)', roomId: 'A301', day: 5, start: 1, end: 2, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o504', name: '数据结构', roomId: 'B201', day: 5, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o505', name: '操作系统', roomId: 'A302', day: 5, start: 3, end: 4, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o506', name: '大学物理', roomId: 'A201', day: 5, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o507', name: '机器学习', roomId: 'B301', day: 5, start: 5, end: 6, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o508', name: '英语听说', roomId: 'A102', day: 5, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o509', name: '羽毛球', roomId: 'B302', day: 5, start: 7, end: 8, weeks: { start: 1, end: 16, parity: 'all' } },
  { id: 'o510', name: '工程训练', roomId: 'C105', day: 5, start: 9, end: 10, weeks: { start: 1, end: 16, parity: 'all' } },
];

module.exports = { OCCUPANCY };

  };

  /* ---- data/periods ---- */
  __modules["data/periods"] = function (module, exports, require) {
/**
 * 节次时间表
 * ---------------------------------------------------------------
 * 直接按本校作息修改 start / end 即可，节次数量可增可减。
 * section 只用于界面分组显示：morning / afternoon / evening
 */
const DEFAULT_PERIODS = [
  { period: 1, start: '08:00', end: '08:45', section: 'morning' },
  { period: 2, start: '08:55', end: '09:40', section: 'morning' },
  { period: 3, start: '10:00', end: '10:45', section: 'morning' },
  { period: 4, start: '10:55', end: '11:40', section: 'morning' },
  { period: 5, start: '14:00', end: '14:45', section: 'afternoon' },
  { period: 6, start: '14:55', end: '15:40', section: 'afternoon' },
  { period: 7, start: '16:00', end: '16:45', section: 'afternoon' },
  { period: 8, start: '16:55', end: '17:40', section: 'afternoon' },
  { period: 9, start: '19:00', end: '19:45', section: 'evening' },
  { period: 10, start: '19:55', end: '20:40', section: 'evening' },
];

const SECTION_LABEL = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

module.exports = { DEFAULT_PERIODS, SECTION_LABEL };

  };

  /* ---- utils/bytes ---- */
  __modules["utils/bytes"] = function (module, exports, require) {
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

  };

  /* ---- utils/classroom ---- */
  __modules["utils/classroom"] = function (module, exports, require) {
/**
 * 空教室查询（可用于自习）
 * ---------------------------------------------------------------
 * 思路：把"教室全集 - 该时段被占用的教室" = 空教室。
 * 占用来源有两个，合并计算：
 *   1) 我的课表（courses）—— 只能看到自己班的占用
 *   2) 全校占用表（occupancy）—— 可选导入，数据越全结果越准
 *
 * 同时计算每间教室"今天的所有空堂时段"，方便判断哪间教室能连坐几个小时。
 */
const T = require("utils/time");
const S = require("utils/schedule");
const CLS = require("data/classrooms");

function resolveDate(date) {
  if (!date) return new Date();
  return T.parseDate(date) || new Date();
}

/** 节次区间是否与 [s2,e2] 有交集 */
function overlaps(s1, e1, s2, e2) {
  return !(e1 < s2 || e2 < s1);
}

/**
 * 构建某天每间教室的占用索引
 * @returns { week, day, busy: { roomId: { [period]: {name, source} } }, byRoom: { roomId: [records] }, unknownRooms: [] }
 */
function buildBusyMap(courses, occupancy, classrooms, date, settings) {
  const d = resolveDate(date);
  const week = T.getWeekIndex(d, settings.termStartDate);
  const day = T.getDayOfWeek(d);
  const totalWeeks = settings.totalWeeks;
  const busy = {};
  const byRoom = {};
  const unknownRooms = [];
  const known = {};
  for (let i = 0; i < classrooms.length; i++) known[classrooms[i].id] = true;

  function addRecords(list, source) {
    for (let i = 0; i < (list || []).length; i++) {
      const c = list[i];
      if (Number(c.day) !== day) continue;
      if (!S.isWeekActive(c, week, totalWeeks)) continue;
      const roomId = c.roomId;
      if (!roomId) continue;
      if (!known[roomId] && unknownRooms.indexOf(roomId) < 0) unknownRooms.push(roomId);
      if (!busy[roomId]) busy[roomId] = {};
      for (let p = Number(c.start); p <= Number(c.end); p++) {
        if (!busy[roomId][p]) busy[roomId][p] = { name: c.name, source: source, period: p };
      }
      if (!byRoom[roomId]) byRoom[roomId] = [];
      byRoom[roomId].push({ name: c.name, start: c.start, end: c.end, source: source, teacher: c.teacher || '' });
    }
  }

  addRecords(courses, 'mine');
  addRecords(occupancy, 'school');

  return { date: d, week: week, day: day, busy: busy, byRoom: byRoom, unknownRooms: unknownRooms };
}

/** 某教室在 [start,end] 区间内是否全空（供外部按需调用） */
function isFree(busy, roomId, start, end) {
  const m = busy[roomId];
  if (!m) return true;
  for (let p = start; p <= end; p++) {
    if (m[p]) return false;
  }
  return true;
}

/** 某教室当天的空闲时段列表 */
function freeRuns(busyMap, roomId, periods) {
  const maxPeriod = periods.length ? periods[periods.length - 1].period : 0;
  const out = [];
  let runStart = null;
  for (let p = 1; p <= maxPeriod; p++) {
    const free = !busyMap.busy[roomId] || !busyMap.busy[roomId][p];
    if (free) {
      if (runStart === null) runStart = p;
    } else if (runStart !== null) {
      out.push(runOf(periods, runStart, p - 1));
      runStart = null;
    }
  }
  if (runStart !== null) out.push(runOf(periods, runStart, maxPeriod));
  return out;
}

function runOf(periods, start, end) {
  const t = S.periodRange(periods, start, end);
  let len = 0;
  for (let p = start; p <= end; p++) {
    const info = S.periodInfo(periods, p);
    if (info) {
      len += T.toMinutes(info.end) - T.toMinutes(info.start);
    }
  }
  return {
    start: start,
    end: end,
    periodText: S.formatPeriods(start, end),
    startTime: t.start,
    endTime: t.end,
    minutes: len,
    durationText: T.humanDuration(len),
  };
}

function facilityLabels(list) {
  const out = [];
  for (let i = 0; i < (list || []).length; i++) {
    out.push(CLS.FACILITY_LABEL[list[i]] || list[i]);
  }
  return out;
}

/**
 * 查询空闲教室
 * @param {Object} opts
 *  opt.date          查询日期（Date 或 'YYYY-MM-DD'），默认今天
 *  opt.startPeriod   起始节次
 *  opt.endPeriod     结束节次
 *  opt.courses       我的课表
 *  opt.occupancy     全校占用表
 *  opt.classrooms    教室字典
 *  opt.periods       节次表
 *  opt.settings      设置（termStartDate / totalWeeks）
 *  opt.building      楼栋筛选，'' = 全部
 *  opt.minCapacity   最小座位数
 *  opt.type          教室类型筛选
 *  opt.facilities    需要具备的设施 id 数组（全部满足）
 *  opt.onlyStudy     只看允许自习的教室，默认 true
 *  opt.sort          'building' 默认 | 'capacity' | 'freespan'
 */
function queryFreeRooms(opts) {
  const o = opts || {};
  const settings = o.settings || {};
  const classrooms = o.classrooms || [];
  const periods = o.periods || [];
  const d = resolveDate(o.date);
  const start = Number(o.startPeriod) || 1;
  const end = Number(o.endPeriod) || start;
  const onlyStudy = o.onlyStudy === undefined ? true : !!o.onlyStudy;
  const minCapacity = Number(o.minCapacity) || 0;
  const busyMap = o.busyMap || buildBusyMap(o.courses, o.occupancy, classrooms, d, settings);

  const free = [];
  const occupied = [];
  const skipped = [];

  for (let i = 0; i < classrooms.length; i++) {
    const room = classrooms[i];
    if (onlyStudy && room.openForStudy === false) {
      skipped.push(room);
      continue;
    }
    if (minCapacity && (room.capacity || 0) < minCapacity) continue;
    if (o.building && room.building !== o.building) continue;
    if (o.type && room.type !== o.type) continue;
    if (o.campus && room.campus !== o.campus) continue;
    if (o.facilities && o.facilities.length) {
      const fac = room.facilities || [];
      let ok = true;
      for (let k = 0; k < o.facilities.length; k++) {
        if (fac.indexOf(o.facilities[k]) < 0) { ok = false; break; }
      }
      if (!ok) continue;
    }

    const runs = freeRuns(busyMap, room.id, periods);
    const covering = pickRun(runs, start, end);
    const item = {
      id: room.id,
      name: room.name,
      building: room.building,
      campus: room.campus || '',
      floor: room.floor || 0,
      capacity: room.capacity || 0,
      type: room.type,
      typeLabel: CLS.TYPE_LABEL[room.type] || room.type,
      facilities: room.facilities || [],
      facilityLabels: facilityLabels(room.facilities),
      openForStudy: room.openForStudy !== false,
      freeRuns: runs,
      coveringRun: covering,
      occupiedToday: (busyMap.byRoom[room.id] || []).map(function (r) {
        return {
          name: r.name,
          periodText: S.formatPeriods(r.start, r.end),
          source: r.source,
          teacher: r.teacher,
        };
      }),
    };

    if (covering) {
      item.currentRun = covering;
      // 主文案强调"查询的这段是空的"，并额外给出能连用多久
      const querySpan = S.formatPeriods(start, end);
      item.freeSpanText = querySpan + ' 空';
      item.runSpanText = covering.periodText === querySpan
        ? ''
        : ('可连用 ' + covering.periodText + '（' + covering.durationText + '）');
      free.push(item);
    } else {
      occupied.push(item);
    }
  }

  const sortBy = o.sort || 'building';
  if (sortBy === 'capacity') {
    free.sort(function (a, b) { return (b.capacity || 0) - (a.capacity || 0); });
  } else if (sortBy === 'freespan') {
    free.sort(function (a, b) { return (b.coveringRun.minutes || 0) - (a.coveringRun.minutes || 0); });
  } else {
    free.sort(function (a, b) {
      if (a.building !== b.building) return a.building < b.building ? -1 : 1;
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.name < b.name ? -1 : 1;
    });
  }

  return {
    date: d,
    week: busyMap.week,
    day: busyMap.day,
    startPeriod: start,
    endPeriod: end,
    periodText: S.formatPeriods(start, end),
    timeRange: S.periodRange(periods, start, end),
    free: free,
    occupied: occupied,
    skipped: skipped,
    unknownRooms: busyMap.unknownRooms,
    buildings: collectBuildings(classrooms),
    busyMap: busyMap,
  };
}

/** 在空闲段列表中找出覆盖 [start,end] 的那一段 */
function pickRun(runs, start, end) {
  for (let i = 0; i < runs.length; i++) {
    if (runs[i].start <= start && runs[i].end >= end) return runs[i];
  }
  return null;
}

function collectBuildings(classrooms) {
  const out = [];
  for (let i = 0; i < classrooms.length; i++) {
    const b = classrooms[i].building;
    if (b && out.indexOf(b) < 0) out.push(b);
  }
  return out;
}

/** 当前时刻对应的节次；课间时返回下一节，便于"现在去哪儿自习" */
function currentPeriodContext(periods, now) {
  const n = now || new Date();
  const nowMin = T.dateToMinutes(n);
  let last = null;
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const s = T.toMinutes(p.start);
    const e = T.toMinutes(p.end);
    if (nowMin >= s && nowMin < e) return { period: p.period, phase: 'in', periodInfo: p };
    if (nowMin < s && !last) last = p;
  }
  if (last) return { period: last.period, phase: 'break', periodInfo: last };
  return { period: periods.length ? periods[periods.length - 1].period : 0, phase: 'after', periodInfo: null };
}

/** 现在（或下一节）去哪自习：返回空闲教室列表，默认查连续 2 节 */
function queryFreeRoomsNow(opts) {
  const o = opts || {};
  const periods = o.periods || [];
  const ctx = currentPeriodContext(periods, o.now || new Date());
  const span = o.span || 2;
  const maxPeriod = periods.length ? periods[periods.length - 1].period : 10;
  const start = ctx.period || 1;
  const end = Math.min(start + span - 1, maxPeriod);
  const res = queryFreeRooms(Object.assign({}, o, { startPeriod: start, endPeriod: end }));
  res.context = ctx;
  return res;
}

/**
 * 根据教室编号猜出一个教室条目。
 * 用于把"课表里出现、但教室字典里没有"的教室补进字典，
 * 否则这些教室不会出现在空教室查询结果里。
 *
 *   经管教学楼308 -> building "经管教学楼", floor 3
 *   综合602       -> building "综合",       floor 6
 *   A301          -> building "A",          floor 3
 */
function guessClassroom(id) {
  const s = String(id || '').trim();
  if (!s) return null;

  const base = {
    id: s,
    name: s,
    capacity: 0,
    type: 'normal',
    openForStudy: true,
    facilities: [],
  };

  const m = s.match(/^([\u4e00-\u9fa5A-Za-z\-]*?)[\s-]?(\d{3,4})$/);
  if (!m) {
    const letters = s.match(/^[\u4e00-\u9fa5A-Za-z]+/);
    base.building = letters ? letters[0] : '未分类';
    base.floor = 0;
    return base;
  }

  const num = m[2];
  base.building = m[1] || '未分类';
  base.floor = num.length >= 3 ? Number(num.slice(0, num.length - 2)) : 0;
  return base;
}

module.exports = {
  buildBusyMap,
  isFree,
  freeRuns,
  queryFreeRooms,
  queryFreeRoomsNow,
  currentPeriodContext,
  collectBuildings,
  guessClassroom,
};

  };

  /* ---- utils/docx ---- */
  __modules["utils/docx"] = function (module, exports, require) {
/**
 * DOCX（Word 2007+）解析
 * ---------------------------------------------------------------
 * 提取课表需要的内容：
 *   - 表格：二维文本数组（支持 gridSpan 横向合并、vMerge 纵向合并继承）
 *   - 段落：表格外的正文行（用于"一行一门课"的 Word 课表）
 */
const ZIP = require("utils/zip");
const XML = require("utils/xml");
const B = require("utils/bytes");

/** 段落文本：处理 w:t 文本、w:br 换行、w:tab 制表符 */
function paragraphText(p) {
  let s = '';
  (function walk(n) {
    for (let i = 0; i < n.children.length; i++) {
      const c = n.children[i];
      if (c.name === XML.TEXT_NODE) {
        s += c.text;
        continue;
      }
      const ln = XML.localName(c.name);
      if (ln === 't') {
        s += XML.textOf(c);
        continue;
      }
      if (ln === 'br' || ln === 'cr') {
        s += '\n';
        continue;
      }
      if (ln === 'tab') {
        s += '\t';
        continue;
      }
      walk(c);
    }
  })(p);
  return s;
}

/** 单元格文本：多个段落用 \n 连接（课表里一个格子常常放课程名/教师/教室多行） */
function cellText(tc) {
  const parts = [];
  const ps = XML.children(tc, 'p');
  for (let i = 0; i < ps.length; i++) {
    parts.push(paragraphText(ps[i]).replace(/\s+$/, ''));
  }
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts.join('\n');
}

/** 解析一个表格为二维数组 */
function parseTable(tbl) {
  const rows = XML.children(tbl, 'tr');
  const out = [];
  const pendingV = {}; // 列索引 -> 正在纵向合并的值

  for (let r = 0; r < rows.length; r++) {
    const tcs = XML.children(rows[r], 'tc');
    const line = [];
    let col = 0;

    for (let k = 0; k < tcs.length; k++) {
      const tc = tcs[k];
      const tcPr = XML.find(tc, 'tcPr');
      let span = 1;
      let vMerge = null;

      if (tcPr) {
        const gs = XML.find(tcPr, 'gridSpan');
        if (gs) span = Math.max(1, Number(XML.attr(gs, 'val')) || 1);
        const vm = XML.find(tcPr, 'vMerge');
        if (vm) vMerge = XML.attr(vm, 'val') || 'continue';
      }

      let text = cellText(tc);

      if (vMerge === 'restart') {
        // 合并起点，记住值
      } else if (vMerge && vMerge !== 'restart') {
        // 合并延续：继承上方的值
        if (pendingV[col] !== undefined && text === '') text = pendingV[col];
      } else {
        // 不参与纵向合并：清掉该列挂起的值
        delete pendingV[col];
      }

      for (let s = 0; s < span; s++) {
        line.push(text);
        if (vMerge === 'restart') pendingV[col + s] = text;
        col++;
      }
    }
    out.push(line);
  }

  return out;
}

/**
 * 解析 docx 文件
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {{paragraphs: String[], tables: Array, allText: String}}
 */
function parseDocx(input) {
  const bytes = B.toBytes(input);
  if (ZIP.isOle2(bytes)) {
    throw new Error('这是旧版 .doc 格式。请在 Word 中「另存为」.docx 后再导入');
  }
  const zip = ZIP.readZip(bytes);

  let docPath = 'word/document.xml';
  if (!zip.has(docPath)) {
    const hit = zip.names().filter(function (n) {
      return /^word\/document\d*\.xml$/.test(n);
    })[0];
    if (!hit) throw new Error('Word 文件结构异常：缺少 word/document.xml');
    docPath = hit;
  }

  const doc = XML.parse(zip.text(docPath));
  const body = XML.find(doc, 'body') || doc;

  const paragraphs = [];
  const tables = [];
  const allTextParts = [];

  // 只处理 body 的直接子节点，避免把表格内段落重复计入
  for (let i = 0; i < body.children.length; i++) {
    const c = body.children[i];
    if (c.name === XML.TEXT_NODE) continue;
    const ln = XML.localName(c.name);
    if (ln === 'p') {
      const t = paragraphText(c).trim();
      if (t) paragraphs.push(t);
    } else if (ln === 'tbl') {
      const table = parseTable(c);
      if (table.length) {
        tables.push(table);
        table.forEach(function (row) {
          const line = row.map(function (v) { return v.replace(/\n/g, ' '); }).join(' ');
          if (line.trim()) allTextParts.push(line);
        });
      }
    }
  }

  return {
    paragraphs: paragraphs,
    tables: tables,
    allText: paragraphs.concat(allTextParts).join('\n'),
  };
}

module.exports = {
  parseDocx,
  parseTable,
  paragraphText,
  cellText,
};

  };

  /* ---- utils/file-import ---- */
  __modules["utils/file-import"] = function (module, exports, require) {
/**
 * 课表文件导入
 * ---------------------------------------------------------------
 * 支持从微信聊天记录里选择文件并解析成课程：
 *   Excel  .xlsx（含共享字符串、合并单元格）
 *   Word   .docx（表格 / 段落）
 *   CSV    .csv
 *   文本   .txt
 *
 * 旧版 .xls / .doc（OLE2 二进制格式）无法在端上解析，会给出明确提示。
 */
const B = require("utils/bytes");
const ZIP = require("utils/zip");
const XLSX = require("utils/xlsx");
const DOCX = require("utils/docx");
const EX = require("utils/schedule-extract");
const DETECT = require("utils/table-detect");

const MAX_BYTES = 20 * 1024 * 1024; // 20MB，超过就拒绝，避免小程序内存溢出

/**
 * 智能提取：先让 table-detect 自己找课表区、判布局、对字段，
 * 全部失败时回退到常规识别，保证不会比之前更差。
 */
function extractSmart(rows, ctx) {
  let res = null;
  try {
    res = DETECT.extractSmart(rows, ctx);
  } catch (e) {
    res = null;
  }
  if (res && res.courses && res.courses.length) return res;

  const fallback = EX.extractFromTable(rows, ctx);
  if (fallback && fallback.courses && fallback.courses.length) {
    fallback.recognize = {
      method: '常规识别（智能路径未命中，已回退）',
      layout: fallback.layout,
      source: 'fallback',
      score: 0,
      confidence: 0,
    };
  }
  return fallback;
}

/** 识别文件类型 */
function detectFileType(bytes, fileName) {
  const b = B.toBytes(bytes);
  const name = String(fileName || '').toLowerCase();

  if (b.length >= 4 && B.tag4(b, 0) === 'PK\u0003\u0004') {
    // ZIP 容器：看内部结构区分 xlsx / docx / pptx
    try {
      const zip = ZIP.readZip(b);
      if (zip.has('xl/workbook.xml') || zip.names().some(function (n) { return /^xl\/worksheets\//.test(n); })) {
        return 'xlsx';
      }
      if (zip.has('word/document.xml') || zip.names().some(function (n) { return /^word\/document\d*\.xml$/.test(n); })) {
        return 'docx';
      }
      if (zip.has('ppt/presentation.xml')) return 'pptx';
      return 'zip';
    } catch (e) {
      return 'zip';
    }
  }

  if (ZIP.isOle2(b)) {
    if (/\.xls$/.test(name)) return 'xls-legacy';
    if (/\.doc$/.test(name)) return 'doc-legacy';
    return 'ole2';
  }

  if (/\.csv$/.test(name)) return 'csv';
  if (/\.txt$/.test(name)) return 'txt';
  if (/\.xlsx$/.test(name)) return 'xlsx';
  if (/\.docx$/.test(name)) return 'docx';
  if (/\.xls$/.test(name)) return 'xls-legacy';
  if (/\.doc$/.test(name)) return 'doc-legacy';

  // 无法判断时按纯文本处理（很多导出的课表就是纯文本）
  return 'txt';
}

/** 简易 CSV 解析（支持双引号包裹与转义） */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text).replace(/^\ufeff/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // 忽略，交给 \n 处理
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 统计替换字符，用于判断是否可能是 GBK 编码 */
function countBadChars(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0xfffd) n++;
  }
  return n;
}

/** 给一次提取结果打个可比较的分数 */
function resultScore(res) {
  if (!res || !res.courses || !res.courses.length) return 0;
  if (res.recognize && res.recognize.score) return res.recognize.score;
  return res.courses.length * 10;
}

/** 从 Excel 的所有工作表里挑出最像课表的那一个 */
function pickBestSheet(sheets, ctx) {
  let best = null;
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    if (!sheet.rows || !sheet.rows.length) continue;
    const res = extractSmart(sheet.rows, ctx);
    const score = resultScore(res);
    if (score > 0 && (!best || score > best.score)) {
      best = { sheet: sheet, result: res, score: score };
    }
  }
  return best;
}

/** 从 Word 的多个表格里挑出最像课表的那个 */
function pickBestTable(tables, ctx) {
  let best = null;
  for (let i = 0; i < tables.length; i++) {
    const res = extractSmart(tables[i], ctx);
    const score = resultScore(res);
    if (score > 0 && (!best || score > best.score)) {
      best = { table: tables[i], index: i, result: res, score: score };
    }
  }
  return best;
}

/**
 * 解析文件字节（纯函数，方便测试）
 * @param {Uint8Array|ArrayBuffer|String} input
 * @param {String} fileName
 * @param {Object} ctx { classrooms, periods, totalWeeks }
 * @returns {Object} { ok, fileType, courses, layout, warnings, ... }
 */
function parseBytes(input, fileName, ctx) {
  const context = ctx || {};
  const bytes = B.toBytes(input);

  if (!bytes.length) return fail('文件是空的');
  if (bytes.length > MAX_BYTES) {
    return fail('文件太大（' + Math.round(bytes.length / 1024 / 1024) + 'MB），请只保留课表内容后重试');
  }

  const type = detectFileType(bytes, fileName);

  if (type === 'xls-legacy') {
    return fail('这是旧版 .xls 格式，小程序无法直接读取。\n请在 Excel 中打开后「另存为 → Excel 工作簿(*.xlsx)」再导入。', type);
  }
  if (type === 'doc-legacy') {
    return fail('这是旧版 .doc 格式，小程序无法直接读取。\n请在 Word 中打开后「另存为 → Word 文档(*.docx)」再导入。', type);
  }
  if (type === 'ole2') {
    return fail('这是旧版 Office 二进制格式（.xls / .doc），请另存为 .xlsx 或 .docx 后导入。', type);
  }
  if (type === 'pptx') {
    return fail('检测到的是 PowerPoint 文件，请改用 Excel 或 Word 课表。', type);
  }
  if (type === 'zip') {
    return fail('这是压缩包，不是可识别的课表文件。请上传 .xlsx / .docx / .csv / .txt。', type);
  }

  if (type === 'xlsx') return parseXlsxBytes(bytes, fileName, context);
  if (type === 'docx') return parseDocxBytes(bytes, fileName, context);

  // 文本类
  const text = B.utf8Decode(bytes);
  const bad = countBadChars(text);
  const warnings = [];
  if (bad > 3) {
    warnings.push('文件可能不是 UTF-8 编码（检测到 ' + bad + ' 个乱码字符）。' +
      '如果课程名显示为乱码，请用 Excel/WPS 另存为「CSV UTF-8」格式后重试。');
  }

  if (type === 'csv') {
    const rows = parseCsv(text);
    const res = extractSmart(rows, context);
    if (res.courses.length) {
      return success('csv', res, warnings.concat(res.warnings || []), {
        rows: rows.length,
        layout: res.layout,
      });
    }
    // CSV 无表头时退回文本解析
    const textRes = EX.extractFromText(text, context);
    if (textRes.courses.length) {
      return success('csv', textRes, warnings.concat(['CSV 没有识别到表头，已按文本逐行解析']), { rows: rows.length });
    }
    return fail('CSV 里没有识别出课表结构。\n' + (res.warnings || []).join('\n'), 'csv');
  }

  const res = EX.extractFromText(text, context);
  if (!res.courses.length) {
    return fail('文本里没有识别出课表结构。每行需包含课程名、星期、节次，例如：\n' +
      '高等数学(上),周一,1,2,A301,1-16', 'txt');
  }
  return success('txt', res, warnings.concat(res.warnings || []), {
    errors: res.errors || [],
  });
}

function success(fileType, res, warnings, extra) {
  return Object.assign({
    ok: true,
    fileType: fileType,
    layout: res.layout,
    courses: res.courses || [],
    warnings: warnings || [],
    unknownRooms: res.unknownRooms || [],
    stats: res.stats || { total: (res.courses || []).length },
    recognize: res.recognize || null,
  }, extra || {});
}

function fail(message, fileType) {
  return {
    ok: false,
    fileType: fileType || 'unknown',
    error: message,
    courses: [],
    warnings: [],
    unknownRooms: [],
    stats: { total: 0 },
  };
}

function parseXlsxBytes(bytes, fileName, ctx) {
  let parsed;
  try {
    parsed = XLSX.parseXlsx(bytes);
  } catch (e) {
    return fail('Excel 解析失败：' + e.message, 'xlsx');
  }
  if (!parsed.sheets.length) return fail('Excel 里没有工作表', 'xlsx');

  const best = pickBestSheet(parsed.sheets, ctx);
  if (!best) {
    return fail('Excel 里没有识别出课表结构。\n' +
      '请确认表格第一行是表头（课程名称 / 星期 / 节次 / 教室 / 周次），\n' +
      '或者是"上方是星期、左侧是节次"的课表网格。\n' +
      '当前工作表：' + parsed.sheetNames.join('、'), 'xlsx');
  }

  const warnings = (best.result.warnings || []).slice();
  if (parsed.sheets.length > 1) {
    warnings.unshift('文件包含 ' + parsed.sheets.length + ' 个工作表，已自动选用「' +
      best.sheet.name + '」（识别出 ' + best.result.courses.length + ' 门课）');
  }

  return success('xlsx', best.result, warnings, {
    layout: best.result.layout,
    sheetNames: parsed.sheetNames,
    usedSheet: best.sheet.name,
  });
}

function parseDocxBytes(bytes, fileName, ctx) {
  let parsed;
  try {
    parsed = DOCX.parseDocx(bytes);
  } catch (e) {
    return fail('Word 解析失败：' + e.message, 'docx');
  }

  const warnings = [];

  if (parsed.tables.length) {
    const best = pickBestTable(parsed.tables, ctx);
    if (best) {
      if (parsed.tables.length > 1) {
        warnings.push('文档包含 ' + parsed.tables.length + ' 个表格，已自动选用第 ' +
          (best.index + 1) + ' 个（识别出 ' + best.result.courses.length + ' 门课）');
      }
      return success('docx', best.result, warnings.concat(best.result.warnings || []), {
        tables: parsed.tables.length,
        paragraphs: parsed.paragraphs.length,
      });
    }
    warnings.push('文档里的表格没有识别出课表结构，已尝试按正文文本解析');
  }

  // 没有表格 / 表格识别失败 -> 按正文文本
  const text = parsed.paragraphs.join('\n');
  const res = EX.extractFromText(text, ctx);
  if (!res.courses.length) {
    return fail('Word 文档里没有识别出课表。\n' +
      '支持的形式：\n' +
      '① 表格，表头为 课程名称/星期/节次/教室/周次\n' +
      '② 表格，上方是星期、左侧是节次的课表网格\n' +
      '③ 正文每行一条：高等数学 周一 1-2节 A301 1-16周', 'docx');
  }
  return success('docx', res, warnings.concat(res.warnings || []), {
    tables: parsed.tables.length,
    paragraphs: parsed.paragraphs.length,
  });
}

/* ==================== 与小程序文件系统交互 ==================== */

/** 读取本地文件为字节数组 */
function readFileBytes(filePath) {
  const fs = wx.getFileSystemManager();
  try {
    const ab = fs.readFileSync(filePath);
    if (ab instanceof ArrayBuffer) return new Uint8Array(ab);
    if (ab && ab.byteLength !== undefined) return new Uint8Array(ab);
    if (typeof ab === 'string') return B.binaryStringToBytes(ab);
  } catch (e) {
    // 老基础库不支持无 encoding 读取，降级为 binary 字符串
    const bin = fs.readFileSync(filePath, 'binary');
    return B.binaryStringToBytes(bin);
  }
  return new Uint8Array(0);
}

/**
 * 读取并解析一个本地文件
 * @param {String} filePath  wx.chooseMessageFile 返回的临时路径
 * @param {String} fileName  原始文件名（用于判断类型）
 * @param {Object} ctx
 */
function importFromPath(filePath, fileName, ctx) {
  let bytes;
  try {
    bytes = readFileBytes(filePath);
  } catch (e) {
    return fail('读取文件失败：' + (e.message || e.errMsg || '未知错误'));
  }
  return parseBytes(bytes, fileName, ctx);
}

module.exports = {
  MAX_BYTES,
  detectFileType,
  parseCsv,
  parseBytes,
  importFromPath,
  readFileBytes,
};

  };

  /* ---- utils/importer ---- */
  __modules["utils/importer"] = function (module, exports, require) {
/**
 * 课表文本解析（批量导入）
 * ---------------------------------------------------------------
 * 抽成独立模块便于单元测试，页面只负责 UI。
 *
 * 支持的写法：
 *  A) 逗号分隔：课程名,星期,起始节,结束节,教室,周次
 *     例：高等数学(上),周一,1,2,A301,1-16
 *  B) 空格/Tab 分隔：课程名 星期 节次范围 教室 [周次]
 *     例：程序设计基础 周三 5-6 A301 1-16周
 * 以 # 开头的行视为注释。
 */
const S = require("utils/schedule");

function parseLine(line) {
  let parts = String(line).split(/[,，\t]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  if (parts.length < 4) {
    parts = String(line).split(/\s+/).filter(Boolean);
  }
  if (parts.length < 4) return { error: '字段不足（至少需要 课程名/星期/节次/教室）' };

  let name, dayText, start, end, roomId, weekText;
  if (parts.length >= 6) {
    name = parts[0]; dayText = parts[1];
    start = parts[2]; end = parts[3];
    roomId = parts[4]; weekText = parts[5];
  } else if (parts.length === 5) {
    name = parts[0]; dayText = parts[1];
    const range = parsePeriodRange(parts[2]);
    if (!range) return { error: '节次无法识别：' + parts[2] };
    start = range[0]; end = range[1];
    roomId = parts[3]; weekText = parts[4];
  } else {
    name = parts[0]; dayText = parts[1];
    const range = parsePeriodRange(parts[2]);
    if (!range) return { error: '节次无法识别：' + parts[2] };
    start = range[0]; end = range[1];
    roomId = parts[3]; weekText = '1-16';
  }

  const day = parseDay(dayText);
  if (!day) return { error: '星期无法识别：' + dayText };

  const s = parseInt(start, 10);
  const e = parseInt(end, 10) || s;
  if (!s || s < 1) return { error: '起始节次无效：' + start };

  return {
    course: {
      name: String(name).trim(),
      day: day,
      start: s,
      end: Math.max(s, e),
      roomId: String(roomId || '').trim().toUpperCase(),
      weeks: S.normalizeWeeks(weekText || '1-16'),
      teacher: '',
      note: '',
    },
  };
}

function parsePeriodRange(text) {
  const t = String(text).replace(/[第节]/g, '').trim();
  const m = t.match(/^(\d+)\s*[-~到至]\s*(\d+)$/);
  if (m) return [Number(m[1]), Number(m[2])];
  const single = t.match(/^(\d+)$/);
  if (single) return [Number(single[1]), Number(single[1])];
  return null;
}

function parseDay(text) {
  const t = String(text).trim();
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
  const m = t.match(/([一二三四五六日天])/);
  if (m) return map[m[1]];
  const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
  if (n >= 1 && n <= 6) return n;
  if (n === 7 || n === 0) return 7;
  return null;
}

/**
 * 解析整段文本
 * @returns { courses, errors: [{line, text, error}], unknownRooms }
 */
function parseText(text, classrooms) {
  const lines = String(text || '').split(/\r?\n/);
  const courses = [];
  const errors = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw[0] === '#') continue;
    const r = parseLine(raw);
    if (r.error) errors.push({ line: i + 1, text: raw, error: r.error });
    else courses.push(r.course);
  }

  const unknownRooms = [];
  if (classrooms && classrooms.length) {
    const known = {};
    for (let i = 0; i < classrooms.length; i++) known[classrooms[i].id] = true;
    for (let i = 0; i < courses.length; i++) {
      if (courses[i].roomId && !known[courses[i].roomId] && unknownRooms.indexOf(courses[i].roomId) < 0) {
        unknownRooms.push(courses[i].roomId);
      }
    }
  }

  return { courses: courses, errors: errors, unknownRooms: unknownRooms };
}

module.exports = { parseLine, parseText, parseDay, parsePeriodRange };

  };

  /* ---- utils/inflate ---- */
  __modules["utils/inflate"] = function (module, exports, require) {
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

  };

  /* ---- utils/notify ---- */
  __modules["utils/notify"] = function (module, exports, require) {
/**
 * 课前提醒引擎
 * ---------------------------------------------------------------
 * 小程序无法在后台常驻定时器，所以"防迟到"采用三道保险：
 *   1) 打开小程序时：自动检查 + 醒目弹层 + 震动（本文件）
 *   2) 手机系统日历：把整学期课程写进日历，系统级闹钟提醒（calendar.js）
 *   3) 微信订阅消息：由后端定时推送服务通知（server/）
 *
 * 本文件负责第 1 道保险，并做提醒去重，避免反复打扰。
 */
const T = require("utils/time");
const S = require("utils/schedule");
const storage = require("utils/storage");

let audioCtx = null;

/** 播放提示音（音频文件缺失时静默降级） */
function playAlertSound() {
  try {
    if (!audioCtx) {
      audioCtx = wx.createInnerAudioContext();
      audioCtx.src = '/assets/alert.wav';
      audioCtx.volume = 1;
    }
    audioCtx.stop();
    audioCtx.play();
  } catch (e) {
    /* 忽略：部分环境不支持 */
  }
}

function vibrate(long) {
  try {
    if (long) wx.vibrateLong();
    else wx.vibrateShort({ type: 'medium' });
  } catch (e) {
    /* ignore */
  }
}

/** 提醒去重键：同一节课同一天只提醒一次 */
function remindKey(next) {
  return next.course.id + '_' + T.formatDate(next.date) + '_' + next.course.start;
}

function hasReminded(key) {
  const map = storage.get(storage.KEYS.REMINDED, {}) || {};
  return !!map[key];
}

function markReminded(key) {
  const map = storage.get(storage.KEYS.REMINDED, {}) || {};
  map[key] = Date.now();
  // 顺手清理 3 天前的旧记录，避免存储膨胀
  const edge = Date.now() - 3 * 86400000;
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    if (map[keys[i]] < edge) delete map[keys[i]];
  }
  storage.set(storage.KEYS.REMINDED, map);
}

function clearReminded() {
  storage.set(storage.KEYS.REMINDED, {});
}

/**
 * 计算当前该展示的上下课状态
 * @returns { current, next, shouldAlert, alertKey, title, desc }
 */
function evaluate(courses, classrooms, periods, settings, now) {
  const n = now || new Date();
  const current = S.getCurrentClass(courses, classrooms, periods, n, settings);
  const next = S.getNextClass(courses, classrooms, periods, n, settings);

  let shouldAlert = false;
  let alertKey = '';
  let title = '';
  let desc = '';

  let stage = '';
  if (next && next.isToday && settings.popup) {
    const left = next.minutesLeftExact;
    const edge = settings.autoPopupMinutes || 30;
    const finalEdge = settings.finalAheadMinutes || 5;
    // 两级提醒：先是"准备出门"，临近时再来一次"快迟到了"
    if (left > 0 && left <= finalEdge) stage = 'final';
    else if (left > 0 && left <= edge) stage = 'main';
    if (stage) {
      alertKey = remindKey(next) + '_' + stage;
      if (!hasReminded(alertKey)) {
        shouldAlert = true;
      }
    }
  }

  if (next) {
    if (next.minutesLeft <= 1) {
      title = '马上上课了！';
    } else if (next.isToday) {
      title = '距 ' + next.course.name + ' 还有 ' + T.humanDuration(next.minutesLeft);
    } else {
      title = '下一节课：' + next.dateLabel + ' ' + next.startTime;
    }
    // 教室变更提醒：上一节课的教室与本节课相同则无需移动
    const sameRoom = current && current.course && current.course.roomId === next.course.roomId;
    if (current) {
      desc = '正在上《' + current.course.name + '》，' + current.endTime + ' 下课';
      if (!sameRoom) {
        desc += '，下节课需换到 ' + next.room;
      }
    } else {
      desc = next.periodText + ' ' + next.startTime + '-' + next.endTime + ' · ' + next.room;
    }
  } else {
    title = '近期没有课程安排';
    desc = '可以放心去自习，或检查一下课表设置';
  }

  return {
    current: current,
    next: next,
    shouldAlert: shouldAlert,
    alertKey: alertKey,
    stage: stage,
    title: title,
    desc: desc,
  };
}

/**
 * 触发提醒（震动 + 提示音），返回给页面展示的文案
 * 注意：弹层由页面自己渲染，这样样式可控
 */
function fireAlert(next, settings, stage) {
  if (settings.vibrate !== false) vibrate(true);
  if (settings.sound) playAlertSound();

  const left = Math.max(0, next.minutesLeft);
  const urgent = stage === 'final' || left <= (settings.finalAheadMinutes || 5);
  const lines = [];
  lines.push('《' + next.course.name + '》' + (left <= 0 ? '马上开始' : T.humanDuration(left) + '后开始'));
  lines.push(next.periodText + '  ' + next.startTime + '-' + next.endTime);
  lines.push('地点：' + next.room);
  if (next.course.teacher) lines.push('教师：' + next.course.teacher);
  if (next.course.note) lines.push('备注：' + next.course.note);
  if (urgent) lines.push('马上要上课了，请立即出发，不要迟到！');
  return {
    urgent: urgent,
    title: urgent ? '快迟到了！' : '上课提醒',
    content: lines.join('\n'),
    room: next.room,
    startTime: next.startTime,
    courseName: next.course.name,
  };
}

/**
 * 页面调用入口：检查并（按需）触发提醒
 * @param {Boolean} opts.silent 只判断不触发
 */
function checkAndRemind(courses, classrooms, periods, settings, opts) {
  const o = opts || {};
  const now = o.now || new Date();
  const state = evaluate(courses, classrooms, periods, settings, now);
  let alert = null;
  if (state.shouldAlert && !o.silent) {
    alert = fireAlert(state.next, settings, state.stage);
    if (!o.dryRun) markReminded(state.alertKey);
  }
  return { state: state, alert: alert };
}

/** 今日课程总览文案（用于每日首课前的"今天有什么课"提示） */
function todaySummary(courses, classrooms, periods, settings, date) {
  const d = date || new Date();
  const timeline = S.buildTimeline(courses, classrooms, periods, d, settings);
  if (!timeline.courses.length) {
    return { empty: true, title: '今天没有课', content: '可以安排自习或休息' };
  }
  const lines = [];
  for (let i = 0; i < timeline.courses.length; i++) {
    const c = timeline.courses[i];
    lines.push(c.startTime + ' ' + c.name + ' @ ' + c.room);
  }
  return {
    empty: false,
    title: '今天共 ' + timeline.courses.length + ' 节课',
    content: lines.join('\n'),
    first: timeline.courses[0],
    timeline: timeline,
  };
}

module.exports = {
  evaluate,
  fireAlert,
  checkAndRemind,
  todaySummary,
  vibrate,
  playAlertSound,
  remindKey,
  hasReminded,
  markReminded,
  clearReminded,
};

  };

  /* ---- utils/schedule ---- */
  __modules["utils/schedule"] = function (module, exports, require) {
/**
 * 课表核心逻辑
 * ---------------------------------------------------------------
 * 只做纯计算，不碰 UI、不碰存储，方便单独测试与复用。
 */
const T = require("utils/time");
const CFG = require("config/index");

const DEFAULT_TOTAL_WEEKS = 24;

const STATUS_TEXT = {
  done: '已结束',
  ongoing: '进行中',
  soon: '即将开始',
  upcoming: '待上课',
};

/** 补齐 / 规范化一门课，容忍导入数据缺字段 */
function normalizeCourse(raw, index) {
  const c = Object.assign({}, raw);
  c.id = c.id || 'c_' + Date.now() + '_' + (index || 0);
  c.name = (c.name || '未命名课程').trim();
  c.teacher = c.teacher || '';
  c.roomId = c.roomId || '';
  c.day = Number(c.day) || 1;
  c.start = Number(c.start) || 1;
  c.end = Number(c.end) || c.start;
  if (c.end < c.start) c.end = c.start;
  c.note = c.note || '';
  if (!c.color) c.color = CFG.COLORS[index % CFG.COLORS.length];
  // 周次：兼容 { start, end, parity } / 数组 / "1-16周" 字符串
  c.weeks = normalizeWeeks(c.weeks, c.weeksList);
  delete c.weeksList;
  return c;
}

/** 统一周次表示 */
function normalizeWeeks(weeks, weeksList) {
  if (Array.isArray(weeks)) {
    return { start: Math.min.apply(null, weeks.concat([1])), end: Math.max.apply(null, weeks.concat([1])), parity: 'custom', list: weeks.slice() };
  }
  if (typeof weeks === 'string') {
    const m = weeks.match(/(\d+)\s*[-~]\s*(\d+)/);
    const parity = /单/.test(weeks) ? 'odd' : (/双/.test(weeks) ? 'even' : 'all');
    if (m) return { start: Number(m[1]), end: Number(m[2]), parity: parity };
  }
  if (Array.isArray(weeksList) && weeksList.length) {
    return { start: Math.min.apply(null, weeksList), end: Math.max.apply(null, weeksList), parity: 'custom', list: weeksList.slice() };
  }
  if (weeks && typeof weeks === 'object') {
    return {
      start: Number(weeks.start) || 1,
      end: Number(weeks.end) || DEFAULT_TOTAL_WEEKS,
      parity: weeks.parity || 'all',
      list: Array.isArray(weeks.list) ? weeks.list.slice() : undefined,
    };
  }
  return { start: 1, end: DEFAULT_TOTAL_WEEKS, parity: 'all' };
}

/** 展开为具体周次数组 [1,2,3...] */
function weekListOf(weeks, totalWeeks) {
  const w = normalizeWeeks(weeks);
  const max = Math.max(totalWeeks || DEFAULT_TOTAL_WEEKS, w.end);
  if (w.parity === 'custom' && Array.isArray(w.list)) {
    return w.list.filter(function (n) { return n >= 1; }).sort(function (a, b) { return a - b; });
  }
  const out = [];
  for (let i = w.start; i <= w.end; i++) {
    if (w.parity === 'odd' && i % 2 === 0) continue;
    if (w.parity === 'even' && i % 2 !== 0) continue;
    out.push(i);
  }
  return out;
}

function isWeekActive(course, week, totalWeeks) {
  if (!week || week < 1) return false;
  return weekListOf(course.weeks, totalWeeks).indexOf(week) >= 0;
}

/** 周次中文描述，如 "1-16周" / "3-12周(单)" */
function formatWeeks(weeks) {
  const w = normalizeWeeks(weeks);
  if (w.parity === 'custom' && Array.isArray(w.list)) {
    return w.list.join(',') + '周';
  }
  let s = w.start + '-' + w.end + '周';
  if (w.parity === 'odd') s += '(单)';
  if (w.parity === 'even') s += '(双)';
  return s;
}

/** 节次时间信息 */
function periodInfo(periods, period) {
  for (let i = 0; i < periods.length; i++) {
    if (periods[i].period === period) return periods[i];
  }
  return null;
}

/** 起止节次 -> 起止时刻 */
function periodRange(periods, start, end) {
  const a = periodInfo(periods, start);
  const b = periodInfo(periods, end) || a;
  return {
    start: a ? a.start : '08:00',
    end: b ? b.end : (a ? a.end : '08:45'),
  };
}

/** 节次中文描述："第1-2节" */
function formatPeriods(start, end) {
  return start === end ? '第' + start + '节' : '第' + start + '-' + end + '节';
}

/** 某天某周的课程，按开始节次排序 */
function coursesOn(courses, day, week, totalWeeks) {
  const out = [];
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    if (Number(c.day) !== Number(day)) continue;
    if (!isWeekActive(c, week, totalWeeks)) continue;
    out.push(c);
  }
  return out.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
}

/** 某天的课程（自动算周次） */
function coursesOnDate(courses, date, termStartDate, totalWeeks) {
  const week = T.getWeekIndex(date, termStartDate);
  const day = T.getDayOfWeek(date);
  return { week: week, day: day, courses: coursesOn(courses, day, week, totalWeeks) };
}

/** 一门课在本学期实际发生的所有日期：[{ date, week }] */
function expandCourseDates(course, termStartDate, totalWeeks) {
  const weeks = weekListOf(course.weeks, totalWeeks);
  const out = [];
  for (let i = 0; i < weeks.length; i++) {
    const days = T.weekDates(weeks[i], termStartDate);
    const d = days[Number(course.day) - 1];
    if (d) out.push({ date: d, week: weeks[i] });
  }
  return out;
}

function roomOf(roomId, classrooms) {
  for (let i = 0; i < classrooms.length; i++) {
    if (classrooms[i].id === roomId) return classrooms[i];
  }
  return null;
}

function roomLabel(course, classrooms) {
  const r = roomOf(course.roomId, classrooms);
  return r ? (r.building ? r.building + ' ' + r.name : r.name) : (course.roomId || '教室待定');
}

/**
 * 今日时间轴：每节课 + 状态 + 今日空闲节次
 * status: done 已结束 | ongoing 进行中 | soon 即将开始 | upcoming 待上课
 */
function buildTimeline(courses, classrooms, periods, date, settings) {
  const totalWeeks = settings.totalWeeks;
  const r = coursesOnDate(courses, date, settings.termStartDate, totalWeeks);
  const now = new Date();
  const isToday = T.formatDate(date) === T.formatDate(now);
  const nowMin = T.dateToMinutes(now);
  const soonEdge = settings.aheadMinutes || 20;
  const list = [];
  const occupied = {};

  for (let i = 0; i < r.courses.length; i++) {
    const c = r.courses[i];
    const t = periodRange(periods, c.start, c.end);
    const sMin = T.toMinutes(t.start);
    const eMin = T.toMinutes(t.end);
    let status = 'upcoming';
    if (isToday) {
      if (nowMin > eMin) status = 'done';
      else if (nowMin >= sMin) status = 'ongoing';
      else if (sMin - nowMin <= soonEdge) status = 'soon';
    } else if (T.formatDate(date) < T.formatDate(now)) {
      status = 'done';
    }
    for (let p = c.start; p <= c.end; p++) occupied[p] = true;
    list.push({
      id: c.id,
      name: c.name,
      teacher: c.teacher,
      note: c.note,
      color: c.color,
      roomId: c.roomId,
      room: roomLabel(c, classrooms),
      start: c.start,
      end: c.end,
      periodText: formatPeriods(c.start, c.end),
      startTime: t.start,
      endTime: t.end,
      status: status,
      statusText: STATUS_TEXT[status] || '',
      weekText: formatWeeks(c.weeks),
      minutesToStart: Math.round(sMin - nowMin),
      minutesToEnd: Math.round(eMin - nowMin),
    });
  }

  // 今日空闲节次区间
  const freeSlots = [];
  let runStart = null;
  for (let p = 1; p <= periods.length; p++) {
    if (!occupied[p]) {
      if (runStart === null) runStart = p;
    } else if (runStart !== null) {
      freeSlots.push(slotOf(periods, runStart, p - 1));
      runStart = null;
    }
  }
  if (runStart !== null) freeSlots.push(slotOf(periods, runStart, periods.length));

  return { week: r.week, day: r.day, courses: list, freeSlots: freeSlots };
}

function slotOf(periods, start, end) {
  const t = periodRange(periods, start, end);
  return {
    start: start,
    end: end,
    periodText: formatPeriods(start, end),
    startTime: t.start,
    endTime: t.end,
  };
}

/** 正在上的课（没有则 null） */
function getCurrentClass(courses, classrooms, periods, now, settings) {
  const r = coursesOnDate(courses, now, settings.termStartDate, settings.totalWeeks);
  const nowMin = T.dateToMinutes(now);
  for (let i = 0; i < r.courses.length; i++) {
    const c = r.courses[i];
    const t = periodRange(periods, c.start, c.end);
    const sMin = T.toMinutes(t.start);
    const eMin = T.toMinutes(t.end);
    if (nowMin >= sMin && nowMin <= eMin) {
      return {
        course: c,
        date: now,
        startAt: T.atTime(now, t.start),
        endAt: T.atTime(now, t.end),
        startTime: t.start,
        endTime: t.end,
        room: roomLabel(c, classrooms),
        minutesLeft: Math.round(eMin - nowMin),
        minutesToEnd: Math.round(eMin - nowMin),
      };
    }
  }
  return null;
}

/**
 * 下一节课：从今天起向后查找（最多 21 天），返回尚未开始的最近一节课
 */
function getNextClass(courses, classrooms, periods, now, settings) {
  const totalWeeks = settings.totalWeeks;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = 0; offset <= 21; offset++) {
    const date = T.addDays(today, offset);
    const r = coursesOnDate(courses, date, settings.termStartDate, totalWeeks);
    if (!r.courses.length) continue;
    for (let i = 0; i < r.courses.length; i++) {
      const c = r.courses[i];
      const t = periodRange(periods, c.start, c.end);
      const startAt = T.atTime(date, t.start);
      if (startAt.getTime() <= now.getTime()) continue;
      const endAt = T.atTime(date, t.end);
      const minutesLeft = (startAt.getTime() - now.getTime()) / 60000;
      return {
        course: c,
        date: date,
        isToday: offset === 0,
        dayOffset: offset,
        week: r.week,
        startAt: startAt,
        endAt: endAt,
        startTime: t.start,
        endTime: t.end,
        minuteStart: T.toMinutes(t.start),
        minuteEnd: T.toMinutes(t.end),
        room: roomLabel(c, classrooms),
        roomId: c.roomId,
        periodText: formatPeriods(c.start, c.end),
        minutesLeft: Math.round(minutesLeft),
        minutesLeftExact: minutesLeft,
        dateLabel: offset === 0 ? '今天' : (offset === 1 ? '明天' : T.humanDate(date)),
        weekText: formatWeeks(c.weeks),
      };
    }
  }
  return null;
}

/** 冲突检测：同一天 + 节次重叠 + 周次有交集 */
function detectConflicts(courses) {
  const conflicts = [];
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i];
      const b = courses[j];
      if (Number(a.day) !== Number(b.day)) continue;
      if (a.start > b.end || b.start > a.end) continue;
      const wa = weekListOf(a.weeks);
      const wb = weekListOf(b.weeks);
      const share = wa.filter(function (w) { return wb.indexOf(w) >= 0; });
      if (share.length) {
        conflicts.push({
          a: a, b: b,
          weeks: share,
          message: a.name + ' 与 ' + b.name + ' 在' + T.WEEK_NAMES[a.day] + ' ' +
            formatPeriods(Math.max(a.start, b.start), Math.min(a.end, b.end)) + ' 冲突（' +
            formatWeeks(a.weeks) + '）',
        });
      }
    }
  }
  return conflicts;
}

/** 把任意来源的课程数组批量规范化 */
function normalizeAll(list) {
  const out = [];
  for (let i = 0; i < (list || []).length; i++) out.push(normalizeCourse(list[i], i));
  return out;
}

module.exports = {
  normalizeCourse,
  normalizeAll,
  normalizeWeeks,
  weekListOf,
  isWeekActive,
  formatWeeks,
  periodInfo,
  periodRange,
  formatPeriods,
  coursesOn,
  coursesOnDate,
  expandCourseDates,
  roomOf,
  roomLabel,
  buildTimeline,
  getCurrentClass,
  getNextClass,
  detectConflicts,
};

  };

  /* ---- utils/schedule-extract ---- */
  __modules["utils/schedule-extract"] = function (module, exports, require) {
/**
 * 课表结构识别引擎
 * ---------------------------------------------------------------
 * 输入：Excel 表格的二维数组 / Word 表格的二维数组 / 纯文本
 * 输出：标准课程对象数组
 *
 * 支持两大类课表布局：
 *  A) 列表式（每行一门课，有表头：课程名称 / 星期 / 节次 / 教室 / 周次）
 *  B) 网格式（第一行是星期一~星期日，第一列是节次，格子内写课程名、教师、教室、周次）
 *
 * 识别不出来的字段会退化为默认值，并在 _warnings 里说明，由页面提示用户确认。
 */
const T = require("utils/time");
const S = require("utils/schedule");

/* ==================== 基础文本工具 ==================== */

/** 全角转半角 + 去不可见字符 */
function norm(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/[\uFF01-\uFF5E]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    })
    .replace(/\u3000/g, ' ')
    .replace(/[\u200b-\u200f\ufeff]/g, '');
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isBlank(s) {
  return !s || !String(s).replace(/\s/g, '');
}

/* ==================== 星期 ==================== */

const DAY_CHAR = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };
const DAY_EN = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };

/**
 * 严格解析星期标签（只在整个单元格就是星期表示时才成功）
 * 用于表头行 / 行列标签，避免把普通文本误判成星期
 */
function parseDayStrict(text) {
  const t = norm(text).replace(/\s/g, '');
  if (!t || t.length > 8) return 0;

  let m = t.match(/^(?:星期|周|礼拜)([一二三四五六日天1-7])$/);
  if (m) return DAY_CHAR[m[1]] || Number(m[1]) || 0;

  if (/^[一二三四五六日天]$/.test(t)) return DAY_CHAR[t];
  if (/^[1-7]$/.test(t)) return Number(t);

  m = t.toLowerCase().match(/^(mon|tue|wed|thu|fri|sat|sun)/);
  if (m) return DAY_EN[m[1]];

  return 0;
}

/* ==================== 节次 ==================== */

const CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };

function cnToNum(s) {
  if (/^\d+$/.test(s)) return Number(s);
  if (s.length === 1 && CN_NUM[s]) return CN_NUM[s];
  if (s === '十') return 10;
  if (s === '十一') return 11;
  if (s === '十二') return 12;
  let m = s.match(/^十([一二三四五六七八九])$/);
  if (m) return 10 + CN_NUM[m[1]];
  m = s.match(/^([一二三四五六七八九])十$/);
  if (m) return CN_NUM[m[1]] * 10;
  return 0;
}

/**
 * 把"连写"的数字串拆成单个数字。
 * 教务系统常把一格跨两节写成竖排的「第 / 一 / 二 / 节」，
 * 去掉"第""节"后剩下 "一二"，需要还原成 [1,2]。
 */
function splitConsecutiveNumbers(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/[0-9]/.test(ch)) out.push(Number(ch));
    else if (CN_NUM[ch]) out.push(CN_NUM[ch]);
    else if (ch === '十') out.push(10);
    else return null;
  }
  return out.length ? out : null;
}

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const p = String(hhmm).split(':');
  return Number(p[0]) * 60 + Number(p[1] || 0);
}

/** 把 "08:00" 映射到节次编号 */
function periodByTime(timeStr, periods) {
  if (!periods || !periods.length) return 0;
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const min = Number(m[1]) * 60 + Number(m[2]);

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (min >= toMinutes(p.start) - 5 && min <= toMinutes(p.end) + 5) return p.period;
  }
  // 找不到就用最接近的节次开始时间
  let best = 0;
  let bestDiff = 1e9;
  for (let i = 0; i < periods.length; i++) {
    const d = Math.abs(toMinutes(periods[i].start) - min);
    if (d < bestDiff) { bestDiff = d; best = periods[i].period; }
  }
  return bestDiff <= 30 ? best : 0;
}

/**
 * 解析节次标签，如 "第1节" / "1-2节" / "1、2" / "08:00-09:40"
 * @returns {{start:Number,end:Number}|null}
 */
function parsePeriodLabel(text, periods) {
  const t = norm(text).replace(/\s+/g, '');
  if (!t || t.length > 24) return null;

  // 1) 时间格式
  const times = t.match(/\d{1,2}:\d{2}/g);
  if (times && periods && periods.length) {
    const a = periodByTime(times[0], periods);
    const b = times.length > 1 ? periodByTime(times[1], periods) : a;
    if (a) return { start: Math.min(a, b || a), end: Math.max(a, b || a) };
  }

  // 2) 节次编号
  let s = t.replace(/第/g, '').replace(/节|课时|堂课|课次/g, '');
  s = s.replace(/[（(].*?[)）]/g, '');
  if (!s || s.length > 10) return null;

  let m = s.match(/^([一二三四五六七八九十\d]+)\s*[-–—~～至到,，、]\s*([一二三四五六七八九十\d]+)$/);
  if (m) {
    const a = cnToNum(m[1]);
    const b = cnToNum(m[2]);
    if (a >= 1 && b >= 1 && a <= 20 && b <= 20) {
      return { start: Math.min(a, b), end: Math.max(a, b) };
    }
    return null;
  }

  m = s.match(/^([一二三四五六七八九十\d]+)$/);
  if (m) {
    const a = cnToNum(m[1]);
    if (a >= 1 && a <= 20) return { start: a, end: a };

    // 连写形式："第一二节" -> 1-2，"第九十节" -> 9-10
    const nums = splitConsecutiveNumbers(m[1]);
    if (nums && nums.length >= 2) {
      const first = nums[0];
      const last = nums[nums.length - 1];
      if (first >= 1 && last <= 20 && first <= last) {
        return { start: first, end: last };
      }
    }
  }
  return null;
}

/* ==================== 周次 ==================== */

// 允许"单/双"出现在数字与"周"之间：1-16周 / 1-16单周 / 2-16双周
const WEEK_RANGE_RE = /(\d{1,2})\s*[-–—~～至到]\s*(\d{1,2})\s*(?:单|双)?\s*周/g;
const WEEK_LIST_RE = /((?:\d{1,2}\s*[,，、]\s*)+\d{1,2})\s*(?:单|双)?\s*周/g;
const WEEK_SINGLE_RE = /(\d{1,2})\s*(?:单|双)?\s*周/g;

/** 周次后面紧跟的 (单)/(双)/(单周) 后缀，切分时要跟本段绑在一起 */
const WEEK_SUFFIX_RE = /^\s*[（(]\s*[单双]\s*周?\s*[)）]/;

function parityOf(text) {
  if (/单/.test(text)) return 'odd';
  if (/双/.test(text)) return 'even';
  return 'all';
}

/** 在文本中查找所有周次写法，带位置信息 */
function findAllWeeks(text) {
  const t = norm(text);
  const out = [];

  let m;
  const rangeRe = new RegExp(WEEK_RANGE_RE.source, 'g');
  while ((m = rangeRe.exec(t)) !== null) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a >= 1 && b >= 1 && a <= 30 && b <= 30) {
      out.push({ start: Math.min(a, b), end: Math.max(a, b), parity: parityOf(t), matched: m[0], index: m.index });
    }
  }

  const listRe = new RegExp(WEEK_LIST_RE.source, 'g');
  while ((m = listRe.exec(t)) !== null) {
    const list = m[1].split(/[,，、]/).map(function (x) { return parseInt(x, 10); })
      .filter(function (n) { return n >= 1 && n <= 30; });
    if (list.length >= 2) {
      out.push({
        start: Math.min.apply(null, list),
        end: Math.max.apply(null, list),
        parity: 'custom',
        list: list,
        matched: m[0],
        index: m.index,
      });
    }
  }

  // 单个周次：跳过已经被区间匹配覆盖的位置
  const singleRe = new RegExp(WEEK_SINGLE_RE.source, 'g');
  while ((m = singleRe.exec(t)) !== null) {
    const n = Number(m[1]);
    if (n < 1 || n > 30) continue;
    const overlap = out.some(function (w) {
      return m.index >= w.index && m.index < w.index + w.matched.length;
    });
    if (!overlap) {
      out.push({ start: n, end: n, parity: parityOf(t), matched: m[0], index: m.index });
    }
  }

  out.sort(function (a, b) { return a.index - b.index; });
  return out;
}

/** 解析周次（取第一个匹配） */
function parseWeeks(text, allowBare) {
  const all = findAllWeeks(text);
  if (all.length) return all[0];
  if (!allowBare) return null;

  const t = norm(text);
  const m = t.match(/(\d{1,2})\s*[-–—~～至到]\s*(\d{1,2})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a >= 1 && b <= 30 && a <= b) {
      return { start: a, end: b, parity: parityOf(t), matched: m[0], index: m.index };
    }
  }
  const single = t.match(/^(\d{1,2})$/);
  if (single) {
    const n = Number(single[1]);
    if (n >= 1 && n <= 30) return { start: n, end: n, parity: 'all', matched: t, index: 0 };
  }
  return null;
}

/* ==================== 教室 ==================== */

/**
 * 在文本中找教室。
 * 优先匹配教室字典里的编号（最可靠），其次用常见编号模式兜底。
 * @returns {{roomId:String, matched:String, known:Boolean}|null}
 */
function extractRoomHit(text, classrooms) {
  const raw = norm(text);
  if (!raw) return null;

  // 1) 教室字典匹配（按编号长度降序，避免 "A30" 抢先匹配 "A301"）
  if (classrooms && classrooms.length) {
    const sorted = classrooms.slice().sort(function (a, b) {
      return (b.id || '').length - (a.id || '').length;
    });
    const upper = raw.toUpperCase();
    for (let i = 0; i < sorted.length; i++) {
      const id = sorted[i].id;
      if (!id) continue;
      if (upper.indexOf(id.toUpperCase()) >= 0) {
        return { roomId: id, matched: id, known: true };
      }
    }
    // 再按显示名匹配（如 "图书馆201自习室"）
    for (let i = 0; i < sorted.length; i++) {
      const name = sorted[i].name;
      if (name && name.length >= 3 && raw.indexOf(name) >= 0) {
        return { roomId: sorted[i].id, matched: name, known: true };
      }
    }
  }

  // 2) 关键词后取值："地点：A301"
  let m = raw.match(/(?:上课地点|教学地点|授课地点|上课教室|教室|课室|地点|地址)\s*[:：]?\s*([^\s,，;；、|]{2,24})/);
  if (m) {
    const v = m[1].trim();
    if (v) return { roomId: v.toUpperCase(), matched: m[0], known: false };
  }

  // 3) 常见编号模式
  const patterns = [
    /(?:^|[\s（(【,，|])([东南西北]?[A-Za-z]{1,3}[-—]?\d{2,4})(?=$|[\s）)】,，;；|])/,
    /(第?[一二三四五六七八九十\d]{1,3}教(?:学楼)?[\s-]*[A-Za-z]?\d{2,4})/,
    /([\u4e00-\u9fa5]{2,8}(?:楼|馆|中心|校区)[A-Za-z]?[-—]?\d{1,4})/,
    // 楼名被简写掉的写法："综合602"、"科技117"、"经管308"
    /([\u4e00-\u9fa5]{2,4}\d{3,4})/,
    /(\d{1,2}[-—]\d{3,4})(?=$|[\s,，;；])/,
    /([A-Za-z]?\d{3,4}室)/,
  ];
  for (let i = 0; i < patterns.length; i++) {
    const hit = raw.match(patterns[i]);
    if (hit) return { roomId: hit[1].trim().toUpperCase(), matched: hit[1], known: false };
  }
  return null;
}

function extractRoom(text, classrooms) {
  const hit = extractRoomHit(text, classrooms);
  return hit ? hit.roomId : '';
}

/* ==================== 教师 ==================== */

/**
 * 判断是否像教师姓名。
 * 黑名单以"多字词"为主，避免把「周立」「李雯」这类姓名误杀；
 * 只保留人名中几乎不会出现的单字（节/楼/室/馆）。
 */
const NON_TEACHER = /实验|上机|理论|实践|必修|选修|公选|通识|考试|课程|教学|答疑|设计|概论|导论|原理|基础|数学|物理|英语|体育|化学|地理|历史|哲学|政治|经济|管理|法律|计算机|网络|编程|语言|结构|分析|算法|系统|方法|周次|周数|节次|教室|教学楼|机房|班级|学院|专业|方向|限选|任选|综合|职教|科技|工程|[节楼室馆房]/;

function isTeacherLike(text) {
  const t = norm(text).trim();
  if (!/^[\u4e00-\u9fa5]{2,4}$/.test(t)) return false;
  if (NON_TEACHER.test(t)) return false;
  return true;
}

/* ==================== 单元格内容解析 ==================== */

/**
 * 把一个单元格的文本解析成一门或多门课
 * @param {String} text  单元格原文（可能多行）
 * @param {Object} ctx   { classrooms, periods, totalWeeks }
 * @returns {Array<{name,teacher,roomId,weeks,warnings}>}
 */
function parseCellContent(text, ctx) {
  const raw = String(text === undefined || text === null ? '' : text).replace(/\r/g, '').trim();
  if (!raw) return [];

  // 一个格子里有两门课（常见于"单周上 A、双周上 B"或教务导出的拥挤格子）。
  // 判据：出现两个及以上周次写法时，按周次切分，每段一门课。
  const weekHits = findAllWeeks(raw);
  if (weekHits.length >= 2) {
    const segments = splitByWeeks(raw, weekHits);
    const out = [];
    for (let i = 0; i < segments.length; i++) {
      let seg = segments[i];
      let parsed = parseSingleCell(seg, ctx);
      // 该段没解析出课程名（例如周次写在了最前面），并入下一段重试
      while ((!parsed || !parsed.length) && i + 1 < segments.length) {
        i++;
        seg = seg + '\n' + segments[i];
        parsed = parseSingleCell(seg, ctx);
      }
      if (parsed && parsed.length) out.push.apply(out, parsed);
    }
    if (out.length) return out;
  }

  return parseSingleCell(raw, ctx);
}

/** 按周次出现的位置把文本切成多段，每段以周次结尾 */function splitByWeeks(raw, weekHits) {
  const parts = [];
  let start = 0;
  for (let i = 0; i < weekHits.length; i++) {
    const wh = weekHits[i];
    let end = wh.index + wh.matched.length;
    // "1-16周(单)" 里的 (单) 属于这一门课，要一起切进来，否则单双周信息会丢
    const suffix = raw.slice(end).match(WEEK_SUFFIX_RE);
    if (suffix) end += suffix[0].length;
    if (end <= start) continue;
    parts.push(raw.slice(start, end));
    start = end;
  }
  const tail = raw.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

/**
 * 把一个单元格拆成若干"信息片段"。
 * 分层降级：换行 → 菱形等强分隔符 → 竖线 → 空格/逗号。
 * 必须分层，因为教务系统常用 ◇ 分隔字段（"高等数学◇4-17(1,2节)◇A301"），
 * 而 "(1,2节)" 里的逗号一旦当成分隔符就会把节次拆坏。
 */
function splitCellSegments(raw) {
  const text = String(raw === undefined || raw === null ? '' : raw);
  let parts = text.split(/[\n\r]+/);
  if (parts.length <= 1) parts = text.split(/[◇◆○●■□▪▫·・]+/);
  if (parts.length <= 1) parts = text.split(/[|｜]+/);
  if (parts.length <= 1) parts = text.split(/[\s,，;；]+/);
  return parts.map(function (s) { return s.trim(); }).filter(Boolean);
}

/** 解析一格里的"一门课" */
function parseSingleCell(raw, ctx) {
  const lines = splitCellSegments(raw);

  const results = [];
  let cur = null;

  function ensure() {
    if (!cur) cur = { name: '', teacher: '', roomId: '', weeks: null, warnings: [] };
    return cur;
  }
  function flush() {
    if (cur && cur.name) results.push(cur);
    cur = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line)) continue;

    // 周次：先按带"周"字的标准写法，再退一步接受"4-17"这类省略"周"字的写法
    const weeks = parseWeeks(line) || parseWeeks(line, true);
    const roomHit = extractRoomHit(line, ctx.classrooms);

    if (weeks) {
      // 已经有一门带周次的课 -> 说明格子里是多门课
      if (cur && cur.weeks) flush();
      const c = ensure();
      c.weeks = { start: weeks.start, end: weeks.end, parity: weeks.parity };
      if (weeks.list) c.weeks.list = weeks.list;

      let remain = line.replace(weeks.matched, ' ');
      if (roomHit) {
        remain = remain.replace(new RegExp(escapeRegExp(roomHit.matched), 'i'), ' ');
        if (!c.roomId) c.roomId = roomHit.roomId;
      }
      remain = remain.replace(/[（(]\s*(?:单|双)?\s*周?\s*[)）]/g, ' ').trim();
      if (remain && !c.name) attachName(c, remain);
      else if (remain && isTeacherLike(remain) && !c.teacher) c.teacher = remain;
      continue;
    }

    // 纯教室行
    if (roomHit) {
      const remain = line.replace(new RegExp(escapeRegExp(roomHit.matched), 'i'), '').trim();
      if (!remain) {
        const c = ensure();
        if (!c.roomId) c.roomId = roomHit.roomId;
        continue;
      }
    }

    const c = ensure();

    // 课程名之后出现的"2-4 个纯汉字"视为教师
    if (c.name && !c.teacher && isTeacherLike(line)) {
      c.teacher = line;
      continue;
    }

    let rest = line;
    if (roomHit) {
      rest = rest.replace(new RegExp(escapeRegExp(roomHit.matched), 'i'), ' ').trim();
      if (!c.roomId) c.roomId = roomHit.roomId;
    }
    rest = rest.replace(/\s+/g, ' ').trim();
    if (!rest) continue;

    if (!c.name) {
      attachName(c, rest);
      continue;
    }
    // 该段里含教室信息时，剩下的文字属于教室描述
    //（"综合602安博实验室一" 去掉教室后剩 "安博实验室一"），
    // 不能再当成教师或课程名，否则会把课程名污染成 "计算机应用基础 谢春丽"
    if (roomHit) continue;
    if (!c.teacher && isTeacherLike(rest)) {
      c.teacher = rest;
      continue;
    }
    attachName(c, rest);
  }
  flush();

  // 收尾：处理只有名字没有任何其它信息的极端情况
  return results.map(function (c) {
    if (!c.roomId) c.warnings.push('未识别到教室');
    if (!c.weeks) c.warnings.push('未识别到周次');
    return c;
  });
}

function attachName(course, text) {
  const t = text.trim();
  if (!t) return;
  if (!course.name) course.name = t;
  else if (course.name.indexOf(t) < 0) course.name += ' ' + t;
}

/* ==================== 列表式课表 ==================== */

const FIELD_ALIASES = [
  { field: 'name', keys: ['课程名称', '课程名', '教学班名称', '课程', '科目', '名称'] },
  { field: 'weeks', keys: ['上课周次', '起止周', '周次', '周数', '上课周'] },
  { field: 'day', keys: ['上课星期', '星期几', '星期', '周几', '上课日'] },
  { field: 'period', keys: ['上课节次', '节次', '节数', '课节'] },
  { field: 'time', keys: ['上课时间', '时间段', '时间', '时段'] },
  { field: 'room', keys: ['上课地点', '上课教室', '教学地点', '授课地点', '教室', '地点', '课室'] },
  { field: 'teacher', keys: ['任课教师', '授课教师', '教师姓名', '教师', '老师'] },
  { field: 'className', keys: ['上课班级', '教学班', '班级', '行政班'] },
];

/** 表头里的修饰词，剥离后往往就是真正的字段名（"上课地点" -> "地点"） */
const HEADER_NOISE = /^(?:本|该|此)?(?:上课|教学|授课|任课|课程|科目)?(?:信息|情况|内容|安排|明细|一览|表)?$/;

/** 两个字符串的字符重合度，用于容忍异体字与多余字 */
function charOverlap(a, b) {
  if (!a || !b) return 0;
  const set = {};
  for (let i = 0; i < b.length; i++) set[b[i]] = 1;
  let hit = 0;
  for (let i = 0; i < a.length; i++) if (set[a[i]]) hit++;
  return hit / Math.max(a.length, 1);
}

/**
 * 把表头单元格文本映射成字段名。
 * 策略（依次尝试，取匹配到的最长别名，避免 "教室类型" 被 "教室" 抢走）：
 *   1) 完全相等
 *   2) 包含别名
 *   3) 剥离修饰词后再匹配
 *   4) 字符重合度兜底（容忍错别字）
 */
function matchField(text) {
  const raw = norm(text).replace(/\s/g, '');
  if (!raw || raw.length > 16) return '';

  let t = raw.replace(/[（(].*?[)）]/g, '');
  if (!t) t = raw;

  // 1) 完全相等
  for (let i = 0; i < FIELD_ALIASES.length; i++) {
    const keys = FIELD_ALIASES[i].keys;
    for (let k = 0; k < keys.length; k++) {
      if (t === keys[k]) return FIELD_ALIASES[i].field;
    }
  }

  // 2) 包含别名 —— 取最长的别名，最长的优先
  let bestField = '';
  let bestLen = 0;
  for (let i = 0; i < FIELD_ALIASES.length; i++) {
    const keys = FIELD_ALIASES[i].keys;
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k];
      if (key.length > bestLen && t.indexOf(key) >= 0) {
        bestLen = key.length;
        bestField = FIELD_ALIASES[i].field;
      }
    }
  }
  if (bestField) return bestField;

  // 3) 剥离修饰词
  const stripped = t.replace(/(?:上课|教学|授课|任课|课程|科目|日期|时间|地点|信息|情况|内容|安排|明细)/g, '');
  if (stripped && stripped !== t) {
    for (let i = 0; i < FIELD_ALIASES.length; i++) {
      const keys = FIELD_ALIASES[i].keys;
      for (let k = 0; k < keys.length; k++) {
        if (stripped === keys[k]) return FIELD_ALIASES[i].field;
      }
    }
  }

  // 4) 字符重合度兜底（只对 2-4 字的小词生效，避免误伤长句子）
  if (t.length >= 2 && t.length <= 4 && HEADER_NOISE.test(t) === false) {
    let field = '';
    let score = 0;
    for (let i = 0; i < FIELD_ALIASES.length; i++) {
      const keys = FIELD_ALIASES[i].keys;
      for (let k = 0; k < keys.length; k++) {
        const s = charOverlap(t, keys[k]);
        if (s >= 0.7 && s > score) {
          score = s;
          field = FIELD_ALIASES[i].field;
        }
      }
    }
    if (field) return field;
  }

  return '';
}

/** 判断文本是否"正好"是某个字段别名（用于识别重复表头） */
function isExactHeaderAlias(text) {
  const t = norm(text).replace(/\s/g, '').replace(/[（(].*?[)）]/g, '');
  if (!t || t.length > 16) return false;
  for (let i = 0; i < FIELD_ALIASES.length; i++) {
    const keys = FIELD_ALIASES[i].keys;
    for (let k = 0; k < keys.length; k++) {
      if (t === keys[k]) return true;
    }
  }
  return false;
}

/**
 * 判断这一行是不是"重复出现的表头行"。
 * 不能只看课程名单元格：像"课程设计""教师发展中心"这类正常内容也会包含字段关键词，
 * 那样会把真实课程整行丢掉。所以要求整行里多数单元格与别名**精确相等**。
 */
function looksLikeRepeatedHeader(row) {
  let exact = 0;
  let nonEmpty = 0;
  for (let c = 0; c < (row ? row.length : 0); c++) {
    const s = String(row[c] === undefined || row[c] === null ? '' : row[c]).trim();
    if (!s) continue;
    nonEmpty++;
    if (isExactHeaderAlias(s)) exact++;
  }
  return exact >= 3 && exact >= nonEmpty * 0.5;
}

/** 把一行单元格映射成 {field: col}，并记录命中数 */
function mapHeaderCells(row) {
  const columns = {};
  let hits = 0;
  const width = row ? row.length : 0;
  for (let c = 0; c < width; c++) {
    const f = matchField(row[c]);
    if (f && columns[f] === undefined) {
      columns[f] = c;
      hits++;
    }
  }
  return { columns: columns, hits: hits };
}

/**
 * 合并两行做"复合表头"。
 * 两行表头通常是「第一行大类 + 第二行细分」，所以 order 决定谁优先。
 */
function mergeHeaderRows(a, b, preferSecond) {
  const n = Math.max(a ? a.length : 0, b ? b.length : 0);
  const out = [];
  for (let c = 0; c < n; c++) {
    const va = a && a[c] !== undefined ? String(a[c]).trim() : '';
    const vb = b && b[c] !== undefined ? String(b[c]).trim() : '';
    if (!va) out.push(vb);
    else if (!vb) out.push(va);
    else out.push(preferSecond ? vb : va);
  }
  return out;
}

/** 给一个表头候选打分：有课程名 + 有时间类字段 + 命中数 */
function scoreHeaderCandidate(cand) {
  const cols = cand.columns;
  const hasName = cols.name !== undefined;
  const hasWhen = cols.day !== undefined || cols.period !== undefined || cols.time !== undefined;
  if (!hasName || !hasWhen) return 0;
  let score = cand.hits * 10;
  if (hasName) score += 40;
  if (cols.day !== undefined) score += 20;
  if (cols.period !== undefined || cols.time !== undefined) score += 20;
  if (cols.room !== undefined) score += 15;
  if (cols.weeks !== undefined) score += 15;
  if (cols.teacher !== undefined) score += 5;
  return score;
}

/**
 * 在表格里寻找最像表头的一行（找不到返回 null）
 * 支持单行表头与两行复合表头
 */
function findHeaderRow(rows, maxScan, minScore) {
  const limit = Math.min(rows.length, maxScan || 15);
  let best = null;

  for (let r = 0; r < limit; r++) {
    const variants = [];
    variants.push({ headRow: r, span: 1, cells: rows[r] });
    if (r + 1 < limit) {
      variants.push({ headRow: r, span: 2, cells: mergeHeaderRows(rows[r], rows[r + 1], true) });
      variants.push({ headRow: r, span: 2, cells: mergeHeaderRows(rows[r], rows[r + 1], false) });
    }

    for (let v = 0; v < variants.length; v++) {
      const cand = variants[v];
      const mapped = mapHeaderCells(cand.cells);
      const score = scoreHeaderCandidate(mapped);
      if (score <= 0) continue;
      // 越靠上的表头略微加权（前面通常是表格标题）
      const adjusted = score - cand.headRow * 2;
      if (adjusted < (minScore || 0)) continue;
      if (!best || adjusted > best.score) {
        best = {
          headerRow: cand.headRow,
          span: cand.span,
          startRow: cand.headRow + cand.span,
          columns: mapped.columns,
          hits: mapped.hits,
          score: adjusted,
        };
      }
    }
  }
  return best;
}

/**
 * 按给定的列映射提取数据行（列表式执行器）
 */
function extractRowsWithColumns(rows, startRow, columns, ctx) {
  const courses = [];
  const warnings = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || isBlank(row.join(''))) continue;

    const name = getCell(row, columns.name);
    if (!name || isBlank(name)) continue;
    // 跳过重复出现的表头行（分页导出时常见）
    if (looksLikeRepeatedHeader(row)) continue;

    const item = {
      name: name.replace(/\s+/g, ' ').trim(),
      teacher: columns.teacher !== undefined ? getCell(row, columns.teacher).trim() : '',
      roomId: '',
      weeks: null,
      day: 0,
      start: 0,
      end: 0,
      warnings: [],
      _source: '第 ' + (r + 1) + ' 行',
      _fromHeader: true,
    };

    // 星期
    if (columns.day !== undefined) {
      item.day = parseDayStrict(getCell(row, columns.day)) ||
        parseDayFromLoose(getCell(row, columns.day));
    } else if (columns.time !== undefined) {
      const d = parseDayFromLoose(getCell(row, columns.time));
      if (d) item.day = d;
    }

    // 节次（优先节次列，其次时间列）
    let period = null;
    if (columns.period !== undefined) {
      period = parsePeriodLabel(getCell(row, columns.period), ctx.periods);
    }
    if (!period && columns.time !== undefined) {
      const cell = getCell(row, columns.time);
      period = parsePeriodLabel(cell, ctx.periods);
      if (!period) {
        // "周三 1-2节" 之类的组合列
        const seg = cell.match(/[^\s]*\d+\s*[-–—~～至到]\s*\d+\s*节?/);
        if (seg) period = parsePeriodLabel(seg[0], ctx.periods);
      }
    }
    if (period) {
      item.start = period.start;
      item.end = period.end;
    }

    // 周次
    if (columns.weeks !== undefined) {
      const w = parseWeeks(getCell(row, columns.weeks), true);
      if (w) item.weeks = { start: w.start, end: w.end, parity: w.parity, list: w.list };
    }
    if (!item.weeks) {
      const w2 = parseWeeks(getCell(row, columns.weeks === undefined ? -1 : columns.weeks), true);
      if (w2) item.weeks = { start: w2.start, end: w2.end, parity: w2.parity, list: w2.list };
    }

    // 教室
    if (columns.room !== undefined) {
      const cell = getCell(row, columns.room);
      const hit = extractRoomHit(cell, ctx.classrooms);
      if (hit) item.roomId = hit.roomId;
      else if (!isBlank(cell)) item.roomId = cell.replace(/\s+/g, '').toUpperCase();
    }

    if (!item.day) item.warnings.push('未识别到星期');
    if (!item.start) item.warnings.push('未识别到节次');
    if (!item.roomId) item.warnings.push('未识别到教室');
    if (!item.weeks) item.warnings.push('未识别到周次');
    item._confidence = confidenceOf(item);

    if (!item.day || !item.start) {
      warnings.push('第 ' + (r + 1) + ' 行「' + item.name + '」缺少星期或节次，已跳过');
      continue;
    }
    courses.push(item);
  }

  return { courses: courses, warnings: warnings };
}

/** 单条课程的识别置信度（0-1） */
function confidenceOf(item) {
  let hit = 0;
  let total = 5;
  if (item.day) hit++;
  if (item.start) hit++;
  if (item.roomId) hit++;
  if (item.weeks) hit++;
  if (item.teacher) hit++;
  return Math.round((hit / total) * 100) / 100;
}

/**
 * 尝试按"列表式"解析
 * @param {Array} rows
 * @param {Object} ctx
 * @param {Object} [forced] 由智能识别给出的既定方案 { headerRow, startRow, columns }
 * @returns {{courses:Array, headerRow:Number, columns:Object}|null}
 */
function extractFromList(rows, ctx, forced) {
  let plan = forced;
  if (!plan) {
    plan = findHeaderRow(rows);
    if (!plan) return null;
  }
  const startRow = plan.startRow !== undefined ? plan.startRow : (plan.headerRow + 1);
  const res = extractRowsWithColumns(rows, startRow, plan.columns, ctx);
  return {
    courses: res.courses,
    headerRow: plan.headerRow,
    columns: plan.columns,
    warnings: res.warnings,
  };
}

function getCell(row, index) {
  if (index === undefined || index < 0 || !row) return '';
  const v = row[index];
  return v === undefined || v === null ? '' : String(v);
}

/** 宽松解析星期：在任意位置找 "星期一" / "周三" 等 */
function parseDayFromLoose(text) {
  const t = norm(text);
  if (!t) return 0;
  let m = t.match(/(?:星期|周|礼拜)\s*([一二三四五六日天1-7])/);
  if (m) return DAY_CHAR[m[1]] || Number(m[1]) || 0;
  m = t.toLowerCase().match(/\b(mon|tue|wed|thu|fri|sat|sun)/);
  if (m) return DAY_EN[m[1]];
  return 0;
}

/* ==================== 网格式课表 ==================== */

/**
 * 找出所有"像星期表头"的行，越像越靠前。
 * 星期列越多、重复越少、位置越靠上，越可能是真正的表头行。
 */
function findGridHeaders(rows, maxScan) {
  const limit = Math.min(rows.length, maxScan || 20);
  const out = [];

  for (let r = 0; r < limit; r++) {
    const cols = [];
    let nonEmpty = 0;
    for (let c = 0; c < rows[r].length; c++) {
      const raw = rows[r][c];
      if (String(raw === undefined || raw === null ? '' : raw).trim()) nonEmpty++;
      const d = parseDayStrict(raw);
      if (d) cols.push({ col: c, day: d });
    }
    // 真正表头行里星期占比很高；普通数据行偶尔出现一个"星期一"不应被当成网格表头
    const dayRatio = nonEmpty ? cols.length / nonEmpty : 0;
    if (cols.length >= 3 && dayRatio >= 0.5) {
      const seen = {};
      let dup = 0;
      for (let i = 0; i < cols.length; i++) {
        if (seen[cols[i].day]) dup++;
        seen[cols[i].day] = 1;
      }
      out.push({
        headerRow: r,
        dayColumns: cols,
        dayRatio: dayRatio,
        score: cols.length * 10 + dayRatio * 20 - dup * 15 - r * 2,
      });
    }
  }
  return out.sort(function (a, b) { return b.score - a.score; });
}

/** 按给定的星期表头提取网格里的课程 */
function extractGridWith(rows, headerRow, dayColumns, ctx) {
  const firstDayCol = dayColumns[0].col;
  const dayColSet = {};
  dayColumns.forEach(function (d) { dayColSet[d.col] = d.day; });

  const courses = [];
  const warnings = [];
  const periodColVotes = {};

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    // 节次标签通常在星期列左侧，取最靠左能解析出节次的列
    let period = null;
    let periodCol = -1;
    for (let c = 0; c < Math.max(firstDayCol, 1); c++) {
      const hit = parsePeriodLabel(row[c], ctx.periods);
      if (hit) {
        period = hit;
        periodCol = c;
        break;
      }
    }
    if (!period) continue;
    periodColVotes[periodCol] = (periodColVotes[periodCol] || 0) + 1;

    for (let c = firstDayCol; c < row.length; c++) {
      const day = dayColSet[c];
      if (!day) continue;
      const cell = row[c];
      if (isBlank(cell)) continue;

      const parsed = parseCellContent(cell, ctx);
      for (let k = 0; k < parsed.length; k++) {
        const p = parsed[k];
        if (!p.name) continue;
        const item = {
          name: p.name,
          teacher: p.teacher,
          roomId: p.roomId,
          weeks: p.weeks,
          day: day,
          start: period.start,
          end: period.end,
          warnings: p.warnings.slice(),
          _source: '第' + (r + 1) + '行第' + (c + 1) + '列',
          _fromHeader: false,
        };
        item._confidence = confidenceOf(item);
        courses.push(item);
      }
      if (!parsed.length) {
        warnings.push('第 ' + (r + 1) + ' 行第 ' + (c + 1) + ' 列内容无法识别：' + String(cell).slice(0, 20));
      }
    }
  }

  if (!courses.length) return null;

  let bestCol = -1;
  let bestVotes = 0;
  Object.keys(periodColVotes).forEach(function (k) {
    if (periodColVotes[k] > bestVotes) {
      bestVotes = periodColVotes[k];
      bestCol = Number(k);
    }
  });

  return {
    courses: courses,
    headerRow: headerRow,
    dayColumns: dayColumns,
    periodCol: bestCol,
    warnings: warnings,
  };
}

/**
 * 尝试按"网格课表"解析
 * @param {Object} [forced] 由智能识别给出的既定方案 { headerRow, dayColumns }
 */
function extractFromGrid(rows, ctx, forced) {
  let plan = forced;
  if (!plan) {
    const headers = findGridHeaders(rows);
    if (!headers.length) return null;
    plan = headers[0];
  }
  return extractGridWith(rows, plan.headerRow, plan.dayColumns, ctx);
}

/* ==================== 相邻区间合并 ==================== */

function weeksKey(w) {
  if (!w) return 'none';
  if (Array.isArray(w.list)) return w.list.join(',');
  return w.start + '-' + w.end + '-' + (w.parity || 'all');
}

/**
 * 合并同一门课被拆到多行（未使用合并单元格）的情况
 * 例如 "第1节" 和 "第2节" 两行都是同一门课 -> 合并成 1-2 节
 */
function mergeAdjacent(courses) {
  const groups = {};
  const order = [];

  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    const key = [c.name, c.day, c.roomId || '', c.teacher || '', weeksKey(c.weeks)].join('\u0001');
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(c);
  }

  const out = [];
  for (let i = 0; i < order.length; i++) {
    const list = groups[order[i]].slice().sort(function (a, b) { return a.start - b.start; });
    let cur = null;
    for (let k = 0; k < list.length; k++) {
      const c = list[k];
      if (cur && c.start <= cur.end + 1) {
        cur.end = Math.max(cur.end, c.end);
        // 合并后取更高的置信度（信息更全的那条行）
        if ((c._confidence || 0) > (cur._confidence || 0)) cur._confidence = c._confidence;
        if (c._source && cur._source && cur._source.indexOf(c._source) < 0) {
          cur._source += '、' + c._source;
        }
      } else {
        if (cur) out.push(cur);
        cur = {
          name: c.name,
          teacher: c.teacher,
          roomId: c.roomId,
          weeks: c.weeks,
          day: c.day,
          start: c.start,
          end: c.end,
          warnings: (c.warnings || []).slice(),
          _source: c._source,
          _confidence: c._confidence,
          _fromHeader: c._fromHeader,
        };
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

/* ==================== 对外主入口 ==================== */

function defaultWeeks(ctx) {
  return { start: 1, end: (ctx && ctx.totalWeeks) || 16, parity: 'all' };
}

function finalize(courses, ctx) {
  const out = [];
  const unknownRooms = [];

  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    if (!c.weeks) {
      c.weeks = defaultWeeks(ctx);
      c.warnings = (c.warnings || []).filter(function (w) { return w !== '未识别到周次'; });
      c.warnings.push('未识别到周次，已按 1-' + c.weeks.end + ' 周处理');
    }
    if (c.roomId && ctx.classrooms && ctx.classrooms.length) {
      const known = ctx.classrooms.some(function (r) { return r.id === c.roomId; });
      if (!known && unknownRooms.indexOf(c.roomId) < 0) unknownRooms.push(c.roomId);
    }
    if (c.name) out.push(c);
  }

  return {
    courses: out,
    unknownRooms: unknownRooms,
    stats: {
      total: out.length,
      withRoom: out.filter(function (c) { return !!c.roomId; }).length,
      withTeacher: out.filter(function (c) { return !!c.teacher; }).length,
    },
  };
}

/** 按智能识别给出的方案执行提取 */
function runPlan(rows, plan, ctx) {
  let raw = null;

  if (plan.layout === 'list') {
    raw = extractFromList(rows, ctx, {
      headerRow: plan.headerRow,
      startRow: plan.startRow !== undefined ? plan.startRow : plan.headerRow + 1,
      columns: plan.columns,
    });
  } else if (plan.layout === 'grid') {
    raw = extractFromGrid(rows, ctx, {
      headerRow: plan.headerRow,
      dayColumns: plan.dayColumns,
    });
  }
  if (!raw || !raw.courses.length) return null;

  const merged = mergeAdjacent(raw.courses);
  const fin = finalize(merged, ctx);
  return Object.assign({
    layout: plan.layout,
    headerRow: plan.headerRow,
    columns: plan.columns,
    dayColumns: plan.dayColumns,
    plan: plan,
  }, fin, { warnings: raw.warnings || [] });
}

/**
 * 从二维表格提取课程
 * @param {Array<Array<String>>} rows
 * @param {Object} ctx  { classrooms, periods, totalWeeks }
 * @param {Object} [plan] 智能识别给出的方案（不传则使用内置的常规识别）
 */
function extractFromTable(rows, ctx, plan) {
  const context = ctx || {};
  // 注意：这里不能过滤掉空行，否则行号会和智能识别给出的方案错位
  //（方案里的 headerRow / startRow 都是按原始行号算的）
  const all = (rows || []).map(function (r) {
    return (r || []).map(function (v) { return v === undefined || v === null ? '' : String(v); });
  });

  const hasContent = all.some(function (r) {
    return r.some(function (v) { return !isBlank(v); });
  });
  if (!hasContent) {
    return { courses: [], layout: 'empty', warnings: ['表格是空的'], unknownRooms: [], stats: { total: 0 } };
  }

  // 智能识别给出的方案优先
  if (plan && plan.layout) {
    const byPlan = runPlan(all, plan, context);
    if (byPlan && byPlan.courses.length) return byPlan;
  }

  // 常规识别：先列表式（有明确表头），再网格式
  const list = extractFromList(all, context);
  if (list && list.courses.length) {
    const merged = mergeAdjacent(list.courses);
    return Object.assign({ layout: 'list', headerRow: list.headerRow, columns: list.columns },
      finalize(merged, context), { warnings: list.warnings || [] });
  }

  const grid = extractFromGrid(all, context);
  if (grid && grid.courses.length) {
    const merged = mergeAdjacent(grid.courses);
    return Object.assign({ layout: 'grid', headerRow: grid.headerRow, dayColumns: grid.dayColumns },
      finalize(merged, context), { warnings: grid.warnings || [] });
  }

  return {
    courses: [],
    layout: 'unknown',
    warnings: ['没有识别出课表结构。请确认表格包含"课程名称/星期/节次/教室/周次"这样的表头，' +
      '或者是"上方是星期、左侧是节次"的课表网格。'],
    unknownRooms: [],
    stats: { total: 0 },
  };
}

/** 从纯文本提取课程（保留原有 CSV 位置式解析，再做自由式兜底） */
function extractFromText(text, ctx) {
  const context = ctx || {};
  const IMP = require("utils/importer");
  const lines = String(text || '').split(/\r?\n/);
  const courses = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw[0] === '#') continue;

    // 1) 位置式：课程名,星期,起始节,结束节,教室,周次
    const pos = IMP.parseLine(raw);
    if (!pos.error && pos.course.day && pos.course.start) {
      courses.push({
        name: pos.course.name,
        teacher: pos.course.teacher || '',
        roomId: pos.course.roomId || '',
        weeks: pos.course.weeks,
        day: pos.course.day,
        start: pos.course.start,
        end: pos.course.end,
        warnings: [],
        _source: '第 ' + (i + 1) + ' 行',
      });
      continue;
    }

    // 2) 自由式：从任意位置的星期/节次/周次/教室推断
    const free = parseFreeFormLine(raw, context);
    if (free) {
      free._source = '第 ' + (i + 1) + ' 行';
      courses.push(free);
    } else {
      errors.push({ line: i + 1, text: raw, error: '无法识别为一条课程记录' });
    }
  }

  const merged = mergeAdjacent(courses);
  return Object.assign({ layout: 'text', errors: errors }, finalize(merged, context));
}

/** 自由式单行解析：不看字段顺序 */
function parseFreeFormLine(line, ctx) {
  let rest = norm(line);
  const item = {
    name: '', teacher: '', roomId: '', weeks: null,
    day: 0, start: 0, end: 0, warnings: [],
  };

  const day = parseDayFromLoose(rest);
  if (day) {
    item.day = day;
    rest = rest.replace(/(?:星期|周|礼拜)\s*[一二三四五六日天1-7]/, ' ');
  }

  const weeks = parseWeeks(rest);
  if (weeks) {
    item.weeks = { start: weeks.start, end: weeks.end, parity: weeks.parity, list: weeks.list };
    rest = rest.replace(weeks.matched, ' ');
  }

  const roomHit = extractRoomHit(rest, ctx.classrooms);
  if (roomHit) {
    item.roomId = roomHit.roomId;
    rest = rest.replace(new RegExp(escapeRegExp(roomHit.matched), 'i'), ' ');
  }

  // 节次：优先 "1-2节" 这类；否则看剩下的裸数字
  const periodHit = rest.match(/第?\s*[一二三四五六七八九十\d]+\s*[-–—~～至到,，、]\s*[一二三四五六七八九十\d]+\s*节?/);
  if (periodHit) {
    const p = parsePeriodLabel(periodHit[0], ctx.periods);
    if (p) {
      item.start = p.start;
      item.end = p.end;
      rest = rest.replace(periodHit[0], ' ');
    }
  }

  const parts = rest.split(/[\s,，;；|、]+/).map(function (s) { return s.trim(); }).filter(Boolean);

  if (!item.start) {
    // 找连续的两个纯数字作为节次区间，或单个数字
    for (let i = 0; i < parts.length; i++) {
      if (/^\d{1,2}$/.test(parts[i])) {
        if (i + 1 < parts.length && /^\d{1,2}$/.test(parts[i + 1])) {
          const a = Number(parts[i]);
          const b = Number(parts[i + 1]);
          if (a >= 1 && b <= 20 && a <= b) {
            item.start = a;
            item.end = b;
            parts.splice(i, 2);
            break;
          }
        }
        const a = Number(parts[i]);
        if (a >= 1 && a <= 20) {
          item.start = a;
          item.end = a;
          parts.splice(i, 1);
          break;
        }
      }
    }
  }
  if (item.start && !item.end) item.end = item.start;

  // 教师：2-4 个纯汉字且不像课程名
  for (let i = 1; i < parts.length; i++) {
    if (isTeacherLike(parts[i]) && !item.teacher) {
      item.teacher = parts[i];
      parts.splice(i, 1);
      break;
    }
  }

  item.name = parts.join(' ').trim();
  if (!item.name || !item.day || !item.start) return null;

  if (!item.roomId) item.warnings.push('未识别到教室');
  if (!item.weeks) item.warnings.push('未识别到周次');
  return item;
}

module.exports = {
  norm,
  parseDayStrict,
  parseDayFromLoose,
  parsePeriodLabel,
  parseWeeks,
  findAllWeeks,
  extractRoom,
  extractRoomHit,
  isTeacherLike,
  parseCellContent,
  getCell,
  matchField,
  isExactHeaderAlias,
  looksLikeRepeatedHeader,
  mapHeaderCells,
  mergeHeaderRows,
  findHeaderRow,
  findGridHeaders,
  confidenceOf,
  extractFromList,
  extractFromGrid,
  extractRowsWithColumns,
  extractGridWith,
  extractFromTable,
  runPlan,
  extractFromText,
  mergeAdjacent,
  periodByTime,
};

  };

  /* ---- utils/storage ---- */
  __modules["utils/storage"] = function (module, exports, require) {
/**
 * 本地存储封装
 * ---------------------------------------------------------------
 * 全部数据落在本机，不依赖网络；后端同步是可选增强。
 */
const KEYS = {
  INITED: 'ss_inited',
  COURSES: 'ss_courses',
  CLASSROOMS: 'ss_classrooms',
  OCCUPANCY: 'ss_occupancy',
  PERIODS: 'ss_periods',
  SETTINGS: 'ss_settings',
  REMINDED: 'ss_reminded',
  TERM: 'ss_term',
};

function get(key, defaultValue) {
  try {
    const v = wx.getStorageSync(key);
    if (v === '' || v === null || v === undefined) {
      return defaultValue === undefined ? null : defaultValue;
    }
    return v;
  } catch (e) {
    return defaultValue === undefined ? null : defaultValue;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    console.error('[storage] 写入失败', key, e);
    return false;
  }
}

function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    /* ignore */
  }
}

/** 默认设置：与 config/index.js 的默认值保持一致，用户改动后覆盖 */
function defaultSettings(term, remind, channels) {
  return {
    aheadMinutes: remind.aheadMinutes,
    finalAheadMinutes: remind.finalAheadMinutes,
    autoPopupMinutes: remind.autoPopupMinutes,
    moveBufferMinutes: remind.moveBufferMinutes,
    vibrate: channels.vibrate,
    sound: channels.sound,
    popup: channels.popup,
    calendar: channels.calendar,
    termName: term.name,
    termStartDate: term.startDate,
    totalWeeks: term.totalWeeks,
    subscribed: false,
    lastCalendarSync: '',
  };
}

function getSettings(fallback) {
  const s = get(KEYS.SETTINGS, null);
  if (!s) return fallback;
  // 与默认值合并，保证新增字段在旧数据上也有值
  const merged = {};
  const keys = Object.keys(fallback);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    merged[k] = s[k] === undefined ? fallback[k] : s[k];
  }
  return merged;
}

function saveSettings(settings) {
  return set(KEYS.SETTINGS, settings);
}

function patchSettings(fallback, patch) {
  const merged = Object.assign({}, getSettings(fallback), patch);
  saveSettings(merged);
  return merged;
}

module.exports = {
  KEYS,
  get,
  set,
  remove,
  defaultSettings,
  getSettings,
  saveSettings,
  patchSettings,
};

  };

  /* ---- utils/table-detect ---- */
  __modules["utils/table-detect"] = function (module, exports, require) {
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
const EX = require("utils/schedule-extract");

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

  };

  /* ---- utils/time ---- */
  __modules["utils/time"] = function (module, exports, require) {
/**
 * 时间与周次工具
 * ---------------------------------------------------------------
 * 约定：
 *  - day: 1=周一 … 7=周日
 *  - week: 学期第几周，从 1 开始；<1 表示开学前，>totalWeeks 表示学期结束后
 *  - "分钟数" 指当天 0 点起的分钟偏移，便于比较大小
 */

const WEEK_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEK_SHORT = ['', '一', '二', '三', '四', '五', '六', '日'];

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** 'YYYY-MM-DD' -> Date（本地 00:00），不依赖各端对日期字符串的解析差异 */
function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date) return new Date(str.getFullYear(), str.getMonth(), str.getDate());
  const m = String(str).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date -> 'YYYY-MM-DD' */
function formatDate(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

/** 'HH:mm' -> 当天分钟数 */
function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const parts = String(hhmm).split(':');
  return Number(parts[0]) * 60 + Number(parts[1] || 0);
}

/** Date -> 当天分钟数（含秒的零头） */
function dateToMinutes(date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/** 把日期与 'HH:mm' 合成完整 Date */
function atTime(date, hhmm) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const m = toMinutes(hhmm);
  d.setMinutes(m);
  return d;
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

/** 该日期所在周的周一 */
function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  return addDays(d, 1 - dow);
}

/** 1=周一 … 7=周日 */
function getDayOfWeek(date) {
  const dow = date.getDay();
  return dow === 0 ? 7 : dow;
}

/** 相对学期开始日期计算第几周（第 1 周周一 = 第 1 周） */
function getWeekIndex(date, termStartDate) {
  const start = parseDate(termStartDate);
  if (!start) return 1;
  const monday = getMonday(date);
  const ms = monday.getTime() - start.getTime();
  const days = Math.round(ms / 86400000);
  return Math.floor(days / 7) + 1;
}

/** 第 week 周（周一为基准）的 7 个日期 */
function weekDates(week, termStartDate) {
  const start = parseDate(termStartDate);
  const out = [];
  if (!start) return out;
  const monday = addDays(start, (week - 1) * 7);
  for (let i = 0; i < 7; i++) out.push(addDays(monday, i));
  return out;
}

/** '10月7日 周三' */
function humanDate(date) {
  return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + WEEK_NAMES[getDayOfWeek(date)];
}

/** 'HH:mm' 展示；分钟差 -> '20 分钟' / '1 小时 5 分钟' */
function humanDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return m + ' 分钟';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? h + ' 小时' : h + ' 小时 ' + rest + ' 分钟';
}

/** 秒级时间戳（wx.addPhoneCalendar 需要） */
function toTimestamp(date) {
  return Math.floor(date.getTime() / 1000);
}

module.exports = {
  WEEK_NAMES,
  WEEK_SHORT,
  pad2,
  parseDate,
  formatDate,
  toMinutes,
  dateToMinutes,
  atTime,
  addDays,
  getMonday,
  getDayOfWeek,
  getWeekIndex,
  weekDates,
  humanDate,
  humanDuration,
  toTimestamp,
};

  };

  /* ---- utils/xlsx ---- */
  __modules["utils/xlsx"] = function (module, exports, require) {
/**
 * XLSX（Excel 2007+）解析
 * ---------------------------------------------------------------
 * 只做课表导入需要的事：把工作表读成二维字符串数组。
 * 重点处理：
 *   - sharedStrings 共享字符串表（含富文本片段拼接）
 *   - inlineStr / 公式结果 / 布尔 / 数字单元格
 *   - 稀疏单元格（按 r 属性还原真实行列位置）
 *   - 合并单元格（课表里大量使用，必须把左上角值铺满整个区域）
 */
const ZIP = require("utils/zip");
const XML = require("utils/xml");
const B = require("utils/bytes");

/** "C5" -> 列索引 2（0 基） */
function colIndexOf(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) n = n * 26 + (c - 64);
    else if (c >= 97 && c <= 122) n = n * 26 + (c - 96);
    else break;
  }
  return n - 1;
}

/** "C5" -> 行号 5（1 基） */
function rowIndexOf(ref) {
  const m = String(ref).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** 去掉浮点误差尾巴：1.0000000000000002 -> "1" */
function cleanNumber(s) {
  if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return s;
  const n = Number(s);
  if (!isFinite(n)) return s;
  if (n === Math.floor(n) && Math.abs(n) < 1e15) return String(Math.floor(n));
  return String(parseFloat(n.toFixed(10)));
}

function normalizePath(base, target) {
  if (!target) return '';
  if (target[0] === '/') return target.slice(1);
  const stack = base.split('/');
  stack.pop(); // 去掉文件名
  const parts = target.split('/');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '.' || parts[i] === '') continue;
    if (parts[i] === '..') stack.pop();
    else stack.push(parts[i]);
  }
  return stack.join('/');
}

/** 读取共享字符串表，返回 索引 -> 文本 */
function readSharedStrings(zip) {
  const out = [];
  if (!zip.has('xl/sharedStrings.xml')) return out;
  const doc = XML.parse(zip.text('xl/sharedStrings.xml'));
  const sst = XML.find(doc, 'sst');
  if (!sst) return out;
  const siList = XML.children(sst, 'si');
  for (let i = 0; i < siList.length; i++) {
    out.push(XML.textOf(siList[i]));
  }
  return out;
}

/** 读取工作簿结构：sheet 名 -> 文件路径 */
function readWorkbookSheets(zip) {
  const sheets = [];
  const rels = {};

  if (zip.has('xl/_rels/workbook.xml.rels')) {
    const relDoc = XML.parse(zip.text('xl/_rels/workbook.xml.rels'));
    const list = XML.findAll(relDoc, 'Relationship');
    for (let i = 0; i < list.length; i++) {
      const id = XML.attr(list[i], 'Id');
      const target = XML.attr(list[i], 'Target');
      if (id && target) rels[id] = normalizePath('xl/workbook.xml', target);
    }
  }

  if (zip.has('xl/workbook.xml')) {
    const doc = XML.parse(zip.text('xl/workbook.xml'));
    const sheetNodes = XML.findAll(doc, 'sheet');
    for (let i = 0; i < sheetNodes.length; i++) {
      const name = XML.attr(sheetNodes[i], 'name') || ('Sheet' + (i + 1));
      const rid = XML.attr(sheetNodes[i], 'id');
      let path = rid ? rels[rid] : '';
      if (!path || !zip.has(path)) path = 'xl/worksheets/sheet' + (i + 1) + '.xml';
      if (zip.has(path)) sheets.push({ name: name, path: path });
    }
  }

  // 兜底：没有 workbook.xml 时，直接按文件名收集
  if (!sheets.length) {
    const names = zip.names().filter(function (n) {
      return /^xl\/worksheets\/[^/]+\.xml$/.test(n);
    }).sort();
    names.forEach(function (n, i) {
      sheets.push({ name: 'Sheet' + (i + 1), path: n });
    });
  }
  return sheets;
}

/** 解析单个工作表的单元格，返回矩形二维数组 */
function readSheet(zip, path, sharedStrings) {
  const doc = XML.parse(zip.text(path));
  const sheetData = XML.find(doc, 'sheetData');
  const grid = {}; // "r,c" -> 文本
  let maxRow = 0;
  let maxCol = 0;

  if (sheetData) {
    const rows = XML.children(sheetData, 'row');
    for (let r = 0; r < rows.length; r++) {
      const rowNode = rows[r];
      const rowNum = Number(XML.attr(rowNode, 'r')) || (maxRow + 1);
      const cells = XML.children(rowNode, 'c');
      let autoCol = 0;
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k];
        const ref = XML.attr(c, 'r');
        const colNum = ref ? colIndexOf(ref) : autoCol;
        const rowIdx = ref ? (rowIndexOf(ref) || rowNum) : rowNum;
        autoCol = colNum + 1;

        const value = readCellValue(c, sharedStrings);
        if (value !== '') {
          grid[rowIdx + ',' + colNum] = value;
        }
        if (rowIdx > maxRow) maxRow = rowIdx;
        if (colNum > maxCol) maxCol = colNum;
      }
      if (rowNum > maxRow) maxRow = rowNum;
    }
  }

  // 合并单元格：把左上角的值铺满整个区域（课表跨节次/多列时必须）
  const merges = XML.findAll(doc, 'mergeCell');
  for (let i = 0; i < merges.length; i++) {
    const ref = XML.attr(merges[i], 'ref') || '';
    const parts = ref.split(':');
    if (parts.length !== 2) continue;
    const c1 = colIndexOf(parts[0]);
    const r1 = rowIndexOf(parts[0]);
    const c2 = colIndexOf(parts[1]);
    const r2 = rowIndexOf(parts[1]);
    if (!r1 || !r2) continue;
    const src = grid[r1 + ',' + c1];
    if (src === undefined || src === '') continue;
    for (let rr = r1; rr <= r2; rr++) {
      for (let cc = c1; cc <= c2; cc++) {
        if (grid[rr + ',' + cc] === undefined) grid[rr + ',' + cc] = src;
      }
    }
    if (r2 > maxRow) maxRow = r2;
    if (c2 > maxCol) maxCol = c2;
  }

  // 稀疏 map -> 矩形数组
  const out = [];
  for (let r = 1; r <= maxRow; r++) {
    const line = [];
    for (let c = 0; c <= maxCol; c++) {
      const v = grid[r + ',' + c];
      line.push(v === undefined ? '' : v);
    }
    out.push(line);
  }
  return out;
}

function readCellValue(c, sharedStrings) {
  const t = XML.attr(c, 't');

  if (t === 'inlineStr') {
    const is = XML.find(c, 'is');
    return is ? XML.textOf(is).trim() : '';
  }

  // 共享字符串
  if (t === 's') {
    const v = XML.find(c, 'v');
    const idx = v ? Number(XML.textOf(v)) : NaN;
    return isFinite(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx] : '';
  }

  const v = XML.find(c, 'v');
  if (!v) return '';
  const raw = XML.textOf(v);

  if (t === 'str') return raw;                // 公式的字符串结果
  if (t === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  if (t === 'e') return '';                   // 错误值忽略
  if (t === 'd') return raw;                  // ISO 日期字符串
  return cleanNumber(raw.trim());             // 默认按数字处理
}

/**
 * 解析 xlsx 文件
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {{sheets: Array<{name, rows}>, sheetNames: String[]}}
 */
function parseXlsx(input) {
  const bytes = B.toBytes(input);
  if (ZIP.isOle2(bytes)) {
    throw new Error('这是旧版 .xls 格式。请在 Excel 中「另存为」.xlsx 后再导入');
  }
  const zip = ZIP.readZip(bytes);
  if (zip.has('EncryptedPackage') || zip.has('EncryptionInfo')) {
    throw new Error('工作簿已加密，请先取消密码保护再导入');
  }

  const sharedStrings = readSharedStrings(zip);
  const sheetInfos = readWorkbookSheets(zip);
  if (!sheetInfos.length) throw new Error('Excel 文件里没有找到工作表');

  const sheets = [];
  for (let i = 0; i < sheetInfos.length; i++) {
    try {
      sheets.push({
        name: sheetInfos[i].name,
        rows: readSheet(zip, sheetInfos[i].path, sharedStrings),
      });
    } catch (e) {
      // 单个工作表失败不影响其它表
      sheets.push({ name: sheetInfos[i].name, rows: [], error: e.message });
    }
  }

  return {
    sheets: sheets,
    sheetNames: sheets.map(function (s) { return s.name; }),
  };
}

module.exports = {
  parseXlsx,
  colIndexOf,
  rowIndexOf,
  cleanNumber,
  normalizePath,
};

  };

  /* ---- utils/xml ---- */
  __modules["utils/xml"] = function (module, exports, require) {
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

  };

  /* ---- utils/zip ---- */
  __modules["utils/zip"] = function (module, exports, require) {
/**
 * ZIP 容器解析
 * ---------------------------------------------------------------
 * .xlsx / .docx 都是 ZIP 包。这里实现最小可用的读取能力：
 *   末尾 EOCD -> 中央目录 -> 逐条读本地头 -> deflate 解压 -> CRC32 校验
 * 不依赖任何平台解压 API，也不依赖第三方库。
 */
const B = require("utils/bytes");
const INF = require("utils/inflate");

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

  };

  /* ---- 对外命名空间 ---- */
  var SS = {};
  SS["config"] = __require("config/index");
  SS["periods"] = __require("data/periods");
  SS["classrooms"] = __require("data/classrooms");
  SS["courses"] = __require("data/courses");
  SS["occupancy"] = __require("data/occupancy");
  SS["time"] = __require("utils/time");
  SS["bytes"] = __require("utils/bytes");
  SS["inflate"] = __require("utils/inflate");
  SS["zip"] = __require("utils/zip");
  SS["xml"] = __require("utils/xml");
  SS["xlsx"] = __require("utils/xlsx");
  SS["docx"] = __require("utils/docx");
  SS["extract"] = __require("utils/schedule-extract");
  SS["detect"] = __require("utils/table-detect");
  SS["fileImport"] = __require("utils/file-import");
  SS["importer"] = __require("utils/importer");
  SS["schedule"] = __require("utils/schedule");
  SS["classroom"] = __require("utils/classroom");
  SS["notify"] = __require("utils/notify");
  SS["storage"] = __require("utils/storage");
  SS.__modules = __modules;
  SS.__require = __require;
  global.SS = SS;
})(typeof window !== "undefined" ? window : globalThis);
