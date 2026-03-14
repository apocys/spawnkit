'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { proxyFetch } = require('../lib/proxy-client');

module.exports = async function setupRoutes(req, res, ctx) {
  const { readBody, OC_GATEWAY, OC_TOKEN, WORKSPACE, SESSIONS_FILE } = ctx;

  // ── Setup Wizard API ──────────────────────────────────────

  // GET /api/setup/status — aggregate status of all 6 setup steps
  if (req.url === '/api/setup/status' && req.method === 'GET') {
    cors(res);
    try {
      const fs = require('fs');
      const path = require('path');
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      const steps = [
        { id: 'cliproxy', name: 'CLIProxyAPI', status: 'pending', details: '' },
        { id: 'gateway', name: 'OpenClaw Gateway', status: 'pending', details: '' },
        { id: 'channels', name: 'Channels', status: 'pending', details: '' },
        { id: 'fleet', name: 'Fleet Nodes', status: 'pending', details: '' },
        { id: 'skills', name: 'Skills', status: 'pending', details: '' },
        { id: 'test', name: 'End-to-End Test', status: 'pending', details: 'Run manually' }
      ];

      // Step 0: CLIProxyAPI
      try {
        const response = await fetch('http://127.0.0.1:8317/v1/models');
        if (response.ok) {
          const data = await response.json();
          const modelCount = data?.data?.length || 0;
          if (modelCount > 0) {
            steps[0].status = 'done';
            steps[0].details = `${modelCount} models available`;
          } else {
            steps[0].details = 'No models found';
          }
        }
      } catch (e) {
        steps[0].details = 'Not running';
      }

      // Step 1: Gateway
      try {
        const ocToken = process.env.OC_TOKEN;
        const ocGateway = process.env.OC_GATEWAY || 'http://localhost:18789';
        if (ocToken) {
          const response = await fetch(`${ocGateway}/api/status`, {
            headers: { 'Authorization': `Bearer ${ocToken}` }
          });
          if (response.ok) {
            steps[1].status = 'done';
            steps[1].details = 'Gateway responding';
          } else {
            steps[1].details = 'Gateway not responding';
          }
        } else {
          steps[1].details = 'OC_TOKEN not set';
        }
      } catch (e) {
        steps[1].details = 'Gateway not reachable';
      }

      // Step 2: Channels
      try {
        const configPath = path.join(process.env.HOME, '.openclaw', 'config.yaml');
        if (fs.existsSync(configPath)) {
          const config = fs.readFileSync(configPath, 'utf8');
          if (config.includes('channels:') || config.includes('telegram:') || config.includes('discord:')) {
            steps[2].status = 'done';
            steps[2].details = 'Channels configured';
          } else {
            steps[2].details = 'No channels found in config';
          }
        } else {
          steps[2].details = 'Config file not found';
        }
      } catch (e) {
        steps[2].details = 'Config read error';
      }

      // Step 3: Fleet
      try {
        const sessionsPath = path.join(process.env.HOME, '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
        if (fs.existsSync(sessionsPath)) {
          const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
          const nodeCount = Object.keys(sessions).filter(k => k.startsWith('node:')).length;
          if (nodeCount > 0) {
            steps[3].status = 'done';
            steps[3].details = `${nodeCount} nodes paired`;
          } else {
            steps[3].details = 'No nodes paired';
          }
        } else {
          steps[3].details = 'Sessions file not found';
        }
      } catch (e) {
        steps[3].details = 'Sessions read error';
      }

      // Step 4: Skills
      try {
        const skillsPath = path.join(process.env.HOME, '.openclaw', 'workspace', 'skills');
        if (fs.existsSync(skillsPath)) {
          const skillDirs = fs.readdirSync(skillsPath).filter(d => 
            fs.statSync(path.join(skillsPath, d)).isDirectory()
          );
          if (skillDirs.length > 0) {
            steps[4].status = 'done';
            steps[4].details = `${skillDirs.length} skills installed`;
          } else {
            steps[4].details = 'No skills found';
          }
        } else {
          steps[4].details = 'Skills directory not found';
        }
      } catch (e) {
        steps[4].details = 'Skills check error';
      }

      const completedCount = steps.filter(s => s.status === 'done').length;

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        steps, 
        completedCount, 
        totalCount: steps.length 
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // GET /api/setup/cliproxy — detect CLIProxyAPI status
  if (req.url === '/api/setup/cliproxy' && req.method === 'GET') {
    cors(res);
    try {
      const fs = require('fs');
      const path = require('path');

      let running = false;
      let models = [];
      let providers = [];

      try {
        const response = await fetch('http://127.0.0.1:8317/v1/models');
        if (response.ok) {
          running = true;
          const data = await response.json();
          models = (data?.data || []).map(m => ({
            id: m.id,
            provider: m.id.split('-')[0] // claude, gpt, gemini, etc.
          }));
        }
      } catch (e) {
        // CLIProxyAPI not running
      }

      // Check auth files
      const authDir = path.join(process.env.HOME, '.cli-proxy-api');
      const providerMap = { claude: 'claude', gemini: 'gemini', codex: 'codex' };

      Object.entries(providerMap).forEach(([name, prefix]) => {
        const modelCount = models.filter(m => m.provider === prefix).length;
        let authenticated = false;

        // Check for auth files (varies by provider)
        try {
          const authFiles = [
            path.join(authDir, `${name}_auth.json`),
            path.join(authDir, `${name}.json`),
            path.join(authDir, `auth_${name}.json`)
          ];
          authenticated = authFiles.some(f => fs.existsSync(f));
        } catch (e) {}

        providers.push({ name, authenticated, modelCount });
      });

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        running, 
        models, 
        providers, 
        totalModels: models.length 
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // POST /api/setup/cliproxy/login — trigger CLIProxyAPI OAuth login
  if (req.url === '/api/setup/cliproxy/login' && req.method === 'POST') {
    cors(res);
    try {
      const body = await readBody(req);
      if (!body || !body.provider) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'provider required' }));
        return true;
      }

      const { spawn } = require('child_process');
      const path = require('path');

      // Map provider to CLI flag
      const flagMap = {
        claude: '-claude-login',
        gemini: '-login',
        codex: '-codex-login'
      };

      const flag = flagMap[body.provider];
      if (!flag) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unknown provider' }));
        return true;
      }

      const configPath = path.join(process.env.HOME, '.cli-proxy-api', 'config.yaml');
      const command = ['cliproxyapi', flag, '-config', configPath];

      // Start OAuth process (non-blocking)
      const child = spawn(command[0], command.slice(1), { 
        detached: true, 
        stdio: 'ignore' 
      });
      child.unref();

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        message: `OAuth flow started for ${body.provider}`,
        command: command.join(' ')
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // GET /api/setup/gateway — check OpenClaw gateway status
  if (req.url === '/api/setup/gateway' && req.method === 'GET') {
    cors(res);
    try {
      const fs = require('fs');
      const path = require('path');

      let running = false;
      let version = '';
      let config = { defaultModel: '', channels: [] };

      // Check gateway status
      try {
        const ocToken = process.env.OC_TOKEN;
        const ocGateway = process.env.OC_GATEWAY || 'http://localhost:18789';

        if (ocToken) {
          const response = await fetch(`${ocGateway}/api/status`, {
            headers: { 'Authorization': `Bearer ${ocToken}` }
          });
          if (response.ok) {
            running = true;
            const data = await response.json();
            version = data?.version || 'unknown';
          }
        }
      } catch (e) {
        // Gateway not running
      }

      // Read config
      try {
        const configPath = path.join(process.env.HOME, '.openclaw', 'config.yaml');
        if (fs.existsSync(configPath)) {
          const configText = fs.readFileSync(configPath, 'utf8');

          // Extract default model
          const modelMatch = configText.match(/defaultModel:\s*(.+)/);
          if (modelMatch) config.defaultModel = modelMatch[1].trim();

          // Extract channels (simple parsing)
          const channelMatches = configText.match(/channels:\s*\n([\s\S]*?)(?=\n\w|\n$)/);
          if (channelMatches) {
            const channelText = channelMatches[1];
            const channels = [];
            if (channelText.includes('telegram:')) channels.push('telegram');
            if (channelText.includes('discord:')) channels.push('discord');
            config.channels = channels;
          }
        }
      } catch (e) {
        // Config read error
      }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        running, 
        version, 
        config 
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // GET /api/setup/fleet — list paired nodes
  if (req.url === '/api/setup/fleet' && req.method === 'GET') {
    cors(res);
    try {
      const { execSync } = require('child_process');
      const fs = require('fs');
      const path = require('path');

      let nodes = [];

      // Try openclaw command first
      try {
        const output = execSync('openclaw nodes status --json', { encoding: 'utf8' });
        const data = JSON.parse(output);
        nodes = data?.nodes || [];
      } catch (e) {
        // Fallback to reading sessions file
        try {
          const sessionsPath = path.join(process.env.HOME, '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
          if (fs.existsSync(sessionsPath)) {
            const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
            nodes = Object.entries(sessions)
              .filter(([key]) => key.startsWith('node:'))
              .map(([key, data]) => ({
                id: key.replace('node:', ''),
                name: data?.name || 'Unknown',
                os: data?.os || 'Unknown',
                lastSeen: data?.lastSeen || null,
                status: data?.status || 'unknown'
              }));
          }
        } catch (e2) {
          // No nodes found
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        nodes 
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // POST /api/setup/test — run end-to-end test
  if (req.url === '/api/setup/test' && req.method === 'POST') {
    cors(res);
    try {
      const ocToken = process.env.OC_TOKEN;
      const ocGateway = process.env.OC_GATEWAY || 'http://localhost:18789';

      if (!ocToken) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          ok: true, 
          success: false, 
          responseTime: 0, 
          agentReply: 'OC_TOKEN not set' 
        }));
        return true;
      }

      const startTime = Date.now();

      try {
        const response = await fetch(`${ocGateway}/api/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ocToken}`
          },
          body: JSON.stringify({ message: 'ping' })
        });

        const responseTime = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json();
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ 
            ok: true, 
            success: true, 
            responseTime, 
            agentReply: data?.reply || 'pong'
          }));
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ 
            ok: true, 
            success: false, 
            responseTime, 
            agentReply: `HTTP ${response.status}`
          }));
        }
      } catch (e) {
        const responseTime = Date.now() - startTime;
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ 
          ok: true, 
          success: false, 
          responseTime, 
          agentReply: e.message
        }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // ─── AI Provider Setup API ────────────────────────────────

  // GET /api/wizard/providers — list available provider presets
  if (req.url === '/api/wizard/providers' && req.method === 'GET') {
    const providers = [
      {
        id: 'recommended', name: '✨ Recommended', icon: '✨',
        description: 'Best AI model, automatically configured — just works',
        authType: 'auto', badge: 'Best for most users',
        models: [
          { id: 'claude-sonnet-4-6', name: 'Smart & Fast', recommended: true }
        ],
        config: { baseUrl: 'https://api.anthropic.com/v1', api: 'anthropic' },
        autoConfig: true
      },
      {
        id: 'anthropic', name: 'Anthropic', icon: '🟣', description: 'Claude models (Opus, Sonnet, Haiku)',
        authType: 'api_key', keyPlaceholder: 'sk-ant-...',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        advanced: true,
        models: [
          { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', recommended: true },
          { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
          { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5' }
        ],
        config: { baseUrl: 'https://api.anthropic.com/v1', api: 'anthropic' }
      },
      {
        id: 'openai', name: 'OpenAI', icon: '🟢', description: 'GPT models (GPT-5, GPT-4o)',
        authType: 'api_key', keyPlaceholder: 'sk-...', advanced: true,
        keyUrl: 'https://platform.openai.com/api-keys',
        models: [
          { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', recommended: true },
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
        ],
        config: { baseUrl: 'https://api.openai.com/v1', api: 'openai-completions' }
      },
      {
        id: 'cliproxy', name: 'CLIProxyAPI', icon: '🔵', description: 'Claude via CLI Proxy — uses your Max/Pro subscription, no API costs',
        authType: 'oauth', oauthUrl: '/api/wizard/providers/cliproxy/auth', advanced: true,
        models: [
          { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (Max)', recommended: true },
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Max)' },
          { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (Max)' }
        ],
        config: { baseUrl: 'http://127.0.0.1:8317/v1', api: 'openai-completions' }
      },
      {
        id: 'ollama', name: 'Ollama (Local)', icon: '🦙', description: 'Run models locally — free, private, no API key needed',
        authType: 'none', advanced: true,
        models: [
          { id: 'llama3.3', name: 'Llama 3.3 70B', recommended: true },
          { id: 'qwen2.5', name: 'Qwen 2.5 72B' },
          { id: 'glm-4.7-flash', name: 'GLM 4.7 Flash' }
        ],
        config: { baseUrl: 'http://localhost:11434/v1', api: 'openai-completions' }
      }
    ];
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, providers }));
    return true;
  }

  // POST /api/wizard/providers/setup — configure a provider in OpenClaw
  if (req.url === '/api/wizard/providers/setup' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.providerId || !body.modelId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'providerId and modelId required' }));
        return true;
      }

      const { spawnSync } = require('child_process');
      const results = [];

      // Provider presets
      const presets = {
        recommended: {
          config: { api: 'anthropic' },
          baseUrl: 'https://api.anthropic.com/v1',
          authProfile: 'anthropic:default'
        },
        anthropic: {
          config: { api: 'anthropic' },
          baseUrl: 'https://api.anthropic.com/v1',
          authProfile: 'anthropic:default'
        },
        openai: {
          config: { api: 'openai-completions' },
          baseUrl: 'https://api.openai.com/v1',
          authProfile: 'openai:default'
        },
        cliproxy: {
          config: { api: 'openai-completions' },
          baseUrl: 'http://127.0.0.1:8317/v1',
          authProfile: 'openai:cliproxy'
        },
        ollama: {
          config: { api: 'openai-completions' },
          baseUrl: 'http://localhost:11434/v1',
          authProfile: 'openai:ollama'
        }
      };

      const preset = presets[body.providerId];
      if (!preset) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unknown provider: ' + body.providerId }));
        return true;
      }

      // Build provider config
      const providerConfig = {
        baseUrl: body.baseUrl || preset.baseUrl,
        api: preset.config.api,
        models: [{
          id: body.modelId,
          name: body.modelName || body.modelId,
          reasoning: false,
          input: ['text', 'image'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 200000,
          maxTokens: 8192
        }]
      };

      // Add API key if provided (not for ollama/cliproxy-oauth)
      if (body.apiKey) {
        providerConfig.apiKey = body.apiKey;
      }

      // Set provider config via openclaw CLI
      const setProvider = spawnSync('openclaw', [
        'config', 'set',
        'models.providers.' + body.providerId,
        JSON.stringify(providerConfig)
      ], { timeout: 10000, encoding: 'utf8' });

      if (setProvider.error || setProvider.status !== 0) {
        results.push({ step: 'provider', status: 'failed', error: (setProvider.stderr || '').slice(0, 200) });
      } else {
        results.push({ step: 'provider', status: 'ok' });
      }

      // Set as default model
      const modelPath = body.providerId + '/' + body.modelId;
      const setModel = spawnSync('openclaw', [
        'config', 'set',
        'agents.defaults.model.primary',
        JSON.stringify(modelPath)
      ], { timeout: 10000, encoding: 'utf8' });

      if (setModel.error || setModel.status !== 0) {
        results.push({ step: 'default-model', status: 'failed', error: (setModel.stderr || '').slice(0, 200) });
      } else {
        results.push({ step: 'default-model', status: 'ok' });
      }

      // Set auth profile if API key provided
      if (body.apiKey && body.providerId !== 'ollama') {
        const authMode = body.providerId === 'anthropic' ? 'anthropic' : 'openai';
        const setAuth = spawnSync('openclaw', [
          'config', 'set',
          'auth.profiles.' + preset.authProfile,
          JSON.stringify({ provider: authMode, mode: 'api_key' })
        ], { timeout: 10000, encoding: 'utf8' });
        results.push({ step: 'auth', status: (setAuth.error || setAuth.status !== 0) ? 'failed' : 'ok' });
      }

      // Set model alias
      const setAlias = spawnSync('openclaw', [
        'config', 'set',
        'agents.defaults.models.' + modelPath,
        JSON.stringify({ alias: body.providerId })
      ], { timeout: 10000, encoding: 'utf8' });
      results.push({ step: 'alias', status: (setAlias.error || setAlias.status !== 0) ? 'failed' : 'ok' });

      const allOk = results.every(function(r) { return r.status === 'ok'; });

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(allOk ? 200 : 207);
      res.end(JSON.stringify({
        ok: allOk,
        model: modelPath,
        results,
        message: allOk ? 'Provider configured. Restart gateway to apply.' : 'Some steps failed — check results.',
        needsRestart: true
      }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // POST /api/wizard/providers/test — test a provider connection
  if (req.url === '/api/wizard/providers/test' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.baseUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'baseUrl required' }));
        return true;
      }

      const testUrl = body.baseUrl.replace(/\/+$/, '') + '/models';
      const headers = {};
      if (body.apiKey) headers['Authorization'] = 'Bearer ' + body.apiKey;
      if (body.apiKey && body.provider === 'anthropic') {
        headers['x-api-key'] = body.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      }

      const proto = testUrl.startsWith('https') ? require('https') : require('http');
      const testResult = await new Promise(function(resolve) {
        const r = proto.get(testUrl, { headers, timeout: 5000 }, function(resp) {
          let data = '';
          resp.on('data', function(c) { data += c; });
          resp.on('end', function() {
            if (resp.statusCode >= 200 && resp.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                const models = parsed.data || parsed.models || [];
                resolve({ ok: true, models: models.slice(0, 10).map(function(m) { return { id: m.id, name: m.id }; }) });
              } catch(e) { resolve({ ok: true, models: [] }); }
            } else {
              resolve({ ok: false, status: resp.statusCode, error: data.slice(0, 200) });
            }
          });
        });
        r.on('error', function(e) { resolve({ ok: false, error: e.message }); });
        r.on('timeout', function() { r.destroy(); resolve({ ok: false, error: 'Connection timeout' }); });
      });

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(testResult));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // ─── Setup Wizard API ─────────────────────────────────────
  const BLUEPRINTS_DIR = require('path').join(__dirname, 'blueprints');

  // GET /api/wizard/blueprints — list available blueprints
  if (req.url === '/api/wizard/blueprints' && req.method === 'GET') {
    try {
      const fs = require('fs');
      const path = require('path');
      const dirs = fs.readdirSync(BLUEPRINTS_DIR).filter(d => 
        fs.statSync(path.join(BLUEPRINTS_DIR, d)).isDirectory()
      );
      const blueprints = dirs.map(d => {
        try {
          const yaml = fs.readFileSync(path.join(BLUEPRINTS_DIR, d, 'config.yaml'), 'utf8');
          const name = (yaml.match(/^name:\s*(.+)$/m) || [])[1] || d;
          const desc = (yaml.match(/^description:\s*"?(.+?)"?\s*$/m) || [])[1] || '';
          const icon = (yaml.match(/^icon:\s*(.+)$/m) || [])[1] || '📦';
          const version = (yaml.match(/^version:\s*(.+)$/m) || [])[1] || '1.0.0';
          const order = parseInt((yaml.match(/^order:\s*(\d+)$/m) || [])[1]) || 99;
          const badge = (yaml.match(/^badge:\s*"?(.+?)"?\s*$/m) || [])[1] || '';
          const featuresRaw = yaml.match(/features:\n((?:\s+-\s+.+\n?)+)/);
          const features = featuresRaw ? featuresRaw[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^\s*-\s*/, '').trim()) : [];
          return { id: d, name: name.trim(), description: desc.trim(), icon: icon.trim(), version, features, order, badge: badge.trim() };
        } catch(e) { return { id: d, name: d, description: '', icon: '📦', version: '1.0.0', features: [] }; }
      });
      blueprints.sort((a, b) => (a.order || 99) - (b.order || 99));
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, blueprints }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // GET /api/wizard/blueprint/:id — get blueprint details + variables
  const bpMatch = req.url.match(/^\/api\/wizard\/blueprint\/([a-zA-Z0-9_-]+)$/);
  if (bpMatch && req.method === 'GET') {
    try {
      const fs = require('fs');
      const path = require('path');
      const bpDir = path.join(BLUEPRINTS_DIR, bpMatch[1]);
      if (!fs.existsSync(bpDir)) { res.writeHead(404, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Blueprint not found'})); return; }
      const yaml = fs.readFileSync(path.join(bpDir, 'config.yaml'), 'utf8');

      // Parse variables from config.yaml
      const varsSection = yaml.match(/variables:\n((?:\s+\w+:.+\n?)+)/);
      const variables = {};
      if (varsSection) {
        varsSection[1].split('\n').filter(l => l.trim()).forEach(line => {
          const m = line.match(/^\s+(\w+):\s*\{(.+)\}/);
          if (m) {
            const key = m[1];
            const props = {};
            m[2].split(',').forEach(p => {
              const kv = p.match(/(\w+):\s*"?([^",}]+)"?/);
              if (kv) props[kv[1].trim()] = kv[2].trim();
            });
            variables[key] = props;
          }
        });
      }

      // List templates
      const files = fs.readdirSync(bpDir);
      const templates = files.filter(f => f.endsWith('.template')).map(f => f.replace('.template', ''));
      const skills = fs.existsSync(path.join(bpDir, 'skills')) ? fs.readdirSync(path.join(bpDir, 'skills')) : [];

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, id: bpMatch[1], variables, templates, skills, files }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // POST /api/wizard/apply — apply a blueprint with variables
  if (req.url === '/api/wizard/apply' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.blueprintId) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'blueprintId required'})); return; }

      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
  const { verifyChannel } = require('./channel-verifier');
  const { generateSOUL, generateIDENTITY, generateAGENTS } = require('./agent-templates');
      // Sanitise blueprintId: alphanumeric + hyphens only, no path traversal
      const safeId = String(body.blueprintId).replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeId || safeId !== body.blueprintId) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Invalid blueprint id'})); return; }
      const bpDir = path.join(BLUEPRINTS_DIR, safeId);
      if (!bpDir.startsWith(BLUEPRINTS_DIR)) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Invalid blueprint path'})); return; }
      if (!fs.existsSync(bpDir)) { res.writeHead(404, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Blueprint not found'})); return; }

      const vars = body.variables || {};
      const workspace = vars.WORKSPACE || process.env.OPENCLAW_WORKSPACE || (process.env.HOME + '/clawd');
      vars.WORKSPACE = workspace;

      // Write vars file for bootstrap.sh
      fs.writeFileSync(path.join(bpDir, '.vars.json'), JSON.stringify(vars, null, 2));

      // Run bootstrap.sh
      let output = '';
      try {
        output = execSync(`bash "${path.join(bpDir, 'bootstrap.sh')}" "${workspace}" 2>&1`, {
          timeout: 30000,
          encoding: 'utf8',
          env: { ...process.env, HOME: process.env.HOME }
        });
      } finally {
        // Always clean up vars file (success or error)
        try { fs.unlinkSync(path.join(bpDir, '.vars.json')); } catch(e) {}
      }

      // Auto-register crons from crons.json
      const cronsFile = path.join(bpDir, 'crons.json');
      const cronResults = [];
      if (fs.existsSync(cronsFile)) {
        try {
          const crons = JSON.parse(fs.readFileSync(cronsFile, 'utf8'));
          for (const cron of crons) {
            // Substitute variables in prompts and schedule
            let prompt = cron.prompt || '';
            let name = cron.name || 'unnamed';
            let schedule = cron.schedule || '';
            let tz = cron.timezone || '';
            for (const [k, v] of Object.entries(vars)) {
              const re = new RegExp('\\{\\{' + k + '\\}\\}', 'g');
              prompt = prompt.replace(re, v);
              name = name.replace(re, v);
              schedule = schedule.replace(re, v);
              tz = tz.replace(re, v);
            }
            // Skip code-review cron if no repo configured
            if (cron.name === 'code-review' && (!vars.REPO_PATH || vars.REPO_PATH.trim() === '')) {
              cronResults.push({ name: cron.name, status: 'skipped', reason: 'no REPO_PATH' });
              continue;
            }
            // Build openclaw cron add command — use spawnSync (no shell) to prevent injection
            const { spawnSync } = require('child_process');
            const spawnArgs = ['cron', 'add', '--name', name, '--message', prompt, '--session', 'main', '--json'];
            if (schedule.startsWith('*/') || schedule.match(/^[0-9*,/\s]+$/)) {
              spawnArgs.push('--cron', schedule);
            }
            if (tz) spawnArgs.push('--tz', tz);
            try {
              const cronResult = spawnSync('openclaw', spawnArgs, { timeout: 10000, encoding: 'utf8' });
              if (cronResult.error) throw cronResult.error;
              const cronData = JSON.parse(cronResult.stdout);
              cronResults.push({ name: cron.name, status: 'registered', id: cronData.id });
            } catch(ce) {
              cronResults.push({ name: cron.name, status: 'failed', error: (ce.message || String(ce)).slice(0, 100) });
            }
          }
        } catch(cronErr) {
          cronResults.push({ name: 'parse', status: 'failed', error: cronErr.message.slice(0, 100) });
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        workspace,
        output: output.split('\n').filter(l => l.trim()).slice(-15),
        crons: cronResults,
        message: `Blueprint '${body.blueprintId}' applied to ${workspace}`
      }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message, output: e.stdout || '' }));
    }
    return true;
  }

  // GET /api/wizard/status — check if workspace is already configured
  if (req.url === '/api/wizard/status' && req.method === 'GET') {
    try {
      const fs = require('fs');
      const workspace = process.env.OPENCLAW_WORKSPACE || (process.env.HOME + '/clawd');
      const files = ['SOUL.md', 'AGENTS.md', 'USER.md', 'MEMORY.md', 'IDENTITY.md', 'HEARTBEAT.md'];
      const existing = files.filter(f => fs.existsSync(require('path').join(workspace, f)));
      const configured = existing.length >= 3;
      const skillsDir = require('path').join(workspace, 'skills');
      const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter(d => fs.statSync(require('path').join(skillsDir, d)).isDirectory()) : [];

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, configured, workspace, existingFiles: existing, skills, total: files.length, found: existing.length }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }



  return false; // no route matched
};
