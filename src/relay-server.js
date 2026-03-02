#!/usr/bin/env node
/**
 * SpawnKit Relay Server
 * 
 * Lightweight HTTP server that exposes OpenClaw data as REST API
 * for SpawnKit dashboard themes to consume.
 * 
 * Usage: node relay-server.js [--port 18790] [--workspace ~/.openclaw/workspace]
 * 
 * Endpoints:
 *   GET /api/oc/sessions  → active sessions (agents + subagents)
 *   GET /api/oc/crons     → cron jobs
 *   GET /api/oc/memory    → memory files
 *   GET /api/oc/config    → basic config
 *   GET /api/oc/agents    → agent list
 *   GET /api/oc/health    → health check
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Config ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.argv.find((a, i) => process.argv[i-1] === '--port') || '18790');
const WORKSPACE = process.argv.find((a, i) => process.argv[i-1] === '--workspace') || 
    path.join(process.env.HOME, '.openclaw', 'workspace');
const OC_DIR = path.join(process.env.HOME, '.openclaw');
const AGENTS_DIR = path.join(OC_DIR, 'agents');

console.log(`🚀 SpawnKit Relay Server starting on port ${PORT}`);
console.log(`📁 Workspace: ${WORKSPACE}`);
console.log(`📁 OpenClaw dir: ${OC_DIR}`);

// ── Data Readers ────────────────────────────────────────────────────────

function readSessions() {
    try {
        // Use openclaw CLI to get session data (works great, returns real data)
        const raw = execSync('openclaw sessions list --json 2>/dev/null', { 
            timeout: 10000,
            encoding: 'utf8'
        });
        const parsed = JSON.parse(raw);
        // Return sessions array directly (CLI returns {path, count, sessions[]})
        return parsed.sessions || parsed || [];
    } catch (e) {
        console.error('Failed to read sessions:', e.message);
        return [];
    }
}

function readCrons() {
    try {
        const raw = execSync('openclaw cron list --json 2>/dev/null', {
            timeout: 10000,
            encoding: 'utf8'
        });
        return JSON.parse(raw);
    } catch (e) {
        // Fallback: read cron config
        try {
            const configPath = path.join(OC_DIR, 'openclaw.json');
            if (!fs.existsSync(configPath)) return { jobs: [] };
            
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return { jobs: config.crons || [] };
        } catch (fallbackErr) {
            return { jobs: [] };
        }
    }
}

function readMemory() {
    try {
        const memoryDir = path.join(WORKSPACE, 'memory');
        const mainMemory = path.join(WORKSPACE, 'MEMORY.md');
        
        const result = {
            main: null,
            files: []
        };
        
        // Read MEMORY.md
        if (fs.existsSync(mainMemory)) {
            const stat = fs.statSync(mainMemory);
            const content = fs.readFileSync(mainMemory, 'utf8');
            result.main = {
                content: content.substring(0, 2000),
                size: stat.size,
                lastModified: stat.mtimeMs
            };
        }
        
        // Read memory/*.md files
        if (fs.existsSync(memoryDir)) {
            result.files = fs.readdirSync(memoryDir)
                .filter(f => f.endsWith('.md') || f.endsWith('.json'))
                .map(f => {
                    const stat = fs.statSync(path.join(memoryDir, f));
                    return { name: f, size: stat.size, lastModified: stat.mtimeMs };
                })
                .sort((a, b) => b.lastModified - a.lastModified);
        }
        
        return result;
    } catch (e) {
        console.error('Failed to read memory:', e.message);
        return { main: null, files: [] };
    }
}

function readConfig() {
    try {
        const configPath = path.join(OC_DIR, 'openclaw.json');
        if (!fs.existsSync(configPath)) return {};
        
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Strip sensitive data
        return {
            agents: (config.agents?.agents || []).map(a => ({
                id: a.id,
                isDefault: a.isDefault || false,
                model: a.model
            })),
            channels: Object.keys(config.channels || {}),
            workspace: WORKSPACE
        };
    } catch (e) {
        return {};
    }
}

function readAgents() {
    try {
        const configPath = path.join(OC_DIR, 'openclaw.json');
        if (!fs.existsSync(configPath)) return [];
        
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // OpenClaw uses agents.list[], not agents.agents[]
        const agentConfigs = config.agents?.list || config.agents?.agents || [];
        const defaultModel = config.agents?.defaults?.model || 'unknown';
        
        // Also read session data to enrich agents
        let sessions = [];
        try {
            const raw = execSync('openclaw sessions list --json 2>/dev/null', { 
                timeout: 10000, encoding: 'utf8' 
            });
            const parsed = JSON.parse(raw);
            sessions = parsed.sessions || [];
        } catch (e) {}
        
        return agentConfigs.map(a => {
            const agentId = a.id || 'main';
            
            // Find matching sessions for this agent
            const agentSessions = sessions.filter(s => {
                const key = s.key || '';
                return key.startsWith(`agent:${agentId}:`);
            });
            
            // Find most recent activity
            let lastActive = null;
            let totalTokens = 0;
            let currentModel = a.model || defaultModel;
            
            agentSessions.forEach(s => {
                if (s.updatedAt && (!lastActive || s.updatedAt > lastActive)) {
                    lastActive = s.updatedAt;
                }
                totalTokens += (s.totalTokens || 0);
                if (s.model) currentModel = s.model;
            });
            
            const isActive = lastActive && (Date.now() - lastActive) < 300000;
            
            // Map agent IDs to friendly names
            const nameMap = {
                'main': 'ApoMac',
                'cto-forge': 'Forge',
                'coo-atlas': 'Atlas',
                'cro-hunter': 'Hunter',
                'cmo-echo': 'Echo',
                'auditor-sentinel': 'Sentinel'
            };
            
            const roleMap = {
                'main': 'CEO',
                'cto-forge': 'CTO',
                'coo-atlas': 'COO',
                'cro-hunter': 'CRO',
                'cmo-echo': 'CMO',
                'auditor-sentinel': 'Auditor'
            };
            
            return {
                id: agentId,
                name: nameMap[agentId] || agentId,
                role: roleMap[agentId] || 'Agent',
                isDefault: a.default || false,
                model: currentModel,
                status: isActive ? 'active' : 'idle',
                lastActive,
                totalTokens,
                sessionCount: agentSessions.length
            };
        });
    } catch (e) {
        console.error('Failed to read agents:', e.message);
        return [];
    }
}

// ── Fleet Data (stub — returns empty data so UI doesn't 404) ────────────

function getFleetOffices() {
    return {
        offices: {
            apomac: {
                name: 'ApoMac HQ',
                emoji: '🍎',
                status: 'online',
                agents: readAgents().length
            }
        }
    };
}

function getFleetOffice(id) {
    if (id === 'apomac') {
        const agents = readAgents();
        return {
            id: 'apomac',
            name: 'ApoMac HQ',
            emoji: '🍎',
            status: 'online',
            state: {
                officeName: 'ApoMac HQ',
                officeEmoji: '🍎',
                agents: agents.map(a => ({
                    id: a.id,
                    name: a.name,
                    role: a.role,
                    emoji: '🤖',
                    status: a.status || 'idle',
                    currentTask: 'Standby',
                    model: a.model || 'unknown'
                })),
                activeMissions: 0,
                totalTokens: '0',
                uptime: '0h'
            }
        };
    }
    return { id, name: id, status: 'offline', state: { agents: [] } };
}

function getFleetMailbox() {
    return { messages: [] };
}

// ── HTTP Server ─────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
    // CORS headers for browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    
    try {
        // ── OpenClaw endpoints ──────────────────────────
        switch (pathname) {
            case '/api/oc/health':
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true, timestamp: Date.now(), mode: 'relay' }));
                return;
                
            case '/api/oc/sessions':
                res.writeHead(200);
                res.end(JSON.stringify(readSessions()));
                return;
                
            case '/api/oc/crons':
                res.writeHead(200);
                res.end(JSON.stringify(readCrons()));
                return;
                
            case '/api/oc/memory':
                res.writeHead(200);
                res.end(JSON.stringify(readMemory()));
                return;
                
            case '/api/oc/config':
                res.writeHead(200);
                res.end(JSON.stringify(readConfig()));
                return;
                
            case '/api/oc/agents':
                res.writeHead(200);
                res.end(JSON.stringify(readAgents()));
                return;

            // ── Fleet endpoints (stub) ──────────────────────
            case '/api/fleet/offices':
                res.writeHead(200);
                res.end(JSON.stringify(getFleetOffices()));
                return;
                
            case '/api/fleet/mailbox':
                res.writeHead(200);
                res.end(JSON.stringify(getFleetMailbox()));
                return;
        }
        
        // ── Dynamic fleet routes ────────────────────────
        const officeMatch = pathname.match(/^\/api\/fleet\/office\/([^/]+)$/);
        if (officeMatch) {
            res.writeHead(200);
            res.end(JSON.stringify(getFleetOffice(officeMatch[1])));
            return;
        }
        
        // ── 404 ─────────────────────────────────────────
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found', endpoints: [
            '/api/oc/health', '/api/oc/sessions', '/api/oc/crons',
            '/api/oc/memory', '/api/oc/config', '/api/oc/agents',
            '/api/fleet/offices', '/api/fleet/office/:id', '/api/fleet/mailbox',
            'WS /ws/fleet'
        ]}));
    } catch (e) {
        console.error(`Error handling ${pathname}:`, e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
    }
});

// ── WebSocket Server for /ws/fleet ──────────────────────────────────────

const crypto = require('crypto');

server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    if (url.pathname !== '/ws/fleet') {
        socket.destroy();
        return;
    }
    
    // WebSocket handshake
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    
    const acceptKey = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC085B11')
        .digest('base64');
    
    socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
        '\r\n'
    );
    
    console.log('🔌 WebSocket client connected to /ws/fleet');
    
    // Send welcome message
    sendWsFrame(socket, JSON.stringify({
        type: 'welcome',
        server: 'SpawnKit Relay',
        timestamp: new Date().toISOString()
    }));
    
    // Handle incoming frames
    socket.on('data', (buf) => {
        try {
            const msg = parseWsFrame(buf);
            if (!msg) return;
            
            const parsed = JSON.parse(msg);
            if (parsed.type === 'heartbeat') {
                // Acknowledge heartbeat
                sendWsFrame(socket, JSON.stringify({ type: 'heartbeat:ack', timestamp: Date.now() }));
            }
        } catch (e) {
            // Ignore parse errors (ping frames, etc.)
        }
    });
    
    // Ping interval to keep alive
    const pingInterval = setInterval(() => {
        try {
            // Send WS ping frame (opcode 0x9)
            const pingFrame = Buffer.alloc(2);
            pingFrame[0] = 0x89; // FIN + ping
            pingFrame[1] = 0x00; // no payload
            socket.write(pingFrame);
        } catch (e) {
            clearInterval(pingInterval);
        }
    }, 30000);
    
    socket.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        clearInterval(pingInterval);
    });
    
    socket.on('error', () => {
        clearInterval(pingInterval);
    });
});

// Minimal WebSocket frame helpers (no ws dependency needed)
function sendWsFrame(socket, data) {
    const payload = Buffer.from(data, 'utf8');
    const len = payload.length;
    let header;
    
    if (len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81; // FIN + text
        header[1] = len;
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }
    
    socket.write(Buffer.concat([header, payload]));
}

function parseWsFrame(buf) {
    if (buf.length < 2) return null;
    const opcode = buf[0] & 0x0F;
    if (opcode === 0x8) return null; // close
    if (opcode === 0xA) return null; // pong
    if (opcode === 0x9) return null; // ping
    
    const masked = (buf[1] & 0x80) !== 0;
    let payloadLen = buf[1] & 0x7F;
    let offset = 2;
    
    if (payloadLen === 126) {
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
    } else if (payloadLen === 127) {
        payloadLen = Number(buf.readBigUInt64BE(2));
        offset = 10;
    }
    
    let mask = null;
    if (masked) {
        mask = buf.slice(offset, offset + 4);
        offset += 4;
    }
    
    const payload = buf.slice(offset, offset + payloadLen);
    if (mask) {
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
        }
    }
    
    return payload.toString('utf8');
}

// ── Start ───────────────────────────────────────────────────────────────

server.listen(PORT, '127.0.0.1', () => {
    console.log(`✅ SpawnKit Relay Server running at http://127.0.0.1:${PORT}`);
    console.log(`📡 Endpoints:`);
    console.log(`   GET  /api/oc/health`);
    console.log(`   GET  /api/oc/sessions`);
    console.log(`   GET  /api/oc/crons`);
    console.log(`   GET  /api/oc/memory`);
    console.log(`   GET  /api/oc/config`);
    console.log(`   GET  /api/oc/agents`);
    console.log(`   GET  /api/fleet/offices`);
    console.log(`   GET  /api/fleet/office/:id`);
    console.log(`   GET  /api/fleet/mailbox`);
    console.log(`   WS   /ws/fleet`);
    console.log(`\n🔗 Set in your theme: window.OC_RELAY_URL = "http://127.0.0.1:${PORT}"`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use. Try --port <other-port>`);
        process.exit(1);
    }
    throw e;
});
