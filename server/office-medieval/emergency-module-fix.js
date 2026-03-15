// Emergency Module Loading Fix
// Handles ES6 module failures and THREE.js loading issues

(function() {
    'use strict';
    
    console.log('[Emergency] Module loading fix activated');
    
    // Force THREE.js availability check
    var threeCheck = setInterval(function() {
        if (window.THREE) {
            console.log('[Emergency] THREE.js detected, clearing interval');
            clearInterval(threeCheck);
            return;
        }
        
        // If THREE.js fails to load via modules, try CDN fallback
        if (!document.querySelector('script[src*="unpkg.com/three"]') && 
            !document.querySelector('script[src*="three.module"]')) {
            
            console.log('[Emergency] Loading THREE.js fallback');
            var script = document.createElement('script');
            script.src = 'https://unpkg.com/three@0.162.0/build/three.min.js';
            script.onload = function() {
                console.log('[Emergency] THREE.js fallback loaded');
                window.THREE = window.THREE || THREE;
                initFallbackScene();
            };
            script.onerror = function() {
                console.error('[Emergency] THREE.js fallback failed, using 2D mode');
                init2DFallback();
            };
            document.head.appendChild(script);
        }
    }, 1000);
    
    // Clear check after 30 seconds
    setTimeout(function() {
        clearInterval(threeCheck);
        if (!window.THREE && !window.castleApp) {
            console.warn('[Emergency] Timeout - forcing 2D fallback');
            init2DFallback();
        }
    }, 30000);
    
    function initFallbackScene() {
        if (window.castleApp) return; // Already initialized
        
        console.log('[Emergency] Initializing fallback 3D scene');
        
        // Minimal castle app initialization
        try {
            var scene = new THREE.Scene();
            var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(0x0a0a1a, 1);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
            var container = document.getElementById('scene-container');
            if (container) {
                container.appendChild(renderer.domElement);
            }
            
            // Basic lighting
            var ambientLight = new THREE.AmbientLight(0x404040, 0.6);
            scene.add(ambientLight);
            
            var directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(50, 50, 50);
            directionalLight.castShadow = true;
            scene.add(directionalLight);
            
            // Set camera position
            camera.position.set(30, 25, 30);
            camera.lookAt(0, 0, 0);
            
            // Basic castle app object
            window.castleApp = {
                scene: scene,
                camera: camera,
                renderer: renderer,
                characterModels: new Map(),
                labelElements: new Map(),
                selectedAgent: null,
                
                selectAgent: function(agentId) {
                    this.selectedAgent = agentId;
                    console.log('[Emergency] Selected agent:', agentId);
                },
                
                addCharacter: function(agentId, position) {
                    // Simple cube as character placeholder
                    var geometry = new THREE.BoxGeometry(1, 2, 1);
                    var material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                    var mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(position.x || 0, 1, position.z || 0);
                    mesh.castShadow = true;
                    mesh.userData.agentId = agentId;
                    
                    this.scene.add(mesh);
                    this.characterModels.set(agentId, {
                        group: mesh,
                        model: mesh,
                        mixer: null,
                        animations: []
                    });
                    
                    console.log('[Emergency] Added character:', agentId);
                }
            };
            
            // Add some basic characters
            var defaultAgents = ['Sycopa', 'Forge', 'Atlas', 'Hunter', 'Echo', 'Sentinel'];
            defaultAgents.forEach(function(agentId, index) {
                var angle = (index / defaultAgents.length) * Math.PI * 2;
                var radius = 8;
                window.castleApp.addCharacter(agentId, {
                    x: Math.cos(angle) * radius,
                    z: Math.sin(angle) * radius
                });
            });
            
            // Basic render loop
            function animate() {
                requestAnimationFrame(animate);
                renderer.render(scene, camera);
            }
            animate();
            
            // Hide loading screen
            var loading = document.getElementById('loading-screen');
            if (loading) {
                loading.classList.add('hidden');
                setTimeout(function() { loading.style.display = 'none'; }, 1000);
            }
            
            console.log('[Emergency] Fallback 3D scene ready');
            
        } catch (error) {
            console.error('[Emergency] 3D fallback failed:', error);
            init2DFallback();
        }
    }
    
    function init2DFallback() {
        console.log('[Emergency] Initializing 2D canvas fallback');
        
        var container = document.getElementById('scene-container');
        if (!container) return;
        
        var canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
        
        var ctx = canvas.getContext('2d');
        
        // Simple 2D medieval scene
        function draw() {
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Castle outline
            ctx.fillStyle = '#333';
            ctx.fillRect(canvas.width/2 - 50, canvas.height/2 - 30, 100, 60);
            
            // Tower
            ctx.fillRect(canvas.width/2 - 10, canvas.height/2 - 50, 20, 40);
            
            // Characters as dots
            ctx.fillStyle = '#FFD700';
            var agents = ['Sycopa', 'Forge', 'Atlas', 'Hunter', 'Echo', 'Sentinel'];
            agents.forEach(function(agent, i) {
                var angle = (i / agents.length) * Math.PI * 2;
                var x = canvas.width/2 + Math.cos(angle) * 80;
                var y = canvas.height/2 + Math.sin(angle) * 60;
                
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(agent, x, y - 10);
                ctx.fillStyle = '#FFD700';
            });
            
            // Title
            ctx.fillStyle = '#C9A959';
            ctx.font = 'bold 24px serif';
            ctx.textAlign = 'center';
            ctx.fillText('🏰 SpawnKit Medieval (2D Mode)', canvas.width/2, 60);
        }
        
        container.appendChild(canvas);
        draw();
        
        // Basic castle app for 2D mode
        window.castleApp = {
            characterModels: new Map(),
            selectedAgent: null,
            selectAgent: function(agentId) {
                this.selectedAgent = agentId;
                console.log('[Emergency] 2D Selected agent:', agentId);
            }
        };
        
        // Hide loading screen
        var loading = document.getElementById('loading-screen');
        if (loading) {
            loading.classList.add('hidden');
            setTimeout(function() { loading.style.display = 'none'; }, 1000);
        }
        
        console.log('[Emergency] 2D fallback ready');
    }
    
})();