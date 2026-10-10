/**
 * 智能课表 · 小程序入口
 * ---------------------------------------------------------------
 * 职责：首次启动导入示例数据、集中管理全局状态、提供统一的数据读写方法。
 * 所有数据都存在本机 Storage，离线可用。
 */
const CFG = require('./config/index');
const storage = require('./utils/storage');
const S = require('./utils/schedule');
const { COURSES } = require('./data/courses');
const { CLASSROOMS } = require('./data/classrooms');
const { OCCUPANCY } = require('./data/occupancy');
const { DEFAULT_PERIODS } = require('./data/periods');

App({
  globalData: {
    courses: [],
    classrooms: [],
    occupancy: [],
    periods: [],
    settings: {},
  },

  onLaunch() {
    this.initStorage();
    this.reload();
  },

  onShow() {
    this.reload();
  },

  /** 首次启动：把示例数据写入本地 */
  initStorage() {
    const inited = storage.get(storage.KEYS.INITED, false);
    if (!inited) {
      storage.set(storage.KEYS.COURSES, S.normalizeAll(COURSES));
      storage.set(storage.KEYS.CLASSROOMS, CLASSROOMS);
      storage.set(storage.KEYS.OCCUPANCY, S.normalizeAll(OCCUPANCY));
      storage.set(storage.KEYS.PERIODS, DEFAULT_PERIODS);
      storage.set(storage.KEYS.SETTINGS, storage.defaultSettings(CFG.TERM, CFG.REMIND, CFG.NOTIFY_CHANNEL));
      storage.set(storage.KEYS.INITED, true);
    }
  },

  /** 从 Storage 载入到内存 */
  reload() {
    const g = this.globalData;
    g.courses = storage.get(storage.KEYS.COURSES, []) || [];
    g.classrooms = storage.get(storage.KEYS.CLASSROOMS, CLASSROOMS) || CLASSROOMS;
    g.occupancy = storage.get(storage.KEYS.OCCUPANCY, []) || [];
    g.periods = storage.get(storage.KEYS.PERIODS, DEFAULT_PERIODS) || DEFAULT_PERIODS;
    g.settings = storage.getSettings(storage.defaultSettings(CFG.TERM, CFG.REMIND, CFG.NOTIFY_CHANNEL));
    return g;
  },

  /** 一次性取全部数据（页面 onShow 调这个最省事） */
  data() {
    return this.reload();
  },

  saveCourses(list) {
    const normalized = S.normalizeAll(list);
    storage.set(storage.KEYS.COURSES, normalized);
    this.globalData.courses = normalized;
    return normalized;
  },

  saveSettings(patch) {
    const merged = storage.patchSettings(
      storage.defaultSettings(CFG.TERM, CFG.REMIND, CFG.NOTIFY_CHANNEL), patch);
    this.globalData.settings = merged;
    return merged;
  },

  savePeriods(periods) {
    storage.set(storage.KEYS.PERIODS, periods);
    this.globalData.periods = periods;
  },

  saveClassrooms(list) {
    storage.set(storage.KEYS.CLASSROOMS, list);
    this.globalData.classrooms = list;
  },

  saveOccupancy(list) {
    const normalized = S.normalizeAll(list);
    storage.set(storage.KEYS.OCCUPANCY, normalized);
    this.globalData.occupancy = normalized;
    return normalized;
  },

  /** 恢复出厂示例数据 */
  restoreDemo() {
    storage.set(storage.KEYS.COURSES, S.normalizeAll(COURSES));
    storage.set(storage.KEYS.CLASSROOMS, CLASSROOMS);
    storage.set(storage.KEYS.OCCUPANCY, S.normalizeAll(OCCUPANCY));
    storage.set(storage.KEYS.PERIODS, DEFAULT_PERIODS);
    storage.set(storage.KEYS.SETTINGS, storage.defaultSettings(CFG.TERM, CFG.REMIND, CFG.NOTIFY_CHANNEL));
    storage.set(storage.KEYS.INITED, true);
    this.reload();
  },
});
