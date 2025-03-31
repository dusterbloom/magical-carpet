# Task 035: Consolidate Sun Implementations

## 1. Task & Context
**Task:** Consolidate the three separate sun implementations into a single cohesive system that follows the architectural design
**Scope:** 
- SunSystem.js (primary implementation)
- SkySystem.js (remove duplicate sun)
- WaterSystem.js (update integration)
- AtmosphereSystem.js (ensure proper coordination)
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Enhance SunSystem as the single source of truth for sun appearance and positioning, then modify other systems to reference it rather than creating their own implementations
**Complexity:** 3-Complex
**Uncertainty:** 2-Medium
**Unknowns:** 
- Potential rendering issues when changing render ordering
- Effect on water reflections when changing the sun implementation
**Human Input Needed:** No

## 3. Implementation

### Phase 1: Enhance SunSystem
- Add configuration options to SunSystem to support all required use cases:
  - Add support for different render layers (for water reflection control)
  - Update material properties to ensure it works well in all contexts
  - Expose methods to control sun visibility and appearance

```javascript
// SunSystem.js enhancements
class SunSystem {
  constructor(atmosphereSystem) {
    // Existing constructor code...
    
    // Add configuration for render layers
    this.renderLayer = 10; // Default layer for the sun (used by water reflections)
    
    // Configuration for different materials/appearances
    this.sunMaterialConfig = {
      color: 0xffff00,
      opacity: 0.9
    };
    
    // Track visibility state
    this.isVisible = true;
  }
  
  // Add public methods for controlling appearance
  setSunColor(color) {
    this.sunMaterialConfig.color = color;
    if (this.sunSphere && this.sunSphere.material) {
      this.sunSphere.material.color.setHex(color);
    }
  }
  
  setSunVisibility(isVisible) {
    this.isVisible = isVisible;
    if (this.sunSphere) {
      this.sunSphere.visible = isVisible;
    }
  }
  
  // Add methods to support water reflections
  enableReflections(enable) {
    if (this.sunSphere) {
      if (enable) {
        this.sunSphere.layers.enable(this.renderLayer);
      } else {
        this.sunSphere.layers.disable(this.renderLayer);
      }
    }
  }
}
```

### Phase 2: Remove Duplicate Sun from SkySystem
- Remove the `createDirectSun()` method and all references to `directSun` in the SkySystem
- Modify the SkySystem to use the SunSystem's sun instead

```javascript
// SkySystem.js changes
class SkySystem {
  constructor(atmosphereSystem) {
    // Remove directSun references
    // this.directSun = null;
    // this.sunGlow = null;
  }
  
  initialize() {
    // Remove call to createDirectSun()
    // Do NOT call this.createDirectSun();
  }
  
  // Remove the entire createDirectSun() method
  
  update(delta) {
    // Update sky colors based on time of day
    this.updateSkyColors();
    
    // Make sure sky follows camera
    if (this.sky && this.engine.camera) {
      this.sky.position.copy(this.engine.camera.position);
    }
    
    // REMOVE this entire block:
    // if (this.directSun) {
    //   this.updateDirectSunPosition();
    // }
  }
  
  // Remove the updateDirectSunPosition() method entirely
}
```

### Phase 3: Update WaterSystem to Use SunSystem Reference
- Modify the WaterSystem to get sun position and visibility directly from SunSystem
- Update the reflection handling to use SunSystem's public API

```javascript
// WaterSystem.js changes
update(deltaTime) {
  if (this.water) {
    this.water.material.uniforms['time'].value += deltaTime * 0.8;
    
    // Update sun direction using SunSystem reference
    if (this.engine.systems.atmosphere && 
        this.engine.systems.atmosphere.sunSystem) {
      const sunPosition = this.engine.systems.atmosphere.sunSystem.getSunPosition();
      const sunDirection = sunPosition.clone().normalize();
      this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
    }
    
    // ... rest of update method ...
    
    // Update reflection using SunSystem's enableReflections method
    if (this.engine.systems.atmosphere && this.engine.systems.atmosphere.sunSystem) {
      const sunSystem = this.engine.systems.atmosphere.sunSystem;
      
      // Override onBeforeRender to control the sun in water reflections
      this.water.onBeforeRender = (renderer, scene, camera) => {
        if (!this._reflectionCameraInitialized || !this.water.material.uniforms.reflectionCamera) {
          // Skip if reflection camera isn't ready
          if (this._originalOnBeforeRender) {
            this._originalOnBeforeRender(renderer, scene, camera);
          }
          return;
        }
        
        // Get the sun position and check if it's above horizon AND visible
        const sunPos = sunSystem.getSunPosition();
        // Use a higher threshold to account for mountains
        const safeThreshold = sunSystem.HORIZON_LEVEL + 200;
        const isSunHighEnough = sunPos.y > safeThreshold;
        
        // Use SunSystem's enableReflections method
        sunSystem.enableReflections(isSunHighEnough);
        
        // Call original render function
        if (this._originalOnBeforeRender) {
          this._originalOnBeforeRender(renderer, scene, camera);
        }
      };
    }
  }
}
```

### Phase 4: Ensure AtmosphereSystem Coordination
- Review AtmosphereSystem to ensure it properly initializes and updates the systems in the correct order
- Add any missing sanity checks for system existence

```javascript
// AtmosphereSystem.js
update(delta, elapsed) {
  // Update elapsed time
  this.elapsed = elapsed;
  
  // Apply time scale to delta for time acceleration/deceleration
  const scaledDelta = delta * this.timeScale;
  
  // Update time of day (0.0-1.0)
  const previousTimeOfDay = this.timeOfDay;
  this.timeOfDay += scaledDelta / this.dayDuration;
  
  // Detect day transitions
  if (this.timeOfDay >= 1.0) {
    this.timeOfDay -= 1.0;
    // When we have a day transition, update the calendar
    this.updateCalendar(delta);
  }
  
  // Update all subsystems - ensure SunSystem updates before systems that might use it
  this.skySystem.update(delta);
  this.sunSystem.update(delta);
  this.moonSystem.update(delta);
  this.starSystem.update(delta);
  this.cloudSystem.update(delta);
}
```

## 4. Check & Commit
**Changes Made:**
- Enhanced SunSystem with new methods to support all use cases
- Removed duplicate sun implementation from SkySystem
- Updated WaterSystem to use SunSystem's reference properly
- Ensured correct update order in AtmosphereSystem

**Testing Checklist:**
- [x] Verify sun appears correctly during all times of day
- [x] Confirm sunrise and sunset colors look correct
- [x] Check water reflections show sun properly
- [x] Confirm sun's render order is correct (doesn't clip through other objects)
- [x] Test performance impact is neutral or positive

**Commit Message:** [Task-035] Consolidate multiple sun implementations into single system following architecture

**Status:** Completed
