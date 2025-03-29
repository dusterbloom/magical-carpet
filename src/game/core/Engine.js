// Updated imports to include new systems
import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";
import { InputManager } from "./InputManager";
import { AssetManager } from "./AssetManager";
import { NetworkManager } from "../systems/NetworkManager";
import { WorldSystem } from "../systems/WorldSystem";
import { PlayerSystem } from "../systems/PlayerSystem";
import { UISystem } from "../systems/UISystem";
// Import new systems
import { VegetationSystem } from "../systems/VegetationSystem";
import { AtmosphereSystem } from "../systems/AtmosphereSystem";
// WaterSystem removed
import { CarpetTrailSystem } from "../systems/CarpetTrailSystem";
import { LandmarkSystem } from "../systems/LandmarkSystem";
import { MinimapSystem } from "../systems/MinimapSystem";
// ShorelineEffect removed


export class Engine {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.clock = new THREE.Clock();
    this.delta = 0;
    this.elapsed = 0;
    this.systems = {};
    this.isRunning = false;
    this.isVisible = true;
    this.maxDeltaTime = 1/15; // Cap at 15 FPS equivalent
    this.devicePixelRatio = Math.min(window.devicePixelRatio, 2);

    // Create core managers
    this.input = new InputManager();
    this.assets = new AssetManager();

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x88ccff);
    this.renderer.setPixelRatio(this.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Create main scene and camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    // Performance monitoring in development
    if (import.meta.env.DEV) {
      this.stats = new Stats();
      document.body.appendChild(this.stats.dom);
    }

    // Event listeners
    window.addEventListener("resize", this.onResize.bind(this));
    
    // Handle visibility changes
    document.addEventListener("visibilitychange", this.onVisibilityChange.bind(this));
  }

  async initialize() {
    // Initialize all core systems
    await this.assets.initialize();

    // Create systems in correct order (dependencies first)
    this.systems.network = new NetworkManager(this);
    this.systems.world = new WorldSystem(this);
    // Water system removed
    this.systems.vegetation = new VegetationSystem(this);
    this.systems.atmosphere = new AtmosphereSystem(this);
    this.systems.player = new PlayerSystem(this);
    this.systems.ui = new UISystem(this);
    this.systems.carpetTrail = new CarpetTrailSystem(this);
    this.systems.landmarks = new LandmarkSystem(this);
    this.systems.minimap = new MinimapSystem(this);
    // ShorelineEffect removed


    // Define initialization order (some systems depend on others)
    const initOrder = [
      "network",
      "world", // Base terrain must be initialized first
      // Water system removed
      "vegetation", // Vegetation needs terrain to place trees
      "atmosphere", // Atmosphere enhances the sky and adds clouds
      "player", // Player needs terrain for physics
      "ui", // UI needs player for HUD elements
      "carpetTrail", // Trail system needs player
      "landmarks",   // Landmarks need world and player
      "minimap"    // Minimap needs world and player info
    ];

    // Initialize systems in order
    for (const systemName of initOrder) {
      const system = this.systems[systemName];
      if (system) {
        await system.initialize();
        console.log(`System initialized: ${systemName}`);
      }
    }

    // Set up event handling
    this.input.initialize();

    // Hide loading screen
    document.getElementById("loading").style.display = "none";

    // Start game loop
    this.isRunning = true;
    this.animate();

    console.log("Engine initialized successfully");
  }

  animate() {
    if (!this.isRunning) return;

    requestAnimationFrame(this.animate.bind(this));

    // Skip updates if tab is not visible
    if (!this.isVisible) return;

    // Calculate delta time and cap it to prevent huge jumps
    this.delta = Math.min(this.clock.getDelta(), this.maxDeltaTime);
    this.elapsed = this.clock.getElapsedTime();

    // Update systems in correct order
    const updateOrder = [
      "network",
      "world",
      // Water system removed
      "vegetation",
      "atmosphere",
      "player",
      "carpetTrail", // Update trail after player movement
      "landmarks",   // Update landmarks
      "ui",
      "minimap"    // Update minimap last to capture all world changes
    ];

    // Update systems
    for (const systemName of updateOrder) {
      const system = this.systems[systemName];
      if (system && typeof system.update === "function") {
        system.update(this.delta, this.elapsed);
      }
    }

  // Standard rendering - ShorelineEffect removed
  this.renderer.render(this.scene, this.camera);

  // Update stats if available
  if (this.stats) this.stats.update();
}


onResize() {
  // Update camera
  this.camera.aspect = window.innerWidth / window.innerHeight;
  this.camera.updateProjectionMatrix();

  // Update renderer
  this.renderer.setSize(window.innerWidth, window.innerHeight);
  
  // ShorelineEffect removed
}
  
  onVisibilityChange() {
    this.isVisible = document.visibilityState === 'visible';
    
    if (this.isVisible) {
      // Reset clock to prevent large delta time spikes
      this.clock.start();
      
      // Reset or repair critical systems when tab regains focus
      this.resetSystems();
      
      console.log('Game visibility restored');
    } else {
      console.log('Game visibility lost');
    }
  }
  
  resetSystems() {
    // Reset trail system which is causing errors
    if (this.systems.carpetTrail) {
      this.systems.carpetTrail.resetTrail();
    }
    
    // Allow other systems to handle visibility changes if they implement the method
    for (const systemName in this.systems) {
      const system = this.systems[systemName];
      if (system && typeof system.handleVisibilityChange === 'function') {
        system.handleVisibilityChange(true);
      }
    }
  }
}
