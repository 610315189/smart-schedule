/**
 * 通用 UI 组件：Toast / 确认框 / 底部弹层
 * ---------------------------------------------------------------
 * 同时接管 wx-shim 的 showToast / showModal，
 * 这样底层 utils 里调用的 wx.showToast 也会走这套界面。
 */
(function (global) {
  'use strict';

  var overlayEl = document.getElementById('overlay');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  var escHandler = null;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, duration) {
    if (!toastEl) return;
    toastEl.textContent = String(msg || '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, duration || 1900);
  }

  /* ---------------- 遮罩与弹层 ---------------- */
  function closeOverlay() {
    if (!overlayEl) return;
    overlayEl.hidden = true;
    overlayEl.innerHTML = '';
    overlayEl.classList.remove('center');
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  }

  function mountOverlay(innerHtml, center) {
    if (!overlayEl) return;
    overlayEl.innerHTML = innerHtml;
    overlayEl.hidden = false;
    if (center) overlayEl.classList.add('center');
    else overlayEl.classList.remove('center');

    // 点遮罩关闭
    overlayEl.onclick = function (e) {
      if (e.target === overlayEl) closeOverlay();
    };
    // ESC 关闭
    escHandler = function (e) {
      if (e.key === 'Escape') closeOverlay();
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * 底部弹层
   * @param {Object} opts { title, sub, bodyHtml, actions:[{label, style, onClick}] }
   */
  function sheet(opts) {
    var o = opts || {};
    var actions = (o.actions || []).map(function (a, i) {
      var cls = a.style === 'primary' ? 'btn-primary' : (a.style === 'danger' ? 'btn-danger' : 'btn-plain');
      return '<button class="btn ' + cls + '" data-act="' + i + '">' + esc(a.label) + '</button>';
    }).join('');

    mountOverlay(
      '<div class="sheet" role="dialog" aria-modal="true">' +
      '<div class="sheet-title">' + esc(o.title || '') + '</div>' +
      (o.sub ? '<div class="sheet-sub">' + esc(o.sub) + '</div>' : '') +
      '<div class="sheet-body">' + (o.bodyHtml || '') + '</div>' +
      (actions ? '<div class="mt16">' + actions + '</div>' : '') +
      '</div>',
      false
    );

    var sheetEl = overlayEl.querySelector('.sheet');
    sheetEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var action = o.actions[Number(btn.getAttribute('data-act'))];
      if (action && typeof action.onClick === 'function') action.onClick(closeOverlay);
      else closeOverlay();
    });
    return closeOverlay;
  }

  /**
   * 确认框（Promise 风格，同时兼容回调）
   * @returns {Promise<boolean>}
   */
  function confirm(opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
      var cancelHtml = o.showCancel === false ? '' :
        '<button class="btn btn-plain grow" data-act="cancel">' + esc(o.cancelText || '取消') + '</button>';
      mountOverlay(
        '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-title">' + esc(o.title || '确认') + '</div>' +
        '<div class="modal-body">' + esc(o.content || '') + '</div>' +
        '<div class="modal-actions">' + cancelHtml +
        '<button class="btn btn-primary grow" data-act="ok">' + esc(o.confirmText || '确定') + '</button>' +
        '</div></div>',
        true
      );
      overlayEl.querySelector('.modal').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var isOk = btn.getAttribute('data-act') === 'ok';
        closeOverlay();
        resolve(isOk);
      });
    });
  }

  function alertBox(opts) {
    var o = typeof opts === 'string' ? { content: opts } : (opts || {});
    return confirm(Object.assign({}, o, { showCancel: false, confirmText: o.confirmText || '知道了' }));
  }

  /* ---------------- 接管 wx 的提示接口 ---------------- */
  if (global.WX_SHIM) {
    global.WX_SHIM.setToast(function (opt) {
      toast((opt && (opt.title || opt.content)) || '');
    });
    global.WX_SHIM.setModal(function (opt) {
      var o = opt || {};
      confirm({
        title: o.title || '提示',
        content: o.content || '',
        showCancel: o.showCancel !== false,
        confirmText: o.confirmText || '确定',
        cancelText: o.cancelText || '取消',
      }).then(function (ok) {
        if (typeof o.success === 'function') o.success({ confirm: ok, cancel: !ok });
      });
    });
  }

  global.UI = {
    toast: toast,
    sheet: sheet,
    confirm: confirm,
    alert: alertBox,
    closeOverlay: closeOverlay,
    esc: esc,
  };
})(typeof window !== 'undefined' ? window : globalThis);
