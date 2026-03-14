module.exports = async function agentRoutes(req, res, ctx) {
  if (req.url.startsWith('/api/oc/agents') || req.url.startsWith('/api/oc/mcp')) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, agents: [] }));
    return true;
  }
  return false;
};