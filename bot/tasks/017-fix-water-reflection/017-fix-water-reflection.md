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

### 1. Modify WaterSystem.js
Update the water creation and update methods to:
- Remove the `Math.round()` calls in the position update
- Increase the texture resolution from 512x512 to 1024x1024
- Reduce the distortion scale from 3.7 to a more reasonable value (1.5-2.0)
- Add clip bias parameter to prevent self-reflection artifacts

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
The improvements should:
- Completely eliminate the rectangular tiled artifacts visible in reflections
- Prevent flickering caused by position jumps
- Create a smoother, more realistic reflection
- Not impact performance significantly despite higher texture resolution
