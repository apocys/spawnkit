// Medieval Theme Fallback System
// Handles WebGL failures, import errors, and provides graceful degradation

(function() {
    'use strict';
    
    let debugMode = new URLSearchParams(window.location.search).get('debug') === '1';
    let fallbackActive = false;
    
    function log(message, type = 'info') {
        if (debugMode) {
            console.log(`[Medieval Fallback] ${message}`);
        }
        
        // Visual debug overlay
        if (debugMode && !document.getElementById('medieval-debug')) {
            const debugDiv = document.createElement('div');
            debugDiv.id = 'medieval-debug';
            debugDiv.style.cssText = `
                position: fixed; top: 10px; right: 10px; width: 300px; max-height: 400px;
                background: rgba(0,0,0,0.9); color: #c9a959; padding: 12px;
                border: 1px solid #c9a959; border-radius: 8px; font-family: monospace;
                font-size: 11px; z-index: 99999; overflow-y: auto;
            `;
            document.body.appendChild(debugDiv);
        }
        
        if (debugMode) {
            const debugDiv = document.getElementById('medieval-debug');
            if (debugDiv) {
                const line = document.createElement('div');
                line.style.color = type === 'error' ? '#e94560' : (type === 'success' ? '#10b981' : '#c9a959');
                line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                debugDiv.appendChild(line);
                debugDiv.scrollTop = debugDiv.scrollHeight;
            }
        }
    }
    
    // Detect capabilities
    function detectCapabilities() {
        const caps = {
            webgl: false,
            webgl2: false,
            es6modules: false,
            importMaps: false,
            serviceWorker: false,
            localStorage: false
        };
        
        // WebGL detection
        try {
            const canvas = document.createElement('canvas');
            caps.webgl2 = !!canvas.getContext('webgl2');
            caps.webgl = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch(e) {
            log('WebGL detection failed: ' + e.message, 'error');
        }
        
        // ES6 modules
        caps.es6modules = 'noModule' in document.createElement('script');
        
        // Import maps
        caps.importMaps = HTMLScriptElement.supports && HTMLScriptElement.supports('importmap');
        
        // Service Worker
        caps.serviceWorker = 'serviceWorker' in navigator;
        
        // LocalStorage
        try {
            localStorage.setItem('test', '1');
            localStorage.removeItem('test');
            caps.localStorage = true;
        } catch(e) {
            caps.localStorage = false;
        }
        
        log('Capabilities detected: ' + JSON.stringify(caps));
        return caps;
    }
    
    // Initialize 2D Canvas fallback
    function init2DFallback() {
        log('Initializing 2D fallback', 'info');
        
        // Remove loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        // Create 2D canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'medieval-2d-canvas';
        canvas.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 50%, #16213e 100%);
        `;
        
        const sceneContainer = document.getElementById('scene-container');
        if (sceneContainer) {
            sceneContainer.appendChild(canvas);
        }
        
        const ctx = canvas.getContext('2d');
        
        function resize() {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            draw();
        }
        
        function draw() {
            const w = canvas.width;
            const h = canvas.height;
            
            // Clear with gradient background
            const gradient = ctx.createLinearGradient(0, 0, w, h);
            gradient.addColorStop(0, '#0d0d1a');
            gradient.addColorStop(0.5, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
            
            // Draw castle silhouette
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(w*0.2, h*0.6, w*0.6, h*0.4); // Base
            ctx.fillRect(w*0.25, h*0.4, w*0.1, h*0.2); // Left tower
            ctx.fillRect(w*0.45, h*0.3, w*0.1, h*0.3); // Center tower
            ctx.fillRect(w*0.65, h*0.4, w*0.1, h*0.2); // Right tower
            
            // Add glow effect
            ctx.shadowColor = '#c9a959';
            ctx.shadowBlur = 20;
            ctx.fillStyle = 'rgba(201, 169, 89, 0.3)';
            ctx.fillRect(w*0.45, h*0.3, w*0.1, h*0.3);
            ctx.shadowBlur = 0;
            
            // Draw stars
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * w;
                const y = Math.random() * h * 0.6;
                const size = Math.random() * 2 + 1;
                ctx.fillStyle = `rgba(244, 228, 188, ${Math.random() * 0.8 + 0.2})`;
                ctx.fillRect(x, y, size, size);
            }
            
            // Welcome text
            ctx.font = 'bold 24px MedievalSharp, fantasy';
            ctx.fillStyle = '#c9a959';
            ctx.textAlign = 'center';
            ctx.fillText('🏰 Royal Command', w/2, h*0.15);
            
            ctx.font = '16px Crimson Text, serif';
            ctx.fillStyle = '#f4e4bc';
            ctx.fillText('Medieval Castle (2D Mode)', w/2, h*0.2);
            
            ctx.font = '14px Crimson Text, serif';
            ctx.fillStyle = '#a8a299';
            ctx.fillText('Your device doesn\'t support WebGL, using 2D fallback', w/2, h*0.85);
            ctx.fillText('Add ?debug=1 to URL for diagnostic info', w/2, h*0.9);
        }
        
        window.addEventListener('resize', resize);
        resize();
        
        // Simulate loading complete
        setTimeout(() => {
            if (window.castleApp && window.castleApp.onEngineReady) {
                window.castleApp.onEngineReady();
            }
        }, 1000);
        
        fallbackActive = true;
        log('2D fallback initialized', 'success');
    }
    
    // Timeout fallback
    function startFallbackTimeout() {
        setTimeout(() => {
            if (!window.castleApp || !window.castleApp.engineReady) {
                log('Engine initialization timeout, starting fallback', 'error');
                init2DFallback();
            }
        }, 10000); // 10 second timeout
    }
    
    // Main initialization
    function initialize() {
        const capabilities = detectCapabilities();
        
        // Force 2D mode if no WebGL
        if (!capabilities.webgl) {
            log('No WebGL support, forcing 2D mode', 'info');
            window._hasWebGL = false;
            setTimeout(init2DFallback, 100);
            return;
        }
        
        // Start timeout for WebGL mode
        startFallbackTimeout();
        
        // Monitor for script load failures
        window.addEventListener('error', function(e) {
            if (e.filename && (e.filename.includes('three') || e.filename.includes('medieval-'))) {
                log('Script load error: ' + e.filename, 'error');
                if (!fallbackActive) {
                    init2DFallback();
                }
            }
        });
        
        // Unhandled promise rejections (import failures)
        window.addEventListener('unhandledrejection', function(e) {
            log('Unhandled promise rejection: ' + e.reason, 'error');
            if (!fallbackActive && String(e.reason).includes('three')) {
                init2DFallback();
            }
        });
    }
    
    // Export for debugging
    window.MedievalFallback = {
        log,
        init2DFallback,
        detectCapabilities,
        fallbackActive: () => fallbackActive
    };
    
    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();