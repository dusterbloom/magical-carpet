import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

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
