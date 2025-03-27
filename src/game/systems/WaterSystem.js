import * as THREE from "three";

export class WaterSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.worldSystem = engine.systems.world;
    
    // Water bodies
    this.oceanMesh = null;
    this.shorelineMesh = null; // Added shoreline mesh
    this.riverSegments = new Map(); // Map of chunk coordinates to river meshes
    this.lakesMeshes = [];
    this.waterLevel = this.worldSystem.waterLevel || 0;
    
    // River flow path data
    this.riverPaths = [];
    this.riverWidth = 15;
    this.riverCount = 5;  // Number of rivers to generate
    
    // Materials
    this.materials = {
      ocean: null,
      river: null,
      lake: null,
      shoreline: null // Added shoreline material
    };
    
    // Water animation
    this.time = 0;
  }
  
  async initialize() {
    console.log("Initializing WaterSystem...");
    
    // Create materials
    this.createMaterials();
    
    // Generate rivers
    this.generateRiverPaths();
    
    // Create ocean
    this.createOcean();
    
    // Create shoreline buffer
    this.createShoreline();
    
    console.log("WaterSystem initialized");
  }
  
  /**
   * Creates a buffer mesh along the shoreline to hide jagged edges
   * This creates a band around the water that smoothly transitions to the beach
   */
  createShoreline() {
    // The shoreline will be slightly larger than the ocean
    const oceanSize = this.worldSystem.chunkSize * 20;
    const shorelineWidth = 40; // Significantly wider transition band for more natural blending
    
    // Create a more detailed shoreline with color gradient to match terrain better
    // We'll use a custom buffer geometry with higher resolution
    const segments = 192; // Higher resolution for smoother shoreline
    const radialSegments = 12; // More segments for a more gradual transition
    
    // Create a custom geometry with vertices, colors and UVs
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];
    const uvs = [];
    const indices = [];
    
    // Center of ocean
    const centerX = 0;
    const centerZ = 0;
    
    // Inner and outer radius
    const innerRadius = oceanSize / 2 - shorelineWidth;
    const outerRadius = oceanSize / 2 + shorelineWidth;
    
    // Water and beach colors for a more natural gradient
    const waterColor = new THREE.Color(0x0066aa); // Slightly darker blue
    const shallowWaterColor = new THREE.Color(0x88aacc); // Light blue for shallow water
    const wetSandColor = new THREE.Color(0xd9d0b0); // Wet sand color
    const beachColor = new THREE.Color(0xe8e4cf); // Light beach sand color
    
    // Create vertices in a radial pattern
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      
      // Create multiple points along radius for color gradient
      for (let r = 0; r <= radialSegments; r++) {
        const radius = innerRadius + (outerRadius - innerRadius) * (r / radialSegments);
        
        // Position
        const x = centerX + radius * cosTheta;
        const z = centerZ + radius * sinTheta;
        const y = 0; // Will be positioned in the mesh
        
        vertices.push(x, y, z);
        
        // UV coordinates
        uvs.push(i / segments, r / radialSegments);
        
        // Multi-step color gradient from water to beach
        const t = r / radialSegments;
        let color;
        
        if (t < 0.3) {
          // Deep to shallow water transition
          const normalizedT = t / 0.3;
          color = new THREE.Color().copy(waterColor).lerp(shallowWaterColor, normalizedT);
        } else if (t < 0.65) {
          // Shallow water to wet sand transition
          const normalizedT = (t - 0.3) / 0.35;
          color = new THREE.Color().copy(shallowWaterColor).lerp(wetSandColor, normalizedT);
        } else {
          // Wet sand to dry beach transition
          const normalizedT = (t - 0.65) / 0.35;
          color = new THREE.Color().copy(wetSandColor).lerp(beachColor, normalizedT);
        }
        
        colors.push(color.r, color.g, color.b);
      }
    }
    
    // Create faces (triangles) by defining indices
    for (let i = 0; i < segments; i++) {
      for (let r = 0; r < radialSegments; r++) {
        const a = i * (radialSegments + 1) + r;
        const b = i * (radialSegments + 1) + r + 1;
        const c = (i + 1) * (radialSegments + 1) + r;
        const d = (i + 1) * (radialSegments + 1) + r + 1;
        
        // Two triangles per cell
        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }
    
    // Set attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    
    // Compute normals
    geometry.computeVertexNormals();
    
    // Create material with vertex colors for more realistic appearance
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95, // More opaque for more defined coloration
      metalness: 0.05, // Less metallic for sand
      roughness: 0.8, // Rougher texture like sand
      side: THREE.DoubleSide,
      flatShading: false // Smooth shading for gradual transitions
    });
    
    // Create and add the mesh
    this.shorelineMesh = new THREE.Mesh(geometry, material);
    this.materials.shoreline = material; // Save reference for animation
    
    // Position to hide the intersection
    this.shorelineMesh.position.y = this.waterLevel - 0.2;
    this.shorelineMesh.rotation.x = -Math.PI / 2; // Lay flat
    
    this.scene.add(this.shorelineMesh);
  }
  
  createMaterials() {
    // Shared water properties
    const waterColor = new THREE.Color(0x0077be);
    
    // Create ocean material
    this.materials.ocean = new THREE.MeshStandardMaterial({
      color: waterColor,
      transparent: true,
      opacity: 0.7,
      metalness: 0.1,
      roughness: 0.3,
    });
    
    // Create river material (more transparent, more reflective)
    this.materials.river = new THREE.MeshStandardMaterial({
      color: waterColor.clone().multiplyScalar(1.2), // Brighter blue
      transparent: true,
      opacity: 0.6,
      metalness: 0.2,
      roughness: 0.1,
    });
    
    // Create lake material
    this.materials.lake = new THREE.MeshStandardMaterial({
      color: waterColor.clone().multiplyScalar(1.1), // Slightly brighter
      transparent: true,
      opacity: 0.65,
      metalness: 0.15,
      roughness: 0.2,
    });
    
    // Create shoreline material - smooth gradient from water to beach
    this.materials.shoreline = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x88CCFF), // Light blue
      transparent: true,
      opacity: 0.8,
      metalness: 0.05,
      roughness: 0.1,
    });
  }
  
  createOcean() {
    // Create a large ocean plane with more segments for wave animation
    const oceanSize = this.worldSystem.chunkSize * 20;
    const segments = 32; // More segments for better wave effect
    const oceanGeometry = new THREE.PlaneGeometry(oceanSize, oceanSize, segments, segments);
    oceanGeometry.rotateX(-Math.PI / 2);
    
    // Add subtle random height variations to vertices for a more natural water surface
    const positions = oceanGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      // Only modify Y (height), which is at index + 1
      // Keep edges flatter for better shoreline matching
      const x = positions[i];
      const z = positions[i + 2];
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      const maxDistance = oceanSize * 0.5;
      
      // Less distortion near the edges
      const edgeFactor = Math.max(0, 1 - distanceFromCenter / maxDistance);
      
      // Apply subtle random height variations
      positions[i + 1] = (Math.random() - 0.5) * 0.6 * edgeFactor;
    }
    
    // Update normals after modifying vertices
    oceanGeometry.computeVertexNormals();
    
    this.oceanMesh = new THREE.Mesh(oceanGeometry, this.materials.ocean);
    // Move water down slightly to prevent z-fighting with beach
    this.oceanMesh.position.y = this.waterLevel - 0.5;
    this.oceanMesh.receiveShadow = true;
    
    this.scene.add(this.oceanMesh);
  }
  
  generateRiverPaths() {
    // Reset river paths
    this.riverPaths = [];
    
    // Get world parameters
    const chunkSize = this.worldSystem.chunkSize;
    const worldExtent = chunkSize * this.worldSystem.viewDistance * 2;
    
    // Generate multiple rivers
    for (let i = 0; i < this.riverCount; i++) {
      // Start river at a random mountain location
      const startX = (Math.random() - 0.5) * worldExtent;
      const startZ = (Math.random() - 0.5) * worldExtent;
      
      // Find a suitable high point for river source
      let bestHeight = -Infinity;
      let bestX = startX;
      let bestZ = startZ;
      
      // Sample multiple points to find a high point
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
      
      // If we didn't find a suitable starting point, skip this river
      if (bestHeight === -Infinity) continue;
      
      // Create river path
      const riverPath = this.generateRiverFlow(bestX, bestZ);
      if (riverPath.length > 0) {
        this.riverPaths.push(riverPath);
      }
    }
  }
  
  generateRiverFlow(startX, startZ) {
    // Generate a river path from a starting point, following terrain gradient
    const path = [];
    let currentX = startX;
    let currentZ = startZ;
    let currentHeight = this.worldSystem.getTerrainHeight(currentX, currentZ);
    
    // Add starting point
    path.push({ x: currentX, z: currentZ, y: currentHeight });
    
    // Maximum number of segments to avoid infinite loops
    const maxSegments = 1000;
    let segmentCount = 0;
    
    // Continue until we reach water level or max segments
    while (currentHeight > this.waterLevel + 0.5 && segmentCount < maxSegments) {
      // Sample points around current position to find lowest direction
      const sampleRadius = 15; // Distance between river points
      const sampleCount = 8;   // Number of directions to sample
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
      
      // If we can't find a lower point, break
      if (lowestHeight >= currentHeight) {
        // Add a random displacement to try to continue
        lowestX = currentX + (Math.random() - 0.5) * 20;
        lowestZ = currentZ + (Math.random() - 0.5) * 20;
        lowestHeight = this.worldSystem.getTerrainHeight(lowestX, lowestZ);
        
        // If still not lower, we're in a depression, so break
        if (lowestHeight >= currentHeight) break;
      }
      
      // Add point to path
      path.push({ x: lowestX, z: lowestZ, y: lowestHeight });
      
      // Update current position
      currentX = lowestX;
      currentZ = lowestZ;
      currentHeight = lowestHeight;
      
      segmentCount++;
    }
    
    return path;
  }
  
  createRiverMeshForSegment(path, startIndex, endIndex) {
    if (startIndex >= endIndex || endIndex >= path.length) return null;
    
    // Create points for river segment
    const points = [];
    for (let i = startIndex; i <= endIndex; i++) {
      points.push(new THREE.Vector3(path[i].x, path[i].y + 0.2, path[i].z));
    }
    
    // Create curve from points
    const curve = new THREE.CatmullRomCurve3(points);
    
    // Create river geometry by extruding along curve
    const segments = (endIndex - startIndex) * 2;
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, this.riverWidth / 2, 8, false);
    
    // Create river mesh
    const river = new THREE.Mesh(tubeGeometry, this.materials.river);
    river.receiveShadow = true;
    
    return river;
  }
  
  updateRivers() {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    // Get player chunk coordinates
    const chunkSize = this.worldSystem.chunkSize;
    const playerChunkX = Math.floor(player.position.x / chunkSize);
    const playerChunkZ = Math.floor(player.position.z / chunkSize);
    
    // View distance in chunks
    const viewDistance = this.worldSystem.viewDistance;
    
    // Keep track of chunks that should have rivers
    const chunksToKeep = new Set();
    
    // For each river path
    this.riverPaths.forEach((path, riverIndex) => {
      // For each segment of the river
      for (let i = 0; i < path.length - 1; i++) {
        // Get segment chunks
        const startChunkX = Math.floor(path[i].x / chunkSize);
        const startChunkZ = Math.floor(path[i].z / chunkSize);
        
        // Check if this segment is within view distance
        const distX = Math.abs(startChunkX - playerChunkX);
        const distZ = Math.abs(startChunkZ - playerChunkZ);
        const isVisible = Math.sqrt(distX * distX + distZ * distZ) <= viewDistance;
        
        if (isVisible) {
          // Create a key for this river segment
          const key = `river_${riverIndex}_${i}`;
          chunksToKeep.add(key);
          
          // Create river segment if it doesn't exist
          if (!this.riverSegments.has(key)) {
            // Find how many points to include (segments that cross into this chunk)
            let endIndex = i + 1;
            while (endIndex < path.length &&
                  Math.abs(Math.floor(path[endIndex].x / chunkSize) - startChunkX) <= 1 &&
                  Math.abs(Math.floor(path[endIndex].z / chunkSize) - startChunkZ) <= 1) {
              endIndex++;
            }
            
            // Create mesh for this segment
            const riverMesh = this.createRiverMeshForSegment(path, i, Math.min(endIndex, path.length - 1));
            
            if (riverMesh) {
              this.scene.add(riverMesh);
              this.riverSegments.set(key, riverMesh);
            }
          }
        }
      }
    });
    
    // Remove river segments that are too far
    for (const [key, mesh] of this.riverSegments.entries()) {
      if (!chunksToKeep.has(key)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.riverSegments.delete(key);
      }
    }
  }
  
  updateOcean() {
    // Update ocean position to follow player
    const player = this.engine.systems.player?.localPlayer;
    if (player) {
      // Update ocean position
      if (this.oceanMesh) {
        this.oceanMesh.position.x = player.position.x;
        this.oceanMesh.position.z = player.position.z;
      }
      
      // Update shoreline position
      if (this.shorelineMesh) {
        this.shorelineMesh.position.x = player.position.x;
        this.shorelineMesh.position.z = player.position.z;
      }
    }
  }
  
  animateWater(delta) {
    // Update time
    this.time += delta;
    
    // Animate ocean waves
    if (this.oceanMesh) {
      // Animate ocean mesh for gentle wave motion
      if (this.oceanMesh.geometry.attributes && this.oceanMesh.geometry.attributes.position) {
        const positions = this.oceanMesh.geometry.attributes.position.array;
        
        // Wave animation parameters - reduced speed, increased height
        const waveSpeed = 0.15; // Much slower waves
        const waveHeight = 0.5;  // More pronounced waves
        const wavePeriod = 20.0; // Longer distance between wave peaks
        
        // Animate each vertex with a wave pattern
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i];
          const z = positions[i + 2];
          
          // Calculate distance from center for edge damping
          const distanceFromCenter = Math.sqrt(x * x + z * z);
          const maxDistance = this.worldSystem.chunkSize * 10;
          const edgeFactor = Math.max(0, 1 - distanceFromCenter / maxDistance);
          
          // Use consistent vertex offset based on position rather than random
          // This creates persistent wave patterns that move rather than random choppiness
          const vertexOffset = (x * 0.02) + (z * 0.02); // Reduced frequency for longer waves
          
          // First wave pattern - large swells
          const waveOffset = Math.sin((this.time * waveSpeed) + vertexOffset) * waveHeight * edgeFactor;
          
          // Second wave pattern - smaller detail at different angle and speed
          const waveOffset2 = Math.cos((this.time * waveSpeed * 0.7) + vertexOffset * 1.3) * waveHeight * 0.4 * edgeFactor;
          
          // Third wave pattern - very small ripples for surface detail
          const rippleOffset = Math.sin((this.time * waveSpeed * 2.2) + (x * 0.1) + (z * 0.1)) * waveHeight * 0.1 * edgeFactor;
          
          // Store the initial vertex heights (constant for each vertex based on position)
          if (!this.initialWaveHeights) {
            this.initialWaveHeights = new Float32Array(positions.length / 3);
            for (let j = 0; j < positions.length / 3; j++) {
              this.initialWaveHeights[j] = Math.sin(j * 0.1) * 0.2; // Persistent but varied height
            }
          }
          
          // Use the stored height instead of random to avoid flickering
          const idx = Math.floor(i / 3);
          const baseHeight = this.initialWaveHeights[idx] || 0;
          
          // Update vertex height - combined wave patterns
          positions[i + 1] = baseHeight + waveOffset + waveOffset2 + rippleOffset;
        }
        
        // Flag attributes for update
        this.oceanMesh.geometry.attributes.position.needsUpdate = true;
        this.oceanMesh.geometry.computeVertexNormals();
      }
    }
    
    // Animate river flow
    if (this.materials.river.userData) {
      // Could be extended with flow animation
    }
    
    // Animate shoreline with very subtle movements
    if (this.shorelineMesh) {
    // Almost imperceptible pulsing opacity for the shoreline
    const pulseSpeed = 0.8; // Slower pulse
    const baseOpacity = 0.95; // More opaque
    const pulseAmount = 0.05; // Very subtle pulse
    
    this.materials.shoreline.opacity = baseOpacity + Math.sin(this.time * pulseSpeed) * pulseAmount;
    
    // Extremely subtle vertical movement
    this.shorelineMesh.position.y = this.waterLevel - 0.2 + Math.sin(this.time * 1.2) * 0.03; // Slower and less movement
    }
  }
  
  update(delta) {
    // Update ocean
    this.updateOcean();
    
    // Update rivers
    this.updateRivers();
    
    // Animate water
    this.animateWater(delta);
  }
}