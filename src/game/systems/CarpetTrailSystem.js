import * as THREE from 'three';

// Constants for pooling
const POOL_BATCH_SIZE = 20; // Number of objects to create at once for efficiency

export class CarpetTrailSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.isMobile = this.detectMobile();
    
    // Trail particles
    this.trailParticles = [];
    this.maxParticles = this.isMobile ? 50 : 200; // Reduced for mobile
    this.particleLifespan = this.isMobile ? 1.0 : 2.0; // seconds
    this.emissionRate = this.isMobile ? 25 : 100; // particles per second
    this.timeSinceLastEmission = 0;
    
    // Particle object pools
    this.trailParticlePool = [];
    this.motionLinePool = [];
    this.steamParticlePool = [];
    
    // Geometry and material caches
    this.particleGeometry = null;
    this.steamGeometry = null;
    
    // Ribbon trail
    this.ribbonPoints = [];
    this.maxRibbonPoints = this.isMobile ? 20 : 50;
    this.ribbonMesh = null;
    this.ribbonMaterial = null;
    this.ribbonUpdateFrequency = 0.1; // seconds
    this.timeSinceLastRibbonUpdate = 0;
    this.minPointsForRibbon = 2; // Minimum points needed for a valid ribbon
    
    // Motion lines
    this.motionLines = [];
    this.maxMotionLines = this.isMobile ? 4 : 12;
    this.motionLineLifespan = 0.5; // seconds
    this.motionLineEmissionRate = this.isMobile ? 10 : 20; // lines per second
    this.timeSinceLastMotionLine = 0;
    
    // Steam effect
    this.steamParticles = [];
    this.maxSteamParticles = this.isMobile ? 25 : 100;
    this.steamLifespan = this.isMobile ? 1.5 : 3.0; // seconds
    this.steamEmissionRate = this.isMobile ? 2 : 5; // particles per second
    this.timeSinceLastSteam = 0;
    
    // Stats for monitoring
    this.stats = {
      poolHits: 0,
      poolMisses: 0,
      activeParticles: 0,
      totalEmitted: 0
    };
  }
  
  /**
   * Reset trail when tab regains focus or on error
   */
  resetTrail() {
    console.log('Resetting carpet trail system');
    
    // Clear ribbon points
    this.ribbonPoints = [];
    
    // Remove ribbon mesh if it exists
    if (this.ribbonMesh) {
      this.scene.remove(this.ribbonMesh);
      if (this.ribbonMesh.geometry) this.ribbonMesh.geometry.dispose();
      this.ribbonMesh = null;
    }
    
    // Reset timers
    this.timeSinceLastEmission = 0;
    this.timeSinceLastRibbonUpdate = 0;
    this.timeSinceLastMotionLine = 0;
    this.timeSinceLastSteam = 0;
    
    // Optionally, clear all particles and lines
    this.clearAllEffects();
  }
  
  /**
   * Clear all visual effects but preserve pools
   */
  clearAllEffects() {
    // Return trail particles to pool
    this.trailParticles.forEach(particle => {
      this.returnParticleToPool(particle);
    });
    this.trailParticles = [];
    
    // Return motion lines to pool
    this.motionLines.forEach(line => {
      this.returnMotionLineToPool(line);
    });
    this.motionLines = [];
    
    // Return steam particles to pool
    this.steamParticles.forEach(particle => {
      this.returnSteamParticleToPool(particle);
    });
    this.steamParticles = [];
    
    // Update stats
    this.stats.activeParticles = 0;
  }
  
  /**
   * Handle visibility change event
   */
  handleVisibilityChange(isVisible) {
    if (isVisible) {
      // Reset the trail when tab becomes visible again
      this.resetTrail();
    }
  }
  
  /**
   * Detect if device is mobile for optimizations
   */
  detectMobile() {
    // Check if user agent contains mobile patterns
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    // Also check screen size as a fallback
    const isSmallScreen = window.innerWidth <= 1024;
    
    return isMobile || isSmallScreen;
  }

  /**
   * Initialize particle system and object pools
   */
  initialize() {
    console.log("Initializing CarpetTrailSystem", this.isMobile ? "(Mobile)" : "(Desktop)");
    
    // Create shared geometries
    this.particleGeometry = new THREE.SphereGeometry(0.1, this.isMobile ? 3 : 4, this.isMobile ? 3 : 4);
    this.steamGeometry = new THREE.PlaneGeometry(0.5, 0.5);
    
    // Create particle material
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x80ffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    
    // Create ribbon material
    this.ribbonMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    // Create motion line material
    this.motionLineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6
    });
    
    // Create steam material
    this.steamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    
    // Initialize object pools
    this.initializePools();
  }
  
  /**
   * Initialize particle and effect object pools
   */
  initializePools() {
    console.log("Initializing particle object pools");
    
    // Pre-fill particle pool for better performance
    this.createParticlesForPool(POOL_BATCH_SIZE);
    
    // Create initial steam particles
    this.createSteamParticlesForPool(POOL_BATCH_SIZE);
  }
  
  /**
   * Create a batch of particles and add them to the pool
   */
  createParticlesForPool(count) {
    for (let i = 0; i < count; i++) {
      // Create a particle with shared geometry
      const material = this.particleMaterial.clone();
      const particle = new THREE.Mesh(this.particleGeometry, material);
      
      // Initialize to a default state
      particle.visible = false;
      particle.position.set(0, -1000, 0); // Position far below
      
      // Prepare user data object
      particle.userData = {
        active: false,
        lifetime: 0,
        maxLifetime: 0,
        initialScale: 0,
        velocity: new THREE.Vector3()
      };
      
      // Add to scene (will be invisible) and pool
      this.scene.add(particle);
      this.trailParticlePool.push(particle);
    }
  }
  
  /**
   * Create a batch of steam particles and add them to the pool
   */
  createSteamParticlesForPool(count) {
    for (let i = 0; i < count; i++) {
      // Create a particle with shared geometry
      const material = this.steamMaterial.clone();
      const particle = new THREE.Mesh(this.steamGeometry, material);
      
      // Initialize to a default state
      particle.visible = false;
      particle.position.set(0, -1000, 0); // Position far below
      
      // Prepare user data object
      particle.userData = {
        active: false,
        lifetime: 0,
        maxLifetime: 0,
        initialScale: 0,
        velocity: new THREE.Vector3()
      };
      
      // Add to scene (will be invisible) and pool
      this.scene.add(particle);
      this.steamParticlePool.push(particle);
    }
  }
  
  /**
   * Get a particle from the pool or create if needed
   */
  getParticleFromPool() {
    // If we have particles in the pool, reuse one
    if (this.trailParticlePool.length > 0) {
      const particle = this.trailParticlePool.pop();
      particle.visible = true;
      this.stats.poolHits++;
      return particle;
    }
    
    // If pool is empty, create a new batch
    this.createParticlesForPool(Math.min(POOL_BATCH_SIZE, this.maxParticles / 4));
    
    // Get particle from the newly filled pool
    const particle = this.trailParticlePool.pop();
    particle.visible = true;
    this.stats.poolMisses++;
    return particle;
  }
  
  /**
   * Return a particle to the pool instead of destroying it
   */
  returnParticleToPool(particle) {
    if (!particle) return;
    
    // Reset particle state
    particle.visible = false;
    particle.position.set(0, -1000, 0);
    particle.material.opacity = 0.7;
    particle.scale.set(1, 1, 1);
    particle.userData.active = false;
    particle.userData.lifetime = 0;
    
    // Only maintain a reasonable pool size
    if (this.trailParticlePool.length < this.maxParticles) {
      this.trailParticlePool.push(particle);
    } else {
      // If pool is full, dispose of the particle
      this.scene.remove(particle);
      particle.material.dispose();
    }
  }
  
  /**
   * Get a steam particle from the pool or create if needed
   */
  getSteamParticleFromPool() {
    // If we have particles in the pool, reuse one
    if (this.steamParticlePool.length > 0) {
      const particle = this.steamParticlePool.pop();
      particle.visible = true;
      this.stats.poolHits++;
      return particle;
    }
    
    // If pool is empty, create a new batch
    this.createSteamParticlesForPool(Math.min(POOL_BATCH_SIZE, this.maxSteamParticles / 4));
    
    // Get particle from the newly filled pool
    const particle = this.steamParticlePool.pop();
    particle.visible = true;
    this.stats.poolMisses++;
    return particle;
  }
  
  /**
   * Return a steam particle to the pool instead of destroying it
   */
  returnSteamParticleToPool(particle) {
    if (!particle) return;
    
    // Reset particle state
    particle.visible = false;
    particle.position.set(0, -1000, 0);
    particle.material.opacity = 0.4;
    particle.scale.set(1, 1, 1);
    particle.userData.active = false;
    particle.userData.lifetime = 0;
    
    // Only maintain a reasonable pool size
    if (this.steamParticlePool.length < this.maxSteamParticles) {
      this.steamParticlePool.push(particle);
    } else {
      // If pool is full, dispose of the particle
      this.scene.remove(particle);
      particle.material.dispose();
    }
  }
  
  /**
   * Create a particle from pool and set its properties
   */
  createParticle(position) {
    // Don't create more than maximum
    if (this.trailParticles.length >= this.maxParticles) {
      return null;
    }
    
    // Get a particle from the pool
    const particle = this.getParticleFromPool();
    
    // Set position and add some random offset
    particle.position.copy(position);
    particle.position.x += (Math.random() - 0.5) * 0.5;
    particle.position.y += (Math.random() - 0.5) * 0.2;
    particle.position.z += (Math.random() - 0.5) * 0.5;
    
    // Set particle properties
    particle.userData.active = true;
    particle.userData.lifetime = 0;
    particle.userData.maxLifetime = this.particleLifespan;
    particle.userData.initialScale = 0.1 + Math.random() * 0.2;
    particle.userData.velocity.set(
      (Math.random() - 0.5) * 0.5,
      Math.random() * 0.2 - 0.05,
      (Math.random() - 0.5) * 0.5
    );
    
    // Add to active particles array
    this.trailParticles.push(particle);
    this.stats.totalEmitted++;
    this.stats.activeParticles = this.trailParticles.length;
    
    return particle;
  }
  
  updateRibbonTrail(position) {
    try {
      // Validate position
      if (!position || position.x === undefined || isNaN(position.x) ||
          position.y === undefined || isNaN(position.y) ||
          position.z === undefined || isNaN(position.z)) {
        console.warn('Invalid position for ribbon trail:', position);
        return;
      }
      
      // Add new point to the ribbon
      this.ribbonPoints.push(position.clone());
      
      // Keep ribbon at max length
      if (this.ribbonPoints.length > this.maxRibbonPoints) {
        this.ribbonPoints.shift();
      }
      
      // Need at least 2 points to create a ribbon
      if (this.ribbonPoints.length < this.minPointsForRibbon) return;
      
      // Remove old ribbon if it exists
      if (this.ribbonMesh) {
        this.scene.remove(this.ribbonMesh);
        this.ribbonMesh.geometry.dispose();
      }
      
      // Validate all points in the ribbon
      const validPoints = this.ribbonPoints.filter(point => 
        point && point.x !== undefined && !isNaN(point.x) &&
        point.y !== undefined && !isNaN(point.y) &&
        point.z !== undefined && !isNaN(point.z)
      );
      
      // Skip if we don't have enough valid points
      if (validPoints.length < this.minPointsForRibbon) {
        console.warn('Not enough valid points for ribbon trail');
        return;
      }
      
      // Use only valid points
      this.ribbonPoints = validPoints;
      
      // Create ribbon using a tube geometry
      const curve = new THREE.CatmullRomCurve3(this.ribbonPoints);
      const geometry = new THREE.TubeGeometry(curve, this.ribbonPoints.length * 2, 0.2, 8, false);
      
      // Create new ribbon mesh
      this.ribbonMesh = new THREE.Mesh(geometry, this.ribbonMaterial);
      this.scene.add(this.ribbonMesh);
    } catch (error) {
      console.error('Error updating ribbon trail:', error);
      // Reset ribbon points in case of error
      this.ribbonPoints = [];
    }
  }
  
  /**
   * Get a motion line from pool or create new one
   */
  getMotionLineFromPool() {
    // Check if we have unused lines in the pool
    if (this.motionLinePool.length > 0) {
      const line = this.motionLinePool.pop();
      line.visible = true;
      this.stats.poolHits++;
      return line;
    }
    
    // If not, create a new line with placeholder points
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1)
    ]);
    
    const line = new THREE.Line(geometry, this.motionLineMaterial.clone());
    line.userData = {
      active: false,
      lifetime: 0,
      maxLifetime: 0
    };
    
    // Add to scene (will be invisible at first)
    this.scene.add(line);
    this.stats.poolMisses++;
    return line;
  }
  
  /**
   * Return a motion line to the pool
   */
  returnMotionLineToPool(line) {
    if (!line) return;
    
    // Reset line state
    line.visible = false;
    line.position.set(0, -1000, 0);
    line.material.opacity = 0.6;
    line.userData.active = false;
    line.userData.lifetime = 0;
    
    // Only maintain a reasonable pool size
    if (this.motionLinePool.length < this.maxMotionLines * 2) {
      this.motionLinePool.push(line);
    } else {
      // If pool is full, dispose of the line
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
  }
  
  /**
   * Create a motion line using object pooling
   */
  createMotionLine(position, velocity) {
    try {
      // Validate position and velocity
      if (!position || !velocity || 
          isNaN(position.x) || isNaN(position.y) || isNaN(position.z) ||
          isNaN(velocity.x) || isNaN(velocity.y) || isNaN(velocity.z)) {
        return null;
      }
      
      // Skip if velocity is too low
      const speed = velocity.length();
      if (speed < 10) return null;
      
      // Don't create more than maximum
      if (this.motionLines.length >= this.maxMotionLines) {
        return null;
      }
      
      // Get a line from the pool
      const line = this.getMotionLineFromPool();
      
      // Create line points based on velocity
      const direction = velocity.clone().normalize();
      const points = [
        position.clone(),
        position.clone().sub(direction.multiplyScalar(1 + Math.random() * 2))
      ];
      
      // Update geometry with new points
      line.geometry.setFromPoints(points);
      
      // Set line properties
      line.userData.active = true;
      line.userData.lifetime = 0;
      line.userData.maxLifetime = this.motionLineLifespan;
      
      // Add to active lines array
      this.motionLines.push(line);
      
      return line;
    } catch (error) {
      console.error('Error creating motion line:', error);
      return null;
    }
  }
  
  /**
   * Create a steam particle using object pooling
   */
  createSteamParticle(position) {
    // Don't create more than maximum
    if (this.steamParticles.length >= this.maxSteamParticles) {
      return null;
    }
    
    // Get a particle from the pool
    const particle = this.getSteamParticleFromPool();
    
    // Always face camera
    particle.lookAt(this.engine.camera.position);
    
    // Set position slightly below the carpet
    particle.position.copy(position);
    particle.position.y -= 0.8;
    particle.position.x += (Math.random() - 0.5) * 0.8;
    particle.position.z += (Math.random() - 0.5) * 0.8;
    
    // Set particle properties
    particle.userData.active = true;
    particle.userData.lifetime = 0;
    particle.userData.maxLifetime = this.steamLifespan;
    particle.userData.initialScale = 0.3 + Math.random() * 0.9;
    particle.userData.velocity.set(
      (Math.random() - 0.5) * 0.2,
      0.2 + Math.random() * 0.4,  // Steam rises
      (Math.random() - 0.5) * 0.2
    );
    
    // Random rotation
    particle.rotation.z = Math.random() * Math.PI * 2;
    
    // Add to active particles array
    this.steamParticles.push(particle);
    
    return particle;
  }
  
  /**
   * Main update method
   */
  update(delta) {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    // Get player position and velocity
    const position = player.position.clone();
    position.y -= 0.7; // Emit from bottom of carpet
    const velocity = player.velocity.clone();
    const speed = velocity.length();
    
    // Update emission timers
    this.timeSinceLastEmission += delta;
    this.timeSinceLastRibbonUpdate += delta;
    this.timeSinceLastMotionLine += delta;
    this.timeSinceLastSteam += delta;
    
    // Mobile optimization - adjust effects based on performance
    const speedThreshold = this.isMobile ? 7 : 5; // Higher threshold for mobile
    
    // Emit trail particles when moving (higher threshold on mobile)
    if (speed > speedThreshold && this.timeSinceLastEmission > 1 / this.emissionRate) {
      this.createParticle(position);
      this.timeSinceLastEmission = 0;
    }
    
    // Update ribbon trail
    if (this.timeSinceLastRibbonUpdate > this.ribbonUpdateFrequency) {
      this.updateRibbonTrail(position);
      this.timeSinceLastRibbonUpdate = 0;
    }
    
    // Emit motion lines when moving fast (skip on mobile at lower speeds)
    const motionLineThreshold = this.isMobile ? 15 : 10;
    if (speed > motionLineThreshold && this.timeSinceLastMotionLine > 1 / this.motionLineEmissionRate) {
      this.createMotionLine(position, velocity);
      this.timeSinceLastMotionLine = 0;
    }
    
    // Emit steam particles (less frequently on mobile)
    if (this.timeSinceLastSteam > 1 / this.steamEmissionRate) {
      this.createSteamParticle(position);
      this.timeSinceLastSteam = 0;
    }
    
    // Update existing particles
    this.updateParticles(delta);
    this.updateMotionLines(delta);
    this.updateSteamParticles(delta);
    
    // Make sure ribbon updates to face camera
    if (this.ribbonMesh) {
      this.ribbonMesh.lookAt(this.engine.camera.position);
    }
  }
  
  /**
   * Update trail particles and return expired ones to the pool
   */
  updateParticles(delta) {
    // Update trail particles
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const particle = this.trailParticles[i];
      if (!particle || !particle.userData) continue;
      
      particle.userData.lifetime += delta;
      
      // Update position based on velocity
      particle.position.add(particle.userData.velocity.clone().multiplyScalar(delta * (this.isMobile ? 1.5 : 1.0)));
      
      // Fade out particle based on lifetime
      const lifeRatio = particle.userData.lifetime / particle.userData.maxLifetime;
      particle.material.opacity = 0.5 * (1 - lifeRatio);
      
      // Scale particle down over time
      const scale = particle.userData.initialScale * (1 - lifeRatio * 0.5);
      particle.scale.set(scale, scale, scale);
      
      // Remove particle if it's too old
      if (particle.userData.lifetime >= particle.userData.maxLifetime) {
        // Remove from active particles array
        this.trailParticles.splice(i, 1);
        
        // Return to pool instead of destroying
        this.returnParticleToPool(particle);
      }
    }
    
    // Update active count
    this.stats.activeParticles = this.trailParticles.length;
    
    // Remove excess particles if we have too many
    while (this.trailParticles.length > this.maxParticles) {
      const particle = this.trailParticles.shift();
      this.returnParticleToPool(particle);
    }
  }
  
  /**
   * Update motion lines and return expired ones to the pool
   */
  updateMotionLines(delta) {
    // Update motion lines
    for (let i = this.motionLines.length - 1; i >= 0; i--) {
      const line = this.motionLines[i];
      if (!line || !line.userData) continue;
      
      line.userData.lifetime += delta;
      
      // Fade out line based on lifetime
      const lifeRatio = line.userData.lifetime / line.userData.maxLifetime;
      line.material.opacity = 0.6 * (1 - lifeRatio);
      
      // Remove line if it's too old
      if (line.userData.lifetime >= line.userData.maxLifetime) {
        // Remove from active lines array
        this.motionLines.splice(i, 1);
        
        // Return to pool instead of destroying
        this.returnMotionLineToPool(line);
      }
    }
    
    // Remove excess lines if we have too many
    while (this.motionLines.length > this.maxMotionLines) {
      const line = this.motionLines.shift();
      this.returnMotionLineToPool(line);
    }
  }
  
  /**
   * Update steam particles and return expired ones to the pool
   */
  updateSteamParticles(delta) {
    // Update steam particles
    for (let i = this.steamParticles.length - 1; i >= 0; i--) {
      const particle = this.steamParticles[i];
      if (!particle || !particle.userData) continue;
      
      particle.userData.lifetime += delta;
      
      // Update position based on velocity
      particle.position.add(particle.userData.velocity.clone().multiplyScalar(delta));
      
      // Fade out particle based on lifetime
      const lifeRatio = particle.userData.lifetime / particle.userData.maxLifetime;
      particle.material.opacity = 0.4 * (1 - lifeRatio);
      
      // Grow particle over time
      const scale = particle.userData.initialScale * (1 + lifeRatio);
      particle.scale.set(scale, scale, scale);
      
      // Make sure particle always faces camera (skip every other frame on mobile)
      if (!this.isMobile || Math.floor(performance.now() / 100) % 2 === 0) {
        particle.lookAt(this.engine.camera.position);
      }
      
      // Remove particle if it's too old
      if (particle.userData.lifetime >= particle.userData.maxLifetime) {
        // Remove from active particles array
        this.steamParticles.splice(i, 1);
        
        // Return to pool instead of destroying
        this.returnSteamParticleToPool(particle);
      }
    }
    
    // Remove excess particles if we have too many
    while (this.steamParticles.length > this.maxSteamParticles) {
      const particle = this.steamParticles.shift();
      this.returnSteamParticleToPool(particle);
    }
  }
}