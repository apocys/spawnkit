/**
 * Mission Orchestrator — Real agent-mission binding
 *
 * Manages mission lifecycle:
 *   create → activate → monitor → complete/fail
 *
 * When a mission is activated:
 *   1. Auto-generates tasks from mission description via gateway
 *   2. Creates a persistent session per mission for chat context
 *   3. Sends task brief to each assigned agent
 *   4. Polls agent sessions for progress
 *   5. Logs all events (activation, messages, status changes, completion)
 *
 * Storage: filesystem (JSONL per mission in WORKSPACE/.spawnkit-missions/)
 *
 * v3 Fixes:
 *   - Fix 1: Auto-generate tasks on activation
 *   - Fix 2: Increased timeouts (60s activate, 45s chat)
 *   - Fix 3: Persistent mission sessions with full context
 *   - Fix 4: Progress tracking from task completion
 */

const fs = require('fs');
const path = require('path');

const ACTIVATE_TIMEOUT_MS = 60000;
const CHAT_TIMEOUT_MS = 45000;
const TASK_GEN_TIMEOUT_MS = 45000;

class MissionOrchestrator {
  constructor({ workspace, gatewayUrl, gatewayToken, sessionsFile }) {
    this.workspace = workspace;
    this.gatewayUrl = gatewayUrl;
    this.gatewayToken = gatewayToken;
    this.sessionsFile = sessionsFile;
    this.missionsDir = path.join(workspace, '.spawnkit-missions');
    this.missionsFile = path.join(workspace, '.spawnkit-missions.json');
    this.pollers = new Map(); // missionId → interval
    this.missionSessions = new Map(); // missionId → sessionKey
    if (!fs.existsSync(this.missionsDir)) fs.mkdirSync(this.missionsDir, { recursive: true });
  }

  // ── Read / Write missions (atomic) ────────────────────────
  getMissions() {
    try {
      return JSON.parse(fs.readFileSync(this.missionsFile, 'utf8'));
    } catch { return []; }
  }

  saveMissions(missions) {
    const tmp = this.missionsFile + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(missions, null, 2));
    fs.renameSync(tmp, this.missionsFile);
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

  // ── File paths per mission ────────────────────────────────
  _paths(missionId) {
    return {
      log: path.join(this.missionsDir, missionId + '.log.jsonl'),
      chat: path.join(this.missionsDir, missionId + '.chat.jsonl'),
    };
  }

  // ── Event log per mission ─────────────────────────────────
  logEvent(missionId, type, data) {
    const entry = { ts: new Date().toISOString(), type, ...data };
    try {
      fs.appendFileSync(this._paths(missionId).log, JSON.stringify(entry) + '\n');
    } catch (e) {
      console.error('[MissionOrch] Failed to write log for', missionId, ':', e.message);
    }
    return entry;
  }

  getLog(missionId, last = 50) {
    try {
      const content = fs.readFileSync(this._paths(missionId).log, 'utf8').trim();
      if (!content) return [];
      return content.split('\n').slice(-last).map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
    } catch { return []; }
  }

  // ── Mission chat (stored per-mission) ─────────────────────
  getChatHistory(missionId, last = 50) {
    try {
      const content = fs.readFileSync(this._paths(missionId).chat, 'utf8').trim();
      if (!content) return [];
      return content.split('\n').slice(-last).map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
    } catch { return []; }
  }

  appendChat(missionId, role, content, agent = null) {
    const msg = { ts: new Date().toISOString(), role, content, agent };
    try {
      fs.appendFileSync(this._paths(missionId).chat, JSON.stringify(msg) + '\n');
    } catch (e) {
      console.error('[MissionOrch] Failed to write chat for', missionId, ':', e.message);
    }
    return msg;
  }

  // ── FIX 1: Auto-generate tasks from mission description ───
  async _generateTasks(mission) {
    const prompt = `You are a task decomposition assistant. Given a mission name and description, break it down into 3-7 concrete, actionable sub-tasks.

Mission: ${mission.name}
${mission.description ? 'Description: ' + mission.description : ''}
${mission.agents && mission.agents.length ? 'Assigned agents: ' + mission.agents.join(', ') : ''}

Respond with ONLY a JSON array of task strings, nothing else. Example:
["Research competitors", "Design landing page wireframe", "Implement hero section"]

Keep tasks specific and actionable. Each task should be completable independently.`;

    try {
      const response = await this._callGateway(prompt, TASK_GEN_TIMEOUT_MS);
      // Parse JSON array from response — handle markdown code blocks
      let cleaned = response.trim();
      // Strip markdown code fences if present
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const tasks = JSON.parse(cleaned);
      if (Array.isArray(tasks) && tasks.length > 0) {
        return tasks.map(t => ({ text: String(t), done: false }));
      }
    } catch (e) {
      console.error('[MissionOrch] Task generation failed:', e.message);
      // Fallback: create a single task from the mission name
    }
    return [{ text: `Complete: ${mission.name}`, done: false }];
  }

  // ── FIX 3: Create persistent session for a mission ────────
  async _getOrCreateMissionSession(missionId) {
    // Check if we already have a session for this mission
    if (this.missionSessions.has(missionId)) {
      return this.missionSessions.get(missionId);
    }

    // Check if session key is stored in mission data
    const mission = this.getMission(missionId);
    if (mission?.sessionKey) {
      this.missionSessions.set(missionId, mission.sessionKey);
      return mission.sessionKey;
    }

    // Create a new persistent session via gateway
    try {
      const taskList = (mission.tasks || []).map((t, i) =>
        `${i + 1}. ${t.done ? '✅' : '☐'} ${t.text}`
      ).join('\n') || '(Tasks will be generated)';

      const systemPrompt = [
        `🏰 MISSION SESSION: ${mission.name}`,
        mission.description ? `\nDescription: ${mission.description}` : '',
        `\nAssigned agents: ${(mission.agents || []).join(', ')}`,
        `\nTasks:\n${taskList}`,
        `\nYou are operating in the context of this specific mission.`,
        `Focus ONLY on this mission's objectives.`,
        `When a task is complete, say: [Task done: <task number>]`,
        `Report progress clearly.`,
      ].join('');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ACTIVATE_TIMEOUT_MS);

      const resp = await fetch(this.gatewayUrl + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.gatewayToken,
        },
        body: JSON.stringify({
          model: 'openclaw',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Mission "${mission.name}" activated. Acknowledge and confirm your understanding of the tasks.` },
          ],
          stream: false,
          // Request a persistent session
          metadata: {
            sessionLabel: `mission-${missionId}`,
            persistent: true,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`Gateway error ${resp.status}`);
      }

      const data = await resp.json();
      // Try to extract session key from response headers or data
      const sessionKey = data?.metadata?.sessionKey || data?.session_key || `mission-${missionId}`;
      this.missionSessions.set(missionId, sessionKey);
      this.updateMission(missionId, { sessionKey });

      return sessionKey;
    } catch (e) {
      console.error('[MissionOrch] Failed to create mission session:', e.message);
      return null;
    }
  }

  // ── Build mission context string ──────────────────────────
  _buildMissionContext(mission) {
    const taskList = (mission.tasks || []).map((t, i) =>
      `${i + 1}. ${t.done ? '✅' : '☐'} ${t.text}`
    ).join('\n') || '(No tasks)';

    const done = (mission.tasks || []).filter(t => t.done).length;
    const total = (mission.tasks || []).length;

    return [
      `--- MISSION CONTEXT ---`,
      `Name: ${mission.name}`,
      mission.description ? `Description: ${mission.description}` : null,
      `Agents: ${(mission.agents || []).join(', ')}`,
      `Status: ${mission.status}`,
      `Progress: ${done}/${total} tasks done`,
      `Tasks:`,
      taskList,
      `--- END MISSION CONTEXT ---`,
    ].filter(Boolean).join('\n');
  }

  // ── Activate mission ──────────────────────────────────────
  async activate(missionId) {
    const mission = this.getMission(missionId);
    if (!mission) throw new Error('Mission not found: ' + missionId);
    if (!mission.agents || mission.agents.length === 0) throw new Error('No agents assigned');

    this.logEvent(missionId, 'activate_start', { agents: mission.agents });

    // FIX 1: Auto-generate tasks if none exist
    if (!mission.tasks || mission.tasks.length === 0) {
      this.appendChat(missionId, 'system', '🧠 Generating tasks from mission description...');
      const tasks = await this._generateTasks(mission);
      this.updateMission(missionId, { tasks });
      mission.tasks = tasks;
      this.logEvent(missionId, 'tasks_generated', { count: tasks.length, tasks: tasks.map(t => t.text) });
      this.appendChat(missionId, 'system', `📋 Generated ${tasks.length} tasks:\n${tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n')}`);
    }

    // Build task brief with full context
    const context = this._buildMissionContext(mission);
    const brief = [
      `🏰 MISSION BRIEF: ${mission.name}`,
      mission.description ? `\nDescription: ${mission.description}` : '',
      `\nTasks:\n${mission.tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n')}`,
      `\n\nYou are working on THIS mission specifically. Focus only on these tasks.`,
      `Report progress by saying: [Task done: <task number>]`,
      `When all tasks are complete, say: [Mission complete]`,
    ].join('');

    this.logEvent(missionId, 'activate', { agents: mission.agents, taskCount: mission.tasks.length });

    // FIX 3: Create persistent session for this mission
    await this._getOrCreateMissionSession(missionId);

    // Send brief to each assigned agent
    const results = [];
    for (const agentName of mission.agents) {
      try {
        const resp = await this._sendToAgent(agentName, brief, ACTIVATE_TIMEOUT_MS);
        results.push({ agent: agentName, ok: true, reply: resp });
        this.appendChat(missionId, 'system', `📜 Brief sent to ${agentName}`, agentName);
        this.logEvent(missionId, 'brief_sent', { agent: agentName });
      } catch (e) {
        results.push({ agent: agentName, ok: false, error: e.message });
        this.logEvent(missionId, 'brief_error', { agent: agentName, error: e.message });
        this.appendChat(missionId, 'error', `❌ Failed to reach ${agentName}: ${e.message}`, agentName);
      }
    }

    const anySuccess = results.some(r => r.ok);
    if (anySuccess) {
      this.updateMission(missionId, { status: 'active', activatedAt: new Date().toISOString() });
      this._startPolling(missionId);
    } else {
      this.logEvent(missionId, 'activate_failed', { reason: 'All agents unreachable' });
    }

    return { ok: anySuccess, partial: anySuccess && results.some(r => !r.ok), results, tasks: mission.tasks };
  }

  // ── FIX 3: Send mission-scoped chat with persistent context ─
  async sendChat(missionId, message, targetAgent = null) {
    const mission = this.getMission(missionId);
    if (!mission) throw new Error('Mission not found');

    this.appendChat(missionId, 'user', message);

    // Build full context for every message
    const context = this._buildMissionContext(mission);
    const scopedMsg = `${context}\n\nUser message: ${message}`;

    const agents = targetAgent ? [targetAgent] : (mission.agents || []);
    const results = [];
    for (const agentName of agents) {
      try {
        const reply = await this._sendToAgent(agentName, scopedMsg, CHAT_TIMEOUT_MS);
        this.appendChat(missionId, 'assistant', reply, agentName);

        // FIX 4: Parse task completions from agent replies
        this._parseTaskCompletions(missionId, reply);

        results.push({ agent: agentName, ok: true, reply });
      } catch (e) {
        this.appendChat(missionId, 'error', `❌ ${agentName} unreachable: ${e.message}`, agentName);
        results.push({ agent: agentName, ok: false, error: e.message });
      }
    }

    return { ok: true, results };
  }

  // ── FIX 4: Parse "[Task done: N]" from agent replies ──────
  _parseTaskCompletions(missionId, reply) {
    const matches = reply.matchAll(/\[Task done:\s*(\d+)\]/gi);
    let updated = false;
    const mission = this.getMission(missionId);
    if (!mission || !mission.tasks) return;

    for (const match of matches) {
      const taskIdx = parseInt(match[1]) - 1; // 1-indexed in messages
      if (taskIdx >= 0 && taskIdx < mission.tasks.length && !mission.tasks[taskIdx].done) {
        mission.tasks[taskIdx].done = true;
        updated = true;
        this.logEvent(missionId, 'task_done', { taskIndex: taskIdx, text: mission.tasks[taskIdx].text });
      }
    }

    // Also check for mission complete
    if (/\[Mission complete\]/i.test(reply)) {
      this.updateMission(missionId, { status: 'done', tasks: mission.tasks });
      this._stopPolling(missionId);
      this.logEvent(missionId, 'mission_complete', { source: 'agent' });
      return;
    }

    if (updated) {
      this.updateMission(missionId, { tasks: mission.tasks });
      // Check if all tasks are now done
      const allDone = mission.tasks.every(t => t.done);
      if (allDone) {
        this.updateMission(missionId, { status: 'done' });
        this._stopPolling(missionId);
        this.logEvent(missionId, 'auto_complete', { source: 'all_tasks_done' });
      }
    }
  }

  // ── Get live mission status with session data ─────────────
  getStatus(missionId) {
    const mission = this.getMission(missionId);
    if (!mission) return null;

    const sessions = this._getSessions();
    const agentStatuses = (mission.agents || []).map(agentName => {
      const agentLower = agentName.toLowerCase();
      const matching = sessions.filter(s => {
        const label = (s.label || s.key || '').toLowerCase();
        return label.includes(agentLower);
      });
      const active = matching.some(s => s.status === 'active');
      const lastActive = matching.reduce((latest, s) => {
        return (s.lastActive || 0) > latest ? s.lastActive : latest;
      }, 0);
      return {
        agent: agentName,
        status: active ? 'working' : 'idle',
        sessions: matching.length,
        lastActive: lastActive || null,
        action: matching.find(s => s.status === 'active')?.action || 'idle',
      };
    });

    const tasks = mission.tasks || [];
    const done = tasks.filter(t => t.done).length;
    const total = tasks.length;

    return {
      id: mission.id,
      name: mission.name,
      status: mission.status,
      activatedAt: mission.activatedAt || null,
      agents: agentStatuses,
      tasks: mission.tasks || [],
      progress: { done, total, percent: total > 0 ? Math.round(done / total * 100) : 0 },
      lastEvent: this.getLog(missionId, 1)[0] || null,
    };
  }

  // ── Internal: call gateway (generic) ──────────────────────
  async _callGateway(message, timeoutMs = CHAT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(this.gatewayUrl + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.gatewayToken,
        },
        body: JSON.stringify({
          model: 'openclaw',
          messages: [{ role: 'user', content: message }],
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gateway error ${resp.status}: ${errText.substring(0, 200)}`);
      }
      const data = await resp.json();
      return data?.choices?.[0]?.message?.content || '';
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') throw new Error(`Gateway timeout after ${timeoutMs / 1000}s`);
      throw e;
    }
  }

  // ── Internal: send message to agent via gateway ───────────
  async _sendToAgent(agentName, message, timeoutMs = CHAT_TIMEOUT_MS) {
    const prefixedMsg = `[Speaking to ${agentName}] ${message}`;
    return this._callGateway(prefixedMsg, timeoutMs);
  }

  // ── Internal: read sessions from file ─────────────────────
  _getSessions() {
    try {
      const raw = fs.readFileSync(this.sessionsFile, 'utf8');
      const data = JSON.parse(raw);
      const sessions = data.sessions || data;
      if (typeof sessions !== 'object' || sessions === null) return [];
      return Object.entries(sessions).map(([key, s]) => {
        const updatedAt = s.updatedAt || 0;
        return {
          key,
          label: s.label || s.displayName || key.split(':').pop(),
          status: updatedAt > 0 && (Date.now() - updatedAt) < 300000 ? 'active' : 'idle',
          lastActive: updatedAt || null,
          action: s.task || 'idle',
        };
      });
    } catch { return []; }
  }

  // ── Polling: check agent progress periodically ────────────
  _startPolling(missionId) {
    if (this.pollers.has(missionId)) return;
    const interval = setInterval(() => {
      try {
        const status = this.getStatus(missionId);
        if (!status) { this._stopPolling(missionId); return; }

        if (status.progress.total > 0 && status.progress.done === status.progress.total) {
          this.logEvent(missionId, 'auto_complete', { progress: status.progress });
          this.updateMission(missionId, { status: 'done' });
          this._stopPolling(missionId);
          return;
        }

        const activeAgents = status.agents.filter(a => a.status === 'working').map(a => a.agent);
        if (activeAgents.length > 0) {
          this.logEvent(missionId, 'poll', { activeAgents, progress: status.progress });
        }
      } catch (e) {
        console.error('[MissionOrch] Poll error for', missionId, ':', e.message);
      }
    }, 30000);
    this.pollers.set(missionId, interval);
  }

  _stopPolling(missionId) {
    const interval = this.pollers.get(missionId);
    if (interval) { clearInterval(interval); this.pollers.delete(missionId); }
  }

  resumeActivePolling() {
    const missions = this.getMissions();
    let delay = 0;
    missions.forEach(m => {
      if (m.status === 'active' && m.activatedAt) {
        console.log('[MissionOrch] Resuming polling for:', m.name, '(in', delay, 'ms)');
        setTimeout(() => this._startPolling(m.id), delay);
        delay += 2000;
      }
    });
  }
}

module.exports = MissionOrchestrator;
