'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async function missionsRoutes(req, res, ctx) {
  const { readBody, missionOrch, MISSIONS_FILE, OC_GATEWAY, OC_TOKEN, WORKSPACE } = ctx;

  // Auth: reject requests from external origins (CSRF protection)
  // Accept: same-origin fetch (no Origin header), localhost, or valid Referer
  if (req.url.startsWith('/api/oc/missions') && (req.method === 'POST' || req.method === 'DELETE')) {
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const isLocal = !origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('app.spawnkit.ai');
    const refOk = !referer || referer.includes('localhost') || referer.includes('127.0.0.1') || referer.includes('app.spawnkit.ai');
    if (!isLocal || !refOk) {
      res.writeHead(403, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Forbidden — invalid origin' }));
      return true;
    }
  }

  // GET /api/oc/missions — list all missions
  if (req.url === '/api/oc/missions' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      res.writeHead(200);
      res.end(JSON.stringify({ missions: data }));
    } catch(e) {
      res.writeHead(200);
      res.end(JSON.stringify({ missions: [] }));
    }
    return true;
  }

  // POST /api/oc/missions — save all missions (full sync)
  if (req.url === '/api/oc/missions' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > 500_000) { req.destroy(); res.writeHead(413); res.end('Payload too large'); return; }
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const missions = data.missions || data;
        if (!Array.isArray(missions)) throw new Error('missions must be an array');
        fs.writeFileSync(MISSIONS_FILE, JSON.stringify(missions, null, 2));
        console.log('[Missions] Saved', missions.length, 'missions');
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, count: missions.length }));
      } catch(e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return true;
  }

  // POST /api/oc/missions/create — append a single new mission (used by /mission Telegram command)
  if (req.url === '/api/oc/missions/create' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const body = await readBody(req);
      if (!body || !body.name) throw new Error('Missing required field: name');
      const HOUSE_COLORS = ['#6366f1','#10b981','#f43f5e','#f59e0b','#0ea5e9','#a855f7','#f97316','#14b8a6','#ec4899','#84cc16','#06b6d4','#ef4444'];
      const HOUSE_POSITIONS = [
        {x:12,z:18},{x:-12,z:18},{x:14,z:22},{x:-14,z:22},{x:10,z:24},{x:-10,z:24},
        {x:16,z:20},{x:-16,z:20},{x:12,z:26},{x:-12,z:26},{x:16,z:26},{x:-16,z:26},
      ];
      const existing = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const active = existing.filter(m => m.status !== 'archived');
      const usedPositions = active.map(m => m.position).filter(Boolean);
      const nextPos = HOUSE_POSITIONS.find(p => !usedPositions.some(u => u.x === p.x && u.z === p.z)) || HOUSE_POSITIONS[active.length % HOUSE_POSITIONS.length];
      const colorIdx = existing.length % HOUSE_COLORS.length;
      const ICONS = ['🌐','📱','🎮','🛡️','🔮','📦','🎯','⚗️','🗂️','🚀','💎','🏗️'];
      const mission = {
        id: 'mission_' + Math.random().toString(36).slice(2, 15),
        name: body.name,
        icon: body.icon || ICONS[existing.length % ICONS.length],
        status: body.status || 'active',
        color: body.color || HOUSE_COLORS[colorIdx],
        agents: body.agents || ['Sycopa'],
        description: body.description || body.name,
        goal: body.goal || body.description || body.name,
        tasks: Array.isArray(body.tasks) ? body.tasks : [],
        position: nextPos,
        source: body.source || 'telegram',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      existing.push(mission);
      fs.writeFileSync(MISSIONS_FILE, JSON.stringify(existing, null, 2));
      console.log('[Missions] Created:', mission.id, mission.name);
      res.writeHead(201);
      res.end(JSON.stringify({ ok: true, mission }));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // GET /api/oc/missions/:id — fetch single mission by id
  const missionGetMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)$/);
  if (missionGetMatch && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const id = missionGetMatch[1];
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const mission = data.find(m => m.id === id);
      if (!mission) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      res.writeHead(200);
      res.end(JSON.stringify(mission));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // PATCH /api/oc/missions/:id/tasks/:taskId — granular task update
  const missionTaskPatchMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/tasks\/([a-zA-Z0-9_.-]+)$/);
  if (missionTaskPatchMatch && req.method === 'PATCH') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    try {
      const [, id, taskId] = missionTaskPatchMatch;
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const mission = data.find(m => m.id === id);
      if (!mission) { res.writeHead(404); res.end(JSON.stringify({ error: 'Mission not found' })); return; }
      const task = (mission.tasks || []).find(t => t.id === taskId);
      if (!task) { res.writeHead(404); res.end(JSON.stringify({ error: 'Task not found' })); return; }
      const taskAllowed = ['status', 'assignedAgent', 'subagentSessionId', 'subtasks', 'text'];
      taskAllowed.forEach(k => { if (body && k in body) task[k] = body[k]; });
      mission.updated = new Date().toISOString();
      fs.writeFileSync(MISSIONS_FILE, JSON.stringify(data, null, 2));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, mission, task }));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // PATCH /api/oc/missions/:id — partial update (tasks, status, name, etc.)
  const missionPatchMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)$/);
  if (missionPatchMatch && req.method === 'PATCH') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    try {
      const id = missionPatchMatch[1];
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const mission = data.find(m => m.id === id);
      if (!mission) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      // Apply partial updates — only allow safe fields
      const allowed = ['tasks', 'status', 'name', 'description', 'agents', 'icon', 'color', 'goal', 'metadata'];
      allowed.forEach(k => { if (body && k in body) mission[k] = body[k]; });
      mission.updated = new Date().toISOString();
      fs.writeFileSync(MISSIONS_FILE, JSON.stringify(data, null, 2));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, mission }));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // DELETE /api/oc/missions/:id — archive a mission
  const missionDeleteMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_]+)$/);
  if (missionDeleteMatch && req.method === 'DELETE') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const id = missionDeleteMatch[1];
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const mission = data.find(m => m.id === id);
      if (mission) {
        mission.status = 'archived';
        fs.writeFileSync(MISSIONS_FILE, JSON.stringify(data, null, 2));
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, archived: id }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // ─── Mission Orchestrator API ─────────────────────────────
  // POST /api/oc/missions/:id/activate — activate a mission (send briefs to agents)
  const missionActivateMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/activate$/);
  if (missionActivateMatch && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await missionOrch.activate(missionActivateMatch[1]);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // GET /api/oc/missions/:id/status — live mission status with agent sessions
  const missionStatusMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/status$/);
  if (missionStatusMatch && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const status = missionOrch.getStatus(missionStatusMatch[1]);
    if (!status) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
    res.writeHead(200);
    res.end(JSON.stringify(status));
    return true;
  }

  // POST /api/oc/missions/:id/chat — send a message in mission context
  const missionChatMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/chat$/);
  if (missionChatMatch && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    if (!body?.message) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing message' })); return; }
    try {
      const result = await missionOrch.sendChat(missionChatMatch[1], body.message, body.agent || null);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // GET /api/oc/missions/:id/chat — get mission chat history
  const missionChatGetMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/chat$/);
  if (missionChatGetMatch && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const messages = missionOrch.getChatHistory(missionChatGetMatch[1]);
    res.writeHead(200);
    res.end(JSON.stringify({ messages }));
    return true;
  }

  // GET /api/oc/missions/:id/log — event log
  const missionLogMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/log$/);
  if (missionLogMatch && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const log = missionOrch.getLog(missionLogMatch[1]);
    res.writeHead(200);
    res.end(JSON.stringify({ log }));
    return true;
  }

  // GET /api/oc/chat/transcript?last=N — Sanitized transcript (text-only, no tool calls)


  return false; // no route matched
};
