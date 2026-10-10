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
