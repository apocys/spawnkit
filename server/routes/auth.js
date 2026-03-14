module.exports = async function authRoutes(req, res, ctx) {
  // Handle auth routes - simplified for testing
  if (req.url.startsWith('/api/auth')) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: 'Auth route working' }));
    return true;
  }
  return false;
};