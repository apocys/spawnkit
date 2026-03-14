const { readBody } = require('../lib/proxy-client');
const { getAgents, getSessions, getMemory, getChat, getConfig, getCrons, getTasks, getSkills } = require('../lib/oc-reader');
const fs = require('fs');
const path = require('path');

module.exports = async function ocDataRoutes(req, res, ctx) {
  const { PORT, OC_TOKEN, WORKSPACE, readBody } = ctx;

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
        res.writeHead(401); res.end(JSON.stringify({error:'unauthorized'})); return;
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
          return;
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
          return;
        } catch(e) {
          res.writeHead(500);
          res.end(JSON.stringify({error: 'Failed to write task: ' + e.message}));
          return;
        }
      } catch(e) {
        res.writeHead(400);
        res.end(JSON.stringify({error: 'Invalid JSON: ' + e.message}));
        return;
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
      default: res.writeHead(404); res.end(JSON.stringify({error:'not found'})); return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(data));
    return;
  }

  // If no route matches, return false to pass through
  return false;
};