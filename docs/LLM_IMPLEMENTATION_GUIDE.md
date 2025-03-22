# Magical Vibe Carpet - LLM Implementation Guide

This document provides step-by-step instructions for implementing the Magical Vibe Carpet game, a modern web-based reimagining of the classic DOS game Magic Carpet by Bullfrog. The game features multiplayer capabilities, is accessible via web browsers without login requirements, and is optimized for both mobile and desktop platforms.

## Project Requirements

- Web-based, no signup/login required
- Playable on mobile and desktop browsers
- Multiplayer by default
- Three.js as primary rendering engine
- Minimal download size
- Short play sessions (3-5 minutes)
- Funky, colorful aesthetic

## Implementation Sequence

Follow these instructions sequentially to build the game:

## 1. Project Setup

### 1.1. Initialize Project Structure
```bash
# Execute these commands to set up the base project structure
mkdir -p src/{components,assets,utils,services,game}
mkdir -p src/assets/{models,textures,audio,shaders}
mkdir -p src/game/{core,entities,systems,levels,ui}
touch index.html
touch src/main.js
npm init -y
npm install three socket.io-client vite
```

### 1.2. Configure Build System
Create a vite.config.js file with these contents:
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    minify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          game: ['./src/game/core/Engine.js']
        }
      }
    }
  }
});
```

### 1.3. Set Up HTML Template
Create the initial HTML structure in index.html:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Magical Vibe Carpet</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      background: #120052;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    #loading {
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      color: white;
      background: linear-gradient(45deg, #120052, #7b2cbf);
      z-index: 1000;
    }
    canvas {
      display: block;
    }
  </style>
</head>
<body>
  <div id="loading">
    <div>
      <h1>Magical Vibe Carpet</h1>
      <div id="progress-bar" style="width: 300px; height: 20px; background: #7b2cbf44; border-radius: 10px; overflow: hidden;">
        <div id="progress" style="width: 0%; height: 100%; background: #e0aaff; transition: width 0.3s;"></div>
      </div>
      <p id="loading-text">Preparing your carpet ride...</p>
    </div>
  </div>
  <div id="ui-container"></div>
  <canvas id="game-canvas"></canvas>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

## 2. Core Engine Implementation

### 2.1. Create Engine Class
Create src/game/core/Engine.js:
```javascript
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
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    
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
```

### 2.2. Create Input Manager
Create src/game/core/InputManager.js:
```javascript
export class InputManager {
  constructor() {
    this.keys = {};
    this.touches = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0 };
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.listeners = {};
  }
  
  initialize() {
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    
    // Mouse events
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    
    // Touch events for mobile
    if (this.isTouchDevice) {
      window.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
      window.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
      window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    }
    
    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  // Input event handlers
  onKeyDown(event) {
    this.keys[event.code] = true;
    this.emit('keydown', event);
  }
  
  onKeyUp(event) {
    this.keys[event.code] = false;
    this.emit('keyup', event);
  }
  
  onMouseDown(event) {
    this.mouse.buttons = event.buttons;
    this.emit('mousedown', event);
  }
  
  onMouseUp(event) {
    this.mouse.buttons = event.buttons;
    this.emit('mouseup', event);
  }
  
  onMouseMove(event) {
    const prevX = this.mouse.x;
    const prevY = this.mouse.y;
    
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
    this.mouse.dx = this.mouse.x - prevX;
    this.mouse.dy = this.mouse.y - prevY;
    
    this.emit('mousemove', event);
  }
  
  onTouchStart(event) {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches[touch.identifier] = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY
      };
    }
    
    this.emit('touchstart', event);
  }
  
  onTouchEnd(event) {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      delete this.touches[touch.identifier];
    }
    
    this.emit('touchend', event);
  }
  
  onTouchMove(event) {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (this.touches[touch.identifier]) {
        this.touches[touch.identifier].x = touch.clientX;
        this.touches[touch.identifier].y = touch.clientY;
      }
    }
    
    this.emit('touchmove', event);
  }
  
  // Event system
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }
  
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
  
  emit(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        callback(data);
      }
    }
  }
  
  // Helper methods
  isKeyDown(keyCode) {
    return !!this.keys[keyCode];
  }
  
  getTouchCount() {
    return Object.keys(this.touches).length;
  }
}
```

### 2.3. Create Asset Manager
Create src/game/core/AssetManager.js:
```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

export class AssetManager {
  constructor() {
    this.textures = {};
    this.models = {};
    this.materials = {};
    this.audio = {};
    this.shaders = {};
    
    // Asset loaders
    this.loadingManager = new THREE.LoadingManager(
      // onLoad
      () => {
        console.log('All assets loaded');
      },
      // onProgress
      (url, itemsLoaded, itemsTotal) => {
        const progress = (itemsLoaded / itemsTotal) * 100;
        document.getElementById('progress').style.width = `${progress}%`;
        document.getElementById('loading-text').textContent = `Loading assets (${itemsLoaded}/${itemsTotal})`;
      },
      // onError
      (url) => {
        console.error(`Error loading asset: ${url}`);
      }
    );
    
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    
    // GLTF loader with Draco compression support
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.3/');
    this.gltfLoader = new GLTFLoader(this.loadingManager);
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    
    this.audioLoader = new THREE.AudioLoader(this.loadingManager);
  }
  
  async initialize() {
    // Create a promise that resolves when all assets are loaded
    return new Promise((resolve) => {
      // Queue asset loading here
      this.loadTextures();
      this.loadModels();
      this.loadAudio();
      this.loadShaders();
      
      // Check if anything is being loaded
      if (this.loadingManager.itemsTotal === 0) {
        resolve();
      } else {
        this.loadingManager.onLoad = resolve;
      }
    });
  }
  
  loadTextures() {
    const textureFiles = [
      { name: 'carpet', path: '/assets/textures/carpet.jpg' },
      { name: 'terrain', path: '/assets/textures/terrain.jpg' },
      { name: 'sky', path: '/assets/textures/sky.jpg' },
      { name: 'particles', path: '/assets/textures/particles.png' }
    ];
    
    textureFiles.forEach(({ name, path }) => {
      this.textureLoader.load(path, (texture) => {
        texture.encoding = THREE.sRGBEncoding;
        this.textures[name] = texture;
      });
    });
  }
  
  loadModels() {
    const modelFiles = [
      { name: 'carpet', path: '/assets/models/carpet.glb' },
      { name: 'mana', path: '/assets/models/mana.glb' }
    ];
    
    modelFiles.forEach(({ name, path }) => {
      this.gltfLoader.load(path, (gltf) => {
        this.models[name] = gltf;
      });
    });
  }
  
  loadAudio() {
    const audioFiles = [
      { name: 'background', path: '/assets/audio/background.mp3' },
      { name: 'spell', path: '/assets/audio/spell.mp3' },
      { name: 'collect', path: '/assets/audio/collect.mp3' }
    ];
    
    audioFiles.forEach(({ name, path }) => {
      this.audioLoader.load(path, (buffer) => {
        this.audio[name] = buffer;
      });
    });
  }
  
  loadShaders() {
    // This would typically load shader files, but for simplicity
    // we'll define them inline or in separate files later
  }
  
  // Helper methods to access assets
  getTexture(name) {
    return this.textures[name];
  }
  
  getModel(name) {
    return this.models[name];
  }
  
  getAudio(name) {
    return this.audio[name];
  }
  
  // Create reusable materials
  createMaterials() {
    this.materials.carpet = new THREE.MeshStandardMaterial({
      map: this.textures.carpet,
      roughness: 0.7,
      metalness: 0.2
    });
    
    this.materials.terrain = new THREE.MeshStandardMaterial({
      map: this.textures.terrain,
      roughness: 0.9,
      metalness: 0.1
    });
  }
}
```

## 3. Network Implementation

### 3.1. Create Network Manager
Create src/game/systems/NetworkManager.js:
```javascript
import { io } from 'socket.io-client';
import { EventEmitter } from '../../utils/EventEmitter';

export class NetworkManager extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.socket = null;
    this.players = new Map();
    this.localPlayerId = null;
    this.serverTimeDiff = 0;
    this.ping = 0;
  }
  
  async initialize() {
    // In a real implementation, this would connect to your actual server
    const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
    
    this.socket = io(serverUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });
    
    this.setupEventListeners();
    
    // For now, we'll simulate connection success locally
    // In a real implementation, this would be triggered by the server
    setTimeout(() => {
      this.localPlayerId = 'player_' + Math.floor(Math.random() * 10000);
      this.emit('connected', { id: this.localPlayerId });
      
      // Simulate other players joining
      this.handlePlayerJoin({ id: 'player_ai_1', name: 'Magic Bot 1', x: 10, y: 5, z: 20 });
      this.handlePlayerJoin({ id: 'player_ai_2', name: 'Magic Bot 2', x: -15, y: 7, z: -5 });
      
      console.log("Network simulation initialized");
    }, 500);
  }
  
  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.emit('connected');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.emit('disconnected');
    });
    
    this.socket.on('player_join', (data) => {
      this.handlePlayerJoin(data);
    });
    
    this.socket.on('player_leave', (data) => {
      this.handlePlayerLeave(data);
    });
    
    this.socket.on('player_update', (data) => {
      this.handlePlayerUpdate(data);
    });
    
    this.socket.on('game_state', (data) => {
      this.handleGameState(data);
    });
    
    this.socket.on('pong', (latency) => {
      this.ping = latency;
    });
  }
  
  connect() {
    // In a real implementation, this would connect to the actual server
    // this.socket.connect();
    
    // For now we'll just simulate connection locally
    // This was done in initialize for simplicity
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
  
  // Player event handlers
  handlePlayerJoin(data) {
    this.players.set(data.id, data);
    this.emit('player_join', data);
  }
  
  handlePlayerLeave(data) {
    this.players.delete(data.id);
    this.emit('player_leave', data);
  }
  
  handlePlayerUpdate(data) {
    if (this.players.has(data.id)) {
      const player = this.players.get(data.id);
      Object.assign(player, data);
      this.emit('player_update', player);
    }
  }
  
  handleGameState(data) {
    this.emit('game_state', data);
  }
  
  // Send player updates to server
  sendPlayerUpdate(data) {
    // In a real implementation, this would send to the server
    // this.socket.emit('player_update', data);
    
    // For now, we'll simulate local update
    if (this.localPlayerId) {
      data.id = this.localPlayerId;
      this.handlePlayerUpdate(data);
    }
  }
  
  // Send player actions to server
  sendPlayerAction(action, data) {
    // In a real implementation, this would send to the server
    // this.socket.emit('player_action', { action, ...data });
    
    // For now, we'll simulate locally
    this.emit('player_action', { 
      playerId: this.localPlayerId,
      action, 
      ...data 
    });
  }
  
  update(delta) {
    // Simulate network updates for AI players
    if (Math.random() < 0.05) {
      this.players.forEach((player, id) => {
        if (id !== this.localPlayerId) {
          // Simple random movement for AI players
          const update = {
            id,
            x: player.x + (Math.random() - 0.5) * 0.5,
            y: player.y + (Math.random() - 0.5) * 0.1,
            z: player.z + (Math.random() - 0.5) * 0.5
          };
          this.handlePlayerUpdate(update);
        }
      });
    }
  }
  
  getPlayers() {
    return Array.from(this.players.values());
  }
  
  getLocalPlayerId() {
    return this.localPlayerId;
  }
}
```

### 3.2. Create Event Emitter Utility
Create src/utils/EventEmitter.js:
```javascript
export class EventEmitter {
  constructor() {
    this.listeners = {};
  }
  
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }
  
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
  
  emit(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        callback(data);
      }
    }
  }
  
  once(event, callback) {
    const onceCallback = (data) => {
      this.off(event, onceCallback);
      callback(data);
    };
    this.on(event, onceCallback);
  }
}
```

## 4. World Generation

### 4.1. Create World System
Create src/game/systems/WorldSystem.js:
```javascript
import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise';
import { Water } from 'three/examples/jsm/objects/Water';
import { Sky } from 'three/examples/jsm/objects/Sky';

export class WorldSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.terrain = null;
    this.water = null;
    this.sky = null;
    this.manaNodes = [];
    this.noise = new SimplexNoise();
    this.worldSize = 1000;
    this.heightScale = 60;
    this.seed = Math.random() * 1000;
  }
  
  async initialize() {
    this.createLights();
    this.createSky();
    this.createTerrain();
    this.createWater();
    this.createManaNodes();
    
    // Set camera position
    this.engine.camera.position.set(0, 50, 0);
    this.engine.camera.lookAt(50, 0, 50);
    
    console.log("World system initialized");
  }
  
  createLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    this.scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    
    // Set up shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.bias = -0.0005;
    
    this.scene.add(directionalLight);
    this.sunLight = directionalLight;
  }
  
  createSky() {
    // Create sky
    this.sky = new Sky();
    this.sky.scale.setScalar(10000);
    this.scene.add(this.sky);
    
    // Set up sun parameters
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;
    
    const sunPosition = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(90 - 10); // Sun elevation
    const theta = THREE.MathUtils.degToRad(180); // Sun azimuth
    
    sunPosition.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sunPosition);
    
    // Update sun light direction to match sky
    this.sunLight.position.copy(sunPosition.multiplyScalar(100));
    this.sunLight.updateMatrixWorld();
  }
  
  createTerrain() {
    // Create terrain geometry
    const geometry = new THREE.PlaneGeometry(
      this.worldSize,
      this.worldSize,
      128,
      128
    );
    geometry.rotateX(-Math.PI / 2);
    
    // Create terrain material
    const terrainTexture = this.engine.assets.getTexture('terrain');
    if (terrainTexture) {
      terrainTexture.wrapS = THREE.RepeatWrapping;
      terrainTexture.wrapT = THREE.RepeatWrapping;
      terrainTexture.repeat.set(16, 16);
    }
    
    const material = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: 0.8,
      metalness: 0.2,
      vertexColors: true
    });
    
    // Apply height map using simplex noise
    const vertices = geometry.attributes.position;
    const colors = new Float32Array(vertices.count * 3);
    const color = new THREE.Color();
    
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const z = vertices.getZ(i);
      
      // Get noise value for current position
      const nx = x / this.worldSize;
      const nz = z / this.worldSize;
      
      // Combine multiple noise scales for more detailed terrain
      const noise1 = this.noise.noise(nx * 1.5 + this.seed, nz * 1.5 + this.seed) * 0.5;
      const noise2 = this.noise.noise(nx * 3 + this.seed * 2, nz * 3 + this.seed * 2) * 0.25;
      const noise3 = this.noise.noise(nx * 6 + this.seed * 3, nz * 6 + this.seed * 3) * 0.125;
      
      // Combine different noise scales
      const combinedNoise = noise1 + noise2 + noise3;
      
      // Calculate height and apply to vertex
      const height = combinedNoise * this.heightScale;
      vertices.setY(i, height);
      
      // Color based on height
      if (height < 2) {
        color.setRGB(0.8, 0.7, 0.5); // Sand
      } else if (height < 10) {
        color.setRGB(0.1, 0.8, 0.1); // Grass
      } else if (height < 20) {
        color.setRGB(0.5, 0.5, 0.1); // Forest
      } else {
        color.setRGB(0.5, 0.5, 0.5); // Mountain
      }
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    
    // Create terrain mesh
    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    this.scene.add(this.terrain);
    
    // Create collision data for terrain
    this.createTerrainCollision();
  }
  
  createTerrainCollision() {
    // Simple heightmap lookup for collision detection
    // In a full implementation, you might use a more sophisticated approach
    this.heightMap = [];
    const resolution = 100;
    const step = this.worldSize / resolution;
    
    for (let i = 0; i <= resolution; i++) {
      this.heightMap[i] = [];
      for (let j = 0; j <= resolution; j++) {
        const x = (i / resolution) * this.worldSize - this.worldSize / 2;
        const z = (j / resolution) * this.worldSize - this.worldSize / 2;
        
        const nx = x / this.worldSize;
        const nz = z / this.worldSize;
        
        // Same noise function as in createTerrain
        const noise1 = this.noise.noise(nx * 1.5 + this.seed, nz * 1.5 + this.seed) * 0.5;
        const noise2 = this.noise.noise(nx * 3 + this.seed * 2, nz * 3 + this.seed * 2) * 0.25;
        const noise3 = this.noise.noise(nx * 6 + this.seed * 3, nz * 6 + this.seed * 3) * 0.125;
        
        this.heightMap[i][j] = (noise1 + noise2 + noise3) * this.heightScale;
      }
    }
  }
  
  getTerrainHeight(x, z) {
    // Convert world coordinates to heightmap coordinates
    const halfSize = this.worldSize / 2;
    const nx = ((x + halfSize) / this.worldSize) * (this.heightMap.length - 1);
    const nz = ((z + halfSize) / this.worldSize) * (this.heightMap[0].length - 1);
    
    // Get the four surrounding height values
    const x1 = Math.floor(nx);
    const x2 = Math.min(Math.ceil(nx), this.heightMap.length - 1);
    const z1 = Math.floor(nz);
    const z2 = Math.min(Math.ceil(nz), this.heightMap[0].length - 1);
    
    const h11 = this.heightMap[x1][z1];
    const h21 = this.heightMap[x2][z1];
    const h12 = this.heightMap[x1][z2];
    const h22 = this.heightMap[x2][z2];
    
    // Bilinear interpolation
    const fx = nx - x1;
    const fz = nz - z1;
    
    const h1 = h11 * (1 - fx) + h21 * fx;
    const h2 = h12 * (1 - fx) + h22 * fx;
    
    return h1 * (1 - fz) + h2 * fz;
  }
  
  createWater() {
    const waterGeometry = new THREE.PlaneGeometry(this.worldSize * 2, this.worldSize * 2);
    
    // Create water with reflections
    this.water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load('assets/textures/waternormals.jpg', function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: this.scene.fog !== undefined
    });
    
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0; // Water level
    this.scene.add(this.water);
  }
  
  createManaNodes() {
    // Create mana collection points throughout the world
    const nodeCount = 20;
    this.manaNodes = [];
    
    for (let i = 0; i < nodeCount; i++) {
      // Random position within the world bounds
      const x = (Math.random() - 0.5) * this.worldSize * 0.8;
      const z = (Math.random() - 0.5) * this.worldSize * 0.8;
      const y = this.getTerrainHeight(x, z) + 10; // Floating above terrain
      
      // Create mana node visual
      const geometry = new THREE.SphereGeometry(2, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00aaff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
      });
      
      const node = new THREE.Mesh(geometry, material);
      node.position.set(x, y, z);
      node.castShadow = true;
      node.userData = {
        type: 'mana',
        value: 10 + Math.floor(Math.random() * 20), // Random value
        collected: false
      };
      
      // Add glow effect
      const glowGeometry = new THREE.SphereGeometry(3, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
      });
      
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      node.add(glowMesh);
      
      this.scene.add(node);
      this.manaNodes.push(node);
    }
  }
  
  update(delta, elapsed) {
    // Animate water
    if (this.water) {
      this.water.material.uniforms['time'].value += delta;
    }
    
    // Animate mana nodes (bobbing and rotating)
    this.manaNodes.forEach((node, index) => {
      if (!node.userData.collected) {
        node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.03;
        node.rotation.y += delta * 0.5;
      }
    });
  }
  
  // Check if a mana node is collected
  checkManaCollection(position, radius) {
    const collectedNodes = [];
    
    this.manaNodes.forEach((node) => {
      if (!node.userData.collected) {
        const distance = position.distanceTo(node.position);
        if (distance < radius + 2) { // 2 is the node radius
          node.userData.collected = true;
          
          // Make the node disappear
          node.visible = false;
          
          collectedNodes.push({
            position: node.position.clone(),
            value: node.userData.value
          });
        }
      }
    });
    
    return collectedNodes;
  }
}
```

## 5. Player Implementation

### 5.1. Create Player System
Create src/game/systems/PlayerSystem.js:
```javascript
import * as THREE from 'three';

export class PlayerSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.players = new Map();
    this.localPlayer = null;
    this.carpetModels = [];
    this.carpetMaterials = [];
  }
  
  async initialize() {
    await this.createCarpetModels();
    
    // Listen for network events
    this.engine.systems.network.on('connected', (data) => {
      this.createLocalPlayer(data.id);
    });
    
    this.engine.systems.network.on('player_join', (data) => {
      this.createNetworkPlayer(data);
    });
    
    this.engine.systems.network.on('player_leave', (data) => {
      this.removePlayer(data.id);
    });
    
    this.engine.systems.network.on('player_update', (data) => {
      this.updateNetworkPlayer(data);
    });
    
    console.log("Player system initialized");
  }
  
  async createCarpetModels() {
    // In a real implementation, you would use the loaded models from assets
    // For simplicity, we'll create simple meshes
    
    // Create different carpet materials for players
    this.carpetMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xff5555, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x55ff55, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x5555ff, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0xffff55, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0xff55ff, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x55ffff, roughness: 0.7, metalness: 0.3 })
    ];
    
    // Create a simple carpet model
    const carpetGeometry = new THREE.BoxGeometry(5, 0.5, 8);
    
    // Create different carpet models with different materials
    this.carpetModels = this.carpetMaterials.map(material => {
      return new THREE.Mesh(carpetGeometry, material);
    });
    
    // Set up shadows
    this.carpetModels.forEach(model => {
      model.castShadow = true;
      model.receiveShadow = true;
    });
    
    console.log(`Created ${this.carpetModels.length} carpet models`);
  }
  
  createLocalPlayer(id) {
    // Get a random carpet model
    const carpetIndex = Math.floor(Math.random() * this.carpetModels.length);
    const carpetModel = this.carpetModels[carpetIndex].clone();
    
    // Create player object
    const player = {
      id,
      isLocal: true,
      model: carpetModel,
      position: new THREE.Vector3(0, 20, 0),
      rotation: new THREE.Euler(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      acceleration: new THREE.Vector3(0, 0, 0),
      yawVelocity: 0,
      pitchVelocity: 0,
      mana: 0,
      health: 100,
      maxHealth: 100,
      maxSpeed: 30,
      acceleration: 20,
      rotationSpeed: 2,
      spells: []
    };
    
    // Add carpet model to scene
    carpetModel.position.copy(player.position);
    this.scene.add(carpetModel);
    
    // Store the player
    this.players.set(id, player);
    this.localPlayer = player;
    
    // Set up camera to follow player
    this.setupCamera();
    
    // Set up input handling
    this.setupInput();
    
    console.log(`Local player created with ID: ${id}`);
  }
  
  createNetworkPlayer(data) {
    // Don't create duplicate players
    if (this.players.has(data.id)) {
      return;
    }
    
    // Get a random carpet model
    const carpetIndex = Math.floor(Math.random() * this.carpetModels.length);
    const carpetModel = this.carpetModels[carpetIndex].clone();
    
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
  
  setupCamera() {
    // Position camera relative to player
    this.cameraOffset = new THREE.Vector3(0, 5, -10);
    this.cameraTarget = new THREE.Vector3(0, 0, 10);
    
    // Apply camera offset to local player's position and rotation
    this.updateCamera();
  }
  
  updateCamera() {
    if (!this.localPlayer) return;
    
    // Create a matrix from the player's rotation
    const rotMatrix = new THREE.Matrix4();
    rotMatrix.makeRotationY(this.localPlayer.rotation.y);
    
    // Apply rotation to camera offset and target
    const offsetRotated = this.cameraOffset.clone().applyMatrix4(rotMatrix);
    const targetRotated = this.cameraTarget.clone().applyMatrix4(rotMatrix);
    
    // Position camera relative to player
    this.engine.camera.position.copy(this.localPlayer.position).add(offsetRotated);
    
    // Look at point ahead of player
    const lookTarget = this.localPlayer.position.clone().add(targetRotated);
    this.engine.camera.lookAt(lookTarget);
  }
  
  setupInput() {
    const input = this.engine.input;
    
    // Handle keyboard input
    input.on('keydown', (event) => {
      // Prevent default for game controls
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    
    // Handle touch input for mobile
    if (input.isTouchDevice) {
      this.setupTouchControls();
    }
  }
  
  setupTouchControls() {
    const input = this.engine.input;
    
    // Create virtual joystick for mobile
    const joystickContainer = document.createElement('div');
    joystickContainer.style.position = 'absolute';
    joystickContainer.style.bottom = '20px';
    joystickContainer.style.left = '20px';
    joystickContainer.style.width = '120px';
    joystickContainer.style.height = '120px';
    joystickContainer.style.borderRadius = '60px';
    joystickContainer.style.background = 'rgba(255, 255, 255, 0.2)';
    document.body.appendChild(joystickContainer);
    
    const joystick = document.createElement('div');
    joystick.style.position = 'absolute';
    joystick.style.top = '35px';
    joystick.style.left = '35px';
    joystick.style.width = '50px';
    joystick.style.height = '50px';
    joystick.style.borderRadius = '25px';
    joystick.style.background = 'rgba(255, 255, 255, 0.5)';
    joystickContainer.appendChild(joystick);
    
    // Track joystick state
    this.joystick = {
      active: false,
      position: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 },
      container: {
        rect: joystickContainer.getBoundingClientRect(),
        radius: 60
      }
    };
    
    // Update joystick container rect on resize
    window.addEventListener('resize', () => {
      this.joystick.container.rect = joystickContainer.getBoundingClientRect();
    });
    
    // Handle touch events for joystick
    input.on('touchstart', (event) => {
      for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        // Check if touch is within joystick container
        const containerRect = this.joystick.container.rect;
        if (
          touchX >= containerRect.left &&
          touchX <= containerRect.right &&
          touchY >= containerRect.top &&
          touchY <= containerRect.bottom
        ) {
          this.joystick.active = true;
          this.joystick.startPosition.x = touchX;
          this.joystick.startPosition.y = touchY;
          break;
        }
      }
    });
    
    input.on('touchmove', (event) => {
      if (this.joystick.active) {
        for (let i = 0; i < event.touches.length; i++) {
          const touch = event.touches[i];
          const touchX = touch.clientX;
          const touchY = touch.clientY;
          
          const containerRect = this.joystick.container.rect;
          const centerX = containerRect.left + containerRect.width / 2;
          const centerY = containerRect.top + containerRect.height / 2;
          
          // Calculate joystick position
          let dx = touchX - centerX;
          let dy = touchY - centerY;
          
          // Limit to container radius
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = this.joystick.container.radius;
          
          if (distance > maxDistance) {
            dx = dx * (maxDistance / distance);
            dy = dy * (maxDistance / distance);
          }
          
          // Update joystick position
          joystick.style.transform = `translate(${dx}px, ${dy}px)`;
          
          // Store normalized joystick position (-1 to 1)
          this.joystick.position.x = dx / maxDistance;
          this.joystick.position.y = dy / maxDistance;
          
          break;
        }
      }
    });
    
    input.on('touchend', (event) => {
      this.joystick.active = false;
      this.joystick.position.x = 0;
      this.joystick.position.y = 0;
      joystick.style.transform = 'translate(0px, 0px)';
    });
  }
  
  update(delta) {
    if (!this.localPlayer) return;
    
    // Handle player input
    this.handleInput(delta);
    
    // Update player physics
    this.updatePhysics(delta);
    
    // Update player models
    this.updateModels();
    
    // Check for mana collection
    this.checkManaCollection();
    
    // Update camera to follow player
    this.updateCamera();
    
    // Send player updates to network
    this.sendPlayerUpdate();
  }
  
  handleInput(delta) {
    const input = this.engine.input;
    const player = this.localPlayer;
    
    // Default acceleration
    player.acceleration.set(0, 0, 0);
    player.yawVelocity = 0;
    player.pitchVelocity = 0;
    
    if (input.isTouchDevice && this.joystick && this.joystick.active) {
      // Mobile touch controls
      const { x, y } = this.joystick.position;
      
      // Rotate based on joystick x position
      player.yawVelocity = -x * player.rotationSpeed;
      
      // Move forward/backward based on joystick y position
      const forwardAccel = -y * player.acceleration;
      
      // Calculate forward direction based on player rotation
      const direction = new THREE.Vector3(0, 0, 1).applyEuler(player.rotation);
      
      // Apply acceleration in that direction
      player.acceleration.copy(direction).multiplyScalar(forwardAccel);
    } else {
      // Keyboard controls
      // Rotation (left/right)
      if (input.isKeyDown('ArrowLeft')) {
        player.yawVelocity = player.rotationSpeed;
      } else if (input.isKeyDown('ArrowRight')) {
        player.yawVelocity = -player.rotationSpeed;
      }
      
      // Pitch (up/down)
      if (input.isKeyDown('ArrowUp')) {
        player.pitchVelocity = 0.5;
      } else if (input.isKeyDown('ArrowDown')) {
        player.pitchVelocity = -0.5;
      }
      
      // Movement (W/A/S/D)
      const moveZ = (input.isKeyDown('KeyW') ? 1 : 0) - (input.isKeyDown('KeyS') ? 1 : 0);
      const moveX = (input.isKeyDown('KeyA') ? 1 : 0) - (input.isKeyDown('KeyD') ? 1 : 0);
      
      if (moveZ !== 0 || moveX !== 0) {
        // Create direction vector and apply player rotation
        const direction = new THREE.Vector3(moveX, 0, moveZ).normalize();
        direction.applyEuler(new THREE.Euler(0, player.rotation.y, 0));
        
        // Apply acceleration in that direction
        player.acceleration.copy(direction).multiplyScalar(player.acceleration);
      }
    }
  }
  
  updatePhysics(delta) {
    const player = this.localPlayer;
    
    // Update rotation
    player.rotation.y += player.yawVelocity * delta;
    
    // Clamp pitch to prevent flipping
    player.rotation.x += player.pitchVelocity * delta;
    player.rotation.x = THREE.MathUtils.clamp(player.rotation.x, -Math.PI / 4, Math.PI / 4);
    
    // Update velocity with acceleration
    player.velocity.add(player.acceleration.clone().multiplyScalar(delta));
    
    // Apply drag
    player.velocity.multiplyScalar(0.95);
    
    // Clamp velocity to max speed
    if (player.velocity.length() > player.maxSpeed) {
      player.velocity.normalize().multiplyScalar(player.maxSpeed);
    }
    
    // Update position
    player.position.add(player.velocity.clone().multiplyScalar(delta));
    
    // Get terrain height at current position
    const terrainY = this.engine.systems.world.getTerrainHeight(
      player.position.x,
      player.position.z
    );
    
    // Keep player above terrain with minimum height
    const minHeightAboveTerrain = 5;
    if (player.position.y < terrainY + minHeightAboveTerrain) {
      player.position.y = terrainY + minHeightAboveTerrain;
      player.velocity.y = Math.max(0, player.velocity.y);
    }
    
    // Apply gravity if too high
    const maxHeightAboveTerrain = 50;
    if (player.position.y > terrainY + maxHeightAboveTerrain) {
      player.velocity.y -= 9.8 * delta;
    }
    
    // Keep player within world bounds
    const worldSize = this.engine.systems.world.worldSize / 2;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -worldSize, worldSize);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -worldSize, worldSize);
  }
  
  updateModels() {
    // Update all player models
    this.players.forEach(player => {
      // Update carpet model position and rotation
      player.model.position.copy(player.position);
      player.model.rotation.copy(player.rotation);
      
      // Add bobbing animation
      const time = this.engine.elapsed;
      player.model.position.y += Math.sin(time * 2) * 0.2;
      
      // Add carpet flutter animation
      player.model.rotation.z = Math.sin(time * 5) * 0.05;
    });
  }
  
  checkManaCollection() {
    if (!this.localPlayer) return;
    
    // Check for mana collection
    const collectedNodes = this.engine.systems.world.checkManaCollection(
      this.localPlayer.position,
      5 // Collection radius
    );
    
    if (collectedNodes.length > 0) {
      // Add collected mana to player
      for (const node of collectedNodes) {
        this.localPlayer.mana += node.value;
        
        // Create collection effect
        this.createCollectionEffect(node.position);
      }
      
      // Update UI
      this.engine.systems.ui.updateManaDisplay(this.localPlayer.mana);
    }
  }
  
  createCollectionEffect(position) {
    // Create particle effect for mana collection
    const particleCount = 20;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.8
        })
      );
      
      // Random position within sphere
      const radius = 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      particle.position.set(
        position.x + radius * Math.sin(phi) * Math.cos(theta),
        position.y + radius * Math.sin(phi) * Math.sin(theta),
        position.z + radius * Math.cos(phi)
      );
      
      // Random velocity
      particle.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          Math.random() * 5 + 5,
          (Math.random() - 0.5) * 5
        ),
        life: 1.0
      };
      
      particles.add(particle);
    }
    
    this.scene.add(particles);
    
    // Animate particles
    const animateParticles = (delta) => {
      let allDead = true;
      
      for (let i = 0; i < particles.children.length; i++) {
        const particle = particles.children[i];
        
        // Update position
        particle.position.add(particle.userData.velocity.clone().multiplyScalar(delta));
        
        // Update life
        particle.userData.life -= delta * 2;
        
        // Update scale and opacity
        const life = particle.userData.life;
        particle.scale.set(life, life, life);
        particle.material.opacity = life;
        
        if (life > 0) {
          allDead = false;
        }
      }
      
      // Remove particles if all are dead
      if (allDead) {
        this.scene.remove(particles);
        return;
      }
      
      // Continue animation
      requestAnimationFrame(() => animateParticles(0.016));
    };
    
    // Start animation
    animateParticles(0.016);
  }
  
  sendPlayerUpdate() {
    if (!this.localPlayer) return;
    
    // Send player position and rotation to network
    this.engine.systems.network.sendPlayerUpdate({
      x: this.localPlayer.position.x,
      y: this.localPlayer.position.y,
      z: this.localPlayer.position.z,
      rotationY: this.localPlayer.rotation.y,
      mana: this.localPlayer.mana,
      health: this.localPlayer.health
    });
  }
}
```

## 6. UI Implementation

### 6.1. Create UI System
Create src/game/systems/UISystem.js:
```javascript
export class UISystem {
  constructor(engine) {
    this.engine = engine;
    this.container = document.getElementById('ui-container');
    this.elements = {};
  }
  
  async initialize() {
    this.createBaseUI();
    this.createManaDisplay();
    this.createHealthDisplay();
    this.createSpellsUI();
    this.createMinimapUI();
    
    console.log("UI system initialized");
  }
  
  createBaseUI() {
    // Apply global UI styles
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.fontFamily = 'Arial, sans-serif';
    this.container.style.color = 'white';
  }
  
  createManaDisplay() {
    // Create mana display in top-right corner
    const manaContainer = document.createElement('div');
    manaContainer.style.position = 'absolute';
    manaContainer.style.top = '20px';
    manaContainer.style.right = '20px';
    manaContainer.style.padding = '10px';
    manaContainer.style.background = 'rgba(0, 0, 30, 0.7)';
    manaContainer.style.borderRadius = '5px';
    manaContainer.style.display = 'flex';
    manaContainer.style.alignItems = 'center';
    manaContainer.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
    
    const manaIcon = document.createElement('div');
    manaIcon.style.width = '20px';
    manaIcon.style.height = '20px';
    manaIcon.style.borderRadius = '50%';
    manaIcon.style.background = 'linear-gradient(135deg, #00ffff, #0066ff)';
    manaIcon.style.marginRight = '10px';
    manaIcon.style.boxShadow = '0 0 5px rgba(0, 255, 255, 0.8)';
    
    const manaText = document.createElement('div');
    manaText.textContent = '0';
    manaText.style.fontSize = '18px';
    manaText.style.fontWeight = 'bold';
    manaText.style.textShadow = '0 0 5px rgba(0, 255, 255, 0.8)';
    
    manaContainer.appendChild(manaIcon);
    manaContainer.appendChild(manaText);
    this.container.appendChild(manaContainer);
    
    this.elements.manaText = manaText;
  }
  
  createHealthDisplay() {
    // Create health bar at bottom center
    const healthContainer = document.createElement('div');
    healthContainer.style.position = 'absolute';
    healthContainer.style.bottom = '20px';
    healthContainer.style.left = '50%';
    healthContainer.style.transform = 'translateX(-50%)';
    healthContainer.style.width = '200px';
    healthContainer.style.padding = '5px';
    healthContainer.style.background = 'rgba(0, 0, 30, 0.7)';
    healthContainer.style.borderRadius = '5px';
    healthContainer.style.boxShadow = '0 0 10px rgba(255, 0, 100, 0.5)';
    
    const healthBar = document.createElement('div');
    healthBar.style.height = '10px';
    healthBar.style.width = '100%';
    healthBar.style.background = 'linear-gradient(90deg, #ff0066, #ff6699)';
    healthBar.style.borderRadius = '3px';
    healthBar.style.boxShadow = 'inset 0 0 5px rgba(0, 0, 0, 0.5)';
    
    healthContainer.appendChild(healthBar);
    this.container.appendChild(healthContainer);
    
    this.elements.healthBar = healthBar;
  }
  
  createSpellsUI() {
    // Create spell selection UI at bottom right
    const spellsContainer = document.createElement('div');
    spellsContainer.style.position = 'absolute';
    spellsContainer.style.bottom = '20px';
    spellsContainer.style.right = '20px';
    spellsContainer.style.display = 'flex';
    spellsContainer.style.gap = '10px';
    spellsContainer.style.pointerEvents = 'auto';
    
    // Create spell slots
    const spells = [
      { name: 'Fireball', color: '#ff3300', key: '1' },
      { name: 'Lightning', color: '#33ccff', key: '2' },
      { name: 'Shield', color: '#ffcc00', key: '3' }
    ];
    
    this.elements.spellSlots = [];
    
    spells.forEach((spell, index) => {
      const spellSlot = document.createElement('div');
      spellSlot.style.width = '50px';
      spellSlot.style.height = '50px';
      spellSlot.style.borderRadius = '5px';
      spellSlot.style.background = 'rgba(0, 0, 30, 0.7)';
      spellSlot.style.display = 'flex';
      spellSlot.style.flexDirection = 'column';
      spellSlot.style.justifyContent = 'center';
      spellSlot.style.alignItems = 'center';
      spellSlot.style.cursor = 'pointer';
      spellSlot.style.transition = 'all 0.2s';
      spellSlot.style.boxShadow = `0 0 10px ${spell.color}80`;
      
      const spellIndicator = document.createElement('div');
      spellIndicator.style.width = '30px';
      spellIndicator.style.height = '30px';
      spellIndicator.style.borderRadius = '50%';
      spellIndicator.style.background = spell.color;
      spellIndicator.style.boxShadow = `0 0 5px ${spell.color}`;
      
      const spellKey = document.createElement('div');
      spellKey.textContent = spell.key;
      spellKey.style.fontSize = '12px';
      spellKey.style.marginTop = '5px';
      
      spellSlot.appendChild(spellIndicator);
      spellSlot.appendChild(spellKey);
      spellsContainer.appendChild(spellSlot);
      
      // Add hover effect
      spellSlot.addEventListener('mouseover', () => {
        spellSlot.style.transform = 'scale(1.1)';
      });
      
      spellSlot.addEventListener('mouseout', () => {
        spellSlot.style.transform = 'scale(1)';
      });
      
      // Add click handler
      spellSlot.addEventListener('click', () => {
        this.selectSpell(index);
      });
      
      this.elements.spellSlots.push({
        element: spellSlot,
        indicator: spellIndicator,
        data: spell
      });
    });
    
    this.container.appendChild(spellsContainer);
    
    // Listen for key presses to select spells
    window.addEventListener('keydown', (event) => {
      if (event.key >= '1' && event.key <= '3') {
        const index = parseInt(event.key) - 1;
        this.selectSpell(index);
      }
    });
  }
  
  createMinimapUI() {
    // Create minimap in top-left corner
    const minimapContainer = document.createElement('div');
    minimapContainer.style.position = 'absolute';
    minimapContainer.style.top = '20px';
    minimapContainer.style.left = '20px';
    minimapContainer.style.width = '150px';
    minimapContainer.style.height = '150px';
    minimapContainer.style.background = 'rgba(0, 0, 30, 0.7)';
    minimapContainer.style.borderRadius = '5px';
    minimapContainer.style.overflow = 'hidden';
    minimapContainer.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
    
    // Create canvas for minimap rendering
    const minimapCanvas = document.createElement('canvas');
    minimapCanvas.width = 150;
    minimapCanvas.height = 150;
    minimapCanvas.style.width = '100%';
    minimapCanvas.style.height = '100%';
    
    minimapContainer.appendChild(minimapCanvas);
    this.container.appendChild(minimapContainer);
    
    this.elements.minimapCanvas = minimapCanvas;
    this.elements.minimapContext = minimapCanvas.getContext('2d');
  }
  
  selectSpell(index) {
    // Highlight selected spell and reset others
    this.elements.spellSlots.forEach((slot, i) => {
      if (i === index) {
        slot.element.style.transform = 'scale(1.1)';
        slot.indicator.style.boxShadow = `0 0 10px ${slot.data.color}`;
      } else {
        slot.element.style.transform = 'scale(1)';
        slot.indicator.style.boxShadow = `0 0 5px ${slot.data.color}`;
      }
    });
    
    // Notify game about spell selection
    if (this.engine.systems.player && this.engine.systems.player.localPlayer) {
      this.engine.systems.player.localPlayer.currentSpell = index;
    }
  }
  
  updateManaDisplay(mana) {
    if (this.elements.manaText) {
      this.elements.manaText.textContent = mana.toString();
      
      // Add pulse animation when mana changes
      this.elements.manaText.style.transform = 'scale(1.2)';
      setTimeout(() => {
        this.elements.manaText.style.transform = 'scale(1)';
      }, 200);
    }
  }
  
  updateHealthDisplay(health, maxHealth) {
    if (this.elements.healthBar) {
      const percentage = (health / maxHealth) * 100;
      this.elements.healthBar.style.width = `${percentage}%`;
      
      // Change color based on health
      if (percentage > 60) {
        this.elements.healthBar.style.background = 'linear-gradient(90deg, #ff0066, #ff6699)';
      } else if (percentage > 30) {
        this.elements.healthBar.style.background = 'linear-gradient(90deg, #ffcc00, #ff9900)';
      } else {
        this.elements.healthBar.style.background = 'linear-gradient(90deg, #ff3300, #ff6600)';
      }
    }
  }
  
  updateMinimap() {
    if (!this.elements.minimapContext || !this.engine.systems.player.localPlayer) return;
    
    const ctx = this.elements.minimapContext;
    const canvas = this.elements.minimapCanvas;
    const worldSize = this.engine.systems.world.worldSize;
    
    // Clear minimap
    ctx.fillStyle = 'rgba(0, 10, 40, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Draw terrain (simplified)
    const terrainGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    terrainGradient.addColorStop(0, 'rgba(0, 50, 100, 0.5)');
    terrainGradient.addColorStop(1, 'rgba(0, 100, 200, 0.7)');
    ctx.fillStyle = terrainGradient;
    
    // Draw random terrain pattern (would be based on actual terrain in full implementation)
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 10 + Math.random() * 20;
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
    ctx.fill();
    
    // Draw mana nodes
    const manaNodes = this.engine.systems.world.manaNodes;
    ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
    
    manaNodes.forEach(node => {
      if (!node.userData.collected) {
        // Convert world position to minimap position
        const x = ((node.position.x + worldSize / 2) / worldSize) * canvas.width;
        const z = ((node.position.z + worldSize / 2) / worldSize) * canvas.height;
        
        ctx.beginPath();
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Draw players
    this.engine.systems.player.players.forEach(player => {
      // Convert world position to minimap position
      const x = ((player.position.x + worldSize / 2) / worldSize) * canvas.width;
      const z = ((player.position.z + worldSize / 2) / worldSize) * canvas.height;
      
      // Draw player dot
      ctx.beginPath();
      if (player.isLocal) {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.arc(x, z, 4, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = 'rgba(255, 100, 100, 1)';
        ctx.arc(x, z, 3, 0, Math.PI * 2);
      }
      ctx.fill();
      
      // Draw direction indicator for local player
      if (player.isLocal) {
        const dirX = Math.sin(player.rotation.y) * 8;
        const dirZ = Math.cos(player.rotation.y) * 8;
        
        ctx.beginPath();
        ctx.moveTo(x, z);
        ctx.lineTo(x + dirX, z + dirZ);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }
  
  update(delta) {
    // Update UI elements that need continuous updates
    
    // Update health display if local player exists
    if (this.engine.systems.player && this.engine.systems.player.localPlayer) {
      const player = this.engine.systems.player.localPlayer;
      this.updateHealthDisplay(player.health, player.maxHealth);
    }
    
    // Update minimap
    this.updateMinimap();
  }
}
```

## 7. Main Game Initialization

### 7.1. Create Main Entry Point
Create src/main.js:
```javascript
import { Engine } from './game/core/Engine';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Create and initialize game engine
    const engine = new Engine();
    await engine.initialize();
    
    console.log('Magical Vibe Carpet initialized successfully!');
  } catch (error) {
    console.error('Error initializing game:', error);
    document.getElementById('loading-text').textContent = 'Error loading game. Please refresh.';
  }
});
```

## 8. Testing and Deployment

### 8.1. Local Development Testing
```bash
# Run these commands to start local development server
npm install
npm run dev
```

### 8.2. Production Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### 8.3. Deployment
Deploy the contents of the `dist` directory to any static web hosting service such as:
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Firebase Hosting

## Notes for LLM Implementation

When implementing this game, consider the following:

1. **Performance Optimization**:
   - Implement asset loading prioritization to show the game faster
   - Use LOD (Level of Detail) for distant objects
   - Consider implementing frustum culling for large worlds
   - Optimize terrain generation and rendering

2. **Multiplayer Implementation**:
   - For a full implementation, you'll need a proper backend server
   - Consider WebRTC for peer-to-peer connections to reduce server load
   - Implement client-side prediction and server reconciliation

3. **Mobile Considerations**:
   - Test touch controls thoroughly on various devices
   - Optimize rendering for lower-powered devices
   - Add responsive UI that adapts to different screen sizes

4. **Gameplay Extensions**:
   - Add more spell types and effects
   - Implement different game modes (capture the flag, team deathmatch)
   - Add progression system for longer engagement

5. **Asset Creation**:
   - Create or source low-poly models for efficient loading
   - Design particle effects for spells and interactions
   - Create sound effects and background music

This implementation guide provides a solid foundation for building the Magical Vibe Carpet game. Follow the steps sequentially to build a complete game that meets all the specified requirements.
