/**
 * office-worker/agent-bridge.js — Bridges OpenClaw API → OfficeState
 * Polls /api/oc/agents and /api/oc/sessions to sync agent states.
 * Maps tool names to human-readable status labels (inspired by pixel-agents transcriptParser).
 */
(function () {
  'use strict';

  var POLL_INTERVAL = 5000; // ms
  var TOOL_STATUS_MAP = {
    'Read': 'Reading',
    'Edit': 'Editing',
    'Write': 'Writing',
    'Bash': 'Running command',
    'exec': 'Running command',
    'Glob': 'Searching files',
    'Grep': 'Searching code',
    'WebFetch': 'Fetching web',
    'web_fetch': 'Fetching web',
    'WebSearch': 'Searching web',
    'web_search': 'Searching web',
    'browser': 'Using browser',
    'image': 'Analyzing image',
    'tts': 'Speaking',
    'memory_search': 'Searching memory',
    'message': 'Sending message'
  };

  function formatToolStatus(toolName, input) {
    var base = TOOL_STATUS_MAP[toolName] || 'Using ' + toolName;
    if (input && input.file_path) {
      var parts = input.file_path.split('/');
      base += ' ' + parts[parts.length - 1];
    }
    if (input && input.command) {
      var cmd = input.command;
      base = 'Running: ' + (cmd.length > 40 ? cmd.slice(0, 40) + '…' : cmd);
    }
    if (input && input.query) {
      base += ': ' + (input.query.length > 30 ? input.query.slice(0, 30) + '…' : input.query);
    }
    return base;
  }

  /** Agent emojis by role */
  var ROLE_EMOJI = {
    'main': '🎭',
    'coding': '💻',
    'research': '🔍',
    'review': '📝',
    'default': '🤖'
  };

  function AgentBridge(officeState, apiBase) {
    this.state = officeState;
    this.apiBase = apiBase || '';
    this.knownAgents = new Set();
    this.pollTimer = null;
  }

  AgentBridge.prototype.start = function () {
    var self = this;
    this._poll();
    this.pollTimer = setInterval(function () { self._poll(); }, POLL_INTERVAL);
  };

  AgentBridge.prototype.stop = function () {
    if (this.pollTimer) clearInterval(this.pollTimer);
  };

  AgentBridge.prototype._poll = function () {
    var self = this;
    // Fetch agents
    fetch(this.apiBase + '/api/oc/agents')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var agents = data.agents || [];
        self._syncAgents(agents);
      })
      .catch(function () { /* silent fail */ });

    // Fetch active sessions for tool status
    fetch(this.apiBase + '/api/oc/sessions')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var sessions = data.sessions || [];
        self._syncSessions(sessions);
      })
      .catch(function () { /* silent fail */ });
  };

  AgentBridge.prototype._syncAgents = function (agents) {
    var currentIds = new Set();
    for (var i = 0; i < agents.length; i++) {
      var a = agents[i];
      var id = a.id || a.name || ('agent-' + i);
      currentIds.add(id);

      if (!this.knownAgents.has(id)) {
        // New agent — add to office
        var emoji = ROLE_EMOJI[a.role] || ROLE_EMOJI['default'];
        this.state.addAgent(id, a.name || id, emoji);
        this.knownAgents.add(id);
      }

      // Update active status
      var isActive = a.status === 'active' || a.status === 'running' || a.status === 'busy';
      this.state.setAgentActive(id, isActive);
    }

    // Remove agents that are gone
    var self = this;
    this.knownAgents.forEach(function (id) {
      if (!currentIds.has(id)) {
        self.state.removeAgent(id);
        self.knownAgents.delete(id);
      }
    });
  };

  AgentBridge.prototype._syncSessions = function (sessions) {
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      if (s.agent && s.lastTool) {
        var status = formatToolStatus(s.lastTool.name, s.lastTool.input || {});
        this.state.setToolStatus(s.agent, status);
      }
    }
  };

  window.AgentBridge = AgentBridge;
  window.AgentBridge.formatToolStatus = formatToolStatus;
})();
