'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async function chatRoutes(req, res, ctx) {
  const { readBody, OC_GATEWAY, OC_TOKEN, WORKSPACE } = ctx;

  if (req.url.replace(/\?.*/, '') === '/api/brainstorm' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const question = body?.question;
    const complexity = body?.complexity || 'quick';
    console.log('[brainstorm] question:', (question||'').substring(0, 80), '| complexity:', complexity);
    if (!question || typeof question !== 'string') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing question field' }));
      return true;
    }
    try {
      // Route brainstorm to the main agent via gateway chat completions
      const brainstormPrompt = question;
      const resp = await fetch(OC_GATEWAY + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OC_TOKEN,
        },
        body: JSON.stringify({
          model: 'openclaw:main',
          messages: [{ role: 'user', content: brainstormPrompt }],
          stream: false,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error('[brainstorm] Gateway error:', resp.status, errText.substring(0, 200));
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Gateway error', status: resp.status }));
        return true;
      }
      const data = await resp.json();
      const answer = data?.choices?.[0]?.message?.content || '(No response from agent)';
      console.log('[brainstorm] Answer received:', answer.substring(0, 80));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, answer, complexity }));
    } catch (e) {
      console.error('[brainstorm] Error:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Brainstorm failed', detail: e.message }));
    }
    return true;
  }

  // POST /api/oc/chat — Send message to OpenClaw agent via gateway
  if (req.url.replace(/\?.*/, '') === '/api/oc/chat' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const message = body?.message;
    const targetSession = body?.sessionKey; // Optional: route to sub-agent session
    console.log('[chat-route] message:', (message||'').substring(0, 80), '| sessionKey:', targetSession || 'none');
    if (!message || typeof message !== 'string') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing message field' }));
      return true;
    }
    try {

      // If targeting a specific sub-agent session, use sessions_send
      if (targetSession && targetSession !== 'agent:main:main') {
        const resp = await fetch(OC_GATEWAY + '/api/sessions/' + encodeURIComponent(targetSession) + '/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + OC_TOKEN,
          },
          body: JSON.stringify({ message }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('[chat] Session send error:', resp.status, errText);
          res.writeHead(502);
          res.end(JSON.stringify({ error: 'Session send error', status: resp.status }));
          return true;
        }
        const data = await resp.json();
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, reply: data?.reply || data?.message || '(Awaiting response...)' }));
        return true;
      }

      // Detect persona prefix: [Speaking to Hunter] message
      let agentMessage = message;
      const personaMatch = message.match(/^\[Speaking to (\w+)\]\s*(.*)/s);
      console.log('[chat-route] persona match:', personaMatch ? personaMatch[1] : 'none', '| raw message start:', message.substring(0, 60));

      if (personaMatch) {
        // PERSONA CHAT — direct to LLM provider, bypassing OpenClaw gateway entirely
        // CLIProxyAPI (port 8317) gives us clean, stateless completions with full context.
        const personaName = personaMatch[1];
        const userText = personaMatch[2];
        const personaPath = path.join(__dirname, 'office-medieval', 'personalities', personaName.toLowerCase() + '.md');
        let personaCtx = '';
        try {
          if (fs.existsSync(personaPath)) {
            personaCtx = fs.readFileSync(personaPath, 'utf8');
          }
        } catch(e) {}

        // Load agent-specific memory from their workspace
        let memoryCtx = '';
        const isSycopa = personaName.toLowerCase() === 'sycopa';
        if (isSycopa) {
          // Sycopa = main session = read main MEMORY.md
          try { memoryCtx = fs.readFileSync(path.join(WORKSPACE, 'MEMORY.md'), 'utf8').substring(0, 3000); } catch(e) {}
        } else {
          // Other agents: read their own workspace MEMORY.md if it exists
          const AGENTS_BASE = path.join(WORKSPACE, 'fleet', 'agents');
          const agentMemPath = path.join(AGENTS_BASE, personaName.toLowerCase(), 'MEMORY.md');
          try {
            if (fs.existsSync(agentMemPath)) {
              memoryCtx = fs.readFileSync(agentMemPath, 'utf8').substring(0, 2000);
            }
          } catch(e) {}
        }

        // Fallback role descriptions if no personality file
        const KNIGHT_ROLES = {
          sycopa: 'the Lord Commander and digital alter ego of Kira (the castle lord). Cool, direct, action-oriented. No fluff.',
          forge:    'the Master Builder, responsible for code and infrastructure. Gruff, practical, proud of craftsmanship.',
          atlas:    'the Navigator, handles research and analysis. Scholarly, curious, loves maps and knowledge.',
          hunter:   'the Scout, market intelligence and opportunities. Sharp-eyed, competitive, always tracking prey.',
          echo:     'the Communicator, handles channels and messaging. Swift, reliable, carries every word faithfully.',
          sentinel: 'the Guardian, security and quality assurance. Vigilant, stern, trusts nothing without verification.',
        };
        const roleDesc = KNIGHT_ROLES[personaName.toLowerCase()] || 'a loyal knight of the castle';

        let systemPrompt = personaCtx
          ? `You are ${personaName}, a knight in a medieval castle. Respond FULLY IN CHARACTER using the personality below. Stay concise (2-5 sentences). Never break character, never mention AI.\n\n${personaCtx}`
          : `You are ${personaName}, ${roleDesc}. You serve in a medieval castle. Respond in character — concise, never break character, never mention being an AI.`;

        if (memoryCtx) {
          systemPrompt += `\n\n## Your Memory (what you know)\n${memoryCtx}`;
        }

        console.log('[chat-persona] Direct LLM call for', personaName, '| has personality file:', !!personaCtx);

        try {
          // Direct call to CLIProxyAPI — clean stateless completion
          const LLM_URL = process.env.LLM_PROXY_URL || 'http://127.0.0.1:8317';
          const LLM_MODEL = process.env.LLM_PERSONA_MODEL || 'claude-sonnet-4-6';

          const resp = await fetch(LLM_URL + '/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: LLM_MODEL,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText },
              ],
              stream: false,
              max_tokens: 300,
            }),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            console.error('[chat-persona] LLM error:', resp.status, errText.substring(0, 200));
            res.writeHead(502);
            res.end(JSON.stringify({ error: 'LLM provider error', status: resp.status }));
            return true;
          }

          const data = await resp.json();
          const reply = data?.choices?.[0]?.message?.content || '(The knight remains silent...)';
          console.log('[chat-persona]', personaName, 'replied:', reply.substring(0, 60));
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, reply, persona: personaName }));
          return true;
        } catch (e) {
          console.error('[chat-persona] Direct LLM failed:', e.message);
          res.writeHead(502);
          res.end(JSON.stringify({ error: 'LLM connection failed', details: e.message }));
          return true;
        }
      }

      // DEFAULT: No persona — send to main session (Sycopa)
      const resp = await fetch(OC_GATEWAY + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OC_TOKEN,
        },
        body: JSON.stringify({
          model: 'openclaw:main',
          messages: [{ role: 'user', content: agentMessage }],
          stream: false,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error('[chat] Gateway error:', resp.status, errText);
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Gateway error', status: resp.status }));
        return true;
      }
      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content || '(No response)';
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, reply }));
    } catch (e) {
      console.error('[chat] Gateway send error:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to reach gateway', detail: e.message }));
    }
    return true;
  }

  // ─── Mission Houses API ──────────────────────────────────
  // Auth: reject requests from external origins (CSRF protection)
  // GET /api/oc/chat/transcript?last=N — Sanitized transcript (text-only, no tool calls)
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
          // Extract text content only — skip tool calls/results
          let text = '';
          if (typeof msg.content === 'string') {
            text = msg.content;
          } else if (Array.isArray(msg.content)) {
            text = msg.content
              .filter(p => p.type === 'text' && typeof p.text === 'string')
              .map(p => p.text)
              .join(' ');
          }
          if (!text.trim()) continue;
          if (msg.role === 'toolResult') continue;
          // Truncate long messages
          if (text.length > 500) text = text.substring(0, 500) + '...';
          messages.unshift({ role: msg.role, text, ts: entry.timestamp });
        } catch(e) {}
      }
      res.writeHead(200);
      res.end(JSON.stringify({ messages: messages.slice(-last) }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // ── Setup Wizard API ──────────────────────────────────────


  return false; // no route matched
};
