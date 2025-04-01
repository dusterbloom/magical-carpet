import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";
import { InputManager } from "./InputManager";
import { AssetManager } from "./AssetManager";
import { Settings } from "./settings/Settings";

// Import V2 infrastructure
import { SystemManager } from "./v2/SystemManager";
import { RendererManager } from "./v2/RendererManager";
import { ConfigManager } from "./v2/ConfigManager";
import { EventBus } from "./v2/EventBus";
import { PlatformManager } from "./v2/PlatformManager";
import { ErrorHandler } from "./v2/ErrorHandler";
import { PerformanceMonitor } from "./v2/PerformanceMonitor";

// Import game state management
import { useGameState, GameStates } from "../state/gameState";

// Import systems
import { NetworkManager } from "../systems/NetworkManager";
import { WorldSystem } from "../systems/WorldSystem";
import { PlayerSystem } from "../systems/PlayerSystem"; 
import { UISystem } from "../systems/UISystem";
import { VegetationSystem } from "../systems/VegetationSystem";
import { AtmosphereSystem } from "../systems/atmosphere/"
import { WaterSystem } from "../systems/WaterSystem";
import { CarpetTrailSystem } from "../systems/CarpetTrailSystem";
import { LandmarkSystem } from "../systems/LandmarkSystem";
import { MinimapSystem } from "../systems/MinimapSystem";
import { MobileLODManager } from "./MobileLODManager";
import { IntroScreen } from "../ui/screens/IntroScreen";

export class Engine {
  constructor() {
    console.log("Engine constructor start");

    this.canvas = document.getElementById("game-canvas");
    this.clock = new THREE.Clock();
    this.delta = 0;
    this.elapsed = 0;
    this.isRunning = false;
    this.isVisible = true;
    this.maxDeltaTime = 1/15; // Cap at 15 FPS equivalent
    this.gameStarted = false;
    
    // Create V2 core infrastructure
    this.events = new EventBus();
    this.config = new ConfigManager(this);
    this.platform = new PlatformManager(this);
    this.error = new ErrorHandler(this);
    this.performance = new PerformanceMonitor(this);
    this.systems = new SystemManager(this);
    
    // Create core managers that are not yet V2 systems
    this.input = new InputManager();
    this.assets = new AssetManager();
    this.settings = new Settings();

    // Create main scene and camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    
    // Initialize renderer manager
    this.renderer = new RendererManager(this, this.canvas);
    this.renderer.setup();
    // Initialize MobileLODManager AFTER renderer

    this.mobileLOD = new MobileLODManager(this);  // Initialize here instead

    // Performance monitoring in development
    if (import.meta.env.DEV) {
      this.stats = new Stats();
      document.body.appendChild(this.stats.dom);
    }

    // Event listeners
    window.addEventListener("resize", this.onResize.bind(this));
    document.addEventListener("visibilitychange", this.onVisibilityChange.bind(this));
    console.log("Engine constructor complete");

  }
  async initialize() {
    console.log("Engine initialize start");
    
      // Initialize core assets
      await this.assets.initialize();
      console.log("Assets initialized");
      
      // Initialize MobileLODManager before systems
      await this.mobileLOD.initialize();
      console.log("MobileLODManager initialized");
      
      // Register all systems
      this.registerSystems();
      console.log("Systems registered");

    // Set up initialization order
    const initOrder = [
      "network",
      "world",
      "water",
      "vegetation",
      "player",
      "atmosphere",
      "ui",
      "carpetTrail",
      "landmarks",
      "minimap"
    ];
    
    // Set system update order
    this.systems.setUpdateOrder(initOrder);
    console.log("Update order set");
    
    // Initialize all registered systems
    await this.systems.initialize();
    console.log("All systems initialized");
    
    // Set up event handling
    this.input.initialize();
    console.log("Input initialized");

    // Hide loading screen
    document.getElementById("loading").style.display = "none";

    // Start game loop
    this.isRunning = true;
    console.log("Starting game loop");
    this.animate();
    
    // Initialize intro screen
    this.introScreen = new IntroScreen(this);
    this.introScreen.onPlay(() => {
      console.log("Game started from intro screen");
      this.gameStarted = true;
    });
    this.introScreen.show();
    useGameState.getState().setGameState(GameStates.INTRO);

    console.log("Engine initialization complete");
  }

  animate() {
    if (!this.isRunning) {
      console.log("Animation stopped - not running");
      return;
    }

    requestAnimationFrame(this.animate.bind(this));

    // Skip updates if tab is not visible
    if (!this.isVisible) {
      console.log("Animation paused - tab not visible");
      return;
    }

    try {
      // Start performance monitoring
      this.performance.startFrame();

      // Calculate delta time and cap it to prevent huge jumps
      this.delta = Math.min(this.clock.getDelta(), this.maxDeltaTime);
      this.elapsed = this.clock.getElapsedTime();

      // Get current game state
      const { currentState } = useGameState.getState();
      console.log(`Game loop running - State: ${currentState}, Delta: ${this.delta.toFixed(3)}, Elapsed: ${this.elapsed.toFixed(1)}`);

      // Update all systems through the SystemManager
      this.systems.update(this.delta, this.elapsed);
      
      // Render scene
      this.renderer.render(this.scene, this.camera);
      
      // End performance monitoring
      this.performance.endFrame();
      
      // Update stats if available
      if (this.stats) this.stats.update();
    } catch (error) {
      console.error("Error in animation loop:", error);
      this.error.logError("animate", error);
    }
  }
  
  registerSystems() {
    // Register all game systems with the system manager
    this.systems
      .register(new NetworkManager(this))
      // .register(new MobileLODManager(this))
      .register(new WorldSystem(this))
      .register(new WaterSystem(this))
      .register(new VegetationSystem(this))
      .register(new PlayerSystem(this))
      .register(new AtmosphereSystem(this))
      .register(new UISystem(this))
      .register(new CarpetTrailSystem(this))
      .register(new LandmarkSystem(this))
      .register(new MinimapSystem(this));
  }

  animate() {
    if (!this.isRunning) return;

    requestAnimationFrame(this.animate.bind(this));

    // Skip updates if tab is not visible
    if (!this.isVisible) return;

    // Start performance monitoring
    this.performance.startFrame();

    // Calculate delta time and cap it to prevent huge jumps
    this.delta = Math.min(this.clock.getDelta(), this.maxDeltaTime);
    this.elapsed = this.clock.getElapsedTime();

    // Update all systems through the SystemManager
    this.systems.update(this.delta, this.elapsed);
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
    
    // End performance monitoring
    this.performance.endFrame();
    
    // Update stats if available
    if (this.stats) this.stats.update();
  }
  
  onResize() {
    // Let the renderer manager handle resize
    this.renderer.handleResize();
  }
  
  onVisibilityChange() {
    this.isVisible = document.visibilityState === 'visible';
    
    if (this.isVisible) {
      // Reset clock to prevent large delta time spikes
      this.clock.start();
      
      // Let the system manager handle visibility change
      this.systems.handleVisibilityChange(true);
      
      console.log('Game visibility restored');
    } else {
      console.log('Game visibility lost');
    }
  }
  
  getPerformanceReport() {
    return this.performance.getSystemReport();
  }
}