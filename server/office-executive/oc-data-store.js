/**
 * OcStore — Unified Data Store for SpawnKit
 * Single polling loop replaces 7 independent pollers.
 * All consumers subscribe for updates instead of fetching independently.
 */
(function() {
    'use strict';

    var _pollTimer = null;
    var _polling = false;
    var _subscribers = [];
    var _started = false;
    var POLL_INTERVAL = 15000; // 15 seconds — reduced to eliminate duplicate polling
    var _consecutiveFailures = 0;
    var _MAX_FAILURES_BEFORE_BACKOFF = 3;
    var _backoffInterval = null;

    function getApiUrl() {
        return window.OC_API_URL || window.location.origin;
    }

    var store = {
        sessions: [],
        memory: {},
        chat: [],
        crons: {},
        lastUpdated: 0,

        /**
         * Subscribe to data updates.
         * callback receives { sessions, memory, chat, crons }
         */
        subscribe: function(callback) {
            if (typeof callback === 'function' && _subscribers.indexOf(callback) === -1) {
                _subscribers.push(callback);
            }
            // If store has data, call immediately so subscriber gets current state
            if (store.lastUpdated > 0) {
                try { callback({ sessions: store.sessions, memory: store.memory, chat: store.chat, crons: store.crons }); }
                catch(e) { console.warn('[OcStore] Subscriber error:', e); }
            }
        },

        unsubscribe: function(callback) {
            var idx = _subscribers.indexOf(callback);
            if (idx !== -1) _subscribers.splice(idx, 1);
        },

        /** Force an immediate refresh (debounced — won't double-fetch if already in-flight) */
        refresh: function() {
            if (!_polling) _poll();
        },

        start: function() {
            if (_started) return;
            _started = true;
            _poll(); // initial fetch
            _pollTimer = setInterval(function() { _poll(); }, POLL_INTERVAL);
            console.log('[OcStore] Started — polling every ' + (POLL_INTERVAL / 1000) + 's');
        },

        stop: function() {
            _started = false;
            if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
            console.log('[OcStore] Stopped');
        }
    };

    function _poll() {
        if (_polling) return;
        _polling = true;

        var skF = window.skFetch || fetch;
        var base = getApiUrl();

        Promise.allSettled([
            skF(base + '/api/oc/sessions'),
            skF(base + '/api/oc/memory'),
            skF(base + '/api/oc/chat'),
            skF(base + '/api/oc/crons')
        ]).then(function(results) {
            var p = [];
            var allUnauthorized = true;
            // Parse JSON from each settled response
            for (var i = 0; i < results.length; i++) {
                if (results[i].status === 'fulfilled' && results[i].value && results[i].value.ok) {
                    allUnauthorized = false;
                    p.push(results[i].value.json().catch(function() { return null; }));
                } else {
                    // Check if it's a 401
                    if (results[i].status === 'fulfilled' && results[i].value && results[i].value.status !== 401) {
                        allUnauthorized = false;
                    }
                    p.push(Promise.resolve(null));
                }
            }

            // Back off on repeated 401s to avoid console spam
            if (allUnauthorized) {
                _consecutiveFailures++;
                if (_consecutiveFailures >= _MAX_FAILURES_BEFORE_BACKOFF) {
                    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
                    _backoffInterval = Math.min(120000, POLL_INTERVAL * Math.pow(2, _consecutiveFailures - _MAX_FAILURES_BEFORE_BACKOFF));
                    console.log('[OcStore] All endpoints returned 401 — backing off to ' + (_backoffInterval / 1000) + 's. Connect an instance to resume.');
                    _pollTimer = setInterval(function() { _poll(); }, _backoffInterval);
                }
            } else {
                if (_consecutiveFailures >= _MAX_FAILURES_BEFORE_BACKOFF) {
                    // Recovered — restore normal polling
                    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
                    _pollTimer = setInterval(function() { _poll(); }, POLL_INTERVAL);
                    console.log('[OcStore] Connection restored — resuming normal polling');
                }
                _consecutiveFailures = 0;
            }

            return Promise.all(p);
        }).then(function(parsed) {
            store.sessions = Array.isArray(parsed[0]) ? parsed[0] : [];
            store.memory = parsed[1] || {};
            store.chat = Array.isArray(parsed[2]) ? parsed[2] : (parsed[2] || []);
            store.crons = parsed[3] || {};
            store.lastUpdated = Date.now();

            // Notify all subscribers
            var data = { sessions: store.sessions, memory: store.memory, chat: store.chat, crons: store.crons };
            for (var i = 0; i < _subscribers.length; i++) {
                try { _subscribers[i](data); }
                catch(e) { console.warn('[OcStore] Subscriber error:', e); }
            }
        }).catch(function(err) {
            console.warn('[OcStore] Poll failed:', err.message || err);
        }).finally(function() {
            _polling = false;
        });
    }

    // Pause polling when page is not visible
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
        } else if (_started) {
            _poll(); // immediate refresh on return
            _pollTimer = setInterval(function() { _poll(); }, POLL_INTERVAL);
        }
    });

    // Cleanup on unload
    window.addEventListener('beforeunload', function() {
        store.stop();
    });

    // Expose globally
    window.OcStore = store;

    // Auto-start after auth (or immediately if no auth gate)
    function autoStart() {
        if (typeof window.skAuthReady === 'function') {
            window.skAuthReady(function() { store.start(); });
        } else {
            // auth.js not loaded yet — wait for DOMContentLoaded
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    if (typeof window.skAuthReady === 'function') {
                        window.skAuthReady(function() { store.start(); });
                    } else {
                        store.start();
                    }
                });
            } else {
                store.start();
            }
        }
    }

    autoStart();
})();
