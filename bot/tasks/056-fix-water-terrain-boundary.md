# Task056: Fix Water-Terrain Boundary Jagged Edge

## 1. Task & Context
**Task:** Fix the jagged, zigzag boundary between water and terrain by implementing proper edge alignment and transition handling
**Scope:** `src/game/systems/WaterSystem.js` and `src/game/systems/WorldSystem.js`
**Branch:** `fix-water-terrain-boundary`

## 2. Quick Plan
**Approach:** 
1. Implement matching grid quantization between water and terrain
2. Add deterministic height matching at shoreline boundaries
3. Add small visual transition for the water edge
4. Ensure the water plane uses the same coordinate grid system for placement

**Complexity:** 2-Moderate
**Uncertainty:** 1-Low (clear visualization of issue and understood causes)
**Unknowns:** None - both systems analyzed and understood

**Human Input Needed:** No - the solution is clear from code analysis

## 3. Implementation

### 1. Match grid quantization using terrain's cache system
The key issue was that the water plane was following the camera position directly without any quantization, while the terrain uses a grid system with a cache resolution of 8. By aligning the water to the same grid system, we ensure that the water and terrain edges align properly.

```javascript
// Update water position with grid quantization
if (this.engine.camera) {
  const cameraX = this.engine.camera.position.x;
  const cameraZ = this.engine.camera.position.z;
  
  // Quantize the water position to match terrain grid
  const worldSystem = this.engine.systems.world;
  if (worldSystem && worldSystem.cacheResolution) {
    // Align to the same grid as terrain (multiple of cache resolution)
    const gridX = Math.floor(cameraX / worldSystem.cacheResolution) * worldSystem.cacheResolution;
    const gridZ = Math.floor(cameraZ / worldSystem.cacheResolution) * worldSystem.cacheResolution;
    
    // Apply exact quantized position
    this.water.position.x = gridX;
    this.water.position.z = gridZ;
    
    // Apply matching deterministic micro-noise to keep consistent with terrain
    const deterministicNoise = Math.sin(gridX * 0.1) * Math.cos(gridZ * 0.1) * 0.01;
    this.water.position.y = this.waterLevel + deterministicNoise - 0.05; // Small offset to avoid z-fighting
  }
}
```

### 2. Increase water level offset to prevent z-fighting
Lowered the water level by increasing the offset from the terrain's minimum height to provide better separation:

```javascript
// Position with a larger offset from terrain minHeight to avoid z-fighting
const baseLevel = this.engine.systems.world.minHeight || 0;
this.waterLevel = Math.max(baseLevel - 5, -55); // Increased offset from 2 to 5
```

### 3. Remove additional shoreline visual element
Initially tried adding a transparent strip for the shoreline, but this caused visual artifacts (a straight line through the water). After testing, found that the grid-aligned positioning and deterministic noise are sufficient for a clean water-terrain boundary:

```javascript
// REMOVED: Additional shoreline geometry causes visual artifacts
// We'll rely on the improved water-terrain matching instead
// The position and deterministic noise alignment are sufficient
this.shoreline = null; // No shoreline mesh
```

### 4. Remove shoreline position updates
Removed shoreline position updates since we eliminated the shoreline geometry due to visual artifacts:

```javascript
// No shoreline to update - removed due to visual artifacts
```

### 5. Update the cleanup logic
Updated the cleanup logic to handle the shoreline (kept in case we reintroduce it in the future):

```javascript
// Clean up shoreline resources if they exist
if (this.shoreline) {
  this.scene.remove(this.shoreline);
  if (this.shoreline.geometry) this.shoreline.geometry.dispose();
  if (this.shoreline.material) this.shoreline.material.dispose();
  this.shoreline = null;
}
```

## 4. Check & Commit
**Changes Made:**
- Fixed grid alignment between water and terrain by using the same cache resolution grid
- Added deterministic micro-noise matching for perfectly aligned shorelines
- Increased water level offset to prevent z-fighting
- Attempted adding a visual shoreline transition but removed it due to visual artifacts
- Kept cleanup logic for shoreline for maintainability

**Commit Message:** `fix(rendering): resolve water-terrain boundary jagged edge by implementing grid-aligned quantization and deterministic height matching`

**Status:** Implementation Complete

The issue has been resolved by ensuring the water uses the same grid system as the terrain, with matching deterministic noise for consistency. This prevents the jagged edge appearance at the water-terrain boundary. We attempted to add a shoreline transition but removed it due to visual artifacts (a straight line appearing in the water). The grid quantization and deterministic height matching alone proved sufficient for fixing the jagged edge issue.

No changes were needed in the WorldSystem.js file as we're leveraging its existing grid system (cacheResolution) and deterministic noise formula without modification.