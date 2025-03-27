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
    
    // Create materials
    this.createMaterials();
    
    // Initialize new water surface
    this.initializeWaterSurface();
    
    // Generate rivers
    this.generateRiverPaths();
    
    // Create ocean
    this.createOcean();
    
    // Create shoreline buffer
    this.createShoreline();
    
    console.log("WaterSystem initialized");
  }

  initializeWaterSurface() {
    // Create the complex water surface
    const oceanSize = this.worldSystem.chunkSize * 20;
    this.waterSurface = new WaterSurfaceComplex({
      width: oceanSize,
      length: oceanSize,
      position: [0, this.waterLevel - 0.3, 0],
      color: 0x4a7eb5,
      scale: 3.5,
      flowDirection: [1, 1],
      flowSpeed: 0.25,
      dimensions: 512,
      reflectivity: 0.25,
      fxDistortionFactor: 0.08,
      fxDisplayColorAlpha: 0.3
    });

    // Add fluid effects
    this.fluidFX = new FluidFX({
      densityDissipation: 0.97,
      velocityDissipation: 0.98,
      velocityAcceleration: 10,
      curlStrength: 35
    });

    // Add water surface to scene
    const waterMesh = this.waterSurface.getMesh();
    waterMesh.receiveShadow = true;
    this.scene.add(waterMesh);
  }
  
  createMaterials() {
    // Shared water properties
    const waterColor = new THREE.Color(0x4a7eb5);
    
    // Load normal maps for materials
    const textureLoader = new THREE.TextureLoader();
    const waterNormalMap1 = textureLoader.load('/water/complex/Water_1_M_Normal.jpg');
    waterNormalMap1.wrapS = waterNormalMap1.wrapT = THREE.RepeatWrapping;

    // Create ocean material
    this.materials.ocean = new THREE.MeshStandardMaterial({
      color: waterColor,
      transparent: true,
      opacity: 0.8,
      metalness: 0.2,
      roughness: 0.2,
      normalMap: waterNormalMap1,
      normalScale: new THREE.Vector2(0.5, 0.5),
      envMapIntensity: 0.8
    });
    
    // Create river material
    this.materials.river = new THREE.MeshStandardMaterial({
      color: waterColor.clone().multiplyScalar(1.2),
      transparent: true,
      opacity: 0.6,
      metalness: 0.2,
      roughness: 0.1
    });
    
    // Create lake material
    this.materials.lake = new THREE.MeshStandardMaterial({
      color: waterColor.clone().multiplyScalar(1.1),
      transparent: true,
      opacity: 0.65,
      metalness: 0.15,
      roughness: 0.2
    });
    
    // Create shoreline material
    this.materials.shoreline = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x88CCFF),
      transparent: true,
      opacity: 0.8,
      metalness: 0.05,
      roughness: 0.1
    });
  }
  
  createShorelineAlphaMap() {
    // Create a gradual alpha map for shoreline blending
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    
    // Create radial gradient for alpha
    const gradient = ctx.createRadialGradient(
      size/2, size/2, size * 0.3,
      size/2, size/2, size * 0.5
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    
    return texture;
  }
  
  createShoreline() {
    const oceanSize = this.worldSystem.chunkSize * 20;
    const shorelineWidth = 40;
    const segments = 192;
    const radialSegments = 12;
    
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];
    const uvs = [];
    const indices = [];
    
    const centerX = 0;
    const centerZ = 0;
    const innerRadius = oceanSize / 2 - shorelineWidth;
    const outerRadius = oceanSize / 2 + shorelineWidth;
    
    const waterColor = new THREE.Color(0x0066aa);
    const shallowWaterColor = new THREE.Color(0x88aacc);
    const wetSandColor = new THREE.Color(0xd9d0b0);
    const beachColor = new THREE.Color(0xe8e4cf);
    
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      
      for (let r = 0; r <= radialSegments; r++) {
        const radius = innerRadius + (outerRadius - innerRadius) * (r / radialSegments);
        
        const x = centerX + radius * cosTheta;
        const z = centerZ + radius * sinTheta;
        const y = 0;
        
        vertices.push(x, y, z);
        uvs.push(i / segments, r / radialSegments);
        
        const t = r / radialSegments;
        let color;
        
        if (t < 0.3) {
          const normalizedT = t / 0.3;
          color = new THREE.Color().copy(waterColor).lerp(shallowWaterColor, normalizedT);
        } else if (t < 0.65) {
          const normalizedT = (t - 0.3) / 0.35;
          color = new THREE.Color().copy(shallowWaterColor).lerp(wetSandColor, normalizedT);
        } else {
          const normalizedT = (t - 0.65) / 0.35;
          color = new THREE.Color().copy(wetSandColor).lerp(beachColor, normalizedT);
        }
        
        colors.push(color.r, color.g, color.b);
      }
    }
    
    for (let i = 0; i < segments; i++) {
      for (let r = 0; r < radialSegments; r++) {
        const a = i * (radialSegments + 1) + r;
        const b = i * (radialSegments + 1) + r + 1;
        const c = (i + 1) * (radialSegments + 1) + r;
        const d = (i + 1) * (radialSegments + 1) + r + 1;
        
        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    

const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      metalness: 0.15,
      roughness: 0.4,
      side: THREE.DoubleSide,
      flatShading: false,
      alphaMap: this.createShorelineAlphaMap(),
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation
    });

    this.shorelineMesh = new THREE.Mesh(geometry, material);
    this.materials.shoreline = material;
    
    this.shorelineMesh.position.y = this.waterLevel - 0.2;
    this.shorelineMesh.rotation.x = -Math.PI / 2;
    
    this.scene.add(this.shorelineMesh);
  }
  
  createOcean() {
    const oceanSize = this.worldSystem.chunkSize * 20;
    const segments = 32;
    const oceanGeometry = new THREE.PlaneGeometry(oceanSize, oceanSize, segments, segments);
    oceanGeometry.rotateX(-Math.PI / 2);
    
    const positions = oceanGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      const maxDistance = oceanSize * 0.5;
      
      const edgeFactor = Math.max(0, 1 - distanceFromCenter / maxDistance);
      positions[i + 1] = (Math.random() - 0.5) * 0.6 * edgeFactor;
    }
    
    oceanGeometry.computeVertexNormals();
    
    this.oceanMesh = new THREE.Mesh(oceanGeometry, this.materials.ocean);
    this.oceanMesh.position.y = this.waterLevel - 0.5;
    this.oceanMesh.receiveShadow = true;
    
    this.scene.add(this.oceanMesh);
  }
  
  generateRiverPaths() {
    this.riverPaths = [];
    const chunkSize = this.worldSystem.chunkSize;
    const worldExtent = chunkSize * this.worldSystem.viewDistance * 2;
    
    for (let i = 0; i < this.riverCount; i++) {
      const startX = (Math.random() - 0.5) * worldExtent;
      const startZ = (Math.random() - 0.5) * worldExtent;
      
      let bestHeight = -Infinity;
      let bestX = startX;
      let bestZ = startZ;
      
      for (let j = 0; j < 20; j++) {
        const sampleX = startX + (Math.random() - 0.5) * 500;
        const sampleZ = startZ + (Math.random() - 0.5) * 500;
        const height = this.worldSystem.getTerrainHeight(sampleX, sampleZ);
        
        if (height > bestHeight && height > this.waterLevel + 30) {
          bestHeight = height;
          bestX = sampleX;
          bestZ = sampleZ;
        }
      }
      
      if (bestHeight === -Infinity) continue;
      
      const riverPath = this.generateRiverFlow(bestX, bestZ);
      if (riverPath.length > 0) {
        this.riverPaths.push(riverPath);
      }
    }
  }
  
  generateRiverFlow(startX, startZ) {
    const path = [];
    let currentX = startX;
    let currentZ = startZ;
    let currentHeight = this.worldSystem.getTerrainHeight(currentX, currentZ);
    
    path.push({ x: currentX, z: currentZ, y: currentHeight });
    
    const maxSegments = 1000;
    let segmentCount = 0;
    
    while (currentHeight > this.waterLevel + 0.5 && segmentCount < maxSegments) {
      const sampleRadius = 15;
      const sampleCount = 8;
      let lowestHeight = currentHeight;
      let lowestX = currentX;
      let lowestZ = currentZ;
      
      for (let i = 0; i < sampleCount; i++) {
        const angle = (i / sampleCount) * Math.PI * 2;
        const sampleX = currentX + Math.cos(angle) * sampleRadius;
        const sampleZ = currentZ + Math.sin(angle) * sampleRadius;
        const height = this.worldSystem.getTerrainHeight(sampleX, sampleZ);
        
        if (height < lowestHeight) {
          lowestHeight = height;
          lowestX = sampleX;
          lowestZ = sampleZ;
        }
      }
      
      if (lowestHeight >= currentHeight) {
        lowestX = currentX + (Math.random() - 0.5) * 20;
        lowestZ = currentZ + (Math.random() - 0.5) * 20;
        lowestHeight = this.worldSystem.getTerrainHeight(lowestX, lowestZ);
        
        if (lowestHeight >= currentHeight) break;
      }
      
      path.push({ x: lowestX, z: lowestZ, y: lowestHeight });
      
      currentX = lowestX;
      currentZ = lowestZ;
      currentHeight = lowestHeight;
      
      segmentCount++;
    }
    
    return path;
  }
  
  createRiverMeshForSegment(path, startIndex, endIndex) {
    if (startIndex >= endIndex || endIndex >= path.length) return null;
    
    const points = [];
    for (let i = startIndex; i <= endIndex; i++) {
      points.push(new THREE.Vector3(path[i].x, path[i].y + 0.2, path[i].z));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    const segments = (endIndex - startIndex) * 2;
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, this.riverWidth / 2, 8, false);
    
    const river = new THREE.Mesh(tubeGeometry, this.materials.river);
    river.receiveShadow = true;
    
    return river;
  }
  
  updateRivers() {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    const chunkSize = this.worldSystem.chunkSize;
    const playerChunkX = Math.floor(player.position.x / chunkSize);
    const playerChunkZ = Math.floor(player.position.z / chunkSize);
    const viewDistance = this.worldSystem.viewDistance;
    const chunksToKeep = new Set();
    
    this.riverPaths.forEach((path, riverIndex) => {
      for (let i = 0; i < path.length - 1; i++) {
        const startChunkX = Math.floor(path[i].x / chunkSize);
        const startChunkZ = Math.floor(path[i].z / chunkSize);
        
        const distX = Math.abs(startChunkX - playerChunkX);
        const distZ = Math.abs(startChunkZ - playerChunkZ);
        const isVisible = Math.sqrt(distX * distX + distZ * distZ) <= viewDistance;
        
        if (isVisible) {
          const key = `river_${riverIndex}_${i}`;
          chunksToKeep.add(key);
          
          if (!this.riverSegments.has(key)) {
            let endIndex = i + 1;
            while (endIndex < path.length &&
                  Math.abs(Math.floor(path[endIndex].x / chunkSize) - startChunkX) <= 1 &&
                  Math.abs(Math.floor(path[endIndex].z / chunkSize) - startChunkZ) <= 1) {
              endIndex++;
            }
            
            const riverMesh = this.createRiverMeshForSegment(path, i, Math.min(endIndex, path.length - 1));
            
            if (riverMesh) {
              this.scene.add(riverMesh);
              this.riverSegments.set(key, riverMesh);
            }
          }
        }
      }
    });
    
    for (const [key, mesh] of this.riverSegments.entries()) {
      if (!chunksToKeep.has(key)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.riverSegments.delete(key);
      }
    }
  }
  
  updateOcean() {
    const player = this.engine.systems.player?.localPlayer;
    if (player) {
      if (this.oceanMesh) {
        this.oceanMesh.position.x = player.position.x;
        this.oceanMesh.position.z = player.position.z;
      }
      
      if (this.shorelineMesh) {
        this.shorelineMesh.position.x = player.position.x;
        this.shorelineMesh.position.z = player.position.z;
      }
    }
  }
  
  animateWater(delta) {
    this.time += delta;
    
    if (this.oceanMesh) {
      if (this.oceanMesh.geometry.attributes && this.oceanMesh.geometry.attributes.position) {
        const positions = this.oceanMesh.geometry.attributes.position.array;
        
        const waveSpeed = 0.2;
        const waveHeight = 0.6;
        const wavePeriod = 20.0;
        
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i];
          const z = positions[i + 2];
          
          const distanceFromCenter = Math.sqrt(x * x + z * z);
          const maxDistance = this.worldSystem.chunkSize * 10;
          const edgeFactor = Math.max(0, 1 - distanceFromCenter / maxDistance);
          
          const vertexOffset = (x * 0.02) + (z * 0.02);
          
          // Main waves
          const waveOffset = Math.sin((this.time * waveSpeed) + vertexOffset) * waveHeight * edgeFactor;
          
          // Secondary waves for complexity
          const waveOffset2 = Math.cos((this.time * waveSpeed * 0.7) + vertexOffset * 1.3) * waveHeight * 0.4 * edgeFactor;
          
          // Fine ripples
          const rippleOffset = Math.sin((this.time * waveSpeed * 2.2) + (x * 0.1) + (z * 0.1)) * waveHeight * 0.15 * edgeFactor;
          
          // Wind-driven choppy waves
          const choppyOffset = Math.sin((this.time * waveSpeed * 1.5) + (x * 0.05) - (z * 0.07)) * 
                               Math.cos((this.time * waveSpeed * 1.2) - (x * 0.06) + (z * 0.04)) * 
                               waveHeight * 0.2 * edgeFactor;
          
          if (!this.initialWaveHeights) {
            this.initialWaveHeights = new Float32Array(positions.length / 3);
            for (let j = 0; j < positions.length / 3; j++) {
              this.initialWaveHeights[j] = Math.sin(j * 0.1) * 0.2;
            }
          }
          
          const idx = Math.floor(i / 3);
          const baseHeight = this.initialWaveHeights[idx] || 0;
          
          positions[i + 1] = baseHeight + waveOffset + waveOffset2 + rippleOffset + choppyOffset;
        }
        
        this.oceanMesh.geometry.attributes.position.needsUpdate = true;
        this.oceanMesh.geometry.computeVertexNormals();
      }
      
      // Update oceanMesh material
      if (this.materials.ocean && this.materials.ocean.normalMap) {
        // Animate normal map offset for flowing water effect
        const normalMap = this.materials.ocean.normalMap;
        if (!normalMap.userData.offset) {
          normalMap.userData.offset = { x: 0, y: 0 };
        }
        
        normalMap.userData.offset.x += delta * 0.05;
        normalMap.userData.offset.y += delta * 0.03;
        
        normalMap.offset.set(normalMap.userData.offset.x, normalMap.userData.offset.y);
      }
    }
    
    if (this.materials.river.userData) {
      // Could be extended with flow animation
    }
    
    if (this.shorelineMesh) {
      const pulseSpeed = 0.8;
      const baseOpacity = 0.95;
      const pulseAmount = 0.05;
      
      this.materials.shoreline.opacity = baseOpacity + Math.sin(this.time * pulseSpeed) * pulseAmount;
      this.shorelineMesh.position.y = this.waterLevel - 0.2 + Math.sin(this.time * 1.2) * 0.03;
    }
  }
  
  update(delta) {
    this.updateOcean();
    this.updateRivers();
    this.animateWater(delta);

    if (this.waterSurface) {
      this.waterSurface.update(delta);
    }
    if (this.fluidFX) {
      this.fluidFX.update(this.engine.renderer, delta);
    }

    const player = this.engine.systems.player?.localPlayer;
    if (player && this.waterSurface) {
      const waterMesh = this.waterSurface.getMesh();
      waterMesh.position.x = player.position.x;
      waterMesh.position.z = player.position.z;
    }
  }

  dispose() {
    if (this.waterSurface) {
      const waterMesh = this.waterSurface.getMesh();
      this.scene.remove(waterMesh);
      this.waterSurface.dispose();
      this.waterSurface = null;
    }

    if (this.fluidFX) {
      this.fluidFX.dispose();
      this.fluidFX = null;
    }

    if (this.oceanMesh) {
      this.scene.remove(this.oceanMesh);
      this.oceanMesh.geometry.dispose();
      this.oceanMesh = null;
    }

    if (this.shorelineMesh) {
      this.scene.remove(this.shorelineMesh);
      this.shorelineMesh.geometry.dispose();
      this.shorelineMesh = null;
    }

    for (const [key, mesh] of this.riverSegments.entries()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.riverSegments.clear();

    Object.values(this.materials).forEach(material => {
      if (material) material.dispose();
    });
  }
}