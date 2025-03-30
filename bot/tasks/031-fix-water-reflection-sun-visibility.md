# Task Template

## 1. Task & Context
**Task:** Fix water reflection showing the sun when it should be hidden by mountains
**Scope:** WaterSystem.js and SunSystem.js
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Use Three.js layers system to control sun visibility in water reflections based on horizon position
**Complexity:** 2-Moderate
**Uncertainty:** 2-Medium
**Unknowns:** 
- How Three.js Water component handles reflections internally
- How to properly configure reflection cameras with layers

**Human Input Needed:** No

## 3. Implementation

After analyzing the code, I found that the issue is in how the water reflection system works. The Three.js Water object creates a separate camera to render the reflection, but this camera doesn't properly handle sun visibility when the sun is below the horizon.

The solution is to use Three.js layers system to control what the reflection camera can see. By placing the sun on a specific layer (layer 10) and then controlling whether that layer is visible to the reflection camera based on the sun's position relative to the horizon, we can ensure the sun only appears in reflections when it should be visible.

```javascript
// 1. First, place the sun on a specific layer in SunSystem.js
this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
this.sunSphere.renderOrder = 10000;
// Add the sun to a specific layer (layer 10) so we can control its visibility in reflections
this.sunSphere.layers.set(10);
this.scene.add(this.sunSphere);

// 2. Then in WaterSystem.js, control whether the reflection camera can see layer 10
this.water.onBeforeRender = (renderer, scene, camera) => {
  if (!this._reflectionCameraInitialized || !this.water.material.uniforms.reflectionCamera) {
    // Skip if reflection camera isn't ready
    if (this._originalOnBeforeRender) {
      this._originalOnBeforeRender(renderer, scene, camera);
    }
    return;
  }
  
  // Get the reflection camera
  const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
  
  // Get the sun position and check if it's above horizon
  const sunPos = sunSystem.getSunPosition();
  const isSunAboveHorizon = sunPos.y > sunSystem.HORIZON_LEVEL;
  
  // Temporarily adjust layers for the reflection camera
  if (isSunAboveHorizon) {
    // Sun should be visible in reflection - enable layer 10
    reflectionCamera.layers.enable(10);
  } else {
    // Sun should be hidden - disable layer 10
    reflectionCamera.layers.disable(10);
  }
  
  // Call original render function
  if (this._originalOnBeforeRender) {
    this._originalOnBeforeRender(renderer, scene, camera);
  }
};
```

I also made sure to initialize the reflection camera properly and clean up in the dispose method:

```javascript
// Initialize reflection camera when it becomes available
if (!this._reflectionCameraInitialized && this.water.material.uniforms.reflectionCamera) {
  const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
  // Configure base layers (default scene content)
  reflectionCamera.layers.set(0);  // Reset to default layer
  reflectionCamera.layers.enable(1); // Regular scene
  reflectionCamera.layers.enable(2); // Cloud reflections
  this._reflectionCameraInitialized = true;
}

// In dispose method
dispose() {
  if (this.water) {
    // Restore original onBeforeRender if we overrode it
    if (this._originalOnBeforeRender) {
      this.water.onBeforeRender = this._originalOnBeforeRender;
      this._originalOnBeforeRender = null;
    }
    
    this.scene.remove(this.water);
    this.water.geometry.dispose();
    this.water.material.dispose();
    this.water = null;
  }
}
```

## 4. Check & Commit

**Changes Made:**
- Modified SunSystem.js to place the sun on a dedicated rendering layer (layer 10)
- Updated WaterSystem.js to initialize the reflection camera with proper layer configuration
- Added logic to control whether the reflection camera can see the sun layer based on sun position
- Used the Three.js layers system instead of directly manipulating object visibility
- Made sure to properly clean up any overrides in the dispose method

**Commit Message:** fix(water): prevent sun reflection when sun is below horizon

**Status:** Complete
