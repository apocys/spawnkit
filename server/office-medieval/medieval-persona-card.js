(function () {
  'use strict';

  // ── CSS ────────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#persona-card-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0);pointer-events:none;transition:background .3s}',
    '#persona-card-overlay.pc-visible{background:rgba(0,0,0,.45);pointer-events:all}',
    '.pc-card{position:fixed;top:0;right:0;width:380px;height:100vh;background:rgba(22,33,62,.97);border-left:1px solid rgba(201,169,89,.4);color:#f4e4bc;font-family:"Inter",sans-serif;font-size:13px;overflow-y:auto;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-8px 0 32px rgba(0,0,0,.6)}',
    '.pc-card.pc-open{transform:translateX(0)}',
    '.pc-close-btn{position:absolute;top:12px;right:14px;background:none;border:none;color:rgba(168,162,153,.8);font-size:20px;cursor:pointer;line-height:1;padding:4px 8px;border-radius:4px;transition:color .2s}',
    '.pc-close-btn:hover{color:#f4e4bc}',
    '.pc-header{display:flex;align-items:center;gap:14px;padding:20px 16px 16px;border-bottom:1px solid rgba(168,162,153,.25);background:rgba(201,169,89,.06)}',
    '.pc-header-text{flex:1;min-width:0}',
    '.pc-agent-name{font-family:"Crimson Text",serif;font-size:22px;font-weight:700;color:#f4e4bc;line-height:1.2;margin:0}',
    '.pc-agent-title{font-size:11px;color:rgba(201,169,89,.9);letter-spacing:.06em;text-transform:uppercase;margin-top:3px}',
    '.pc-emoji-badge{font-size:24px;line-height:1}',
    '.pc-section{padding:12px 16px;border-bottom:1px solid rgba(168,162,153,.18)}',
    '.pc-section-label{font-family:"Crimson Text",serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgba(201,169,89,.75);margin-bottom:8px}',
    '.pc-stat-row{margin-bottom:8px}',
    '.pc-stat-header{display:flex;justify-content:space-between;font-size:11px;color:rgba(168,162,153,.9);margin-bottom:4px}',
    '.pc-stat-bar{height:8px;background:rgba(168,162,153,.15);border-radius:4px;overflow:hidden}',
    '.pc-stat-fill{height:100%;border-radius:4px;transition:width .6s ease}',
    '.pc-stat-fill.mood-happy{background:linear-gradient(90deg,#4caf50,#8bc34a)}',
    '.pc-stat-fill.mood-neutral{background:linear-gradient(90deg,#8bc34a,#cddc39)}',
    '.pc-stat-fill.mood-stressed{background:linear-gradient(90deg,#ff9800,#f44336)}',
    '.pc-stat-fill.mood-tired{background:linear-gradient(90deg,#607d8b,#9e9e9e)}',
    '.pc-stat-fill.energy{background:linear-gradient(90deg,#1565c0,#42a5f5)}',
    '.pc-quest-name{color:#f4e4bc;font-size:13px;margin-bottom:2px}',
    '.pc-quest-time{font-size:11px;color:rgba(168,162,153,.7)}',
    '.pc-temperament{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;background:rgba(201,169,89,.18);color:rgba(201,169,89,.95);border:1px solid rgba(201,169,89,.3);margin-bottom:7px}',
    '.pc-flavor{font-size:12px;color:rgba(168,162,153,.85);line-height:1.5;white-space:pre-wrap}',
    '.pc-conscience-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
    '.pc-conscience-badge{padding:2px 10px;border-radius:10px;font-size:11px;font-weight:600;letter-spacing:.04em}',
    '.pc-conscience-badge.dutiful{background:rgba(76,175,80,.2);color:#81c784;border:1px solid rgba(76,175,80,.4)}',
    '.pc-conscience-badge.independent{background:rgba(33,150,243,.2);color:#64b5f6;border:1px solid rgba(33,150,243,.4)}',
    '.pc-conscience-badge.chaotic{background:rgba(244,67,54,.2);color:#ef9a9a;border:1px solid rgba(244,67,54,.4)}',
    '.pc-trust-stars{font-size:16px;color:rgba(201,169,89,.9);letter-spacing:2px}',
    '.pc-zones{font-size:12px;color:rgba(168,162,153,.85);line-height:1.6}',
    '.pc-activity-item{display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(168,162,153,.1);font-size:11px;color:rgba(168,162,153,.8)}',
    '.pc-activity-item:last-child{border-bottom:none}',
    '.pc-activity-icon{flex-shrink:0}',
    '.pc-activity-text{flex:1;line-height:1.4}',
    '.pc-activity-ts{flex-shrink:0;color:rgba(168,162,153,.5);white-space:nowrap}',
    '.pc-footer{padding:10px 16px;font-size:10px;color:rgba(168,162,153,.4);text-align:center;margin-top:auto}'
  ].join('');
  document.head.appendChild(style);

  // ── DOM ────────────────────────────────────────────────────────────────────
  var overlay = document.createElement('div');
  overlay.id = 'persona-card-overlay';

  var card = document.createElement('div');
  card.className = 'pc-card';
  card.innerHTML = '<button class="pc-close-btn" title="Close">\u2715</button><div class="pc-body"></div><div class="pc-footer">\u2694\uFE0F SpawnKit Medieval \u2014 Character Sheet</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  var closeBtn = card.querySelector('.pc-close-btn');
  var body = card.querySelector('.pc-body');

  // ── Helpers ────────────────────────────────────────────────────────────────
  var AGENT_COLORS = {
    forge:    ['#c0621a', '#1a1a1a'],
    atlas:    ['#1565c0', '#f0f0f0'],
    sentinel: ['#6a0dad', '#b0b0b0'],
    herald:   ['#b8860b', '#fff8dc'],
    scout:    ['#2e7d32', '#f5f5dc'],
    warden:   ['#4e342e', '#d7ccc8'],
    oracle:   ['#4a148c', '#e1bee7'],
    courier:  ['#0277bd', '#e3f2fd']
  };

  function getAgentColors(agentId, temperament) {
    var key = agentId.toLowerCase();
    if (AGENT_COLORS[key]) return AGENT_COLORS[key];
    var hash = 0;
    var s = (temperament || agentId || 'x');
    for (var i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) & 0xffff;
    var hue = hash % 360;
    return ['hsl(' + hue + ',65%,40%)', 'hsl(' + ((hue + 180) % 360) + ',30%,85%)'];
  }

  function buildCoatOfArms(agentId, emoji, temperament) {
    var colors = getAgentColors(agentId, temperament);
    var c1 = colors[0], c2 = colors[1];
    var clipId = 'shield-clip-' + agentId.replace(/[^a-z0-9]/gi, '_');
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80" viewBox="0 0 60 80">',
      '<defs><clipPath id="' + clipId + '">',
        '<path d="M2,2 L58,2 L58,48 Q58,70 30,78 Q2,70 2,48 Z"/>',
      '</clipPath></defs>',
      '<path d="M2,2 L58,2 L58,48 Q58,70 30,78 Q2,70 2,48 Z" fill="' + c1 + '" stroke="rgba(201,169,89,0.8)" stroke-width="1.5"/>',
      '<path d="M2,2 L30,2 L30,78 Q2,70 2,48 Z" fill="' + c2 + '" opacity="0.35" clip-path="url(#' + clipId + ')"/>',
      '<line x1="30" y1="2" x2="30" y2="75" stroke="rgba(201,169,89,0.5)" stroke-width="0.8"/>',
      '<line x1="2" y1="35" x2="58" y2="35" stroke="rgba(201,169,89,0.5)" stroke-width="0.8"/>',
      '<text x="30" y="42" text-anchor="middle" font-size="22" style="font-family:serif">' + (emoji || '\u2694') + '</text>',
      '</svg>'
    ].join('');
  }

  function formatTimeAgo(ts) {
    if (!ts) return '';
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function stars(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += (i < n) ? '\u2605' : '\u2606';
    return s;
  }

  function section(label, content) {
    return '<div class="pc-section"><div class="pc-section-label">' + label + '</div>' + content + '</div>';
  }

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── State ──────────────────────────────────────────────────────────────────
  var _currentAgent = null;
  var _refreshTimer = null;
  var _flavorCache = {};

  // ── Flavor fetch ───────────────────────────────────────────────────────────
  function fetchFlavor(agentId, cb) {
    var key = agentId.toLowerCase();
    if (_flavorCache[key] !== undefined) { cb(_flavorCache[key]); return; }
    fetch('personalities/' + key + '.md')
      .then(function(r){ return r.ok ? r.text() : ''; })
      .catch(function(){ return ''; })
      .then(function(txt){
        _flavorCache[key] = txt.trim();
        cb(_flavorCache[key]);
      });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderCard(agentId, flavor) {
    var state = null, personality = null;
    try { state = window.MedievalLifecycle.getAgentState(agentId); } catch(e){}
    try { personality = window.MedievalLifecycle.getPersonality(agentId); } catch(e){}
    state = state || {};
    personality = personality || {};

    var title = personality.title || 'Agent';
    var temperament = personality.temperament || 'Steady';
    var emoji = state.currentEmoji || '\u2694\uFE0F';
    var mood = typeof state.mood === 'number' ? state.mood : 0.5;
    var energy = typeof state.energy === 'number' ? state.energy : 0.5;
    var moodLabel = state.moodLabel || 'neutral';
    var conscience = state.conscience || 'independent';
    var trustTier = typeof state.trustTier === 'number' ? state.trustTier : 0;
    var lastQuestName = state.lastQuestName || null;
    var lastQuestTime = state.lastQuestTime || null;
    var preferredZones = personality.preferredZones || [];

    // Activity log
    var log = [];
    try {
      if (window._medievalMissionLog && Array.isArray(window._medievalMissionLog)) {
        var filtered = window._medievalMissionLog.filter(function(e){ return e && e.agentId === agentId; });
        log = filtered.slice(-5).reverse();
      }
    } catch(e){}

    var html = '';

    // Header
    html += '<div class="pc-header">';
    html += '<div>' + buildCoatOfArms(agentId, emoji, temperament) + '</div>';
    html += '<div class="pc-header-text"><p class="pc-agent-name">' + esc(agentId) + '</p><div class="pc-agent-title">' + esc(title) + '</div></div>';
    html += '<div class="pc-emoji-badge">' + emoji + '</div>';
    html += '</div>';

    // Stats
    var moodPct = Math.round(mood * 100);
    var energyPct = Math.round(energy * 100);
    html += section('\u2696\uFE0F Vitals',
      '<div class="pc-stat-row">' +
        '<div class="pc-stat-header"><span>Mood \u2014 ' + esc(moodLabel) + '</span><span>' + moodPct + '%</span></div>' +
        '<div class="pc-stat-bar"><div class="pc-stat-fill mood-' + esc(moodLabel) + '" style="width:' + moodPct + '%"></div></div>' +
      '</div>' +
      '<div class="pc-stat-row">' +
        '<div class="pc-stat-header"><span>Energy</span><span>' + energyPct + '%</span></div>' +
        '<div class="pc-stat-bar"><div class="pc-stat-fill energy" style="width:' + energyPct + '%"></div></div>' +
      '</div>'
    );

    // Quest
    var questHtml = lastQuestName
      ? '<div class="pc-quest-name">\uD83D\uDCDC ' + esc(lastQuestName) + '</div><div class="pc-quest-time">' + formatTimeAgo(lastQuestTime) + '</div>'
      : '<div class="pc-quest-name">\uD83C\uDFF0 Resting in the castle</div>';
    html += section('\u2694\uFE0F Current Quest', questHtml);

    // Personality
    var flavorHtml = flavor
      ? '<div class="pc-flavor">' + esc(flavor).slice(0, 300) + '</div>'
      : '<div class="pc-flavor" style="color:rgba(168,162,153,.4)"><em>No lore found.</em></div>';
    html += section('\uD83D\uDCD6 Personality', '<span class="pc-temperament">' + esc(temperament) + '</span>' + flavorHtml);

    // Conscience & Trust
    html += section('\uD83D\uDD2E Allegiance',
      '<div class="pc-conscience-row">' +
        '<span class="pc-conscience-badge ' + esc(conscience) + '">' + esc(conscience) + '</span>' +
        '<span style="font-size:11px;color:rgba(168,162,153,.7)">Conscience</span>' +
      '</div>' +
      '<div class="pc-trust-stars" title="Trust Tier ' + trustTier + '/5">' + stars(trustTier) + '</div>'
    );

    // Preferred Zones
    var zonesStr = preferredZones.length
      ? preferredZones.map(function(z){ return esc(z); }).join(', ')
      : '<em style="color:rgba(168,162,153,.4)">None recorded</em>';
    html += section('\uD83D\uDDFA\uFE0F Preferred Zones', '<div class="pc-zones">' + zonesStr + '</div>');

    // Activity Log
    var logHtml = '';
    if (log.length) {
      log.forEach(function(entry){
        logHtml += '<div class="pc-activity-item">' +
          '<span class="pc-activity-icon">\uD83D\uDCCB</span>' +
          '<span class="pc-activity-text">' + esc(entry.text) + '</span>' +
          '<span class="pc-activity-ts">' + formatTimeAgo(entry.ts) + '</span>' +
        '</div>';
      });
    } else {
      logHtml = '<div style="color:rgba(168,162,153,.4);font-size:11px;padding:4px 0">No recent activity.</div>';
    }
    html += section('\uD83D\uDCDC Activity Log', logHtml);

    body.innerHTML = html;
  }

  function loadCard(agentId) {
    _currentAgent = agentId;
    renderCard(agentId, _flavorCache[agentId.toLowerCase()] || '');
    fetchFlavor(agentId, function(flavor){
      if (_currentAgent === agentId) renderCard(agentId, flavor);
    });
  }

  // ── Refresh ────────────────────────────────────────────────────────────────
  function startRefresh() {
    clearRefresh();
    _refreshTimer = setInterval(function(){
      if (_currentAgent) loadCard(_currentAgent);
    }, 10000);
  }

  function clearRefresh() {
    if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
  }

  // ── Open / Close ───────────────────────────────────────────────────────────
  function openCard(agentId) {
    if (window.dismissAllOverlays) window.dismissAllOverlays('personaCard');
    var alreadyOpen = overlay.classList.contains('pc-visible');
    _currentAgent = agentId;
    if (!alreadyOpen) {
      overlay.classList.add('pc-visible');
      card.classList.add('pc-open');
    }
    loadCard(agentId);
    startRefresh();
  }

  function closeCard() {
    overlay.classList.remove('pc-visible');
    card.classList.remove('pc-open');
    clearRefresh();
    _currentAgent = null;
  }

  function isOpen() {
    return overlay.classList.contains('pc-visible');
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  closeBtn.addEventListener('click', closeCard);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) closeCard(); });

  // ── Public API ─────────────────────────────────────────────────────────────
  window.PersonaCard = { open: openCard, close: closeCard, isOpen: isOpen };

})();
