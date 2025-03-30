# Task 023: Update Sun Appearance and Movement

## 1. Task & Context
**Task:** Update the sun's appearance and movement to match real-world characteristics
**Scope:** src/game/systems/AtmosphereSystem.js - createSunSphere() and update()
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Replace cube sun with a circular sphere using the same approach as the moon
**Complexity:** 1-Simple
**Uncertainty:** 1-Low
**Unknowns:** None - using proven approach from moon implementation
**Human Input Needed:** No

## 3. Implementation
I'll modify the `createSunSphere()` method to follow the same pattern as the moon implementation, and update the positioning logic accordingly.

```javascript
// Changes to createSunSphere() method:
createSunSphere() {
  const textureLoader = new THREE.TextureLoader();

  // Create a sun sphere with simple texture
  const sunGeometry = new THREE.SphereGeometry(300, 32, 32);

  // SIMPLIFIED MATERIAL FOR MAXIMUM VISIBILITY - similar to moon
  const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff80,
    fog: false, // Disable fog effects on the sun
    side: THREE.FrontSide, // Only render front faces
  });

  this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
  this.sunSphere.renderOrder = 100; // Render sun after most other objects
  this.scene.add(this.sunSphere);
}

// Update to the sun position calculation in update() method:
if (this.sunSphere) {
  // Calculate sun angle (0 to 2π) based on time of day
  const sunAngle = this.timeOfDay * Math.PI * 2;
  
  // Position sun in the sky opposite to the moon
  this.sunSphere.position.set(
    6000 * Math.cos(sunAngle),
    3000 * Math.sin(sunAngle),
    6000 * Math.sin(sunAngle * 0.5)
  );

  // Update sun visibility based on time of day
  this.sunSphere.visible = this.timeOfDay > 0.25 && this.timeOfDay < 0.75;

  // Always face camera
  if (this.engine.camera) {
    const cameraPosition = this.engine.camera.position.clone();
    this.sunSphere.lookAt(cameraPosition);
  }

  // Update the actual sunlight direction to match visual sun
  if (this.sunLight) {
    this.sunLight.position.copy(this.sunSphere.position);
  }
}
```

## 4. Check & Commit
**Changes Made:**
- Replaced cube sun with a larger spherical sun (300 units, same as moon)
- Used simplified material approach matching the moon implementation
- Added camera-facing behavior so sun always appears as a proper circle
- Used consistent positioning parameters with the moon (6000 unit radius)
- Made sun visible only during daytime hours

**Commit Message:** Fix sun appearance and movement to match real-world characteristics

**Status:** Complete
