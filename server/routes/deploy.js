'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function deployRoutes(req, res, ctx) {
  const { readBody, proxyFetch, proxyRequest, WORKSPACE } = ctx;

  // ─── Deploy Assets (static files for cloud-init) ────────────────────
  if (req.url.startsWith('/api/deploy/assets/') && req.method === 'GET') {
    const assetName = req.url.replace('/api/deploy/assets/', '').split('?')[0];
    const ASSETS_DIR = require('path').join(process.env.HOME || '/home/apocyz_runner', 'managed-deploy');
    const assetPath = require('path').join(ASSETS_DIR, assetName);
    // Security: only serve files directly in ASSETS_DIR (no path traversal)
    // Block dotfiles (.env, .htpasswd, etc.) and restrict to allowed extensions
    const allowedExts = new Set(['.js', '.json', '.gz', '.tar', '.sh', '.txt', '.yaml', '.yml']);
    const assetExt = require('path').extname(assetName);
    if (
      !assetPath.startsWith(ASSETS_DIR) ||
      assetName.includes('..') ||
      assetName.includes('/') ||
      assetName.startsWith('.') ||
      assetName.includes('/.') ||
      !allowedExts.has(assetExt)
    ) {
      res.writeHead(403, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'forbidden'}));
      return true;
    }
    try {
      const data = require('fs').readFileSync(assetPath);
      const ext = require('path').extname(assetName);
      const mime = {'.js':'application/javascript','.json':'application/json','.gz':'application/gzip','.tar':'application/x-tar','.sh':'text/x-shellscript'}[ext] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': mime, 'Content-Length': data.length, 'Cache-Control': 'public, max-age=300'});
      res.end(data);
    } catch(e) {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'Asset not found: ' + assetName}));
    }
    return true;
  }

  // ─── Deploy Provisioning Proxy (routes to provisioning API on :3456) ────
  if (req.url.startsWith('/api/deploy/') && (req.method === 'POST' || req.method === 'GET')) {
    // Auth: require Bearer token OR same-origin (dashboard UI)
    const deployAuthHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const deployOrigin = req.headers.origin || '';
    const deployReferer = req.headers.referer || '';
    const deploySelfHosts = ['app.spawnkit.ai', 'localhost:' + PORT, '127.0.0.1:' + PORT];
    const deployIsSameOrigin = deploySelfHosts.some(h => deployOrigin.includes(h) || deployReferer.includes(h));
    if (!deployIsSameOrigin && (!OC_TOKEN || deployAuthHeader !== OC_TOKEN)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return true;
    }
    const provisionUrl = 'http://localhost:3456' + req.url;
    const DEPLOY_BYPASS_CODE = process.env.DEPLOY_ACCESS_CODE || '';

    if (req.method === 'POST') {
      // Handle POST: read body, check for useServerBypass flag
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          // If useServerBypass flag is set, inject the server-side bypass code
          if (data.useServerBypass && DEPLOY_BYPASS_CODE) {
            data.accessCode = DEPLOY_BYPASS_CODE;
            delete data.useServerBypass;
          }

          const proxyReq = require('http').request(provisionUrl, {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
          }, (proxyRes) => {
            let responseData = '';
            proxyRes.on('data', c => responseData += c);
            proxyRes.on('end', () => {
              res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
              res.end(responseData);
            });
          });
          proxyReq.on('error', (e) => {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Provisioning service unavailable: ' + e.message }));
          });
          proxyReq.on('timeout', () => {
            proxyReq.destroy();
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Provisioning service timeout' }));
          });
          proxyReq.write(JSON.stringify(data));
          proxyReq.end();
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
      });
    } else {
      // Handle GET: simple proxy
      const proxyReq = require('http').request(provisionUrl, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }, (proxyRes) => {
        let data = '';
        proxyRes.on('data', c => data += c);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });
      proxyReq.on('error', (e) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Provisioning service unavailable: ' + e.message }));
      });
      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Provisioning service timeout' }));
      });
      proxyReq.end();
    }
    return true;
  }

    // ─── Version & Update endpoints ───────────────────────────
  if (req.url === '/api/oc/version' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const versionInfo = getLatestVersion();
    res.writeHead(200);
    res.end(JSON.stringify(versionInfo));
    return true;
  }

  if (req.url === '/api/oc/update' && req.method === 'POST') {
    // Auth check — require SK_API_TOKEN
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '');
    if (!UPDATE_TOKEN || token !== UPDATE_TOKEN) {
      res.writeHead(401, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return true;
    }
    res.setHeader('Content-Type', 'application/json');
    const result = performUpdate();
    res.writeHead(result.ok ? 200 : 500);
    res.end(JSON.stringify(result));
    return true;
  }



  return false; // no route matched
};
