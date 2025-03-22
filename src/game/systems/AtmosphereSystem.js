import * as THREE from "three";

export class AtmosphereSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.worldSystem = engine.systems.world;
    
    // Clouds
    this.clouds = [];
    this.cloudCount = 100;
    this.cloudSpread = 2000; // How far clouds spread from player
    this.cloudHeight = 200;  // Height of cloud layer
    
    // Birds
    this.birds = [];
    this.birdCount = 30;
    this.birdFlocks = [];
    
    // Day/night cycle
    this.dayDuration = 600; // 10 minutes per day cycle
    this.timeOfDay = 0.3;   // Start at morning (0 = midnight, 0.5 = noon, 1 = midnight)
    this.sunPosition = new THREE.Vector3();
    this.sunLight = null;
  }
  
  async initialize() {
    console.log("Initializing AtmosphereSystem...");
    
    // Create enhanced sky
    this.createSky();
    
    // Create clouds
    this.createClouds();
    
    // Create birds
    this.createBirds();
    
    console.log("AtmosphereSystem initialized");
  }
  

  createSky() {
    // Clear any existing sky first
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.geometry.dispose();
      this.sky.material.dispose();
    }
  
    // Use a much larger sky dome to prevent the edge from being visible
    const skyGeometry = new THREE.SphereGeometry(8000, 32, 15);
    
    // Instead of shader material that might be causing issues, use a simple gradient
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x3388ff) },
        bottomColor: { value: new THREE.Color(0xaaddff) },
        offset: { value: 400 },
        exponent: { value: 0.7 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
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
      fog: false // Disable fog for sky dome
    });
  
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    
    // Make sure sky follows camera
    this.sky.onBeforeRender = () => {
      if (this.engine.camera) {
        this.sky.position.copy(this.engine.camera.position);
      }
    };
    
    this.scene.add(this.sky);
    
    // Use a more gentle fog that won't create sharp visual boundaries
    this.scene.fog = new THREE.FogExp2(0xaaddff, 0.0003);
  }
  

createCloudParticle() {
  // Create a more natural-looking cloud particle
  const geometry = new THREE.SphereGeometry(15, 8, 8);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, 
    transparent: true,
    opacity: 0.7,
    roughness: 1,
    metalness: 0
  });
  
  return new THREE.Mesh(geometry, material);
}

// Also update this method for better sky colors throughout the day
updateSkyColors() {
  // Update sky colors based on time of day
  let topColor, bottomColor, fogColor, lightIntensity, lightColor;
  
  if (this.timeOfDay < 0.25) {
    // Night to sunrise transition
    const t = this.timeOfDay / 0.25;
    topColor = new THREE.Color(0x001133).lerp(new THREE.Color(0x3388ff), t);
    bottomColor = new THREE.Color(0x002244).lerp(new THREE.Color(0xffcc88), t);
    fogColor = new THREE.Color(0x001133).lerp(new THREE.Color(0xffcc88), t);
    lightIntensity = t * 0.8;
    lightColor = new THREE.Color(0xffffdd);
  } else if (this.timeOfDay < 0.5) {
    // Sunrise to noon
    const t = (this.timeOfDay - 0.25) / 0.25;
    topColor = new THREE.Color(0x3388ff);
    bottomColor = new THREE.Color(0xffcc88).lerp(new THREE.Color(0xaaddff), t);
    fogColor = new THREE.Color(0xffcc88).lerp(new THREE.Color(0xaaddff), t);
    lightIntensity = 0.8 + t * 0.2;
    lightColor = new THREE.Color(0xffffcc).lerp(new THREE.Color(0xffffff), t);
  } else if (this.timeOfDay < 0.75) {
    // Noon to sunset
    const t = (this.timeOfDay - 0.5) / 0.25;
    topColor = new THREE.Color(0x3388ff);
    bottomColor = new THREE.Color(0xaaddff).lerp(new THREE.Color(0xff9966), t);
    fogColor = new THREE.Color(0xaaddff).lerp(new THREE.Color(0xff9966), t);
    lightIntensity = 1.0;
    lightColor = new THREE.Color(0xffffff).lerp(new THREE.Color(0xffcc99), t);
  } else {
    // Sunset to night
    const t = (this.timeOfDay - 0.75) / 0.25;
    topColor = new THREE.Color(0x3388ff).lerp(new THREE.Color(0x001133), t);
    bottomColor = new THREE.Color(0xff9966).lerp(new THREE.Color(0x002244), t);
    fogColor = new THREE.Color(0xff9966).lerp(new THREE.Color(0x001133), t);
    lightIntensity = 1.0 - t * 0.8;
    lightColor = new THREE.Color(0xffcc99).lerp(new THREE.Color(0xaaaacc), t);
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
      Math.cos(sunAngle) * 500,
      Math.sin(sunAngle) * 500,
      0
    );
    
    this.sunLight.position.copy(this.sunPosition);
  }
}
  
  createCloudParticle() {
    // Create a simple cloud particle
    const geometry = new THREE.SphereGeometry(15, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      roughness: 1,
      metalness: 0
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  createCloudGroup() {
    // Create a cloud consisting of multiple particles
    const cloud = new THREE.Group();
    
    // Number of particles in this cloud
    const particleCount = 3 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.createCloudParticle();
      
      // Random position within cloud
      particle.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 30
      );
      
      // Random scale
      const scale = 0.5 + Math.random() * 0.5;
      particle.scale.set(scale, scale, scale);
      
      cloud.add(particle);
    }
    
    // Set cloud properties
    cloud.userData = {
      speed: 0.2 + Math.random() * 0.3,
      rotationSpeed: (Math.random() - 0.5) * 0.01
    };
    
    return cloud;
  }
  
  createClouds() {
    // Create clouds distributed around player
    for (let i = 0; i < this.cloudCount; i++) {
      const cloud = this.createCloudGroup();
      
      // Random position in sky
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * this.cloudSpread;
      
      cloud.position.set(
        Math.cos(angle) * distance,
        this.cloudHeight + (Math.random() - 0.5) * 50,
        Math.sin(angle) * distance
      );
      
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
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
      topColor = new THREE.Color(0x000022).lerp(new THREE.Color(0x0077ff), t);
      bottomColor = new THREE.Color(0x000022).lerp(new THREE.Color(0xff9933), t);
      fogColor = new THREE.Color(0x000022).lerp(new THREE.Color(0xff9933), t);
      lightIntensity = t;
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
        Math.cos(sunAngle) * 500,
        Math.sin(sunAngle) * 500,
        0
      );
      
      this.sunLight.position.copy(this.sunPosition);
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
  
  update(delta) {
    // Update time of day
    this.timeOfDay += delta / this.dayDuration;
    if (this.timeOfDay >= 1.0) this.timeOfDay -= 1.0;
    
    // Update sky colors
    this.updateSkyColors();
    
    // Make sure sky follows camera
    if (this.sky && this.engine.camera) {
      this.sky.position.copy(this.engine.camera.position);
    }
    
    // Update clouds
    this.updateClouds(delta);
    
    // Update birds
    this.updateBirds(delta);
  }
}