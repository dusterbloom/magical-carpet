# Task 032: Fix Sun Render Order

## 1. Task & Context
**Task:** Ensure the sun is always rendered first (as the furthest background element) to make sunrise and sunset plausible
**Scope:** SunSystem.js and related rendering code
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Update the sun's rendering properties to ensure it's always drawn before terrain and other scene elements by setting appropriate depth and render order values
**Complexity:** 2-Moderate
**Uncertainty:** 2-Medium
**Unknowns:** 
- How the sun's rendering interacts with the terrain generation in all cases
- If other elements might still occlude the sun

**Human Input Needed:** No

## 3. Implementation
After analyzing the code, I found that while the sun has a high renderOrder (10000), we need to ensure it's correctly handled in the depth buffer. The current implementation has depth testing enabled for the sun, which means other objects can occlude it.

Changes to make in src/game/systems/atmosphere/SunSystem.js:

```javascript
// In createSunSphere() method:
const sunMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
  depthWrite: false,  // Change from true to false
  depthTest: false    // Change from true to false
});

this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
this.sunSphere.renderOrder = -1;  // Change from 10000 to -1
```

Same changes for the glow material:

```javascript
const glowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffaa,
  transparent: true,
  opacity: 0.2,
  side: THREE.DoubleSide,
  depthWrite: false,  // Change from true to false
  depthTest: false    // Change from true to false
});
```

## 4. Check & Commit
**Changes Made:**
- Changed sun's material depthWrite from true to false
- Changed sun's material depthTest from true to false
- Changed sun's renderOrder from 10000 to -1 (to render before everything else)
- Applied same changes to sun glow material

**Commit Message:** fix: ensure sun is rendered as furthest background element for plausible sunrise/sunset

**Status:** Complete
