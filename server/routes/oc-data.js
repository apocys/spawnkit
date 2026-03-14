const { getAgents, getSessions, getMemory, getChat, getConfig, getCrons, getTasks, getSkills } = require('../lib/oc-reader');

module.exports = async function ocDataRoutes(req, res, ctx) {
  if (req.url.startsWith('/api/oc/') && 
      !req.url.startsWith('/api/oc/missions') && 
      !req.url.startsWith('/api/oc/agents') && 
      !req.url.startsWith('/api/oc/chat')) {
    
    res.setHeader('Content-Type', 'application/json');
    const route = req.url.replace(/\?.*/, '');
    
    let data;
    switch(route) {
      case '/api/oc/sessions': data = getSessions(); break;
      case '/api/oc/memory': data = getMemory(); break;
      case '/api/oc/config': data = getConfig(); break;
      case '/api/oc/crons': data = getCrons(); break;
      case '/api/oc/tasks': data = getTasks(); break;
      case '/api/oc/skills': data = getSkills(); break;
      case '/api/oc/health': data = { ok: true, uptime: process.uptime() }; break;
      default: 
        res.writeHead(404); 
        res.end(JSON.stringify({error:'not found'})); 
        return true;
    }
    res.writeHead(200);
    res.end(JSON.stringify(data));
    return true;
  }
  return false;
};