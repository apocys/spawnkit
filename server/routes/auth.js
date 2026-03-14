'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async function authRoutes(req, res, ctx) {
  const { readBody, proxyFetch, WORKSPACE } = ctx;

  if (req.url === '/api/auth/validate' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.url) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Missing gateway URL' }));
      return true;
    }
    // Try to reach the gateway's health endpoint
    const gatewayUrl = body.url.replace(/\/+$/, '');
    const token = body.token || '';
    const result = await proxyFetch(gatewayUrl + '/api/oc/health', token);
    res.setHeader('Content-Type', 'application/json');
    if (result.ok) {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, gateway: gatewayUrl, health: result.data }));
    } else {
      res.writeHead(502);
      res.end(JSON.stringify({ ok: false, error: result.error || 'Gateway unreachable', status: result.status }));
    }
    return true;
  }

  // ─── Remote proxy endpoint ───────────────────────────────
  if (req.url === '/api/auth/google' && req.method === 'POST') {
    const body = await readBody(req);
    const credential = body && body.credential;
    if (!credential) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Missing credential (Google ID token)' }));
      return true;
    }
    try {
      // Verify the ID token with Google
      const https = require('https');
      const verifyResult = await new Promise(function (resolve, reject) {
        https.get('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), function (resp) {
          let data = '';
          resp.on('data', function (c) { data += c; });
          resp.on('end', function () {
            try { resolve({ status: resp.statusCode, data: JSON.parse(data) }); }
            catch (e) { reject(e); }
          });
        }).on('error', reject);
      });

      if (verifyResult.status !== 200 || verifyResult.data.error) {
        res.writeHead(401, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'Invalid Google token', detail: verifyResult.data.error || 'verification failed' }));
        return true;
      }

      const googleUser = verifyResult.data;
      const userProfile = {
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        picture: googleUser.picture || '',
        sub: googleUser.sub,
        emailVerified: googleUser.email_verified === 'true'
      };

      // Store user profile in workspace
      const profilePath = require('path').join(WORKSPACE, '.spawnkit-user.json');
      try {
        fs.writeFileSync(profilePath, JSON.stringify(userProfile, null, 2));
      } catch(e) { /* non-critical */ }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, user: userProfile }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Google verification failed: ' + e.message }));
    }
    return true;
  }

  // GET /api/auth/user — get current user profile
  if (req.url === '/api/auth/user' && req.method === 'GET') {
    const profilePath = require('path').join(WORKSPACE, '.spawnkit-user.json');
    try {
      if (fs.existsSync(profilePath)) {
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, user: profile }));
      } else {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: true, user: null }));
      }
    } catch(e) {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, user: null }));
    }
    return true;
  }

  // POST /api/auth/logout — clear user profile
  if (req.url === '/api/auth/logout' && req.method === 'POST') {
    const profilePath = require('path').join(WORKSPACE, '.spawnkit-user.json');
    try { fs.unlinkSync(profilePath); } catch(e) {}
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

    // ─── Channel OAuth & Verification Routes ──────────────────
  const CHANNELS_FILE = path.join(WORKSPACE, '.spawnkit-channels.json');

  function readChannels() {
    try { return JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8')); }
    catch(e) { return {}; }
  }

  function writeChannels(data) {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(data, null, 2));
  }


  return false; // no route matched
};
