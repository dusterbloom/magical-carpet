import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { StarsParticleSystem } from "./StarsParticleSystem";

export class AtmosphereSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.worldSystem = engine.systems.world;

    // Initialize components
    this.starSystem = null; // Will be initialized in initialize()
    this.sky = null; // ThreeJS Sky object

    // Clouds
    this.clouds = [];
    this.cloudCount = 100;
    this.cloudSpread = 2000; // How far clouds spread from player
    this.cloudHeight = 200; // Height of cloud layer

    // Birds
    this.birds = [];
    this.birdCount = 30;
    this.birdFlocks = [];

    // Time tracking
    this.elapsed = 0;

    // Day/night cycle
    this.dayDuration = 86400 / 60; // 10 minutes per day cycle

    // DEBUGGING: Force to night time
    // Keep this forced value for testing night sky stars
    const now = new Date();
    const secondsInDay = 86400;
    const currentSeconds =
      now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    // this.timeOfDay = currentSeconds / secondsInDay; // sync to user time
    this.timeOfDay = 40000 / 86400; // afternoon
    console.log("Synced Time of Day:", this.timeOfDay);

    this.sunPosition = new THREE.Vector3();
    this.sunLight = null;
  }

  async initialize() {
    console.log("Initializing AtmosphereSystem...");

    // Create sunlight
    this.createSunLight();

    // Create and initialize star system
    console.log("AtmosphereSystem: Creating star field...");
    this.starSystem = new StarsParticleSystem(this.scene, this.engine.camera);
    console.log("AtmosphereSystem: Initializing star field...");
    await this.starSystem.initialize();
    console.log("AtmosphereSystem: Star field initialized");

    // --- NEW CODE: Reduce the number of stars by drawing only 50% ---
    if (this.starSystem.starField && this.starSystem.starField.geometry) {
      const count =
        this.starSystem.starField.geometry.attributes.position.count;
      this.starSystem.starField.geometry.setDrawRange(
        0,
        Math.floor(count * 0.2)
      );
    }
    if (
      this.starSystem.horizonStarField &&
      this.starSystem.horizonStarField.geometry
    ) {
      const count =
        this.starSystem.horizonStarField.geometry.attributes.position.count;
      this.starSystem.horizonStarField.geometry.setDrawRange(
        0,
        Math.floor(count * 0.2)
      );
    }
    
    // Create ThreeJS Sky with sun
    this.createSkyWithSun();

    // Create clouds
    this.createVolumetricClouds();

    // Create birds
    this.createBirds();

    console.log("AtmosphereSystem initialized");
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
    console.log("Created sun light and ambient light");
  }

  // Create advanced sky with sun using ThreeJS Sky
  createSkyWithSun() {
    // Remove the old sky if it exists
    if (this.sky) {
      this.scene.remove(this.sky);
    }
    
    // Add Sky
    this.sky = new Sky();
    this.sky.scale.setScalar(30000); // Reduced scale to make sun more visible
    this.scene.add(this.sky);
    
    // Set up the uniforms with values that make sun more prominent
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 8;
    uniforms['rayleigh'].value = 1;
    uniforms['mieCoefficient'].value = 0.025; // Increased for more defined sun
    uniforms['mieDirectionalG'].value = 0.999; // Higher value makes sun more defined
    
    // IMPORTANT: DON'T UPDATE SKY POSITION EVERY FRAME
    // Only set it once here, and don't follow camera in the update method
    this.sky.position.set(0, 0, 0);
    
    // Set tone mapping exposure
    this.engine.renderer.toneMappingExposure = 0.6; // Slightly increased
    
    // Set the scene fog
    this.scene.fog = new THREE.FogExp2(0x88ccff, 0.00003);
    
    // Create night sky components (moon)
    this.createNightSky();
    
    // Create physical sun AFTER sky is set up
    // The separation of sky backdrop and physical sun prevents the issue
    this.createSunSphere(); 
    
    // Create clouds last to ensure proper layering
    this.createVolumetricClouds();
    
    console.log('Sky and sun created with proper world-space positioning');
  }

// Try these changes to the createCloudSpriteMaterial method
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
  
  const cloudCount = 100; // Original cloud count

  for (let i = 0; i < cloudCount; i++) {
    const cloudMaterial = this.createCloudSpriteMaterial();
    const cloud = new THREE.Sprite(cloudMaterial);

    // Add specific layer for water reflections
    cloud.layers.enable(2); // Water reflections layer
    
    // Make clouds MUCH larger for visibility
    const scale = 800 + Math.random() * 600;
    cloud.scale.set(scale, scale, 1);
    
    // Position clouds closer to player
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
  console.log(`Created ${cloudCount} clouds`);
}
  updateVolumetricClouds(delta) {
    if (!this.clouds || this.clouds.length === 0) return;

    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    const time = this.elapsed;

    // Update each cloud
    this.clouds.forEach((cloud, index) => {
      // Update shader time uniform
      if (
        cloud.material &&
        cloud.material.uniforms &&
        cloud.material.uniforms.uTime
      ) {
        cloud.material.uniforms.uTime.value = time + cloud.userData.timeOffset;
      }

      // Update cloud rotation
      if (
        cloud.material &&
        cloud.material.uniforms &&
        cloud.material.uniforms.rotation
      ) {
        cloud.material.uniforms.rotation.value +=
          cloud.userData.rotationSpeed * delta;
      }

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
      if (distSq > 9000000) {
        // 3000^2
        const angle = Math.random() * Math.PI * 2;
        const radius = 2000 + Math.random() * 500;

        cloud.position.x = player.position.x + radius * Math.cos(angle);
        cloud.position.z = player.position.z + radius * Math.sin(angle);
      }
    });
  }
  // Create visible sun sphere
  createSunSphere() {
    // First remove any existing sun objects
    if (this.sunSphere) {
      if (this.sunSphere.parent) {
        this.sunSphere.parent.remove(this.sunSphere);
      }
    }
    
    // Create much smaller sun sphere for distant appearance
    const sunGeometry = new THREE.SphereGeometry(100, 16, 16); // Smaller geometry
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.00001,
      
      // depthWrite: true, // Don't write to depth buffer to prevent clipping
      // depthTest: false   // Don't test against depth buffer to always be visible
    });
    
    this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunSphere.renderOrder = 97; // Render after sky
    
    // Create the sun in world space, not as a child of anything
    this.scene.add(this.sunSphere);
    
    // Scale down the sun
    this.sunSphere.scale.set(0.05, 0.05, 0.05);
    
    // Position sun far away initially
    this.sunSphere.position.set(10000, 5000, 0);
    
    // Add a simple glow effect
    const sunGlowGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3,
      fog: false,
      depthWrite: false,
      depthTest: false
    });
    
    this.sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    this.sunSphere.add(this.sunGlow);
    
    // Add a second, larger glow layer
    const sunOuterGlowGeometry = new THREE.SphereGeometry(2.5, 16, 16);
    const sunOuterGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff80,
      transparent: true,
      opacity: 0.15,
      fog: false,
      depthWrite: false,
      depthTest: false
    });
    
    this.sunOuterGlow = new THREE.Mesh(sunOuterGlowGeometry, sunOuterGlowMaterial);
    this.sunSphere.add(this.sunOuterGlow);
    
    console.log('Created sun sphere with proper scaling at world position:', this.sunSphere.position);
  }

  createNightSky() {
    const textureLoader = new THREE.TextureLoader();

    // Load the actual moon texture file
    const moonTexture = textureLoader.load("/assets/textures/moon.jpg");

    // Create a moon: a properly lit sphere with the moon texture.
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
  }

  createBirdModel() {
    // Create a simple bird model
    const bird = new THREE.Group();

    // Bird body
    const bodyGeometry = new THREE.ConeGeometry(1, 4, 4);
    bodyGeometry.rotateX(Math.PI / 2);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

    // Bird wings
    const wingGeometry = new THREE.PlaneGeometry(6, 2);
    const wingMaterial = new THREE.MeshBasicMaterial({
      color: 0x666666,
      side: THREE.DoubleSide,
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.rotation.y = Math.PI / 2;
    wings.position.y = 0.5;

    bird.add(body);
    bird.add(wings);

    // Animation properties
    bird.userData = {
      wingFlapSpeed: 0.2 + Math.random() * 0.3,
      wingFlapAmount: 0.3 + Math.random() * 0.2,
      wingFlapPhase: Math.random() * Math.PI * 2,
    };

    return bird;
  }

  createBirdFlock(count, center, spread) {
    const flock = {
      birds: [],
      center: center.clone(),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        0,
        (Math.random() - 0.5) * 20
      ),
      circlingCenter: center.clone(),
      circlingRadius: 50 + Math.random() * 100,
      circlingHeight: center.y,
      circlingPhase: Math.random() * Math.PI * 2,
      circlingSpeed: 0.2 + Math.random() * 0.3,
    };

    for (let i = 0; i < count; i++) {
      const bird = this.createBirdModel();

      // Position within flock
      bird.position.set(
        center.x + (Math.random() - 0.5) * spread,
        center.y + (Math.random() - 0.5) * spread * 0.5,
        center.z + (Math.random() - 0.5) * spread
      );

      // Random scale
      const scale = 0.5 + Math.random() * 0.5;
      bird.scale.set(scale, scale, scale);

      // Individual bird behavior
      bird.userData.flockOffset = new THREE.Vector3(
        (Math.random() - 0.5) * spread * 0.5,
        (Math.random() - 0.5) * spread * 0.2,
        (Math.random() - 0.5) * spread * 0.5
      );

      bird.userData.flapPhase = Math.random() * Math.PI * 2;
      bird.userData.flapSpeed = 0.1 + Math.random() * 0.4;

      this.scene.add(bird);
      this.birds.push(bird);
      flock.birds.push(bird);
    }

    return flock;
  }

  createBirds() {
    // Create several flocks of birds
    const flockCount = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < flockCount; i++) {
      const birdCount = 5 + Math.floor(Math.random() * 10);

      // Position flock near player but at varying heights
      const player = this.engine.systems.player?.localPlayer;
      const center = player
        ? new THREE.Vector3(
            player.position.x + (Math.random() - 0.5) * 500,
            100 + Math.random() * 200,
            player.position.z + (Math.random() - 0.5) * 500
          )
        : new THREE.Vector3(
            (Math.random() - 0.5) * 500,
            100 + Math.random() * 200,
            (Math.random() - 0.5) * 500
          );

      const flock = this.createBirdFlock(birdCount, center, 30);
      this.birdFlocks.push(flock);
    }
  }

  updateSkyColors() {
    // Update sky colors based on time of day
    let topColor, bottomColor, fogColor, lightIntensity, lightColor;

    if (this.timeOfDay < 0.25) {
      // Night to sunrise transition
      const t = this.timeOfDay / 0.25;
      topColor = new THREE.Color(0x000005);
      bottomColor = new THREE.Color(0x000010);
      fogColor = new THREE.Color(0x000010);
      lightIntensity = 0.1;
      lightColor = new THREE.Color(0xffffcc);
    } else if (this.timeOfDay < 0.5) {
      // Sunrise to noon
      const t = (this.timeOfDay - 0.25) / 0.25;
      topColor = new THREE.Color(0x0077ff);
      bottomColor = new THREE.Color(0xff9933).lerp(
        new THREE.Color(0x89cff0),
        t
      );
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x89cff0), t);
      lightIntensity = 1.0;
      lightColor = new THREE.Color(0xffffcc);
    } else if (this.timeOfDay < 0.75) {
      // Noon to sunset
      const t = (this.timeOfDay - 0.5) / 0.25;
      topColor = new THREE.Color(0x0077ff);
      bottomColor = new THREE.Color(0x89cff0).lerp(
        new THREE.Color(0xff9933),
        t
      );
      fogColor = new THREE.Color(0x89cff0).lerp(new THREE.Color(0xff9933), t);
      lightIntensity = 1.0;
      lightColor = new THREE.Color(0xffffcc);
    } else {
      // Sunset to night
      const t = (this.timeOfDay - 0.75) / 0.25;
      topColor = new THREE.Color(0x0077ff).lerp(new THREE.Color(0x000022), t);
      bottomColor = new THREE.Color(0xff9933).lerp(
        new THREE.Color(0x000022),
        t
      );
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x000022), t);
      lightIntensity = 1.0 - t;
      lightColor = new THREE.Color(0xffffcc);
    }

    // Update fog
    if (this.scene.fog) {
      this.scene.fog.color = fogColor;
    }

    // Update sun light
    if (this.sunLight) {
      this.sunLight.intensity = lightIntensity;
      this.sunLight.color = lightColor;
    
      // Update sun position
      const sunAngle = this.timeOfDay * Math.PI * 2;
      this.sunPosition.set(
        Math.cos(sunAngle) * 5000, // Increased distance for more realistic sun position
        Math.sin(sunAngle) * 5000,
        0
      );

      this.sunLight.position.copy(this.sunPosition);
      
      // Debug sun position
      if (this.elapsed % 60 < 1) {
        // console.log(`Sun position: x=${this.sunPosition.x.toFixed(0)}, y=${this.sunPosition.y.toFixed(0)}`);
      }
    }
  }

  updateClouds(delta) {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    // Move clouds relative to player
    this.clouds.forEach((cloud, index) => {
      // Move cloud
      cloud.position.x += cloud.userData.speed * delta * 5;

      // Rotate cloud slightly
      cloud.rotation.y += cloud.userData.rotationSpeed * delta;

      // If cloud is too far, reposition it
      const distanceX = cloud.position.x - player.position.x;
      const distanceZ = cloud.position.z - player.position.z;
      const distance = Math.sqrt(distanceX * distanceX + distanceZ * distanceZ);

      if (distance > this.cloudSpread * 1.5) {
        // Move cloud to opposite side
        const angle = Math.atan2(distanceZ, distanceX) + Math.PI;
        const newDistance = this.cloudSpread * 0.5;

        cloud.position.x = player.position.x + Math.cos(angle) * newDistance;
        cloud.position.z = player.position.z + Math.sin(angle) * newDistance;
      }
    });
  }

  updateBirds(delta) {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    // Update each flock
    this.birdFlocks.forEach((flock) => {
      // Update flock circling behavior
      flock.circlingPhase += flock.circlingSpeed * delta;

      // Calculate flock center position
      const circleX =
        flock.circlingCenter.x +
        Math.cos(flock.circlingPhase) * flock.circlingRadius;
      const circleZ =
        flock.circlingCenter.z +
        Math.sin(flock.circlingPhase) * flock.circlingRadius;

      // Gradually move circling center to follow player
      flock.circlingCenter.x +=
        (player.position.x - flock.circlingCenter.x) * 0.001;
      flock.circlingCenter.z +=
        (player.position.z - flock.circlingCenter.z) * 0.001;

      // Update flock center
      flock.center.x = circleX;
      flock.center.z = circleZ;

      // Update each bird in flock
      flock.birds.forEach((bird) => {
        // Move bird toward flock center plus its offset
        const targetX = flock.center.x + bird.userData.flockOffset.x;
        const targetY = flock.center.y + bird.userData.flockOffset.y;
        const targetZ = flock.center.z + bird.userData.flockOffset.z;

        bird.position.x += (targetX - bird.position.x) * 0.05;
        bird.position.y += (targetY - bird.position.y) * 0.05;
        bird.position.z += (targetZ - bird.position.z) * 0.05;

        // Calculate direction of movement
        const direction = new THREE.Vector3(
          targetX - bird.position.x,
          targetY - bird.position.y,
          targetZ - bird.position.z
        ).normalize();

        // Point bird in direction of movement
        if (direction.length() > 0.1) {
          const lookAt = new THREE.Vector3();
          lookAt.copy(bird.position).add(direction);
          bird.lookAt(lookAt);
        }

        // Flap wings
        bird.userData.flapPhase += bird.userData.flapSpeed;
        const wingRotation =
          Math.sin(bird.userData.flapPhase) * bird.userData.flapSpeed * 10;

        if (bird.children[1]) {
          // Wings
          bird.children[1].rotation.x = wingRotation;
        }
      });
    });
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
  
  // Set time to a specific hour and minute
  setTime(hour, minute) {
    // Convert hour and minute to a value between 0 and 1
    // where 0 is midnight and 0.5 is noon
    this.timeOfDay = (hour + minute / 60) / 24;
    console.log(`Time set to ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} (${this.timeOfDay.toFixed(4)})`); 
  }

  // Update stars visibility based on time of day
  updateStarsVisibility(nightFactor) {
    if (!this.starSystem) return;

    const starField = this.starSystem.starField;
    const horizonStarField = this.starSystem.horizonStarField;

    // Compute a flicker effect (the frequency and amplitude can be adjusted)
    const flickerRegular = 0.05 * Math.sin(this.elapsed * 10);
    const flickerHorizon = 0.05 * Math.sin(this.elapsed * 10 + Math.PI / 2);

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

  update(delta, elapsed) {
    // Update elapsed time
    this.elapsed = elapsed;

    // FIXED TIME OF DAY FOR TESTING - Set to noon for maximum visibility
    // this.timeOfDay = 0.5; // Noon
    
    // Update time of day
    this.timeOfDay += delta / this.dayDuration;
    if (this.timeOfDay >= 1.0) this.timeOfDay -= 1.0;

    // Update sky colors
    this.updateSkyColors();

    // Calculate night time factor (0 during day, 1 during night)
    const nightTimeFactor = this.getNightFactor();

    // DO NOT make sky follow camera - it should stay fixed at world origin
    // Keeping sky at origin allows proper world-space positioning of sun
    if (this.sky && this.sky.position.length() > 0) {
      this.sky.position.set(0, 0, 0);
    }

    // Update the basic clouds (if still used)
    this.updateClouds(delta);

    // Update the volumetric clouds
    this.updateVolumetricClouds(delta);

    // Update birds
    this.updateBirds(delta);

    // Update the particle stars system
    this.starSystem.update();

    // Update stars visibility based on time of day
    this.updateStarsVisibility(nightTimeFactor);

    // Update moon position and visibility
    if (this.moonMesh) {
      // Calculate moon angle (opposite to sun)
      const moonAngle = ((this.timeOfDay + 0.5) % 1.0) * Math.PI * 2; // Offset by 0.5 to be opposite the sun

      // Position moon in the sky opposite to the sun
      this.moonMesh.position.set(
        6000 * Math.cos(moonAngle),
        3000 * Math.sin(moonAngle),
        6000 * Math.sin(moonAngle * 0.5)
      );

      // Use the night factor to decide visibility:
      const nightFactor = this.getNightFactor();
      this.moonMesh.visible = nightFactor > 0.05;

      // Always face camera
      if (this.engine.camera) {
        const cameraPosition = this.engine.camera.position.clone();
        this.moonMesh.lookAt(cameraPosition);
      }

      // Adjust moonlight intensity
      if (this.moonLight) {
        this.moonLight.intensity = 0.3; // Force intensity for testing
      }
    }
     // Fixed sun position calculation based solely on time of day - no player relation
  if (this.sunSphere) {
    // Calculate sun angle (0 to 2π) based on time of day
    const sunAngle = this.timeOfDay * Math.PI * 2;
    
    // Detach sun from camera and place in fixed world space
    // Remove from scene and re-add to ensure proper world placement
    if (this.sunSphere.parent !== this.scene) {
      if (this.sunSphere.parent) {
        this.sunSphere.parent.remove(this.sunSphere);
      }
      this.scene.add(this.sunSphere);
    }
    
    // Drastically reduce sun size
    if (this.sunSphere.scale.x > 0.1) {
      this.sunSphere.scale.set(0.05, 0.05, 0.05);
      if (this.sunGlow) this.sunGlow.scale.set(1, 1, 1); // Reset glow to normal relative scale
      if (this.sunOuterGlow) this.sunOuterGlow.scale.set(1.5, 1.5, 1.5); // Reset outer glow
    }
    
    // Position sun much further away in world space
    const radius = 25000; // Very large radius for distant appearance
    const height = 15000;  // Very high for proper arc
    
    // Calculate absolute world position
    this.sunSphere.position.set(
      Math.cos(sunAngle) * radius,
      Math.max(1000, Math.sin(sunAngle) * height), // Keep sun high above horizon
      Math.sin(sunAngle * 0.5) * radius * 0.5 // Minor z-variation but not tied to player
    );

    // Update sun visibility based on time of day
    this.sunSphere.visible = this.timeOfDay > 0.25 && this.timeOfDay < 0.75;
    
    // Update the sunlight direction to match visual sun
    if (this.sunLight) {
      // Position sunlight separately from visual sun for better lighting
      this.sunLight.position.set(
        Math.cos(sunAngle) * radius,
        Math.max(1000, Math.sin(sunAngle) * height),
        0 // Keep light on a simple 2D arc for consistent shadows
      );
      
      // Adjust sunlight color based on time of day
      if (this.timeOfDay > 0.25 && this.timeOfDay < 0.35) {
        // Sunrise - more orange
        this.sunLight.color.setHex(0xffaa33);
      } else if (this.timeOfDay > 0.65 && this.timeOfDay < 0.75) {
        // Sunset - more orange/red
        this.sunLight.color.setHex(0xff7733);
      } else {
        // Day - yellow/white
        this.sunLight.color.setHex(0xffffcc);
      }
    }
  }
}
}
