'use strict';

module.exports = async function subagentRoutes(req, res, ctx) {
  const { readBody, OC_GATEWAY, OC_TOKEN } = ctx;

  // POST /api/spawn-subagent — Spawn sub-agent for arena battles
  if (req.url === '/api/spawn-subagent' && req.method === 'POST') {
    if (cors(req, res)) return true;
    if (!token) { res.writeHead(401); res.end(JSON.stringify({error:'unauthorized'})); return; }
    const body = await readBody(req);
    try {
      const data = JSON.parse(body);
      const result = await proxyRequest('POST', gatewayUrl + '/api/oc/sessions/spawn', token, data);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({error: e.message}));
    }
    return true;
  }

  // POST /api/subagent-status — Get sub-agent status
  if (req.url === '/api/subagent-status' && req.method === 'POST') {
    if (cors(req, res)) return true;
    if (!token) { res.writeHead(401); res.end(JSON.stringify({error:'unauthorized'})); return; }
    const body = await readBody(req);
    try {
      const data = JSON.parse(body);
      const result = await proxyRequest('GET', gatewayUrl + '/api/oc/sessions/' + data.sessionKey, token);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({error: e.message}));
    }
    return true;
  }

  // Static files


  return false; // no route matched
};
