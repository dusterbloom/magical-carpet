import * as THREE from 'three';
import { System } from "../core/v2/System";
import { PlayerPhysics } from './player/PlayerPhysics';
import { PlayerSpells } from './player/PlayerSpells';
import { PlayerInput } from './player/PlayerInput';
import { PlayerModels } from './player/PlayerModels';

export class PlayerSystem extends System {
    constructor(engine) {
        // Call base class with system ID
        super(engine, 'player');
        
        // Declare dependencies
        this.requireDependencies(['network', 'world', 'ui']);
        
        this.scene = engine.scene;
        this.players = new Map();
        this.localPlayer = null;
        
        // World transition state
        this.isTransitioning = false;
        this.transitionAlpha = 0;
        this.worldTransitionComplete = null;
        this.worldSize = 2000;
        
        // Initialize subsystems
        this.physics = new PlayerPhysics(this);
        this.spells = new PlayerSpells(this);
        this.input = new PlayerInput(this);
        this.models = new PlayerModels(this);
    }

    async _initialize() {
        // Initialize subsystems
        await this.models.initialize();
        await this.spells.initialize();
        
        // Set up touch controls for mobile devices
        if (this.engine.input.isTouchDevice) {
            console.log('Setting up touch controls for mobile device');
            this.input.setupTouchControls();
            
            if (this.engine.gameStarted) {
                console.log('Game already started, showing mobile controls immediately');
                this.input.showMobileControls();
            }
        }
        
        // Set up network event listeners using V2 event system
        const network = this.engine.systems.get('network');
        network.on('connected', (data) => {
            if (data && data.id) {
                this.createLocalPlayer(data.id);
            }
        });
        
        network.on('player_join', (data) => {
            this.createNetworkPlayer(data);
        });
        
        network.on('player_leave', (data) => {
            this.removePlayer(data.id);
        });
        
        network.on('player_update', (data) => {
            this.updateNetworkPlayer(data);
        });
        
        console.log("Player system initialized");
    }

    _update(delta) {
      if (!this.localPlayer) return;
      
      if (this.isTransitioning) {
          this.updateTransition(delta);
          return;
      }
      
      // Update subsystems
      this.input.handleInput(delta);
      this.physics.updatePhysics(delta);
      this.models.updateModels();
      this.spells.updateSpells(delta);
      
      // Check for mana collection
      this.checkManaCollection();
      
      // Update camera to follow player
      this.updateCamera();
      
      // Check world boundaries
      this.checkWorldBoundaries();
      
      // Send player updates to network
      this.sendPlayerUpdate();
  }


  
   createLocalPlayer(id) {
        // Get a carpet model with the player ID for consistent color
        const carpetModel = this.models.createCarpetModel(id);
        
        // Create player object with enhanced properties
        const player = {
            id,
            isLocal: true,
            model: carpetModel,
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
        
        // Add carpet model to scene
        carpetModel.position.copy(player.position);
        carpetModel.castShadow = false;
        this.scene.add(carpetModel);
        
        // Store the player
        this.players.set(id, player);
        this.localPlayer = player;
        
        // Setup subsystems for local player
        this.input.setupInput();
        this.models.createCrosshair();
        this.updateCamera();
        
        console.log(`Local player created with ID: ${id}`);
    }

  createNetworkPlayer(data) {
    // Don't create duplicate players
    if (this.players.has(data.id)) {
      return;
    }
    
    // Get a carpet model with the player ID for consistent color
    const carpetModel = this.models.createCarpetModel(data.id);
    
    // Create player object
    const player = {
      id: data.id,
      isLocal: false,
      model: carpetModel,
      position: new THREE.Vector3(data.x || 0, data.y || 20, data.z || 0),
      rotation: new THREE.Euler(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mana: 0,
      health: 100,
      maxHealth: 100
    };
    
    // Add carpet model to scene
    carpetModel.position.copy(player.position);
    carpetModel.castShadow = false; // Disable carpet shadow completely
    this.scene.add(carpetModel);
    
    // Store the player
    this.players.set(data.id, player);
    
    console.log(`Network player created with ID: ${data.id}`);
  }
  
  removePlayer(id) {
    const player = this.players.get(id);
    if (player) {
      // Remove model from scene
      this.scene.remove(player.model);
      
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
  
  updateCamera() {
    if (!this.localPlayer) return;
    
    const isMobile = this.engine.input.isTouchDevice;
    
    let cameraOffset, lookAheadDistance;
    
    if (isMobile) {
        cameraOffset = new THREE.Vector3(0, 12, -20);
        lookAheadDistance = new THREE.Vector3(0, 3, 30);
    } else {
        cameraOffset = new THREE.Vector3(0, 10, -25);
        lookAheadDistance = new THREE.Vector3(0, 5, 25);
    }
    
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(
        this.localPlayer.rotation.x,
        this.localPlayer.rotation.y,
        0,
        'YXZ'
    ));
    
    const rotatedOffset = cameraOffset.clone().applyQuaternion(quaternion);
    const rotatedLookAhead = lookAheadDistance.clone().applyQuaternion(quaternion);
    
    const targetCameraPos = this.localPlayer.position.clone().add(rotatedOffset);
    this.engine.camera.position.lerp(targetCameraPos, 0.1);
    
    const lookTarget = this.localPlayer.position.clone().add(rotatedLookAhead);
    this.engine.camera.lookAt(lookTarget);
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
  
  update(delta) {
    if (!this.localPlayer) return;
    
    if (this.isTransitioning) {
      this.updateTransition(delta);
      return;
    }
    
    // Update subsystems
    this.input.handleInput(delta);
    this.physics.updatePhysics(delta);
    this.models.updateModels();
    this.spells.updateSpells(delta);
    
    // Check for mana collection
    this.checkManaCollection();
    
    // Update camera to follow player
    this.updateCamera();
    
    // Check world boundaries
    this.checkWorldBoundaries();
    
    // Send player updates to network
    this.sendPlayerUpdate();
  }
  
  checkManaCollection() {
    if (!this.localPlayer) return;
    
    const radius = 5;
    const worldSystem = this.engine.systems.get('world');
    const uiSystem = this.engine.systems.get('ui');
    
    const collectedNodes = worldSystem.checkManaCollection(
        this.localPlayer.position,
        radius
    );
    
    collectedNodes.forEach(node => {
        this.localPlayer.mana += node.value;
        
        if (uiSystem) {
            uiSystem.updateManaDisplay(this.localPlayer.mana);
        }
        
        this.models.createManaCollectionEffect(node.position);
    });
}

}
