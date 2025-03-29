import * as THREE from "three";
import { StarsParticleSystem } from "./StarsParticleSystem";

export class AtmosphereSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.worldSystem = engine.systems.world;
    
    // Initialize components
    this.starSystem = null;  // Will be initialized in initialize()
    
    // Clouds
    this.clouds = [];
    this.cloudCount = 100;
    this.cloudSpread = 2000; // How far clouds spread from player
    this.cloudHeight = 200;  // Height of cloud layer
    
    // Birds
    this.birds = [];
    this.birdCount = 30;
    this.birdFlocks = [];
    
    // Time tracking
    this.elapsed = 0;
    
    // Day/night cycle
    this.dayDuration = 86400; // 10 minutes per day cycle
    
    // DEBUGGING: Force to night time
    // Keep this forced value for testing night sky stars
    const now = new Date();
    const secondsInDay = 86400;
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    // this.timeOfDay = currentSeconds / secondsInDay; // sync to user time
    this.timeOfDay = 40000 / 86400 ; // afternoon
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
      const count = this.starSystem.starField.geometry.attributes.position.count;
      this.starSystem.starField.geometry.setDrawRange(0, Math.floor(count * 0.2));
    }
    if (this.starSystem.horizonStarField && this.starSystem.horizonStarField.geometry) {
      const count = this.starSystem.horizonStarField.geometry.attributes.position.count;
      this.starSystem.horizonStarField.geometry.setDrawRange(0, Math.floor(count * 0.2));
    }
    // Create enhanced sky
    this.createSky();
    
    // Create clouds
    this.createClouds();
    
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
  
  // Updated createSky method with precision declaration and skinning disabled
  createSky() {
    const skyGeometry = new THREE.SphereGeometry(8000, 32, 15);
    const skyMaterial = new THREE.ShaderMaterial({
      precision: "mediump", // Explicitly set the precision for the shader
      uniforms: {
        topColor: { value: new THREE.Color(0x3388ff) },
        bottomColor: { value: new THREE.Color(0xaaddff) },
        offset: { value: 400 },
        exponent: { value: 0.7 }
      },
      vertexShader: `
        precision mediump float;
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      fog: false,
      skinning: false // Explicitly disable skinning
    });

    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.onBeforeRender = () => {
      if (this.engine.camera) {
        this.sky.position.copy(this.engine.camera.position);
      }
    };
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(0x88ccff, 0.0003);

    // Create night sky components (moon)
    this.createNightSky();
    this.createVolumetricClouds();
  }

  createVolumetricClouds() {
    const textureLoader = new THREE.TextureLoader();
    // Load the noise texture for a soft, irregular cloud pattern.
    const cloudNoiseTexture = textureLoader.load('/textures/cloudNoise.png');
    cloudNoiseTexture.wrapS = cloudNoiseTexture.wrapT = THREE.RepeatWrapping;
    
    this.cloudLayers = [];
    const cloudLayerCount = 3; // Increase for more depth
    for (let i = 0; i < cloudLayerCount; i++) {
      // Create a large plane geometry for each cloud layer
      const geometry = new THREE.PlaneGeometry(10000, 10000);
      const material = new THREE.ShaderMaterial({
        precision: "mediump", // Set precision
        uniforms: { 
          time: { value: 0 },
          cloudNoise: { value: cloudNoiseTexture },
          layerOffset: { value: i * 0.2 }
        },
        vertexShader: `
          precision mediump float;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision mediump float;
          uniform float time;
          uniform sampler2D cloudNoise;
          uniform float layerOffset;
          varying vec2 vUv;
          
          void main() {
            // Animate UV coordinates to simulate drifting clouds
            vec2 uv = vUv + vec2(time * 0.005 + layerOffset, time * 0.003 + layerOffset);
            // Sample the noise texture
            float noise = texture2D(cloudNoise, uv * 2.0).r;
            // Create soft edges
            float alpha = smoothstep(0.55, 0.65, noise);
            gl_FragColor = vec4(vec3(1.0), alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        skinning: false // Disable skinning for this material as well
      });
      
      const cloudMesh = new THREE.Mesh(geometry, material);
      cloudMesh.rotation.x = -Math.PI / 2;
      // Position each layer at a different height
      cloudMesh.position.y = 1500 + (i * 200);
      this.scene.add(cloudMesh);
      this.cloudLayers.push(cloudMesh);
    }
  }

  updateVolumetricClouds(delta) {
    if (!this.cloudLayers) return;
    // Update each cloud layer's time uniform so that the clouds drift
    this.cloudLayers.forEach(layer => {
      if (layer.material && layer.material.uniforms.time) {
        layer.material.uniforms.time.value += delta;
      }
    });
  }

  createClouds() {
    const textureLoader = new THREE.TextureLoader();
    // Make sure to use a good quality cloud texture asset
    const cloudTexture = textureLoader.load('/textures/particles.png');
    
    // Create an array to hold individual cloud sprites
    this.clouds = [];
    const cloudCount = 50; // Adjust for density
  
    for (let i = 0; i < cloudCount; i++) {
      // Create a sprite for the cloud
      const cloudMaterial = new THREE.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.8, // Base opacity. Can vary per cloud if desired.
        depthWrite: false,
      });
      const cloud = new THREE.Sprite(cloudMaterial);
      
      // Randomize the size of each cloud
      const scale = 150 + Math.random() * 100;
      cloud.scale.set(scale, scale, 1);
      
      // Position clouds high in the sky (adjust the Y value as needed)
      // Spread clouds over a large area
      cloud.position.set(
        Math.random() * 10000 - 5000,
        1000 + Math.random() * 400,
        Math.random() * 10000 - 5000
      );
      
      // Optionally, rotate each cloud a little
      cloud.material.rotation = Math.random() * Math.PI * 2;
      
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  createNightSky() {
    const textureLoader = new THREE.TextureLoader();
    
    // Load the actual moon texture file
    const moonTexture = textureLoader.load('/assets/textures/moon.jpg');
    
    // Create a moon: a properly lit sphere with the moon texture.
    const moonGeometry = new THREE.SphereGeometry(300, 32, 32);
    
    // SIMPLIFIED MATERIAL FOR MAXIMUM VISIBILITY
    const moonMaterial = new THREE.MeshBasicMaterial({
      map: moonTexture,
      fog: false,        // Disable fog effects on the moon
      side: THREE.FrontSide   // Only render front faces
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
      side: THREE.DoubleSide 
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
      wingFlapPhase: Math.random() * Math.PI * 2
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
      circlingSpeed: 0.2 + Math.random() * 0.3
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
      bottomColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x89CFF0), t);
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x89CFF0), t);
      lightIntensity = 1.0;
      lightColor = new THREE.Color(0xffffcc);
    } else if (this.timeOfDay < 0.75) {
      // Noon to sunset
      const t = (this.timeOfDay - 0.5) / 0.25;
      topColor = new THREE.Color(0x0077ff);
      bottomColor = new THREE.Color(0x89CFF0).lerp(new THREE.Color(0xff9933), t);
      fogColor = new THREE.Color(0x89CFF0).lerp(new THREE.Color(0xff9933), t);
      lightIntensity = 1.0;
      lightColor = new THREE.Color(0xffffcc);
    } else {
      // Sunset to night
      const t = (this.timeOfDay - 0.75) / 0.25;
      topColor = new THREE.Color(0x0077ff).lerp(new THREE.Color(0x000022), t);
      bottomColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x000022), t);
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x000022), t);
      lightIntensity = 1.0 - t;
      lightColor = new THREE.Color(0xffffcc);
    }
    
    // Apply colors
    if (this.sky) {
      this.sky.material.uniforms.topColor.value = topColor;
      this.sky.material.uniforms.bottomColor.value = bottomColor;
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
    this.birdFlocks.forEach(flock => {
      // Update flock circling behavior
      flock.circlingPhase += flock.circlingSpeed * delta;
      
      // Calculate flock center position
      const circleX = flock.circlingCenter.x + Math.cos(flock.circlingPhase) * flock.circlingRadius;
      const circleZ = flock.circlingCenter.z + Math.sin(flock.circlingPhase) * flock.circlingRadius;
      
      // Gradually move circling center to follow player
      flock.circlingCenter.x += (player.position.x - flock.circlingCenter.x) * 0.001;
      flock.circlingCenter.z += (player.position.z - flock.circlingCenter.z) * 0.001;
      
      // Update flock center
      flock.center.x = circleX;
      flock.center.z = circleZ;
      
      // Update each bird in flock
      flock.birds.forEach(bird => {
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
        const wingRotation = Math.sin(bird.userData.flapPhase) * bird.userData.flapSpeed * 10;
        
        if (bird.children[1]) { // Wings
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
        return 1.0 - (this.timeOfDay / 0.25);
      }
    }
    return 0; // Daytime
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
        const baseOpacity = 0.5 + (nightFactor * 0.5);
        starField.material.opacity = baseOpacity + flickerRegular;
      }
    }
    
    if (horizonStarField) {
      horizonStarField.visible = nightFactor > 0.08;
      if (horizonStarField.material) {
        const baseOpacity = Math.min(1.0, 0.6 + (nightFactor * 0.4));
        horizonStarField.material.opacity = baseOpacity + flickerHorizon;
      }
    }
  }

  update(delta, elapsed) {
    // Update elapsed time
    this.elapsed = elapsed;
    
    // Update time of day
    this.timeOfDay += delta / this.dayDuration;
    if (this.timeOfDay >= 1.0) this.timeOfDay -= 1.0;
    
    // Update sky colors
    this.updateSkyColors();
    
    // Calculate night time factor (0 during day, 1 during night)
    const nightTimeFactor = this.getNightFactor();
    
    // Make sure sky follows camera
    if (this.sky && this.engine.camera) {
      this.sky.position.copy(this.engine.camera.position);
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
      const moonAngle = (this.timeOfDay + 0.5) % 1.0 * Math.PI * 2; // Offset by 0.5 to be opposite the sun
      
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
      
      // Log moon information for debugging
      if (this.elapsed % 10 < 1) { 
        // console.log(`Moon: visible=${this.moonMesh.visible}, position=(${this.moonMesh.position.x.toFixed(0)},${this.moonMesh.position.y.toFixed(0)},${this.moonMesh.position.z.toFixed(0)})`);
      }
    }
  }
}
