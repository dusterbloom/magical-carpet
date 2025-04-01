
### Step 2: Refactor Engine.js

Now, we'll refactor the Engine.js file to use our new V2 architecture:

```javascript
// src/game/core/Engine.js
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

// Import systems - these will be registered with SystemManager
import { NetworkManager } from "../systems/NetworkManager";
import { WorldSystem } from "../systems/WorldSystem";
import { PlayerSystem } from "../systems/PlayerSystem"; 
import { UISystem } from "../systems/UISystem";
import { VegetationSystem } from "../systems/VegetationSystem";
import { AtmosphereSystem } from "../systems/atmosphere-integration";
import { WaterSystem } from "../systems/WaterSystem";
import { CarpetTrailSystem } from "../systems/CarpetTrailSystem";
import { LandmarkSystem } from "../systems/LandmarkSystem";
import { MinimapSystem } from "../systems/MinimapSystem";
import { MobileLODManager } from "./MobileLODManager";
import { IntroScreen } from "../ui/screens/IntroScreen";

export class Engine {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.clock = new THREE.Clock();
    this.delta = 0;
    this.elapsed = 0;
    this.isRunning = false;
    this.isVisible = true;
    this.maxDeltaTime = 1/15; // Cap at 15 FPS equivalent
    this.gameStarted = false; // Flag to track if the game has started
    
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
    
    // Performance monitoring in development
    if (import.meta.env.DEV) {
      this.stats = new Stats();
      document.body.appendChild(this.stats.dom);
    }

    // Event listeners
    window.addEventListener("resize", this.onResize.bind(this));
    document.addEventListener("visibilitychange", this.onVisibilityChange.bind(this));
  }

  async initialize() {
    // Initialize core assets
    await this.assets.initialize();
    
    // Create systems
    this.registerSystems();
    
    // Set up initialization order
    const initOrder = [
      "network",
      "mobileLOD",
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
    
    // Initialize all registered systems
    await this.systems.initialize();
    
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
  }
  
  registerSystems() {
    // Register all game systems with the system manager
    this.systems.register(new NetworkManager(this));
    this.systems.register(new MobileLODManager(this));
    this.systems.register(new WorldSystem(this));
    this.systems.register(new WaterSystem(this));
    this.systems.register(new VegetationSystem(this));
    this.systems.register(new PlayerSystem(this));
    this.systems.register(new AtmosphereSystem(this));
    this.systems.register(new UISystem(this));
    this.systems.register(new CarpetTrailSystem(this));
    this.systems.register(new LandmarkSystem(this));
    this.systems.register(new MinimapSystem(this));
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
  
  /**
   * Generates and returns a performance report
   * Call this from the browser console to get performance data
   * @returns {Object} Performance report
   */
  getPerformanceReport() {
    return this.performance.getSystemReport();
  }
}
```
