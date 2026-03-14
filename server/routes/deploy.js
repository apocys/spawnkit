module.exports = async function deployRoutes(req, res, ctx) {
  if (req.url.startsWith('/api/deploy')) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(502);
    res.end(JSON.stringify({ error: 'Deploy service not available in test mode' }));
    return true;
  }
  return false;
};