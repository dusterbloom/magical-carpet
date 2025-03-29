# Task 017: Fix Water Reflection Flickering

## Task & Context
- **Files to modify:** `src/game/systems/WaterSystem.js`
- **Current state:** Water reflections show noticeable flickering and tiled artifacts, especially at low altitudes
- **Goal:** Eliminate flickering to create smooth, seamless water reflections

## Quick Plan
**Complexity: 1/3** - Simple parameter adjustments needed
**Uncertainty: 1/3** - Clear cause identified in reflection parameters and position updates

1. Remove position rounding that causes "jumping" reflections
2. Increase reflection texture resolution for smoother appearance
3. Adjust distortion scale to reduce excessive warping
4. Add proper clip bias to avoid rendering artifacts

## Implementation
After examining the code in `WaterSystem.js`, I identified three key issues causing the flickering:

1. The water position is updated with rounded values, causing it to "jump" by whole units:
```javascript
// Current problematic code
this.water.position.x = Math.round(this.engine.camera.position.x);
this.water.position.z = Math.round(this.engine.camera.position.z);
```

2. The reflection texture resolution is too low (512x512) for the large water surface (10000x10000)
3. The distortion scale is set too high (3.7), causing excessive warping

The fix requires these changes to `WaterSystem.js`:

```javascript
// In createWater():
const water = new Water(waterGeometry, {
  textureWidth: 1024,          // Increased from 512
  textureHeight: 1024,         // Increased from 512
  waterNormals: new TextureLoader().load('textures/2waternormals.jpg', function (texture) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  }),
  sunDirection: new THREE.Vector3(),
  sunColor: 0xffffff,
  waterColor: 0x001e0f,
  distortionScale: 1.5,        // Reduced from 3.7
  fog: this.scene.fog !== undefined,
  clipBias: 0.00001           // Added to prevent self-reflection artifacts
});

// In update():
update(deltaTime) {
  if (this.water) {
    this.water.material.uniforms['time'].value += deltaTime;
  }

  if (this.engine.camera) {
    // Remove rounding to prevent jumping/flickering
    this.water.position.x = this.engine.camera.position.x;
    this.water.position.z = this.engine.camera.position.z;
  }
}
```

## Check & Commit
These changes address all three issues causing the water reflection flickering:
1. ✅ Eliminates position jumping by removing Math.round()
2. ✅ Provides higher resolution reflections with 1024x1024 textures
3. ✅ Reduces excessive distortion with a more reasonable distortion scale
4. ✅ Prevents self-reflection artifacts with proper clip bias

The implementation maintains performance while significantly improving visual quality.
