/**
 * Mission Orchestrator — Real agent-mission binding
 *
 * Manages mission lifecycle:
 *   create → activate → monitor → complete/fail
 *
 * When a mission is activated:
 *   1. Sends task brief to each assigned agent via OpenClaw gateway
 *   2. Creates a mission-scoped chat context
 *   3. Polls agent sessions for progress
 *   4. Logs all events (activation, messages, status changes, completion)
 *
 * Storage: filesystem (JSON) per mission in WORKSPACE/.spawnkit-missions/
 */

const fs = require('fs');
const path = require('path');

class MissionOrchestrator {
  constructor({ workspace, gatewayUrl, gatewayToken, sessionsFile }) {
    this.workspace = workspace;
    this.gatewayUrl = gatewayUrl;
    this.gatewayToken = gatewayToken;
    this.sessionsFile = sessionsFile;
    this.missionsDir = path.join(workspace, '.spawnkit-missions');
    this.missionsFile = path.join(workspace, '.spawnkit-missions.json');
    this.pollers = new Map(); // missionId → interval
    if (!fs.existsSync(this.missionsDir)) fs.mkdirSync(this.missionsDir, { recursive: true });
  }

  // ── Read / Write missions ─────────────────────────────────
  getMissions() {
    try {
      return JSON.parse(fs.readFileSync(this.missionsFile, 'utf8'));
    } catch { return []; }
  }

  saveMissions(missions) {
    fs.writeFileSync(this.missionsFile, JSON.stringify(missions, null, 2));
  }

  getMission(id) {
    return this.getMissions().find(m => m.id === id) || null;
  }

  updateMission(id, updates) {
    const missions = this.getMissions();
    const idx = missions.findIndex(m => m.id === id);
    if (idx < 0) return null;
    Object.assign(missions[idx], updates, { updated: new Date().toISOString() });
    this.saveMissions(missions);
    return missions[idx];
  }

  // ── Event log per mission ─────────────────────────────────
  _logPath(missionId) {
    return path.join(this.missionsDir, missionId + '.log.jsonl');
  }

  logEvent(missionId, type, data) {
    const entry = { ts: new Date().toISOString(), type, ...data };
    fs.appendFileSync(this._logPath(missionId), JSON.stringify(entry) + '\n');
    return entry;
  }

  getLog(missionId, last = 50) {
    try {
      const lines = fs.readFileSync(this._logPath(missionId), 'utf8').trim().split('\n');
      return lines.slice(-last).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }

  // ── Mission chat (stored per-mission) ─────────────────────
  _chatPath(missionId) {
    return path.join(this.missionsDir, missionId + '.chat.jsonl');
  }

  getChatHistory(missionId, last = 50) {
    try {
      const lines = fs.readFileSync(this._chatPath(missionId), 'utf8').trim().split('\n');
      return lines.slice(-last).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }

  appendChat(missionId, role, content, agent = null) {
    const msg = { ts: new Date().toISOString(), role, content, agent };
    fs.appendFileSync(this._chatPath(missionId), JSON.stringify(msg) + '\n');
    return msg;
  }

  // ── Activate mission — send briefs to agents ──────────────
  async activate(missionId) {
    const mission = this.getMission(missionId);
    if (!mission) throw new Error('Mission not found: ' + missionId);
    if (!mission.agents || mission.agents.length === 0) throw new Error('No agents assigned');

    // Build task brief
    const taskList = (mission.tasks || []).map((t, i) => `${i + 1}. ${t.text}`).join('\n') || '(No specific tasks defined)';
    const brief = [
      `🏰 MISSION BRIEF: ${mission.name}`,
      mission.description ? `\nDescription: ${mission.description}` : '',
      `\nTasks:\n${taskList}`,
      `\nStatus: ${mission.status}`,
      `\nReport progress and completion by including [Mission: ${mission.name}] in your messages.`,
    ].join('');

    this.logEvent(missionId, 'activate', { agents: mission.agents, brief: brief.substring(0, 200) });

    // Send brief to each assigned agent
    const results = [];
    for (const agentName of mission.agents) {
      try {
        const resp = await this._sendToAgent(agentName, brief);
        results.push({ agent: agentName, ok: true, reply: resp });
        this.appendChat(missionId, 'system', `📜 Brief sent to ${agentName}`, agentName);
        this.logEvent(missionId, 'brief_sent', { agent: agentName });
      } catch (e) {
        results.push({ agent: agentName, ok: false, error: e.message });
        this.logEvent(missionId, 'brief_error', { agent: agentName, error: e.message });
      }
    }

    // Update mission status
    this.updateMission(missionId, { status: 'active', activatedAt: new Date().toISOString() });

    // Start polling for progress
    this._startPolling(missionId);

    return { ok: true, results };
  }

  // ── Send a mission-scoped chat message ────────────────────
  async sendChat(missionId, message, targetAgent = null) {
    const mission = this.getMission(missionId);
    if (!mission) throw new Error('Mission not found');

    // Store in mission chat
    this.appendChat(missionId, 'user', message);

    // Prefix message with mission context
    const scopedMsg = `[Mission: ${mission.name}] ${message}`;

    // Send to specific agent or all assigned agents
    const agents = targetAgent ? [targetAgent] : (mission.agents || []);
    const results = [];
    for (const agentName of agents) {
      try {
        const reply = await this._sendToAgent(agentName, scopedMsg);
        this.appendChat(missionId, 'assistant', reply, agentName);
        results.push({ agent: agentName, ok: true, reply });
      } catch (e) {
        results.push({ agent: agentName, ok: false, error: e.message });
      }
    }

    return { ok: true, results };
  }

  // ── Get live mission status with session data ─────────────
  getStatus(missionId) {
    const mission = this.getMission(missionId);
    if (!mission) return null;

    // Read current sessions
    const sessions = this._getSessions();
    const agentStatuses = (mission.agents || []).map(agentName => {
      const agentLower = agentName.toLowerCase();
      // Find matching sessions (main or sub-agent)
      const matching = sessions.filter(s => {
        const label = (s.label || s.key || '').toLowerCase();
        return label.includes(agentLower);
      });
      const active = matching.some(s => s.status === 'active');
      const lastActive = matching.reduce((latest, s) => {
        return s.lastActive > latest ? s.lastActive : latest;
      }, 0);
      return {
        agent: agentName,
        status: active ? 'working' : 'idle',
        sessions: matching.length,
        lastActive: lastActive || null,
        action: matching.find(s => s.status === 'active')?.action || 'idle',
      };
    });

    // Calculate progress from tasks
    const tasks = mission.tasks || [];
    const done = tasks.filter(t => t.done).length;
    const total = tasks.length;

    return {
      id: mission.id,
      name: mission.name,
      status: mission.status,
      activatedAt: mission.activatedAt || null,
      agents: agentStatuses,
      progress: { done, total, percent: total > 0 ? Math.round(done / total * 100) : 0 },
      lastEvent: this.getLog(missionId, 1)[0] || null,
    };
  }

  // ── Internal: send message to agent via gateway ───────────
  async _sendToAgent(agentName, message) {
    // Try sending to main session with agent prefix
    const prefixedMsg = `[Speaking to ${agentName}] ${message}`;
    const resp = await fetch(this.gatewayUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.gatewayToken,
      },
      body: JSON.stringify({
        model: 'openclaw',
        messages: [{ role: 'user', content: prefixedMsg }],
        stream: false,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gateway error ${resp.status}: ${errText.substring(0, 200)}`);
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || '(No response)';
  }

  // ── Internal: read sessions from file ─────────────────────
  _getSessions() {
    try {
      const data = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf8'));
      const sessions = data.sessions || data;
      if (typeof sessions !== 'object') return [];
      return Object.entries(sessions).map(([key, s]) => ({
        key,
        label: s.label || s.displayName || key.split(':').pop(),
        status: (Date.now() - (s.updatedAt || 0)) < 300000 ? 'active' : 'idle',
        lastActive: s.updatedAt || null,
        action: s.task || 'idle',
      }));
    } catch { return []; }
  }

  // ── Polling: check agent progress periodically ────────────
  _startPolling(missionId) {
    if (this.pollers.has(missionId)) return;
    const interval = setInterval(() => {
      try {
        const status = this.getStatus(missionId);
        if (!status) { this._stopPolling(missionId); return; }

        // Check if all tasks are done
        if (status.progress.total > 0 && status.progress.done === status.progress.total) {
          this.logEvent(missionId, 'auto_complete', { progress: status.progress });
          this.updateMission(missionId, { status: 'done' });
          this._stopPolling(missionId);
        }

        // Log periodic status
        const anyActive = status.agents.some(a => a.status === 'working');
        if (anyActive) {
          this.logEvent(missionId, 'poll', {
            activeAgents: status.agents.filter(a => a.status === 'working').map(a => a.agent),
            progress: status.progress,
          });
        }
      } catch (e) {
        console.error('[MissionOrch] Poll error for', missionId, ':', e.message);
      }
    }, 30000); // Every 30 seconds
    this.pollers.set(missionId, interval);
  }

  _stopPolling(missionId) {
    const interval = this.pollers.get(missionId);
    if (interval) { clearInterval(interval); this.pollers.delete(missionId); }
  }

  // ── Resume polling for active missions on startup ─────────
  resumeActivePolling() {
    const missions = this.getMissions();
    missions.forEach(m => {
      if (m.status === 'active' && m.activatedAt) {
        console.log('[MissionOrch] Resuming polling for:', m.name);
        this._startPolling(m.id);
      }
    });
  }
}

module.exports = MissionOrchestrator;
