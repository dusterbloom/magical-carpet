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
import { useGameState, GameStates } from '../state/gameState.js';


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
    this.performanceMetrics = {
      fps: [],
      frameTime: [],
      triangleCount: [],
      drawCalls: []
    };
    
    // Create performance monitor
    this.performanceMonitor = new PerformanceMonitor();
    
    // Create settings but do NOT add it to systems list
    this.settings = new Settings();

    // Create core managers
    this.input = new InputManager();
    this.assets = new AssetManager();
    
    // Detect device capabilities
    this.isMobile = this._detectDeviceCapabilities();
    
    // Create renderer with platform-specific optimizations
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isMobile, // Disable expensive AA on mobile
      powerPreference: "high-performance",
      precision: this.isMobile ? "mediump" : "highp", // Lower precision on mobile
      depth: true,
      stencil: false, // Disable stencil buffer if not needed
      alpha: false, // Optimize for opaque background
      premultipliedAlpha: true,
      preserveDrawingBuffer: false, // Performance optimization
      logarithmicDepthBuffer: false // Enable only if z-fighting occurs
    });

    this.frameScheduled = false;
    this.lastFrameTime = 0;
    this.targetFrameTime = 1000 / 60; // Target 30fps on mobile
    this.gcInterval = 30000; // 30 seconds
    this.lastGC = 0;
    
    // Common renderer settings
    this.renderer.setClearColor(0x88ccff);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    THREE.ColorManagement.enabled = true;
    

    if (this.input.isTouchDevice) {
      // Disable pointer lock behaviors on touch devices
      this.input.pointerLockEnabled = false;
      
      // Add touch-specific styles
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      
      // Prevent unwanted browser behaviors
      document.addEventListener('touchmove', (e) => {
        e.preventDefault();
      }, { passive: false });
      
      // Prevent double-tap zoom
      let lastTap = 0;
      document.addEventListener('touchend', (e) => {
        const curTime = new Date().getTime();
        const tapLen = curTime - lastTap;
        if (tapLen < 500 && tapLen > 0) {
          e.preventDefault();
        }
        lastTap = curTime;
      });
    }
    
    // Platform-specific renderer settings
    if (this.isMobile) {


      // Mobile-optimized configuration
      const pixelRatio = this.deviceCapabilities.gpuTier === 'low' ? 
        Math.min(window.devicePixelRatio, 1.0) : // Low-end: cap at 1.0
        Math.min(window.devicePixelRatio, 1.5);  // Mid/high: cap at 1.5
        
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      
      // Mobile tone mapping (less expensive)
      this.renderer.toneMapping = THREE.ReinhardToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      
      // Optimized shadow maps for mobile
      this.renderer.shadowMap.enabled = this.deviceCapabilities.gpuTier !== 'low';
      if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.type = THREE.BasicShadowMap; // Fastest shadow map
        this.renderer.shadowMap.autoUpdate = false; // Manual shadow updates only
      }
    } else {
      // Desktop-optimized configuration
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      
      // Higher quality desktop settings
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      
      // High quality shadows for desktop
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
    
    // Add frame timing variables
    this._frameSkipAccumulator = 0;
    this._shadowUpdateCounter = 0;
    this._frameCounter = 0;
  }

  // Device capability detection method
  _detectDeviceCapabilities() {
    // Create detailed device profile
    this.deviceCapabilities = {
      isMobile: /(android|iphone|ipad|ipod|blackberry|windows phone)/g.test(navigator.userAgent.toLowerCase()),
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      gpuTier: 'unknown',
      memoryLimited: false,
      supportsShadowMapType: true,
      supportsFloatTextures: true,
      maxTextureSize: 4096
    };
    
    // Use feature detection where possible
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        // Check max texture size
        this.deviceCapabilities.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        
        // Check if float textures are supported
        const ext = gl.getExtension('OES_texture_float');
        this.deviceCapabilities.supportsFloatTextures = !!ext;
        
        // Check for depth texture support
        const depthTextureExt = gl.getExtension('WEBGL_depth_texture');
        this.deviceCapabilities.supportsDepthTexture = !!depthTextureExt;
        
        // Check available memory (for some browsers)
        if (gl.getExtension('WEBGL_debug_renderer_info')) {
          const renderer = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);
          const vendor = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_VENDOR_WEBGL);
          
          console.log(`WebGL Renderer: ${renderer}, Vendor: ${vendor}`);
          
          // Detect low-end GPUs
          const lowerCaseRenderer = renderer.toLowerCase();
          if (
            lowerCaseRenderer.includes('intel') && 
            !lowerCaseRenderer.includes('iris') && 
            !lowerCaseRenderer.includes('uhd')
          ) {
            this.deviceCapabilities.gpuTier = 'low';
            this.deviceCapabilities.memoryLimited = true;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to detect WebGL capabilities:', e);
    }
    
    // More detailed mobile device classification
    if (this.deviceCapabilities.isMobile) {
      // Get more specific mobile info
      const ua = navigator.userAgent.toLowerCase();
      
      // Check for high-end indicators
      if (
        ua.includes('iphone 13') || ua.includes('iphone 14') || ua.includes('iphone 15') ||
        ua.includes('ipad pro') || ua.includes('sm-s') || ua.includes('sm-n') ||
        ua.includes('pixel 6') || ua.includes('pixel 7') || ua.includes('pixel 8')
      ) {
        this.deviceCapabilities.gpuTier = 'high';
      }
      // Check for low-end indicators
      else if (
        ua.includes('sm-j') || ua.includes('sm-a') || ua.includes('redmi') || 
        ua.includes('mediatek') || ua.includes('wiko') || ua.includes('nokia')
      ) {
        this.deviceCapabilities.gpuTier = 'low';
        this.deviceCapabilities.memoryLimited = true;
      }
      // Mid-level is the default for unrecognized devices
      else {
        this.deviceCapabilities.gpuTier = 'medium';
      }
      
      // Limit texture size on mobile (prevents memory issues)
      this.deviceCapabilities.maxTextureSize = 
        this.deviceCapabilities.gpuTier === 'high' ? 4096 :
        this.deviceCapabilities.gpuTier === 'medium' ? 2048 : 1024;
      
      console.log(`Mobile device GPU classification: ${this.deviceCapabilities.gpuTier}, ` +
                  `maxTextureSize: ${this.deviceCapabilities.maxTextureSize}`);
    } else {
      // Desktop detection
      this.deviceCapabilities.gpuTier = 'high';
      // Check for WebGL capabilities
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          // Check max texture size
          this.deviceCapabilities.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
          // Check if float textures are supported
          const ext = gl.getExtension('OES_texture_float');
          this.deviceCapabilities.supportsFloatTextures = !!ext;
        }
      } catch (e) {
        console.warn('Failed to detect WebGL capabilities:', e);
      }
    }
    
    return this.deviceCapabilities.isMobile;
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

    // After systems are initialized, apply material optimizations
    this.optimizeMaterials();

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
    
    // Show intro screen and transition to INTRO state
    this.introScreen.show();
    useGameState.getState().setGameState(GameStates.INTRO);



    console.log("Engine initialized successfully");
    console.log('Device Info:', {
      userAgent: navigator.userAgent,
      deviceMemory: navigator.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio: window.devicePixelRatio
    });
  }

  animate(timestamp) {
    if (!this.isRunning) return;

    requestAnimationFrame(this.animate.bind(this));

    // Skip updates if tab is not visible
    if (!this.isVisible) return;

    // Calculate delta time and cap it to prevent huge jumps
    this.delta = Math.min(this.clock.getDelta(), this.maxDeltaTime);
    this.elapsed = this.clock.getElapsedTime();
    
    // Mobile optimizations for lower frame rates
    if (this.isMobile && this.deviceCapabilities.gpuTier === 'low') {
      // Target 30fps on low-end devices (skip frames if needed)
      const targetFrameTime = 1/30;
      if (this._frameSkipAccumulator < targetFrameTime) {
        this._frameSkipAccumulator += this.delta;
        
        // Still update player controls for responsiveness, but skip everything else
        if (this.systems.player) {
          const startTime = performance.now();
          this.systems.player.update(this.delta, this.elapsed);
          const endTime = performance.now();
          this.performanceMonitor.addSystemTime("player", endTime - startTime);
        }
        
        // Skip remaining updates and rendering
        return;
      }
      
      // Reset accumulator and proceed with full update
      this._frameSkipAccumulator = 0;
    }

    // Update systems in correct order with performance monitoring
    const updateOrder = [
      "network",
      "mobileLOD",
      "world",
      "water",
      "vegetation",
      "player",
      "atmosphere",
      "carpetTrail",
      "landmarks",
      "ui",
      "minimap"
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
    

    // Update shadow maps only when needed (improves mobile performance)
    if (this.renderer.shadowMap.enabled) {
      // Only update shadows every N frames on mobile
      const shadowUpdateInterval = this.isMobile ? 
        (this.deviceCapabilities.gpuTier === 'low' ? 15 : 5) : 1;
      
      if (this._shadowUpdateCounter % shadowUpdateInterval === 0) {
        this.renderer.shadowMap.needsUpdate = true;
      } else {
        this.renderer.shadowMap.needsUpdate = false;
      }
      
      this._shadowUpdateCounter++;
    }
    
    // Run frustum culling optimizations
    if (this.systems.world && this.systems.world.updateVisibility) {
      this.systems.world.updateVisibility(this.camera);
    }
    
    // Standard rendering with performance monitoring
    const renderStartTime = performance.now();
    
    // Add renderer optimizations before render
    this._optimizeBeforeRender();
    
    // Perform the actual render
    this.renderer.render(this.scene, this.camera);
    
    // Clean up after render
    this._cleanupAfterRender();
    
    const renderEndTime = performance.now();
    this.performanceMonitor.addSystemTime("render", renderEndTime - renderStartTime);
    
    // Update performance monitor
    this.performanceMonitor.update(this.renderer, this);
    
    // Check if performance requires adjusting quality settings (only occasional checks)
    if (this.settings && this.isMobile && this._frameCounter % 120 === 0) {
      const report = this.performanceMonitor.generateReport();
      if (this.settings.updateFromPerformance(report)) {
        console.log('Performance-based quality adjustments applied');
      }
    }
    
    // Update frame counter
    this._frameCounter++;

    // Update stats if available (dev only)
    if (this.stats) this.stats.update();
  }


  checkMemory(timestamp) {
    if (timestamp - this.lastGC > this.gcInterval) {
      // Force garbage collection of unused assets
      this.systems.assetManager.cleanupUnusedAssets();
      this.lastGC = timestamp;
    }
  }

  // Optimize state before rendering
  _optimizeBeforeRender() {
    // Limit active lights for mobile devices
    if (this.isMobile && this.scene) {
      let activeLights = 0;
      const maxLights = this.deviceCapabilities.gpuTier === 'low' ? 2 : 
                      this.deviceCapabilities.gpuTier === 'medium' ? 3 : 4;
                    
      // Only process if player exists (get position for distance sorting)
      const playerPos = this.systems.player && this.systems.player.localPlayer ? 
        this.systems.player.localPlayer.position : null;
      
      if (playerPos) {
        // Collect and sort lights by importance/distance
        const lights = [];
        this.scene.traverse((object) => {
          if (object.isLight && object.visible) {
            // Calculate distance or importance score
            const distance = playerPos.distanceTo(object.position);
            const importance = object.intensity * (1 / (1 + distance * 0.01));
            lights.push({ light: object, importance, distance });
          }
        });
        
        // Sort by importance (higher = more important)
        lights.sort((a, b) => b.importance - a.importance);
        
        // Disable less important lights temporarily
        for (let i = 0; i < lights.length; i++) {
          const lightData = lights[i];
          if (i < maxLights) {
            lightData.light._wasEnabled = lightData.light.visible;
            lightData.light.visible = true;
            activeLights++;
          } else {
            lightData.light._wasEnabled = lightData.light.visible;
            lightData.light.visible = false;
          }
        }
      }
    }
    
    // Apply any additional pre-render optimizations
    if (this.isMobile && this.deviceCapabilities.gpuTier === 'low') {
      // For very low-end devices, disable some visual effects temporarily
      if (this.systems.atmosphere && this.systems.atmosphere.setEffectsEnabled) {
        this.systems.atmosphere._effectsWereEnabled = this.systems.atmosphere.effectsEnabled;
        this.systems.atmosphere.setEffectsEnabled(false);
      }
    }
  }

  // Clean up after rendering
  _cleanupAfterRender() {
    // Restore lights that were temporarily modified
    if (this.isMobile && this.scene) {
      this.scene.traverse((object) => {
        if (object.isLight && object._wasEnabled !== undefined) {
          object.visible = object._wasEnabled;
          delete object._wasEnabled;
        }
      });
    }
    
    // Restore any other temporary render state changes
    if (this.isMobile && this.deviceCapabilities.gpuTier === 'low') {
      if (this.systems.atmosphere && this.systems.atmosphere._effectsWereEnabled !== undefined) {
        this.systems.atmosphere.setEffectsEnabled(this.systems.atmosphere._effectsWereEnabled);
        delete this.systems.atmosphere._effectsWereEnabled;
      }
    }
  }

  logPerformanceMetrics() {
    const metrics = {
      fps: this.calculateAverageFPS(),
      frameTime: this.systems.mobileLOD.getAverageFrameTime(),
      triangles: this.renderer.info.render.triangles,
      drawCalls: this.renderer.info.render.calls,
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize / 1048576,
        total: performance.memory.totalJSHeapSize / 1048576
      } : 'unavailable'
    };

    console.log('Performance Metrics:', metrics);
  }
  // Material optimization utilities
  // Ensure scene exists before attempting optimization
  optimizeMaterials() {
    if (!this.scene) {
      console.warn('Cannot optimize materials: scene not initialized');
      return;
    }
    // Material optimization constants
    const LOW_QUALITY_SETTINGS = {
      aoMapIntensity: 0.5,
      displacementScale: 0,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.8,
      metalness: 0.2,
      envMapIntensity: 0.5,
      flatShading: true
    };
    
    const MID_QUALITY_SETTINGS = {
      aoMapIntensity: 0.7,
      displacementScale: 0,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.7,
      metalness: 0.3,
      envMapIntensity: 0.7,
      flatShading: false
    };
    
    // Apply quality settings based on device tier
    const qualitySettings = this.isMobile ? 
      (this.deviceCapabilities.gpuTier === 'low' ? LOW_QUALITY_SETTINGS : MID_QUALITY_SETTINGS) : 
      null; // Don't modify materials on desktop
    
    if (!qualitySettings) return;
    
    // Collect all materials
    const materials = [];
    this.scene.traverse((node) => {
      if (node.material) {
        if (Array.isArray(node.material)) {
          materials.push(...node.material);
        } else {
          materials.push(node.material);
        }
      }
    });
    
    // Apply optimizations to standard materials
    for (const material of materials) {
      if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
        // Apply quality reductions for expensive materials
        if (material.aoMap) material.aoMapIntensity = qualitySettings.aoMapIntensity;
        if (material.normalMap) material.normalScale.copy(qualitySettings.normalScale);
        if (material.displacementMap) material.displacementScale = qualitySettings.displacementScale;
        
        material.roughness = qualitySettings.roughness;
        material.metalness = qualitySettings.metalness;
        material.envMapIntensity = qualitySettings.envMapIntensity;
        material.flatShading = qualitySettings.flatShading;
        
        // Force material update
        material.needsUpdate = true;
      }
    }
    
    console.log(`Applied material optimizations for ${materials.length} materials`);
  }

  // Update onResize method to include proper updating of frustum culling
  onResize() {
    // Update camera
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    // Update renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Force frustum culling update
    if (this.systems.world && this.systems.world.updateVisibility) {
      this.systems.world.updateVisibility(this.camera);
    }
  }


  // onVisibilityChange is missing but required by the constructor
  onVisibilityChange() {
    this.isVisible = document.visibilityState === 'visible';
    console.log(`Visibility changed: ${this.isVisible ? 'visible' : 'hidden'}`);
  }
}

