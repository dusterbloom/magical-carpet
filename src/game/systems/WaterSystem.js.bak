import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water2.js';

// WATER SYSTEM CONFIGURATION
// All configurable parameters are defined here for easy tuning
const WATER_CONFIG = {
  // Global water system settings
  waterLevel: 0,             // Base water level in world
  renderDistance: 2000,      // Maximum render distance for water
  
  // Main water surface properties
  surface: {
    color: 0x003366,         // Deep water color
    opacity: 0.9,            // Water surface opacity
    scale: 1.0,              // Wave scale
    flowSpeed: 0.05,         // Water flow animation speed
    flowDirection: [1, 1],   // Flow direction vector
    distortionScale: 1.5,    // Wave distortion intensity
    reflectivity: 0.2,       // Water surface reflectivity
  },
  
  // Shoreline configuration
  shoreline: {
    width: 60,               // Width of shoreline transition
    segments: 256,           // Smoothness of shoreline edge
    color: {
      deep: 0x0066aa,        // Deep water color
      shallow: 0x88aacc,     // Shallow water color
      wetSand: 0xd9d0b0,     // Wet sand color
      beach: 0xe8e4cf,       // Dry beach color
    },
    opacity: 0.85,           // Shoreline opacity
    waveSpeed: 0.3,          // Shoreline wave animation speed
  },
  
  // River generation parameters
  rivers: {
    count: 5,                // Number of rivers to generate
    width: 15,               // River width
    maxSegments: 1000,       // Maximum river path segments
    flowVariation: 0.2,      // River flow randomness
  }
};

export class WaterSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.worldSystem = engine.systems.world;
    
    // Water bodies and management
    this.waterMesh = null;
    this.shorelineMesh = null;
    this.riverSegments = new Map();
    
    // Time tracking for animations
    this.time = 0;
    
    // Configuration
    this.config = WATER_CONFIG;
  }
  
  async initialize() {
    console.log("Initializing Unified Water System...");
    
    this.createMainWaterSurface();
    this.createShoreline();
    this.generateRiverPaths();
    
    console.log("Water System initialized successfully");
  }
  
  createMainWaterSurface() {
    const oceanSize = this.worldSystem.chunkSize * 40;
    const waterGeometry = new THREE.PlaneGeometry(
      oceanSize, oceanSize, 64, 64
    );
    
    this.addWaveVariation(waterGeometry);
    
    const waterParams = {
      color: this.config.surface.color,
      scale: this.config.surface.scale,
      flowDirection: new THREE.Vector2(...this.config.surface.flowDirection),
      flowSpeed: this.config.surface.flowSpeed,
      textureWidth: 1024,
      textureHeight: 1024,
      reflectivity: this.config.surface.reflectivity,
      distortionScale: this.config.surface.distortionScale,
    };
    
    this.waterMesh = new Water(waterGeometry, waterParams);
    this.waterMesh.position.set(0, this.config.waterLevel, 0);
    this.waterMesh.rotation.x = -Math.PI / 2;
    
    // Apply rendering optimizations
    if (this.waterMesh.material) {
      this.waterMesh.material.transparent = true;
      this.waterMesh.material.opacity = this.config.surface.opacity;
      this.waterMesh.material.depthWrite = false;
      this.waterMesh.renderOrder = 1;
    }
    
    this.scene.add(this.waterMesh);
  }
  
  addWaveVariation(geometry) {
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += (Math.random() - 0.5) * 0.02;
    }
    geometry.computeVertexNormals();
  }
  
  createShoreline() {
    const oceanSize = this.worldSystem.chunkSize * 20;
    const cfg = this.config.shoreline;
    
    const shoreGeometry = new THREE.RingGeometry(
      oceanSize / 2 - cfg.width, 
      oceanSize / 2 + cfg.width, 
      cfg.segments, 
      24
    );
    
    const colors = this.generateShorelineColors(shoreGeometry);
    shoreGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const shoreMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: cfg.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    
    this.shorelineMesh = new THREE.Mesh(shoreGeometry, shoreMaterial);
    this.shorelineMesh.rotation.x = -Math.PI / 2;
    this.shorelineMesh.position.y = this.config.waterLevel - 0.15;
    this.shorelineMesh.renderOrder = 2;
    
    this.scene.add(this.shorelineMesh);
  }
  
  generateShorelineColors(geometry) {
    const cfg = this.config.shoreline.color;
    const positions = geometry.attributes.position.array;
    const colors = [];
    
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      const distFromCenter = Math.sqrt(x*x + z*z);
      const maxDistance = this.worldSystem.chunkSize * 10;
      const t = Math.min(1, distFromCenter / maxDistance);
      
      const waterColor = new THREE.Color(cfg.deep);
      const beachColor = new THREE.Color(cfg.beach);
      const mixedColor = waterColor.lerp(beachColor, t);
      
      colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
    }
    
    return colors;
  }
  
  generateRiverPaths() {
    const cfg = this.config.rivers;
    this.riverPaths = [];
    
    for (let i = 0; i < cfg.count; i++) {
      const startX = (Math.random() - 0.5) * this.config.renderDistance;
      const startZ = (Math.random() - 0.5) * this.config.renderDistance;
      
      const riverPath = this.generateSingleRiverPath(startX, startZ);
      if (riverPath.length > 0) {
        this.riverPaths.push(riverPath);
      }
    }
  }
  
  generateSingleRiverPath(startX, startZ) {
    const cfg = this.config.rivers;
    const path = [{ x: startX, z: startZ, y: this.worldSystem.getTerrainHeight(startX, startZ) }];
    
    let currentX = startX;
    let currentZ = startZ;
    let currentHeight = path[0].y;
    
    for (let i = 0; i < cfg.maxSegments && currentHeight > this.config.waterLevel + 0.5; i++) {
      const sampleRadius = 15;
      let lowestHeight = currentHeight;
      let lowestX = currentX;
      let lowestZ = currentZ;
      
      // Sample surrounding points
      for (let j = 0; j < 8; j++) {
        const angle = (j / 8) * Math.PI * 2;
        const sampleX = currentX + Math.cos(angle) * sampleRadius;
        const sampleZ = currentZ + Math.sin(angle) * sampleRadius;
        const height = this.worldSystem.getTerrainHeight(sampleX, sampleZ);
        
        if (height < lowestHeight) {
          lowestHeight = height;
          lowestX = sampleX;
          lowestZ = sampleZ;
        }
      }
      
      // Add some randomness to prevent perfectly straight rivers
      lowestX += (Math.random() - 0.5) * cfg.flowVariation * sampleRadius;
      lowestZ += (Math.random() - 0.5) * cfg.flowVariation * sampleRadius;
      
      path.push({ x: lowestX, z: lowestZ, y: lowestHeight });
      
      currentX = lowestX;
      currentZ = lowestZ;
      currentHeight = lowestHeight;
    }
    
    return path;
  }
  
  update(delta) {
    this.time += delta;
    
    // Update water surface animation
    if (this.waterMesh && 
        this.waterMesh.material && 
        this.waterMesh.material.uniforms) {
      // Safely check and update uniforms
      if (this.waterMesh.material.uniforms.time) {
        this.waterMesh.material.uniforms.time.value = this.time * this.config.surface.flowSpeed;
      }
      
      if (this.waterMesh.material.uniforms.distortionScale) {
        this.waterMesh.material.uniforms.distortionScale.value = 
          Math.sin(this.time * 0.1) * 0.2 + this.config.surface.distortionScale;
      }
    }
    
    // Animate shoreline
    if (this.shorelineMesh) {
      const cfg = this.config.shoreline;
      this.shorelineMesh.material.opacity = cfg.opacity + 
        Math.sin(this.time * cfg.waveSpeed) * 0.03;
    }
    
    // Follow player
    const player = this.engine.systems.player?.localPlayer;
    if (player) {
      if (this.waterMesh) {
        this.waterMesh.position.x = player.position.x;
        this.waterMesh.position.z = player.position.z;
      }
      
      if (this.shorelineMesh) {
        this.shorelineMesh.position.x = player.position.x;
        this.shorelineMesh.position.z = player.position.z;
      }
    }
  }
  
  dispose() {
    // Clean up all water-related meshes and materials
    const disposeMesh = (mesh) => {
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
      }
    };
    
    disposeMesh(this.waterMesh);
    disposeMesh(this.shorelineMesh);
    
    this.riverSegments.forEach(disposeMesh);
    this.riverSegments.clear();
    
    this.waterMesh = null;
    this.shorelineMesh = null;
  }
}