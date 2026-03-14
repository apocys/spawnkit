module.exports = async function fleetRoutes(req, res, ctx) {
  if (req.url.startsWith('/api/fleet')) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: 'Fleet route working' }));
    return true;
  }
  return false;
};