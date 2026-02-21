window.FleetClient = (function() {
    'use strict';
    
    var ws = null;
    var config = {};
    var reconnectTimer = null;
    var heartbeatTimer = null;
    var offices = {};
    var mailbox = [];
    var listeners = {};
    
    function init(cfg) {
        // cfg = { relayUrl: 'ws://host:18790/ws/fleet', token: 'sk-fleet-xxx', officeId: 'apomac', officeName: 'ApoMac HQ', officeEmoji: '🍎' }
        config = cfg;
        connect();
    }
    
    function connect() {
        var url = config.relayUrl + '?token=' + encodeURIComponent(config.token);
        ws = new WebSocket(url);
        
        ws.onopen = function() {
            console.log('🏙️ FleetClient connected to relay');
            emit('connected');
            startHeartbeat();
        };
        
        ws.onmessage = function(event) {
            var msg = JSON.parse(event.data);
            handleMessage(msg);
        };
        
        ws.onclose = function() {
            console.log('🏙️ FleetClient disconnected, reconnecting in 5s...');
            emit('disconnected');
            stopHeartbeat();
            reconnectTimer = setTimeout(connect, 5000);
        };
        
        ws.onerror = function(err) {
            console.error('🏙️ FleetClient error:', err);
        };
    }
    
    function handleMessage(msg) {
        switch(msg.type) {
            case 'welcome':
                console.log('🏙️ Welcome:', msg);
                break;
            case 'office:update':
                offices[msg.office] = msg.data;
                emit('office:update', msg);
                break;
            case 'office:online':
            case 'office:offline':
                if (offices[msg.office]) offices[msg.office].status = msg.type === 'office:online' ? 'online' : 'offline';
                emit(msg.type, msg);
                break;
            case 'message:new':
                mailbox.push(msg.message);
                emit('message:new', msg);
                break;
        }
    }
    
    function startHeartbeat() {
        heartbeatTimer = setInterval(function() {
            sendHeartbeat();
        }, 60000);
        sendHeartbeat(); // Send immediately
    }
    
    function stopHeartbeat() {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
    }
    
    function sendHeartbeat() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
        // Collect local fleet state
        var state = getLocalFleetState();
        ws.send(JSON.stringify({
            type: 'heartbeat',
            state: state
        }));
    }
    
    function getLocalFleetState() {
        // Read from SpawnKitPanels or SpawnKit.data
        var panels = window.SpawnKitPanels;
        var agents = panels ? panels.getAgents() : {};
        var demo = panels ? panels.getDemoData() : {};
        
        return {
            officeId: config.officeId,
            officeName: config.officeName,
            officeEmoji: config.officeEmoji,
            timestamp: new Date().toISOString(),
            agents: Object.keys(agents).map(function(id) {
                var a = agents[id];
                return {
                    id: id,
                    name: a.name,
                    role: a.role,
                    emoji: a.emoji || '🤖',
                    status: a.status || 'active',
                    currentTask: a.task || 'Standby',
                    model: a.model || 'unknown'
                };
            }),
            activeMissions: (demo.missions || []).filter(function(m) { return m.status === 'running'; }).length,
            totalTokens: '252K',
            uptime: '8h'
        };
    }
    
    function sendMessage(toOffice, text, priority) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify({
            type: 'message:send',
            to: toOffice,
            message: {
                text: text,
                priority: priority || 'medium'
            }
        }));
        return true;
    }
    
    // Simple event emitter
    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
    }
    
    function emit(event, data) {
        (listeners[event] || []).forEach(function(cb) { cb(data); });
    }
    
    function getOffices() { return offices; }
    function getMailbox() { return mailbox; }
    function isConnected() { return ws && ws.readyState === WebSocket.OPEN; }
    
    function disconnect() {
        stopHeartbeat();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (ws) ws.close();
    }
    
    return {
        init: init,
        sendMessage: sendMessage,
        getOffices: getOffices,
        getMailbox: getMailbox,
        isConnected: isConnected,
        disconnect: disconnect,
        on: on
    };
})();