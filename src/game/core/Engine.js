// Updated imports to include new systems
import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";
import { InputManager } from "./InputManager";
import { AssetManager } from "./AssetManager";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { Settings } from "./settings/Settings";
import { MobileLODManager } from "./MobileLODManager";
import { NetworkManager } from "../systems/NetworkManager";
import { WorldSystem } from "../systems/WorldSystem";
import { PlayerSystem } from "../systems/PlayerSystem";
import { UISystem } from "../systems/UISystem";
// Import new systems
import { VegetationSystem } from "../systems/VegetationSystem";
import { AtmosphereSystem } from "../systems/atmosphere-integration";
import { WaterSystem } from "../systems/WaterSystem";
import { CarpetTrailSystem } from "../systems/CarpetTrailSystem";
import { LandmarkSystem } from "../systems/LandmarkSystem";
import { MinimapSystem } from "../systems/MinimapSystem";
import { IntroScreen } from "../ui/screens/IntroScreen";

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
    this.gameStarted = false; // Flag to track if the game has started
    
    // Create performance monitor
    this.performanceMonitor = new PerformanceMonitor();
    
    // Create settings but do NOT add it to systems list
    this.settings = new Settings();

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
    this.systems.mobileLOD = new MobileLODManager(this);
    this.systems.world = new WorldSystem(this);
    this.systems.water = new WaterSystem(this);
    this.systems.vegetation = new VegetationSystem(this);
    this.systems.player = new PlayerSystem(this);      // Player BEFORE atmosphere to avoid dependency issues
    this.systems.atmosphere = new AtmosphereSystem(this);
    this.systems.ui = new UISystem(this);
    this.systems.carpetTrail = new CarpetTrailSystem(this);
    this.systems.landmarks = new LandmarkSystem(this);
    this.systems.minimap = new MinimapSystem(this);
    // Settings is already initialized in the constructor, not a system
    // ShorelineEffect removed


    // Define initialization order (some systems depend on others)
    const initOrder = [
      
      "network",
      "mobileLOD", // Initialize LOD manager first to prepare for other systems
      "world", // Base terrain must be initialized first
      "water", // Water system should be initialized after terrain
      "vegetation", // Vegetation needs terrain to place trees
      "player", // Player needs terrain for physics
      "atmosphere", // Atmosphere now initialized AFTER player
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
    
    // Initialize intro screen
    this.introScreen = new IntroScreen(this);
    
    // Set callback for when play button is clicked
    this.introScreen.onPlay(() => {
      console.log("Game started from intro screen");
      this.gameStarted = true;
    });
    
    // Show intro screen
    this.introScreen.show();

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
      "mobileLOD", // Update LOD manager first to adapt to performance
      "world",
      "water",
      "vegetation",
      "player",     // Player now updated BEFORE atmosphere
      "atmosphere", 
      "carpetTrail", // Update trail after player movement
      "landmarks",   // Update landmarks
      "ui",
      "minimap"    // Update minimap last to capture all world changes
    ];

    // Update systems with performance monitoring
    for (const systemName of updateOrder) {
      const system = this.systems[systemName];
      if (system && typeof system.update === "function") {
        const startTime = performance.now();
        system.update(this.delta, this.elapsed);
        const endTime = performance.now();
        this.performanceMonitor.addSystemTime(systemName, endTime - startTime);
      }
    }

    // Standard rendering with performance monitoring
    const renderStartTime = performance.now();
    this.renderer.render(this.scene, this.camera);
    const renderEndTime = performance.now();
    this.performanceMonitor.addSystemTime("render", renderEndTime - renderStartTime);
    
    // Update performance monitor
    this.performanceMonitor.update(this.renderer, this);
    
    // Check if performance requires adjusting quality settings - only on mobile
    if (this.settings && this.settings.isMobile && Math.floor(this.elapsed) % 5 === 0) {
      const report = this.performanceMonitor.generateReport();
      if (this.settings.updateFromPerformance(report)) {
        console.log('Mobile: Performance-based quality adjustments applied');
      }
    }

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
  
  /**
   * Generates and returns a performance report
   * Call this from the browser console to get performance data
   * @returns {Object} Performance report
   */
  getPerformanceReport() {
    const report = this.performanceMonitor.generateReport();
    console.log("Performance Report:", report);
    return report;
  }
}
