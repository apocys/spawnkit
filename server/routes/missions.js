module.exports = async function missionRoutes(req, res, ctx) {
  if (req.url.startsWith('/api/oc/missions')) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ missions: [] }));
    return true;
  }
  return false;
};