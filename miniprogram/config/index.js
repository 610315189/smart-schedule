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
