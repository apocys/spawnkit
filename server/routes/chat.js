'use strict';
const fs = require('fs');
const path = require('path');

// ── Shared LLM config ──────────────────────────────────────────────────
const LLM_URL = process.env.LLM_PROXY_URL || 'http://127.0.0.1:8317';
const LLM_MODEL = process.env.LLM_CHAT_MODEL || 'claude-sonnet-4-6';
const LLM_BRAINSTORM_MODEL = process.env.LLM_BRAINSTORM_MODEL || 'claude-sonnet-4-6';

/**
 * Call CLIProxyAPI for a stateless chat completion.
 * @param {string} model - Model ID
 * @param {Array} messages - OpenAI-format messages array
 * @param {number} maxTokens - Max response tokens
 * @param {number} timeoutMs - Abort after this many ms
 * @returns {Promise<string>} The assistant's reply text
 */
async function llmCall(model, messages, maxTokens = 800, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(LLM_URL + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`LLM ${resp.status}: ${errText.substring(0, 200)}`);
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || '(No response)';
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/**
 * Load workspace context for the main agent (SOUL.md, MEMORY.md, TODO.md).
 */
function loadMainContext(workspace) {
  const parts = [];
  for (const file of ['SOUL.md', 'IDENTITY.md', 'MEMORY.md']) {
    try {
      const content = fs.readFileSync(path.join(workspace, file), 'utf8');
      parts.push(`## ${file}\n${content.substring(0, 2000)}`);
    } catch (e) {}
  }
  // Add current tasks
  try {
    const todo = fs.readFileSync(path.join(workspace, 'TODO.md'), 'utf8');
    parts.push(`## Current Tasks\n${todo.substring(0, 1000)}`);
  } catch (e) {}
  return parts.join('\n\n');
}

// Helper to read JSON safely
function readJSON(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch(e) { return null; }
}

module.exports = async function chatRoutes(req, res, ctx) {
  const { readBody, WORKSPACE } = ctx;
  const SESSIONS_FILE = ctx.SESSIONS_FILE || process.env.HOME + '/.openclaw/agents/main/sessions/sessions.json';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/brainstorm — Team brainstorm via CLIProxyAPI
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (req.url.replace(/\?.*/, '') === '/api/brainstorm' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const question = body?.question;
    const complexity = body?.complexity || 'quick';
    console.log('[brainstorm] question:', (question || '').substring(0, 80), '| complexity:', complexity);

    if (!question || typeof question !== 'string') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing question field' }));
      return true;
    }

    const timeoutMs = complexity === 'quick' ? 20000 : complexity === 'deep' ? 45000 : 60000;
    const maxTokens = complexity === 'quick' ? 600 : complexity === 'deep' ? 1200 : 2000;

    // Build brainstorm system prompt with workspace context
    const wsContext = loadMainContext(WORKSPACE);
    const systemPrompt = `You are the CEO of a tech operation. Your team consists of specialists:
- 📡 Echo (researcher) — finds relevant data and trends
- 🔬 Forge (builder) — validates technical feasibility
- 😈 Sentinel (challenger) — finds flaws and risks
- 🎯 CEO (you) — synthesizes the best answer

The user asks a question. Simulate a brief team debate internally, then deliver ONE clear, synthesized answer.
Format: Start with the key insight, then supporting points. Be concise and actionable.
Complexity level: ${complexity}

${wsContext ? '## Your Context\n' + wsContext : ''}`;

    try {
      const answer = await llmCall(LLM_BRAINSTORM_MODEL, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ], maxTokens, timeoutMs);

      console.log('[brainstorm] Answer received:', answer.substring(0, 80));

      // Save to server-side history
      const historyFile = path.join(WORKSPACE, '.spawnkit-brainstorms.json');
      let history = [];
      try { history = JSON.parse(fs.readFileSync(historyFile, 'utf8')); } catch (e) {}
      history.unshift({ question, answer, complexity, timestamp: new Date().toISOString() });
      if (history.length > 50) history = history.slice(0, 50);
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, answer, complexity }));
    } catch (e) {
      const isTimeout = e.name === 'AbortError';
      console.error('[brainstorm]', isTimeout ? 'Timeout' : 'Error:', e.message);
      res.writeHead(isTimeout ? 504 : 502);
      res.end(JSON.stringify({
        error: isTimeout ? 'Brainstorm timed out' : 'Brainstorm failed',
        detail: e.message,
      }));
    }
    return true;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/oc/chat — Chat with agent via CLIProxyAPI
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (req.url.replace(/\?.*/, '') === '/api/oc/chat' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const message = body?.message;
    console.log('[chat] message:', (message || '').substring(0, 80));

    if (!message || typeof message !== 'string') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing message field' }));
      return true;
    }

    // Detect persona prefix: [Speaking to Hunter] message
    const personaMatch = message.match(/^\[Speaking to (\w+)\]\s*(.*)/s);

    if (personaMatch) {
      // ── Persona Chat ─────────────────────────────────────────────────
      const personaName = personaMatch[1];
      const userText = personaMatch[2];

      // Try loading personality file
      const personaPath = path.join(__dirname, '..', 'office-medieval', 'personalities', personaName.toLowerCase() + '.md');
      let personaCtx = '';
      try { if (fs.existsSync(personaPath)) personaCtx = fs.readFileSync(personaPath, 'utf8'); } catch (e) {}

      // Load agent memory
      let memoryCtx = '';
      if (personaName.toLowerCase() === 'sycopa' || personaName.toLowerCase() === 'apomac') {
        try { memoryCtx = fs.readFileSync(path.join(WORKSPACE, 'MEMORY.md'), 'utf8').substring(0, 3000); } catch (e) {}
      } else {
        const agentMemPath = path.join(WORKSPACE, 'fleet', 'agents', personaName.toLowerCase(), 'MEMORY.md');
        try { if (fs.existsSync(agentMemPath)) memoryCtx = fs.readFileSync(agentMemPath, 'utf8').substring(0, 2000); } catch (e) {}
      }

      const ROLES = {
        sycopa: 'the Lord Commander. Cool, direct, action-oriented.',
        apomac: 'the CEO. Sharp, proactive, concise. Gets things done.',
        forge: 'the Master Builder. Gruff, practical, proud of craftsmanship.',
        atlas: 'the Navigator. Scholarly, curious, loves knowledge.',
        hunter: 'the Scout. Sharp-eyed, competitive, always tracking prey.',
        echo: 'the Communicator. Swift, reliable, carries every word.',
        sentinel: 'the Guardian. Vigilant, stern, trusts nothing without verification.',
      };
      const roleDesc = ROLES[personaName.toLowerCase()] || 'a specialist agent';

      let systemPrompt = personaCtx
        ? `You are ${personaName}. Respond FULLY IN CHARACTER. Stay concise (2-5 sentences).\n\n${personaCtx}`
        : `You are ${personaName}, ${roleDesc} Respond in character — concise and direct.`;
      if (memoryCtx) systemPrompt += `\n\n## Your Memory\n${memoryCtx}`;

      try {
        const reply = await llmCall(LLM_MODEL, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ], 300, 15000);

        console.log('[chat-persona]', personaName, 'replied:', reply.substring(0, 60));
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, reply, persona: personaName }));
      } catch (e) {
        console.error('[chat-persona] Failed:', e.message);
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'LLM connection failed', detail: e.message }));
      }
      return true;
    }

    // ── Default Chat (main agent / ApoMac) ──────────────────────────────
    const wsContext = loadMainContext(WORKSPACE);
    const systemPrompt = `You are ApoMac, a sharp and proactive AI assistant. You are the CEO of the operation.
Be concise, helpful, and action-oriented. Answer in 2-5 sentences unless the user asks for detail.
You have access to the user's workspace context below.

${wsContext}`;

    try {
      const reply = await llmCall(LLM_MODEL, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ], 500, 20000);

      console.log('[chat] Reply:', reply.substring(0, 80));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, reply }));
    } catch (e) {
      console.error('[chat] Failed:', e.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Chat failed', detail: e.message }));
    }
    return true;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/oc/chat/transcript?last=N — Sanitized transcript
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (req.url.startsWith('/api/oc/chat/transcript') && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const url = new URL(req.url, 'http://localhost');
    const last = Math.min(parseInt(url.searchParams.get('last') || '15'), 50);
    try {
      const sessData = readJSON(SESSIONS_FILE);
      const mainSess = sessData?.['agent:main:main'];
      const transcriptPath = mainSess?.sessionFile;
      if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        res.writeHead(200);
        res.end(JSON.stringify({ messages: [] }));
        return true;
      }
      const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');
      const messages = [];
      for (let i = lines.length - 1; i >= 0 && messages.length < last * 3; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type !== 'message') continue;
          const msg = entry.message;
          if (!msg || msg.role === 'system') continue;
          let text = '';
          if (typeof msg.content === 'string') {
            text = msg.content;
          } else if (Array.isArray(msg.content)) {
            text = msg.content.filter(p => p.type === 'text' && typeof p.text === 'string').map(p => p.text).join(' ');
          }
          if (!text.trim() || msg.role === 'toolResult') continue;
          if (text.length > 500) text = text.substring(0, 500) + '...';
          messages.unshift({ role: msg.role, text, ts: entry.timestamp });
        } catch (e) {}
      }
      res.writeHead(200);
      res.end(JSON.stringify({ messages: messages.slice(-last) }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  return false;
};
