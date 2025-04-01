import * as THREE from "three";
import { LOD } from "three";
import { System } from "../core/v2/System";


export class VegetationSystem extends System {
  constructor(engine) {
      // Call base class with system ID
      super(engine, 'vegetation');
      
      // Declare dependencies
      this.requireDependencies(['world', 'mobileLOD', 'player']);
      
      // Keep existing property initialization
      this.scene = engine.scene;
      this.performanceMonitor = engine.performanceMonitor;
      
      // Tree models, instances and instanced meshes (keep existing arrays)
      this.treeModels = [];
      this.treeLODModels = [];
      this.treeInstances = [];
      this.treeInstancedMeshes = [];
      this.treeMatrices = [];
      this.treeLODLevels = [];
      this.currentChunks = new Set();
      
      // Keep existing LOD distances
      this.lodDistances = {
          high: 200,
          medium: 600,
          low: 1200
      };
    
    // If MobileLODManager exists, use its distance settings
    if (engine.systems.mobileLOD) {
      // We'll update LOD distances in initialize method after mobileLOD is initialized
    }
    
    // Frustum culling support
    this.frustum = new THREE.Frustum();
    this.projScreenMatrix = new THREE.Matrix4();
    
    // Performance adaptation
    this.targetFPS = 40; // Target framerate
    this.densityScale = 1.0; // Current density scaling factor (adjusted based on performance)
    this.lastDensityAdjustment = 0; // Time of last density adjustment
    this.densityAdjustmentInterval = 5000; // Adjust every 5 seconds if needed
    
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
  
  async _initialize() {
    console.log("Initializing VegetationSystem...");
    
    // Create tree models with LOD
    this.createTreeModels();
    
    // Initialize instanced meshes
    this.initializeInstancedMeshes();
    
    // Get LOD distances from MobileLODManager if available
    const mobileLOD = this.engine.systems.get('mobileLOD');
    if (mobileLOD) {
        this.lodDistances = mobileLOD.getLODDistances().vegetation;
        console.log(`Using mobile-optimized LOD distances: ${JSON.stringify(this.lodDistances)}`);
        
        if (this.engine.settings?.isMobile) {
            this.densityScale = mobileLOD.currentVegetationDensity;
            console.log(`Using mobile vegetation density: ${this.densityScale}`);
        }
    }
    
    console.log("VegetationSystem initialized");
}
  
  createTreeModels() {
    // Create materials that will be shared between LOD levels
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const pineLeavesMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 });
    const oakLeavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const frondMaterial = new THREE.MeshStandardMaterial({ color: 0x32CD32 });
    
    // Define LOD models for each tree type
    this.treeLODModels = [];
    
    // ----- PINE TREE LODs -----
    const pineLODs = [];
    
    // High detail pine
    const pineHighDetail = new THREE.Group();
    const pineHighTrunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 8);
    const pineHighTrunk = new THREE.Mesh(pineHighTrunkGeo, trunkMaterial);
    pineHighTrunk.position.y = 2;
    
    const pineHighLeavesGeo = new THREE.ConeGeometry(3, 8, 8);
    const pineHighLeaves = new THREE.Mesh(pineHighLeavesGeo, pineLeavesMaterial);
    pineHighLeaves.position.y = 7;
    
    pineHighDetail.add(pineHighTrunk);
    pineHighDetail.add(pineHighLeaves);
    pineHighDetail.scale.set(1.5, 1.5, 1.5);
    pineHighDetail.castShadow = true;
    pineHighDetail.receiveShadow = true;
    pineLODs.push(pineHighDetail);
    
    // Medium detail pine
    const pineMediumDetail = new THREE.Group();
    const pineMediumTrunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 6);
    const pineMediumTrunk = new THREE.Mesh(pineMediumTrunkGeo, trunkMaterial);
    pineMediumTrunk.position.y = 2;
    
    const pineMediumLeavesGeo = new THREE.ConeGeometry(3, 8, 6);
    const pineMediumLeaves = new THREE.Mesh(pineMediumLeavesGeo, pineLeavesMaterial);
    pineMediumLeaves.position.y = 7;
    
    pineMediumDetail.add(pineMediumTrunk);
    pineMediumDetail.add(pineMediumLeaves);
    pineMediumDetail.scale.set(1.5, 1.5, 1.5);
    pineMediumDetail.castShadow = true;
    pineMediumDetail.receiveShadow = true;
    pineLODs.push(pineMediumDetail);
    
    // Low detail pine
    const pineLowDetail = new THREE.Group();
    const pineLowTrunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 4);
    const pineLowTrunk = new THREE.Mesh(pineLowTrunkGeo, trunkMaterial);
    pineLowTrunk.position.y = 2;
    
    const pineLowLeavesGeo = new THREE.ConeGeometry(3, 8, 4);
    const pineLowLeaves = new THREE.Mesh(pineLowLeavesGeo, pineLeavesMaterial);
    pineLowLeaves.position.y = 7;
    
    pineLowDetail.add(pineLowTrunk);
    pineLowDetail.add(pineLowLeaves);
    pineLowDetail.scale.set(1.5, 1.5, 1.5);
    pineLowDetail.castShadow = true;
    pineLowDetail.receiveShadow = true;
    pineLODs.push(pineLowDetail);
    
    // ----- OAK TREE LODs -----
    const oakLODs = [];
    
    // High detail oak
    const oakHighDetail = new THREE.Group();
    const oakHighTrunkGeo = new THREE.CylinderGeometry(0.6, 1, 5, 8);
    const oakHighTrunk = new THREE.Mesh(oakHighTrunkGeo, trunkMaterial);
    oakHighTrunk.position.y = 2.5;
    
    const oakHighLeavesGeo = new THREE.SphereGeometry(4, 8, 8);
    const oakHighLeaves = new THREE.Mesh(oakHighLeavesGeo, oakLeavesMaterial);
    oakHighLeaves.position.y = 7;
    
    oakHighDetail.add(oakHighTrunk);
    oakHighDetail.add(oakHighLeaves);
    oakHighDetail.castShadow = true;
    oakHighDetail.receiveShadow = true;
    oakLODs.push(oakHighDetail);
    
    // Medium detail oak
    const oakMediumDetail = new THREE.Group();
    const oakMediumTrunkGeo = new THREE.CylinderGeometry(0.6, 1, 5, 6);
    const oakMediumTrunk = new THREE.Mesh(oakMediumTrunkGeo, trunkMaterial);
    oakMediumTrunk.position.y = 2.5;
    
    const oakMediumLeavesGeo = new THREE.SphereGeometry(4, 6, 6);
    const oakMediumLeaves = new THREE.Mesh(oakMediumLeavesGeo, oakLeavesMaterial);
    oakMediumLeaves.position.y = 7;
    
    oakMediumDetail.add(oakMediumTrunk);
    oakMediumDetail.add(oakMediumLeaves);
    oakMediumDetail.castShadow = true;
    oakMediumDetail.receiveShadow = true;
    oakLODs.push(oakMediumDetail);
    
    // Low detail oak
    const oakLowDetail = new THREE.Group();
    const oakLowTrunkGeo = new THREE.CylinderGeometry(0.6, 1, 5, 4);
    const oakLowTrunk = new THREE.Mesh(oakLowTrunkGeo, trunkMaterial);
    oakLowTrunk.position.y = 2.5;
    
    const oakLowLeavesGeo = new THREE.SphereGeometry(4, 4, 4);
    const oakLowLeaves = new THREE.Mesh(oakLowLeavesGeo, oakLeavesMaterial);
    oakLowLeaves.position.y = 7;
    
    oakLowDetail.add(oakLowTrunk);
    oakLowDetail.add(oakLowLeaves);
    oakLowDetail.castShadow = true;
    oakLowDetail.receiveShadow = true;
    oakLODs.push(oakLowDetail);
    
    // ----- PALM TREE LODs -----
    const palmLODs = [];
    
    // High detail palm
    const palmHighDetail = new THREE.Group();
    const palmHighTrunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 8, 8);
    const palmHighTrunk = new THREE.Mesh(palmHighTrunkGeo, trunkMaterial);
    palmHighTrunk.position.y = 4;
    palmHighDetail.add(palmHighTrunk);
    
    // Create palm fronds - high detail
    for (let i = 0; i < 7; i++) {
      const frondGeometry = new THREE.ConeGeometry(0.5, 4, 4);
      const frond = new THREE.Mesh(frondGeometry, frondMaterial);
      frond.position.y = 8;
      frond.rotation.x = Math.PI / 4;
      frond.rotation.y = (i / 7) * Math.PI * 2;
      palmHighDetail.add(frond);
    }
    
    palmHighDetail.castShadow = true;
    palmHighDetail.receiveShadow = true;
    palmLODs.push(palmHighDetail);
    
    // Medium detail palm
    const palmMediumDetail = new THREE.Group();
    const palmMediumTrunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 8, 6);
    const palmMediumTrunk = new THREE.Mesh(palmMediumTrunkGeo, trunkMaterial);
    palmMediumTrunk.position.y = 4;
    palmMediumDetail.add(palmMediumTrunk);
    
    // Create palm fronds - medium detail (fewer fronds)
    for (let i = 0; i < 5; i++) {
      const frondGeometry = new THREE.ConeGeometry(0.5, 4, 3);
      const frond = new THREE.Mesh(frondGeometry, frondMaterial);
      frond.position.y = 8;
      frond.rotation.x = Math.PI / 4;
      frond.rotation.y = (i / 5) * Math.PI * 2;
      palmMediumDetail.add(frond);
    }
    
    palmMediumDetail.castShadow = true;
    palmMediumDetail.receiveShadow = true;
    palmLODs.push(palmMediumDetail);
    
    // Low detail palm
    const palmLowDetail = new THREE.Group();
    const palmLowTrunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 8, 4);
    const palmLowTrunk = new THREE.Mesh(palmLowTrunkGeo, trunkMaterial);
    palmLowTrunk.position.y = 4;
    palmLowDetail.add(palmLowTrunk);
    
    // Create palm fronds - low detail (even fewer fronds)
    for (let i = 0; i < 3; i++) {
      const frondGeometry = new THREE.ConeGeometry(0.5, 4, 3);
      const frond = new THREE.Mesh(frondGeometry, frondMaterial);
      frond.position.y = 8;
      frond.rotation.x = Math.PI / 4;
      frond.rotation.y = (i / 3) * Math.PI * 2;
      palmLowDetail.add(frond);
    }
    
    palmLowDetail.castShadow = true;
    palmLowDetail.receiveShadow = true;
    palmLODs.push(palmLowDetail);
    
    // Store LOD models 
    this.treeLODModels = [pineLODs, oakLODs, palmLODs];
    
    // Store reference to original models for backward compatibility
    this.treeModels = [pineLODs[0], oakLODs[0], palmLODs[0]];
  }
  
  /**
   * Initialize instanced mesh renderers for each tree type and LOD level
   */
  initializeInstancedMeshes() {
    // Clear existing instanced meshes
    this.treeInstancedMeshes.forEach(meshGroup => {
      meshGroup.forEach(mesh => this.scene.remove(mesh));
    });
    this.treeInstancedMeshes = [];
    this.treeMatrices = [];
    
    // Reduced maximum number of instances to improve performance
    const maxInstances = 2000; // Reduced from 5000 to improve memory usage
    
    // Initialize arrays for transformation matrices
    this.treeMatrices = [];
    this.treeLODLevels = [];
    
    // For each tree type
    for (let typeIndex = 0; typeIndex < this.treeLODModels.length; typeIndex++) {
      const lodModels = this.treeLODModels[typeIndex];
      const lodInstancedMeshes = [];
      const typeMatrices = [];
      
      // For each LOD level of this tree type
      for (let lodIndex = 0; lodIndex < lodModels.length; lodIndex++) {
        const model = lodModels[lodIndex];
        const instancedMeshes = [];
        
        // For each mesh in the tree model
        model.traverse(child => {
          if (child.isMesh) {
            // Create instanced mesh for this part
            const instancedMesh = new THREE.InstancedMesh(
              child.geometry,
              child.material,
              maxInstances
            );
            
            // Set initial visibility (0 instances)
            instancedMesh.count = 0;
            instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;
            
            // Create dummy object for matrix calculation
            const dummy = new THREE.Object3D();
            instancedMesh.userData.dummy = dummy;
            instancedMesh.userData.originalMesh = child;
            
            // Store relative position and rotation from parent
            instancedMesh.userData.relativePosition = child.position.clone();
            instancedMesh.userData.relativeRotation = child.rotation.clone();
            instancedMesh.userData.relativeScale = child.scale.clone();
            
            instancedMeshes.push(instancedMesh);
            this.scene.add(instancedMesh);
          }
        });
        
        lodInstancedMeshes.push(instancedMeshes);
        typeMatrices.push([]);
      }
      
      this.treeInstancedMeshes.push(lodInstancedMeshes);
      this.treeMatrices.push(typeMatrices);
      this.treeLODLevels.push([]);
    }
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
    const baseDensity = treeType.baseDensity * biomeSetting.densityMult * this.densityScale;
    
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
   * Generate trees for a chunk using instanced rendering
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
    
    // Adaptive number of attempts based on biome, adjusted by density scale
    let attempts;
    switch (biome) {
      case 'forest':
        attempts = Math.floor(300 * this.densityScale); // More attempts in forest biomes
        break;
      case 'mountains':
        attempts = Math.floor(250 * this.densityScale); // Medium attempts in mountains
        break;
      default:
        attempts = Math.floor(150 * this.densityScale); // Fewer in plains
    }
    
    // Collect tree data for instanced rendering
    const newTrees = [];
    
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
        
        // Random rotation
        const rotation = Math.random() * Math.PI * 2;
        
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
        
        // Store tree data for instanced rendering
        newTrees.push({
          type: treeTypeIndex,
          position: new THREE.Vector3(x, height, z),
          rotation: rotation,
          scale: scale,
          lodLevel: 0 // Initial LOD level will be calculated in update
        });
      }
    }
    
    // Add trees to the instanced rendering system
    for (const tree of newTrees) {
      this.addTreeInstance(tree);
    }
    
    // Mark this chunk as processed
    this.chunksWithTrees.add(chunkKey);
  }
  
  /**
   * Add a tree to the instanced rendering system
   * @param {Object} tree - Tree data object
   */
  addTreeInstance(tree) {
    const { type, position, rotation, scale } = tree;
    
    // Get current number of trees of this type
    const typeMatrices = this.treeMatrices[type];
    let initialLODLevel = 0; // Start with high detail
    
    // Check if we need to expand the matrices array for this tree type/LOD
    if (typeMatrices[initialLODLevel].length >= this.treeInstancedMeshes[type][initialLODLevel][0].count) {
      // Expand the number of visible instances if needed
      const newCount = typeMatrices[initialLODLevel].length + 1;
      
      // Update count for all meshes in this LOD level
      for (const mesh of this.treeInstancedMeshes[type][initialLODLevel]) {
        mesh.count = newCount;
      }
    }
    
    // Create tree matrix
    const treeIndex = typeMatrices[initialLODLevel].length;
    const treeMatrix = new THREE.Matrix4();
    
    // Set position, rotation and scale
    treeMatrix.compose(
      position, 
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation),
      new THREE.Vector3(scale, scale, scale)
    );
    
    // Store matrix for this tree
    typeMatrices[initialLODLevel].push(treeMatrix);
    
    // Store initial LOD level
    this.treeLODLevels[type].push(initialLODLevel);
    
    // Update instance matrices
    this.updateTreeInstanceMatrices(type, initialLODLevel, treeIndex);
  }
  
  /**
   * Update matrices for instanced tree meshes
   * @param {number} type - Tree type index
   * @param {number} lodLevel - LOD level
   * @param {number} index - Tree index
   */
  updateTreeInstanceMatrices(type, lodLevel, index) {
    // Skip if invalid parameters
    if (!this.treeInstancedMeshes[type] || 
        !this.treeInstancedMeshes[type][lodLevel] || 
        !this.treeMatrices[type] || 
        !this.treeMatrices[type][lodLevel] || 
        index >= this.treeMatrices[type][lodLevel].length) {
      return;
    }
    
    const instancedMeshes = this.treeInstancedMeshes[type][lodLevel];
    const matrix = this.treeMatrices[type][lodLevel][index];
    
    // Update matrix for each mesh in the instanced group
    for (let i = 0; i < instancedMeshes.length; i++) {
      const instancedMesh = instancedMeshes[i];
      const dummy = instancedMesh.userData.dummy;
      
      // Extract base transformation from the tree matrix
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, quaternion, scale);
      
      // Apply relative position/rotation/scale from the original mesh
      dummy.position.copy(position);
      dummy.quaternion.copy(quaternion);
      dummy.scale.copy(scale);
      
      // If this mesh has a relative position/rotation/scale, apply it
      if (instancedMesh.userData.relativePosition) {
        // Scale the relative position by the tree scale
        const scaledPos = instancedMesh.userData.relativePosition.clone().multiply(scale);
        dummy.position.add(scaledPos.applyQuaternion(quaternion));
      }
      
      if (instancedMesh.userData.relativeRotation) {
        // Apply relative rotation
        const relQuat = new THREE.Quaternion().setFromEuler(instancedMesh.userData.relativeRotation);
        dummy.quaternion.multiply(relQuat);
      }
      
      if (instancedMesh.userData.relativeScale) {
        // Apply relative scale
        dummy.scale.multiply(instancedMesh.userData.relativeScale);
      }
      
      // Update matrix
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(index, dummy.matrix);
      instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }
  
  /**
   * Switch a tree instance to a different LOD level
   * @param {number} type - Tree type index
   * @param {number} index - Tree index
   * @param {number} oldLOD - Old LOD level
   * @param {number} newLOD - New LOD level
   */
  switchTreeLOD(type, index, oldLOD, newLOD) {
    // Get tree matrix from old LOD
    if (!this.treeMatrices[type] || !this.treeMatrices[type][oldLOD] || 
        index >= this.treeMatrices[type][oldLOD].length) {
      return;
    }
    
    const matrix = this.treeMatrices[type][oldLOD][index];
    
    // Remove from old LOD level (swap with last element to avoid gaps)
    const lastIndex = this.treeMatrices[type][oldLOD].length - 1;
    if (index !== lastIndex) {
      // Move the last tree to this index
      this.treeMatrices[type][oldLOD][index] = this.treeMatrices[type][oldLOD][lastIndex];
      
      // Find the tree that was at lastIndex and update its LOD level tracking
      // This is crucial for maintaining correct LOD level tracking
      for (let i = 0; i < this.treeLODLevels[type].length; i++) {
        // If we find a tree with the oldLOD level that will be moved
        if (this.treeLODLevels[type][i] === oldLOD) {
          // Update to the new index
          this.treeLODLevels[type][i] = index;
          break;
        }
      }
      
      // Update the moved tree's matrices
      this.updateTreeInstanceMatrices(type, oldLOD, index);
    }
    
    // Remove the last element (now duplicated)
    this.treeMatrices[type][oldLOD].pop();
    
    // Update count for all meshes in old LOD level
    for (const mesh of this.treeInstancedMeshes[type][oldLOD]) {
      mesh.count = this.treeMatrices[type][oldLOD].length;
      mesh.instanceMatrix.needsUpdate = true;
    }
    
    // Add to new LOD level
    const newIndex = this.treeMatrices[type][newLOD].length;
    this.treeMatrices[type][newLOD].push(matrix);
    
    // Update count for all meshes in new LOD level
    for (const mesh of this.treeInstancedMeshes[type][newLOD]) {
      mesh.count = this.treeMatrices[type][newLOD].length;
      mesh.instanceMatrix.needsUpdate = true;
    }
    
    // Update matrices in new LOD level
    this.updateTreeInstanceMatrices(type, newLOD, newIndex);
    
    // Update LOD level tracking - find the appropriate tree to update
    // This is more reliable than assuming it's at a specific index
    let found = false;
    for (let i = 0; i < this.treeLODLevels[type].length; i++) {
      if (this.treeLODLevels[type][i] === oldLOD) {
        this.treeLODLevels[type][i] = newLOD;
        found = true;
        break;
      }
    }
    
    if (!found) {
      // If somehow we didn't find the appropriate tree, add a fallback
      this.treeLODLevels[type].push(newLOD);
    }
  }
  
  /**
   * Update method called every frame
   */
  _update(deltaTime, elapsed) {
    const player = this.engine.systems.get('player')?.localPlayer;
    if (!player) return;
    
    // Calculate current chunk
    const worldSystem = this.engine.systems.get('world');
    const chunkSize = worldSystem.chunkSize;
    const playerChunkX = Math.floor(player.position.x / chunkSize);
    const playerChunkZ = Math.floor(player.position.z / chunkSize);
    
    // Keep track of chunks that should have trees
    const chunksToKeep = new Set();
    const viewDistance = worldSystem.viewDistance;
    
    // Update camera frustum for culling
    if (this.engine.camera) {
        this.projScreenMatrix.multiplyMatrices(
            this.engine.camera.projectionMatrix,
            this.engine.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    }
    
    // Update density scale based on performance
    this.updateDensityScale();
    
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
    
    // Update tree instances LOD and culling
    this.updateTreeInstancesLOD();
    
    // Clean up chunks that are too far away
    this.cleanupDistantChunks(chunksToKeep);
}
  
  /**
   * Update LOD levels for all tree instances based on distance from camera
   */
  updateTreeInstancesLOD() {
    const camera = this.engine.camera;
    if (!camera) return;
    
    const cameraPosition = camera.position;
    
    // Get current LOD distances - potentially updated by MobileLODManager
    let currentLODDistances = this.lodDistances;
    if (this.engine.systems.mobileLOD && this.engine.settings && this.engine.settings.isMobile) {
      currentLODDistances = this.engine.systems.mobileLOD.getLODDistances().vegetation;
    }
    
    // Process each tree type and check LOD levels
    for (let type = 0; type < this.treeMatrices.length; type++) {
      for (let lod = 0; lod < this.treeMatrices[type].length; lod++) {
        // Skip if no instances at this LOD level
        if (this.treeMatrices[type][lod].length === 0) continue;
        
        // Process each tree at this LOD level
        for (let i = this.treeMatrices[type][lod].length - 1; i >= 0; i--) {
          const matrix = this.treeMatrices[type][lod][i];
          
          // Extract position from matrix
          const position = new THREE.Vector3();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(position, quaternion, scale);
          
          // Calculate distance to camera
          const distanceToCamera = position.distanceTo(cameraPosition);
          
          // Check if should be culled by MobileLODManager
          if (this.engine.systems.mobileLOD && 
              this.engine.settings && 
              this.engine.settings.isMobile && 
              this.engine.systems.mobileLOD.shouldCull(position, cameraPosition, currentLODDistances.low)) {
            this.removeTreeInstance(type, lod, i);
            continue;
          }
          
          // Determine appropriate LOD level based on distance
          let targetLOD;
          if (distanceToCamera < currentLODDistances.high) {
            targetLOD = 0; // High detail
          } else if (distanceToCamera < currentLODDistances.medium) {
            targetLOD = 1; // Medium detail
          } else {
            targetLOD = 2; // Low detail
          }
          
          // Update LOD level if needed
          if (lod !== targetLOD) {
            this.switchTreeLOD(type, i, lod, targetLOD);
            // Adjust index after switching (since we removed an element)
            i--;
          }
          
          // Check if tree is within frustum or too far away
          // This can be further optimized with bounding spheres
          if (distanceToCamera > currentLODDistances.low) {
            // Remove trees that are too far away
            this.removeTreeInstance(type, lod, i);
          } else if (this.frustum) {
            // Check if within camera frustum
            const sphere = new THREE.Sphere(position, Math.max(scale.x, scale.y, scale.z) * 8);
            if (!this.frustum.intersectsSphere(sphere)) {
              // Remove trees that are outside the frustum
              this.removeTreeInstance(type, lod, i);
            }
          }
        }
      }
    }
  }
  
  /**
   * Remove a tree instance from the rendering system
   * @param {number} type - Tree type index
   * @param {number} lod - LOD level
   * @param {number} index - Tree index
   */
  removeTreeInstance(type, lod, index) {
    // Skip if invalid parameters
    if (!this.treeMatrices[type] || !this.treeMatrices[type][lod] || 
        index >= this.treeMatrices[type][lod].length) {
      return;
    }
    
    // Remove from matrices (swap with last element to avoid gaps)
    const lastIndex = this.treeMatrices[type][lod].length - 1;
    if (index !== lastIndex) {
      // Move the last tree to this index
      this.treeMatrices[type][lod][index] = this.treeMatrices[type][lod][lastIndex];
      
      // Update the moved tree's matrices
      this.updateTreeInstanceMatrices(type, lod, index);
    }
    
    // Remove the last element (now duplicated)
    this.treeMatrices[type][lod].pop();
    
    // Update count for all meshes in this LOD level
    for (const mesh of this.treeInstancedMeshes[type][lod]) {
      mesh.count = this.treeMatrices[type][lod].length;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  
  /**
   * Update density scale based on performance metrics
   */
  updateDensityScale() {
    // If MobileLODManager is available and on mobile, let it control vegetation density
    if (this.engine.systems.mobileLOD && 
        this.engine.settings && 
        this.engine.settings.isMobile) {
      
      // Check if density scale needs updating from MobileLODManager
      const mobileDensity = this.engine.systems.mobileLOD.currentVegetationDensity;
      if (mobileDensity !== this.densityScale) {
        console.log(`Updating vegetation density from MobileLODManager: ${mobileDensity.toFixed(2)}`);
        this.densityScale = mobileDensity;
      }
      
      return;
    }
    
    // For non-mobile devices, use the original density scaling algorithm
    
    // Skip if no performance monitor available or too soon since last adjustment
    if (!this.performanceMonitor || 
        Date.now() - this.lastDensityAdjustment < this.densityAdjustmentInterval) {
      return;
    }
    
    // Get current FPS from performance monitor if available
    let currentFPS = 60; // Default assumption
    
    // Check if performanceMonitor has a getAverages method to get more stable readings
    if (this.performanceMonitor && typeof this.performanceMonitor.getAverages === 'function') {
      // Use the more stable averages instead of raw metrics
      const averages = this.performanceMonitor.getAverages();
      if (averages && typeof averages.fps === 'number') {
        currentFPS = averages.fps;
      }
    } else if (this.performanceMonitor && this.performanceMonitor.metrics && 
        this.performanceMonitor.metrics.fps.length > 0) {
      // Fall back to manual calculation if getAverages isn't available
      const recentFPS = this.performanceMonitor.metrics.fps.slice(
        Math.max(0, this.performanceMonitor.metrics.fps.length - 5));
      if (recentFPS.length > 0) {
        // Sort and remove outliers for more stability
        const sortedFPS = [...recentFPS].sort((a, b) => a - b);
        const validFPS = sortedFPS.slice(1, sortedFPS.length - 1); // Remove highest and lowest
        currentFPS = validFPS.length > 0 
          ? validFPS.reduce((sum, fps) => sum + fps, 0) / validFPS.length
          : (recentFPS.length > 0 ? recentFPS[recentFPS.length - 1] : 60);
      }
    }
    
    // Ignore extremely high or low values that are likely measurement errors
    if (currentFPS < 1 || currentFPS > 150) {
      console.log(`Ignoring unrealistic FPS value: ${currentFPS}`);
      return;
    }
    
    // Check current triangle count to determine if we need more aggressive optimization
    let highTriangleCount = false;
    let extremeTriangleCount = false;
    let triangleCount = 0;
    
    if (this.performanceMonitor && this.performanceMonitor.metrics && 
        this.performanceMonitor.metrics.triangles.length > 0) {
      triangleCount = this.performanceMonitor.metrics.triangles[
        this.performanceMonitor.metrics.triangles.length - 1];
      
      // Modern GPUs can handle higher triangle counts, so adjust thresholds
      highTriangleCount = triangleCount > 400000; // Only consider high if over 400k triangles  
      extremeTriangleCount = triangleCount > 500000; // Extreme optimization needed above 500k
    }
    
    // Update density scale based on performance
    // Prioritize FPS over triangle count, but still consider both
    if (currentFPS < this.targetFPS * 0.7 || extremeTriangleCount) { 
      // Severe performance issue - aggressive reduction
      const reductionFactor = 0.1;
      this.densityScale = Math.max(0.3, this.densityScale - reductionFactor);
      console.log(`Reducing vegetation density to ${this.densityScale.toFixed(2)} due to ${extremeTriangleCount ? 'extreme triangle count' : 'very low FPS'} (${currentFPS.toFixed(1)} FPS, ${triangleCount} triangles)`);
    } else if (currentFPS < this.targetFPS * 0.9 || highTriangleCount) {
      // Moderate performance issue - gentle reduction
      const reductionFactor = 0.05;
      this.densityScale = Math.max(0.3, this.densityScale - reductionFactor);
      console.log(`Reducing vegetation density to ${this.densityScale.toFixed(2)} due to ${highTriangleCount ? 'high triangle count' : 'low FPS'} (${currentFPS.toFixed(1)} FPS, ${triangleCount} triangles)`);
    } else if (currentFPS > this.targetFPS * 1.2 && this.densityScale < 1.0 && triangleCount < 350000) {
      // Good performance and reasonable triangle count - increase density
      this.densityScale = Math.min(1.0, this.densityScale + 0.02);
      console.log(`Increasing vegetation density to ${this.densityScale.toFixed(2)} due to good performance (${currentFPS.toFixed(1)} FPS, ${triangleCount} triangles)`);
    }
    
    // Record time of adjustment
    this.lastDensityAdjustment = Date.now();
  }
  
  /**
   * Regenerate all trees with current density settings
   * Used when density scale changes significantly
   */
  regenerateVegetation() {
    // Clear all instanced meshes
    for (let type = 0; type < this.treeInstancedMeshes.length; type++) {
      for (let lod = 0; lod < this.treeInstancedMeshes[type].length; lod++) {
        for (const mesh of this.treeInstancedMeshes[type][lod]) {
          mesh.count = 0;
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
    
    // Reset matrices and LOD levels
    for (let type = 0; type < this.treeMatrices.length; type++) {
      for (let lod = 0; lod < this.treeMatrices[type].length; lod++) {
        this.treeMatrices[type][lod] = [];
      }
      this.treeLODLevels[type] = [];
    }
    
    // Clear chunk tracking to force regeneration
    this.chunksWithTrees.clear();
  }
  
  /**
   * Handles visibility change event from the engine
   * @param {boolean} isVisible - Whether the game is visible
   */
  handleVisibilityChange(isVisible) {
    if (isVisible) {
      // Regenerate vegetation when returning to tab
      this.regenerateVegetation();
    }
  }
}