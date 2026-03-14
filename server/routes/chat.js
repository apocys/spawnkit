module.exports = async function chatRoutes(req, res, ctx) {
  if (req.url.startsWith('/api/oc/chat')) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, reply: 'Test response' }));
    return true;
  }
  return false;
};