'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function oc_dataRoutes(req, res, ctx) {
  const { readBody, PORT, OC_TOKEN, WORKSPACE, SESSIONS_FILE, getAgents, getSessions, getMemory, getChat, getConfig, getCrons, getTasks, getSkills, getLocalVersion, getLatestVersion } = ctx;


  // ─── POST /api/oc/skills/create — Install a skill into workspace ────
  if (req.url === '/api/oc/skills/create' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.name || !body.skillMd) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: false, error: 'Missing name or skillMd' }));
        return true;
      }
      // Sanitize name: lowercase, hyphens only, no path traversal
      const name = String(body.name).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
      if (!name || name.length < 2 || name.length > 64) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: false, error: 'Invalid skill name (2-64 chars, lowercase + hyphens)' }));
        return true;
      }
      const skillDir = require('path').join(WORKSPACE, 'skills', name);
      const fs = require('fs');
      // Create directories
      fs.mkdirSync(skillDir, { recursive: true });
      // Write SKILL.md
      fs.writeFileSync(require('path').join(skillDir, 'SKILL.md'), body.skillMd, 'utf8');
      // Write optional resource files
      if (body.resources) {
        const cats = ['scripts', 'references', 'assets'];
        for (const cat of cats) {
          if (body.resources[cat] && Array.isArray(body.resources[cat])) {
            const catDir = require('path').join(skillDir, cat);
            fs.mkdirSync(catDir, { recursive: true });
            for (const file of body.resources[cat]) {
              if (file.name && typeof file.content === 'string') {
                const safeName = String(file.name).replace(/[\/\\:]/g, '_');
                fs.writeFileSync(require('path').join(catDir, safeName), file.content, 'utf8');
              }
            }
          }
        }
      }
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, name, path: skillDir }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return true;
  }

  // Cron creation endpoint
  if (req.method === 'POST' && req.url === '/api/oc/crons') {
    res.setHeader('Content-Type', 'application/json');

    // Auth check
    const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!authHeader || !apiTokens.includes(authHeader)) {
      res.writeHead(401, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return true;
    }

    try {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const name = parsed.name;
          const schedule = parsed.schedule;
          const prompt = parsed.prompt || parsed.task; // frontend sends 'task', accept both
          const timezone = parsed.timezone;

          if (!name || !schedule || !prompt) {
            res.writeHead(400, {'Content-Type':'application/json'});
            res.end(JSON.stringify({ ok: false, error: 'Missing required fields: name, schedule, prompt (or task)' }));
            return true;
          }

          // Build openclaw cron add command
          const cronArgs = ['cron', 'add', '--name', name, '--schedule', schedule, '--prompt', prompt];
          if (timezone) {
            cronArgs.push('--timezone', timezone);
          }

          const { spawn } = require('child_process');
          const cronProcess = spawn('openclaw', cronArgs);
          let output = '';
          let error = '';

          cronProcess.stdout.on('data', data => output += data.toString());
          cronProcess.stderr.on('data', data => error += data.toString());

          cronProcess.on('close', (code) => {
            if (code === 0) {
              res.writeHead(200, {'Content-Type':'application/json'});
              res.end(JSON.stringify({ 
                ok: true, 
                job: { name, schedule, prompt, timezone: timezone || 'UTC' },
                output: output.trim()
              }));
            } else {
              res.writeHead(500, {'Content-Type':'application/json'});
              res.end(JSON.stringify({ ok: false, error: error || 'Failed to create cron job' }));
            }
          });
        } catch(parseError) {
          res.writeHead(400, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return true;
  }

  if (req.url.startsWith('/api/oc/') && !req.url.startsWith('/api/oc/missions')) {
    res.setHeader('Content-Type', 'application/json');
    const route = req.url.replace(/\?.*/, '');
    // Auth check: all /api/oc/ routes except health require a valid token
    // Same-origin requests (from the dashboard UI served by this server) bypass auth
    const publicRoutes = ['/api/oc/health'];
    if (!publicRoutes.includes(route)) {
      const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      const origin = req.headers.origin || '';
      const referer = req.headers.referer || '';
      const selfHosts = ['app.spawnkit.ai', 'localhost:' + PORT, '127.0.0.1:' + PORT];
      const isSameOrigin = selfHosts.some(h => origin.includes(h) || referer.includes(h));
      if (OC_TOKEN && authHeader !== OC_TOKEN && !isSameOrigin) {
        res.writeHead(401); res.end(JSON.stringify({error:'unauthorized'})); return true;
      }
    }

    // Handle POST requests for task creation
    if (req.method === 'POST' && route === '/api/oc/tasks') {
      try {
        const body = await readBody(req);
        const taskData = JSON.parse(body);

        if (!taskData.title) {
          res.writeHead(400);
          res.end(JSON.stringify({error: 'Task title is required'}));
          return true;
        }

        // Append new task to TODO.md
        const todoFile = require('path').join(WORKSPACE, 'TODO.md');
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const priority = taskData.priority ? ` (${taskData.priority})` : '';
        const newTask = `- [ ] **${taskData.title}**${priority} — Added ${timestamp}`;

        try {
          // Read current content
          let content = '';
          try {
            content = require('fs').readFileSync(todoFile, 'utf8');
          } catch(e) {
            // File doesn't exist, start with basic structure
            content = '# TODO.md - What I\'m Working On\n\n';
          }

          // Append new task at the end
          if (!content.endsWith('\n')) content += '\n';
          content += newTask + '\n';

          // Write back to file
          require('fs').writeFileSync(todoFile, content, 'utf8');

          res.writeHead(201);
          res.end(JSON.stringify({
            ok: true,
            task: {
              title: taskData.title,
              status: 'pending',
              priority: taskData.priority || null,
              created: timestamp
            }
          }));
          return true;
        } catch(e) {
          res.writeHead(500);
          res.end(JSON.stringify({error: 'Failed to write task: ' + e.message}));
          return true;
        }
      } catch(e) {
        res.writeHead(400);
        res.end(JSON.stringify({error: 'Invalid JSON: ' + e.message}));
        return true;
      }
    }

    let data;
    switch(route) {
      case '/api/oc/sessions': data = getSessions(); break;
      case '/api/oc/memory': data = getMemory(); break;
      case '/api/oc/config': data = getConfig(); break;
      case '/api/oc/crons': data = getCrons(); break;
      case '/api/oc/chat': data = getChat(); break;
      case '/api/oc/chat/history': data = getChat(); break;
      case '/api/oc/agents': data = getAgents(); break;
      case '/api/oc/tasks': data = getTasks(); break;
      case '/api/oc/skills': data = getSkills(); break;
      case '/api/oc/health': data = { ok: true, uptime: process.uptime() }; break;
      default: res.writeHead(404); res.end(JSON.stringify({error:'not found'})); return true;
    }
    res.writeHead(200);
    res.end(JSON.stringify(data));
    return true;
  }

  // POST /api/spawn-subagent — Spawn sub-agent for arena battles


  return false; // no route matched
};
