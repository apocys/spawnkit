(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function escMc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getState() {
    try {
      var raw = localStorage.getItem('fleetkit_state');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem('fleetkit_state', JSON.stringify(state));
    } catch (e) {}
  }

  function getUsername() {
    return localStorage.getItem('spawnkit-username') || 'User';
  }

  function getAvatarLetter(name) {
    return escMc(String(name || 'U').charAt(0).toUpperCase());
  }

  function truncate(str, max) {
    str = String(str || '');
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  function genId() {
    return 'mission-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  }

  // ── State ──────────────────────────────────────────────────────────────────

  var _activeMissionId = null;
  var _currentSessions = [];
  var _searchActive = false;
  var _newMissionFormActive = false;

  // ── DOM refs ───────────────────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }

  // ── Top Actions ────────────────────────────────────────────────────────────

  function renderActions(container) {
    var existing = container.querySelector('.mc-sl-actions');
    if (existing) return; // already rendered once; buttons are static

    var div = document.createElement('div');
    div.className = 'mc-sl-actions';
    div.innerHTML =
      '<button class="mc-sl-btn" id="mcNewMission">+ New Mission</button>' +
      '<button class="mc-sl-btn" id="mcSearch">&#128269; Search</button>' +
      '<button class="mc-sl-btn" id="mcCustomize">&#9881; Customize</button>';
    container.insertBefore(div, container.firstChild);

    document.getElementById('mcNewMission').addEventListener('click', onNewMission);
    document.getElementById('mcSearch').addEventListener('click', onToggleSearch);
    document.getElementById('mcCustomize').addEventListener('click', onCustomize);
  }

  // ── New Mission ────────────────────────────────────────────────────────────

  function onNewMission() {
    var historyList = el('mcHistoryList');
    if (!historyList) return;

    if (_newMissionFormActive) {
      // Already open — remove and reset
      var existing = historyList.querySelector('.mc-sl-new-mission-form');
      if (existing) existing.parentNode.removeChild(existing);
      _newMissionFormActive = false;
      return;
    }

    _newMissionFormActive = true;

    var form = document.createElement('div');
    form.className = 'mc-sl-new-mission-form';
    form.innerHTML =
      '<input class="mc-sl-new-mission-input" type="text" placeholder="Mission name…" maxlength="80" />' +
      '<div class="mc-sl-new-mission-actions">' +
        '<button class="mc-sl-btn" id="mcNewMissionSubmit">Create</button>' +
        '<button class="mc-sl-btn" id="mcNewMissionCancel">Cancel</button>' +
      '</div>';

    historyList.insertBefore(form, historyList.firstChild);

    var input = form.querySelector('.mc-sl-new-mission-input');
    input.focus();

    document.getElementById('mcNewMissionSubmit').addEventListener('click', function () {
      submitNewMission(input.value);
    });

    document.getElementById('mcNewMissionCancel').addEventListener('click', function () {
      if (form.parentNode) form.parentNode.removeChild(form);
      _newMissionFormActive = false;
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submitNewMission(input.value);
      if (e.key === 'Escape') {
        if (form.parentNode) form.parentNode.removeChild(form);
        _newMissionFormActive = false;
      }
    });
  }

  function submitNewMission(rawName) {
    var name = String(rawName || '').trim();
    if (!name) return;

    var state = getState();
    if (!Array.isArray(state.missions)) state.missions = [];

    var mission = {
      id: genId(),
      name: name,
      createdAt: Date.now(),
      status: 'active'
    };

    state.missions.unshift(mission);
    saveState(state);

    // Remove form
    var historyList = el('mcHistoryList');
    if (historyList) {
      var form = historyList.querySelector('.mc-sl-new-mission-form');
      if (form && form.parentNode) form.parentNode.removeChild(form);
    }
    _newMissionFormActive = false;

    // Refresh
    if (typeof window.mcRefresh === 'function') window.mcRefresh();
    renderHistory(_currentSessions);

    // Auto-select the new mission
    selectMission(mission.id, mission.name);
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  function onToggleSearch() {
    var historyList = el('mcHistoryList');
    if (!historyList) return;

    var existingSearch = historyList.querySelector('.mc-sl-search-bar');

    if (_searchActive && existingSearch) {
      existingSearch.parentNode.removeChild(existingSearch);
      _searchActive = false;
      renderHistory(_currentSessions); // restore full list
      return;
    }

    _searchActive = true;

    var bar = document.createElement('div');
    bar.className = 'mc-sl-search-bar';
    bar.innerHTML = '<input class="mc-sl-search-input" type="text" placeholder="Search missions…" />';
    historyList.insertBefore(bar, historyList.firstChild);

    var input = bar.querySelector('.mc-sl-search-input');
    input.focus();

    input.addEventListener('input', function () {
      filterHistory(input.value);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        bar.parentNode.removeChild(bar);
        _searchActive = false;
        renderHistory(_currentSessions);
      }
    });
  }

  function filterHistory(query) {
    var items = el('mcHistoryList') ? el('mcHistoryList').querySelectorAll('.mc-sl-history-item') : [];
    var q = String(query || '').toLowerCase();
    for (var i = 0; i < items.length; i++) {
      var text = items[i].textContent.toLowerCase();
      items[i].style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
    }
  }

  // ── Customize ──────────────────────────────────────────────────────────────

  function onCustomize() {
    if (window.SkillForge) window.SkillForge.open();
  }

  // ── History List ───────────────────────────────────────────────────────────

  function renderHistory(sessions) {
    var historyList = el('mcHistoryList');
    if (!historyList) return;

    // Clear existing history items + label (but keep search bar / form if present)
    var toRemove = historyList.querySelectorAll('.mc-sl-history-item, .mc-sl-section-label');
    for (var r = 0; r < toRemove.length; r++) {
      toRemove[r].parentNode.removeChild(toRemove[r]);
    }

    // Build combined list: missions from localStorage + passed-in sessions
    var state = getState();
    var missions = Array.isArray(state.missions) ? state.missions : [];

    var label = document.createElement('div');
    label.className = 'mc-sl-section-label';
    label.textContent = 'Recent';
    historyList.appendChild(label);

    // Render localStorage missions
    for (var m = 0; m < missions.length; m++) {
      historyList.appendChild(buildHistoryItem(missions[m].id, missions[m].name));
    }

    // Render session items (deduplicate by id vs missions)
    var missionIds = {};
    for (var mm = 0; mm < missions.length; mm++) missionIds[missions[mm].id] = true;

    if (Array.isArray(sessions)) {
      for (var s = 0; s < sessions.length; s++) {
        var sess = sessions[s];
        var sid = sess.id || sess.sessionId || ('sess-' + s);
        if (missionIds[sid]) continue; // already listed
        var sname = sess.name || sess.title || sess.label || ('Session ' + (s + 1));
        historyList.appendChild(buildHistoryItem(sid, sname));
      }
    }
  }

  function buildHistoryItem(id, name) {
    var item = document.createElement('div');
    item.className = 'mc-sl-history-item' + (id === _activeMissionId ? ' active' : '');
    item.setAttribute('data-mission-id', escMc(id));
    item.textContent = truncate(name, 36);
    item.addEventListener('click', function () {
      selectMission(id, name);
    });
    return item;
  }

  function selectMission(id, name) {
    _activeMissionId = id;

    // Update active class
    var items = document.querySelectorAll('.mc-sl-history-item');
    for (var i = 0; i < items.length; i++) {
      var iid = items[i].getAttribute('data-mission-id');
      if (iid === id) {
        items[i].className = 'mc-sl-history-item active';
      } else {
        items[i].className = 'mc-sl-history-item';
      }
    }

    // Dispatch selection event
    var evt;
    try {
      evt = new CustomEvent('mc:select-mission', { detail: { id: id, name: name } });
    } catch (e) {
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('mc:select-mission', true, true, { id: id, name: name });
    }
    document.dispatchEvent(evt);
  }

  // ── User Footer ────────────────────────────────────────────────────────────

  function renderFooter() {
    var footer = el('mcUserFooter');
    if (!footer) return;

    var username = getUsername();
    var avatarLetter = getAvatarLetter(username);

    footer.className = 'mc-sl-footer';
    footer.innerHTML =
      '<div class="mc-sl-avatar">' + avatarLetter + '</div>' +
      '<div class="mc-sl-user-info">' +
        '<div class="mc-sl-username">' + escMc(username) + '</div>' +
        '<div class="mc-sl-plan">Pro Plan</div>' +
      '</div>' +
      '<div class="mc-sl-footer-icons">' +
        '<button class="mc-sl-footer-icon" title="Settings" onclick="if(window.openSettings)window.openSettings()">&#9881;</button>' +
        '<button class="mc-sl-footer-icon" title="Logout" onclick="localStorage.clear();location.reload()">&#9167;</button>' +
      '</div>';
  }

  // ── Main Render ────────────────────────────────────────────────────────────

  function render(sessions) {
    _currentSessions = sessions || [];

    var container = el('mcSideLeft');
    if (!container) return;

    renderActions(container);
    renderHistory(_currentSessions);
    renderFooter();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    render([]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.McSidebarLeft = {
    render: function (sessions) {
      render(sessions);
    }
  };

})();
