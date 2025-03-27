import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water2.js';

// Create texture loader
const textureLoader = new THREE.TextureLoader();




export class WaterSurfaceComplex {
  constructor({
    width = 1000,
    length = 1000,
    geometry = null, // New parameter to accept a custom geometry
    position = [0, 0, 0],
    color = 0x4a7eb5,
    scale = 2.0,
    flowDirection = [1, 1],
    flowSpeed = 0.0001,
    dimensions = 1024,
    reflectivity = 0.2,
    fxDistortionFactor = 0.03,
    fxDisplayColorAlpha = 0.2
  } = {}) {
    // Load normal maps
    const normalMap1 = textureLoader.load('/water/complex/Water_1_M_Normal.jpg');
    const normalMap2 = textureLoader.load('/water/complex/Water_2_M_Normal.jpg');
    
    // Configure normal maps
    normalMap1.wrapS = normalMap1.wrapT = THREE.RepeatWrapping;
    normalMap2.wrapS = normalMap2.wrapT = THREE.RepeatWrapping;
    
    this.params = {
      color,
      scale,
      flowDirection: new THREE.Vector2(...flowDirection),
      flowSpeed,
      textureWidth: dimensions,
      textureHeight: dimensions,
      reflectivity,
      normalMap0: normalMap1,
      normalMap1: normalMap2,
      fxDistortionFactor,
      fxDisplayColorAlpha,
      distortionScale: 1.8,
      fog: false,
      clipBias: 0.0,
      alpha: 0.9,
      vertexColors: true // Enable vertex colors
    };

    this.time = 0;
    // Use provided geometry or create a new one
    this.geometry = geometry || new THREE.PlaneGeometry(width, length);
    this.water = new Water(this.geometry, this.params);
    this.water.position.set(...position);
    this.water.rotation.x = -Math.PI / 2;
    
    // Critical: Set material to use vertex colors for alpha
    if (this.water.material) {
      this.water.material.vertexColors = true;
      this.water.material.transparent = true;
      this.water.material.opacity = 0.95;
      this.water.material.depthWrite = false;
      this.water.material.needsUpdate = true;
      
      // Make sure vertex colors are passed to shader
      this.water.material.onBeforeCompile = (shader) => {
        // No need to modify shader if using Water2 from Three.js
        // Just ensure opacity is set correctly
        if (shader.uniforms.opacity) {
          shader.uniforms.opacity.value = 0.9;
        }
      };
    }

    // Initialize custom uniforms if they don't exist
    if (!this.water.material.uniforms.time) {
      this.water.material.uniforms.time = { value: 0 };
    }
    if (!this.water.material.uniforms.fxDistortionFactor) {
      this.water.material.uniforms.fxDistortionFactor = { value: fxDistortionFactor };
    }
    if (!this.water.material.uniforms.fxDisplayColorAlpha) {
      this.water.material.uniforms.fxDisplayColorAlpha = { value: fxDisplayColorAlpha };
    }
  }

  // Add this new method to create a depth transition for the water edges
createWaterDepthMap() {
  if (!this.waterSurface || !this.waterSurface.water || !this.waterSurface.water.material) {
    return;
  }
  
  // Create a custom depth map for water
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);
  
  // Create radial gradient for depth effect (deeper in center, shallow at edges)
  const gradient = ctx.createRadialGradient(
    size/2, size/2, size * 0.3,  // Inner circle
    size/2, size/2, size * 0.48  // Outer circle (almost to edge)
  );
  
  // Dark blue in deep water, lighter in shallow
  gradient.addColorStop(0, 'rgba(0, 10, 50, 1.0)');     // Deep water
  gradient.addColorStop(0.7, 'rgba(20, 60, 120, 0.9)'); // Medium depth
  gradient.addColorStop(0.9, 'rgba(60, 120, 180, 0.6)');// Shallow water
  gradient.addColorStop(1.0, 'rgba(120, 180, 255, 0)'); // Shore (transparent)
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Add noise to break up the perfect circle
  this.applyNoiseToCanvas(ctx, size, 0.3);
  
  // Create texture from canvas
  const depthTexture = new THREE.CanvasTexture(canvas);
  depthTexture.wrapS = depthTexture.wrapT = THREE.RepeatWrapping;
  
  // Apply to water material if possible
  try {
    const waterMaterial = this.waterSurface.water.material;
    if (waterMaterial.uniforms && waterMaterial.uniforms.depthTexture === undefined) {
      // Add custom uniform
      waterMaterial.uniforms.depthTexture = { value: depthTexture };
      waterMaterial.uniforms.depthScale = { value: 1.0 };
      
      // Update the material to use the depth texture
      if (waterMaterial.onBeforeCompile) {
        const originalOnBeforeCompile = waterMaterial.onBeforeCompile;
        
        waterMaterial.onBeforeCompile = (shader) => {
          // Call original function if it exists
          if (originalOnBeforeCompile) {
            originalOnBeforeCompile(shader);
          }
          
          // Add our depth texture uniform
          shader.uniforms.depthTexture = waterMaterial.uniforms.depthTexture;
          shader.uniforms.depthScale = waterMaterial.uniforms.depthScale;
          
          // Add the depth texture sampling to the fragment shader
          shader.fragmentShader = shader.fragmentShader.replace(
            'void main() {',
            `
            uniform sampler2D depthTexture;
            uniform float depthScale;
            
            void main() {
              // Sample depth texture
              vec4 depthColor = texture2D(depthTexture, vUv);
            `
          );
          
          // Apply depth color to final output
          shader.fragmentShader = shader.fragmentShader.replace(
            'gl_FragColor = vec4( color, alpha );',
            `
            // Blend water color with depth color for shoreline effect
            vec3 finalColor = mix(color, depthColor.rgb, depthColor.a * depthScale);
            float finalAlpha = alpha * max(0.2, depthColor.a);
            gl_FragColor = vec4(finalColor, finalAlpha);
            `
          );
        };
      }
    }
  } catch (error) {
    console.warn("Error applying depth texture to water:", error);
  }
}

// Add noise helper method
applyNoiseToCanvas(ctx, size, intensity) {
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  
  // Simple noise function (using pseudo-random patterns)
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      // Simple noise function using sine waves at different frequencies
      const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 
                   Math.sin(x * 0.05 + y * 0.05) * 
                   Math.cos(x * 0.15 - y * 0.1) * intensity;
      
      const idx = (y * size + x) * 4;
      
      // Apply noise to all channels
      data[idx] = Math.max(0, Math.min(255, data[idx] + noise * 20));
      data[idx+1] = Math.max(0, Math.min(255, data[idx+1] + noise * 20));
      data[idx+2] = Math.max(0, Math.min(255, data[idx+2] + noise * 20));
      
      // Add stronger noise to alpha channel for irregular edges
      if (data[idx+3] < 240 && data[idx+3] > 10) {
        data[idx+3] = Math.max(0, Math.min(255, data[idx+3] + noise * 30));
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
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
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
   // Create a more natural gradient with noise
   const centerX = size/2;
   const centerY = size/2;
   const innerRadius = size * 0.35;
   const outerRadius = size * 0.5;
   
   // Create base gradient
   const gradient = ctx.createRadialGradient(
     centerX, centerY, innerRadius,
     centerX, centerY, outerRadius
   );
   gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
   gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
   gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.4)');
   gradient.addColorStop(0.9, 'rgba(255, 255, 255, 0.1)');
   gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
   
   ctx.fillStyle = gradient;
   ctx.fillRect(0, 0, size, size);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    
    return texture;
  }
  

  // Add a new method to add natural noise to the shoreline
applyNoiseToCanvas(ctx, size, intensity) {
  // Get image data to modify
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  
  // Apply simplex-like noise
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      // Simple noise function (could use proper simplex noise in production)
      const noiseValue = Math.sin(x * 0.05) * Math.cos(y * 0.05) * intensity;
      
      // Get current alpha value
      const idx = (y * size + x) * 4 + 3; // Alpha channel
      
      // Add noise to alpha (with bounds checking)
      data[idx] = Math.max(0, Math.min(255, data[idx] + noiseValue * 30));
    }
  }
  
  // Put the modified image data back
  ctx.putImageData(imageData, 0, 0);
}

createShoreline() {
  const oceanSize = this.worldSystem.chunkSize * 20;
  const shorelineWidth = 60; // Increased from 40 for a wider transition
  const segments = 256; // Increased from 192 for smoother edge
  const radialSegments = 24; // Increased from 12 for better resolution
  
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  
  const centerX = 0;
  const centerZ = 0;
  const innerRadius = oceanSize / 2 - shorelineWidth;
  const outerRadius = oceanSize / 2 + shorelineWidth;
  
  // Improved color gradient for more natural transition
  const waterColor = new THREE.Color(0x0066aa);
  const shallowWaterColor = new THREE.Color(0x88aacc);
  const wetSandColor = new THREE.Color(0xd9d0b0);
  const beachColor = new THREE.Color(0xe8e4cf);
  
  // Create the vertices with improved blending
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    
    // Add noise to radius for more natural shoreline
    const radiusNoise = (Math.sin(i * 0.2) * Math.cos(i * 0.5) * 5) + 
                         (Math.sin(i * 0.1) * 3);
    
    for (let r = 0; r <= radialSegments; r++) {
      // Apply noise to the radius
      const t = r / radialSegments;
      let radius = innerRadius + (outerRadius - innerRadius) * t;
      
      // Only apply noise to the middle of the shoreline for natural look
      if (t > 0.3 && t < 0.7) {
        radius += radiusNoise * (1 - Math.abs(t - 0.5) * 2) * 8;
      }
      
      const x = centerX + radius * cosTheta;
      const z = centerZ + radius * sinTheta;
      
      // Add height variation for more natural beach
      let y = 0;
      if (t > 0.5) {
        // Add small dunes and irregularities to the beach
        const duneHeight = Math.sin(i * 0.2) * Math.cos(r * 0.5) * 0.2;
        y = duneHeight * (t - 0.5) * 2;
      }
      
      vertices.push(x, y, z);
      uvs.push(i / segments, r / radialSegments);
      
      // Improved color transition with more steps
      let color;
      
      if (t < 0.2) {
        // Deep water
        const normalizedT = t / 0.2;
        color = new THREE.Color().copy(waterColor).lerp(shallowWaterColor, normalizedT);
      } else if (t < 0.45) {
        // Shallow water to wet sand transition
        const normalizedT = (t - 0.2) / 0.25;
        color = new THREE.Color().copy(shallowWaterColor).lerp(wetSandColor, normalizedT);
      } else if (t < 0.8) {
        // Wet sand to dry sand
        const normalizedT = (t - 0.45) / 0.35;
        color = new THREE.Color().copy(wetSandColor).lerp(beachColor, normalizedT);
      } else {
        // Dry beach
        color = beachColor.clone();
      }
      
      // Add subtle color variation for realism
      const variation = (Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.05);
      color.r = Math.max(0, Math.min(1, color.r + variation));
      color.g = Math.max(0, Math.min(1, color.g + variation));
      color.b = Math.max(0, Math.min(1, color.b + variation));
      
      colors.push(color.r, color.g, color.b);
    }
  }
  
  // Create the triangles
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
  
  // Better material with improved transparency and blending
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    metalness: 0.1,
    roughness: 0.6,
    side: THREE.DoubleSide,
    flatShading: false,
    alphaMap: this.createShorelineAlphaMap(),
    depthWrite: false,
    blending: THREE.NormalBlending  // Changed from CustomBlending for better results
  });

  this.shorelineMesh = new THREE.Mesh(geometry, material);
  this.materials.shoreline = material;
  
  // Properly position the shoreline at water level with slight offset
  this.shorelineMesh.position.y = this.waterLevel - 0.15;
  this.shorelineMesh.rotation.x = -Math.PI / 2;
  
  // Set rendering order to avoid z-fighting
  this.shorelineMesh.renderOrder = 0;
  
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
        
        // CRITICAL FIX: Significantly reduce wave speed
        const waveSpeed = 0.05;        // Was 0.2 - 75% reduction
        const waveHeight = 0.4;        // Was 0.6 - reduced height
        
        // Only animate each vertex every few frames to improve performance
        // and create more natural looking waves
        if (Math.random() < 0.2) { // Only update 20% of vertices per frame
          for (let i = 0; i < positions.length; i += 15) { // Skip vertices for efficiency
            const x = positions[i];
            const z = positions[i + 2];
            
            const distanceFromCenter = Math.sqrt(x * x + z * z);
            const maxDistance = this.worldSystem.chunkSize * 10;
            const edgeFactor = Math.max(0, 1 - distanceFromCenter / maxDistance);
            
            const vertexOffset = (x * 0.01) + (z * 0.01); // Reduced from 0.02
            
            // Simpler wave calculation
            const waveOffset = Math.sin((this.time * waveSpeed) + vertexOffset) * waveHeight * edgeFactor;
            
            // Base height plus simplified wave
            if (!this.initialWaveHeights) {
              this.initialWaveHeights = new Float32Array(positions.length / 3);
              for (let j = 0; j < positions.length / 3; j++) {
                this.initialWaveHeights[j] = Math.sin(j * 0.1) * 0.2;
              }
            }
            
            const idx = Math.floor(i / 3);
            const baseHeight = this.initialWaveHeights[idx] || 0;
            
            positions[i + 1] = baseHeight + waveOffset;
          }
          
          this.oceanMesh.geometry.attributes.position.needsUpdate = true;
          this.oceanMesh.geometry.computeVertexNormals();
        }
      }
      
      // Update material with slower animation
      if (this.materials.ocean && this.materials.ocean.normalMap) {
        // Animate normal map offset for flowing water effect
        const normalMap = this.materials.ocean.normalMap;
        if (!normalMap.userData.offset) {
          normalMap.userData.offset = { x: 0, y: 0 };
        }
        
        // REDUCED SPEED BY 80%
        normalMap.userData.offset.x += delta * 0.01; // Was 0.05
        normalMap.userData.offset.y += delta * 0.006; // Was 0.03
        
        normalMap.offset.set(normalMap.userData.offset.x, normalMap.userData.offset.y);
      }
    }
    
    // Animate shoreline with slower, more subtle movement
    if (this.shorelineMesh) {
      const pulseSpeed = 0.3; // Reduced from 0.8
      const baseOpacity = 0.85; // Adjusted from 0.95
      const pulseAmount = 0.03; // Reduced from 0.05
      
      this.materials.shoreline.opacity = baseOpacity + Math.sin(this.time * pulseSpeed) * pulseAmount;
      this.shorelineMesh.position.y = this.waterLevel - 0.2 + Math.sin(this.time * 0.4) * 0.02; // Slower movement
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


update(delta) {
if (this.water && this.water.material && this.water.material.uniforms) {
this.time += delta * 0.7;  // Reduced time scale by 30%

// Update flow animations
if (this.water.material.uniforms.time) {
this.water.material.uniforms.time.value = this.time * this.params.flowSpeed;
}

// Smoother distortion
  if (this.water.material.uniforms.distortionScale) {
    this.water.material.uniforms.distortionScale.value = 
    Math.sin(this.time * 0.1) * 0.2 + this.params.scale;
  }
}
}

  dispose() {
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.water) {
      this.water.material.dispose();
      this.water.geometry.dispose();
    }
  }

  getMesh() {
    return this.water;
  }
}