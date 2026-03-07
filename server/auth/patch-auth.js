#!/usr/bin/env node
const fs = require('fs');
const serverPath = '/home/apocyz_runner/spawnkit-server/server.js';
let code = fs.readFileSync(serverPath, 'utf8');

// 1. Add dotenv + auth imports after first path require
const needle1 = "const path = require('path');";
const replace1 = `const path = require('path');

// ── Auth & Billing (Magic Link + Stripe) ────────────────────────────────
require('dotenv').config({ path: __dirname + '/.env' });
let authManager, billingManager;
try {
  const AuthManager = require('./auth');
  const BillingManager = require('./billing');
  authManager = new AuthManager();
  billingManager = new BillingManager();
  console.log('✓ Auth + Billing initialized');
} catch(e) { console.warn('⚠ Auth/Billing init failed:', e.message); }

function parseCookies(h) {
  const c = {};
  if (h) h.split(';').forEach(s => { const p = s.trim().split('='); if (p[0]&&p[1]) c[p[0]] = decodeURIComponent(p[1]); });
  return c;
}
function isValidEmail(e) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e); }`;

if (!code.includes('require(\'dotenv\')')) {
  code = code.replace(needle1, replace1);
  console.log('✓ Step 1: Added dotenv + auth imports');
} else {
  console.log('⏩ Step 1: Already patched');
}

// 2. Add auth routes after OPTIONS handler
const needle2 = "if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }\n\n  // ─── Auth validation endpoint";
const replace2 = `if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ─── Magic Link Auth Routes ──────────────────────────────────────────
  if (authManager) {
    if (req.url === '/api/auth/magic-link' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || !body.email || !isValidEmail(body.email)) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'Valid email required' }));
        return;
      }
      try {
        await authManager.sendMagicLink(body.email);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ success: true }));
      } catch(e) {
        console.error('Magic link error:', e);
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'Failed to send magic link' }));
      }
      return;
    }

    if (req.url.startsWith('/api/auth/verify') && req.method === 'GET') {
      const u = new URL(req.url, 'http://localhost');
      const token = u.searchParams.get('token');
      if (!token) { res.writeHead(400); res.end('Token required'); return; }
      try {
        const payload = authManager.verifyMagicToken(token);
        const { sessionId } = await authManager.createSession(payload.email);
        const maxAge = 30 * 24 * 60 * 60;
        res.writeHead(302, {
          'Location': '/',
          'Set-Cookie': 'sk_session=' + sessionId + '; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge + '; Path=/'
        });
        res.end();
      } catch(e) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'Invalid or expired link' }));
      }
      return;
    }

    if (req.url === '/api/auth/me' && req.method === 'GET') {
      const cookies = parseCookies(req.headers.cookie || '');
      const user = await authManager.getSessionUser(cookies.sk_session);
      if (!user) { res.writeHead(401, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Not authenticated'})); return; }
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ user }));
      return;
    }

    if (req.url === '/api/auth/sk-logout' && req.method === 'POST') {
      const cookies = parseCookies(req.headers.cookie || '');
      if (cookies.sk_session) await authManager.destroySession(cookies.sk_session);
      res.writeHead(200, {'Content-Type':'application/json','Set-Cookie':'sk_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/'});
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (req.url === '/api/billing/checkout' && req.method === 'POST') {
      const cookies = parseCookies(req.headers.cookie || '');
      const user = await authManager.getSessionUser(cookies.sk_session);
      if (!user) { res.writeHead(401, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Auth required'})); return; }
      try {
        const session = await billingManager.createCheckoutSession(user.email);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ url: session.url }));
      } catch(e) {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (req.url === '/api/billing/portal' && req.method === 'GET') {
      const cookies = parseCookies(req.headers.cookie || '');
      const user = await authManager.getSessionUser(cookies.sk_session);
      if (!user) { res.writeHead(302, {'Location':'/login.html'}); res.end(); return; }
      try {
        const session = await billingManager.createPortalSession(user.email);
        res.writeHead(302, {'Location': session.url});
        res.end();
      } catch(e) {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (req.url === '/api/billing/status' && req.method === 'GET') {
      const cookies = parseCookies(req.headers.cookie || '');
      const user = await authManager.getSessionUser(cookies.sk_session);
      if (!user) { res.writeHead(401, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Auth required'})); return; }
      try {
        const status = await billingManager.getUserBillingStatus(user.email);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify(status));
      } catch(e) {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (req.url === '/login.html') {
      try {
        const html = fs.readFileSync(__dirname + '/login.html', 'utf8');
        res.writeHead(200, {'Content-Type':'text/html'});
        res.end(html);
      } catch(e) {
        res.writeHead(404); res.end('Login page not found');
      }
      return;
    }
  }

  // ─── Auth validation endpoint`;

if (!code.includes('/api/auth/magic-link')) {
  code = code.replace(needle2, replace2);
  console.log('✓ Step 2: Added auth routes');
} else {
  console.log('⏩ Step 2: Already patched');
}

fs.writeFileSync(serverPath, code);
console.log('✓ Server.js patched successfully');
