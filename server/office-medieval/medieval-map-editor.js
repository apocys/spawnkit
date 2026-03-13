/**
 * Medieval Map Editor — Decorative object placement system
 * 
 * Features:
 * - Floating palette with placeable objects (trees, walls, buildings, props)
 * - Click to select object, click on terrain to place
 * - Right-click placed objects to delete
 * - Grid overlay in edit mode for easier placement
 * - Objects persist to localStorage ('spawnkit-map-objects')
 * - Medieval parchment styling
 */
(function() {
    'use strict';

    var STORAGE_KEY = 'spawnkit-map-objects';
    var placedObjects = [];
    var selectedObjectType = null;
    var editModeActive = false;
    var palette = null;
    var gridOverlay = null;

    // Object definitions with Three.js geometry functions
    var OBJECT_TYPES = [
        // Trees
        { 
            id: 'oak_tree', 
            name: 'Oak Tree', 
            icon: '🌳', 
            color: 0x228B22, 
            category: 'trees',
            geometry: function() {
                var group = new THREE.Group();
                // Trunk
                var trunk = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.1, 0.15, 1.5, 8),
                    new THREE.MeshStandardMaterial({ color: 0x8B4513 })
                );
                trunk.position.y = 0.75;
                trunk.castShadow = true;
                group.add(trunk);
                // Crown
                var crown = new THREE.Mesh(
                    new THREE.SphereGeometry(0.8, 12, 8),
                    new THREE.MeshStandardMaterial({ color: this.color })
                );
                crown.position.y = 1.8;
                crown.scale.y = 1.3;
                crown.castShadow = true;
                group.add(crown);
                return group;
            }
        },
        { 
            id: 'pine_tree', 
            name: 'Pine Tree', 
            icon: '🌲', 
            color: 0x006400, 
            category: 'trees',
            geometry: function() {
                var group = new THREE.Group();
                // Trunk
                var trunk = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8),
                    new THREE.MeshStandardMaterial({ color: 0x654321 })
                );
                trunk.position.y = 0.6;
                trunk.castShadow = true;
                group.add(trunk);
                // Three cone layers
                for (var i = 0; i < 3; i++) {
                    var cone = new THREE.Mesh(
                        new THREE.ConeGeometry(0.6 - i * 0.15, 0.8, 8),
                        new THREE.MeshStandardMaterial({ color: this.color })
                    );
                    cone.position.y = 1.2 + i * 0.4;
                    cone.castShadow = true;
                    group.add(cone);
                }
                return group;
            }
        },
        { 
            id: 'willow_tree', 
            name: 'Willow Tree', 
            icon: '🌿', 
            color: 0x9ACD32, 
            category: 'trees',
            geometry: function() {
                var group = new THREE.Group();
                // Trunk
                var trunk = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.12, 0.18, 1.8, 8),
                    new THREE.MeshStandardMaterial({ color: 0x696969 })
                );
                trunk.position.y = 0.9;
                trunk.castShadow = true;
                group.add(trunk);
                // Droopy crown
                var crown = new THREE.Mesh(
                    new THREE.SphereGeometry(1.0, 12, 8),
                    new THREE.MeshStandardMaterial({ color: this.color })
                );
                crown.position.y = 2.0;
                crown.scale.y = 0.7; // Flatten for droopy effect
                crown.castShadow = true;
                group.add(crown);
                return group;
            }
        },
        // Walls
        { 
            id: 'stone_wall', 
            name: 'Stone Wall', 
            icon: '🧱', 
            color: 0x808080, 
            category: 'walls',
            geometry: function() {
                var wall = new THREE.Mesh(
                    new THREE.BoxGeometry(2, 1.2, 0.3),
                    new THREE.MeshStandardMaterial({ color: this.color })
                );
                wall.position.y = 0.6;
                wall.castShadow = true;
                wall.receiveShadow = true;
                return wall;
            }
        },
        // Buildings
        { 
            id: 'well', 
            name: 'Well', 
            icon: '🏗️', 
            color: 0x696969, 
            category: 'buildings',
            geometry: function() {
                var group = new THREE.Group();
                // Base
                var base = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.6, 0.8, 0.5, 12),
                    new THREE.MeshStandardMaterial({ color: this.color })
                );
                base.position.y = 0.25;
                base.castShadow = true;
                group.add(base);
                // Roof
                var roof = new THREE.Mesh(
                    new THREE.ConeGeometry(0.9, 0.6, 8),
                    new THREE.MeshStandardMaterial({ color: 0x8B4513 })
                );
                roof.position.y = 1.0;
                roof.castShadow = true;
                group.add(roof);
                return group;
            }
        },
        { 
            id: 'tower', 
            name: 'Tower', 
            icon: '🗼', 
            color: 0xD2B48C, 
            category: 'buildings',
            geometry: function() {
                var group = new THREE.Group();
                // Base
                var base = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.7, 0.8, 2.5, 8),
                    new THREE.MeshStandardMaterial({ color: this.color })
                );
                base.position.y = 1.25;
                base.castShadow = true;
                group.add(base);
                // Top
                var top = new THREE.Mesh(
                    new THREE.ConeGeometry(0.9, 1.0, 8),
                    new THREE.MeshStandardMaterial({ color: 0x8B0000 })
                );
                top.position.y = 3.0;
                top.castShadow = true;
                group.add(top);
                return group;
            }
        },
        { 
            id: 'cottage', 
            name: 'Cottage', 
            icon: '🏠', 
            color: 0xDEB887, 
            category: 'buildings',
            geometry: function() {
                var group = new THREE.Group();
                // Walls
                var walls = new THREE.Mesh(
                    new THREE.BoxGeometry(1.5, 1.0, 1.2),
                    new THREE.MeshStandardMaterial({ color: this.color })
                );
                walls.position.y = 0.5;
                walls.castShadow = true;
                group.add(walls);
                // Roof
                var roof = new THREE.Mesh(
                    new THREE.BoxGeometry(1.8, 0.8, 1.5),
                    new THREE.MeshStandardMaterial({ color: 0x8B4513 })
                );
                roof.position.y = 1.2;
                roof.rotation.x = Math.PI / 6;
                roof.castShadow = true;
                group.add(roof);
                return group;
            }
        },
        // Props
        { 
            id: 'banner', 
            name: 'Banner', 
            icon: '🚩', 
            color: 0xDC143C, 
            category: 'props',
            geometry: function() {
                var group = new THREE.Group();
                // Pole
                var pole = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8),
                    new THREE.MeshStandardMaterial({ color: 0x8B4513 })
                );
                pole.position.y = 1.25;
                pole.castShadow = true;
                group.add(pole);
                // Flag
                var flag = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.8, 0.6),
                    new THREE.MeshStandardMaterial({ color: this.color, side: THREE.DoubleSide })
                );
                flag.position.set(0.4, 2.0, 0);
                flag.castShadow = true;
                group.add(flag);
                return group;
            }
        },
        { 
            id: 'campfire', 
            name: 'Campfire', 
            icon: '🔥', 
            color: 0xFF4500, 
            category: 'props',
            geometry: function() {
                var group = new THREE.Group();
                // Fire base (logs)
                var logs = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8),
                    new THREE.MeshStandardMaterial({ color: 0x654321 })
                );
                logs.position.y = 0.05;
                logs.castShadow = true;
                group.add(logs);
                // Flame effect (glowing sphere)
                var flame = new THREE.Mesh(
                    new THREE.SphereGeometry(0.2, 8, 6),
                    new THREE.MeshStandardMaterial({ 
                        color: this.color, 
                        emissive: this.color,
                        emissiveIntensity: 0.3
                    })
                );
                flame.position.y = 0.3;
                flame.scale.y = 1.5;
                group.add(flame);
                return group;
            }
        },
        { 
            id: 'barrel', 
            name: 'Barrel', 
            icon: '🛢️', 
            color: 0x8B4513, 
            category: 'props',
            geometry: function() {
                var barrel = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.3, 0.25, 0.6, 12),
                    new THREE.MeshStandardMaterial({ color: this.color })
                );
                barrel.position.y = 0.3;
                barrel.castShadow = true;
                barrel.receiveShadow = true;
                return barrel;
            }
        },
        { 
            id: 'crate', 
            name: 'Crate', 
            icon: '📦', 
            color: 0xD2691E, 
            category: 'props',
            geometry: function() {
                var crate = new THREE.Mesh(
                    new THREE.BoxGeometry(0.5, 0.5, 0.5),
                    new THREE.MeshStandardMaterial({ color: this.color })
                );
                crate.position.y = 0.25;
                crate.castShadow = true;
                crate.receiveShadow = true;
                return crate;
            }
        }
    ];

    // ── Storage ──────────────────────────────────────────────────────
    function loadObjects() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch(e) {
            console.warn('[MapEditor] Failed to load objects:', e);
            return [];
        }
    }

    function saveObjects() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(placedObjects));
        } catch(e) {
            console.warn('[MapEditor] Failed to save objects:', e);
        }
    }

    // ── Scene Management ─────────────────────────────────────────────
    function getScene() {
        return window.castleApp && window.castleApp.scene;
    }

    function createGridOverlay() {
        var scene = getScene();
        if (!scene) return null;

        var size = 100;
        var divisions = 20;
        var grid = new THREE.GridHelper(size, divisions, 0x808080, 0x404040);
        grid.position.y = 0.01; // Slightly above ground
        grid.material.transparent = true;
        grid.material.opacity = 0.3;
        grid.userData.isMapEditorGrid = true;
        scene.add(grid);
        return grid;
    }

    function removeGridOverlay() {
        var scene = getScene();
        if (!scene || !gridOverlay) return;
        
        scene.remove(gridOverlay);
        if (gridOverlay.geometry) gridOverlay.geometry.dispose();
        if (gridOverlay.material) gridOverlay.material.dispose();
        gridOverlay = null;
    }

    function placeObject(type, position) {
        var scene = getScene();
        if (!scene) return null;

        var objData = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
            type: type.id,
            position: { x: position.x, y: 0, z: position.z },
            rotation: Math.random() * Math.PI * 2 // Random rotation for variety
        };

        // Create 3D object
        var obj3d = type.geometry();
        obj3d.position.copy(objData.position);
        obj3d.rotation.y = objData.rotation;
        obj3d.userData.mapEditorObject = true;
        obj3d.userData.objectId = objData.id;
        obj3d.userData.objectType = type.id;

        // Enable shadows
        obj3d.traverse(function(child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.userData.mapEditorObject = true;
                child.userData.objectId = objData.id;
            }
        });

        scene.add(obj3d);
        placedObjects.push(objData);
        saveObjects();

        console.log('[MapEditor] Placed', type.name, 'at', position);
        return obj3d;
    }

    function removeObject(objectId) {
        var scene = getScene();
        if (!scene) return;

        // Remove from scene
        var toRemove = [];
        scene.traverse(function(child) {
            if (child.userData.objectId === objectId) {
                toRemove.push(child);
            }
        });

        toRemove.forEach(function(obj) {
            if (obj.parent) obj.parent.remove(obj);
            // Clean up geometry and materials
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(function(mat) { if (mat.dispose) mat.dispose(); });
                } else {
                    obj.material.dispose();
                }
            }
        });

        // Remove from data
        placedObjects = placedObjects.filter(function(obj) { return obj.id !== objectId; });
        saveObjects();

        console.log('[MapEditor] Removed object', objectId);
    }

    function restoreObjects() {
        var scene = getScene();
        if (!scene) return;

        var stored = loadObjects();
        stored.forEach(function(objData) {
            var type = OBJECT_TYPES.find(function(t) { return t.id === objData.type; });
            if (!type) {
                console.warn('[MapEditor] Unknown object type:', objData.type);
                return;
            }

            var obj3d = type.geometry();
            obj3d.position.set(objData.position.x, objData.position.y, objData.position.z);
            obj3d.rotation.y = objData.rotation || 0;
            obj3d.userData.mapEditorObject = true;
            obj3d.userData.objectId = objData.id;
            obj3d.userData.objectType = type.id;

            obj3d.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.userData.mapEditorObject = true;
                    child.userData.objectId = objData.id;
                }
            });

            scene.add(obj3d);
        });

        placedObjects = stored;
        console.log('[MapEditor] Restored', stored.length, 'objects');
    }

    function clearAllObjects() {
        if (!confirm('Delete all placed objects?')) return;

        var scene = getScene();
        if (scene) {
            var toRemove = [];
            scene.traverse(function(child) {
                if (child.userData.mapEditorObject) {
                    toRemove.push(child);
                }
            });

            toRemove.forEach(function(obj) {
                if (obj.parent) obj.parent.remove(obj);
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(function(mat) { if (mat.dispose) mat.dispose(); });
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }

        placedObjects = [];
        saveObjects();
        console.log('[MapEditor] Cleared all objects');
    }

    // ── UI: Floating Palette ─────────────────────────────────────────
    function createPalette() {
        if (palette) return;

        palette = document.createElement('div');
        palette.id = 'map-editor-palette';
        palette.style.cssText = [
            'position: fixed',
            'top: 80px',
            'left: 20px',
            'width: 280px',
            'max-height: calc(100vh - 160px)',
            'background: linear-gradient(145deg, #f4e4bc 0%, #e8d5a3 100%)', // Parchment
            'border: 2px solid #8b7355',
            'border-radius: 8px',
            'box-shadow: 0 4px 16px rgba(0,0,0,0.4)',
            'z-index: 200',
            'overflow-y: auto',
            'font-family: "Crimson Text", serif',
            'color: #2c2c2c',
            'display: none'
        ].join(';');

        // Header
        var header = document.createElement('div');
        header.style.cssText = 'padding: 12px; border-bottom: 2px solid #8b7355; background: #d4b76a; font-weight: 600; text-align: center; font-size: 16px;';
        header.innerHTML = '🏗️ Map Editor';

        // Categories
        var categories = [
            { id: 'trees', name: 'Trees', icon: '🌳' },
            { id: 'walls', name: 'Walls', icon: '🧱' },
            { id: 'buildings', name: 'Buildings', icon: '🏠' },
            { id: 'props', name: 'Props', icon: '📦' }
        ];

        var content = document.createElement('div');
        content.style.padding = '12px';

        categories.forEach(function(category) {
            var section = document.createElement('div');
            section.style.marginBottom = '16px';

            var title = document.createElement('div');
            title.style.cssText = 'font-weight: 600; margin-bottom: 8px; color: #8b7355; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;';
            title.textContent = category.icon + ' ' + category.name;

            var grid = document.createElement('div');
            grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px;';

            var items = OBJECT_TYPES.filter(function(obj) { return obj.category === category.id; });
            items.forEach(function(item) {
                var btn = document.createElement('button');
                btn.style.cssText = [
                    'padding: 8px',
                    'border: 2px solid #8b7355',
                    'border-radius: 6px',
                    'background: rgba(255,255,255,0.8)',
                    'cursor: pointer',
                    'font-size: 12px',
                    'font-family: inherit',
                    'transition: all 0.2s',
                    'color: #2c2c2c'
                ].join(';');
                btn.innerHTML = '<div style="font-size: 18px; margin-bottom: 4px;">' + item.icon + '</div>' + item.name;
                btn.title = item.name;

                btn.addEventListener('click', function() {
                    selectObjectType(item);
                    updatePaletteSelection();
                });

                btn.addEventListener('mouseenter', function() {
                    btn.style.borderColor = '#c9a959';
                    btn.style.background = 'rgba(201,169,89,0.2)';
                    btn.style.transform = 'translateY(-1px)';
                });

                btn.addEventListener('mouseleave', function() {
                    if (selectedObjectType !== item) {
                        btn.style.borderColor = '#8b7355';
                        btn.style.background = 'rgba(255,255,255,0.8)';
                        btn.style.transform = 'none';
                    }
                });

                btn.dataset.objectType = item.id;
                grid.appendChild(btn);
            });

            section.appendChild(title);
            section.appendChild(grid);
            content.appendChild(section);
        });

        // Clear All button
        var clearBtn = document.createElement('button');
        clearBtn.style.cssText = [
            'width: 100%',
            'padding: 10px',
            'margin-top: 8px',
            'border: 2px solid #cc3333',
            'border-radius: 6px',
            'background: rgba(204,51,51,0.1)',
            'color: #cc3333',
            'font-family: inherit',
            'font-weight: 600',
            'cursor: pointer',
            'font-size: 13px',
            'transition: all 0.2s'
        ].join(';');
        clearBtn.textContent = '🗑️ Clear All Objects';
        clearBtn.addEventListener('click', clearAllObjects);
        clearBtn.addEventListener('mouseenter', function() {
            clearBtn.style.background = 'rgba(204,51,51,0.2)';
        });
        clearBtn.addEventListener('mouseleave', function() {
            clearBtn.style.background = 'rgba(204,51,51,0.1)';
        });

        // Instructions
        var instructions = document.createElement('div');
        instructions.style.cssText = 'font-size: 11px; color: #666; margin-top: 12px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; line-height: 1.4;';
        instructions.innerHTML = [
            '• Select an object above',
            '• Click on terrain to place',
            '• Right-click placed objects to delete',
            '• Press 7 to exit edit mode'
        ].join('<br>');

        content.appendChild(clearBtn);
        content.appendChild(instructions);
        palette.appendChild(header);
        palette.appendChild(content);
        document.body.appendChild(palette);

        console.log('[MapEditor] Created palette');
    }

    function selectObjectType(type) {
        selectedObjectType = type;
        console.log('[MapEditor] Selected object type:', type.name);
        
        // Update cursor style
        var container = document.getElementById('scene-container');
        if (container) {
            container.style.cursor = 'crosshair';
        }
    }

    function updatePaletteSelection() {
        if (!palette) return;

        var buttons = palette.querySelectorAll('button[data-object-type]');
        buttons.forEach(function(btn) {
            if (selectedObjectType && btn.dataset.objectType === selectedObjectType.id) {
                btn.style.borderColor = '#c9a959';
                btn.style.background = 'rgba(201,169,89,0.3)';
                btn.style.fontWeight = '600';
            } else {
                btn.style.borderColor = '#8b7355';
                btn.style.background = 'rgba(255,255,255,0.8)';
                btn.style.fontWeight = 'normal';
            }
        });
    }

    // ── Raycasting for terrain clicks ───────────────────────────────
    function getTerrainClickPosition(event) {
        var app = window.castleApp;
        if (!app || !app.camera || !app.raycaster) return null;

        var container = document.getElementById('scene-container');
        if (!container) return null;

        var rect = container.getBoundingClientRect();
        var mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        app.raycaster.setFromCamera(mouse, app.camera);

        // Find ground plane
        var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        var intersectPoint = new THREE.Vector3();
        
        if (app.raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
            return intersectPoint;
        }

        return null;
    }

    function getObjectUnderCursor(event) {
        var app = window.castleApp;
        if (!app || !app.camera || !app.raycaster) return null;

        var container = document.getElementById('scene-container');
        if (!container) return null;

        var rect = container.getBoundingClientRect();
        var mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        app.raycaster.setFromCamera(mouse, app.camera);

        var intersectables = [];
        var scene = getScene();
        if (scene) {
            scene.traverse(function(child) {
                if (child.userData.mapEditorObject && child.isMesh) {
                    intersectables.push(child);
                }
            });
        }

        var intersects = app.raycaster.intersectObjects(intersectables, false);
        return intersects.length > 0 ? intersects[0].object : null;
    }

    // ── Event Handlers ───────────────────────────────────────────────
    function onSceneClick(event) {
        if (!editModeActive) return;

        event.preventDefault();
        event.stopPropagation();

        if (selectedObjectType) {
            // Place object
            var position = getTerrainClickPosition(event);
            if (position) {
                placeObject(selectedObjectType, position);
            }
        }
    }

    function onSceneRightClick(event) {
        if (!editModeActive) return;

        event.preventDefault();
        event.stopPropagation();

        var clickedObject = getObjectUnderCursor(event);
        if (clickedObject && clickedObject.userData.objectId) {
            removeObject(clickedObject.userData.objectId);
        }
    }

    function onSceneMouseMove(event) {
        if (!editModeActive) return;

        var container = document.getElementById('scene-container');
        if (!container) return;

        var clickedObject = getObjectUnderCursor(event);
        container.style.cursor = clickedObject ? 'pointer' : (selectedObjectType ? 'crosshair' : 'default');
    }

    // ── Edit Mode Toggle ─────────────────────────────────────────────
    function toggleEditMode() {
        editModeActive = !editModeActive;
        console.log('[MapEditor] Edit mode:', editModeActive);

        if (editModeActive) {
            enterEditMode();
        } else {
            exitEditMode();
        }
    }

    function enterEditMode() {
        // Show palette
        createPalette();
        if (palette) {
            palette.style.display = 'block';
        }

        // Show grid overlay
        gridOverlay = createGridOverlay();

        // Add event listeners
        var container = document.getElementById('scene-container');
        if (container) {
            container.addEventListener('click', onSceneClick, true);
            container.addEventListener('contextmenu', onSceneRightClick, true);
            container.addEventListener('mousemove', onSceneMouseMove, true);
        }

        // Disable camera controls during placement
        if (window.castleApp && window.castleApp.controls) {
            window.castleApp.controls.enabled = true; // Keep enabled for navigation
        }

        console.log('[MapEditor] Entered edit mode');
    }

    function exitEditMode() {
        // Hide palette
        if (palette) {
            palette.style.display = 'none';
        }

        // Remove grid overlay
        removeGridOverlay();

        // Remove event listeners
        var container = document.getElementById('scene-container');
        if (container) {
            container.removeEventListener('click', onSceneClick, true);
            container.removeEventListener('contextmenu', onSceneRightClick, true);
            container.removeEventListener('mousemove', onSceneMouseMove, true);
            container.style.cursor = 'default';
        }

        // Clear selection
        selectedObjectType = null;

        // Re-enable camera controls
        if (window.castleApp && window.castleApp.controls) {
            window.castleApp.controls.enabled = true;
        }

        console.log('[MapEditor] Exited edit mode');
    }

    // ── Integration with Mission Houses Edit Mode ────────────────────
    function initializeMapEditor() {
        // Wait for scene to be ready
        var retries = 0;
        var maxRetries = 60;

        function tryInit() {
            retries++;
            if (!getScene()) {
                if (retries <= maxRetries) {
                    setTimeout(tryInit, 500);
                } else {
                    console.warn('[MapEditor] Scene never became ready after', maxRetries * 0.5, 'seconds');
                }
                return;
            }

            // Restore objects from storage
            restoreObjects();

            // Integration with mission houses edit mode
            if (window.MissionHouses) {
                var originalToggleEditMode = window.MissionHouses.toggleEditMode;
                window.MissionHouses.toggleEditMode = function() {
                    originalToggleEditMode.call(this);
                    toggleEditMode();
                };

                var originalIsEditMode = window.MissionHouses.isEditMode;
                window.MissionHouses.isEditMode = function() {
                    return originalIsEditMode.call(this) || editModeActive;
                };
            }

            console.log('[MapEditor] Initialized successfully');
        }

        tryInit();
    }

    // ── Public API ────────────────────────────────────────────────────
    window.MedievalMapEditor = {
        toggleEditMode: toggleEditMode,
        isEditMode: function() { return editModeActive; },
        selectObject: selectObjectType,
        clearAll: clearAllObjects,
        getPlacedObjects: function() { return placedObjects.slice(); },
        getObjectTypes: function() { return OBJECT_TYPES.slice(); },
        
        // Debug helpers
        debug: function() {
            console.log('[MapEditor] Edit mode:', editModeActive);
            console.log('[MapEditor] Selected type:', selectedObjectType);
            console.log('[MapEditor] Placed objects:', placedObjects.length);
            console.log('[MapEditor] Scene ready:', !!getScene());
        }
    };

    // ── Initialize ────────────────────────────────────────────────────
    // Wait for DOM and Three.js to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMapEditor);
    } else {
        initializeMapEditor();
    }

    console.log('[MapEditor] Module loaded');

})();