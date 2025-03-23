import * as THREE from 'three';

export class PlayerModels {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;
    this.scene = playerSystem.scene;
    
    this.carpetModels = [];
    this.carpetMaterials = [];
    this.crosshair = null;
  }
  
  async initialize() {
    await this.createCarpetModels();
  }
  
  async createCarpetModels() {
    // In a real implementation, you would use the loaded models from assets
    // For simplicity, we'll create simple meshes
    
    // Create different carpet materials for players
    this.carpetMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xff5555, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x55ff55, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x5555ff, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0xffff55, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0xff55ff, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x55ffff, roughness: 0.7, metalness: 0.3 })
    ];
    
    // Create a simple carpet model
    const carpetGeometry = new THREE.BoxGeometry(5, 0.5, 8);
    
    // Create different carpet models with different materials
    this.carpetModels = this.carpetMaterials.map(material => {
      return new THREE.Mesh(carpetGeometry, material);
    });
    
    // Set up shadows
    this.carpetModels.forEach(model => {
      model.castShadow = true;
      model.receiveShadow = true;
    });
    
    console.log(`Created ${this.carpetModels.length} carpet models`);
  }
  
  createCarpetModel() {
    // Get a random carpet model
    const carpetIndex = Math.floor(Math.random() * this.carpetModels.length);
    const carpetModel = this.carpetModels[carpetIndex].clone();
    
    return carpetModel;
  }
  
  createCrosshair() {
    // Create crosshair
    const crosshair = document.createElement('div');
    crosshair.style.position = 'absolute';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.width = '20px';
    crosshair.style.height = '20px';
    crosshair.style.borderRadius = '50%';
    crosshair.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    crosshair.style.pointerEvents = 'none';
    
    // Add dot in center
    const dot = document.createElement('div');
    dot.style.position = 'absolute';
    dot.style.top = '50%';
    dot.style.left = '50%';
    dot.style.transform = 'translate(-50%, -50%)';
    dot.style.width = '4px';
    dot.style.height = '4px';
    dot.style.borderRadius = '50%';
    dot.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    
    crosshair.appendChild(dot);
    document.body.appendChild(crosshair);
    
    this.crosshair = crosshair;
  }
  
  createManaCollectionEffect(position) {
    // Create particle effect for mana collection
    const particleCount = 15;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.8
        })
      );
      
      particle.position.copy(position);
      
      // Random velocity - spiral upward
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 2;
      const speed = 5 + Math.random() * 3;
      
      particle.userData = {
        velocity: new THREE.Vector3(
          Math.cos(angle) * radius,
          speed,
          Math.sin(angle) * radius
        ),
        life: 1.0,
        angle: angle
      };
      
      particles.add(particle);
    }
    
    this.scene.add(particles);
    
    // Animate particles
    const animateParticles = (delta) => {
      let allDead = true;
      
      for (let i = 0; i < particles.children.length; i++) {
        const particle = particles.children[i];
        
        // Update angle for spiral effect
        particle.userData.angle += delta * 2;
        
        // Update position - spiral upward
        particle.position.y += particle.userData.velocity.y * delta;
        particle.position.x = position.x + Math.cos(particle.userData.angle) * (particle.userData.velocity.x * 0.5);
        particle.position.z = position.z + Math.sin(particle.userData.angle) * (particle.userData.velocity.z * 0.5);
        
        // Update life
        particle.userData.life -= delta * 1.5;
        
        // Update scale and opacity
        const life = particle.userData.life;
        particle.scale.set(life, life, life);
        particle.material.opacity = life;
        
        if (life > 0) {
          allDead = false;
        }
      }
      
      // Remove particles if all are dead
      if (allDead) {
        this.scene.remove(particles);
        return;
      }
      
      // Continue animation
      requestAnimationFrame(() => animateParticles(0.016));
    };
    
    // Start animation
    animateParticles(0.016);
    
    // If the local player is close enough, create a mana flow effect toward the player
    const localPlayer = this.playerSystem.localPlayer;
    if (localPlayer) {
      const distance = localPlayer.position.distanceTo(position);
      if (distance < 10) {
        this.createManaFlowEffect(position, localPlayer.position.clone());
      }
    }
  }
  
  createManaFlowEffect(startPosition, endPosition) {
    // Create particle effect for mana flowing to player
    const particleCount = 10;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.8
        })
      );
      
      // Start at random position between start and player
      const t = Math.random() * 0.3; // Start closer to the mana node
      particle.position.lerpVectors(startPosition, endPosition, t);
      
      // Random offset
      particle.position.x += (Math.random() - 0.5) * 2;
      particle.position.y += (Math.random() - 0.5) * 2;
      particle.position.z += (Math.random() - 0.5) * 2;
      
      // Direction toward player
      const direction = endPosition.clone().sub(particle.position).normalize();
      
      particle.userData = {
        velocity: direction.multiplyScalar(15 + Math.random() * 5),
        life: 0.5 + Math.random() * 0.5
      };
      
      particles.add(particle);
    }
    
    this.scene.add(particles);
    
    // Animate particles
    const animateParticles = (delta) => {
      let allDead = true;
      
      for (let i = 0; i < particles.children.length; i++) {
        const particle = particles.children[i];
        
        // Update position
        particle.position.add(particle.userData.velocity.clone().multiplyScalar(delta));
        
        // Update life
        particle.userData.life -= delta * 1.2;
        
        // Check if reached player
        const distanceToPlayer = particle.position.distanceTo(endPosition);
        if (distanceToPlayer < 2) {
          particle.userData.life = 0; // Kill the particle
        }
        
        // Update scale and opacity
        const life = particle.userData.life;
        particle.scale.set(life, life, life);
        particle.material.opacity = life;
        
        if (life > 0) {
          allDead = false;
        }
      }
      
      // Remove particles if all are dead
      if (allDead) {
        this.scene.remove(particles);
        return;
      }
      
      // Continue animation
      requestAnimationFrame(() => animateParticles(0.016));
    };
    
    // Start animation
    animateParticles(0.016);
  }
  
  updateModels() {
    this.playerSystem.players.forEach(player => {
      // Update model position
      player.model.position.copy(player.position);
      
      // Update model rotation including banking
      player.model.rotation.set(
        player.rotation.x,           // Pitch
        player.rotation.y,           // Yaw
        player.bankAngle || 0        // Roll/Bank
      );
    });
  }
  
  createTrailEffect(player) {
    // Check for battery saving mode to reduce particles
    const isBatterySaving = this.engine.qualityManager?.batterySavingMode || false;
    
    // Skip trail effect in battery saving mode half the time
    if (isBatterySaving && Math.random() < 0.5) return;
    
    // Create a trail particle behind the player
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0x88aaff,
        transparent: true,
        opacity: 0.5
      })
    );
    
    // Position behind player
    const trailOffset = new THREE.Vector3(0, 0, -4).applyEuler(player.rotation);
    particle.position.copy(player.position).add(trailOffset);
    
    // Add random offset
    particle.position.x += (Math.random() - 0.5) * 2;
    particle.position.y += (Math.random() - 0.5) * 0.5;
    particle.position.z += (Math.random() - 0.5) * 2;
    
    // Set particle properties - shorter life in battery saving mode
    particle.userData = {
      life: isBatterySaving ? 0.6 : 1.0,
      fadeRate: 0.8 + Math.random() * 0.4
    };
    
    this.scene.add(particle);
    
    // Animate trail particle
    const animateTrail = (delta) => {
      // Update life
      particle.userData.life -= delta * particle.userData.fadeRate;
      
      // Update scale and opacity
      const life = particle.userData.life;
      particle.scale.set(life * 2, life * 2, life * 2);
      particle.material.opacity = life * 0.5;
      
      if (life <= 0) {
        // Remove particle
        this.scene.remove(particle);
        return;
      }
      
      // Continue animation
      requestAnimationFrame(() => animateTrail(0.016));
    };
    
    // Start animation
    animateTrail(0.016);
  }
  
  createBoostEffect(position, direction) {
    // Create a burst of particles for boost effect
    const particleCount = this.engine.qualityManager?.batterySavingMode ? 15 : 30;
    const particles = new THREE.Group();
    
    // Get perpendicular vectors to create a disc
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(direction, up).normalize();
    const newUp = new THREE.Vector3().crossVectors(right, direction).normalize();
    
    for (let i = 0; i < particleCount; i++) {
      // Create particle with variable size
      const size = 0.2 + Math.random() * 0.3;
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.5 + Math.random() * 0.5, 0.7, 1.0),
          transparent: true,
          opacity: 0.7
        })
      );
      
      // Position at origin point
      particle.position.copy(position);
      
      // Create disc of particles perpendicular to direction
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 2.5;
      
      // Create burst direction
      const burstDir = new THREE.Vector3();
      burstDir.copy(direction).multiplyScalar(3 + Math.random() * 5); // Forward component
      burstDir.add(right.clone().multiplyScalar(Math.cos(angle) * radius)); // Right component
      burstDir.add(newUp.clone().multiplyScalar(Math.sin(angle) * radius)); // Up component
      
      // Set particle properties
      particle.userData = {
        velocity: burstDir,
        life: 0.7 + Math.random() * 0.5,
        drag: 0.92 + Math.random() * 0.05  // Air resistance simulation
      };
      
      particles.add(particle);
    }
    
    this.scene.add(particles);
    
    // Create bright flash at boost point
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.7
      })
    );
    flash.position.copy(position);
    this.scene.add(flash);
    
    // Add camera shake if it's the local player
    if (this.playerSystem.localPlayer && 
        position.distanceTo(this.playerSystem.localPlayer.position) < 5) {
      this.addCameraShake(0.3, 0.4);
    }
    
    // Animate boost effect
    const animateBoost = (delta) => {
      let allDead = true;
      
      // Fade out flash
      flash.scale.multiplyScalar(0.9);
      flash.material.opacity *= 0.85;
      
      if (flash.material.opacity > 0.01) {
        allDead = false;
      } else {
        this.scene.remove(flash);
      }
      
      // Update particles
      for (let i = 0; i < particles.children.length; i++) {
        const particle = particles.children[i];
        
        // Update position
        particle.position.add(particle.userData.velocity.clone().multiplyScalar(delta));
        
        // Apply drag (air resistance)
        particle.userData.velocity.multiplyScalar(particle.userData.drag);
        
        // Update life
        particle.userData.life -= delta * 1.2;
        
        // Update scale and opacity
        const life = particle.userData.life;
        particle.scale.set(life, life, life);
        particle.material.opacity = life;
        
        if (life > 0) {
          allDead = false;
        }
      }
      
      // Remove particles if all are dead
      if (allDead) {
        this.scene.remove(particles);
        return;
      }
      
      // Continue animation
      requestAnimationFrame(() => animateBoost(0.016));
    };
    
    // Start animation
    animateBoost(0.016);
    
    // Play boost sound if available
    if (this.engine.systems.audio) {
      this.engine.systems.audio.playSound('boost', position);
    }
  }
  
  // Add camera shake effect
  addCameraShake(intensity = 0.5, duration = 0.3) {
    if (!this.engine.camera) return;
    
    // Store original camera position
    const originalPosition = this.engine.camera.position.clone();
    let elapsed = 0;
    
    // Shake function
    const shake = () => {
      elapsed += 0.016;
      
      if (elapsed < duration) {
        // Decreasing intensity over time
        const currentIntensity = intensity * (1 - elapsed / duration);
        
        // Apply random offset to camera
        this.engine.camera.position.x = originalPosition.x + (Math.random() - 0.5) * currentIntensity;
        this.engine.camera.position.y = originalPosition.y + (Math.random() - 0.5) * currentIntensity;
        this.engine.camera.position.z = originalPosition.z + (Math.random() - 0.5) * currentIntensity;
        
        // Continue shaking
        requestAnimationFrame(shake);
      } else {
        // Restore original position
        this.engine.camera.position.copy(originalPosition);
      }
    };
    
    // Start shaking
    shake();
  }
}
