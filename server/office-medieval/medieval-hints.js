/* medieval-hints.js — Contextual floating hints for returning users */
(function() {
  'use strict';

  var HINTS_KEY = 'spawnkit-hints-shown';
  var shown = {};
  try { shown = JSON.parse(localStorage.getItem(HINTS_KEY) || '{}'); } catch(e) {}

  var HINTS = {
    hotbar: { text: 'Press 1-8 for quick actions. Try pressing 1 for Missions!', anchor: 'bottom', delay: 5000 },
    firstBuilding: { text: 'Click any building to open its panel', anchor: 'center', delay: 8000 },
    firstAgent: { text: 'Click an agent to see their character sheet', anchor: 'center', delay: 12000 },
    sidebar: { text: 'Activity log shows real-time updates from your agents', anchor: 'right', delay: 15000 }
  };

  var activeHint = null;

  function createHintEl() {
    var el = document.createElement('div');
    el.id = 'sk-hint-bubble';
    el.style.cssText = 'position:fixed;z-index:9999;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:500;line-height:1.5;max-width:280px;pointer-events:all;opacity:0;transform:translateY(8px);transition:all 0.4s ease;font-family:"Crimson Text",serif;' +
      'background:linear-gradient(135deg,rgba(30,25,18,0.95),rgba(45,35,22,0.95));color:#F5E6D0;border:1px solid rgba(201,169,89,0.4);box-shadow:0 8px 24px rgba(0,0,0,0.4);';
    el.innerHTML = '<div id="sk-hint-text"></div><button id="sk-hint-close" style="position:absolute;top:4px;right:8px;background:none;border:none;color:rgba(201,169,89,0.6);font-size:16px;cursor:pointer;padding:2px 4px;">✕</button>';
    document.body.appendChild(el);

    document.getElementById('sk-hint-close').addEventListener('click', function() { hideHint(); });
    return el;
  }

  function showHint(id) {
    if (shown[id]) return;
    var hint = HINTS[id];
    if (!hint) return;

    var el = document.getElementById('sk-hint-bubble') || createHintEl();
    document.getElementById('sk-hint-text').textContent = hint.text;

    // Position based on anchor
    el.style.left = ''; el.style.right = ''; el.style.top = ''; el.style.bottom = '';
    if (hint.anchor === 'bottom') {
      el.style.bottom = '90px'; el.style.left = '50%'; el.style.transform = 'translateX(-50%) translateY(8px)';
    } else if (hint.anchor === 'right') {
      el.style.right = '16px'; el.style.top = '50%'; el.style.transform = 'translateY(-50%) translateX(8px)';
    } else {
      el.style.top = '40%'; el.style.left = '50%'; el.style.transform = 'translateX(-50%) translateY(8px)';
    }

    requestAnimationFrame(function() {
      el.style.opacity = '1';
      if (hint.anchor === 'bottom') el.style.transform = 'translateX(-50%) translateY(0)';
      else if (hint.anchor === 'right') el.style.transform = 'translateY(-50%) translateX(0)';
      else el.style.transform = 'translateX(-50%) translateY(0)';
    });

    activeHint = id;

    // Auto-dismiss after 8s
    setTimeout(function() { if (activeHint === id) hideHint(); }, 8000);
  }

  function hideHint() {
    var el = document.getElementById('sk-hint-bubble');
    if (!el) return;
    el.style.opacity = '0';
    if (activeHint) {
      shown[activeHint] = true;
      try { localStorage.setItem(HINTS_KEY, JSON.stringify(shown)); } catch(e) {}
    }
    activeHint = null;
  }

  // ── Trigger hints based on timing ──────────────────────────
  // Only show hints to users who completed onboarding
  if (localStorage.getItem('spawnkit-onboarded-medieval') !== 'true') return;

  // Show hints sequentially with delays
  Object.keys(HINTS).forEach(function(id) {
    if (shown[id]) return;
    setTimeout(function() {
      if (!activeHint) showHint(id);
    }, HINTS[id].delay);
  });

  // ── Mark hints as shown when user performs the action ──────
  document.addEventListener('click', function(e) {
    var target = e.target;
    // If user clicked a building or agent, mark those hints shown
    if (target.closest && target.closest('#scene-container')) {
      shown.firstBuilding = true;
      shown.firstAgent = true;
      try { localStorage.setItem(HINTS_KEY, JSON.stringify(shown)); } catch(e2) {}
      if (activeHint === 'firstBuilding' || activeHint === 'firstAgent') hideHint();
    }
    if (target.closest && target.closest('#roblox-hotbar')) {
      shown.hotbar = true;
      try { localStorage.setItem(HINTS_KEY, JSON.stringify(shown)); } catch(e2) {}
      if (activeHint === 'hotbar') hideHint();
    }
  });
})();
