#!/usr/bin/env node
/**
 * Medieval Theme Development Server
 * Temporary server to fix the blue screen issue in medieval theme
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8766;
const MEDIEVAL_DIR = path.join(__dirname, 'server/office-medieval');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log('[Medieval Dev]', req.method, req.url);
  
  // Proxy API calls to main server
  if (req.url.startsWith('/api/')) {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 8765,
      path: req.url,
      method: req.method,
      headers: req.headers
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    
    req.pipe(proxyReq);
    return;
  }
  
  // Serve static files
  let filePath = req.url.split('?')[0];
  if (filePath === '/' || filePath === '/office-medieval/' || filePath === '/office-medieval') {
    filePath = '/index.html';
  }
  
  // Remove leading slash
  if (filePath.startsWith('/')) {
    filePath = filePath.substring(1);
  }
  
  const fullPath = path.join(MEDIEVAL_DIR, filePath);
  
  // Security check
  if (!fullPath.startsWith(MEDIEVAL_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not found: ' + filePath);
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }
    
    const ext = path.extname(fullPath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const cachePolicy = ext === '.html' ? 'no-store, no-cache, must-revalidate' : 'max-age=3600';
    
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': cachePolicy
    });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏰 Medieval Dev Server running on http://localhost:${PORT}`);
  console.log(`   Serving: ${MEDIEVAL_DIR}`);
  console.log(`   API Proxy: http://localhost:8765/api/*`);
  console.log(`   Access: http://localhost:${PORT}/`);
});