'use strict';
/**
 * oc-reader.js — OpenClaw filesystem/config readers
 * Extracted from server.js for testability and modularity.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = process.env.WORKSPACE || (process.env.HOME + '/.openclaw/workspace');
const SESSIONS_FILE = process.env.HOME + '/.openclaw/agents/main/sessions/sessions.json';

function readJSON(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch(e) { return null; }
}

function getAgents() {
  const agentsFile = path.join(WORKSPACE, 'agents.json');
  try {
    const data = readJSON(agentsFile);
    if (data && data.agents) return data;
  } catch(e) {}

  return { agents: [
    { id: 'sycopa', name: 'Sycopa', role: 'Chief of Staff', status: 'active', emoji: '🧠', description: 'Strategic planning and coordination' },
    { id: 'atlas', name: 'Atlas', role: 'Navigator', status: 'active', emoji: '🗺️', description: 'Research and analysis' },
    { id: 'forge', name: 'Forge', role: 'Builder', status: 'active', emoji: '🔨', description: 'Code and infrastructure' },
    { id: 'hunter', name: 'Hunter', role: 'Scout', status: 'active', emoji: '🎯', description: 'Market intelligence and opportunities' },
    { id: 'echo', name: 'Echo', role: 'Communicator', status: 'active', emoji: '📡', description: 'Channels and messaging' },
    { id: 'sentinel', name: 'Sentinel', role: 'Guardian', status: 'active', emoji: '🛡️', description: 'Security and quality assurance' },
  ]};
}

function getSessions() {
  const data = readJSON(SESSIONS_FILE);
  if (!data) return [];
  const sessions = data.sessions || data;
  if (typeof sessions !== 'object') return [];
  return Object.entries(sessions).map(([key, s]) => {
    const isActive = (Date.now() - (s.updatedAt || 0)) < 300000;
    const label = s.label || s.displayName || key.split(':').pop();
    let action = 'idle';
    const lbl = (label || '').toLowerCase();
    if (lbl.match(/build|code|implement|create|fix|refactor|write/)) action = 'coding';
    else if (lbl.match(/review|audit|check|test|verify/)) action = 'reviewing';
    else if (lbl.match(/research|search|find|analyze|investigate/)) action = 'researching';
    else if (lbl.match(/deploy|ship|push|release|publish/)) action = 'deploying';
    else if (lbl.match(/chat|message|respond|reply|notify/)) action = 'communicating';
    else if (lbl.match(/plan|brainstorm|design|architect/)) action = 'planning';
    else if (lbl.match(/debug|error|broken|fix|bug/)) action = 'debugging';
    else if (lbl.match(/guard|security|scan|protect/)) action = 'guarding';
    else if (isActive) action = 'working';
    return {
      key, kind: key.includes(':subagent:') ? 'subagent' : (key.includes(':cron:') ? 'cron' : 'main'),
      label, displayName: s.displayName || label,
      status: isActive ? 'active' : 'idle',
      action: isActive ? action : 'idle',
      model: s.model || 'unknown', totalTokens: s.totalTokens || 0,
      lastActive: s.updatedAt || null, channel: s.lastChannel || s.channel || 'unknown',
      task: s.task || null, inputTokens: s.inputTokens || 0, outputTokens: s.outputTokens || 0,
    };
  });
}

function getMemory() {
  const memDir = path.join(WORKSPACE, 'memory');
  const mainFile = path.join(WORKSPACE, 'MEMORY.md');
  const todoFile = path.join(WORKSPACE, 'TODO.md');
  const files = [];
  try {
    fs.readdirSync(memDir).forEach(f => {
      try { const s = fs.statSync(path.join(memDir, f)); files.push({ name: f, size: s.size, modified: s.mtimeMs }); } catch(e) {}
    });
  } catch(e) {}
  let main = ''; try { main = fs.readFileSync(mainFile, 'utf8'); } catch(e) {}
  let todo = ''; try { todo = fs.readFileSync(todoFile, 'utf8'); } catch(e) {}
  return { main, todo, files };
}

function getChat() {
  const agentsDir = process.env.HOME + '/.openclaw/agents/main/sessions';
  const sessionsFile = path.join(agentsDir, 'sessions.json');
  const sessData = readJSON(sessionsFile);
  if (!sessData) return { messages: [] };

  const sessions = sessData.sessions || sessData;
  let transcriptPath = null;
  for (const [key, s] of Object.entries(sessions)) {
    if (key === 'agent:main:main' && s.transcriptPath) {
      transcriptPath = s.transcriptPath;
      break;
    }
  }

  if (!transcriptPath) {
    const searchDirs = [path.join(agentsDir), WORKSPACE];
    for (const dir of searchDirs) {
      try {
        const jFiles = fs.readdirSync(dir)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => ({ name: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);
        if (jFiles.length > 0) { transcriptPath = jFiles[0].path; break; }
      } catch(e) {}
    }
  }

  if (!transcriptPath || !fs.existsSync(transcriptPath)) return { messages: [] };

  try {
    const raw = fs.readFileSync(transcriptPath, 'utf8');
    const lines = raw.trim().split('\n').slice(-100);
    const messages = [];

    function sanitizeContent(text) {
      return text
        .replace(/\[Queued messages while agent was busy\][\s\S]*?(?=\n\n|\n---|$)/gi, '')
        .replace(/^---\s*\nQueued #\d+[\s\S]*?(?=\n---|\n\n[A-Z👑]|$)/gm, '')
        .replace(/\[media attached.*?\]/gi, '[attachment]')
        .replace(/\/home\/[^\s]+\.(jpg|png|jpeg|gif|webp)/gi, '[image]')
        .replace(/Conversation info \(untrusted metadata\):[\s\S]*?```/g, '')
        .replace(/Sender \(untrusted metadata\):[\s\S]*?```/g, '')
        .replace(/System: \[[\d\- :UTC]+\][^\n]*/g, '')
        .replace(/To send an image back.*?Avoid.*?\n/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const msg = obj.message || obj;
        const role = msg.role;
        if (role && (role === 'user' || role === 'assistant')) {
          let content = '';
          if (typeof msg.content === 'string') {
            content = msg.content;
          } else if (Array.isArray(msg.content)) {
            content = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
          }
          content = sanitizeContent(content);
          if (content && content.trim().length > 0) {
            messages.push({ role, content: content.substring(0, 1000), timestamp: obj.timestamp || 0 });
          }
        }
      } catch(e) {}
    }
    return { messages: messages.slice(-50) };
  } catch(e) {
    return { messages: [] };
  }
}

function getConfig() {
  const c = readJSON(process.env.HOME + '/.openclaw/openclaw.json');
  if (!c) return {};
  const safe = { ...c };
  if (safe.gateway && safe.gateway.auth) delete safe.gateway.auth.token;
  if (safe.channels && safe.channels.telegram) delete safe.channels.telegram.botToken;
  return safe;
}

function getCrons() {
  try {
    const ocPath = ['/usr/local/bin/openclaw', '/opt/homebrew/bin/openclaw', process.env.HOME + '/.local/bin/openclaw']
      .find(p => fs.existsSync(p));
    if (ocPath) {
      const out = execSync(ocPath + ' cron list --json 2>/dev/null', { timeout: 10000, encoding: 'utf8' });
      const parsed = JSON.parse(out);
      return { jobs: Array.isArray(parsed) ? parsed : (parsed.jobs || []) };
    }
  } catch(e) {}
  return { jobs: [] };
}

function getLocalVersion() {
  const VERSION_FILE = path.join(__dirname, '..', 'version.json');
  try { return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')); }
  catch(e) { return { version: '0.0.0', buildDate: null, channel: 'unknown' }; }
}

function getLatestVersion() {
  const REPO_DIR = process.env.SPAWNKIT_REPO || path.join(process.env.HOME, 'spawnkit');
  const local = getLocalVersion();
  const result = { current: local, latest: null, updateAvailable: false };
  try {
    if (fs.existsSync(path.join(REPO_DIR, '.git'))) {
      try { execSync('git -C ' + REPO_DIR + ' fetch --quiet 2>/dev/null', { timeout: 10000 }); } catch(e) {}
      const localHead = execSync('git -C ' + REPO_DIR + ' rev-parse HEAD 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
      const remoteHead = execSync('git -C ' + REPO_DIR + ' rev-parse origin/main 2>/dev/null || git -C ' + REPO_DIR + ' rev-parse origin/master 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
      const repoVersionFile = path.join(REPO_DIR, 'server', 'version.json');
      let repoVersion = local;
      try { repoVersion = JSON.parse(fs.readFileSync(repoVersionFile, 'utf8')); } catch(e) {}
      result.latest = repoVersion;
      result.localCommit = localHead.substring(0, 8);
      result.remoteCommit = remoteHead.substring(0, 8);
      result.updateAvailable = localHead !== remoteHead;
      try {
        const behind = execSync('git -C ' + REPO_DIR + ' rev-list HEAD..origin/main --count 2>/dev/null || echo 0', { encoding: 'utf8', timeout: 5000 }).trim();
        result.commitsBehind = parseInt(behind) || 0;
      } catch(e) { result.commitsBehind = 0; }
    }
  } catch(e) { result.error = e.message; }
  return result;
}

module.exports = { getAgents, getSessions, getMemory, getChat, getConfig, getCrons, getLocalVersion, getLatestVersion };
