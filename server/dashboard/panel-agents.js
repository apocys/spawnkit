/**
 * AgentsPanel — Live agent status panel
 * Renders agent cards with status dots, health indicators, last-seen timers.
 */
(function(global) {
  'use strict';

  const CHANNEL_EMOJI = {
    telegram:  '✈️',
    whatsapp:  '💬',
    discord:   '🎮',
    webchat:   '🌐',
    default:   '🤖',
  };

  const STATUS_LABEL = {
    active:  'Active',
    idle:    'Idle',
    offline: 'Offline',
    error:   'Error',
  };

  let _listEl       = null;
  let _countEl      = null;
  let _panelEl      = null;
  let _agentCount   = 0;
  let _tickTimer    = null;

  // ── Time formatting ───────────────────────────────────────

  function _relativeTime(ts) {
    if (!ts) return 'never';
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 5)   return 'just now';
    if (s < 60)  return s + 's ago';
    const m = Math.floor(s / 60);
    if (m < 60)  return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24)  return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }

  // ── Health ────────────────────────────────────────────────

  function _healthClass(health) {
    if (health >= 80) return 'health-ok';
    if (health >= 50) return 'health-warn';
    return 'health-error';
  }

  // ── Avatar letter ─────────────────────────────────────────

  function _avatarLetter(name) {
    return (name || '?').replace(/^whatsapp:.*|^telegram:.*/, '').trim().charAt(0).toUpperCase() || '?';
  }

  function _shortName(name) {
    // Strip channel prefix like "whatsapp:g-name" → "G-name"
    const clean = name.replace(/^(telegram|whatsapp|discord|webchat):g?-?/, '');
    if (clean.length > 22) return clean.slice(0, 20) + '…';
    return clean || name;
  }

  // ── Render a single agent card ────────────────────────────

  function _renderCard(agent, isUpdate) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.dataset.agentId = agent.id;

    const chanClass = 'channel-' + (agent.channel || 'default');
    const statusClass = 'agent-status--' + (agent.status || 'idle');
    const healthCls = _healthClass(agent.health);
    const taskText  = agent.task || 'Idle';
    const taskClass = agent.task ? '' : 'task-none';
    const emoji     = CHANNEL_EMOJI[agent.channel] || CHANNEL_EMOJI.default;

    card.innerHTML = `
      <div class="agent-avatar ${chanClass}">
        <span>${emoji}</span>
        <span class="agent-status ${statusClass}" title="${STATUS_LABEL[agent.status] || 'Unknown'}"></span>
      </div>
      <div class="agent-info">
        <div class="agent-name" title="${agent.name}">${_shortName(agent.name)}</div>
        <div class="agent-role">${agent.model || agent.role || 'agent'}</div>
        <div class="agent-task ${taskClass}" title="${taskText}">${taskText}</div>
      </div>
      <div class="agent-meta">
        <span class="agent-last-seen" data-ts="${agent.lastSeen}">${_relativeTime(agent.lastSeen)}</span>
        <span class="agent-health ${healthCls}">${agent.health || 0}%</span>
      </div>
    `;

    if (isUpdate) {
      card.style.opacity = '0';
      card.style.transform = 'translateX(-8px)';
      requestAnimationFrame(() => {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '1';
        card.style.transform = 'none';
      });
    }

    return card;
  }

  // ── Update timestamps in place ────────────────────────────

  function _updateTimestamps() {
    if (!_listEl) return;
    _listEl.querySelectorAll('[data-ts]').forEach(el => {
      const ts = parseInt(el.dataset.ts, 10);
      if (ts) el.textContent = _relativeTime(ts);
    });
  }

  // ── Public render ─────────────────────────────────────────

  function render(agents) {
    if (!_listEl) return;

    // Remove loading skeleton
    if (_panelEl) _panelEl.classList.remove('is-loading', 'is-error');

    if (!agents || agents.length === 0) {
      _listEl.innerHTML = `
        <div class="panel-error">
          <div class="error-icon">🤖</div>
          <div>No agents found</div>
        </div>`;
      if (_countEl) { _countEl.textContent = '0'; _countEl.classList.remove('badge-active'); }
      return;
    }

    // Sort: active first, then idle, then offline/error
    const sorted = agents.slice().sort((a, b) => {
      const order = { active: 0, idle: 1, error: 2, offline: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });

    const activeCount = sorted.filter(a => a.status === 'active').length;
    const isUpdate    = _agentCount > 0 && _agentCount !== sorted.length;
    _agentCount       = sorted.length;

    // Smart diff: only re-render changed cards
    const existingIds = new Set([..._listEl.querySelectorAll('.agent-card')].map(el => el.dataset.agentId));
    const newIds      = new Set(sorted.map(a => a.id));

    // Remove gone agents
    existingIds.forEach(id => {
      if (!newIds.has(id)) {
        const el = _listEl.querySelector(`[data-agent-id="${id}"]`);
        if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }
      }
    });

    sorted.forEach((agent, i) => {
      const existing = _listEl.querySelector(`[data-agent-id="${agent.id}"]`);
      if (existing) {
        // Update status dot, task, health in-place (no full re-render jank)
        const dot = existing.querySelector('.agent-status');
        if (dot) dot.className = 'agent-status agent-status--' + (agent.status || 'idle');
        const task = existing.querySelector('.agent-task');
        if (task) {
          task.textContent = agent.task || 'Idle';
          task.className = 'agent-task' + (agent.task ? '' : ' task-none');
          task.title = agent.task || 'Idle';
        }
        const health = existing.querySelector('.agent-health');
        if (health) {
          health.textContent = (agent.health || 0) + '%';
          health.className = 'agent-health ' + _healthClass(agent.health);
        }
      } else {
        const card = _renderCard(agent, isUpdate);
        // Insert at correct sorted position
        const children = _listEl.children;
        if (i < children.length) {
          _listEl.insertBefore(card, children[i]);
        } else {
          _listEl.appendChild(card);
        }
      }
    });

    // Update badge
    if (_countEl) {
      _countEl.textContent = sorted.length + (activeCount > 0 ? ` · ${activeCount} active` : '');
      _countEl.classList.toggle('badge-active', activeCount > 0);
    }
  }

  // ── Init ──────────────────────────────────────────────────

  function init() {
    _panelEl  = document.getElementById('panel-agents');
    _listEl   = document.getElementById('agents-list');
    _countEl  = document.getElementById('agents-count');

    if (!_panelEl) { console.error('[AgentsPanel] #panel-agents not found'); return; }

    // Show loading skeletons
    if (_listEl) {
      _listEl.innerHTML = `
        <div class="skeleton"></div>
        <div class="skeleton" style="opacity:0.7"></div>
        <div class="skeleton" style="opacity:0.5"></div>
      `;
    }
    _panelEl.classList.add('is-loading');

    // Tick relative timestamps every 30s
    _tickTimer = setInterval(_updateTimestamps, 30000);

    // Subscribe to DataStore
    DataStore.on('agents', ({ agents }) => render(agents));
  }

  global.AgentsPanel = { init, render };
})(window);
