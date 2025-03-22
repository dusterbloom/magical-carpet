import * as THREE from 'three';

export class PlayerSpells {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;
    this.scene = playerSystem.scene;
    
    // Spell casting
    this.spellCooldown = 0;
    this.spellTypes = [
      { name: 'Fireball', color: 0xff3300, damage: 20, speed: 100, cooldown: 0.5 },
      { name: 'Lightning', color: 0x33ccff, damage: 15, speed: 150, cooldown: 0.3 },
      { name: 'Shield', color: 0xffcc00, damage: 0, speed: 0, cooldown: 2 }
    ];
    this.activeSpells = [];
  }
  
  async initialize() {
    // Load spell assets or setup spell effects
    // In a real implementation, you might load particle textures, sound effects, etc.
    console.log("Spell system initialized");
  }
  
  selectSpell(index) {
    const player = this.playerSystem.localPlayer;
    if (!player) return;
    
    if (index >= 0 && index < this.spellTypes.length) {
      player.currentSpell = index;
      
      // Update UI
      if (this.engine.systems.ui) {
        this.engine.systems.ui.selectSpell(index);
      }
    }
  }
  
  castSpell() {
    const player = this.playerSystem.localPlayer;
    if (!player || this.spellCooldown > 0) return;
    
    const spellType = this.spellTypes[player.currentSpell];
    
    // Set cooldown
    this.spellCooldown = spellType.cooldown;
    
    // Handle shield spell separately
    if (spellType.name === 'Shield') {
      this.createShieldEffect();
      return;
    }
    
    // Create spell projectile
    const geometry = new THREE.SphereGeometry(0.5, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: spellType.color,
      transparent: true,
      opacity: 0.8
    });
    
    const spell = new THREE.Mesh(geometry, material);
    
    // Position in front of player
    const spellOffset = new THREE.Vector3(0, 0, 2).applyEuler(player.rotation);
    spell.position.copy(player.position).add(spellOffset);
    
    // Calculate direction from camera
    const direction = new THREE.Vector3(0, 0, 1).applyEuler(player.rotation);
    
    spell.userData = {
      type: spellType.name,
      damage: spellType.damage,
      velocity: direction.multiplyScalar(spellType.speed),
      life: 3.0, // 3 seconds lifetime
      owner: player.id
    };
    
    // Add to scene and active spells
    this.scene.add(spell);
    this.activeSpells.push(spell);
    
    // Play sound effect
    // this.playSound('spell');
    
    // Create muzzle flash effect
    this.createMuzzleFlash(spell.position.clone(), spellType.color);
  }
  
  createShieldEffect() {
    const player = this.playerSystem.localPlayer;
    if (!player) return;
    
    // Create shield geometry
    const geometry = new THREE.SphereGeometry(5, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    const shield = new THREE.Mesh(geometry, material);
    
    // Add to player
    player.model.add(shield);
    
    // Add shield data
    player.shield = {
      mesh: shield,
      duration: 3.0 // 3 seconds
    };
  }
  
  createMuzzleFlash(position, color) {
    // Create particle effect for spell casting
    const particleCount = 15;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.8
        })
      );
      
      // Random position within sphere
      const radius = 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      particle.position.set(
        position.x + radius * Math.sin(phi) * Math.cos(theta),
        position.y + radius * Math.sin(phi) * Math.sin(theta),
        position.z + radius * Math.cos(phi)
      );
      
      // Random velocity
      particle.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5
        ),
        life: 0.5 // Shorter life
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
        particle.userData.life -= delta * 2;
        
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
  
  createImpactEffect(position, color) {
    // Create particle effect for spell impact
    const particleCount = 20;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({
          color: color.getHex(),
          transparent: true,
          opacity: 0.8
        })
      );
      
      particle.position.copy(position);
      
      // Random velocity - explode outward
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 5 + Math.random() * 5;
      
      particle.userData = {
        velocity: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).multiplyScalar(speed),
        life: 1.0
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
  }
  
  updateSpells(delta) {
    // Update spell cooldown
    if (this.spellCooldown > 0) {
      this.spellCooldown -= delta;
    }
    
    // Update shield duration
    this.updateShield(delta);
    
    // Update active spell projectiles
    for (let i = this.activeSpells.length - 1; i >= 0; i--) {
      const spell = this.activeSpells[i];
      
      // Update position
      spell.position.add(spell.userData.velocity.clone().multiplyScalar(delta));
      
      // Update life
      spell.userData.life -= delta;
      
      // Check collision with terrain
      const terrainY = this.engine.systems.world.getTerrainHeight(
        spell.position.x,
        spell.position.z
      );
      
      if (spell.position.y < terrainY || spell.userData.life <= 0) {
        // Remove spell
        this.scene.remove(spell);
        this.activeSpells.splice(i, 1);
        
        // Create impact effect if hit terrain
        if (spell.position.y < terrainY) {
          this.createImpactEffect(spell.position.clone(), spell.material.color);
        }
        continue;
      }
      
      // Check collision with players
      this.playerSystem.players.forEach(player => {
        if (player.id !== spell.userData.owner) {
          const distance = player.position.distanceTo(spell.position);
          if (distance < 3) { // Hit radius
            // Apply damage
            player.health -= spell.userData.damage;
            player.health = Math.max(0, player.health);
            
            // Update UI if this is local player
            if (player.isLocal && this.engine.systems.ui) {
              this.engine.systems.ui.updateHealthDisplay(player.health, player.maxHealth);
            }
            
            // Remove spell
            this.scene.remove(spell);
            this.activeSpells.splice(i, 1);
            
            // Create impact effect
            this.createImpactEffect(spell.position.clone(), spell.material.color);
          }
        }
      });
    }
  }
  
  updateShield(delta) {
    const player = this.playerSystem.localPlayer;
    if (!player || !player.shield) return;
    
    player.shield.duration -= delta;
    
    // Pulse effect
    const opacity = 0.3 + 0.2 * Math.sin(this.engine.elapsed * 5);
    player.shield.mesh.material.opacity = opacity;
    
    if (player.shield.duration <= 0) {
      // Remove shield
      player.model.remove(player.shield.mesh);
      player.shield = null;
    }
  }
}
