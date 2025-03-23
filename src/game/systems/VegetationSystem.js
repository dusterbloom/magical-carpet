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
    
    // Vegetation parameters
    this.treeTypes = [
      { name: "pine", minHeight: 20, maxHeight: 80, avoidWater: true, density: this.engine.isMobile ? 0.1 : 0.2 },
      { name: "oak", minHeight: 10, maxHeight: 30, avoidWater: true, density: this.engine.isMobile ? 0.2 : 0.4 },
      { name: "palm", minHeight: 5, maxHeight: 15, avoidWater: false, density: this.engine.isMobile ? 0.05 : 0.1 }
    ];
    
    this.treeDistance = this.engine.isMobile ? 5 : 2; // Increased minimum distance between trees
    this.chunksWithTrees = new Set(); // Track which chunks have trees
    
    // View distance for vegetation (shorter than world view distance)
    this.vegetationDistance = this.engine.isMobile ? 1 : 2;
  }
  
  async initialize() {
    console.log("Initializing VegetationSystem...");
    
    // Create basic tree models
    this.createTreeModels();
    
    console.log("VegetationSystem initialized");
  }
  
  createTreeModels() {
    // Determine geometry detail level based on device capability
    const segmentCount = this.engine.isMobile ? 4 : 6;
    
    // Create even more simplified tree models
    
    // Pine tree (conical) - simplified for performance
    const pineTree = new THREE.Group();
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 4, segmentCount);
    
    // Use MeshBasicMaterial instead of MeshStandardMaterial for better performance on mobile
    const trunkMaterial = this.engine.isMobile ? 
      new THREE.MeshBasicMaterial({ color: 0x8B4513 }) : 
      new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2;
    
    const leavesGeometry = new THREE.ConeGeometry(3, 8, segmentCount);
    const leavesMaterial = this.engine.isMobile ? 
      new THREE.MeshBasicMaterial({ color: 0x2E8B57 }) : 
      new THREE.MeshStandardMaterial({ color: 0x2E8B57 });
      
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.y = 7;
    
    pineTree.add(trunk);
    pineTree.add(leaves);
    pineTree.scale.set(1.5, 1.5, 1.5);
    
    // Only enable shadows on non-mobile devices
    if (!this.engine.isMobile) {
      pineTree.castShadow = true;
      pineTree.receiveShadow = true;
    }
    
    // Oak tree (round) - simplified
    const oakTree = new THREE.Group();
    const oakTrunkGeometry = new THREE.CylinderGeometry(0.6, 1, 5, segmentCount);
    const oakTrunk = new THREE.Mesh(oakTrunkGeometry, trunkMaterial);
    oakTrunk.position.y = 2.5;
    
    const oakLeavesGeometry = new THREE.SphereGeometry(4, segmentCount, segmentCount);
    const oakLeavesMaterial = this.engine.isMobile ? 
      new THREE.MeshBasicMaterial({ color: 0x228B22 }) : 
      new THREE.MeshStandardMaterial({ color: 0x228B22 });
      
    const oakLeaves = new THREE.Mesh(oakLeavesGeometry, oakLeavesMaterial);
    oakLeaves.position.y = 7;
    
    oakTree.add(oakTrunk);
    oakTree.add(oakLeaves);
    
    if (!this.engine.isMobile) {
      oakTree.castShadow = true;
      oakTree.receiveShadow = true;
    }
    
    // Palm tree - greatly simplified for mobile
    const palmTree = new THREE.Group();
    const palmTrunkGeometry = new THREE.CylinderGeometry(0.4, 0.6, 8, segmentCount);
    const palmTrunk = new THREE.Mesh(palmTrunkGeometry, trunkMaterial);
    palmTrunk.position.y = 4;
    
    // Create palm fronds - fewer for mobile
    const frondMaterial = this.engine.isMobile ? 
      new THREE.MeshBasicMaterial({ color: 0x32CD32 }) : 
      new THREE.MeshStandardMaterial({ color: 0x32CD32 });
      
    // Fewer fronds on mobile
    const frondCount = this.engine.isMobile ? 3 : 7;
    
    for (let i = 0; i < frondCount; i++) {
      const frondGeometry = new THREE.ConeGeometry(1, 4, this.engine.isMobile ? 3 : 4);
      const frond = new THREE.Mesh(frondGeometry, frondMaterial);
      frond.position.y = 8;
      frond.rotation.x = Math.PI / 4;
      frond.rotation.y = (i / frondCount) * Math.PI * 2;
      palmTree.add(frond);
    }
    
    palmTree.add(palmTrunk);
    
    if (!this.engine.isMobile) {
      palmTree.castShadow = true;
      palmTree.receiveShadow = true;
    }
    
    // Store models
    this.treeModels = [pineTree, oakTree, palmTree];
  }
  
  shouldPlaceTree(x, z, treeType) {
    const height = this.worldSystem.getTerrainHeight(x, z);
    const waterLevel = this.worldSystem.waterLevel;
    
    // Check height constraints
    if (height < treeType.minHeight || height > treeType.maxHeight) {
      return false;
    }
    
    // Check water avoidance
    if (treeType.avoidWater && height <= waterLevel + 2) {
      return false;
    }
    
    // Check slope (trees don't grow well on steep slopes)
    const sampleDistance = 2;
    const heightDiffX = Math.abs(
      this.worldSystem.getTerrainHeight(x + sampleDistance, z) -
      this.worldSystem.getTerrainHeight(x - sampleDistance, z)
    );
    const heightDiffZ = Math.abs(
      this.worldSystem.getTerrainHeight(x, z + sampleDistance) -
      this.worldSystem.getTerrainHeight(x, z - sampleDistance)
    );
    const slope = Math.sqrt(heightDiffX * heightDiffX + heightDiffZ * heightDiffZ) / (sampleDistance * 2);
    
    if (slope > 0.5) { // Too steep for trees
      return false;
    }
    
    // Check if too close to other trees
    for (const instance of this.treeInstances) {
      const dx = instance.position.x - x;
      const dz = instance.position.z - z;
      const distanceSquared = dx * dx + dz * dz;
      
      if (distanceSquared < this.treeDistance * this.treeDistance) {
        return false;
      }
    }
    
    // Use noise for natural distribution
    const noiseValue = this.worldSystem.noise(x * 0.05, z * 0.05);
    return noiseValue > (1 - treeType.density);
  }
  
  generateTreesForChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Skip if we've already generated trees for this chunk
    if (this.chunksWithTrees.has(chunkKey)) {
      return;
    }
    
    const chunkSize = this.worldSystem.chunkSize;
    const minX = chunkX * chunkSize;
    const minZ = chunkZ * chunkSize;
    const maxX = minX + chunkSize;
    const maxZ = minZ + chunkSize;
    
    // Number of attempts to place trees - significantly reduced for mobile
    const attempts = this.engine.isMobile ? 30 : 60;
    
    // Count trees in this chunk to enforce a limit
    let treesInChunk = 0;
    const maxTreesPerChunk = this.engine.isMobile ? 5 : 15;
    
    for (let i = 0; i < attempts && treesInChunk < maxTreesPerChunk; i++) {
      // Random position within chunk
      const x = minX + Math.random() * chunkSize;
      const z = minZ + Math.random() * chunkSize;
      
      // Select random tree type
      const treeTypeIndex = Math.floor(Math.random() * this.treeTypes.length);
      const treeType = this.treeTypes[treeTypeIndex];
      
      if (this.shouldPlaceTree(x, z, treeType)) {
        const height = this.worldSystem.getTerrainHeight(x, z);
        
        // Create tree instance
        const treeModel = this.treeModels[treeTypeIndex].clone();
        
        // Position the tree
        treeModel.position.set(x, height, z);
        
        // Random rotation and slight scale variation
        treeModel.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.8 + Math.random() * 0.4;
        treeModel.scale.set(scale, scale, scale);
        
        // Add to scene
        this.scene.add(treeModel);
        this.treeInstances.push(treeModel);
        treesInChunk++;
      }
    }
    
    // Mark this chunk as processed
    this.chunksWithTrees.add(chunkKey);
  }
  
  update() {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    // Skip every other update on mobile devices to improve performance
    if (this.engine.isMobile && Math.floor(this.engine.elapsed * 10) % 3 !== 0) {
      return;
    }
    
    // Calculate current chunk
    const chunkSize = this.worldSystem.chunkSize;
    const playerChunkX = Math.floor(player.position.x / chunkSize);
    const playerChunkZ = Math.floor(player.position.z / chunkSize);
    
    // Keep track of chunks that should have trees
    const chunksToKeep = new Set();
    
    // Use a shorter view distance for vegetation than for the world
    // This significantly reduces the number of trees to render
    const viewDistance = this.vegetationDistance;
    
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