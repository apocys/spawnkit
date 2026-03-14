// Blue Screen Fix for Medieval Theme
// Diagnoses and fixes common causes of blue screen loading issues

(function() {
    'use strict';
    
    // Common blue screen causes and fixes
    const BLUE_SCREEN_FIXES = {
        'importmap-not-supported': {
            test: () => !HTMLScriptElement.supports || !HTMLScriptElement.supports('importmap'),
            fix: () => loadThreeJSViaScript(),
            description: 'Browser doesn\'t support import maps'
        },
        'three-js-load-failure': {
            test: () => !window.THREE && window._hasWebGL,
            fix: () => loadThreeJSFallback(),
            description: 'Three.js failed to load from CDN'
        },
        'webgl-context-lost': {
            test: () => {
                try {
                    const canvas = document.createElement('canvas');
                    const gl = canvas.getContext('webgl');
                    return gl && gl.isContextLost && gl.isContextLost();
                } catch(e) { return false; }
            },
            fix: () => restoreWebGLContext(),
            description: 'WebGL context was lost'
        },
        'scripts-not-loading': {
            test: () => !window.castleApp && document.readyState === 'complete',
            fix: () => loadScriptsManually(),
            description: 'Core scripts failed to load'
        },
        'csp-blocking': {
            test: () => {
                // Check for CSP errors in console (can't detect directly)
                return document.querySelector('meta[http-equiv*="Content-Security-Policy"]') !== null;
            },
            fix: () => useFallbackAssets(),
            description: 'Content Security Policy blocking external resources'
        }
    };
    
    let fixAttempted = false;
    let debugLog = [];
    
    function log(message, level = 'info') {
        const timestamp = new Date().toISOString().substr(11, 8);
        const entry = `[${timestamp}] ${message}`;
        debugLog.push(entry);
        console.log(`[BlueScreenFix] ${entry}`);
        
        // Show debug overlay if needed
        if (level === 'error' || new URLSearchParams(window.location.search).get('debug')) {
            showDebugOverlay();
        }
    }
    
    function showDebugOverlay() {
        let overlay = document.getElementById('blue-screen-debug');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'blue-screen-debug';
            overlay.style.cssText = `
                position: fixed; top: 20px; left: 20px; right: 20px; max-height: 300px;
                background: rgba(13, 13, 26, 0.95); border: 2px solid #e94560;
                border-radius: 12px; padding: 16px; z-index: 999999;
                color: #f4e4bc; font-family: 'Crimson Text', serif;
                font-size: 14px; line-height: 1.5; overflow-y: auto;
            `;
            document.body.appendChild(overlay);
            
            const title = document.createElement('h3');
            title.style.cssText = 'margin: 0 0 12px 0; color: #e94560; font-family: MedievalSharp, fantasy;';
            title.textContent = '🛠️ Medieval Theme Debug Console';
            overlay.appendChild(title);
            
            const logContainer = document.createElement('div');
            logContainer.id = 'debug-log-container';
            overlay.appendChild(logContainer);
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕ Close';
            closeBtn.style.cssText = `
                position: absolute; top: 8px; right: 8px;
                background: #e94560; color: white; border: none;
                border-radius: 6px; padding: 4px 8px; cursor: pointer;
                font-size: 12px;
            `;
            closeBtn.onclick = () => overlay.remove();
            overlay.appendChild(closeBtn);
        }
        
        const logContainer = document.getElementById('debug-log-container');
        if (logContainer) {
            logContainer.innerHTML = debugLog.map(line => 
                `<div style="margin: 2px 0; font-family: monospace; font-size: 12px;">${line}</div>`
            ).join('');
        }
    }
    
    function loadThreeJSViaScript() {
        log('Loading Three.js via script tag fallback');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r162/three.min.js';
        script.onload = () => {
            log('Three.js loaded successfully', 'success');
            window.THREE = window.THREE || THREE;
            initializeMedievalTheme();
        };
        script.onerror = () => {
            log('Three.js CDN also failed, using 2D fallback', 'error');
            if (window.MedievalFallback) {
                window.MedievalFallback.init2DFallback();
            }
        };
        document.head.appendChild(script);
    }
    
    function loadThreeJSFallback() {
        log('Attempting Three.js fallback load');
        // Try different CDN
        const script = document.createElement('script');
        script.src = 'https://threejs.org/build/three.min.js';
        script.onload = () => {
            log('Three.js fallback CDN worked', 'success');
            window.THREE = window.THREE || THREE;
            initializeMedievalTheme();
        };
        script.onerror = () => loadThreeJSViaScript();
        document.head.appendChild(script);
    }
    
    function restoreWebGLContext() {
        log('Attempting to restore WebGL context');
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const gl = canvas.getContext('webgl');
            if (gl) {
                // Force context restoration
                gl.getExtension('WEBGL_lose_context').restoreContext();
            }
        }
    }
    
    function loadScriptsManually() {
        log('Loading core scripts manually');
        const scripts = [
            'medieval-integration.js',
            'medieval-game-engine.js',
            'medieval-panels.js'
        ];
        
        let loaded = 0;
        scripts.forEach(src => {
            const script = document.createElement('script');
            script.src = src + '?v=' + Date.now();
            script.onload = () => {
                loaded++;
                log(`Loaded ${src} (${loaded}/${scripts.length})`);
                if (loaded === scripts.length) {
                    initializeMedievalTheme();
                }
            };
            script.onerror = () => log(`Failed to load ${src}`, 'error');
            document.head.appendChild(script);
        });
    }
    
    function useFallbackAssets() {
        log('Using fallback assets due to CSP restrictions');
        // Disable external CDN loading
        window._hasWebGL = false;
        if (window.MedievalFallback) {
            window.MedievalFallback.init2DFallback();
        }
    }
    
    function initializeMedievalTheme() {
        log('Attempting to initialize medieval theme');
        
        // Remove loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
        
        // Initialize basic UI if main engine failed
        if (!window.castleApp) {
            log('Main engine not available, initializing basic UI');
            window.castleApp = {
                engineReady: true,
                onEngineReady: () => {},
                addActivityLog: (msg) => log(`Activity: ${msg}`)
            };
        }
        
        // Try to trigger engine ready event
        if (window.castleApp.onEngineReady) {
            window.castleApp.onEngineReady();
        }
    }
    
    function runDiagnostics() {
        log('Running blue screen diagnostics...');
        
        let issuesFound = [];
        for (const [key, fix] of Object.entries(BLUE_SCREEN_FIXES)) {
            if (fix.test()) {
                issuesFound.push(key);
                log(`Issue detected: ${fix.description}`, 'error');
            }
        }
        
        if (issuesFound.length === 0) {
            log('No obvious issues detected, checking loading state...');
            
            // Check if we're stuck in loading
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen && getComputedStyle(loadingScreen).display !== 'none') {
                log('Stuck in loading screen, forcing theme initialization', 'error');
                issuesFound.push('scripts-not-loading');
            }
        }
        
        // Apply fixes
        if (issuesFound.length > 0 && !fixAttempted) {
            fixAttempted = true;
            log(`Applying fix for: ${issuesFound[0]}`);
            BLUE_SCREEN_FIXES[issuesFound[0]].fix();
        }
        
        return issuesFound;
    }
    
    // Auto-run diagnostics
    function autoFix() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(runDiagnostics, 2000); // 2 second delay for initial loading
            });
        } else {
            setTimeout(runDiagnostics, 2000);
        }
        
        // Also run after window load
        window.addEventListener('load', () => {
            setTimeout(runDiagnostics, 3000); // 3 second delay after load
        });
        
        // Emergency fallback after 10 seconds
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen && getComputedStyle(loadingScreen).display !== 'none') {
                log('Emergency fallback activated after 10 seconds', 'error');
                if (window.MedievalFallback) {
                    window.MedievalFallback.init2DFallback();
                } else {
                    initializeMedievalTheme();
                }
            }
        }, 10000);
    }
    
    // Export for manual debugging
    window.BlueScreenFix = {
        runDiagnostics,
        showDebugOverlay,
        log,
        fixes: BLUE_SCREEN_FIXES
    };
    
    // Auto-start
    autoFix();
    
})();