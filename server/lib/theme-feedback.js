/* theme-feedback.js — Toast notifications + loading states for all themes */
(function() {
  'use strict';

  // ── Toast System ──────────────────────────────────────────
  var toastContainer = null;
  function getContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.id = 'sk-toast-container';
    toastContainer.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  window.showToast = function(msg, type) {
    type = type || 'info';
    var colors = { info: '#007AFF', success: '#30D158', error: '#FF453A', warning: '#FFD60A' };
    var icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
    var toast = document.createElement('div');
    toast.style.cssText = 'pointer-events:all;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:500;color:#fff;display:flex;align-items:center;gap:8px;opacity:0;transform:translateX(20px);transition:all 0.3s ease;max-width:320px;' +
      'background:' + (colors[type] || colors.info) + ';box-shadow:0 4px 16px rgba(0,0,0,0.2);';
    toast.innerHTML = '<span>' + (icons[type] || '') + '</span><span>' + msg + '</span>';
    getContainer().appendChild(toast);
    requestAnimationFrame(function() { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; });
    setTimeout(function() {
      toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
  };

  // ── Loading Spinner ──────────────────────────────────────
  var spinnerStyle = document.createElement('style');
  spinnerStyle.textContent = '@keyframes sk-spin{to{transform:rotate(360deg)}}.sk-spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.2);border-top-color:currentColor;border-radius:50%;animation:sk-spin 0.6s linear infinite;}.sk-loading-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);border-radius:inherit;z-index:5;}.sk-loading-overlay .sk-spinner{width:24px;height:24px;border-width:3px;}';
  document.head.appendChild(spinnerStyle);

  window.showLoading = function(element) {
    if (!element) return;
    element.style.position = 'relative';
    var overlay = document.createElement('div');
    overlay.className = 'sk-loading-overlay';
    overlay.innerHTML = '<div class="sk-spinner"></div>';
    element.appendChild(overlay);
    return overlay;
  };

  window.hideLoading = function(element) {
    if (!element) return;
    var overlay = element.querySelector('.sk-loading-overlay');
    if (overlay) overlay.remove();
  };

  // ── Global Error Handler ──────────────────────────────────
  window.addEventListener('unhandledrejection', function(e) {
    var msg = e.reason && e.reason.message ? e.reason.message : 'Something went wrong';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      window.showToast('Connection lost — retrying...', 'warning');
    }
  });
})();
