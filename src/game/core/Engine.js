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

export class Engine {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.clock = new THREE.Clock();
    this.delta = 0;
    this.elapsed = 0;
    this.systems = {};
    this.isRunning = false;
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

    // Calculate delta time
    this.delta = this.clock.getDelta();
    this.elapsed = this.clock.getElapsedTime();

    // Update systems in correct order
    const updateOrder = [
      "network",
      "world",
      "water",
      "vegetation",
      "atmosphere",
      "player",
      "carpetTrail", // Update trail after player movement
      "ui",
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

  onResize() {
    // Update camera
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    // Update renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
