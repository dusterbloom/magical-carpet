import * as THREE from "three";

export class VegetationSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.worldSystem = engine.systems.world;
    
    // Tree models and instances
    this.treeModels = [];
    this.treeInstances = [];
    this.currentChunks = new Set();
    
    // Vegetation parameters - enhanced for biome-specific distribution
    this.treeTypes = [
      { 
        name: "pine", 
        minHeight: 20, 
        maxHeight: 200, 
        avoidWater: true, 
        baseDensity: 1.0,
        biomes: {
          mountains: { densityMult: 1.5, clusterRadius: 150, minTemp: 0, maxTemp: 0.7 },
          forest: { densityMult: 1.2, clusterRadius: 100, minTemp: 0, maxTemp: 0.5 },
          plains: { densityMult: 0.3, clusterRadius: 60, minTemp: 0, maxTemp: 0.6 }
        }
      },
      { 
        name: "oak", 
        minHeight: 10, 
        maxHeight: 100, 
        avoidWater: true, 
        baseDensity: 0.8,
        biomes: {
          forest: { densityMult: 1.8, clusterRadius: 120, minTemp: 0.3, maxTemp: 0.8 },
          plains: { densityMult: 0.7, clusterRadius: 80, minTemp: 0.3, maxTemp: 0.9 },
          mountains: { densityMult: 0.2, clusterRadius: 50, minTemp: 0.3, maxTemp: 0.7 }
        }
      },
      { 
        name: "palm", 
        minHeight: 5, 
        maxHeight: 30, 
        avoidWater: false, 
        baseDensity: 0.5,
        biomes: {
          plains: { densityMult: 0.8, clusterRadius: 70, minTemp: 0.7, maxTemp: 1.0 },
          forest: { densityMult: 0.4, clusterRadius: 40, minTemp: 0.7, maxTemp: 1.0 }
        }
      }
    ];
    
    // Distance parameters - varying by tree type and location
    this.treeDistanceBase = 25; // Base minimum distance between trees
    this.clusterNoiseScale = 0.001; // Large scale noise for cluster creation
    this.chunksWithTrees = new Set(); // Track which chunks have trees
  }
  
  async initialize() {
    console.log("Initializing VegetationSystem...");
    
    // Create basic tree models
    this.createTreeModels();
    
    console.log("VegetationSystem initialized");
  }
  
  createTreeModels() {
    // Create simplified tree models
    
    // Pine tree (conical)
    const pineTree = new THREE.Group();
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 4, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2;
    
    const leavesGeometry = new THREE.ConeGeometry(3, 8, 8);
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 });
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.y = 7;
    
    pineTree.add(trunk);
    pineTree.add(leaves);
    pineTree.scale.set(1.5, 1.5, 1.5);
    pineTree.castShadow = true;
    pineTree.receiveShadow = true;
    
    // Oak tree (round)
    const oakTree = new THREE.Group();
    const oakTrunkGeometry = new THREE.CylinderGeometry(0.6, 1, 5, 8);
    const oakTrunk = new THREE.Mesh(oakTrunkGeometry, trunkMaterial);
    oakTrunk.position.y = 2.5;
    
    const oakLeavesGeometry = new THREE.SphereGeometry(4, 8, 8);
    const oakLeavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const oakLeaves = new THREE.Mesh(oakLeavesGeometry, oakLeavesMaterial);
    oakLeaves.position.y = 7;
    
    oakTree.add(oakTrunk);
    oakTree.add(oakLeaves);
    oakTree.castShadow = true;
    oakTree.receiveShadow = true;
    
    // Palm tree
    const palmTree = new THREE.Group();
    const palmTrunkGeometry = new THREE.CylinderGeometry(0.4, 0.6, 8, 8);
    const palmTrunk = new THREE.Mesh(palmTrunkGeometry, trunkMaterial);
    palmTrunk.position.y = 4;
    
    // Create palm fronds
    const frondMaterial = new THREE.MeshStandardMaterial({ color: 0x32CD32 });
    for (let i = 0; i < 7; i++) {
      const frondGeometry = new THREE.ConeGeometry(0.5, 4, 4);
      const frond = new THREE.Mesh(frondGeometry, frondMaterial);
      frond.position.y = 8;
      frond.rotation.x = Math.PI / 4;
      frond.rotation.y = (i / 7) * Math.PI * 2;
      palmTree.add(frond);
    }
    
    palmTree.add(palmTrunk);
    palmTree.castShadow = true;
    palmTree.receiveShadow = true;
    
    // Store models
    this.treeModels = [pineTree, oakTree, palmTree];
  }
  
  /**
   * Get biome and climate data for a position
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @returns {Object} Object with biome and climate information
   */
  getBiomeData(x, z) {
    const height = this.worldSystem.getTerrainHeight(x, z);
    
    // Get temperature and moisture using same approach as WorldSystem
    const rawTemperature = this.worldSystem.fractalNoise(x, z, 0.0005, 2, 0.5, 2.0);
    const rawMoisture = this.worldSystem.fractalNoise(x, z, 0.0004, 2, 0.5, 2.0);
    
    // Normalize to [0,1] range
    const temperature = (rawTemperature + 1) * 0.5;
    const moisture = (rawMoisture + 1) * 0.5;
    
    // Determine biome based on height, temperature and moisture
    let biome;
    if (height > 120) {
      biome = 'mountains';
    } else if (moisture > 0.4 && height > 30 && height < 120) {
      biome = 'forest';
    } else {
      biome = 'plains';
    }
    
    return { biome, temperature, moisture, height };
  }
  
  /**
   * Determine if a tree should be placed at the given coordinates
   * Uses multi-scale noise for natural clustering
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {Object} treeType - Tree type parameters
   * @returns {boolean} True if a tree should be placed here
   */
  shouldPlaceTree(x, z, treeType) {
    // Get biome and climate data
    const { biome, temperature, moisture, height } = this.getBiomeData(x, z);
    
    // Check height constraints
    if (height < treeType.minHeight || height > treeType.maxHeight) {
      return false;
    }
    
    // Skip if tree type doesn't belong in this biome
    if (!treeType.biomes[biome]) {
      return false;
    }
    
    // Check temperature range for this tree in this biome
    const biomeSetting = treeType.biomes[biome];
    if (temperature < biomeSetting.minTemp || temperature > biomeSetting.maxTemp) {
      return false;
    }
    
    // Check slope (trees don't grow well on steep slopes)
    const slope = this.worldSystem.calculateSlope(x, z);
    if (slope > 0.5) { // Too steep for trees
      return false;
    }
    
    // Generate multi-scale noise for natural clustering
    // Large scale noise creates overall forest regions
    const forestRegionNoise = this.worldSystem.fractalNoise(x, z, this.clusterNoiseScale, 2, 0.5, 2.0);
    // Medium scale adds variation within forests
    const forestVariationNoise = this.worldSystem.fractalNoise(x, z, this.clusterNoiseScale * 4, 2, 0.5, 2.0); 
    // Small scale noise for individual tree placement
    const treeNoise = this.worldSystem.fractalNoise(x, z, 0.05, 2, 0.5, 2.0);
    
    // Calculate density threshold based on biome and noise
    const baseDensity = treeType.baseDensity * biomeSetting.densityMult;
    
    // Convert noise to [0,1] range
    const normalizedForestNoise = (forestRegionNoise + 1) * 0.5;
    const normalizedVariationNoise = (forestVariationNoise + 1) * 0.5;
    const normalizedTreeNoise = (treeNoise + 1) * 0.5;
    
    // Combine noise at different scales with different weights
    // - Forest region noise has highest weight (70%)
    // - Variation noise adds medium-scale detail (20%)
    // - Tree-level noise for small variations (10%)
    const combinedNoise = (
      normalizedForestNoise * 0.7 + 
      normalizedVariationNoise * 0.2 + 
      normalizedTreeNoise * 0.1
    );
    
    // Higher density in proper biomes
    const densityThreshold = 1.0 - baseDensity;
    
    // Check against nearby trees for natural spacing
    const minDistanceMultiplier = 0.8 + normalizedTreeNoise * 0.4; // Variable distance based on noise
    const treeDistance = this.treeDistanceBase * minDistanceMultiplier;
    
    // Different spacing for clustered areas vs sparse areas
    const effectiveDistance = treeDistance * (normalizedForestNoise > 0.5 ? 0.7 : 1.2);
    
    // Check if too close to other trees
    for (const instance of this.treeInstances) {
      const dx = instance.position.x - x;
      const dz = instance.position.z - z;
      const distanceSquared = dx * dx + dz * dz;
      
      if (distanceSquared < effectiveDistance * effectiveDistance) {
        return false;
      }
    }
    
    // Trees are more likely to appear where combined noise exceeds threshold
    return combinedNoise > densityThreshold;
  }
  
  /**
   * Generate trees for a chunk with biome-aware distribution
   * @param {number} chunkX - Chunk X coordinate
   * @param {number} chunkZ - Chunk Z coordinate
   */
  generateTreesForChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Skip if we've already generated trees for this chunk
    if (this.chunksWithTrees.has(chunkKey)) {
      return;
    }
    
    const chunkSize = this.worldSystem.chunkSize;
    const minX = chunkX * chunkSize;
    const minZ = chunkZ * chunkSize;
    
    // Determine approximate biome for this chunk to optimize tree selection
    const chunkCenterX = minX + chunkSize / 2;
    const chunkCenterZ = minZ + chunkSize / 2;
    const { biome } = this.getBiomeData(chunkCenterX, chunkCenterZ);
    
    // Adaptive number of attempts based on biome
    let attempts;
    switch (biome) {
      case 'forest':
        attempts = 300; // More attempts in forest biomes
        break;
      case 'mountains':
        attempts = 250; // Medium attempts in mountains
        break;
      default:
        attempts = 150; // Fewer in plains
    }
    
    // Generate forest patches - place trees in multiple passes
    for (let i = 0; i < attempts; i++) {
      // Random position within chunk
      const x = minX + Math.random() * chunkSize;
      const z = minZ + Math.random() * chunkSize;
      
      // Get position-specific biome data
      const positionBiomeData = this.getBiomeData(x, z);
      
      // Select tree type based on biome
      let treeTypeIndex;
      const biomeRoll = Math.random();
      
      if (positionBiomeData.biome === 'mountains') {
        // Mountains favor pine trees
        treeTypeIndex = biomeRoll < 0.8 ? 0 : 1;
      } else if (positionBiomeData.biome === 'forest') {
        // Forests favor mix of pine and oak
        treeTypeIndex = biomeRoll < 0.4 ? 0 : (biomeRoll < 0.9 ? 1 : 2);
      } else { // plains
        // Plains favor oak and palm in warm areas
        if (positionBiomeData.temperature > 0.7) {
          treeTypeIndex = biomeRoll < 0.3 ? 1 : 2; // More palms in warm areas
        } else {
          treeTypeIndex = biomeRoll < 0.7 ? 1 : 0; // More oaks in cooler areas
        }
      }
      
      const treeType = this.treeTypes[treeTypeIndex];
      
      if (this.shouldPlaceTree(x, z, treeType)) {
        const height = this.worldSystem.getTerrainHeight(x, z);
        
        // Create tree instance
        const treeModel = this.treeModels[treeTypeIndex].clone();
        
        // Position the tree
        treeModel.position.set(x, height, z);
        
        // Random rotation
        treeModel.rotation.y = Math.random() * Math.PI * 2;
        
        // Variable scale based on biome and elevation
        let scaleBase, scaleVariation;
        
        // Trees get smaller at higher elevations
        const elevationFactor = Math.max(0, 1 - (height - treeType.minHeight) / (treeType.maxHeight - treeType.minHeight));
        
        switch(treeType.name) {
          case "pine":
            scaleBase = 0.8 + elevationFactor * 0.4;
            scaleVariation = 0.3;
            break;
          case "oak":
            scaleBase = 0.7 + elevationFactor * 0.5;
            scaleVariation = 0.4;
            break;
          case "palm":
            scaleBase = 0.6 + elevationFactor * 0.4;
            scaleVariation = 0.3;
            break;
        }
        
        const scale = scaleBase + Math.random() * scaleVariation;
        treeModel.scale.set(scale, scale, scale);
        
        // Add to scene
        this.scene.add(treeModel);
        this.treeInstances.push(treeModel);
      }
    }
    
    // Mark this chunk as processed
    this.chunksWithTrees.add(chunkKey);
  }
  
  update() {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    // Calculate current chunk
    const chunkSize = this.worldSystem.chunkSize;
    const playerChunkX = Math.floor(player.position.x / chunkSize);
    const playerChunkZ = Math.floor(player.position.z / chunkSize);
    
    // Keep track of chunks that should have trees
    const chunksToKeep = new Set();
    const viewDistance = this.worldSystem.viewDistance;
    
    // Generate trees for chunks in view distance
    for (let x = -viewDistance; x <= viewDistance; x++) {
      for (let z = -viewDistance; z <= viewDistance; z++) {
        const distance = Math.sqrt(x * x + z * z);
        if (distance <= viewDistance) {
          const chunkX = playerChunkX + x;
          const chunkZ = playerChunkZ + z;
          const chunkKey = `${chunkX},${chunkZ}`;
          
          chunksToKeep.add(chunkKey);
          this.generateTreesForChunk(chunkX, chunkZ);
        }
      }
    }
    
    // Clean up trees that are too far away
    this.treeInstances = this.treeInstances.filter(tree => {
      const treeChunkX = Math.floor(tree.position.x / chunkSize);
      const treeChunkZ = Math.floor(tree.position.z / chunkSize);
      const treeChunkKey = `${treeChunkX},${treeChunkZ}`;
      
      if (!chunksToKeep.has(treeChunkKey)) {
        this.scene.remove(tree);
        return false;
      }
      return true;
    });
  }
}