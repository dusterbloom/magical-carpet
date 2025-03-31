# Task 033: Fix Sun Occlusion and Positioning

## 1. Task & Context
**Task:** Modify the sun system to prevent players from reaching it and ensure mountains can properly block the sun from view
**Scope:** SunSystem.js
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** 
1. Position the sun relative to the player's camera
2. Implement proper material settings for occlusion
3. Update visibility rules to match the moon's behavior

**Complexity:** 2-Moderate
**Uncertainty:** 3-High
**Unknowns:** 
- Multiple aspects of rendering affecting occlusion
- Interaction between material properties and depth buffer

**Human Input Needed:** No

## 3. Implementation
After testing, we found we needed to address two separate issues:

1. **Fixed sun positioning relative to camera**:
```javascript
// Increased distance to make unreachable
this.SUN_DISTANCE = 300000;

// Update position relative to camera every frame
this.sunPosition.x = cameraPosition.x + Math.cos(angle) * this.SUN_DISTANCE;
this.sunPosition.z = cameraPosition.z;
```

2. **Fixed material settings to match moon's for proper occlusion**:
```javascript
// Before:
const sunMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
  depthWrite: false, 
  depthTest: true
});

// After:
const sunMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  transparent: true,
  opacity: 0.9,
  side: THREE.FrontSide,  // Changed to match moon
  depthWrite: true,       // Changed to enable proper occlusion
  depthTest: true
});
```

3. **Updated visibility logic for day/night cycle**:
```javascript
const isAboveHorizon = this.sunPosition.y > 0;
const dayFactor = timeOfDay > 0.25 && timeOfDay < 0.75 ? 1.0 : 0.0;
this.sunSphere.visible = isAboveHorizon && dayFactor > 0.0;
```

## 4. Check & Commit
**Changes Made:**
- Made sun position relative to player camera
- Increased sun distance to 300,000 units
- Changed material side from DoubleSide to FrontSide
- Changed depthWrite from false to true for proper occlusion
- Added proper visibility checks matching moon behavior

**Commit Message:** fix: ensure sun is properly occluded by terrain and cannot be reached

**Status:** Complete
