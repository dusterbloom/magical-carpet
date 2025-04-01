import * as THREE from 'three';
import { System } from '../../../core/v2/System';

/**
 * Manages player visual models and effects
 */
export class PlayerModelsSystem extends System {
  constructor(engine) {
    super(engine, 'playerModels');
    this.requireDependencies(['playerState']);
    
    // Collection of all models
    this.modelCache = new Map();
    
    // Visual settings
    this.crosshair = null;
    this.crosshairVisible = true;
    
    // Player model settings
    this.carpetColors = [
      0x8B4513, // Brown
      0x800080, // Purple
      0x4682B4, // Steel Blue
      0x008000, // Green
      0xB22222, // Firebrick
      0x4B0082, // Indigo
      0x708090, // Slate Gray
      0x800000  // Maroon
    ];
    
    // Effect particles
    this.particles = [];
  }
  
  async _initialize() {
    console.log("PlayerModelsSystem initialized");
  }
  
  _update(delta) {
    this.updateModels();
    this.updateParticles(delta);
  }
  
  updateModels() {
    const playerState = this.engine.systems.playerState;
    if (!playerState) return;
    
    // Update all player models based on state
    for (const [id, player] of playerState.players) {
      if (player.model) {
        // Update position
        player.model.position.copy(player.position);
        
        // Update rotation
        player.model.rotation.y = player.rotation.y;
        
        // Update banking (roll) effect
        player.model.rotation.z = player.bankAngle || 0;
      }
    }
    
    // Update crosshair if visible
    if (this.crosshair && this.crosshairVisible) {
      // Position crosshair in front of camera
      const camera = this.engine.camera;
      if (camera) {
        const crosshairDistance = 50;
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        
        this.crosshair.position.copy(camera.position);
        this.crosshair.position.addScaledVector(direction, crosshairDistance);
        
        // Always face the camera
        this.crosshair.quaternion.copy(camera.quaternion);
      }
    }
  }
  
  updateParticles(delta) {
    // Update particle effects
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // Update lifetime
      particle.life -= delta;
      
      // Remove expired particles
      if (particle.life <= 0) {
        this.engine.scene.remove(particle.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      
      // Update particle size/opacity based on life
      const normalizedLife = particle.life / particle.maxLife;
      const scale = particle.startScale * (1 - Math.pow(1 - normalizedLife, 2));
      particle.mesh.scale.set(scale, scale, scale);
      
      // Update material opacity
      if (particle.mesh.material.opacity !== undefined) {
        particle.mesh.material.opacity = normalizedLife;
      }
      
      // Update position if the particle has velocity
      if (particle.velocity) {
        particle.mesh.position.addScaledVector(particle.velocity, delta);
      }
    }
  }
  
  createCarpetModel(playerId) {
    // Get a deterministic color based on player ID
    const colorIndex = this.getPlayerColorIndex(playerId);
    const carpetColor = this.carpetColors[colorIndex];
    
    // Create carpet model
    const carpetGeometry = new THREE.BoxGeometry(5, 0.5, 8);
    const carpetMaterial = new THREE.MeshStandardMaterial({ 
      color: carpetColor,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    
    const carpet = new THREE.Mesh(carpetGeometry, carpetMaterial);
    
    // Add tassels on the edges (small cylinders)
    const tasselGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1, 6);
    const tasselMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xD4AF37,  // Gold color for tassels
      roughness: 0.5,
      metalness: 0.7
    });
    
    // Add tassels around the perimeter
    const tasselPositions = [
      // Front tassels
      [-2.0, -0.5, 3.5], [-1.0, -0.5, 3.5], [0.0, -0.5, 3.5], [1.0, -0.5, 3.5], [2.0, -0.5, 3.5],
      // Left side tassels
      [-2.5, -0.5, 2.5], [-2.5, -0.5, 1.5], [-2.5, -0.5, 0.5], [-2.5, -0.5, -0.5], [-2.5, -0.5, -1.5], [-2.5, -0.5, -2.5],
      // Right side tassels
      [2.5, -0.5, 2.5], [2.5, -0.5, 1.5], [2.5, -0.5, 0.5], [2.5, -0.5, -0.5], [2.5, -0.5, -1.5], [2.5, -0.5, -2.5],
      // Back tassels
      [-2.0, -0.5, -3.5], [-1.0, -0.5, -3.5], [0.0, -0.5, -3.5], [1.0, -0.5, -3.5], [2.0, -0.5, -3.5]
    ];
    
    tasselPositions.forEach(pos => {
      const tassel = new THREE.Mesh(tasselGeometry, tasselMaterial);
      tassel.position.set(...pos);
      tassel.castShadow = false;
      tassel.receiveShadow = false;
      carpet.add(tassel);
    });
    
    // Add carpet design (a simple pattern using a plane with texture or different colored material)
    const designGeometry = new THREE.PlaneGeometry(4.5, 7);
    
    // Use a slightly different tint for the design
    let designColor = new THREE.Color(carpetColor);
    designColor.offsetHSL(0, 0.1, 0.1); // Slightly adjust the hue, saturation, and lightness
    
    const designMaterial = new THREE.MeshStandardMaterial({ 
      color: designColor,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    const designTop = new THREE.Mesh(designGeometry, designMaterial);
    designTop.rotation.x = -Math.PI / 2; // Rotate to lay flat on top of carpet
    designTop.position.y = 0.26; // Position just above the carpet
    designTop.castShadow = false;
    designTop.receiveShadow = false;
    carpet.add(designTop);
    
    // Add subtle pulsing effect to the carpet (animation will be handled in update)
    carpet.userData.pulseTimer = 0;
    carpet.userData.pulseSpeed = 0.5 + Math.random() * 0.5; // Random pulse speed
    
    // Set up shadow properties
    carpet.castShadow = true;
    carpet.receiveShadow = false;
    
    // Cache the model for this player
    this.modelCache.set(playerId, carpet);
    
    return carpet;
  }
  
  createCrosshair() {
    // Remove existing crosshair if any
    if (this.crosshair) {
      this.engine.scene.remove(this.crosshair);
      this.crosshair = null;
    }
    
    // Create a simple crosshair using line segments
    const crosshairGeometry = new THREE.BufferGeometry();
    const crosshairSize = 1;
    
    // Crosshair vertices (plus shape)
    const vertices = new Float32Array([
      // Horizontal line
      -crosshairSize, 0, 0,
      crosshairSize, 0, 0,
      
      // Vertical line
      0, -crosshairSize, 0,
      0, crosshairSize, 0
    ]);
    
    crosshairGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    
    const crosshairMaterial = new THREE.LineBasicMaterial({ 
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.7,
      depthTest: false // Always draw on top
    });
    
    this.crosshair = new THREE.LineSegments(crosshairGeometry, crosshairMaterial);
    this.crosshair.renderOrder = 999; // Ensure it renders on top
    
    // Add to scene
    this.engine.scene.add(this.crosshair);
    
    return this.crosshair;
  }
  
  setCrosshairVisibility(visible) {
    this.crosshairVisible = visible;
    
    if (this.crosshair) {
      this.crosshair.visible = visible;
    }
  }
  
  createManaCollectionEffect(position) {
    // Create particle effect for mana collection
    const particleCount = 8 + Math.floor(Math.random() * 5); // 8-12 particles
    
    for (let i = 0; i < particleCount; i++) {
      // Create particle geometry and material
      const particleGeometry = new THREE.SphereGeometry(0.3, 8, 8);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00FFFF, // Cyan color for mana
        transparent: true,
        opacity: 0.8
      });
      
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      
      // Set initial position at the mana node position
      particle.position.copy(position);
      
      // Add a small random offset
      particle.position.x += (Math.random() - 0.5) * 2;
      particle.position.y += (Math.random() - 0.5) * 2;
      particle.position.z += (Math.random() - 0.5) * 2;
      
      // Calculate velocity - rising particle effect
      const speed = 2 + Math.random() * 3;
      const angle = Math.random() * Math.PI * 2;
      
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        5 + Math.random() * 5, // Upward movement
        Math.sin(angle) * speed
      );
      
      // Add to scene
      this.engine.scene.add(particle);
      
      // Add to particles array for update
      this.particles.push({
        mesh: particle,
        velocity,
        life: 1.0 + Math.random() * 0.5, // 1-1.5 seconds
        maxLife: 1.0 + Math.random() * 0.5,
        startScale: 1.0
      });
    }
  }
  
  /**
   * Get player color index based on player ID
   */
  getPlayerColorIndex(playerId) {
    // Simple hash function to generate a consistent color index from player ID
    let hash = 0;
    
    if (typeof playerId === 'string') {
      for (let i = 0; i < playerId.length; i++) {
        hash = ((hash << 5) - hash) + playerId.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
    } else if (typeof playerId === 'number') {
      hash = playerId;
    }
    
    // Ensure positive index
    hash = Math.abs(hash);
    
    // Return modulo the number of available colors
    return hash % this.carpetColors.length;
  }
  
  /**
   * Clean up all models when the system is destroyed
   */
  destroy() {
    // Remove all models from scene
    for (const model of this.modelCache.values()) {
      this.engine.scene.remove(model);
    }
    
    // Clear model cache
    this.modelCache.clear();
    
    // Remove crosshair
    if (this.crosshair) {
      this.engine.scene.remove(this.crosshair);
      this.crosshair = null;
    }
    
    // Remove all particles
    for (const particle of this.particles) {
      this.engine.scene.remove(particle.mesh);
    }
    this.particles = [];
  }
}
