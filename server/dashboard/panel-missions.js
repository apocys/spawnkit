/**
 * MissionsPanel — Mission progress panel
 * Shows running/pending missions with progress bars and task counts.
 */
(function(global) {
  'use strict';

  let _listEl      = null;
  let _countEl     = null;
  let _panelEl     = null;
  let _prevData    = {};

  const STATUS_ORDER = { running: 0, planning: 1, pending: 2, done: 3, failed: 4, archived: 5 };

  // ── Helpers ───────────────────────────────────────────────

  function _statusLabel(status) {
    return (status || 'pending').charAt(0).toUpperCase() + (status || 'pending').slice(1);
  }

  function _progressFillClass(status) {
    if (status === 'done')   return 'fill-done';
    if (status === 'failed') return 'fill-failed';
    return '';
  }

  function _timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1)    return 'just now';
    if (m < 60)   return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24)   return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }

  function _tasksSummary(mission) {
    if (!mission.tasksTotal) return '';
    return mission.tasksDone + '/' + mission.tasksTotal + ' tasks';
  }

  function _agentsSummary(agents) {
    if (!agents || agents.length === 0) return '';
    if (agents.length === 1) return agents[0];
    if (agents.length <= 3)  return agents.join(', ');
    return agents[0] + ' +' + (agents.length - 1) + ' more';
  }

  // ── Render single card ────────────────────────────────────

  function _renderCard(mission, isNew) {
    const card = document.createElement('div');
    card.className = 'mission-card';
    card.dataset.missionId = mission.id;

    const pct         = Math.min(100, Math.max(0, mission.progress || 0));
    const fillClass   = _progressFillClass(mission.status);
    const tasksSummary  = _tasksSummary(mission);
    const agentsSummary = _agentsSummary(mission.agents);
    const timeLabel   = _timeAgo(mission.updatedAt || mission.startedAt);

    // Color accent line based on mission color or status
    const accentColor = mission.color || null;
    const borderStyle = accentColor ? `border-left: 3px solid ${accentColor};` : '';

    card.setAttribute('style', borderStyle);
    card.innerHTML = `
      <div class="mission-header-row">
        <span class="mission-name" title="${mission.name}">
          <span style="margin-right:5px">${mission.icon || '📋'}</span>${mission.name}
        </span>
        <span class="mission-status status-${mission.status}">${_statusLabel(mission.status)}</span>
      </div>
      <div class="mission-progress-bar">
        <div class="mission-progress-fill ${fillClass}" style="width:${pct}%"></div>
      </div>
      <div class="mission-footer-row">
        <span class="mission-pct">${pct}%</span>
        <span class="mission-tasks-label">${tasksSummary}</span>
        <span class="mission-agents" title="${agentsSummary}">${agentsSummary}</span>
        <span class="mission-tasks-label" style="color:var(--text-dim)">${timeLabel}</span>
      </div>
    `;

    if (isNew) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(6px)';
      requestAnimationFrame(() => {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '1';
        card.style.transform = 'none';
      });
    }

    return card;
  }

  // ── Update progress in-place ──────────────────────────────

  function _updateCard(card, mission) {
    const pct       = Math.min(100, Math.max(0, mission.progress || 0));
    const fill      = card.querySelector('.mission-progress-fill');
    const pctEl     = card.querySelector('.mission-pct');
    const statusEl  = card.querySelector('.mission-status');
    const taskEl    = card.querySelector('.mission-tasks-label');

    if (fill && fill.style.width !== pct + '%') {
      fill.style.width = pct + '%';
      fill.className   = 'mission-progress-fill ' + _progressFillClass(mission.status);
    }
    if (pctEl)   pctEl.textContent   = pct + '%';
    if (statusEl) {
      statusEl.textContent = _statusLabel(mission.status);
      statusEl.className   = 'mission-status status-' + mission.status;
    }
    if (taskEl)  taskEl.textContent  = _tasksSummary(mission);
  }

  // ── Public render ─────────────────────────────────────────

  function render(missions) {
    if (!_listEl) return;
    if (_panelEl) _panelEl.classList.remove('is-loading', 'is-error');

    if (!missions || missions.length === 0) {
      _listEl.innerHTML = `
        <div class="panel-error">
          <div class="error-icon">🗺️</div>
          <div>No missions yet</div>
        </div>`;
      if (_countEl) { _countEl.textContent = '0'; _countEl.classList.remove('badge-active'); }
      return;
    }

    // Sort by priority: running first, then planning, pending, done, failed, archived
    const sorted = missions.slice().sort((a, b) => {
      const ao = STATUS_ORDER[a.status] ?? 99;
      const bo = STATUS_ORDER[b.status] ?? 99;
      if (ao !== bo) return ao - bo;
      return (b.updatedAt || 0) - (a.updatedAt || 0); // newer first within same status
    });

    const activeCount = sorted.filter(m => m.status === 'running' || m.status === 'planning').length;

    // Smart update: diff existing
    const existingIds = new Set([..._listEl.querySelectorAll('.mission-card')].map(el => el.dataset.missionId));
    const newIds      = new Set(sorted.map(m => m.id));

    existingIds.forEach(id => {
      if (!newIds.has(id)) {
        const el = _listEl.querySelector(`[data-mission-id="${id}"]`);
        if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }
      }
    });

    sorted.forEach((mission, i) => {
      const existing = _listEl.querySelector(`[data-mission-id="${mission.id}"]`);
      const prevPct  = _prevData[mission.id]?.progress;
      const changed  = !_prevData[mission.id] || prevPct !== mission.progress || _prevData[mission.id].status !== mission.status;

      if (existing && !changed) {
        // no change — skip
      } else if (existing && changed) {
        _updateCard(existing, mission);
      } else {
        const card = _renderCard(mission, existingIds.size > 0);
        const children = _listEl.children;
        if (i < children.length) {
          _listEl.insertBefore(card, children[i]);
        } else {
          _listEl.appendChild(card);
        }
      }

      _prevData[mission.id] = { progress: mission.progress, status: mission.status };
    });

    // Clean prevData for removed missions
    Object.keys(_prevData).forEach(id => { if (!newIds.has(id)) delete _prevData[id]; });

    if (_countEl) {
      _countEl.textContent = sorted.length + (activeCount > 0 ? ` · ${activeCount} active` : '');
      _countEl.classList.toggle('badge-active', activeCount > 0);
    }
  }

  // ── Init ──────────────────────────────────────────────────

  function init() {
    _panelEl = document.getElementById('panel-missions');
    _listEl  = document.getElementById('missions-list');
    _countEl = document.getElementById('missions-active-count');

    if (!_panelEl) { console.error('[MissionsPanel] #panel-missions not found'); return; }

    if (_listEl) {
      _listEl.innerHTML = `
        <div class="skeleton"></div>
        <div class="skeleton" style="opacity:0.7;height:70px"></div>
        <div class="skeleton" style="opacity:0.5"></div>
      `;
    }
    _panelEl.classList.add('is-loading');

    DataStore.on('missions', ({ missions }) => render(missions));
  }

  global.MissionsPanel = { init, render };
})(window);
