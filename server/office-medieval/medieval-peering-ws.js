/**
 * Medieval Peering WebSocket — Real-time peer events
 * ═══════════════════════════════════════════════════
 * Listens for peer:joined / peer:removed via fleet relay WS.
 * Triggers raven arrival animation and refreshes Allied Kingdoms panel.
 * Depends on: medieval-raven-anim.js (RavenAnim)
 *
 * @version 1.0.0
 */
(function() {
    'use strict';

    function start() {
        var wsUrl, token;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            wsUrl = 'ws://localhost:18790/ws/fleet';
        } else {
            wsUrl = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//fleet.spawnkit.ai/ws/fleet';
        }
        token = 'sk-fleet-2ad53564b03d9facbe3389bb5c461179ffc73af12e50ae00';

        try {
            var ws = new WebSocket(wsUrl + '?token=' + token);

            ws.onmessage = function(evt) {
                try {
                    var d = JSON.parse(evt.data);
                    if (d.type === 'peer:joined') {
                        if (window.RavenAnim) window.RavenAnim.playArrival(d.name || d.office, d.emoji);
                        if (window.AlliedKingdoms) setTimeout(window.AlliedKingdoms.loadPeers, 1000);
                    }
                    if (d.type === 'peer:removed') {
                        if (window.RavenAnim) window.RavenAnim.setCEOEmoticon('\u2694\uFE0F', 3000);
                        if (window.AlliedKingdoms) setTimeout(window.AlliedKingdoms.loadPeers, 500);
                    }
                } catch(e) {}
            };

            ws.onerror = function() {};
            ws.onclose = function() {
                // Reconnect after 30s
                setTimeout(start, 30000);
            };
            window._fleetWS = ws;
        } catch(e) {
            console.warn('[PeeringWS] Connection failed:', e.message);
        }
    }

    // Delay start to let other modules init
    setTimeout(start, 3000);
})();
