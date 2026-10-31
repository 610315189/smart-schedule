/**
 * 浏览器版 wx API 兼容层
 * ---------------------------------------------------------------
 * miniprogram/utils 里的代码是按小程序 API 写的，这里用浏览器
 * 原生能力实现同一套接口，从而让那几个模块「零改动」跑在浏览器里。
 *
 * 对应关系：
 *   wx.getStorageSync   -> localStorage（带内存兜底，隐私模式也能用）
 *   wx.vibrateLong      -> navigator.vibrate
 *   wx.createInnerAudioContext -> Web Audio 合成提示音（不依赖音频文件）
 *   wx.request          -> fetch
 *   wx.addPhoneCalendar -> 下载 .ics 日历文件（交给手机系统日历提醒）
 */
(function (global) {
  'use strict';

  /* ==================== 存储 ==================== */
  var PREFIX = 'ss:';
  var memStore = {};
  var lsOk = false;

  try {
    var probeKey = '__ss_probe__';
    global.localStorage.setItem(probeKey, '1');
    global.localStorage.removeItem(probeKey);
    lsOk = true;
  } catch (e) {
    lsOk = false;
  }

  var store = {
    get: function (key) {
      if (lsOk) {
        try {
          var raw = global.localStorage.getItem(PREFIX + key);
          return raw === null ? '' : raw;
        } catch (e) { /* 落到内存 */ }
      }
      return memStore[key] === undefined ? '' : memStore[key];
    },
    set: function (key, value) {
      var raw = JSON.stringify(value);
      if (lsOk) {
        try {
          global.localStorage.setItem(PREFIX + key, raw);
          return true;
        } catch (e) { /* 配额满或隐私模式，落到内存 */ }
      }
      memStore[key] = raw;
      return true;
    },
    del: function (key) {
      if (lsOk) {
        try { global.localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
      }
      delete memStore[key];
    },
    /** 导出全部数据（备份用） */
    dump: function () {
      var out = {};
      if (lsOk) {
        try {
          for (var i = 0; i < global.localStorage.length; i++) {
            var k = global.localStorage.key(i);
            if (k && k.indexOf(PREFIX) === 0) {
              var v = global.localStorage.getItem(k);
              try { out[k.slice(PREFIX.length)] = JSON.parse(v); } catch (e) { out[k.slice(PREFIX.length)] = v; }
            }
          }
        } catch (e) { /* ignore */ }
      }
      Object.keys(memStore).forEach(function (k) {
        if (out[k] === undefined) {
          try { out[k] = JSON.parse(memStore[k]); } catch (e) { out[k] = memStore[k]; }
        }
      });
      return out;
    },
  };

  /* ==================== 提示音（Web Audio 合成） ==================== */
  var audioCtx = null;

  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    var Ctor = global.AudioContext || global.webkitAudioContext;
    if (!Ctor) return null;
    try { audioCtx = new Ctor(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  /** 三声短促「叮」，与小程序版的 alert.wav 听感接近 */
  function beep() {
    var ctx = getAudioCtx();
    if (!ctx) return false;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    var freqs = [880, 1174, 1568];
    var t0 = ctx.currentTime;
    freqs.forEach(function (f, i) {
      var start = t0 + i * 0.2;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.28, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    return true;
  }

  /* ==================== 震动 ==================== */
  function vibrate(pattern) {
    try {
      if (global.navigator && typeof global.navigator.vibrate === 'function') {
        return global.navigator.vibrate(pattern);
      }
    } catch (e) { /* 桌面浏览器普遍不支持，忽略 */ }
    return false;
  }

  /* ==================== 轻组件（可被 ui.js 覆盖） ==================== */
  var hooks = {
    toast: null,
    modal: null,
  };

  function defaultToast(opt) {
    var msg = (opt && (opt.title || opt.content)) || '';
    if (hooks.toast) return hooks.toast(opt);
    if (global.console) console.log('[toast] ' + msg);
  }

  function defaultModal(opt) {
    if (hooks.modal) return hooks.modal(opt);
    var msg = (opt && (opt.content || opt.title)) || '';
    var ok = global.confirm ? global.confirm(msg) : true;
    if (opt && typeof opt.success === 'function') {
      opt.success({ confirm: ok, cancel: !ok });
    }
  }

  /* ==================== 日历：导出 .ics ==================== */
  var calendarBuffer = [];

  function flushCalendar() {
    if (!calendarBuffer.length) return;
    var events = calendarBuffer.slice();
    calendarBuffer = [];
    if (global.SS && global.SS.ics) {
      global.SS.ics.download(events);
    }
  }

  /* ==================== wx 兼容对象 ==================== */
  var wx = {
    /* --- 存储 --- */
    getStorageSync: function (key) {
      var raw = store.get(key);
      if (raw === '' || raw === null || raw === undefined) return '';
      try { return JSON.parse(raw); } catch (e) { return raw; }
    },
    setStorageSync: function (key, value) {
      return store.set(key, value);
    },
    removeStorageSync: function (key) {
      store.del(key);
    },

    /* --- 反馈 --- */
    vibrateLong: function () { vibrate([0, 320, 120, 320]); },
    vibrateShort: function () { vibrate(35); },

    createInnerAudioContext: function () {
      return {
        src: '',
        volume: 1,
        loop: false,
        play: function () { beep(); },
        stop: function () {},
        pause: function () {},
        destroy: function () {},
        onError: function () {},
        onEnded: function () {},
      };
    },

    showToast: function (opt) { defaultToast(opt); },
    showModal: function (opt) { defaultModal(opt); },

    /* --- 网络（可选：后端同步用） --- */
    request: function (opt) {
      var o = opt || {};
      var init = {
        method: (o.method || 'GET').toUpperCase(),
        headers: o.header || {},
      };
      if (init.method !== 'GET' && o.data !== undefined) {
        init.headers['content-type'] = init.headers['content-type'] || 'application/json';
        init.body = typeof o.data === 'string' ? o.data : JSON.stringify(o.data);
      }
      var url = o.url;
      if (init.method === 'GET' && o.data) {
        var qs = Object.keys(o.data).map(function (k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(o.data[k]);
        }).join('&');
        if (qs) url += (url.indexOf('?') >= 0 ? '&' : '?') + qs;
      }
      fetch(url, init).then(function (res) {
        return res.json().then(function (data) {
          if (typeof o.success === 'function') {
            o.success({ statusCode: res.status, data: data });
          }
        });
      }).catch(function (err) {
        if (typeof o.fail === 'function') o.fail({ errMsg: String(err && err.message || err) });
      });
    },

    /* --- 日历：浏览器里退化为累积事件后下载 .ics --- */
    addPhoneCalendar: function (opt) {
      calendarBuffer.push(opt || {});
      if (typeof opt.success === 'function') opt.success({});
      // 一次性批量写入时，最后由 flush 统一生成文件
      clearTimeout(flushCalendar._t);
      flushCalendar._t = setTimeout(flushCalendar, 60);
    },
    getSetting: function (opt) {
      if (opt && typeof opt.success === 'function') opt.success({ authSetting: {} });
    },
    openSetting: function (opt) {
      if (opt && typeof opt.fail === 'function') opt.fail({ errMsg: 'browser not supported' });
    },

    /* --- 文件系统（网页版不走这里，用 FileReader） --- */
    getFileSystemManager: function () {
      return {
        readFileSync: function () {
          throw new Error('网页版请使用文件选择框（FileReader），不走文件系统 API');
        },
      };
    },
  };

  global.wx = wx;

  /** 暴露给 ui.js 覆盖提示组件 */
  global.WX_SHIM = {
    store: store,
    beep: beep,
    vibrate: vibrate,
    setToast: function (fn) { hooks.toast = fn; },
    setModal: function (fn) { hooks.modal = fn; },
    flushCalendar: flushCalendar,
  };
})(typeof window !== 'undefined' ? window : globalThis);
