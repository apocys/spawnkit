/**
 * Agent Creation System Tests — 2026-03-06
 * Covers: API endpoints, template generation, validation, UI elements
 *
 * Part 1: Template/Logic tests (no server needed)
 * Part 2: API tests (require running server on API_BASE)
 *
 * Run: node test/agent-creation.test.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8765';
const SERVER_DIR = path.join(__dirname, '..', 'server');
const MEDIEVAL_DIR = path.join(SERVER_DIR, 'office-medieval');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        passed++;
        console.log(`  ✅ ${name}`);
      }).catch(e => {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
      });
    }
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ═══════════════════════════════════════════════════════════════
//  PART 1: Server.js Template & Logic Tests
// ═══════════════════════════════════════════════════════════════

console.log('\n⚔️ Agent Creation System — Logic Tests\n');

const serverSrc = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');

// ── Template Generation ──
console.log('── Template Generation ──');

test('server.js has SOUL template generator', () => {
  assert(serverSrc.includes('function generateSOUL'), 'Should have generateSOUL function');
  assert(serverSrc.includes('You are **${config.displayName}**'), 'Template should use displayName');
  assert(serverSrc.includes('NOT Sycopa'), 'Template must explicitly say NOT Sycopa');
  assert(serverSrc.includes('NOT ApoMac'), 'Template must explicitly say NOT ApoMac');
});

test('server.js has IDENTITY template generator', () => {
  assert(serverSrc.includes('function generateIDENTITY'), 'Should have generateIDENTITY function');
  assert(serverSrc.includes('config.displayName'), 'Should use displayName');
  assert(serverSrc.includes('config.emoji'), 'Should use emoji');
});

test('server.js has AGENTS template generator', () => {
  assert(serverSrc.includes('function generateAGENTS'), 'Should have generateAGENTS function');
});

test('TRAIT_MAP covers all expected traits', () => {
  const expectedTraits = ['brave', 'wise', 'precise', 'loyal', 'cunning', 'swift', 'creative', 'analytical'];
  expectedTraits.forEach(t => {
    assert(serverSrc.includes(`${t}:`), `TRAIT_MAP should include '${t}'`);
  });
});

test('SOUL template prevents identity confusion', () => {
  // The generated SOUL.md must explicitly tell the agent it's NOT other agents
  assert(serverSrc.includes('You are an independent agent'), 'Should state agent is independent');
  assert(serverSrc.includes('When asked "who are you"'), 'Should instruct on self-identification');
});

// ── API Endpoints ──
console.log('\n── API Endpoints ──');

test('GET /api/oc/agents endpoint exists', () => {
  assert(serverSrc.includes("/api/oc/agents'") || serverSrc.includes('"/api/oc/agents"'), 'Should have GET agents endpoint');
  assert(serverSrc.includes("agents', 'list', '--json'") || serverSrc.includes("'agents', 'list'"), 'Should call openclaw agents list');
});

test('POST /api/oc/agents/create endpoint exists', () => {
  assert(serverSrc.includes('/api/oc/agents/create'), 'Should have create endpoint');
  assert(serverSrc.includes("req.method === 'POST'"), 'Should handle POST method');
});

test('DELETE /api/oc/agents/:id endpoint exists', () => {
  assert(serverSrc.includes('agentDeleteMatch') || serverSrc.includes("method === 'DELETE'"), 'Should have delete endpoint');
  assert(serverSrc.includes("agentId === 'main'"), 'Should protect main agent from deletion');
});

test('POST /api/oc/agents/:id/chat endpoint exists', () => {
  assert(serverSrc.includes('agentChatMatch') || serverSrc.includes('/chat'), 'Should have per-agent chat endpoint');
  assert(serverSrc.includes("'openclaw:' + agentId") || serverSrc.includes('openclaw:'), 'Should route to specific agent model');
});

// ── Input Validation ──
console.log('\n── Input Validation ──');

test('create endpoint validates required fields', () => {
  assert(serverSrc.includes("!name || !displayName"), 'Should require name and displayName');
  assert(serverSrc.includes('400'), 'Should return 400 for missing fields');
});

test('create endpoint sanitizes agent name', () => {
  assert(serverSrc.includes('toLowerCase()'), 'Should lowercase agent name');
  assert(serverSrc.includes(/replace.*[^a-z0-9]/.source) || serverSrc.includes('replace(/[^a-z0-9-]/g'), 'Should strip non-alphanumeric chars');
});

test('create endpoint checks for duplicate agents', () => {
  assert(serverSrc.includes('existsSync(agentDir)'), 'Should check if agent dir exists');
  assert(serverSrc.includes('409'), 'Should return 409 for duplicates');
});

test('create endpoint cleans up on failure', () => {
  assert(serverSrc.includes('rmSync') || serverSrc.includes('rmdirSync'), 'Should clean up workspace on failure');
});

// ── Agent Workspace Generation ──
console.log('\n── Workspace Generation ──');

test('create endpoint generates all required workspace files', () => {
  const requiredFiles = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'MEMORY.md', 'TODO.md', 'TOOLS.md'];
  requiredFiles.forEach(f => {
    assert(serverSrc.includes(`'${f}'`), `Should generate ${f}`);
  });
});

test('create endpoint calls openclaw agents add', () => {
  assert(serverSrc.includes("'agents', 'add'"), 'Should call openclaw agents add');
  assert(serverSrc.includes('--non-interactive'), 'Should use non-interactive flag');
  assert(serverSrc.includes('--workspace'), 'Should specify workspace');
  assert(serverSrc.includes('--model'), 'Should specify model');
});

test('create endpoint calls set-identity after creation', () => {
  assert(serverSrc.includes("'set-identity'"), 'Should call set-identity');
  assert(serverSrc.includes('--from-identity'), 'Should use --from-identity flag');
});

test('model mapping includes all tiers', () => {
  assert(serverSrc.includes('opus:'), 'Should map opus');
  assert(serverSrc.includes('sonnet:'), 'Should map sonnet');
  assert(serverSrc.includes('codex:'), 'Should map codex');
});

// ── Per-Agent Chat ──
console.log('\n── Per-Agent Chat ──');

test('per-agent chat routes to correct OpenClaw model', () => {
  assert(serverSrc.includes("'openclaw:' + agentId"), 'Should route to openclaw:<agentId>');
});

test('per-agent chat returns reply with agentId', () => {
  assert(serverSrc.includes('agentId') && serverSrc.includes('reply'), 'Should return both reply and agentId');
});

// ── Summon Wizard UI ──
console.log('\n── Summon Wizard UI ──');

test('summon-wizard.js exists', () => {
  const wizardPath = path.join(MEDIEVAL_DIR, 'summon-wizard.js');
  assert(fs.existsSync(wizardPath), 'summon-wizard.js should exist in medieval dir');
});

test('summon-wizard.js exports window.SummonWizard', () => {
  try {
    const src = fs.readFileSync(path.join(MEDIEVAL_DIR, 'summon-wizard.js'), 'utf8');
    assert(src.includes('window.SummonWizard'), 'Should export SummonWizard to window');
    assert(src.includes('.open') && src.includes('.close'), 'Should have open/close methods');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('summon-wizard.js not yet created');
    throw e;
  }
});

test('summon-wizard.js has 5-step wizard flow', () => {
  try {
    const src = fs.readFileSync(path.join(MEDIEVAL_DIR, 'summon-wizard.js'), 'utf8');
    // Check for step navigation
    assert(src.includes('step') || src.includes('Step'), 'Should have step concept');
    // Check for trait selection
    assert(src.includes('brave') || src.includes('Brave'), 'Should have trait options');
    // Check for model selection
    assert(src.includes('opus') || src.includes('Opus'), 'Should have model selection');
    // Check for API call
    assert(src.includes('/api/oc/agents/create') || src.includes('agents/create'), 'Should POST to create API');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('summon-wizard.js not yet created');
    throw e;
  }
});

test('summon-wizard.js dispatches knight-summoned event', () => {
  try {
    const src = fs.readFileSync(path.join(MEDIEVAL_DIR, 'summon-wizard.js'), 'utf8');
    assert(src.includes('knight-summoned'), 'Should dispatch knight-summoned CustomEvent');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('summon-wizard.js not yet created');
    throw e;
  }
});

// ── Design Doc ──
console.log('\n── Design Doc ──');

test('design doc exists', () => {
  const docPath = path.join(__dirname, '..', 'docs', 'plans', '2026-03-06-agent-creation-system.md');
  assert(fs.existsSync(docPath), 'Design doc should exist');
  const doc = fs.readFileSync(docPath, 'utf8');
  assert(doc.includes('Agent Creation System'), 'Should have proper title');
  assert(doc.includes('SOUL.md'), 'Should describe SOUL.md generation');
  assert(doc.includes('Implementation Plan'), 'Should have implementation plan');
});

// ═══════════════════════════════════════════════════════════════
//  PART 2: API Tests (require running server)
// ═══════════════════════════════════════════════════════════════

function fetchJSON(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + urlPath);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function apiTests() {
  console.log('\n🌐 API Tests (server: ' + API_BASE + ')\n');

  try {
    // Test list agents
    const list = await fetchJSON('GET', '/api/oc/agents');
    test('GET /api/oc/agents returns agent list', () => {
      assert(list.status === 200, 'Should return 200, got ' + list.status);
      assert(list.body.ok === true, 'Should have ok: true');
      assert(Array.isArray(list.body.agents), 'Should return agents array');
      assert(list.body.agents.length > 0, 'Should have at least 1 agent (main)');
      const main = list.body.agents.find(a => a.id === 'main');
      assert(main, 'Should include main agent');
    });

    // Test create validation
    const badCreate = await fetchJSON('POST', '/api/oc/agents/create', {});
    test('POST /api/oc/agents/create rejects missing fields', () => {
      assert(badCreate.status === 400, 'Should return 400 for missing fields, got ' + badCreate.status);
    });

    // Test create agent (use unique name to avoid conflicts)
    const testName = 'test-knight-' + Date.now();
    const create = await fetchJSON('POST', '/api/oc/agents/create', {
      name: testName,
      displayName: 'Test Knight',
      role: 'Tester',
      model: 'sonnet',
      traits: ['brave', 'precise'],
      skills: ['github'],
      theme: 'medieval',
      emoji: '🧪'
    });
    
    test('POST /api/oc/agents/create creates agent', () => {
      assert(create.status === 201, 'Should return 201, got ' + create.status + ' body: ' + JSON.stringify(create.body));
      assert(create.body.ok === true, 'Should have ok: true');
      assert(create.body.agentId, 'Should return agentId');
      assert(create.body.displayName === 'Test Knight', 'Should return displayName');
    });

    // Verify workspace was created
    if (create.status === 201) {
      test('created agent has SOUL.md with correct identity', () => {
        const soulPath = path.join(create.body.workspace, 'SOUL.md');
        assert(fs.existsSync(soulPath), 'SOUL.md should exist at ' + soulPath);
        const soul = fs.readFileSync(soulPath, 'utf8');
        assert(soul.includes('Test Knight'), 'SOUL.md should contain agent name');
        assert(soul.includes('Tester'), 'SOUL.md should contain role');
        assert(soul.includes('Brave') || soul.includes('brave'), 'SOUL.md should contain traits');
        assert(soul.includes('NOT Sycopa'), 'SOUL.md must say NOT Sycopa');
      });

      test('created agent has IDENTITY.md', () => {
        const idPath = path.join(create.body.workspace, 'IDENTITY.md');
        assert(fs.existsSync(idPath), 'IDENTITY.md should exist');
        const id = fs.readFileSync(idPath, 'utf8');
        assert(id.includes('Test Knight'), 'Should contain name');
        assert(id.includes('🧪'), 'Should contain emoji');
      });

      // Test duplicate prevention
      const dup = await fetchJSON('POST', '/api/oc/agents/create', {
        name: testName,
        displayName: 'Duplicate Knight'
      });
      test('POST /api/oc/agents/create rejects duplicates', () => {
        assert(dup.status === 409, 'Should return 409 for duplicate, got ' + dup.status);
      });

      // Cleanup: delete test agent
      const del = await fetchJSON('DELETE', '/api/oc/agents/' + create.body.agentId);
      test('DELETE /api/oc/agents/:id deletes agent', () => {
        assert(del.status === 200, 'Should return 200, got ' + del.status);
        assert(del.body.ok === true, 'Should have ok: true');
      });

      // Verify main agent is protected
      const delMain = await fetchJSON('DELETE', '/api/oc/agents/main');
      test('DELETE /api/oc/agents/main is forbidden', () => {
        assert(delMain.status === 403, 'Should return 403 for main agent, got ' + delMain.status);
      });
    }

  } catch (e) {
    console.log('  ⚠️  API tests skipped (server not reachable): ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
//  Run
// ═══════════════════════════════════════════════════════════════

apiTests().then(() => {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
});
