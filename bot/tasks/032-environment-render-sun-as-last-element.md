# Task 032: Render Sun as Last Element on Horizon

## 1. Task & Context
**Task:** Ensure the sun is rendered as the very last thing on the horizon to make sunrise and sunset plausible
**Scope:** Sun rendering system in the world generation pipeline
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Create a dedicated sun sprite/overlay similar to the moon implementation, ensuring it renders after all landscape elements
**Complexity:** 2-Moderate
**Uncertainty:** 1-Low
**Unknowns:** 
- Exact rendering order in the current pipeline
- How the moon sprite was implemented (need to find reference)
**Human Input Needed:** No

## 3. Implementation

```javascript
// Changes to SunSystem.js:

// 1. Set high render order to ensure sun is rendered after terrain
this.sunSphere.renderOrder = 99; // High value ensures it's drawn after terrain

// 2. Updated material properties for sun and glow to ensure proper depth rendering
const sunMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
  depthWrite: false, 
  // Use depth test but with a custom depth function that always passes
  // This ensures the sun is rendered last but still positioned correctly in 3D space
  depthTest: true,
  depthFunc: THREE.AlwaysDepth
});

const glowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffaa,
  transparent: true,
  opacity: 0.2,
  side: THREE.DoubleSide,
  depthWrite: false,
  depthTest: true,
  depthFunc: THREE.AlwaysDepth
});

// 3. Always keep sun visible but adjust opacity based on altitude
// Removed: this.sunSphere.visible = this.sunPosition.y > this.HORIZON_LEVEL;
// Added:
this.sunSphere.visible = true;

// 4. Added opacity adjustment based on height below horizon
const belowHorizonFactor = altitude > 0 ? 1.0 : Math.max(0, 1.0 + (altitude / 300));
this.sunSphere.material.opacity = 0.9 * belowHorizonFactor;
this.sunGlow.material.opacity = 0.2 * belowHorizonFactor;
```

## 4. Check & Commit
**Changes Made:**
- Changed sun's renderOrder from -1 to 99 to ensure it renders after terrain elements
- Updated sun and sun glow material properties to use THREE.AlwaysDepth for depth testing
- Modified sun visibility logic to always keep sun visible but with opacity-based falloff
- Added altitude-based opacity adjustment for more realistic sunrise/sunset transitions
- Extended the altitude threshold for color changes to show partial sun below horizon

**Commit Message:** [Environment] Fix sun rendering to appear behind horizon for realistic sunrise/sunset

**Status:** Complete
