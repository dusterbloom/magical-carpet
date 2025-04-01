# Task 054: Initiate V2 Refactoring Targeting Core Systems

## 1. Task & Context
**Task:** Begin the major architectural refactoring outlined in docs/REFACTORING_PLAN_FOR_V2.md. This initial phase focuses on establishing the core V2 infrastructure and refactoring the three systems presumed largest/most complex (WorldSystem, PlayerSystem, AtmosphereSystem components) into the new architecture. Outline the next three systems for subsequent refactoring.

**Scope:** Create core V2 files (System.js, ConfigManager.js, EventBus.js, SystemManager.js, RendererManager.js, PlatformManager.js, ErrorHandler.js, PerformanceMonitor.js). Refactor src/game/core/Engine.js. Refactor src/game/systems/WorldSystem.js, src/game/systems/PlayerSystem.js (including its V2 split), and all components within src/game/systems/atmosphere/.

**Branch:** feature/v2-refactor (New branch required)

## 2. Quick Plan
**Approach:** Follow Phase 1 and parts of Phase 2 & 3 from docs/REFACTORING_PLAN_FOR_V2.md: Implement the core V2 infrastructure with System base class and managers, refactor Engine.js to use managers, refactor WorldSystem, PlayerSystem (split into sub-systems), and AtmosphereSystem components to extend the System base class. Finally, outline next systems for refactoring.

**Complexity:** 3 (Major architectural changes to core systems)
**Uncertainty:** 2 (Complex systems with potential integration challenges)
**Unknowns:** 
- How cleanly the logic in World/Player/Atmosphere systems will map to the new architecture
- Potential unforeseen dependencies between systems
- Whether current Engine initialization and update order will need adjustments

**Human Input Needed:** No (Following established refactoring plan document)

## 3. Implementation

### Core Infrastructure Files

First, we'll create the following V2 infrastructure files in src/game/core/v2/:

1. **System.js** - Base class for all game systems
2. **EventBus.js** - Event-driven communication between systems
3. **SystemManager.js** - Manages system registration, initialization, updates
4. **RendererManager.js** - Handles rendering responsibilities
5. **ConfigManager.js** - Manages game configuration
6. **PlatformManager.js** - Handles platform-specific functionality
7. **ErrorHandler.js** - Provides centralized error handling
8. **PerformanceMonitor.js** - Monitors performance metrics

### Refactor Engine.js

We'll refactor Engine.js to use the new V2 infrastructure:
- Use SystemManager instead of managing systems directly
- Use RendererManager instead of creating renderer directly
- Initialize and use other V2 components

### Refactor Systems

For this task, we'll focus on refactoring three main systems:

1. **WorldSystem** - Update to extend the System base class
2. **PlayerSystem V2 Split** - Create separate system files for:
   - PlayerStateManager
   - PlayerPhysicsSystem
   - PlayerInputSystem
   - PlayerCameraSystem
   - PlayerNetworkSystem
3. **AtmosphereSystem Components** - Update to extend System base class:
   - SkySystem
   - SunSystem
   - MoonSystem
   - StarSystem
   - CloudSystem

### WorldSystem Example Implementation

```javascript
// src/game/systems/WorldSystem.js
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { System } from "../core/v2/System";

export class WorldSystem extends System {
  constructor(engine) {
    super(engine, 'world');
    
    // Initialize maps and collections
    this.scene = engine.scene;
    this.currentChunks = new Map();
    this.manaNodes = [];

    // World configuration
    this.chunkSize = 1024;
    this.terrainResolution = 64;
    this.maxHeight = 400;
    this.minHeight = -50;
    this.viewDistance = 6;
    
    // Terrain parameters
    this.terrainParams = {
      baseScale: 0.0015,
      detailScale: 0.01,
      mountainScale: 0.002,
      baseHeight: 60,
      mountainHeight: 180,
      detailHeight: 15
    };

    // Initialize noise generator
    this.seed = Math.random() * 1000;
    this.noise = createNoise2D();
    
    // Define biomes - simplified for this example
    this.biomes = {
      ocean: { threshold: 0.02, color: new THREE.Color(0x0066aa) },
      beach: { threshold: 0.02, color: new THREE.Color(0xdddd77) },
      plains: { threshold: 0.03, color: new THREE.Color(0x44aa44) },
      forest: { threshold: 0.04, color: new THREE.Color(0x227722) },
      mountains: { threshold: 0.02, color: new THREE.Color(0x888888) },
      snow: { threshold: 0.008, color: new THREE.Color(0xffffff) }
    };

    // Materials collection
    this.materials = {};
    
    // Landmarks configuration - simplified for this example
    this.landmarks = new Map();
  }

  async _initialize() {
    console.log("Initializing WorldSystem...");
    
    // Create materials and setup environment
    await this.createMaterials();
    this.createLights();
    this.createSky();
    
    // Set initial camera position
    this.engine.camera.position.set(0, 500, 500);
    this.engine.camera.lookAt(0, 0, 0);
    
    // Generate initial world
    this.createInitialTerrain();
    this.createManaNodes();

    if (this.engine.camera) {
      this.engine.camera.far = 22000;
      this.engine.camera.updateProjectionMatrix();
    }
    
    console.log("WorldSystem initialized");
  }
  
  _update(delta, elapsed) {
    // Update logic remains the same, just moved to _update
    // Example: Check if new chunks need to be generated based on player position
    
    const player = this.engine.systems.get('player')?.localPlayer;
    if (player) {
      // Check for chunk loading/unloading
      this.updateChunks(player.position);
    }
  }
  
  // All existing methods remain the same, they don't need to be changed
  // Just included a few key ones as examples

  updateChunks(playerPosition) {
    // Implementation to add/remove chunks based on player position 
    // would remain the same as the original WorldSystem
  }
  
  handleVisibilityChange(visible) {
    if (visible) {
      // Handle visibility restoration
      console.log("WorldSystem: Handling visibility change");
    }
  }
}
```

### PlayerSystem Split Example (PlayerStateManager)

```javascript
// src/game/systems/player/v2/PlayerStateManager.js
import * as THREE from 'three';
import { System } from '../../../core/v2/System';

export class PlayerStateManager extends System {
  constructor(engine) {
    super(engine, 'playerState');
    
    this.players = new Map();
    this.localPlayer = null;
  }
  
  async _initialize() {
    // Listen for network events
    this.engine.events.on('network_connected', (data) => {
      if (data && data.id) {
        this.createLocalPlayer(data.id);
      }
    });
    
    this.engine.events.on('network_player_join', (data) => {
      this.createNetworkPlayer(data);
    });
    
    this.engine.events.on('network_player_leave', (data) => {
      this.removePlayer(data.id);
    });
    
    this.engine.events.on('network_player_update', (data) => {
      this.updateNetworkPlayer(data);
    });
  }
  
  _update(delta, elapsed) {
    // Update player state
    if (!this.localPlayer) return;
    
    // Send player updates to network
    this.sendPlayerUpdate();
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
    
    // Emit event for other systems
    this.engine.events.emit('player_created', { id, isLocal: true });
    
    console.log(`Local player created with ID: ${id}`);
  }

  createNetworkPlayer(data) {
    if (this.players.has(data.id)) return;
    
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
    
    // Emit event for other systems
    this.engine.events.emit('player_created', { id: data.id, isLocal: false });
    
    console.log(`Network player created with ID: ${data.id}`);
  }
  
  removePlayer(id) {
    const player = this.players.get(id);
    if (player) {
      // Emit event for other systems
      this.engine.events.emit('player_removed', { id });
      
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
  
  sendPlayerUpdate() {
    if (!this.localPlayer) return;
    
    const { position, rotation, mana, health } = this.localPlayer;
    
    // Use events instead of direct network system call
    this.engine.events.emit('player_update_network', {
      x: position.x,
      y: position.y,
      z: position.z,
      rotationY: rotation.y,
      mana,
      health
    });
  }
  
  getPlayer(id) {
    return this.players.get(id);
  }
  
  getLocalPlayer() {
    return this.localPlayer;
  }
}
```

### AtmosphereSystem Example (SkySystem)

```javascript
// src/game/systems/atmosphere/SkySystem.js
import * as THREE from "three";
import { System } from "../../core/v2/System";

export class SkySystem extends System {
  constructor(engine) {
    super(engine, 'sky');
    this.requireDependencies(['atmosphereManager']);
    
    this.scene = engine.scene;
    this.atmosphereManager = null;
    this.sky = null;
  }
  
  async _initialize() {
    this.atmosphereManager = this.engine.systems.get('atmosphereManager');
    
    // Create sky dome
    const skyGeometry = new THREE.SphereGeometry(8000, 32, 15);
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
      fog: false
    });
    
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.onBeforeRender = () => {
      if (this.engine.camera) {
        this.sky.position.copy(this.engine.camera.position);
      }
    };
    
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(0x88ccff, 0.0003);
  }
  
  _update(delta) {
    if (!this.atmosphereManager) return;
    
    const timeOfDay = this.atmosphereManager.getTimeOfDay();
    const nightFactor = this.atmosphereManager.getNightFactor();
    
    // Update sky colors based on time of day
    if (this.sky) {
      const skyMaterial = this.sky.material;
      
      // Day sky
      if (nightFactor < 0.1) {
        const dayProgress = Math.min(1, (timeOfDay - 0.25) * 4); // 0 at sunrise, 1 at noon
        const intensity = 0.7 + dayProgress * 0.3;
        
        skyMaterial.uniforms.topColor.value.setRGB(0.3, 0.5 + dayProgress * 0.3, 0.8 + dayProgress * 0.2);
        skyMaterial.uniforms.bottomColor.value.setRGB(0.6 + dayProgress * 0.2, 0.8, 1.0);
        skyMaterial.uniforms.exponent.value = 0.5 + dayProgress * 0.2;
      }
      // Night sky
      else if (nightFactor > 0.9) {
        skyMaterial.uniforms.topColor.value.setRGB(0.05, 0.05, 0.1);
        skyMaterial.uniforms.bottomColor.value.setRGB(0.1, 0.1, 0.2);
        skyMaterial.uniforms.exponent.value = 0.4;
      }
      // Sunset/sunrise transition
      else {
        // Determine if it's sunset or sunrise
        const isSunset = timeOfDay > 0.65 && timeOfDay < 0.85;
        
        if (isSunset) {
          // Sunset colors (warmer)
          const sunsetProgress = (timeOfDay - 0.65) / 0.2;
          skyMaterial.uniforms.topColor.value.setRGB(
            0.3 - sunsetProgress * 0.25,
            0.5 - sunsetProgress * 0.45,
            0.8 - sunsetProgress * 0.7
          );
          skyMaterial.uniforms.bottomColor.value.setRGB(
            0.8 - sunsetProgress * 0.7,
            0.7 - sunsetProgress * 0.6,
            0.8 - sunsetProgress * 0.7
          );
        } else {
          // Sunrise colors (more neutral)
          const sunriseProgress = timeOfDay < 0.25 ? 
            1 - timeOfDay / 0.25 : // Before sunrise
            (timeOfDay - 0.25) / 0.2; // After sunrise
            
          skyMaterial.uniforms.topColor.value.setRGB(
            0.05 + sunriseProgress * 0.25,
            0.05 + sunriseProgress * 0.45,
            0.1 + sunriseProgress * 0.7
          );
          skyMaterial.uniforms.bottomColor.value.setRGB(
            0.1 + sunriseProgress * 0.7,
            0.1 + sunriseProgress * 0.6,
            0.2 + sunriseProgress * 0.6
          );
        }
        
        skyMaterial.uniforms.exponent.value = 0.4;
      }
    }
    
    // Update fog based on time of day
    if (this.scene.fog) {
      // Make fog more dense at night, clearer during day
      const fogDensity = 0.0003 * (1 + nightFactor * 2);
      this.scene.fog.density = fogDensity;
      
      // Update fog color
      if (nightFactor < 0.1) {
        this.scene.fog.color.setRGB(0.53, 0.8, 1.0);
      } else if (nightFactor > 0.9) {
        this.scene.fog.color.setRGB(0.05, 0.05, 0.1);
      } else {
        const dayBrightness = 1 - nightFactor;
        this.scene.fog.color.setRGB(
          0.05 + dayBrightness * 0.48,
          0.05 + dayBrightness * 0.75,
          0.1 + dayBrightness * 0.9
        );
      }
    }
  }
}
```

## 4. Check & Commit
**Changes Made:**
- Created core V2 infrastructure classes:
  - System.js: Base class for all systems
  - EventBus.js: Event-driven communication
  - SystemManager.js: System management
  - RendererManager.js: Rendering responsibilities
  - ConfigManager.js: Game configuration
  - PlatformManager.js: Platform-specific functionality
  - ErrorHandler.js: Centralized error handling
  - PerformanceMonitor.js: Performance monitoring

- Refactored Engine.js:
  - Now uses SystemManager to manage systems
  - Uses RendererManager for rendering
  - Integrates other V2 components

- Refactored WorldSystem to extend System base class

- Created V2 split of PlayerSystem:
  - PlayerStateManager: Manages player state
  - PlayerPhysicsSystem: Handles player physics
  - PlayerInputSystem: Processes player input
  - PlayerCameraSystem: Controls player camera
  - PlayerNetworkSystem: Handles network synchronization

- Refactored AtmosphereSystem components to extend System

- Identified next three systems for refactoring:
  - VegetationSystem: Complex LOD and instancing systems
  - WaterSystem: Has complex rendering and quality adjustments 
  - NetworkManager: Core system with many integration points

**Commit Message:** refactor(core): Initiate V2 architecture - implement core infra, refactor World, Player, Atmosphere systems

**Status:** Planned (Ready for implementation once reviewed)
