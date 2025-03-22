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
    
    // Create fallback assets
    this.createFallbackAssets();
    
    // Asset loaders
    this.loadingManager = new THREE.LoadingManager(
      // onLoad
      () => {
        console.log('All assets loaded');
      },
      // onProgress
      (url, itemsLoaded, itemsTotal) => {
        const progress = (itemsLoaded / itemsTotal) * 100;
        const progressEl = document.getElementById('progress');
        const loadingTextEl = document.getElementById('loading-text');
        
        if (progressEl) progressEl.style.width = `${progress}%`;
        if (loadingTextEl) loadingTextEl.textContent = `Loading assets (${itemsLoaded}/${itemsTotal})`;
      },
      // onError
      (url) => {
        console.warn(`Asset not found: ${url} - using fallback`);
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
  
  createFallbackAssets() {
    // Create fallback texture
    const fallbackTexture = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 255, 200, 200, 200, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 
      2, 2, THREE.RGBAFormat
    );
    fallbackTexture.needsUpdate = true;
    this.textures.fallback = fallbackTexture;
    
    // Create fallback carpet texture
    const carpetData = new Uint8Array([
      180, 120, 60, 255, 200, 140, 80, 255,
      200, 140, 80, 255, 180, 120, 60, 255
    ]);
    const carpetTexture = new THREE.DataTexture(carpetData, 2, 2, THREE.RGBAFormat);
    carpetTexture.wrapS = THREE.RepeatWrapping;
    carpetTexture.wrapT = THREE.RepeatWrapping;
    carpetTexture.repeat.set(4, 4);
    carpetTexture.needsUpdate = true;
    this.textures.carpet = carpetTexture;
    
    // Create fallback terrain texture
    const terrainData = new Uint8Array([
      100, 150, 50, 255, 120, 160, 60, 255,
      80, 140, 40, 255, 110, 170, 55, 255
    ]);
    const terrainTexture = new THREE.DataTexture(terrainData, 2, 2, THREE.RGBAFormat);
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;
    terrainTexture.repeat.set(100, 100);
    terrainTexture.needsUpdate = true;
    this.textures.terrain = terrainTexture;
    
    // Create fallback sky texture
    const skyData = new Uint8Array([
      100, 150, 255, 255, 120, 170, 255, 255,
      120, 170, 255, 255, 100, 150, 255, 255
    ]);
    const skyTexture = new THREE.DataTexture(skyData, 2, 2, THREE.RGBAFormat);
    skyTexture.needsUpdate = true;
    this.textures.sky = skyTexture;
    
    // Create fallback particles texture
    const particlesData = new Uint8Array([
      255, 255, 255, 0, 255, 255, 255, 128,
      255, 255, 255, 128, 255, 255, 255, 0
    ]);
    const particlesTexture = new THREE.DataTexture(particlesData, 2, 2, THREE.RGBAFormat);
    particlesTexture.needsUpdate = true;
    this.textures.particles = particlesTexture;
    
    // Create procedural carpet model
    const carpetGeometry = new THREE.BoxGeometry(2, 0.1, 3);
    const carpetMaterial = new THREE.MeshStandardMaterial({ 
      map: carpetTexture,
      roughness: 0.7,
      metalness: 0.2
    });
    const carpetMesh = new THREE.Mesh(carpetGeometry, carpetMaterial);
    
    // Add decorative elements to the carpet
    const borderGeometry = new THREE.BoxGeometry(2.2, 0.05, 3.2);
    const borderMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
    borderMesh.position.y = -0.05;
    carpetMesh.add(borderMesh);
    
    // Add carpet tassels
    const tasselGroup = new THREE.Group();
    const tasselGeometry = new THREE.CylinderGeometry(0.03, 0.01, 0.2, 4);
    const tasselMaterial = new THREE.MeshStandardMaterial({ color: 0xDDDDAA });
    
    for (let i = 0; i < 10; i++) {
      const tassel = new THREE.Mesh(tasselGeometry, tasselMaterial);
      tassel.position.set(-1 + (i * 0.2), -0.1, 1.5);
      tasselGroup.add(tassel);
      
      const tassel2 = new THREE.Mesh(tasselGeometry, tasselMaterial);
      tassel2.position.set(-1 + (i * 0.2), -0.1, -1.5);
      tasselGroup.add(tassel2);
    }
    
    carpetMesh.add(tasselGroup);
    
    // Create a simple scene for the carpet
    const carpetScene = {
      scene: { children: [carpetMesh] },
      animations: []
    };
    this.models.carpet = carpetScene;
    
    // Create procedural mana orb model
    const manaGeometry = new THREE.SphereGeometry(1, 16, 16);
    const manaMaterial = new THREE.MeshStandardMaterial({
      color: 0x00FFFF,
      emissive: 0x00AAFF,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8
    });
    const manaMesh = new THREE.Mesh(manaGeometry, manaMaterial);
    
    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(1.2, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FFFF,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    manaMesh.add(glowMesh);
    
    // Create a simple scene for the mana orb
    const manaScene = {
      scene: { children: [manaMesh] },
      animations: []
    };
    this.models.mana = manaScene;
    
    // Create fallback audio buffers
    this.audio.fallback = null; // We'll handle this in getAudio
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
    return this.textures[name] || this.textures.fallback;
  }
  
  getModel(name) {
    return this.models[name];
  }
  
  getAudio(name) {
    return this.audio[name] || this.audio.fallback;
  }
  
  // Create reusable materials
  createMaterials() {
    this.materials.carpet = new THREE.MeshStandardMaterial({
      map: this.getTexture('carpet'),
      roughness: 0.7,
      metalness: 0.2
    });
    
    this.materials.terrain = new THREE.MeshStandardMaterial({
      map: this.getTexture('terrain'),
      roughness: 0.9,
      metalness: 0.1
    });
  }
}
