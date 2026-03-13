# Medieval Map Editor

A decorative object placement system for the SpawnKit medieval castle theme.

## Features

- **Floating Palette**: Medieval-themed parchment palette with placeable objects
- **Object Categories**: Trees, Walls, Buildings, and Props
- **Grid Overlay**: Visual grid for precise placement in edit mode
- **Click to Place**: Select object, click terrain to place
- **Right-click to Delete**: Remove placed objects with right-click
- **Persistence**: Objects saved to localStorage and restored on page reload
- **Medieval Styling**: Consistent with the castle theme (Crimson Text font, parchment colors)

## Usage

1. **Enter Edit Mode**: Press `7` on the hotbar or use MissionHouses edit mode
2. **Select Object**: Click any object in the floating palette
3. **Place Object**: Click on the terrain to place the selected object
4. **Delete Objects**: Right-click placed objects to remove them
5. **Clear All**: Use the "Clear All Objects" button to remove everything
6. **Exit Edit Mode**: Press `7` again to exit edit mode

## Available Objects

### Trees (🌳)
- **Oak Tree** (🌳): Large green tree with spherical crown
- **Pine Tree** (🌲): Tall coniferous tree with layered cones
- **Willow Tree** (🌿): Droopy weeping tree

### Walls (🧱)
- **Stone Wall**: Gray stone wall segments for boundaries

### Buildings (🏠)
- **Well** (🏗️): Medieval well with wooden roof
- **Tower** (🗼): Tall cylindrical watchtower
- **Cottage** (🏠): Small residential building

### Props (📦)
- **Banner** (🚩): Flag on a pole
- **Campfire** (🔥): Glowing fire with emissive material
- **Barrel** (🛢️): Wooden storage barrel
- **Crate** (📦): Wooden storage crate

## Technical Details

### Storage
- Objects saved to `localStorage` with key `'spawnkit-map-objects'`
- Data format: Array of object descriptors with id, type, position, rotation

### Integration
- Hooks into `MissionHouses.toggleEditMode()` 
- Compatible with existing edit mode indicators
- Uses `window.THREE` for geometry creation
- Integrates with `window.castleApp` scene management

### Performance
- All objects use simple Three.js primitives (boxes, cylinders, spheres)
- Proper shadow casting and receiving
- Material cleanup on deletion
- Grid overlay uses efficient GridHelper

### API

```javascript
window.MedievalMapEditor = {
    toggleEditMode: function(),      // Toggle edit mode on/off
    isEditMode: function(),          // Check if edit mode active
    selectObject: function(type),    // Programmatically select object type
    clearAll: function(),           // Clear all placed objects
    getPlacedObjects: function(),   // Get array of placed objects
    getObjectTypes: function(),     // Get array of available object types
    debug: function()               // Debug information
}
```

## File Structure

- **medieval-map-editor.js**: Main implementation
- **Storage**: localStorage key `'spawnkit-map-objects'`
- **Integration**: Hooks into existing MissionHouses edit mode
- **Styling**: Inline CSS matching medieval theme

## Dependencies

- Three.js (via window.THREE)
- MissionHouses module for edit mode integration
- castleApp for scene access
- Medieval CSS variables for consistent styling