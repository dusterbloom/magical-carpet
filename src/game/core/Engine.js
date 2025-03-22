import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { InputManager } from './InputManager';
import { AssetManager } from './AssetManager';
import { NetworkManager } from '../systems/NetworkManager';
import { WorldSystem } from '../systems/WorldSystem';
import { PlayerSystem } from '../systems/PlayerSystem';
import { UISystem } from '../systems/UISystem';

export class Engine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
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
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(this.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; // ADD THIS LINE
        
    // Create main scene and camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Performance monitoring in development
    if (import.meta.env.DEV) {
      this.stats = new Stats();
      document.body.appendChild(this.stats.dom);
    }
    
    // Event listeners
    window.addEventListener('resize', this.onResize.bind(this));
  }
  
  async initialize() {
    // Initialize all core systems
    await this.assets.initialize();
    
    this.systems.network = new NetworkManager(this);
    this.systems.world = new WorldSystem(this);
    this.systems.player = new PlayerSystem(this);
    this.systems.ui = new UISystem(this);
    
    // Initialize systems
    for (const system of Object.values(this.systems)) {
      await system.initialize();
    }
    
    // Set up event handling
    this.input.initialize();
    
    // Hide loading screen
    document.getElementById('loading').style.display = 'none';
    
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
    
    // Update all systems
    for (const system of Object.values(this.systems)) {
      system.update(this.delta, this.elapsed);
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
