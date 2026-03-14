'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateSOUL, generateIDENTITY, generateAGENTS } = require('../agent-templates');

module.exports = async function agentsRoutes(req, res, ctx) {
  const { readBody, getAgents, WORKSPACE, OC_GATEWAY, OC_TOKEN } = ctx;

  // ─── Local API routes ────────────────────────────────────

  // ═══ AGENT CREATION SYSTEM ═══════════════════════════════════════════
  const AGENTS_BASE_DIR = path.join(WORKSPACE, 'fleet', 'agents');



  // GET /api/oc/agents — List all agents
  if (req.url === '/api/oc/agents' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { spawnSync } = require('child_process');
      const ocBinList = process.env.OC_BIN || '/home/apocyz_runner/.npm-global/bin/openclaw';
      const spawnEnvList = { ...process.env, PATH: (process.env.PATH || '') + ':/home/apocyz_runner/.npm-global/bin' };
      const result = spawnSync(ocBinList, ['agents', 'list', '--json'], { encoding: 'utf8', timeout: 10000, env: spawnEnvList });
      const agents = JSON.parse(result.stdout || '[]');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, agents }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // POST /api/oc/agents/create — Create a new agent
  if (req.url === '/api/oc/agents/create' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const { name, displayName, role, model, traits, skills, theme, emoji, customInstructions } = body || {};

    if (!name || !displayName) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'name and displayName required' }));
      return true;
    }

    // Sanitize agent name (slug)
    const agentId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const agentDir = path.join(AGENTS_BASE_DIR, agentId);

    try {
      // Check if agent already exists
      if (fs.existsSync(agentDir)) {
        res.writeHead(409);
        res.end(JSON.stringify({ error: 'Agent already exists: ' + agentId }));
        return true;
      }

      // Create workspace directory
      fs.mkdirSync(agentDir, { recursive: true });

      const config = { name: agentId, displayName, role: role || 'General Assistant', model: model || 'sonnet', traits: traits || [], skills: skills || [], theme: theme || 'executive', emoji: emoji || '⚔️', customInstructions: customInstructions || '' };

      // Generate workspace files
      fs.writeFileSync(path.join(agentDir, 'SOUL.md'), generateSOUL(config));
      fs.writeFileSync(path.join(agentDir, 'IDENTITY.md'), generateIDENTITY(config));
      fs.writeFileSync(path.join(agentDir, 'AGENTS.md'), generateAGENTS(config));
      fs.writeFileSync(path.join(agentDir, 'MEMORY.md'), '# MEMORY.md\n\nFresh agent — no memories yet.\n');
      fs.writeFileSync(path.join(agentDir, 'TODO.md'), '# TODO.md\n\nNo tasks yet.\n');
      fs.writeFileSync(path.join(agentDir, 'TOOLS.md'), '# TOOLS.md\n\nStandard tooling.\n');
      fs.writeFileSync(path.join(agentDir, 'USER.md'), '# USER.md\n\nUser context provided by SpawnKit.\n');

      // Copy skills if requested
      if (config.skills.length > 0) {
        const skillsDir = path.join(agentDir, 'skills');
        fs.mkdirSync(skillsDir, { recursive: true });
        // Note: actual skill installation would use clawhub or symlinks
        // For now, create a SKILLS.md reference
        fs.writeFileSync(path.join(agentDir, 'SKILLS.md'), '# Skills\n\n' + config.skills.map(s => '- ' + s).join('\n') + '\n');
      }

      // Register with OpenClaw
      const { spawnSync } = require('child_process');
      const modelMap = { opus: 'claudemax/claude-opus-4-6', sonnet: 'claudemax/claude-sonnet-4-6', codex: 'codex/codex-mini-latest' };
      const modelId = modelMap[config.model] || config.model || modelMap.sonnet;

      // Ensure openclaw binary is on PATH regardless of server launch environment
      const ocBin = process.env.OC_BIN || require('child_process').execSync('which openclaw 2>/dev/null || echo ""').toString().trim() || '/home/apocyz_runner/.npm-global/bin/openclaw';
      const spawnEnv = { ...process.env, PATH: (process.env.PATH || '') + ':/home/apocyz_runner/.npm-global/bin' };

      const addResult = spawnSync(ocBin, [
        'agents', 'add', agentId,
        '--workspace', agentDir,
        '--model', modelId,
        '--non-interactive'
      ], { encoding: 'utf8', timeout: 15000, env: spawnEnv });

      if (addResult.error || addResult.status !== 0) {
        // Clean up on failure
        fs.rmSync(agentDir, { recursive: true, force: true });
        const detail = (addResult.stderr || addResult.stdout || addResult.error?.message || '').slice(0, 500);
        console.error('[agents] openclaw agents add failed:', detail, 'status:', addResult.status, 'bin:', ocBin);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'openclaw agents add failed', detail }));
        return true;
      }

      // Set identity
      spawnSync(ocBin, [
        'agents', 'set-identity',
        '--agent', agentId,
        '--from-identity',
        '--workspace', agentDir
      ], { encoding: 'utf8', timeout: 10000, env: spawnEnv });

      console.log('[SpawnKit] Agent Creation v2.1.0-medieval-agents — created agent:', agentId, 'workspace:', agentDir);

      res.writeHead(201);
      res.end(JSON.stringify({ ok: true, agentId, displayName, workspace: agentDir, model: modelId }));
    } catch (e) {
      console.error('[agents] Creation error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Agent creation failed', detail: e.message }));
    }
    return true;
  }

  // DELETE /api/oc/agents/:id
  const agentDeleteMatch = req.url.match(/^\/api\/oc\/agents\/([a-z0-9-]+)$/) ;
  if (agentDeleteMatch && req.method === 'DELETE') {
    res.setHeader('Content-Type', 'application/json');
    const agentId = agentDeleteMatch[1];
    if (agentId === 'main') {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Cannot delete main agent' }));
      return true;
    }
    try {
      const { spawnSync } = require('child_process');
      const ocBinDel = process.env.OC_BIN || '/home/apocyz_runner/.npm-global/bin/openclaw';
      const spawnEnvDel = { ...process.env, PATH: (process.env.PATH || '') + ':/home/apocyz_runner/.npm-global/bin' };
      const result = spawnSync(ocBinDel, ['agents', 'delete', agentId, '--force'], { encoding: 'utf8', timeout: 10000, env: spawnEnvDel });
      // Also remove workspace
      const agentDir = path.join(AGENTS_BASE_DIR, agentId);
      if (fs.existsSync(agentDir)) fs.rmSync(agentDir, { recursive: true, force: true });
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, deleted: agentId }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // POST /api/oc/agents/:id/chat — Send message to a specific agent
  const agentChatMatch = req.url.match(/^\/api\/oc\/agents\/([a-z0-9-]+)\/chat$/);
  if (agentChatMatch && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const agentId = agentChatMatch[1];
    const body = await readBody(req);
    const message = body?.message;
    if (!message) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing message' }));
      return true;
    }
    try {
      const resp = await fetch(OC_GATEWAY + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OC_TOKEN },
        body: JSON.stringify({
          model: 'openclaw:' + agentId,
          messages: [{ role: 'user', content: message }],
          stream: false,
        }),
      });
      if (!resp.ok) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Gateway error', status: resp.status }));
        return true;
      }
      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content || '(No response)';
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, reply, agentId }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // ═══ END AGENT CREATION SYSTEM ═══════════════════════════════════════

    // ── MCP Server Management ────────────────────────────────────────────
  const OC_CONFIG_PATH = path.join(process.env.HOME || '', '.openclaw', 'openclaw.json');

  function readOcConfig() {
    try { return JSON.parse(fs.readFileSync(OC_CONFIG_PATH, 'utf8')); } catch(e) { return {}; }
  }
  function writeOcConfig(config) {
    fs.writeFileSync(OC_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  }

  if (req.url === '/api/oc/mcp' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const config = readOcConfig();
      // MCP servers can live under tools.mcpServers (OpenClaw convention)
      const mcpServers = config.tools?.mcpServers || {};
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, servers: mcpServers }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  if (req.url === '/api/oc/mcp' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const { name, transport, command, url: mcpUrl, env: mcpEnv } = body || {};
    if (!name) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing server name' }));
      return true;
    }
    try {
      const config = readOcConfig();
      if (!config.tools) config.tools = {};
      if (!config.tools.mcpServers) config.tools.mcpServers = {};
      const entry = { transport: transport || 'stdio' };
      if (transport === 'sse' && mcpUrl) entry.url = mcpUrl;
      else if (command) entry.command = command;
      if (mcpEnv && typeof mcpEnv === 'object' && Object.keys(mcpEnv).length > 0) entry.env = mcpEnv;
      config.tools.mcpServers[name] = entry;
      writeOcConfig(config);
      console.log('[mcp] Added MCP server:', name);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, server: name }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  if (req.url.startsWith('/api/oc/mcp/') && req.method === 'DELETE') {
    res.setHeader('Content-Type', 'application/json');
    const serverName = decodeURIComponent(req.url.replace('/api/oc/mcp/', '').split('?')[0]);
    if (!serverName) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing server name' }));
      return true;
    }
    try {
      const config = readOcConfig();
      if (config.tools?.mcpServers?.[serverName]) {
        delete config.tools.mcpServers[serverName];
        writeOcConfig(config);
        console.log('[mcp] Removed MCP server:', serverName);
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, removed: serverName }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // ── Agent Configuration ───────────────────────────────────────────────
  if (req.url.replace(/\?.*/, '') === '/api/oc/agents/config' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const config = readOcConfig();
      const agentsConfig = config.agents || {};
      const queryAgentId = new URL(req.url, 'http://localhost').searchParams.get('agentId');
      // Read per-agent files from fleet/agents/
      const agentsDir = path.join(WORKSPACE, 'fleet', 'agents');
      const agentFiles = {};
      if (fs.existsSync(agentsDir)) {
        const dirs = queryAgentId ? [queryAgentId] : fs.readdirSync(agentsDir);
        dirs.forEach(function(dir) {
          const configPath = path.join(agentsDir, dir, 'config.json');
          if (fs.existsSync(configPath)) {
            try { agentFiles[dir] = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch(e) {}
          }
        });
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, global: queryAgentId ? undefined : agentsConfig, agents: agentFiles }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  if (req.url === '/api/oc/agents/config' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const { agentId, model, skills, traits, name: agentName } = body || {};
    if (!agentId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing agentId' }));
      return true;
    }
    try {
      // Persist to fleet/agents/<agentId>/config.json
      const agentsDir = path.join(WORKSPACE, 'fleet', 'agents');
      const agentDir = path.join(agentsDir, agentId);
      if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true });
      const configPath = path.join(agentDir, 'config.json');
      let existing = {};
      if (fs.existsSync(configPath)) {
        try { existing = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch(e) {}
      }
      if (model) existing.model = model;
      if (skills) existing.skills = skills;
      if (traits) existing.traits = traits;
      if (agentName) existing.name = agentName;
      existing.updatedAt = new Date().toISOString();
      fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf8');
      console.log('[agents] Updated config for:', agentId);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, agentId, config: existing }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }


  return false; // no route matched
};
