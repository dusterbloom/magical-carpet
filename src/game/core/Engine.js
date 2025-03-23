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
import { WaterSystem } from "../systems/WaterSystem";
import { CarpetTrailSystem } from "../systems/CarpetTrailSystem";
import { LandmarkSystem } from "../systems/LandmarkSystem";
import { MinimapSystem } from "../systems/MinimapSystem";

export class Engine {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.clock = new THREE.Clock();
    this.delta = 0;
    this.elapsed = 0;
    this.systems = {};
    this.isRunning = false;
    this.detectDeviceCapabilities();

    // Initialize quality manager for adaptive resolution scaling
    this.qualityManager = {
      targetFPS: 60,
      currentFPS: 60,
      sampleSize: 20,
      fpsHistory: [],
      resolutionScale: 1.0,
      minResolutionScale: 0.5,
      updateInterval: 1.0, // seconds
      timeSinceLastUpdate: 0
    };

    this.isVisible = true;

    this.maxDeltaTime = 1/15; // Cap at 15 FPS equivalent
    this.devicePixelRatio = Math.min(window.devicePixelRatio, 2);

    // Create core managers
    this.input = new InputManager();
    this.assets = new AssetManager();

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isMobile, // Disable antialiasing on mobile
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x88ccff);
    this.renderer.setPixelRatio(this.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Optimized renderer configuration
    this.renderer.powerPreference = "high-performance";
    this.renderer.logarithmicDepthBuffer = false;  // Disable for performance
    
    // Device-specific optimizations
    if (this.isMobile) {
      this.renderer.precision = "mediump";  // Use medium precision on mobile
      this.renderer.shadowMap.enabled = false;  // Disable on mobile
      this.renderer.shadowMap.autoUpdate = false;  // Disable dynamic shadows
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

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
    this.systems.water = new WaterSystem(this);
    this.systems.vegetation = new VegetationSystem(this);
    this.systems.atmosphere = new AtmosphereSystem(this);
    this.systems.player = new PlayerSystem(this);
    this.systems.ui = new UISystem(this);
    this.systems.carpetTrail = new CarpetTrailSystem(this);
    this.systems.landmarks = new LandmarkSystem(this);
    this.systems.minimap = new MinimapSystem(this);

    // Define initialization order (some systems depend on others)
    const initOrder = [
      "network",
      "world", // Base terrain must be initialized first
      "water", // Water depends on world terrain
      "vegetation", // Vegetation needs terrain to place trees
      "atmosphere", // Atmosphere enhances the sky and adds clouds
      "player", // Player needs terrain for physics
      "ui", // UI needs player for HUD elements
      "carpetTrail", // Trail system needs player
      "landmarks",   // Landmarks need world and player
      "minimap",    // Minimap needs world and player info
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
    
    // Update quality settings based on performance
    this.updateQuality(this.delta);

    // Update systems in correct order
    const updateOrder = [
      "network",
      "world",
      "water",
      "vegetation",
      "atmosphere",
      "player",
      "carpetTrail", // Update trail after player movement
      "landmarks",   // Update landmarks
      "ui",
      "minimap",    // Update minimap last to capture all world changes
    ];

    // Update systems
    for (const systemName of updateOrder) {
      const system = this.systems[systemName];
      if (system && typeof system.update === "function") {
        system.update(this.delta, this.elapsed);
      }
    }

    // Render scene
    this.renderer.render(this.scene, this.camera);

    // Update stats if available
    if (this.stats) this.stats.update();
  }

  detectDeviceCapabilities() {
    // Detect device type and capabilities
    const userAgent = navigator.userAgent.toLowerCase();
    this.isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
    this.isTablet = this.isMobile && Math.min(window.innerWidth, window.innerHeight) > 600;
    
    console.log('Device Detection:', {
      isMobile: this.isMobile,
      isTablet: this.isTablet,
      pixelRatio: window.devicePixelRatio,
      screenSize: `${window.innerWidth}x${window.innerHeight}`
    });
    
    // Apply tablet-specific optimizations if needed
    if (this.isTablet) {
      // Key optimization 1: Reduce device pixel ratio
      this.devicePixelRatio = Math.min(window.devicePixelRatio, 1);
      
      // Key optimization 2: Reduce renderer quality
      this.reduceRendererQuality = true;
      
      // Key optimization 3: Reduce terrain resolution
      this.terrainResolution = 64; // Lower than desktop
      
      // Key optimization 4: Limit view distance
      this.viewDistance = 500;
      
      console.log('Applied tablet performance optimizations');
    } else if (this.isMobile) {
      // Even more aggressive optimizations for phones
      this.devicePixelRatio = 1;
      this.reduceRendererQuality = true;
      this.terrainResolution = 48; 
      this.viewDistance = 300;
      console.log('Applied mobile performance optimizations');
    } else {
      // Desktop settings (unchanged)
      this.devicePixelRatio = Math.min(window.devicePixelRatio, 2);
      this.reduceRendererQuality = false;
      this.terrainResolution = 128;
      this.viewDistance = 2000;
    }
  }
  
  onResize() {
    // Update camera
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    // Update renderer with current resolution scale
    this.updateRendererResolution();
  }
  
  // Adaptive resolution scaling methods
  updateQuality(delta) {
    const { qualityManager } = this;
    
    // Calculate current FPS
    const fps = 1 / delta;
    qualityManager.fpsHistory.push(fps);
    
    // Keep history to sample size
    if (qualityManager.fpsHistory.length > qualityManager.sampleSize) {
      qualityManager.fpsHistory.shift();
    }
    
    // Only update periodically
    qualityManager.timeSinceLastUpdate += delta;
    if (qualityManager.timeSinceLastUpdate < qualityManager.updateInterval) return;
    
    // Reset timer
    qualityManager.timeSinceLastUpdate = 0;
    
    // Calculate average FPS
    const avgFPS = qualityManager.fpsHistory.reduce((a, b) => a + b, 0) / 
                  qualityManager.fpsHistory.length;
    qualityManager.currentFPS = avgFPS;
    
    // Adjust resolution if FPS is too low
    if (avgFPS < qualityManager.targetFPS * 0.8) {
      // Reduce resolution by 10%
      qualityManager.resolutionScale = Math.max(
        qualityManager.minResolutionScale,
        qualityManager.resolutionScale * 0.9
      );
      
      // Apply new resolution
      this.updateRendererResolution();
      console.log(`Performance: Decreasing resolution to ${qualityManager.resolutionScale.toFixed(2)}`);
    } 
    // Increase resolution if FPS is high enough
    else if (avgFPS > qualityManager.targetFPS * 1.1 && qualityManager.resolutionScale < 1.0) {
      // Increase resolution by 5%
      qualityManager.resolutionScale = Math.min(
        1.0,
        qualityManager.resolutionScale * 1.05
      );
      
      // Apply new resolution
      this.updateRendererResolution();
      console.log(`Performance: Increasing resolution to ${qualityManager.resolutionScale.toFixed(2)}`);
    }
  }
  
  updateRendererResolution() {
    const width = window.innerWidth * this.qualityManager.resolutionScale;
    const height = window.innerHeight * this.qualityManager.resolutionScale;
    
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
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
