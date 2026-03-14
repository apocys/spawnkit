/**
 * Fix Three.js loading issues - Local fallback system
 */
(function() {
    'use strict';
    
    let loadAttempts = 0;
    const MAX_ATTEMPTS = 3;
    
    function log(msg) {
        console.log('[Three.js Fix]', msg);
    }
    
    // Try multiple CDN sources
    const THREE_SOURCES = [
        'https://unpkg.com/three@0.162.0/build/three.module.js',
        'https://cdnjs.cloudflare.com/ajax/libs/three.js/r162/three.min.js',
        'https://cdn.skypack.dev/three@0.162.0',
        'https://esm.sh/three@0.162.0'
    ];
    
    function loadThreeJS(sourceIndex = 0, callback) {
        if (sourceIndex >= THREE_SOURCES.length) {
            log('All CDN sources failed, creating stub');
            createThreeJSStub();
            callback(false);
            return;
        }
        
        const source = THREE_SOURCES[sourceIndex];
        log(`Trying source ${sourceIndex + 1}/${THREE_SOURCES.length}: ${source}`);
        
        const script = document.createElement('script');
        
        if (source.includes('.module.js') || source.includes('skypack') || source.includes('esm.sh')) {
            // ES6 module loading
            script.type = 'module';
            script.textContent = `
                import * as THREE from '${source}';
                window.THREE = THREE;
                window.dispatchEvent(new CustomEvent('threejs-loaded', { detail: { success: true } }));
            `;
        } else {
            // Regular script loading
            script.src = source;
            script.onload = () => {
                log('Three.js loaded successfully from ' + source);
                window.dispatchEvent(new CustomEvent('threejs-loaded', { detail: { success: true } }));
            };
        }
        
        script.onerror = () => {
            log('Failed to load from ' + source);
            document.head.removeChild(script);
            setTimeout(() => loadThreeJS(sourceIndex + 1, callback), 100);
        };
        
        document.head.appendChild(script);
        
        // Timeout for this attempt
        setTimeout(() => {
            if (typeof window.THREE === 'undefined') {
                log('Timeout for source ' + source);
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                loadThreeJS(sourceIndex + 1, callback);
            }
        }, 5000);
    }
    
    function createThreeJSStub() {
        log('Creating Three.js stub for 2D fallback');
        
        // Minimal THREE stub to prevent errors
        window.THREE = {
            Scene: function() { return { add: () => {}, remove: () => {} }; },
            PerspectiveCamera: function() { return { position: { x: 0, y: 0, z: 0 } }; },
            WebGLRenderer: function() { 
                return { 
                    domElement: document.createElement('canvas'),
                    setSize: () => {},
                    setClearColor: () => {},
                    render: () => {},
                    dispose: () => {}
                }; 
            },
            BoxGeometry: function() { return {}; },
            MeshBasicMaterial: function() { return {}; },
            Mesh: function() { return { rotation: { x: 0, y: 0, z: 0 } }; },
            Vector3: function(x, y, z) { return { x: x||0, y: y||0, z: z||0 }; },
            Clock: function() { return { getElapsedTime: () => Date.now() / 1000 }; }
        };
        
        window._threeJSStub = true;
        log('Three.js stub created');
    }
    
    function startLoad() {
        log('Starting Three.js loading process...');
        
        // If Three.js is already loaded, skip
        if (typeof window.THREE !== 'undefined') {
            log('Three.js already available');
            return;
        }
        
        // Listen for successful load
        window.addEventListener('threejs-loaded', function(event) {
            if (event.detail.success && typeof window.THREE !== 'undefined') {
                log('Three.js successfully loaded and available');
                
                // Dispatch engine ready event
                window.dispatchEvent(new CustomEvent('medieval-engine-ready'));
            }
        });
        
        // Start loading attempts
        loadThreeJS(0, (success) => {
            if (!success) {
                log('All loading attempts failed, using 2D fallback');
                window._hasWebGL = false;
                if (window.MedievalFallback && window.MedievalFallback.init2DFallback) {
                    window.MedievalFallback.init2DFallback();
                }
            }
        });
    }
    
    // Start loading based on WebGL support
    if (window._hasWebGL) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startLoad);
        } else {
            startLoad();
        }
    } else {
        log('WebGL not supported, skipping Three.js load');
        createThreeJSStub();
    }
    
})();