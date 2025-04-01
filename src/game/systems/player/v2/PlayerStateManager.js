import * as THREE from 'three';
import { System } from '../../../core/v2/System';

/**
 * Manages player objects and their core state
 */
export class PlayerStateManager extends System {
  constructor(engine) {
    super(engine, 'playerState');
    
    this.players = new Map();
    this.localPlayer = null;
    
    // World transition flag
    this.isTransitioning = false;
    this.transitionAlpha = 0;
    this.worldTransitionComplete = null;
    this.worldSize = 2000;
  }
  
  async _initialize() {
    // Listen for network events
    this.engine.systems.network.on('connected', (data) => {
      if (data && data.id) {
        this.createLocalPlayer(data.id);
      }
    });
    
    this.engine.systems.network.on('player_join', (data) => {
      this.createNetworkPlayer(data);
    });
    
    this.engine.systems.network.on('player_leave', (data) => {
      this.removePlayer(data.id);
    });
    
    this.engine.systems.network.on('player_update', (data) => {
      this.updateNetworkPlayer(data);
    });
    
    console.log("PlayerStateManager initialized");
  }
  
  _update(delta) {
    if (!this.localPlayer) return;
    
    if (this.isTransitioning) {
      this.updateTransition(delta);
      return;
    }
    
    // Check world boundaries
    this.checkWorldBoundaries();
    
    // Send player updates to network
    this.sendPlayerUpdate();
    
    // Check for mana collection
    this.checkManaCollection();
  }
  
  createLocalPlayer(id) {
    // Create player object
    const player = {
      id,
      isLocal: true,
      position: new THREE.Vector3(0, 150, 0),
      rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
      velocity: new THREE.Vector3(0, 0, 0),
      acceleration: new THREE.Vector3(0, 0, 0),
      bankAngle: 0,
      throttle: 0,
      mana: 0,
      health: 100,
      maxHealth: 100,
      maxSpeed: 700,
      accelerationValue: 400,
      rotationSpeed: 3,
      spells: [],
      altitude: 350,
      altitudeVelocity: 400,
      currentSpell: 0
    };
    
    // Store the player
    this.players.set(id, player);
    this.localPlayer = player;
    
    console.log(`Local player created with ID: ${id}`);
    
    // Notify other systems
    if (this.engine.systems.playerInput) {
      this.engine.systems.playerInput.setupInput();
    }
    
    if (this.engine.systems.playerModels) {
      // Get a carpet model with the player ID for consistent color
      const carpetModel = this.engine.systems.playerModels.createCarpetModel(id);
      
      // Add carpet model to scene
      carpetModel.position.copy(player.position);
      carpetModel.castShadow = false; // Disable carpet shadow completely
      this.engine.scene.add(carpetModel);
      
      // Store the model reference in player object
      player.model = carpetModel;
      
      this.engine.systems.playerModels.createCrosshair();
    }
    
    if (this.engine.systems.playerCamera) {
      this.engine.systems.playerCamera.updateCamera();
    }
  }

  createNetworkPlayer(data) {
    // Don't create duplicate players
    if (this.players.has(data.id)) {
      return;
    }
    
    // Create player object
    const player = {
      id: data.id,
      isLocal: false,
      position: new THREE.Vector3(data.x || 0, data.y || 20, data.z || 0),
      rotation: new THREE.Euler(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mana: 0,
      health: 100,
      maxHealth: 100
    };
    
    // Store the player
    this.players.set(data.id, player);
    
    console.log(`Network player created with ID: ${data.id}`);
    
    // Notify other systems
    if (this.engine.systems.playerModels) {
      // Get a carpet model with the player ID for consistent color
      const carpetModel = this.engine.systems.playerModels.createCarpetModel(data.id);
      
      // Add carpet model to scene
      carpetModel.position.copy(player.position);
      carpetModel.castShadow = false; // Disable carpet shadow completely
      this.engine.scene.add(carpetModel);
      
      // Store the model reference in player object
      player.model = carpetModel;
    }
  }
  
  removePlayer(id) {
    const player = this.players.get(id);
    if (player) {
      // Remove model from scene if it exists
      if (player.model) {
        this.engine.scene.remove(player.model);
      }
      
      // Remove player from collection
      this.players.delete(id);
      
      console.log(`Player removed with ID: ${id}`);
    }
  }
  
  updateNetworkPlayer(data) {
    const player = this.players.get(data.id);
    if (player && !player.isLocal) {
      // Update position with smoothing
      if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
        const targetPos = new THREE.Vector3(data.x, data.y, data.z);
        player.position.lerp(targetPos, 0.3);
      }
      
      // Update rotation with smoothing
      if (data.rotationY !== undefined) {
        player.rotation.y = THREE.MathUtils.lerp(
          player.rotation.y,
          data.rotationY,
          0.3
        );
      }
      
      // Update other properties
      if (data.mana !== undefined) player.mana = data.mana;
      if (data.health !== undefined) player.health = data.health;
    }
  }

  updateTransition(delta) {
    // Update transition effect
    this.transitionAlpha += delta * 0.5; // Fade speed
    
    if (this.transitionAlpha >= 2.0) {
      // Transition is complete
      this.isTransitioning = false;
      this.transitionAlpha = 0;
      
      // Execute the world transition callback
      if (this.worldTransitionComplete) {
        this.worldTransitionComplete();
        this.worldTransitionComplete = null;
      }
      
      // Remove transition overlay
      const overlay = document.getElementById('transition-overlay');
      if (overlay) {
        document.body.removeChild(overlay);
      }
    } else {
      // Update transition overlay opacity
      const overlay = document.getElementById('transition-overlay');
      if (overlay) {
        // First half = fade to black, second half = fade from black
        const opacity = this.transitionAlpha <= 1.0 ? 
          this.transitionAlpha : 
          2.0 - this.transitionAlpha;
          
        overlay.style.opacity = opacity.toString();
      }
    }
  }
  
  checkWorldBoundaries() {
    if (!this.localPlayer || this.isTransitioning) return;
    
    const worldSize = this.engine.systems.world.worldSize;
    const halfSize = worldSize / 2 - 50; // Buffer from edge
    const { x, z } = this.localPlayer.position;
    
    // Check if player is beyond boundaries
    if (Math.abs(x) > halfSize || Math.abs(z) > halfSize) {
      this.startWorldTransition();
    }
  }
  
  startWorldTransition() {
    if (this.isTransitioning) return;
    
    // Create overlay for transition effect
    const overlay = document.createElement('div');
    overlay.id = 'transition-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'black';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s';
    overlay.style.zIndex = '1000';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);
    
    // Set transition state
    this.isTransitioning = true;
    this.transitionAlpha = 0;
    
    // Set callback for when transition reaches midpoint (full black)
    this.worldTransitionComplete = () => {
      // Generate a new random seed for the world
      this.engine.systems.world.seed = Math.random() * 1000;
      
      // Regenerate world
      this.engine.systems.world.createTerrain();
      this.engine.systems.world.createTerrainCollision();
      this.engine.systems.world.createManaNodes();
      
      // Move player to center of new world at appropriate height
      this.localPlayer.position.set(0, 150, 0);
      this.localPlayer.velocity.set(0, 0, 0);
    };
  }
  
  sendPlayerUpdate() {
    if (!this.localPlayer) return;
    
    const { position, rotation, mana, health } = this.localPlayer;
    
    this.engine.systems.network.sendPlayerUpdate({
      x: position.x,
      y: position.y,
      z: position.z,
      rotationY: rotation.y,
      mana,
      health
    });
  }
  
  checkManaCollection() {
    if (!this.localPlayer) return;
    
    // Collection radius
    const radius = 5;
    
    // Check for mana node collection
    const collectedNodes = this.engine.systems.world.checkManaCollection(
      this.localPlayer.position,
      radius
    );
    
    // Process collected nodes
    collectedNodes.forEach(node => {
      // Add mana to player
      this.localPlayer.mana += node.value;
      
      // Update UI
      if (this.engine.systems.ui) {
        this.engine.systems.ui.updateManaDisplay(this.localPlayer.mana);
      }
      
      // Create collection effect
      if (this.engine.systems.playerModels) {
        this.engine.systems.playerModels.createManaCollectionEffect(node.position);
      }
    });
  }
}
