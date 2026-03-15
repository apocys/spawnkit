// Engine Initialization Fix
// Forces proper module loading sequence for medieval scene

(function() {
    'use strict';
    
    console.log('[Engine Fix] Loading...');
    
    let initAttempts = 0;
    const maxAttempts = 60; // 30 seconds max
    
    function waitForEngine() {
        initAttempts++;
        
        // Check if THREE.js is loaded
        if (!window.THREE) {
            console.log(`[Engine Fix] Attempt ${initAttempts}: THREE.js not ready`);
            if (initAttempts < maxAttempts) {
                setTimeout(waitForEngine, 500);
            } else {
                console.error('[Engine Fix] THREE.js loading timeout - forcing fallback');
                activateEmergencyFallback();
            }
            return;
        }
        
        // Check if castleApp is initialized
        if (!window.castleApp || !window.castleApp.scene) {
            console.log(`[Engine Fix] Attempt ${initAttempts}: Scene not ready`);
            if (initAttempts < maxAttempts) {
                setTimeout(waitForEngine, 500);
            } else {
                console.error('[Engine Fix] Scene initialization timeout - forcing fallback');
                activateEmergencyFallback();
            }
            return;
        }
        
        console.log('[Engine Fix] ✅ Engine ready after', initAttempts, 'attempts');
        onEngineReady();
    }
    
    function onEngineReady() {
        // Hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                if (loadingScreen.parentNode) {
                    loadingScreen.parentNode.removeChild(loadingScreen);
                }
            }, 1000);
        }
        
        // Initialize any dependent systems
        console.log('[Engine Fix] Systems ready - engine initialized successfully');
        
        // Fire custom event for other modules
        window.dispatchEvent(new CustomEvent('engineReady', {
            detail: { castleApp: window.castleApp, attempts: initAttempts }
        }));
    }
    
    function activateEmergencyFallback() {
        console.warn('[Engine Fix] Activating emergency 2D fallback');
        
        const container = document.getElementById('scene-container');
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        
        // Create 2D medieval view
        const canvas = document.createElement('canvas');
        canvas.width = container.clientWidth || window.innerWidth;
        canvas.height = container.clientHeight || window.innerHeight;
        canvas.style.cssText = 'width: 100%; height: 100%; background: #0a1025;';
        
        const ctx = canvas.getContext('2d');
        
        // Draw castle and agents
        function draw() {
            // Clear
            ctx.fillStyle = '#0a1025';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Castle outline
            ctx.fillStyle = '#444';
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            
            // Main keep
            ctx.fillRect(cx - 30, cy - 40, 60, 80);
            
            // Towers
            ctx.fillRect(cx - 50, cy - 50, 20, 30);
            ctx.fillRect(cx + 30, cy - 50, 20, 30);
            ctx.fillRect(cx - 20, cy - 60, 40, 20);
            
            // Agents as dots
            ctx.fillStyle = '#FFD700';
            const agents = ['Sycopa', 'Forge', 'Atlas', 'Hunter', 'Echo', 'Sentinel'];
            agents.forEach((agent, i) => {
                const angle = (i / agents.length) * Math.PI * 2;
                const radius = 80;
                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;
                
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                // Agent labels
                ctx.fillStyle = '#f4e4bc';
                ctx.font = '14px serif';
                ctx.textAlign = 'center';
                ctx.fillText(agent, x, y - 15);
                ctx.fillStyle = '#FFD700';
            });
            
            // Title
            ctx.fillStyle = '#C9A959';
            ctx.font = 'bold 28px serif';
            ctx.textAlign = 'center';
            ctx.fillText('🏰 SpawnKit Medieval', cx, 60);
            
            ctx.font = '16px serif';
            ctx.fillStyle = '#999';
            ctx.fillText('(Emergency 2D Mode)', cx, 85);
        }
        
        container.appendChild(canvas);
        draw();
        
        // Create minimal castle app
        window.castleApp = {
            scene: { children: [] },
            camera: { position: { x: 0, y: 0, z: 0 } },
            selectedAgent: null,
            characterModels: new Map(),
            selectAgent: function(agentId) {
                this.selectedAgent = agentId;
                console.log('[2D Mode] Selected agent:', agentId);
            }
        };
        
        // Hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => loadingScreen.remove(), 1000);
        }
        
        console.log('[Engine Fix] 2D fallback activated');
    }
    
    // Force module loading check
    function forceModuleCheck() {
        // Try to import THREE.js manually if modules failed
        if (!window.THREE) {
            console.log('[Engine Fix] Attempting manual THREE.js load');
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/three@0.162.0/build/three.min.js';
            script.onload = () => {
                console.log('[Engine Fix] Manual THREE.js loaded');
                setTimeout(waitForEngine, 100);
            };
            script.onerror = () => {
                console.error('[Engine Fix] Manual THREE.js failed');
                activateEmergencyFallback();
            };
            document.head.appendChild(script);
        } else {
            waitForEngine();
        }
    }
    
    // Start monitoring after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(forceModuleCheck, 1000);
        });
    } else {
        setTimeout(forceModuleCheck, 1000);
    }
    
})();