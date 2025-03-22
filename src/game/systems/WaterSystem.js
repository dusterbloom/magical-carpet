import * as THREE from "three";

export class WaterSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.worldSystem = engine.systems.world;
    
    // Water bodies
    this.oceanMesh = null;
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
      lake: null
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
    
    console.log("WaterSystem initialized");
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
  }
  
  createOcean() {
    // Create a large ocean plane
    const oceanSize = this.worldSystem.chunkSize * 20;
    const oceanGeometry = new THREE.PlaneGeometry(oceanSize, oceanSize, 8, 8);
    oceanGeometry.rotateX(-Math.PI / 2);
    
    this.oceanMesh = new THREE.Mesh(oceanGeometry, this.materials.ocean);
    this.oceanMesh.position.y = this.waterLevel;
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
    if (player && this.oceanMesh) {
      this.oceanMesh.position.x = player.position.x;
      this.oceanMesh.position.z = player.position.z;
    }
  }
  
  animateWater(delta) {
    // Update time
    this.time += delta;
    
    // Animate ocean waves
    if (this.oceanMesh && this.materials.ocean.userData) {
      // Could be extended with wave animation shaders
    }
    
    // Animate river flow
    if (this.materials.river.userData) {
      // Could be extended with flow animation
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
