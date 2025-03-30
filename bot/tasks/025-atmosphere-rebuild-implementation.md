# AtmosphereSystem Rebuild Implementation

## 1. Task & Context
**Task:** Implement the rebuilt AtmosphereSystem from scratch based on the plan in task #24
**Scope:** src/game/systems/AtmosphereSystem.js and related files
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Create a modular, component-based implementation with separate subsystems for sky, sun, moon, stars, and clouds
**Complexity:** 3-Complex
**Uncertainty:** 1-Low
**Unknowns:** None
**Human Input Needed:** No

## 3. Implementation

Let's first create the new StarsSystem.js file since it will be imported by AtmosphereSystem:

```javascript
// New implementation to replace StarsParticleSystem.js
import * as THREE from "three";

export class StarSystem {
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
    
    return this;
  }
  
  createRegularStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const sizes = [];
    const colors = [];
    
    // Create 4500 regular stars in the upper hemisphere
    for (let i = 0; i < 4500; i++) {
      // Random angles
      const theta = Math.random() * Math.PI * 2;
      // Use full hemisphere range to distribute stars from zenith to horizon
      const phi = Math.random() * Math.PI * 0.5; // Full hemisphere (0 to 90 degrees)
      
      // Convert to Cartesian coordinates on a sphere
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi); // This will always be positive due to phi range
      const z = Math.sin(phi) * Math.sin(theta);
      
      // Scale to place stars far away
      const scale = 6000;
      positions.push(x * scale, y * scale, z * scale);
      
      // Vary the star sizes slightly
      sizes.push(2 + Math.random() * 2);
      
      // Add slight color variation
      const starType = Math.random();
      if (starType > 0.9) {
        // Blue-white stars
        colors.push(0.8, 0.9, 1.0);
      } else if (starType > 0.8) {
        // Yellow stars
        colors.push(1.0, 0.9, 0.7);
      } else if (starType > 0.7) {
        // Reddish stars
        colors.push(1.0, 0.8, 0.8);
      } else {
        // White stars (majority)
        colors.push(1.0, 1.0, 1.0);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false
    });
    
    this.starField = new THREE.Points(geometry, starsMaterial);
    this.scene.add(this.starField);
  }
  
  createHorizonStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    
    // Create 2000 stars concentrated near the horizon
    for (let i = 0; i < 2000; i++) {
      // Random angles around the full circle
      const theta = Math.random() * Math.PI * 2;
      
      // Phi angle concentrated near the horizon
      // Biased distribution to place more stars near horizon (phi close to PI/2)
      const phi = Math.PI * (0.45 + Math.random() * 0.08); // Range ~81-95 degrees
      
      // Convert to Cartesian coordinates on a sphere
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi); // Near-zero values for horizon
      const z = Math.sin(phi) * Math.sin(theta);
      
      // Place stars at varying distances
      const distance = 5500 + Math.random() * 500; // Slightly varied distances
      positions.push(x * distance, y * distance, z * distance);
      
      // Vary sizes - smaller on average to give depth perception
      sizes.push(1 + Math.random() * 2);
      
      // Use mostly white/blue colors for horizon stars
      if (Math.random() > 0.7) {
        // Light blue tint
        colors.push(0.8, 0.9, 1.0);
      } else {
        // White
        colors.push(1.0, 1.0, 1.0);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 2, // Slightly smaller for horizon stars
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false
    });
    
    this.horizonStarField = new THREE.Points(geometry, starsMaterial);
    this.scene.add(this.horizonStarField);
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
    const starField = this.starField;
    const horizonStarField = this.horizonStarField;
    const elapsed = this.atmosphereSystem.elapsed;

    // Compute a flicker effect
    const flickerRegular = 0.05 * Math.sin(elapsed * 10);
    const flickerHorizon = 0.05 * Math.sin(elapsed * 10 + Math.PI / 2);

    if (starField) {
      starField.visible = nightFactor > 0.1; // Visible only when dark enough
      if (starField.material) {
        const baseOpacity = 0.5 + nightFactor * 0.5;
        starField.material.opacity = baseOpacity + flickerRegular;
      }
    }

    if (horizonStarField) {
      horizonStarField.visible = nightFactor > 0.08;
      if (horizonStarField.material) {
        const baseOpacity = Math.min(1.0, 0.6 + nightFactor * 0.4);
        horizonStarField.material.opacity = baseOpacity + flickerHorizon;
      }
    }
  }
}
```

Now let's implement the SkySystem:

```javascript
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

export class SkySystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.engine = atmosphereSystem.engine;
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
    
    // Set tone mapping exposure
    this.engine.renderer.toneMappingExposure = 0.6;
    
    // Set up scene fog
    this.scene.fog = new THREE.FogExp2(0x88ccff, 0.00003);
    
    return this;
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
    
    // Update sky colors based on time of day
    let topColor, bottomColor, fogColor;

    if (timeOfDay < 0.25) {
      // Night to sunrise transition
      const t = timeOfDay / 0.25;
      topColor = new THREE.Color(0x000005);
      bottomColor = new THREE.Color(0x000010);
      fogColor = new THREE.Color(0x000010);
    } else if (timeOfDay < 0.5) {
      // Sunrise to noon
      const t = (timeOfDay - 0.25) / 0.25;
      topColor = new THREE.Color(0x0077ff);
      bottomColor = new THREE.Color(0xff9933).lerp(
        new THREE.Color(0x89cff0),
        t
      );
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x89cff0), t);
    } else if (timeOfDay < 0.75) {
      // Noon to sunset
      const t = (timeOfDay - 0.5) / 0.25;
      topColor = new THREE.Color(0x0077ff);
      bottomColor = new THREE.Color(0x89cff0).lerp(
        new THREE.Color(0xff9933),
        t
      );
      fogColor = new THREE.Color(0x89cff0).lerp(new THREE.Color(0xff9933), t);
    } else {
      // Sunset to night
      const t = (timeOfDay - 0.75) / 0.25;
      topColor = new THREE.Color(0x0077ff).lerp(new THREE.Color(0x000022), t);
      bottomColor = new THREE.Color(0xff9933).lerp(
        new THREE.Color(0x000022),
        t
      );
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x000022), t);
    }

    // Update fog
    if (this.scene.fog) {
      this.scene.fog.color = fogColor;
    }
  }
}
```

Let's implement the SunSystem:

```javascript
import * as THREE from "three";

export class SunSystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.sunLight = null;
    this.ambientLight = null;
    this.sunSphere = null;
    this.sunGlow = null;
    this.sunOuterGlow = null;
  }
  
  async initialize() {
    // Create directional sunlight
    this.createSunLight();
    
    // Create visible sun sphere with glow effects
    this.createSunSphere();
    
    return this;
  }
  
  createSunLight() {
    // Create a directional sunlight for the scene
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(0, 1000, 0);
    this.sunLight.castShadow = true;

    // Configure shadow properties
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 100;
    this.sunLight.shadow.camera.far = 5000;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.sunLight.shadow.bias = -0.0005;

    // Add a subtle ambient light
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.7);

    this.scene.add(this.sunLight);
    this.scene.add(this.ambientLight);
  }
  
  createSunSphere() {
    // Create a larger, more realistic sun sphere with proper materials
    const sunGeometry = new THREE.SphereGeometry(200, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff80,
      transparent: false,
      fog: false
    });
    
    this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunSphere.renderOrder = 10000; // Render after sky
    this.scene.add(this.sunSphere);
    
    // Add multi-layered glow effect for more realistic appearance
    const sunGlowGeometry = new THREE.SphereGeometry(320, 32, 32);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3,
      fog: false
    });
    
    this.sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    this.sunSphere.add(this.sunGlow);
    
    // Add a second, larger glow layer
    const sunOuterGlowGeometry = new THREE.SphereGeometry(500, 32, 32);
    const sunOuterGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff80,
      transparent: true,
      opacity: 0.15,
      fog: false
    });
    
    this.sunOuterGlow = new THREE.Mesh(sunOuterGlowGeometry, sunOuterGlowMaterial);
    this.sunSphere.add(this.sunOuterGlow);
  }
  
  update(delta) {
    const timeOfDay = this.atmosphereSystem.timeOfDay;
    
    // Calculate sun angle (0 to 2π) based on time of day
    const sunAngle = timeOfDay * Math.PI * 2;
    
    // Use larger radius for more realistic distant sun appearance
    const radius = 10000; // Increased radius for distant sun appearance
    const height = 5000;  // Increased height for more realistic arc
    
    this.sunSphere.position.set(
      Math.cos(sunAngle) * radius,
      Math.sin(sunAngle) * height,
      Math.sin(sunAngle * 0.5) * radius // Add slight variation to z-axis movement
    );

    // Update sun visibility based on time of day
    this.sunSphere.visible = timeOfDay > 0.25 && timeOfDay < 0.75;
    
    // Update glow effects visibility
    if (this.sunGlow) {
      this.sunGlow.visible = this.sunSphere.visible;
    }
    
    if (this.sunOuterGlow) {
      this.sunOuterGlow.visible = this.sunSphere.visible;
    }

    // Update the actual sunlight direction to match visual sun
    if (this.sunLight) {
      this.sunLight.position.copy(this.sunSphere.position);
      
      // Adjust sunlight color based on time of day
      if (timeOfDay > 0.25 && timeOfDay < 0.35) {
        // Sunrise - more orange
        this.sunLight.color.setHex(0xffaa33);
      } else if (timeOfDay > 0.65 && timeOfDay < 0.75) {
        // Sunset - more orange/red
        this.sunLight.color.setHex(0xff7733);
      } else {
        // Day - yellow/white
        this.sunLight.color.setHex(0xffffcc);
      }
      
      // Adjust light intensity based on time of day
      if (timeOfDay < 0.25) {
        // Night
        this.sunLight.intensity = 0.1;
      } else if (timeOfDay < 0.3 || timeOfDay > 0.7) {
        // Dawn/Dusk
        const t = timeOfDay < 0.3 
          ? (timeOfDay - 0.25) / 0.05 
          : 1 - (timeOfDay - 0.7) / 0.05;
        this.sunLight.intensity = 0.1 + t * 0.9;
      } else {
        // Day
        this.sunLight.intensity = 1.0;
      }
    }
  }
}
```

Now let's implement the MoonSystem:

```javascript
import * as THREE from "three";

export class MoonSystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.moonMesh = null;
    this.moonLight = null;
  }
  
  async initialize() {
    const textureLoader = new THREE.TextureLoader();

    // Load the moon texture
    const moonTexture = textureLoader.load("/assets/textures/moon.jpg");

    // Create a moon: a properly lit sphere with the moon texture
    const moonGeometry = new THREE.SphereGeometry(300, 32, 32);

    // SIMPLIFIED MATERIAL FOR MAXIMUM VISIBILITY
    const moonMaterial = new THREE.MeshBasicMaterial({
      map: moonTexture,
      fog: false, // Disable fog effects on the moon
      side: THREE.FrontSide, // Only render front faces
    });

    this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    this.moonMesh.renderOrder = 100; // Render moon after most other objects
    this.scene.add(this.moonMesh);

    // Add a moonlight to illuminate the scene when the moon is visible
    this.moonLight = new THREE.DirectionalLight(0xdedeff, 0.2);
    this.moonLight.position.set(0, 1, 0);
    this.moonMesh.add(this.moonLight);
    
    return this;
  }
  
  update(delta) {
    const timeOfDay = this.atmosphereSystem.timeOfDay;
    const nightFactor = this.atmosphereSystem.getNightFactor();
    
    // Calculate moon angle (opposite to sun)
    const moonAngle = ((timeOfDay + 0.5) % 1.0) * Math.PI * 2; // Offset by 0.5 to be opposite the sun

    // Position moon in the sky opposite to the sun
    this.moonMesh.position.set(
      6000 * Math.cos(moonAngle),
      3000 * Math.sin(moonAngle),
      6000 * Math.sin(moonAngle * 0.5)
    );

    // Use the night factor to decide visibility
    this.moonMesh.visible = nightFactor > 0.05;

    // Always face camera
    const camera = this.atmosphereSystem.engine.camera;
    if (camera) {
      this.moonMesh.lookAt(camera.position);
    }

    // Adjust moonlight intensity
    if (this.moonLight) {
      this.moonLight.intensity = 0.2 * nightFactor;
    }
  }
}
```

Let's implement the CloudSystem:

```javascript
import * as THREE from "three";

export class CloudSystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.engine = atmosphereSystem.engine;
    this.clouds = [];
    this.cloudCount = 100;
    this.cloudSpread = 2000; // How far clouds spread from player
    this.cloudHeight = 200; // Height of cloud layer
  }
  
  async initialize() {
    this.createVolumetricClouds();
    return this;
  }
  
  createCloudSpriteMaterial() {
    // Use a simple white texture as fallback since particles.png isn't found
    const textureLoader = new THREE.TextureLoader();
    // Try different potential paths
    const cloudTexture = textureLoader.load('/assets/textures/particles.png', 
      undefined, 
      undefined, 
      (err) => {
        console.log('Error loading texture, using blank texture');
        // Create a simple white texture as fallback
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
      }
    );
    
    // Use a simple SpriteMaterial for now 
    return new THREE.SpriteMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.7,
      color: 0xffffff
    });
  }
  
  createVolumetricClouds() {
    console.log('Creating procedural clouds...');
    this.clouds = [];
    
    for (let i = 0; i < this.cloudCount; i++) {
      const cloudMaterial = this.createCloudSpriteMaterial();
      const cloud = new THREE.Sprite(cloudMaterial);

      // Add specific layer for water reflections
      cloud.layers.enable(2); // Water reflections layer
      
      // Make clouds MUCH larger for visibility
      const scale = 800 + Math.random() * 600;
      cloud.scale.set(scale, scale, 1);
      
      // Position clouds in the sky
      const player = this.engine.systems.player?.localPlayer;
      const playerPos = player ? player.position : new THREE.Vector3(0, 0, 0);
      const radius = 1000 + Math.random() * 3000; // Varied distance
      const theta = Math.random() * Math.PI * 2;
      
      cloud.position.set(
        playerPos.x + radius * Math.cos(theta),
        400 + Math.random() * 400,  // Height between 400-800
        playerPos.z + radius * Math.sin(theta)
      );
      
      cloud.userData = {
        rotationSpeed: 0,
        horizontalSpeed: (Math.random() - 0.5) * 10,
        verticalFactor: Math.random() * 5,
        timeOffset: Math.random() * 1000
      };
      
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
    console.log(`Created ${this.cloudCount} clouds`);
  }
  
  update(delta) {
    this.updateVolumetricClouds(delta);
  }
  
  updateVolumetricClouds(delta) {
    if (!this.clouds || this.clouds.length === 0) return;

    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    const time = this.atmosphereSystem.elapsed;

    // Update each cloud
    this.clouds.forEach((cloud) => {
      // Update cloud position
      cloud.position.x += cloud.userData.horizontalSpeed * delta;
      cloud.position.z += cloud.userData.horizontalSpeed * 0.5 * delta;

      // Add slight vertical bobbing
      cloud.position.y +=
        Math.sin(time * 0.001 + cloud.userData.timeOffset) *
        cloud.userData.verticalFactor *
        delta;

      // Check if cloud is too far from player
      const distX = cloud.position.x - player.position.x;
      const distZ = cloud.position.z - player.position.z;
      const distSq = distX * distX + distZ * distZ;

      // If cloud is too far, move it to the other side of the play area
      if (distSq > 9000000) { // 3000^2
        const angle = Math.random() * Math.PI * 2;
        const radius = 2000 + Math.random() * 500;

        cloud.position.x = player.position.x + radius * Math.cos(angle);
        cloud.position.z = player.position.z + radius * Math.sin(angle);
      }
    });
  }
}
```

Finally, let's implement the main AtmosphereSystem class that coordinates all subsystems:

```javascript
import * as THREE from "three";
import { SkySystem } from "./SkySystem";
import { SunSystem } from "./SunSystem";
import { MoonSystem } from "./MoonSystem";
import { StarSystem } from "./StarSystem";
import { CloudSystem } from "./CloudSystem";

export class AtmosphereSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.worldSystem = engine.systems.world;

    // Initialize subsystems
    this.skySystem = null;
    this.sunSystem = null;
    this.moonSystem = null;
    this.starSystem = null;
    this.cloudSystem = null;

    // Time tracking
    this.elapsed = 0;
    this.dayDuration = 10; // 10 minutes per day cycle

    // Sync to current time
    const now = new Date();
    const secondsInDay = 86400;
    const currentSeconds =
      now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    this.timeOfDay = currentSeconds / secondsInDay; // sync to user time
    
    // For testing, can force a specific time of day
    // this.timeOfDay = 0.5; // noon
    // this.timeOfDay = 0.0; // midnight
    // this.timeOfDay = 0.25; // sunrise
    // this.timeOfDay = 0.75; // sunset
    
    console.log("Synced Time of Day:", this.timeOfDay);
  }

  async initialize() {
    console.log("Initializing AtmosphereSystem...");

    // Create and initialize subsystems
    this.skySystem = await new SkySystem(this).initialize();
    this.sunSystem = await new SunSystem(this).initialize();
    this.moonSystem = await new MoonSystem(this).initialize();
    this.starSystem = await new StarSystem(this).initialize();
    this.cloudSystem = await new CloudSystem(this).initialize();

    console.log("AtmosphereSystem initialized");
  }

  // Calculate how much of night time we're in (0 = day, 1 = night)
  getNightFactor() {
    // Night is roughly between 0.75-0.25 timeOfDay (sunset to sunrise)
    if (this.timeOfDay > 0.75 || this.timeOfDay < 0.25) {
      // Calculate how deep into night we are
      if (this.timeOfDay > 0.75) {
        // After sunset, approaching midnight
        return (this.timeOfDay - 0.75) / 0.25;
      } else {
        // After midnight, approaching sunrise
        return 1.0 - this.timeOfDay / 0.25;
      }
    }
    return 0; // Daytime
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
}
```

## 4. Check & Commit
**Changes Made:**
- Implemented modular, component-based AtmosphereSystem
- Created separate subsystem classes:
  - SkySystem - Handles sky rendering and fog
  - SunSystem - Manages sun sphere, glow effects, and lighting
  - MoonSystem - Handles moon positioning and lighting
  - StarSystem - Creates and manages star fields
  - CloudSystem - Manages cloud generation and movement
- Maintained existing functionality while removing birds
- Improved code organization and maintainability
- Used class-based architecture for better encapsulation

**Commit Message:** [IMPL] Rebuild AtmosphereSystem with modular architecture

**Status:** Complete
