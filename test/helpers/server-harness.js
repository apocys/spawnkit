const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let serverProcess = null;
let testDir = null;

async function startServer(port = 0) {
  // Use random port if 0 or default to avoid EADDRINUSE
  if (port === 0 || port === 8765) port = 9000 + Math.floor(Math.random() * 1000);
  return new Promise((resolve, reject) => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spawnkit-test-'));
    
    // Set up environment variables to isolate test server
    const testEnv = {
      ...process.env,
      PORT: String(port),
      WORKSPACE: testDir,
      HOME: testDir,
      MOCK_FLEET: '1',
      PATH: (process.env.PATH || '') + ':/home/apocyz_runner/.npm-global/bin'
    };
    
    // Create necessary directories for the test environment
    const ocDir = path.join(testDir, '.openclaw');
    const workspaceDir = path.join(testDir, '.openclaw', 'workspace');
    const agentsDir = path.join(testDir, '.openclaw', 'agents', 'main', 'sessions');
    
    fs.mkdirSync(ocDir, { recursive: true });
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });
    
    // Create basic config files
    fs.writeFileSync(path.join(ocDir, 'openclaw.json'), JSON.stringify({
      gateway: { auth: { token: 'test-token' } },
      agents: { list: [] }
    }));
    fs.writeFileSync(path.join(agentsDir, 'sessions.json'), '{}');
    fs.writeFileSync(path.join(workspaceDir, 'TODO.md'), '# Test TODO\n');
    
    // Start the server process
    serverProcess = spawn('node', [path.join(__dirname, '../../server/server.js')], {
      env: testEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let started = false;
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (!started && output.includes('listening')) {
        started = true;
        resolve(port);
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });
    
    // Fallback: try to connect after 3s
    setTimeout(() => {
      if (!started) {
        started = true;
        resolve(port);
      }
    }, 3000);
    
    serverProcess.on('error', (err) => {
      if (!started) {
        reject(err);
      }
    });
    
    serverProcess.on('exit', (code) => {
      if (!started) {
        reject(new Error(`Server process exited with code ${code}`));
      }
    });
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to clean up test directory:', e.message);
    }
    testDir = null;
  }
}

module.exports = { startServer, stopServer };