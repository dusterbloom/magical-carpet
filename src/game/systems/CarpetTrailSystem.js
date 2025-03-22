import * as THREE from 'three';

export class CarpetTrailSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    
    // Trail particles
    this.trailParticles = [];
    this.maxParticles = 200;
    this.particleLifespan = 2.0; // seconds
    this.emissionRate = 10; // particles per second
    this.timeSinceLastEmission = 0;
    
    // Ribbon trail
    this.ribbonPoints = [];
    this.maxRibbonPoints = 50;
    this.ribbonMesh = null;
    this.ribbonMaterial = null;
    this.ribbonUpdateFrequency = 0.1; // seconds
    this.timeSinceLastRibbonUpdate = 0;
    this.minPointsForRibbon = 2; // Minimum points needed for a valid ribbon
    
    // Motion lines
    this.motionLines = [];
    this.maxMotionLines = 12;
    this.motionLineLifespan = 0.5; // seconds
    this.motionLineEmissionRate = 20; // lines per second
    this.timeSinceLastMotionLine = 0;
    
    // Steam effect
    this.steamParticles = [];
    this.maxSteamParticles = 100;
    this.steamLifespan = 3.0; // seconds
    this.steamEmissionRate = 5; // particles per second
    this.timeSinceLastSteam = 0;
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
   * Clear all visual effects
   */
  clearAllEffects() {
    // Clear trail particles
    this.trailParticles.forEach(particle => {
      this.scene.remove(particle);
      if (particle.geometry) particle.geometry.dispose();
      if (particle.material) particle.material.dispose();
    });
    this.trailParticles = [];
    
    // Clear motion lines
    this.motionLines.forEach(line => {
      this.scene.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    });
    this.motionLines = [];
    
    // Clear steam particles
    this.steamParticles.forEach(particle => {
      this.scene.remove(particle);
      if (particle.geometry) particle.geometry.dispose();
      if (particle.material) particle.material.dispose();
    });
    this.steamParticles = [];
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
  
  initialize() {
    console.log("Initializing CarpetTrailSystem");
    
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
  }
  
  createParticle(position) {
    // Create a small sphere for the particle
    const geometry = new THREE.SphereGeometry(0.1, 4, 4);
    const material = this.particleMaterial.clone();
    const particle = new THREE.Mesh(geometry, material);
    
    // Set position and add some random offset
    particle.position.copy(position);
    particle.position.x += (Math.random() - 0.5) * 0.5;
    particle.position.y += (Math.random() - 0.5) * 0.2;
    particle.position.z += (Math.random() - 0.5) * 0.5;
    
    // Set particle properties
    particle.userData = {
      lifetime: 0,
      maxLifetime: this.particleLifespan,
      initialScale: 0.1 + Math.random() * 0.2,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.2 - 0.05,
        (Math.random() - 0.5) * 0.5
      )
    };
    
    // Add to scene and array
    this.scene.add(particle);
    this.trailParticles.push(particle);
    
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
      
      // Create line points based on velocity
      const direction = velocity.clone().normalize();
      const points = [
        position.clone(),
        position.clone().sub(direction.multiplyScalar(1 + Math.random() * 2))
      ];
      
      // Create line geometry
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, this.motionLineMaterial.clone());
      
      // Set line properties
      line.userData = {
        lifetime: 0,
        maxLifetime: this.motionLineLifespan
      };
      
      // Add to scene and array
      this.scene.add(line);
      this.motionLines.push(line);
      
      return line;
    } catch (error) {
      console.error('Error creating motion line:', error);
      return null;
    }
  }
  
  createSteamParticle(position) {
    // Create a cloud-like shape for steam
    const geometry = new THREE.PlaneGeometry(0.5, 0.5);
    const material = this.steamMaterial.clone();
    const particle = new THREE.Mesh(geometry, material);
    
    // Always face camera
    particle.lookAt(this.engine.camera.position);
    
    // Set position slightly below the carpet
    particle.position.copy(position);
    particle.position.y -= 0.8;
    particle.position.x += (Math.random() - 0.5) * 0.8;
    particle.position.z += (Math.random() - 0.5) * 0.8;
    
    // Set particle properties
    particle.userData = {
      lifetime: 0,
      maxLifetime: this.steamLifespan,
      initialScale: 0.3 + Math.random() * 0.9,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        0.2 + Math.random() * 0.4,  // Steam rises
        (Math.random() - 0.5) * 0.2
      )
    };
    
    // Random rotation
    particle.rotation.z = Math.random() * Math.PI * 2;
    
    // Add to scene and array
    this.scene.add(particle);
    this.steamParticles.push(particle);
    
    return particle;
  }
  
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
    
    // Emit trail particles when moving
    if (speed > 5 && this.timeSinceLastEmission > 1 / this.emissionRate) {
      this.createParticle(position);
      this.timeSinceLastEmission = 0;
    }
    
    // Update ribbon trail
    if (this.timeSinceLastRibbonUpdate > this.ribbonUpdateFrequency) {
      this.updateRibbonTrail(position);
      this.timeSinceLastRibbonUpdate = 0;
    }
    
    // Emit motion lines when moving fast
    if (speed > 10 && this.timeSinceLastMotionLine > 1 / this.motionLineEmissionRate) {
      this.createMotionLine(position, velocity);
      this.timeSinceLastMotionLine = 0;
    }
    
    // Emit steam particles
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
  
  updateParticles(delta) {
    // Update trail particles
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const particle = this.trailParticles[i];
      particle.userData.lifetime += delta;
      
      // Update position based on velocity
      particle.position.add(particle.userData.velocity);
      
      // Fade out particle based on lifetime
      const lifeRatio = particle.userData.lifetime / particle.userData.maxLifetime;
      particle.material.opacity = 0.5 * (1 - lifeRatio);
      
      // Scale particle down over time
      const scale = particle.userData.initialScale * (1 - lifeRatio * 0.5);
      particle.scale.set(scale, scale, scale);
      
      // Remove particle if it's too old
      if (particle.userData.lifetime >= particle.userData.maxLifetime) {
        this.scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
        this.trailParticles.splice(i, 1);
      }
    }
    
    // Remove excess particles if we have too many
    while (this.trailParticles.length > this.maxParticles) {
      const particle = this.trailParticles.shift();
      this.scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
    }
  }
  
  updateMotionLines(delta) {
    // Update motion lines
    for (let i = this.motionLines.length - 1; i >= 0; i--) {
      const line = this.motionLines[i];
      line.userData.lifetime += delta;
      
      // Fade out line based on lifetime
      const lifeRatio = line.userData.lifetime / line.userData.maxLifetime;
      line.material.opacity = 0.6 * (1 - lifeRatio);
      
      // Remove line if it's too old
      if (line.userData.lifetime >= line.userData.maxLifetime) {
        this.scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
        this.motionLines.splice(i, 1);
      }
    }
    
    // Remove excess lines if we have too many
    while (this.motionLines.length > this.maxMotionLines) {
      const line = this.motionLines.shift();
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
  }
  
  updateSteamParticles(delta) {
    // Update steam particles
    for (let i = this.steamParticles.length - 1; i >= 0; i--) {
      const particle = this.steamParticles[i];
      particle.userData.lifetime += delta;
      
      // Update position based on velocity
      particle.position.add(particle.userData.velocity.clone().multiplyScalar(delta));
      
      // Fade out particle based on lifetime
      const lifeRatio = particle.userData.lifetime / particle.userData.maxLifetime;
      particle.material.opacity = 0.4 * (1 - lifeRatio);
      
      // Grow particle over time
      const scale = particle.userData.initialScale * (1 + lifeRatio);
      particle.scale.set(scale, scale, scale);
      
      // Make sure particle always faces camera
      particle.lookAt(this.engine.camera.position);
      
      // Remove particle if it's too old
      if (particle.userData.lifetime >= particle.userData.maxLifetime) {
        this.scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
        this.steamParticles.splice(i, 1);
      }
    }
    
    // Remove excess particles if we have too many
    while (this.steamParticles.length > this.maxSteamParticles) {
      const particle = this.steamParticles.shift();
      this.scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
    }
  }
}