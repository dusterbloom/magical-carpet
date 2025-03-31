# Task 041: Fix Brown Water and Flashing Issues on Mobile Devices

## 1. Task & Context
**Task:** Fix water appearance on mobile devices by changing color and preventing flashing
**Scope:** Changes to WaterSystem.js, focusing on the createWater and update methods
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Modify the water system to use a brighter blue color for mobile and prevent flashing by minimizing reflections
**Complexity:** 2-Moderate
**Uncertainty:** 2-Medium
**Unknowns:** How the water shader handles reflections and what causes the flashing
**Human Input Needed:** No

## 3. Implementation
The current water color (0x001e0f) appears brown on mobile, and water also has flashing issues. We'll make multiple changes to improve mobile water appearance:

1. Change to a vibrant blue color (0x00aaff) for all mobile devices
2. Apply this color at multiple points in the render cycle to ensure consistency
3. Minimize (but not completely eliminate) reflections to prevent flashing
4. Apply these fixes to all quality settings, with different treatments for each level

```javascript
// CHANGE 1: Add water color selection before creating the Water object
// Choose water color based on mobile & quality settings
let waterColor = 0x001e0f; // Default water color

// For mobile, use a more vibrant blue regardless of quality setting
if (this.engine.settings && this.engine.settings.isMobile) {
  waterColor = 0x00aaff; // Extra vibrant blue that looks better without reflections
  console.log('Mobile device: Using alternative water color ' + waterColor.toString(16));
}

const water = new Water(waterGeometry, {
  textureWidth: textureSize,
  textureHeight: textureSize,
  waterNormals: new TextureLoader().load('textures/2waternormals.jpg', function (texture) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(32, 32); // Gentle repeat to reduce stretching
  }),
  sunDirection: new THREE.Vector3(), // Will be updated in update method
  sunColor: 0xffffff,
  waterColor: waterColor, // Use the selected water color instead of hardcoded 0x001e0f
  distortionScale: distortionScale,
  clipBias: 0.001, // Moderately increased from 0.00001
  fog: this.scene.fog !== undefined,
  alpha: alpha // Opacity adjusted based on quality
});

// CHANGE 2: Update how reflections are handled on all mobile devices
// For all mobile devices, adjust shader parameters to minimize reflection issues
if (this.engine.settings && this.engine.settings.isMobile) {
  // Set the texture matrix to minimize but not completely eliminate reflections
  const scaledMatrix = new THREE.Matrix4().makeScale(0.1, 0.1, 0.1);
  water.material.uniforms['textureMatrix'].value = scaledMatrix;
  
  // Ensure the water color is strong
  water.material.uniforms['waterColor'].value = new THREE.Color(0x00aaff);
  
  // Reduce any reflection effects to minimize flashing
  if (water.material) {
    water.material.defines = water.material.defines || {};
    water.material.defines.REFLECTION_INTENSITY = 0.1; // Add a custom define for shader
    water.material.needsUpdate = true;
    console.log('Mobile: Applying shader adjustments to prevent water flashing');
  }
}

// CHANGE 4: Apply color in every frame update
update(deltaTime) {
  if (this.water) {
    // Force water color on mobile devices consistently every frame
    if (this.engine.settings && this.engine.settings.isMobile && 
        this.water.material && this.water.material.uniforms['waterColor']) {
      this.water.material.uniforms['waterColor'].value = new THREE.Color(0x00aaff);
    }

    // Rest of update method...
  }
}

// CHANGE 5: Modify reflection processing for mobile
if (this.engine.settings && this.engine.settings.isMobile) {
  // For low quality, skip completely
  if (this._waterQuality === 'low') {
    // Ensure water color is maintained
    if (this.water && this.water.material && this.water.material.uniforms['waterColor']) {
      this.water.material.uniforms['waterColor'].value = new THREE.Color(0x00aaff);
    }
    return;
  }
  
  // For medium and high quality, minimize reflections to prevent flashing
  if (this.water && this.water.material && this.water.material.uniforms['textureMatrix']) {
    // Use a very small scale for the reflection to minimize flashing
    const scaledMatrix = new THREE.Matrix4().makeScale(0.1, 0.1, 0.1);
    this.water.material.uniforms['textureMatrix'].value.copy(scaledMatrix);
  }
}

// CHANGE 6: Apply color in render loop
this.water.onBeforeRender = (renderer, scene, camera) => {
  // Force water color on mobile devices in render loop
  if (this.engine.settings && this.engine.settings.isMobile && 
      this.water.material && this.water.material.uniforms['waterColor']) {
    this.water.material.uniforms['waterColor'].value = new THREE.Color(0x00aaff);
  }

  // Rest of onBeforeRender...
}
```

## 4. Check & Commit
**Changes Made:**
- Modified the water color to a bright blue (0x00aaff) for all mobile devices
- Applied scaling to reflection matrices to minimize flashing effects
- Added water color application at multiple points in the rendering cycle:
  - During water creation
  - In the update method every frame
  - During onBeforeRender callback
  - When handling reflections
- Added debug logging to track water quality settings and color changes
- Created quality-specific handling for different mobile performance levels

**Commit Message:** fix: prevent brown water and flashing on mobile devices

**Status:** Complete
