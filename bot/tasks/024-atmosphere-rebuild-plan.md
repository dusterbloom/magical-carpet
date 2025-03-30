# AtmosphereSystem Rebuild Plan

## 1. Task & Context
**Task:** Review the current status of AtmosphereSystem.js and map how to rebuild it from scratch
**Scope:** src/game/systems/AtmosphereSystem.js
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Analyze current implementation, document core components, and outline a clean rebuild approach focused on sun, moon, stars, sky, and day/night cycle (no birds).
**Complexity:** 2-Moderate
**Uncertainty:** 1-Low
**Unknowns:** None identified
**Human Input Needed:** No

## 3. Implementation

### Current System Analysis

The current AtmosphereSystem has the following components:

1. **Sky System**
   - Uses ThreeJS Sky object for sky rendering
   - Configures sky parameters (turbidity, rayleigh, etc.)
   - Creates scene fog

2. **Sun System**
   - Creates directional sunlight for scene illumination
   - Includes physical sun sphere with multi-layered glow effects
   - Updates position based on time of day
   - Adjusts light color based on time of day (sunrise/sunset effects)

3. **Moon System**
   - Creates physical moon with texture
   - Adds moonlight for night illumination
   - Updates position based on time of day (opposite to sun)

4. **Stars System**
   - Uses external StarsParticleSystem class
   - Creates regular stars across the sky (4500 stars)
   - Creates horizon stars (2000 stars) concentrated near horizon
   - Updates visibility based on time of day
   - Uses THREE.Points with custom materials

5. **Cloud System**
   - Creates volumetric clouds using sprite materials
   - Updates cloud positions relative to player

6. **Time System**
   - Tracks elapsed time and day/night cycle
   - Manages time of day (0.0-1.0 representing full day)
   - Updates sky colors based on time of day
   - Calculates day/night transitions

7. **Bird System** (to be removed in rebuild)
   - Creates bird models and flocks
   - Updates bird positions and animations

### Rebuild Plan

#### Core Architecture

```javascript
export class AtmosphereSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    
    // Time tracking
    this.elapsed = 0;
    this.dayDuration = 10; // Minutes per day cycle
    this.timeOfDay = 0.5; // Start at noon
    
    // System components
    this.skySystem = null;
    this.sunSystem = null;
    this.moonSystem = null;
    this.starSystem = null;
    this.cloudSystem = null;
  }
  
  async initialize() {
    // Create subsystems
    this.skySystem = new SkySystem(this);
    this.sunSystem = new SunSystem(this);
    this.moonSystem = new MoonSystem(this);
    this.starSystem = new StarSystem(this);
    this.cloudSystem = new CloudSystem(this);
    
    // Initialize subsystems
    await this.skySystem.initialize();
    await this.sunSystem.initialize();
    await this.moonSystem.initialize();
    await this.starSystem.initialize();
    await this.cloudSystem.initialize();
  }
  
  update(delta, elapsed) {
    // Update elapsed time
    this.elapsed = elapsed;
    
    // Update time of day
    this.timeOfDay += delta / this.dayDuration;
    if (this.timeOfDay >= 1.0) this.timeOfDay -= 1.0;
    
    // Update subsystems
    this.skySystem.update(delta);
    this.sunSystem.update(delta);
    this.moonSystem.update(delta);
    this.starSystem.update(delta);
    this.cloudSystem.update(delta);
  }
  
  // Helper methods
  getNightFactor() {
    // Calculate night time factor (0-1)
    if (this.timeOfDay > 0.75 || this.timeOfDay < 0.25) {
      if (this.timeOfDay > 0.75) {
        return (this.timeOfDay - 0.75) / 0.25;
      } else {
        return 1.0 - this.timeOfDay / 0.25;
      }
    }
    return 0;
  }
}
```

#### Subsystem Components

1. **SkySystem**
```javascript
class SkySystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.sky = null;
  }
  
  async initialize() {
    // Create ThreeJS Sky
    this.sky = new Sky();
    this.sky.scale.setScalar(30000);
    this.scene.add(this.sky);
    
    // Configure sky parameters
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 8;
    uniforms['rayleigh'].value = 1;
    uniforms['mieCoefficient'].value = 0.025;
    uniforms['mieDirectionalG'].value = 0.999;
    
    // Set up scene fog
    this.scene.fog = new THREE.FogExp2(0x88ccff, 0.00003);
  }
  
  update(delta) {
    // Update sky colors based on time of day
    this.updateSkyColors();
    
    // Make sure sky follows camera
    const camera = this.atmosphereSystem.engine.camera;
    if (this.sky && camera) {
      this.sky.position.copy(camera.position);
    }
  }
  
  updateSkyColors() {
    const timeOfDay = this.atmosphereSystem.timeOfDay;
    let topColor, bottomColor, fogColor;
    
    // Calculate colors based on time of day
    // (Time-based color transitions)
    
    // Update fog color
    if (this.scene.fog) {
      this.scene.fog.color = fogColor;
    }
  }
}
```

2. **SunSystem**
```javascript
class SunSystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.sunLight = null;
    this.sunSphere = null;
    this.sunGlow = null;
    this.sunOuterGlow = null;
  }
  
  async initialize() {
    // Create directional sunlight
    this.createSunLight();
    
    // Create visible sun sphere with glow effects
    this.createSunSphere();
  }
  
  createSunLight() {
    // Create directional light for sun illumination
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(0, 1000, 0);
    this.sunLight.castShadow = true;
    
    // Configure shadow properties
    this.configureShadows();
    
    // Add ambient light
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.7);
    
    this.scene.add(this.sunLight);
    this.scene.add(this.ambientLight);
  }
  
  createSunSphere() {
    // Create sun sphere with multi-layered glow effects
    const sunGeometry = new THREE.SphereGeometry(200, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff80,
      transparent: false,
      fog: false
    });
    
    this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    this.scene.add(this.sunSphere);
    
    // Add glow layers
    this.addSunGlowLayers();
  }
  
  update(delta) {
    const timeOfDay = this.atmosphereSystem.timeOfDay;
    
    // Calculate sun position based on time of day
    const sunAngle = timeOfDay * Math.PI * 2;
    const radius = 10000;
    const height = 5000;
    
    this.sunSphere.position.set(
      Math.cos(sunAngle) * radius,
      Math.sin(sunAngle) * height,
      Math.sin(sunAngle * 0.5) * radius
    );
    
    // Update sun visibility (visible during day only)
    this.sunSphere.visible = timeOfDay > 0.25 && timeOfDay < 0.75;
    
    // Update glow effects visibility
    this.updateGlowEffects();
    
    // Update sunlight position and color
    this.updateSunLight();
  }
}
```

3. **MoonSystem**
```javascript
class MoonSystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.moonMesh = null;
    this.moonLight = null;
  }
  
  async initialize() {
    // Load moon texture
    const textureLoader = new THREE.TextureLoader();
    const moonTexture = textureLoader.load("/assets/textures/moon.jpg");
    
    // Create moon mesh
    const moonGeometry = new THREE.SphereGeometry(300, 32, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({
      map: moonTexture,
      fog: false,
      side: THREE.FrontSide
    });
    
    this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    this.moonMesh.renderOrder = 100;
    this.scene.add(this.moonMesh);
    
    // Add moonlight
    this.moonLight = new THREE.DirectionalLight(0xdedeff, 0.2);
    this.moonLight.position.set(0, 1, 0);
    this.moonMesh.add(this.moonLight);
  }
  
  update(delta) {
    const timeOfDay = this.atmosphereSystem.timeOfDay;
    const nightFactor = this.atmosphereSystem.getNightFactor();
    
    // Calculate moon position (opposite to sun)
    const moonAngle = ((timeOfDay + 0.5) % 1.0) * Math.PI * 2;
    
    this.moonMesh.position.set(
      6000 * Math.cos(moonAngle),
      3000 * Math.sin(moonAngle),
      6000 * Math.sin(moonAngle * 0.5)
    );
    
    // Update moon visibility based on night factor
    this.moonMesh.visible = nightFactor > 0.05;
    
    // Make moon face camera
    const camera = this.atmosphereSystem.engine.camera;
    if (camera) {
      this.moonMesh.lookAt(camera.position);
    }
    
    // Update moonlight intensity
    if (this.moonLight) {
      this.moonLight.intensity = 0.2 * nightFactor;
    }
  }
}
```

4. **StarSystem**
```javascript
class StarSystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.camera = atmosphereSystem.engine.camera;
    this.starField = null;
    this.horizonStarField = null;
  }
  
  async initialize() {
    // Create regular stars across the sky
    this.createRegularStars();
    
    // Create horizon stars
    this.createHorizonStars();
  }
  
  createRegularStars() {
    // Create point geometry for stars
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const sizes = [];
    const colors = [];
    
    // Generate star positions, sizes, and colors
    this.generateStarAttributes(positions, sizes, colors, 4500, true);
    
    // Set buffer attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Create star material
    const starsMaterial = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false
    });
    
    // Create star field
    this.starField = new THREE.Points(geometry, starsMaterial);
    this.scene.add(this.starField);
  }
  
  createHorizonStars() {
    // Similar to regular stars but concentrated near horizon
    // (Implementation details similar to regular stars)
  }
  
  update() {
    const nightFactor = this.atmosphereSystem.getNightFactor();
    
    // Update stars visibility based on night factor
    this.updateStarsVisibility(nightFactor);
    
    // Make stars follow camera
    if (this.camera) {
      if (this.starField) {
        this.starField.position.copy(this.camera.position);
      }
      
      if (this.horizonStarField) {
        this.horizonStarField.position.copy(this.camera.position);
      }
    }
  }
  
  updateStarsVisibility(nightFactor) {
    // Update star fields visibility and opacity based on night factor
    // (Implementation details)
  }
}
```

5. **CloudSystem**
```javascript
class CloudSystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.clouds = [];
    this.cloudCount = 100;
    this.cloudSpread = 2000;
  }
  
  async initialize() {
    // Create cloud sprites
    this.createVolumetricClouds();
  }
  
  createVolumetricClouds() {
    // Create cloud sprites with materials
    // (Implementation details)
  }
  
  update(delta) {
    // Update cloud positions and animations
    this.updateVolumetricClouds(delta);
  }
  
  updateVolumetricClouds(delta) {
    // Update each cloud's position and rotation
    // Handle respawning clouds when they get too far from player
    // (Implementation details)
  }
}
```

## 4. Check & Commit
**Changes Made:**
- Analyzed current AtmosphereSystem.js implementation
- Identified core components: Sky, Sun, Moon, Stars, Clouds
- Documented current functionality and structure
- Outlined a modular, component-based rebuild approach
- Created detailed implementation plans for each subsystem
- Removed birds from the rebuild plan as requested

**Commit Message:** [PLAN] Atmosphere System rebuild mapping

**Status:** Complete
