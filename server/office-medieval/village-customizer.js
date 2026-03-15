/**
 * Village Customizer — Advanced building and color editing system
 * Integrates with medieval scene for dynamic village customization
 */

class VillageCustomizer {
    constructor(medievalScene) {
        this.scene = medievalScene;
        this.buildingGroups = [];
        this.selectedBuilding = null;
        this.isEditMode = false;
        this.colorPalette = [
            { name: 'Royal Blue', color: 0x3366CC, desc: 'Noble and majestic' },
            { name: 'Crimson Red', color: 0xCC3333, desc: 'Bold and commanding' },
            { name: 'Golden Yellow', color: 0xFFD700, desc: 'Wealthy and prestigious' },
            { name: 'Forest Green', color: 0x228B22, desc: 'Natural and peaceful' },
            { name: 'Royal Purple', color: 0x663399, desc: 'Mystical and wise' },
            { name: 'Sunset Orange', color: 0xFF8C00, desc: 'Warm and welcoming' },
            { name: 'Silver Gray', color: 0x999999, desc: 'Industrial and strong' },
            { name: 'Rose Pink', color: 0xFF69B4, desc: 'Elegant and refined' },
            { name: 'Emerald Green', color: 0x50C878, desc: 'Vibrant and lively' },
            { name: 'Deep Burgundy', color: 0x800020, desc: 'Rich and sophisticated' },
        ];
        
        this.buildingTypes = [
            { name: 'Manor House', width: 3, height: 2.5, depth: 2.5, cost: 500 },
            { name: 'Cottage', width: 2, height: 1.8, depth: 2, cost: 200 },
            { name: 'Workshop', width: 2.5, height: 2, depth: 2, cost: 300 },
            { name: 'Tower', width: 1.5, height: 3.5, depth: 1.5, cost: 400 },
            { name: 'Barn', width: 4, height: 2, depth: 3, cost: 350 },
            { name: 'Chapel', width: 2, height: 3, depth: 1.8, cost: 600 },
        ];
        
        this.villagePlots = [
            // Ring 1 - Close to castle (premium spots)
            { x: -12, z: 18, tier: 'premium', occupied: false },
            { x: -8, z: 20, tier: 'premium', occupied: false },
            { x: -4, z: 22, tier: 'premium', occupied: false },
            { x: 0, z: 24, tier: 'premium', occupied: false },
            { x: 4, z: 22, tier: 'premium', occupied: false },
            { x: 8, z: 20, tier: 'premium', occupied: false },
            { x: 12, z: 18, tier: 'premium', occupied: false },
            
            // Ring 2 - Middle village (standard spots)
            { x: -16, z: 22, tier: 'standard', occupied: false },
            { x: -12, z: 26, tier: 'standard', occupied: false },
            { x: -6, z: 28, tier: 'standard', occupied: false },
            { x: 0, z: 30, tier: 'standard', occupied: false },
            { x: 6, z: 28, tier: 'standard', occupied: false },
            { x: 12, z: 26, tier: 'standard', occupied: false },
            { x: 16, z: 22, tier: 'standard', occupied: false },
            
            // Ring 3 - Outskirts (budget spots)
            { x: -20, z: 26, tier: 'budget', occupied: false },
            { x: -14, z: 32, tier: 'budget', occupied: false },
            { x: -4, z: 35, tier: 'budget', occupied: false },
            { x: 4, z: 35, tier: 'budget', occupied: false },
            { x: 14, z: 32, tier: 'budget', occupied: false },
            { x: 20, z: 26, tier: 'budget', occupied: false },
        ];
        
        this.init();
    }
    
    init() {
        this.createCustomVillage();
        this.setupUI();
        this.setupEventHandlers();
        
        console.log('🏘️ [Village Customizer] Advanced village system initialized');
    }
    
    createCustomVillage() {
        // Enhanced village with more variety and better placement
        const customBuildings = [
            // Central plaza buildings
            { name: '👑 Royal Embassy', color: 0xFFD700, x: -8, z: 24, w: 3, h: 2.5, d: 2.5, type: 'manor' },
            { name: '⚔️ Guild Hall', color: 0xCC3333, x: 8, z: 24, w: 3, h: 2.5, d: 2.5, type: 'manor' },
            
            // Main street
            { name: '🍺 The Prancing Pony', color: 0x8B4513, x: -4, z: 20, w: 2.5, h: 2, d: 2, type: 'tavern' },
            { name: '🛡️ Armory & Forge', color: 0x666666, x: 4, z: 20, w: 2.5, h: 1.8, d: 2.5, type: 'workshop' },
            { name: '📚 Grand Library', color: 0x3366CC, x: 0, z: 18, w: 2.5, h: 2.8, d: 2, type: 'library' },
            
            // Residential quarter
            { name: '🏠 Miller\'s Cottage', color: 0x8FBC8F, x: -12, z: 28, w: 2, h: 1.8, d: 2, type: 'cottage' },
            { name: '🏠 Baker\'s Home', color: 0xF4A460, x: -8, z: 30, w: 2, h: 1.8, d: 2, type: 'cottage' },
            { name: '🏠 Weaver\'s House', color: 0xDDA0DD, x: 8, z: 30, w: 2, h: 1.8, d: 2, type: 'cottage' },
            { name: '🏠 Merchant\'s Manor', color: 0xFF6347, x: 12, z: 28, w: 2.5, h: 2.2, d: 2.5, type: 'manor' },
            
            // Market district
            { name: '🏪 Grand Market', color: 0x228B22, x: -12, z: 22, w: 4, h: 1.5, d: 2.5, type: 'market' },
            { name: '🎪 Festival Pavilion', color: 0xFF69B4, x: 12, z: 22, w: 3, h: 1.8, d: 3, type: 'pavilion' },
            
            // Religious & municipal
            { name: '⛪ Sacred Chapel', color: 0xF5F5DC, x: -6, z: 32, w: 2, h: 3.5, d: 2, type: 'chapel' },
            { name: '🏛️ Town Hall', color: 0x4169E1, x: 6, z: 32, w: 2.8, h: 2.5, d: 2.2, type: 'civic' },
            
            // Outskirts & specialties
            { name: '🌾 Granary', color: 0xDAA520, x: -16, z: 20, w: 3, h: 2, d: 4, type: 'storage' },
            { name: '🐎 Stable & Inn', color: 0x8B4513, x: 16, z: 20, w: 3.5, h: 1.8, d: 2.5, type: 'stable' },
            { name: '🔮 Mystic Tower', color: 0x9370DB, x: -2, z: 35, w: 1.8, h: 4, d: 1.8, type: 'tower' },
            { name: '⚗️ Alchemist Lab', color: 0x32CD32, x: 2, z: 35, w: 2, h: 2.2, d: 2, type: 'workshop' },
            
            // Special venues
            { name: '🎭 Theater', color: 0xDC143C, x: 0, z: 26, w: 3.5, h: 2, d: 2, type: 'theater' },
            { name: '🏟️ Colosseum', color: 0xC9A959, x: 0, z: -30, w: 6, h: 1.5, d: 6, type: 'arena' },
        ];
        
        this.buildingGroups = [];
        
        customBuildings.forEach((building, index) => {
            const group = this.createBuildingGroup(building);
            group.userData.buildingData = building;
            group.userData.buildingIndex = index;
            group.userData.originalColor = building.color;
            
            this.scene.scene.add(group);
            this.buildingGroups.push(group);
            
            // Mark plot as occupied
            const nearestPlot = this.findNearestPlot(building.x, building.z);
            if (nearestPlot) nearestPlot.occupied = true;
        });
        
        console.log(`🏘️ [Village Customizer] Created ${customBuildings.length} unique buildings`);
    }
    
    createBuildingGroup(building) {
        const group = new THREE.Group();
        
        // Main structure
        const walls = new THREE.Mesh(
            new THREE.BoxGeometry(building.w, building.h, building.d),
            new THREE.MeshStandardMaterial({ 
                color: 0xE8DCC6, // Stone walls
                roughness: 0.8,
                metalness: 0.1
            })
        );
        walls.position.y = building.h / 2;
        walls.castShadow = true;
        walls.receiveShadow = true;
        group.add(walls);
        
        // Create roof based on building type
        const roof = this.createRoof(building);
        roof.material.color.setHex(building.color);
        group.add(roof);
        
        // Add architectural details
        this.addBuildingDetails(group, building);
        
        group.position.set(building.x, 0, building.z);
        group.userData.buildingName = building.name;
        group.userData.buildingType = building.type;
        group.userData.roofMesh = roof;
        group.userData.wallsMesh = walls;
        
        // Tag all children for raycasting
        group.traverse(child => { 
            if (child.isMesh) {
                child.userData.buildingName = building.name;
                child.userData.parentGroup = group;
            }
        });
        
        return group;
    }
    
    createRoof(building) {
        const roofStyle = this.getRoofStyle(building.type);
        let roof;
        
        switch (roofStyle) {
            case 'pyramid':
                roof = new THREE.Mesh(
                    new THREE.ConeGeometry(Math.max(building.w, building.d) * 0.8, building.h * 0.6, 4),
                    new THREE.MeshStandardMaterial({ color: building.color })
                );
                roof.rotation.y = Math.PI / 4;
                break;
                
            case 'pointed':
                roof = new THREE.Mesh(
                    new THREE.ConeGeometry(Math.max(building.w, building.d) * 0.7, building.h * 0.8, 8),
                    new THREE.MeshStandardMaterial({ color: building.color })
                );
                break;
                
            case 'dome':
                roof = new THREE.Mesh(
                    new THREE.SphereGeometry(Math.max(building.w, building.d) * 0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
                    new THREE.MeshStandardMaterial({ color: building.color })
                );
                break;
                
            case 'flat':
                roof = new THREE.Mesh(
                    new THREE.BoxGeometry(building.w * 1.1, 0.2, building.d * 1.1),
                    new THREE.MeshStandardMaterial({ color: building.color })
                );
                break;
                
            default: // gabled
                const roofGeo = new THREE.BufferGeometry();
                const vertices = new Float32Array([
                    // Front triangle
                    -building.w/2, 0, building.d/2,
                    building.w/2, 0, building.d/2,
                    0, building.h * 0.4, building.d/2,
                    // Back triangle  
                    -building.w/2, 0, -building.d/2,
                    building.w/2, 0, -building.d/2,
                    0, building.h * 0.4, -building.d/2,
                ]);
                const indices = [0,1,2, 3,5,4, 0,3,5, 0,5,2, 1,4,5, 1,5,2];
                roofGeo.setIndex(indices);
                roofGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                roofGeo.computeVertexNormals();
                roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: building.color }));
        }
        
        roof.position.y = building.h + (roofStyle === 'flat' ? 0.1 : building.h * 0.2);
        roof.castShadow = true;
        
        return roof;
    }
    
    getRoofStyle(buildingType) {
        const styles = {
            'manor': 'gabled',
            'cottage': 'pyramid',
            'workshop': 'flat',
            'tower': 'pointed',
            'chapel': 'pointed',
            'tavern': 'gabled',
            'market': 'flat',
            'arena': 'flat',
            'library': 'dome',
            'civic': 'gabled',
            'theater': 'dome',
            'pavilion': 'pyramid',
            'stable': 'gabled',
            'storage': 'flat'
        };
        return styles[buildingType] || 'pyramid';
    }
    
    addBuildingDetails(group, building) {
        // Add windows
        const windowCount = Math.floor(building.w * 1.5);
        for (let i = 0; i < windowCount; i++) {
            const window = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.4, 0.05),
                new THREE.MeshStandardMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.7 })
            );
            window.position.set(
                (-building.w/2 + 0.5) + i * (building.w - 1) / (windowCount - 1),
                building.h * 0.4,
                building.d/2 + 0.02
            );
            group.add(window);
        }
        
        // Add door
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.8, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        door.position.set(0, 0.4, building.d/2 + 0.02);
        group.add(door);
        
        // Add chimney for certain buildings
        if (['cottage', 'manor', 'tavern'].includes(building.type)) {
            const chimney = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, building.h * 0.8, 0.3),
                new THREE.MeshStandardMaterial({ color: 0x696969 })
            );
            chimney.position.set(building.w * 0.3, building.h + building.h * 0.4, 0);
            chimney.castShadow = true;
            group.add(chimney);
        }
        
        // Add special features based on building type
        this.addTypeSpecificDetails(group, building);
    }
    
    addTypeSpecificDetails(group, building) {
        switch (building.type) {
            case 'tower':
                // Add battlements
                for (let i = 0; i < 4; i++) {
                    const battlement = new THREE.Mesh(
                        new THREE.BoxGeometry(0.2, 0.3, 0.2),
                        new THREE.MeshStandardMaterial({ color: 0x696969 })
                    );
                    const angle = (i / 4) * Math.PI * 2;
                    battlement.position.set(
                        Math.cos(angle) * (building.w * 0.4),
                        building.h + 0.15,
                        Math.sin(angle) * (building.d * 0.4)
                    );
                    group.add(battlement);
                }
                break;
                
            case 'market':
                // Add market stalls
                for (let i = 0; i < 3; i++) {
                    const stall = new THREE.Mesh(
                        new THREE.BoxGeometry(0.8, 0.6, 0.6),
                        new THREE.MeshStandardMaterial({ color: 0xDEB887 })
                    );
                    stall.position.set(-1 + i * 1, 0.3, building.d * 0.6);
                    group.add(stall);
                }
                break;
                
            case 'chapel':
                // Add cross on roof
                const cross = new THREE.Group();
                const crossVertical = new THREE.Mesh(
                    new THREE.BoxGeometry(0.05, 0.6, 0.05),
                    new THREE.MeshStandardMaterial({ color: 0xFFD700 })
                );
                const crossHorizontal = new THREE.Mesh(
                    new THREE.BoxGeometry(0.3, 0.05, 0.05),
                    new THREE.MeshStandardMaterial({ color: 0xFFD700 })
                );
                crossHorizontal.position.y = 0.1;
                cross.add(crossVertical, crossHorizontal);
                cross.position.set(0, building.h + building.h * 0.5, 0);
                group.add(cross);
                break;
                
            case 'stable':
                // Add hay bales
                for (let i = 0; i < 2; i++) {
                    const hay = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8),
                        new THREE.MeshStandardMaterial({ color: 0xDAA520 })
                    );
                    hay.position.set(-0.5 + i * 1, 0.2, building.d * 0.3);
                    hay.rotation.z = Math.PI / 2;
                    group.add(hay);
                }
                break;
        }
    }
    
    setupUI() {
        // Create Edit Mode Toggle Button
        const editToggle = document.createElement('button');
        editToggle.id = 'edit-mode-toggle';
        editToggle.className = 'edit-mode-btn';
        editToggle.innerHTML = '🎨 Edit Village';
        editToggle.style.cssText = `
            position: fixed; top: 80px; right: 20px; z-index: 1000;
            background: linear-gradient(135deg, #8B4513, #D2691E);
            color: white; border: 2px solid #DAA520; border-radius: 8px;
            padding: 12px 18px; font-size: 14px; font-weight: bold;
            cursor: pointer; transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        editToggle.addEventListener('click', () => this.toggleEditMode());
        document.body.appendChild(editToggle);
        
        // Create Color Palette Panel
        this.createColorPalette();
        
        // Create Building Info Panel
        this.createBuildingInfoPanel();
    }
    
    createColorPalette() {
        const panel = document.createElement('div');
        panel.id = 'color-palette-panel';
        panel.style.cssText = `
            position: fixed; top: 130px; right: 20px; z-index: 999;
            width: 280px; background: rgba(13, 13, 26, 0.95);
            border: 2px solid #C9A959; border-radius: 12px;
            padding: 16px; display: none; backdrop-filter: blur(5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.4);
        `;
        
        panel.innerHTML = `
            <div style="font-family: MedievalSharp, fantasy; color: #F4E4BC; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px; color: #C9A959;">🎨 Roof Colors</h3>
                <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Select a color for the selected building</p>
            </div>
            <div id="color-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                ${this.colorPalette.map(color => `
                    <div class="color-option" data-color="${color.color}" style="
                        background: #${color.color.toString(16).padStart(6, '0')};
                        padding: 8px; border-radius: 6px; cursor: pointer;
                        border: 2px solid transparent; transition: all 0.3s;
                        text-align: center; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
                        font-size: 11px; font-weight: bold;
                    ">
                        <div>${color.name}</div>
                        <div style="font-size: 9px; opacity: 0.9;">${color.desc}</div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(201,169,89,0.3);">
                <button id="reset-color-btn" style="
                    width: 100%; background: #E94560; color: white; border: none;
                    padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px;
                ">🔄 Reset to Original</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Add event handlers
        panel.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                const color = parseInt(option.dataset.color);
                this.changeBuildingColor(color);
            });
            
            option.addEventListener('mouseenter', () => {
                option.style.border = '2px solid #FFD700';
                option.style.transform = 'scale(1.05)';
            });
            
            option.addEventListener('mouseleave', () => {
                option.style.border = '2px solid transparent';
                option.style.transform = 'scale(1)';
            });
        });
        
        panel.querySelector('#reset-color-btn').addEventListener('click', () => {
            this.resetBuildingColor();
        });
    }
    
    createBuildingInfoPanel() {
        const panel = document.createElement('div');
        panel.id = 'building-info-panel';
        panel.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 999;
            width: 300px; background: rgba(13, 13, 26, 0.95);
            border: 2px solid #C9A959; border-radius: 12px;
            padding: 16px; display: none; backdrop-filter: blur(5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.4);
            font-family: MedievalSharp, fantasy; color: #F4E4BC;
        `;
        
        panel.innerHTML = `
            <div id="building-info-content">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #C9A959;" id="building-info-name">Building Name</h3>
                <div style="font-size: 12px; opacity: 0.8; margin-bottom: 12px;" id="building-info-type">Building Type</div>
                <div id="building-info-stats" style="margin-bottom: 12px;">
                    <!-- Stats will be populated here -->
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="edit-building-btn" style="
                        flex: 1; background: #4169E1; color: white; border: none;
                        padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px;
                    ">✏️ Customize</button>
                    <button id="demolish-building-btn" style="
                        flex: 1; background: #E94560; color: white; border: none;
                        padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px;
                    ">💥 Demolish</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Add event handlers
        panel.querySelector('#edit-building-btn').addEventListener('click', () => {
            this.editSelectedBuilding();
        });
        
        panel.querySelector('#demolish-building-btn').addEventListener('click', () => {
            this.demolishSelectedBuilding();
        });
    }
    
    setupEventHandlers() {
        // Override building click detection
        const originalOnSceneClick = this.scene.onSceneClick.bind(this.scene);
        this.scene.onSceneClick = (event) => {
            if (this.isEditMode) {
                this.handleBuildingClick(event);
            } else {
                originalOnSceneClick(event);
            }
        };
    }
    
    handleBuildingClick(event) {
        const mouse = this.scene.getMouseNDC(event);
        this.scene.raycaster.setFromCamera(mouse, this.scene.camera);
        
        // Check building groups
        const buildingMeshes = [];
        this.buildingGroups.forEach(group => {
            group.traverse(child => {
                if (child.isMesh) buildingMeshes.push(child);
            });
        });
        
        const hits = this.scene.raycaster.intersectObjects(buildingMeshes, false);
        if (hits.length > 0) {
            const clickedMesh = hits[0].object;
            const buildingGroup = clickedMesh.userData.parentGroup || 
                                this.findBuildingGroupByMesh(clickedMesh);
            
            if (buildingGroup) {
                this.selectBuilding(buildingGroup);
            }
        } else {
            this.deselectBuilding();
        }
    }
    
    findBuildingGroupByMesh(mesh) {
        return this.buildingGroups.find(group => 
            group === mesh.parent || 
            group.children.includes(mesh)
        );
    }
    
    selectBuilding(buildingGroup) {
        // Deselect previous
        if (this.selectedBuilding) {
            this.highlightBuilding(this.selectedBuilding, false);
        }
        
        this.selectedBuilding = buildingGroup;
        this.highlightBuilding(buildingGroup, true);
        this.updateBuildingInfoPanel(buildingGroup);
        
        // Show color palette
        document.getElementById('color-palette-panel').style.display = 'block';
        
        console.log('🏠 [Village Customizer] Selected building:', buildingGroup.userData.buildingName);
    }
    
    deselectBuilding() {
        if (this.selectedBuilding) {
            this.highlightBuilding(this.selectedBuilding, false);
            this.selectedBuilding = null;
        }
        
        // Hide panels
        document.getElementById('color-palette-panel').style.display = 'none';
        document.getElementById('building-info-panel').style.display = 'none';
    }
    
    highlightBuilding(buildingGroup, highlight) {
        buildingGroup.traverse(child => {
            if (child.isMesh) {
                if (highlight) {
                    child.material = child.material.clone();
                    child.material.emissive.setHex(0x444444);
                    child.material.emissiveIntensity = 0.3;
                } else {
                    // Reset to original material
                    if (child.userData.originalMaterial) {
                        child.material = child.userData.originalMaterial;
                    } else {
                        child.material.emissive.setHex(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                }
            }
        });
    }
    
    updateBuildingInfoPanel(buildingGroup) {
        const buildingData = buildingGroup.userData.buildingData;
        
        document.getElementById('building-info-name').textContent = buildingData.name;
        document.getElementById('building-info-type').textContent = `Type: ${buildingData.type}`;
        
        const stats = document.getElementById('building-info-stats');
        stats.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                <div>Width: ${buildingData.w}m</div>
                <div>Height: ${buildingData.h}m</div>
                <div>Depth: ${buildingData.d}m</div>
                <div>Roof: ${this.getRoofStyle(buildingData.type)}</div>
            </div>
        `;
        
        document.getElementById('building-info-panel').style.display = 'block';
    }
    
    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const toggle = document.getElementById('edit-mode-toggle');
        
        if (this.isEditMode) {
            toggle.innerHTML = '✅ Exit Edit';
            toggle.style.background = 'linear-gradient(135deg, #E94560, #FF6B8A)';
            this.showEditModeUI();
        } else {
            toggle.innerHTML = '🎨 Edit Village';
            toggle.style.background = 'linear-gradient(135deg, #8B4513, #D2691E)';
            this.hideEditModeUI();
            this.deselectBuilding();
        }
        
        console.log('🎨 [Village Customizer] Edit mode:', this.isEditMode ? 'ON' : 'OFF');
    }
    
    showEditModeUI() {
        // Add edit mode indicator
        const indicator = document.createElement('div');
        indicator.id = 'edit-mode-indicator';
        indicator.innerHTML = '🎨 EDIT MODE ACTIVE';
        indicator.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(233, 69, 96, 0.9); color: white; padding: 8px 16px;
            border-radius: 20px; font-size: 12px; font-weight: bold;
            z-index: 1000; animation: pulse 2s infinite;
        `;
        document.body.appendChild(indicator);
        
        // Add CSS for pulse animation
        const style = document.createElement('style');
        style.textContent = '@keyframes pulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }';
        document.head.appendChild(style);
        
        // Show available plots
        this.showAvailablePlots();
    }
    
    hideEditModeUI() {
        const indicator = document.getElementById('edit-mode-indicator');
        if (indicator) indicator.remove();
        
        // Hide all edit panels
        document.getElementById('color-palette-panel').style.display = 'none';
        document.getElementById('building-info-panel').style.display = 'none';
        
        this.hideAvailablePlots();
    }
    
    changeBuildingColor(color) {
        if (!this.selectedBuilding) return;
        
        const roofMesh = this.selectedBuilding.userData.roofMesh;
        if (roofMesh) {
            roofMesh.material.color.setHex(color);
            console.log('🎨 [Village Customizer] Changed roof color to:', '#' + color.toString(16));
            
            // Visual feedback
            this.showColorChangeEffect(this.selectedBuilding);
        }
    }
    
    resetBuildingColor() {
        if (!this.selectedBuilding) return;
        
        const originalColor = this.selectedBuilding.userData.originalColor;
        const roofMesh = this.selectedBuilding.userData.roofMesh;
        
        if (roofMesh && originalColor) {
            roofMesh.material.color.setHex(originalColor);
            console.log('🔄 [Village Customizer] Reset to original color');
            
            this.showColorChangeEffect(this.selectedBuilding);
        }
    }
    
    showColorChangeEffect(buildingGroup) {
        // Create sparkle effect
        const sparkles = [];
        for (let i = 0; i < 8; i++) {
            const sparkle = new THREE.Mesh(
                new THREE.SphereGeometry(0.05),
                new THREE.MeshBasicMaterial({ color: 0xFFD700 })
            );
            
            const bounds = new THREE.Box3().setFromObject(buildingGroup);
            sparkle.position.set(
                bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
                bounds.max.y + Math.random() * 0.5,
                bounds.min.z + Math.random() * (bounds.max.z - bounds.min.z)
            );
            
            this.scene.scene.add(sparkle);
            sparkles.push(sparkle);
        }
        
        // Animate sparkles
        let time = 0;
        const animateSparkles = () => {
            time += 0.1;
            sparkles.forEach((sparkle, i) => {
                sparkle.position.y += 0.02;
                sparkle.scale.setScalar(1 - time * 0.5);
                sparkle.material.opacity = 1 - time * 0.5;
            });
            
            if (time < 2) {
                requestAnimationFrame(animateSparkles);
            } else {
                sparkles.forEach(sparkle => {
                    this.scene.scene.remove(sparkle);
                    sparkle.geometry.dispose();
                    sparkle.material.dispose();
                });
            }
        };
        animateSparkles();
    }
    
    findNearestPlot(x, z) {
        let nearest = null;
        let minDistance = Infinity;
        
        this.villagePlots.forEach(plot => {
            const distance = Math.sqrt((plot.x - x) ** 2 + (plot.z - z) ** 2);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = plot;
            }
        });
        
        return nearest;
    }
    
    showAvailablePlots() {
        // Add visual indicators for available building plots
        this.plotIndicators = [];
        
        this.villagePlots.forEach(plot => {
            if (!plot.occupied) {
                const indicator = new THREE.Mesh(
                    new THREE.RingGeometry(0.8, 1.2, 8),
                    new THREE.MeshBasicMaterial({ 
                        color: 0x00FF00, 
                        transparent: true, 
                        opacity: 0.5,
                        side: THREE.DoubleSide
                    })
                );
                
                indicator.position.set(plot.x, 0.02, plot.z);
                indicator.rotation.x = -Math.PI / 2;
                
                this.scene.scene.add(indicator);
                this.plotIndicators.push(indicator);
            }
        });
    }
    
    hideAvailablePlots() {
        if (this.plotIndicators) {
            this.plotIndicators.forEach(indicator => {
                this.scene.scene.remove(indicator);
                indicator.geometry.dispose();
                indicator.material.dispose();
            });
            this.plotIndicators = [];
        }
    }
    
    editSelectedBuilding() {
        if (!this.selectedBuilding) return;
        
        // Open detailed building editor (future enhancement)
        alert('🚧 Advanced building editor coming soon! For now, use the color palette to customize roof colors.');
    }
    
    demolishSelectedBuilding() {
        if (!this.selectedBuilding) return;
        
        const buildingName = this.selectedBuilding.userData.buildingName;
        if (confirm(`Are you sure you want to demolish ${buildingName}?`)) {
            // Create destruction effect
            this.createDestructionEffect(this.selectedBuilding);
            
            // Remove from scene
            this.scene.scene.remove(this.selectedBuilding);
            
            // Remove from our tracking
            const index = this.buildingGroups.indexOf(this.selectedBuilding);
            if (index > -1) {
                this.buildingGroups.splice(index, 1);
            }
            
            // Free up the plot
            const buildingData = this.selectedBuilding.userData.buildingData;
            const plot = this.findNearestPlot(buildingData.x, buildingData.z);
            if (plot) plot.occupied = false;
            
            this.deselectBuilding();
            console.log('💥 [Village Customizer] Demolished:', buildingName);
        }
    }
    
    createDestructionEffect(buildingGroup) {
        // Create particle explosion
        const particleCount = 20;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                new THREE.MeshBasicMaterial({ color: 0x8B4513 })
            );
            
            const bounds = new THREE.Box3().setFromObject(buildingGroup);
            particle.position.copy(bounds.getCenter(new THREE.Vector3()));
            
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.15,
                (Math.random() - 0.5) * 0.2
            );
            
            this.scene.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate particles
        let time = 0;
        const animateParticles = () => {
            time += 0.05;
            particles.forEach(particle => {
                particle.position.add(particle.userData.velocity);
                particle.userData.velocity.y -= 0.008; // gravity
                particle.rotation.x += 0.1;
                particle.rotation.y += 0.1;
                particle.scale.setScalar(1 - time * 0.3);
            });
            
            if (time < 3) {
                requestAnimationFrame(animateParticles);
            } else {
                particles.forEach(particle => {
                    this.scene.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();
                });
            }
        };
        animateParticles();
    }
    
    // Public API for external access
    getBuildingList() {
        return this.buildingGroups.map(group => ({
            name: group.userData.buildingName,
            type: group.userData.buildingType,
            position: group.position,
            data: group.userData.buildingData
        }));
    }
    
    addNewBuilding(x, z, buildingType = 'cottage') {
        const plot = this.findNearestPlot(x, z);
        if (!plot || plot.occupied) {
            console.warn('🚫 [Village Customizer] Cannot build here - plot occupied or invalid');
            return null;
        }
        
        const newBuilding = {
            name: `New ${buildingType}`,
            color: 0x8B4513,
            x: plot.x,
            z: plot.z,
            w: 2,
            h: 2,
            d: 2,
            type: buildingType
        };
        
        const group = this.createBuildingGroup(newBuilding);
        group.userData.buildingData = newBuilding;
        group.userData.originalColor = newBuilding.color;
        
        this.scene.scene.add(group);
        this.buildingGroups.push(group);
        plot.occupied = true;
        
        console.log('🏗️ [Village Customizer] Built new building:', newBuilding.name);
        return group;
    }
}

// Auto-initialize when medieval scene is ready
document.addEventListener('DOMContentLoaded', () => {
    const checkForScene = () => {
        if (window.castleApp && window.castleApp.scene) {
            setTimeout(() => {
                window.villageCustomizer = new VillageCustomizer(window.castleApp);
                console.log('🏘️ [Village Customizer] System ready!');
            }, 2000); // Wait for scene to fully load
        } else {
            setTimeout(checkForScene, 500);
        }
    };
    checkForScene();
});

// Export for manual access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageCustomizer;
}