import * as THREE from 'three';

import { WaterSurfaceComplex } from '../../../WaterSurface/Water/WaterSurfaceComplex.js';
import { FluidFX } from '../../../WaterSurface/InteractiveFX/FluidFX.js';

export class WaterSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.worldSystem = engine.systems.world;
    
    // Water bodies
    this.oceanMesh = null;
    this.shorelineMesh = null;
    this.riverSegments = new Map();
    this.lakesMeshes = [];
    this.waterLevel = this.worldSystem.waterLevel || 0;
    
    // New water surface components
    this.waterSurface = null;
    this.fluidFX = null;
    
    // River flow path data
    this.riverPaths = [];
    this.riverWidth = 15;
    this.riverCount = 5;
    
    // Materials
    this.materials = {
      ocean: null,
      river: null,
      lake: null,
      shoreline: null
    };
    
    // Water animation
    this.time = 0;
  }
  
  async initialize() {
    console.log("Initializing WaterSystem...");
    
    // Skip materials creation as we're using WaterSurfaceComplex directly
    
    // Initialize new water surface
    this.initializeWaterSurface();
    
    // Generate empty river paths
    this.generateRiverPaths();
    
    // Create shoreline buffer
    // this.createShoreline();
    
    console.log("WaterSystem initialized");
  }

  initializeWaterSurface() {
    console.log("Creating water surface with simplified approach...");
    
    // Create separate components: main water body + shoreline
    this.createMainWater();
    // this.createShoreline();
    
    console.log("Water surface created");
  }
  
  createMainWater() {
    // Create a MUCH larger water surface for main water body
    const oceanSize = this.worldSystem.chunkSize * 40; // Even larger to ensure coverage
    
    // Very simple, low-detail geometry for the main water body
    const waterGeometry = new THREE.PlaneGeometry(
      oceanSize,
      oceanSize,
      64,  // Lower resolution is fine for main water
      64
    );
    
    // Add subtle random height variations for more natural look
    this.createWaterWaves(waterGeometry);
    
    // Position water exactly at water level
    const waterPos = [0, this.waterLevel, 0];
    
    // Create water surface with darker blue for depth
    this.waterSurface = new WaterSurfaceComplex({
      geometry: waterGeometry,
      position: waterPos,
      color: 0x003366,  // Darker blue for deep water
      scale: 0.8,       // Less distortion
      flowDirection: [1, 1],
      flowSpeed: 0.0001,  // Very slow and subtle flow
      reflectivity: 0.2,
      fxDistortionFactor: 0.02,
      fxDisplayColorAlpha: 0.3
    });

    // Add fluid effects
    this.fluidFX = new FluidFX({
      densityDissipation: 0.98,
      velocityDissipation: 0.99,
      velocityAcceleration: 5,
      curlStrength: 15
    });

    // Configure the water mesh
    const waterMesh = this.waterSurface.getMesh();
    waterMesh.receiveShadow = true;
    
    // Very simple rendering settings
    if (waterMesh.material) {
      waterMesh.material.transparent = true;
      waterMesh.material.opacity = 0.9;
         waterMesh.material.depthWrite = false;
            // Enable polygon offset to push water slightly forward
            waterMesh.material.polygonOffset = true;
            waterMesh.material.polygonOffsetFactor = -1;  // push closer to camera
           waterMesh.material.polygonOffsetUnits = -1;
            
            waterMesh.renderOrder = 1;  // Render after terrain (0) but before shoreline (set later)
    }
    
    // Add main water body to scene
    this.scene.add(waterMesh);
  }
  
  createShoreline() {
    console.log("Creating shoreline transition...");
    
    // Create a ring-shaped shoreline that will blend water and land
    const shoreSize = this.worldSystem.chunkSize * 20;
    const innerRadius = shoreSize * 0.33; // Controls where shoreline starts
    const outerRadius = shoreSize * 0.5;  // Controls where shoreline ends
    
    // Create a high-resolution ring for the shoreline
    const segments = 128; // High segment count for smooth edge
    const rings = 24;     // Multiple rings for gradual transition
    
    const shorelineGeometry = new THREE.RingGeometry(
      innerRadius, outerRadius, segments, rings
    );
    
    // Rotate to lie flat
    shorelineGeometry.rotateX(-Math.PI / 0.5);
    
    // We'll calculate vertex colors for the shoreline
    const positions = shorelineGeometry.attributes.position.array;
    const colors = [];
    
    // Need to create a colors buffer
    for (let i = 0; i < positions.length / 3; i++) {
      const i3 = i * 3;
      const x = positions[i3];
      const y = positions[i3 + 1];
      const z = positions[i3 + 2];
      
      // Calculate distance from center as percentage
      const distFromCenter = Math.sqrt(x*x + z*z);
      const t = (distFromCenter - innerRadius) / (outerRadius - innerRadius);
      
      // Create color gradient from water to sand
      const waterColor = new THREE.Color(0x3399ff);   // Blue for water side
      const sandColor = new THREE.Color(0xDDCCAA);    // Tan for sand side
      
      // Create noise pattern for irregular edge
      const noiseScale = 0.05;
      const noiseVal = Math.sin(x * noiseScale) * Math.cos(z * noiseScale) * 0.15;
      
      // Adjust transition with noise for irregular edge
      const adjustedT = Math.max(0, Math.min(1, t + noiseVal));
      
      // Mix colors based on position in ring
      const mixedColor = new THREE.Color().copy(waterColor).lerp(sandColor, adjustedT);
      
      // Add to colors array
      colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
      
      // Also vary height for subtle undulation
      positions[i3 + 1] = (Math.random() - 0.5) * 0.3 + this.waterLevel;
    }
    
    // Add colors attribute to geometry
    shorelineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Create a material for the shoreline
    const shorelineMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1,
      depthWrite: false,
    });
    
    // Create the shoreline mesh
    this.shorelineMesh = new THREE.Mesh(shorelineGeometry, shorelineMaterial);
    this.shorelineMesh.renderOrder = 2;
    this.shorelineMesh.position.y = this.waterLevel + 0.15;
    
    // Add shoreline to scene
    this.scene.add(this.shorelineMesh);
  }



  // We're no longer using this approach
  // Instead, we're relying on the natural intersection between
  // the water plane and terrain geometry
  createWaterWaves(geometry) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) {
      console.error("Invalid geometry for wave creation");
      return geometry;
    }
    
    const positions = geometry.attributes.position.array;
    const count = positions.length / 3;
    
    // Add subtle random height variation to water surface
    // to break up the perfectly flat appearance
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Y is the height coordinate (index 1)
      // Add very small random height offset
      positions[i3 + 1] += (Math.random() - 0.5) * 0.02;
    }
    
    // Update normals after position changes
    geometry.computeVertexNormals();
    return geometry;
  }

  generateRiverPaths() {
    // Empty implementation to prevent errors
    console.log("River paths generation skipped");
    this.riverPaths = [];
  }

  update(delta) {
    // Update water animations
    if (this.waterSurface) {
      this.waterSurface.update(delta);
    }
    
    if (this.fluidFX) {
      this.fluidFX.update(this.engine.renderer, delta);
    }

    // Follow player with water and shoreline
    const player = this.engine.systems.player?.localPlayer;
    if (player) {
      // Update main water position
      if (this.waterSurface) {
        const waterMesh = this.waterSurface.getMesh();
        waterMesh.position.x = player.position.x;
        waterMesh.position.z = player.position.z;
      }
      
      // Update shoreline position
      if (this.shorelineMesh) {
        this.shorelineMesh.position.x = player.position.x;
        this.shorelineMesh.position.z = player.position.z;
        
        // Add subtle animation to shoreline
        this.time += delta;
        const waveAmount = 0.05;
        this.shorelineMesh.position.y = this.waterLevel + 0.1 + 
          Math.sin(this.time * 0.5) * waveAmount;
      }
    }
  }

  dispose() {
    // Clean up main water surface
    if (this.waterSurface) {
      const waterMesh = this.waterSurface.getMesh();
      this.scene.remove(waterMesh);
      this.waterSurface.dispose();
      this.waterSurface = null;
    }

    // Clean up fluid effects
    if (this.fluidFX) {
      this.fluidFX.dispose();
      this.fluidFX = null;
    }
    
    // Clean up shoreline
    if (this.shorelineMesh) {
      this.scene.remove(this.shorelineMesh);
      if (this.shorelineMesh.geometry) {
        this.shorelineMesh.geometry.dispose();
      }
      if (this.shorelineMesh.material) {
        this.shorelineMesh.material.dispose();
      }
      this.shorelineMesh = null;
    }
  }
}

// MODIFY THE WATERSURFACECOMPLEX.JS CONSTRUCTOR
// To accept a custom geometry and use vertex colors
