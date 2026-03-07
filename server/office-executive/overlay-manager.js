/**
 * SpawnKit — Overlay Accessibility Patch v2
 * Syncs aria-hidden with .open class on overlay elements.
 * Uses MutationObserver on class attribute changes — zero monkey-patching.
 */
(function () {
  'use strict';

  var OVERLAY_IDS = [
    'mailboxOverlay', 'todoOverlay', 'meetingOverlay', 'detailOverlay',
    'chatOverlay', 'cronOverlay', 'memoryOverlay', 'missionsOverlay',
    'settingsOverlay', 'remoteOverlay', 'chatHistoryOverlay',
    'addAgentOverlay', 'orchestrationOverlay', 'themePickerOverlay',
    'missionControlOverlay', 'activateAgentModal'
  ];

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var el = mutations[i].target;
      if (el.classList.contains('open')) {
        el.setAttribute('aria-hidden', 'false');
      } else {
        el.setAttribute('aria-hidden', 'true');
      }
    }
  });

  function init() {
    OVERLAY_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      // Ensure initial aria-hidden matches current state
      if (!el.classList.contains('open')) {
        el.setAttribute('aria-hidden', 'true');
      }
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
