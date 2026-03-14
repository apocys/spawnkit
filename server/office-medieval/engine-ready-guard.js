/**
 * Engine Ready Guard - Prevents scripts from running before Three.js is ready
 */
(function() {
    'use strict';
    
    let engineReady = false;
    const queuedInitFunctions = [];
    
    // Safe engine ready checker
    function isEngineReady() {
        return typeof window.THREE !== 'undefined' && 
               window.castleApp && 
               window.castleApp.scene;
    }
    
    // Queue system for scripts that need engine ready
    window.whenEngineReady = function(fn) {
        if (engineReady || isEngineReady()) {
            try {
                fn();
            } catch(e) {
                console.error('Engine ready callback failed:', e);
            }
        } else {
            queuedInitFunctions.push(fn);
        }
    };
    
    // Flush queue when engine is ready
    function flushQueue() {
        engineReady = true;
        console.log('[Engine Ready Guard] Flushing queue:', queuedInitFunctions.length, 'functions');
        
        queuedInitFunctions.forEach((fn, index) => {
            try {
                fn();
                console.log('[Engine Ready Guard] Executed function', index + 1);
            } catch(e) {
                console.error('[Engine Ready Guard] Function', index + 1, 'failed:', e);
            }
        });
        
        queuedInitFunctions.length = 0;
    }
    
    // Listen for engine ready events
    window.addEventListener('medieval-engine-ready', flushQueue);
    window.addEventListener('threejs-loaded', () => {
        setTimeout(() => {
            if (isEngineReady()) {
                flushQueue();
            }
        }, 1000);
    });
    
    // Fallback check after delay
    setTimeout(() => {
        if (!engineReady && isEngineReady()) {
            console.log('[Engine Ready Guard] Fallback trigger');
            flushQueue();
        }
    }, 5000);
    
    // Override problematic scripts to wait for engine ready
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(event, handler, options) {
        if (event === 'DOMContentLoaded' && handler.toString().includes('renderer') || 
            event === 'load' && handler.toString().includes('castleApp')) {
            // Intercept and queue instead
            window.whenEngineReady(handler);
        } else {
            originalAddEventListener.call(this, event, handler, options);
        }
    };
    
    console.log('[Engine Ready Guard] Initialized');
})();