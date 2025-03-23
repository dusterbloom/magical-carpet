import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

export class WorldSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    
    // Initialize frustum culling
    this.frustum = new THREE.Frustum();
    this.frustumMatrix = new THREE.Matrix4();
    this.cameraViewProjectionMatrix = new THREE.Matrix4();
    this.boundingSpheres = new Map();  // Store bounding spheres for quick checks
    
    // Chunk pooling for geometry reuse
    this.geometryPool = {};
    this.pooledGeometries = 0;
    this.poolHits = 0;
    this.poolMisses = 0;

    if (engine.renderer) {
      // Improve shadow mapping
      engine.renderer.shadowMap.enabled = true;
      engine.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Improve overall rendering quality
      engine.renderer.outputColorSpace = THREE.SRGBColorSpace;
      engine.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      engine.renderer.toneMappingExposure = 1.1;
    }

    // Initialize maps and collections
    this.currentChunks = new Map();
    this.manaNodes = [];
    
    // Memory management
    this.memorySettings = {
      maxActiveChunks: 512,
      maxPooledGeometries: 512,
      maxTerrainCacheEntries: 1000,
      maxBoundingSpheres: 300
    };
    
    // Performance monitoring
    this.perfStats = {
      lastChunkCreationTime: 0,
      avgChunkCreationTime: 0,
      chunkCreationSamples: 0,
      lastUpdateTime: 0,
      frameTimes: []
    };

    // World configuration
    this.chunkSize = 256;
    this.terrainResolution = 64;
    this.maxHeight = 300;  // Increased from 120
    this.minHeight = -40;  // Deeper valleys
    this.waterLevel = 0;
    this.viewDistance = 3;
    
    // Level of Detail (LOD) system configuration
    this.terrainLOD = {
      distances: [
        { distance: 500, resolution: 64 },    // Close chunks: high detail
        { distance: 1000, resolution: 64 },   // Medium chunks: medium detail
        { distance: 1500, resolution: 32 },   // Far chunks: low detail
        { distance: 2000, resolution: 16 }     // Very far chunks: very low detail
      ],
      // Default LOD materials (will create in createMaterials)
      materials: {}
    };
    
    // Use lower detail for mobile devices
    if (engine.isMobile) {
      this.terrainLOD.distances = [
        { distance: 300, resolution: 32 },    // Close chunks: medium detail on mobile
        { distance: 600, resolution: 16 },    // Medium chunks: low detail on mobile
        { distance: 1000, resolution: 8 }     // Far chunks: very low detail on mobile
      ];
      // Also reduce view distance on mobile
      this.viewDistance = 4;
      
      // Adjust memory settings for mobile
      this.memorySettings.maxActiveChunks = 128;
      this.memorySettings.maxPooledGeometries = 32;
      this.memorySettings.maxTerrainCacheEntries = 2000;
      this.memorySettings.maxBoundingSpheres = 150;
    }
    
    // Terrain parameters
    this.terrainParams = {
      baseScale: 0.05,        // Reduced from 0.003 - larger features
      detailScale: 0.019,        // Reduced from 0.015 - smoother details
      mountainScale: 0.004,     // Reduced from 0.008 - larger mountains
      baseHeight: 40,          // Increased from 40
      mountainHeight: 100,      // Increased from 80 
      detailHeight: 20          // Increased from 20
    };

    // Initialize noise generator
    this.seed = Math.random() * 10000;
    this.noise = createNoise2D();
    
    // Define biomes
    this.biomes = {
      ocean: { threshold: -0.3, color: new THREE.Color(0x0066aa) },
      beach: { threshold: 0.2, color: new THREE.Color(0xdddd77) },
      plains: { threshold: 0.2, color: new THREE.Color(0x44aa44) },
      forest: { threshold: -0.4, color: new THREE.Color(0x227722) },
      mountains: { threshold: 0.6, color: new THREE.Color(0x888888) },
      snow: { threshold: 0.8, color: new THREE.Color(0xffffff) }
    };

    // Materials collection
    this.materials = {};
    
    // Landmarks configuration
    this.landmarks = new Map();
    this.landmarkTypes = [
      {
        name: "ancient_ruins",
        minHeight: 10,
        maxHeight: 60,
        minDistance: 50,    // Minimum distance between same type
        maxSlope: 0.2,        // Must be on relatively flat ground
        frequency: 0.1,   // Rarity factor
        size: { min: 20, max: 40 },
        requiresWater: false
      },
      {
        name: "magical_circle",
        minHeight: 5,
        maxHeight: 80,
        minDistance: 800,
        maxSlope: 0.3,
        frequency: 0.2,
        size: { min: 10, max: 25 },
        requiresWater: false
      },
      {
        name: "crystal_formation",
        minHeight: 40,
        maxHeight: 120,
        minDistance: 1200,
        maxSlope: 0.6,        // Can be on steeper terrain
        frequency: 0.000015,
        size: { min: 15, max: 35 },
        requiresWater: false
      },
      {
        name: "stone_arch",
        minHeight: 20,
        maxHeight: 90,
        minDistance: 100,
        maxSlope: 0.4,
        frequency: 0.12,
        size: { min: 25, max: 50 },
        requiresWater: false
      },
      {
        name: "ancient_temple",
        minHeight: 30,
        maxHeight: 70,
        minDistance: 200,    // Very rare
        maxSlope: 0.1,        // Needs very flat terrain
        frequency: 0.000005,
        size: { min: 40, max: 80 },
        requiresWater: false
      },
      {
        name: "oasis",
        minHeight: 5,
        maxHeight: 30,
        minDistance: 1000,
        maxSlope: 0.15,
        frequency: 0.3,
        size: { min: 15, max: 35 },
        requiresWater: true   // Must be near water
      }
    ];
  }

  /**
   * Creates multi-octave noise for more natural terrain
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {number} baseFrequency - Base frequency of the noise
   * @param {number} octaves - Number of noise layers to combine
   * @param {number} persistence - How much each octave contributes
   * @param {number} lacunarity - How frequency increases with each octave
   * @returns {number} Combined noise value in range [-1, 1]
   */
  fractalNoise(x, z, baseFrequency, octaves, persistence, lacunarity) {
    let frequency = baseFrequency;
    let amplitude = 1.0;
    let total = 0;
    let maxValue = 0;
    
    // Sum multiple layers of noise
    for (let i = 0; i < octaves; i++) {
      // Sample noise at current frequency
      const noiseValue = this.noise(
        x * frequency + this.seed * (i + 1),
        z * frequency + this.seed * (i + 2)
      );
      
      // Add weighted noise to total
      total += noiseValue * amplitude;
      maxValue += amplitude;
      
      // Each octave has higher frequency but lower amplitude
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    
    // Normalize to range [-1, 1]
    return total / maxValue;
  }

  /**
   * Creates ridged noise for mountains with sharp peaks
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {number} frequency - Noise frequency
   * @param {number} octaves - Number of noise layers to combine
   * @returns {number} Ridged noise value in range [0, 1]
   */
  ridgedNoise(x, z, frequency, octaves = 4) {
    let result = 0;
    let amplitude = 1.0;
    let freq = frequency;
    let weight = 1.0;
    
    for (let i = 0; i < octaves; i++) {
      // Get absolute noise value and invert it
      let noiseValue = Math.abs(this.noise(
        x * freq + this.seed * (i * 2 + 1),
        z * freq + this.seed * (i * 2 + 2)
      ));
      noiseValue = 1.0 - noiseValue;
      
      // Square the value for sharper ridges
      noiseValue *= noiseValue;
      
      // Apply weighting to successive octaves
      noiseValue *= weight;
      
      // Weight successive octaves by previous noise value
      weight = noiseValue;
      
      // Add to result
      result += noiseValue * amplitude;
      
      // Next octave
      freq *= 2.0;
      amplitude *= 0.5;
    }
    
    return result;
  }
  
  async initialize() {
    console.log("Initializing WorldSystem...");
    
    // Create materials and setup environment
    await this.createMaterials();
    this.createLights();
    this.createSky();
    
    // Set initial camera position for a better view
    this.engine.camera.position.set(0, 500, 500);
    this.engine.camera.lookAt(0, 0, 0);
    
    // Initialize geometry pool for different LOD levels
    this.initializeGeometryPool();
    
    // Generate initial world
    this.createInitialTerrain();
    this.createWater();
    this.createManaNodes();
    
    if (this.engine.camera) {
      this.engine.camera.far = 25000; // Increased from 15000
      this.engine.camera.updateProjectionMatrix();
    }
    
    // Setup memory management - periodically check memory usage
    this.memoryCheckInterval = setInterval(() => this.checkMemoryUsage(), 30000);
    
    console.log("WorldSystem initialized");
  }
  
  initializeGeometryPool() {
    // Create pools for each LOD level
    for (let i = 0; i < this.terrainLOD.distances.length; i++) {
      const resolution = this.terrainLOD.distances[i].resolution;
      this.geometryPool[resolution] = [];
    }
  }
  
  getPooledGeometry(resolution) {
    // Try to get geometry from pool
    if (this.geometryPool[resolution] && this.geometryPool[resolution].length > 0) {
      this.poolHits++;
      return this.geometryPool[resolution].pop();
    }
    
    // No pooled geometry available, create a new one
    this.poolMisses++;
    return new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      resolution,
      resolution
    );
  }
  
  returnGeometryToPool(geometry) {
    if (!geometry) return;
    
    // Get resolution from geometry parameters
    const resolution = geometry.parameters.widthSegments;
    
    // Clear any vertex colors to free up memory
    if (geometry.attributes.color) {
      geometry.deleteAttribute('color');
    }
    
    // Add back to pool if we have space
    if (this.geometryPool[resolution] && 
        this.pooledGeometries < this.memorySettings.maxPooledGeometries) {
      this.geometryPool[resolution].push(geometry);
      this.pooledGeometries++;
    } else {
      // Dispose if pool is full
      geometry.dispose();
    }
  }
  
  checkMemoryUsage() {
    // Check and manage memory usage
    
    // Get current memory stats if available
    let memInfo = '';
    if (this.engine.renderer && this.engine.renderer.info) {
      const rendererInfo = this.engine.renderer.info;
      memInfo = `Geometries: ${rendererInfo.memory.geometries}, ` +
               `Textures: ${rendererInfo.memory.textures}, ` +
               `Programs: ${rendererInfo.programs?.length || 0}`;
    }
    
    // Log memory usage and pool stats
    console.log(`Memory usage: ${memInfo}`);
    console.log(`Geometry pool: ${this.pooledGeometries} cached, ` +
               `hit rate: ${(this.poolHits / (this.poolHits + this.poolMisses) * 100).toFixed(1)}%`);
    
    // Adaptive memory management based on performance
    this.adaptMemorySettings();
  }
  
  adaptMemorySettings() {
    // Calculate average frame time (if we have samples)
    if (this.perfStats.frameTimes.length > 0) {
      const avgFrameTime = this.perfStats.frameTimes.reduce((a, b) => a + b, 0) / 
                          this.perfStats.frameTimes.length;
      
      // Adjust memory settings based on performance
      if (avgFrameTime > 33) { // Below 30 FPS
        // Reduce memory usage to improve performance
        this.memorySettings.maxActiveChunks = Math.max(64, this.memorySettings.maxActiveChunks * 0.8);
        this.memorySettings.maxPooledGeometries = Math.max(16, this.memorySettings.maxPooledGeometries * 0.8);
        console.log('Performance low, reducing memory usage');
      } else if (avgFrameTime < 20 && !this.engine.isMobile) { // Good performance on desktop
        // Can use more memory for better quality
        this.memorySettings.maxActiveChunks = Math.min(400, this.memorySettings.maxActiveChunks * 1.1);
        this.memorySettings.maxPooledGeometries = Math.min(128, this.memorySettings.maxPooledGeometries * 1.1);
        console.log('Performance good, increasing memory usage');
      }
    }
    
    // Reset frame time samples for next interval
    this.perfStats.frameTimes = [];
  }

  createMaterials() {
    // Create main terrain material
    this.materials.terrain = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.5,
      
      // Add subtle normal mapping for micro details
      normalScale: new THREE.Vector2(0.05, 0.05)
    });
    
    // Create LOD materials with decreasing quality
    // LOD 0 - Highest quality (closest to camera)
    this.terrainLOD.materials[0] = this.materials.terrain;
    
    // LOD 1 - Medium quality
    this.terrainLOD.materials[1] = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0.01,
      envMapIntensity: 0.3,
      // Simplified material properties for medium distance
      flatShading: this.engine.isMobile
    });
    
    // LOD 2 - Low quality
    this.terrainLOD.materials[2] = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.2,
      flatShading: true  // Use flat shading for far distances
    });
    
    // LOD 3 - Lowest quality (furthest from camera)
    this.terrainLOD.materials[3] = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      // Lambert material is faster than standard material
      flatShading: true
    });
    
    // Create water material
    this.materials.water = new THREE.MeshPhysicalMaterial({
      color: 0x0099ee,
      transparent: true,
      opacity: 0.80,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.5,
      thickness: 1.0,
      side: THREE.DoubleSide,
      envMapIntensity: 1.0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2
    });
    
    // Create simplified water material for mobile
    if (this.engine.isMobile) {
      this.materials.water = new THREE.MeshStandardMaterial({
        color: 0x0099ee,
        transparent: true,
        opacity: 0.80,
        roughness: 0.1,
        metalness: 0.1,
        side: THREE.DoubleSide
      });
    }
  }
  
  createLights() {
    // Clear any existing lights first
    this.scene.traverse((object) => {
      if (object.isDirectionalLight || object.isAmbientLight) {
        this.scene.remove(object);
      }
    });

    // Main directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffeb, 0.8);
    sunLight.position.set(300, 400, 200);
    
    // Improved shadow settings
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1000;
    sunLight.shadow.camera.left = -500;
    sunLight.shadow.camera.right = 500;
    sunLight.shadow.camera.top = 500;
    sunLight.shadow.camera.bottom = -500;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    
    // Softer shadows
    sunLight.shadow.radius = 2;
    
    this.scene.add(sunLight);
    
    // Secondary directional light for softer shadows on other side
    const secondaryLight = new THREE.DirectionalLight(0xffffcc, 0.3);
    secondaryLight.position.set(-200, 300, -100);
    this.scene.add(secondaryLight);

    // Stronger ambient light to fill shadows
    const ambientLight = new THREE.AmbientLight(0x445566, 0.7);
    this.scene.add(ambientLight);
    
    // Add a subtle hemispheric light
    const hemisphereLight = new THREE.HemisphereLight(0x88aaff, 0x665544, 0.5);
    this.scene.add(hemisphereLight);
    
    // Expose the primary sun light for time-of-day updates
    this.sunLight = sunLight;
  }
  
  createSky() {
    // Simple sky color
    this.scene.background = new THREE.Color(0x88ccff);
    
    // Use FogExp2 for more natural distance fog
    this.scene.fog = new THREE.FogExp2(0x88ccff, 0.00008); // Reduced from 0.0002 for longer view distance
  }

  getTerrainHeight(x, z) {
    try {
      // Generate continent shape using large-scale noise
      const continentShape = this.fractalNoise(
        x, z,
        0.00005, // Even lower frequency for larger landmasses (was 0.0001)
        3,      // Just a few octaves for smooth continent shape
        0.5,    // Persistence
        2.0     // Lacunarity
      );
      
      // Apply continent mask to create oceans and landmasses
      const continentMask = Math.max(0, (continentShape + 0.3) * 1.2);
      
      // If in ocean, set to ocean depth
      if (continentMask <= 0.1) {
        // Deep ocean depth proportional to distance from shore
        return this.waterLevel - 20 - 80 * (0.1 - continentMask);
      }
      
      // Add beach transition zone
      if (continentMask > 0.1 && continentMask < 0.25) {
        // Calculate how far into the beach zone we are (0.0 to 1.0)
        const beachProgress = (continentMask - 0.1) / 0.15;
        
        // Create smooth beach slopes that rise gently from water
        const beachHeight = this.waterLevel - 2 + (beachProgress * beachProgress * 20);
        
        // Add some small dunes and texture to beaches
        const beachNoiseScale = 0.05;
        const beachNoise = this.fractalNoise(x, z, beachNoiseScale, 2, 0.5, 2.0);
        return beachHeight + beachNoise * 3 * beachProgress;
      }
      
      // Generate base terrain with multiple noise octaves
      const baseNoise = this.fractalNoise(
        x, z,
        this.terrainParams.baseScale,
        4, // More octaves for varied terrain
        0.5,
        2.0
      );
      
      // Start with base terrain height
      let height = (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;
      
      // Add coastal cliffs in some areas but not others
      if (continentMask > 0.25 && continentMask < 0.35) {
        // Calculate coastal influence (0.0 to 1.0)
        const coastProgress = (continentMask - 0.25) / 0.1;
        
        // Create cliff noise that varies along coastlines
        const cliffNoiseScale = 0.02;
        const cliffVariation = this.fractalNoise(x, z, cliffNoiseScale, 2, 0.5, 2.0);
        
        // Only create steep cliffs where noise is high, otherwise keep gentle slopes
        if (cliffVariation > 0.3) {
          // Steep cliff factor based on noise
          const cliffFactor = Math.pow((cliffVariation - 0.3) / 0.7, 2) * coastProgress;
          height += 40 * cliffFactor;
        }
      }
      
      // Add mountains using ridged noise
      if (continentMask > 0.3) { // Only add mountains on land, away from shores
        const mountainNoise = this.ridgedNoise(
          x, z,
          this.terrainParams.mountainScale,
          4
        );
        
        // Apply mountains with continent mask and more dramatic scaling
        height += mountainNoise * this.terrainParams.mountainHeight * (continentMask - 0.2) * 1.5;
      }
      
      // Get temperature and moisture for biome-specific height adjustments
      const rawTemperature = this.fractalNoise(x, z, 0.0005, 2, 0.5, 2.0);
      const rawMoisture = this.fractalNoise(x, z, 0.0004, 2, 0.5, 2.0);
      
      // Normalize to [0,1] range
      const temperature = (rawTemperature + 1) * 0.5;
      const moisture = (rawMoisture + 1) * 0.5;
      
      // Add biome-specific terrain adjustments
      if (temperature > 0.7 && moisture < 0.3) {
        // Deserts have dunes
        const duneNoise = this.fractalNoise(x, z, 0.02, 2, 0.5, 2.0);
        height += duneNoise * 5;
      }
      
      // Add plateaus occasionally
      const plateauNoise = this.noise(x * 0.0004 + this.seed * 9, z * 0.0004 + this.seed * 10);
      if (plateauNoise > 0.7 && height > 60 && height < 250) {
        // Flatten areas with plateau noise
        const targetHeight = Math.round(height / 40) * 40; // Round to nearest 40 units
        const plateauWeight = (plateauNoise - 0.7) * (1 / 0.3);
        height = height * (1 - plateauWeight) + targetHeight * plateauWeight;
      }
      
      // Add small terrain details
      const detailNoise = this.fractalNoise(
        x, z,
        this.terrainParams.detailScale,
        2, // Fewer octaves for details
        0.5,
        2.0
      );
      
      height += detailNoise * this.terrainParams.detailHeight * 0.5;
      
      return height;
    } catch (error) {
      console.warn("Error in getTerrainHeight:", error);
      return 0;
    }
  }

  /**
   * Calculate slope at a given position
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @returns {number} Slope value between 0 and 1
   */
  calculateSlope(x, z) {
    const sampleDistance = 2;
    
    // Sample heights in 4 directions
    const heightCenter = this.getTerrainHeight(x, z);
    const heightNorth = this.getTerrainHeight(x, z - sampleDistance);
    const heightSouth = this.getTerrainHeight(x, z + sampleDistance);
    const heightEast = this.getTerrainHeight(x + sampleDistance, z);
    const heightWest = this.getTerrainHeight(x - sampleDistance, z);
    
    // Calculate slope gradients
    const gradientX = (heightEast - heightWest) / (2 * sampleDistance);
    const gradientZ = (heightSouth - heightNorth) / (2 * sampleDistance);
    
    // Calculate slope magnitude
    const slope = Math.sqrt(gradientX * gradientX + gradientZ * gradientZ);
    
    return slope;
  }

  getBiomeColor(height, x, z) {
    // Get climate data for position
    const rawTemperature = this.fractalNoise(x, z, 0.0005, 2, 0.5, 2.0);
    const rawMoisture = this.fractalNoise(x, z, 0.0004, 2, 0.5, 2.0);
    
    // Add equator-pole gradient to temperature
    const latitudeEffect = Math.cos((z / 10000) * Math.PI) * 0.2;
    const normalizedTemp = ((rawTemperature + 1) * 0.5) + latitudeEffect;
    const normalizedMoisture = (rawMoisture + 1) * 0.5;
    
    // Get slope information
    const slope = this.calculateSlope(x, z);
    const isSteep = slope > 0.5;
    
    // Add small-scale texture variation
    const textureNoise = this.noise(x * 0.1 + this.seed * 11, z * 0.1 + this.seed * 12);
    const textureVariation = textureNoise * 0.05; // Subtle color variation
    
    let color = new THREE.Color();
    
    // DEEP WATER
    if (height < this.waterLevel - 10) {
      // Deep water with subtle variation
      const depth = Math.min(1, (this.waterLevel - height) / 50);
      color.setRGB(
        0.1 - depth * 0.05,
        0.15 + depth * 0.05,
        0.4 + depth * 0.1
      );
    }
    // SHALLOW WATER
    else if (height < this.waterLevel) {
      // Transition from deep to shallow
      const t = (height - (this.waterLevel - 10)) / 10;
      color.setRGB(0.1, 0.2, 0.5).lerp(new THREE.Color(0.2, 0.4, 0.6), t);
      
      // Add underwater features
      if (textureNoise > 0.7) {
        // Coral or underwater features
        color.r += 0.1;
        color.g += 0.05;
      }
    }
    // BEACHES AND SHORELINES
    else if (height < this.waterLevel + 15) {  // Wider beach zone (increased from 3)
      if (normalizedMoisture > 0.7) {
        // Wet shoreline
        color.setRGB(0.65, 0.65, 0.55);
      } else {
        // Sandy beach - lighter color
        color.setRGB(0.82, 0.78, 0.65);  // Lighter, more yellow beach
        
        // Add subtle beach texture
        color.r += textureVariation * 1.2;  // Increased variation
        color.g += textureVariation * 1.0;
        color.b += textureVariation * 0.5;
      }
      
      // Add wet/dry gradient based on height from water
      const wetnessFactor = 1.0 - Math.min(1.0, (height - this.waterLevel) / 5);
      if (wetnessFactor > 0) {
        // Darker when closer to water
        color.multiplyScalar(1.0 - wetnessFactor * 0.15);
      }
    }
    // LOWLANDS - Biome-specific coloring
    else if (height < 30) {
      if (normalizedTemp > 0.7 && normalizedMoisture < 0.3) {
        // Desert
        color.setRGB(0.8, 0.7, 0.4);
      } else if (normalizedMoisture > 0.6) {
        // Lush grassland or wetland
        color.setRGB(0.2, 0.6, 0.2);
      } else {
        // Standard grassland
        color.setRGB(0.4, 0.6, 0.3);
      }
      
      // Add texture variation
      color.r += textureVariation;
      color.g += textureVariation;
      color.b += textureVariation * 0.5;
    }
    // MID-ALTITUDE - Hills and forests
    else if (height < 120) {  // Increased from 60
      // Determine if this should be forest or rocky hills
      const isForested = normalizedMoisture > 0.4 - (height - 30) / 150;
      
      if (isForested && !isSteep) {
        // Forested areas
        if (normalizedTemp > 0.7) {
          // Warm forest
          color.setRGB(0.2, 0.4, 0.1);
        } else if (normalizedTemp > 0.4) {
          // Temperate forest
          color.setRGB(0.13, 0.4, 0.13);
        } else {
          // Cold forest (coniferous)
          color.setRGB(0.1, 0.3, 0.15);
        }
      } else {
        // Rocky hills
        const rockColor = normalizedMoisture > 0.5 ?
          new THREE.Color(0.3, 0.3, 0.25) :  // Wet rock
          new THREE.Color(0.5, 0.45, 0.35);  // Dry rock
          
        color.copy(rockColor);
      }
      
      // Add slope-based shading
      if (isSteep) {
        // Darken steep slopes
        color.multiplyScalar(0.8);
      }
      
      // Add texture variation
      const variation = this.noise(x * 0.05 + this.seed * 13, z * 0.05 + this.seed * 14) * 0.08;
      color.r += variation;
      color.g += variation;
      color.b += variation * 0.5;
    }
    // HIGH ALTITUDE - Mountains
    else if (height < 250) {  // Increased from 90
      // Base rock color varies with temperature and moisture
      const baseRockColor = normalizedTemp > 0.5 ?
        new THREE.Color(0.5, 0.4, 0.35) :   // Warmer rock (reddish)
        new THREE.Color(0.4, 0.38, 0.35);   // Cooler rock (grayish)
      
      // Darker color for higher elevations
      const rockVariation = (height - 120) / 130;  // Adjusted for new height range
      const darkRock = new THREE.Color(0.3, 0.3, 0.3);
      
      color.copy(baseRockColor).lerp(darkRock, rockVariation * 0.6);
      
      // Add rock striations and texture
      const striation = Math.abs(this.noise(x * 0.05 + this.seed * 15, z * 0.05 + this.seed * 16));
      color.r += striation * 0.15 - 0.05;
      color.g += striation * 0.15 - 0.05;
      color.b += striation * 0.15 - 0.05;
      
      // Add snow patches near the snow line
      if (height > 120 ) {  // Increased from 80
        const snowNoise = this.noise(x * 0.08 + this.seed * 17, z * 0.08 + this.seed * 18);
        const snowAmount = Math.max(0, (height - 200) / 30 + snowNoise * 0.3);
        
        if (snowAmount > 0) {
          // Mix in snow based on snow amount
          const snowColor = new THREE.Color(0.9, 0.9, 0.95);
          color.lerp(snowColor, Math.min(snowAmount, 1));
        }
      }
    }
    // PEAKS - Snow-covered
    else {
      // Snow base color
      const snowWhite = new THREE.Color(0.9, 0.9, 0.95);
      
      // Higher peaks get blue tinge
      const snowBlue = new THREE.Color(0.8, 0.85, 1.0);
      const snowHeight = (height - 250) / 150;  // Adjusted for new height range
      
      color.copy(snowWhite).lerp(snowBlue, Math.min(snowHeight, 1) * 0.4);
      
      // Add texture for snow
      const snowTexture = this.noise(x * 0.08 + this.seed * 19, z * 0.08 + this.seed * 20);
      const variation = snowTexture * 0.05;
      color.r += variation;
      color.g += variation;
      color.b += variation;
      
      // Occasionally expose rock on very steep slopes
      if (isSteep && this.noise(x * 0.1 + this.seed * 21, z * 0.1 + this.seed * 22) > 0.7) {
        const rockColor = new THREE.Color(0.3, 0.3, 0.3);
        color.lerp(rockColor, 0.5);
      }
    }
    
    // Ensure color values are valid
    color.r = Math.max(0, Math.min(1, color.r));
    color.g = Math.max(0, Math.min(1, color.g));
    color.b = Math.max(0, Math.min(1, color.b));
    
    return color;
  }

  /**
   * Get the appropriate LOD level for a chunk based on distance from player
   * @param {number} chunkCenterX - X coordinate of chunk center
   * @param {number} chunkCenterZ - Z coordinate of chunk center
   * @returns {Object} LOD configuration with resolution and material index
   */
  getChunkLOD(chunkCenterX, chunkCenterZ) {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) {
      // Default to highest detail if player not available
      return {
        resolution: this.terrainResolution,
        materialIndex: 0
      };
    }
    
    // Calculate distance from player to chunk center
    const dx = player.position.x - chunkCenterX;
    const dz = player.position.z - chunkCenterZ;
    const distanceToChunk = Math.sqrt(dx * dx + dz * dz);
    
    // Determine LOD level based on distance
    for (let i = 0; i < this.terrainLOD.distances.length; i++) {
      if (distanceToChunk < this.terrainLOD.distances[i].distance) {
        return {
          resolution: this.terrainLOD.distances[i].resolution,
          materialIndex: i
        };
      }
    }
    
    // Fallback to lowest detail for very far chunks
    const lastIndex = this.terrainLOD.distances.length - 1;
    return {
      resolution: this.terrainLOD.distances[lastIndex].resolution,
      materialIndex: lastIndex
    };
  }
  
  /**
   * Create geometry for a terrain chunk with appropriate level of detail
   * @param {number} startX - X coordinate of chunk start
   * @param {number} startZ - Z coordinate of chunk start
   * @returns {Object} Object containing geometry and material index
   */
  createChunkGeometry(startX, startZ) {
    // Measure chunk creation time for performance monitoring
    const startTime = performance.now();
    
    // Calculate chunk center for LOD determination
    const chunkCenterX = startX + this.chunkSize / 2;
    const chunkCenterZ = startZ + this.chunkSize / 2;
    
    // Get appropriate LOD for this chunk
    const lod = this.getChunkLOD(chunkCenterX, chunkCenterZ);
    
    // Get a pooled geometry if available or create a new one
    const geometry = this.getPooledGeometry(lod.resolution);

    // Rotate the plane to be horizontal (X-Z plane)
    geometry.rotateX(-Math.PI / 2);

    const vertices = geometry.attributes.position.array;
    const colors = [];

    // Modify vertices to create terrain shape
    for (let i = 0; i < vertices.length; i += 3) {
      // Get world coordinates
      const x = vertices[i] + startX;
      const z = vertices[i + 2] + startZ;
      
      // Calculate terrain height
      const height = this.getTerrainHeight(x, z);
      
      // Apply height to vertex Y coordinate
      vertices[i + 1] = height;
      
      // Assign color based on biome/height
      const color = this.getBiomeColor(height, x, z);
      colors.push(color.r, color.g, color.b);
    }

    // Add colors to geometry
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Update normals
    geometry.computeVertexNormals();
    
    // Update performance metrics
    const creationTime = performance.now() - startTime;
    this.perfStats.lastChunkCreationTime = creationTime;
    this.perfStats.avgChunkCreationTime = 
      (this.perfStats.avgChunkCreationTime * this.perfStats.chunkCreationSamples + creationTime) / 
      (this.perfStats.chunkCreationSamples + 1);
    this.perfStats.chunkCreationSamples++;
    
    return {
      geometry: geometry,
      materialIndex: lod.materialIndex
    };
  }

  createInitialTerrain() {
    console.log("Creating initial terrain...");
    
    // Create terrain chunks in a grid
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const startX = x * this.chunkSize;
        const startZ = z * this.chunkSize;
        const key = `${startX},${startZ}`;
        
        if (!this.currentChunks.has(key)) {
          try {
            const chunkData = this.createChunkGeometry(startX, startZ);
            
            // Get the appropriate material for this LOD level
            const material = this.terrainLOD.materials[chunkData.materialIndex];
            
            const mesh = new THREE.Mesh(chunkData.geometry, material);
            
            mesh.position.set(startX, 0, startZ);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Store LOD level with the mesh for later updates
            mesh.userData.lodLevel = chunkData.materialIndex;
            
            this.scene.add(mesh);
            this.currentChunks.set(key, mesh);
          } catch (error) {
            console.error("Error creating chunk:", error);
          }
        }
      }
    }
  }

  createWater() {
    // Create a large water plane
    const waterGeometry = new THREE.PlaneGeometry(
      this.chunkSize * 20,
      this.chunkSize * 20
    );
    waterGeometry.rotateX(-Math.PI / 2);

    // Create water mesh
    this.water = new THREE.Mesh(waterGeometry, this.materials.water);
    this.water.position.y = this.waterLevel;
    this.water.receiveShadow = true;
    this.scene.add(this.water);
  }
createManaNodes() {
    // Clear existing mana nodes
    this.manaNodes.forEach(node => {
      this.scene.remove(node);
    });
    this.manaNodes = [];
    
    // Create new mana nodes around the player
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    // Distribution parameters
    const nodeCount = 30;
    const spawnRadius = this.chunkSize * 5;
    
    for (let i = 0; i < nodeCount; i++) {
      // Calculate random position
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spawnRadius;
      
      const x = player.position.x + Math.cos(angle) * distance;
      const z = player.position.z + Math.sin(angle) * distance;
      
      // Get height at position
      const terrainHeight = this.getTerrainHeight(x, z);
      
      // Place node above terrain
      const y = Math.max(terrainHeight + 10, this.waterLevel + 10);
      
      // Create mana node
      const nodeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2, 12, 12),
        new THREE.MeshStandardMaterial({
        color: 0x00ffff,
          emissive: 0x00ffff,
          emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.8
        })
      );
      
      // Add glow effect
      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(3, 12, 12),
        new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.3,
          side: THREE.BackSide
        })
      );
      nodeMesh.add(glowMesh);
      
      // Position node
      nodeMesh.position.set(x, y, z);
      nodeMesh.userData = {
        type: 'mana',
        value: 10 + Math.floor(Math.random() * 20),
        collected: false
      };
      
      this.manaNodes.push(nodeMesh);
      this.scene.add(nodeMesh);
    }
  }

  updateChunks() {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    try {
      const updateStart = performance.now();
      
      // Calculate current chunk coordinates
      const chunkX = Math.floor(player.position.x / this.chunkSize);
      const chunkZ = Math.floor(player.position.z / this.chunkSize);

      // Keep track of chunks that should remain
      const chunksToKeep = new Set();
      // Track chunks that need LOD updates
      const chunksToUpdate = new Map();
      // Track chunks that need to be created
      const newChunksToAdd = [];

      // Update or create chunks in view distance
      for (let x = -this.viewDistance; x <= this.viewDistance; x++) {
        for (let z = -this.viewDistance; z <= this.viewDistance; z++) {
          // Check if within circular view distance
          const distance = Math.sqrt(x * x + z * z);
          if (distance <= this.viewDistance) {
            const worldX = (chunkX + x) * this.chunkSize;
            const worldZ = (chunkZ + z) * this.chunkSize;
            const key = `${worldX},${worldZ}`;

            chunksToKeep.add(key);

            // Check if chunk exists
            if (this.currentChunks.has(key)) {
              // Check if LOD needs updating
              const mesh = this.currentChunks.get(key);
              const chunkCenterX = worldX + this.chunkSize / 2;
              const chunkCenterZ = worldZ + this.chunkSize / 2;
              const lod = this.getChunkLOD(chunkCenterX, chunkCenterZ);
              
              // If LOD level has changed, add to update list
              if (mesh.userData.lodLevel !== lod.materialIndex) {
                chunksToUpdate.set(key, lod);
              }
            } else {
              // Add to creation list if we haven't hit the chunk limit
              if (this.currentChunks.size < this.memorySettings.maxActiveChunks) {
                newChunksToAdd.push([worldX, worldZ]);
              } else {
                // Skip chunk creation if we've hit the limit
                // Prioritize closer chunks
                const sortedChunks = Array.from(this.currentChunks.entries())
                  .map(([key, mesh]) => {
                    const [cx, cz] = key.split(',').map(Number);
                    const dx = cx - player.position.x;
                    const dz = cz - player.position.z;
                    const dist = Math.sqrt(dx*dx + dz*dz);
                    return { key, dist };
                  })
                  .sort((a, b) => b.dist - a.dist); // Sort by distance descending

                // Only create new chunk if it's closer than the furthest existing chunk
                const dx = worldX - player.position.x;
                const dz = worldZ - player.position.z;
                const newDist = Math.sqrt(dx*dx + dz*dz);
                
                if (newDist < sortedChunks[0].dist) {
                  // Remove furthest chunk
                  const keyToRemove = sortedChunks[0].key;
                  const meshToRemove = this.currentChunks.get(keyToRemove);
                  
                  this.scene.remove(meshToRemove);
                  // Return geometry to pool instead of disposing
                  this.returnGeometryToPool(meshToRemove.geometry);
                  this.currentChunks.delete(keyToRemove);
                  
                  // Add new closer chunk
                  newChunksToAdd.push([worldX, worldZ]);
                }
              }
            }
          }
        }
      }

      // Remove chunks that are too far away
      for (const [key, mesh] of this.currentChunks.entries()) {
        if (!chunksToKeep.has(key)) {
          this.scene.remove(mesh);
          // Return geometry to pool instead of disposing
          this.returnGeometryToPool(mesh.geometry);
          this.currentChunks.delete(key);
        }
      }

      // Update LOD for chunks that need it
      for (const [key, lod] of chunksToUpdate.entries()) {
        this.updateChunkLOD(key, lod.materialIndex);
      }

      // Create new chunks
      for (const [worldX, worldZ] of newChunksToAdd) {
        const key = `${worldX},${worldZ}`;
        const chunkData = this.createChunkGeometry(worldX, worldZ);
        const material = this.terrainLOD.materials[chunkData.materialIndex];
        
        const mesh = new THREE.Mesh(chunkData.geometry, material);
        mesh.position.set(worldX, 0, worldZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.lodLevel = chunkData.materialIndex;
        
        this.scene.add(mesh);
        this.currentChunks.set(key, mesh);
      }
      
      // Apply frustum culling to all visible chunks
      for (const [key, mesh] of this.currentChunks.entries()) {
        // Check if the chunk is in view and adjust visibility
        const inView = this.isInView(mesh);
        if (mesh.visible !== inView) {
          mesh.visible = inView;
          // Log only in development mode to avoid console spam
          if (import.meta.env.DEV && mesh.userData.visibilityChanged !== inView) {
            console.log(`Chunk ${key} visibility: ${inView ? 'visible' : 'culled'}`);
            mesh.userData.visibilityChanged = inView;
          }
        }
      }
      
      // Track performance
      const updateTime = performance.now() - updateStart;
      this.perfStats.lastUpdateTime = updateTime;
      
      // Store frame time for adaptive memory management
      if (this.perfStats.frameTimes.length > 20) {
        this.perfStats.frameTimes.shift();
      }
      this.perfStats.frameTimes.push(updateTime);
      
    } catch (error) {
      console.warn("Error in updateChunks:", error);
    }
  }

  /**
   * Update the LOD level of an existing chunk
   * @param {string} key - Chunk key
   * @param {number} newLodLevel - New LOD level index
   */
  updateChunkLOD(key, newLodLevel) {
    const mesh = this.currentChunks.get(key);
    if (!mesh) return;
    
    // Check if we actually need to change the LOD
    if (mesh.userData.lodLevel === newLodLevel) return;
    
    // Extract world coordinates from the key (format: "x,z")
    const [startX, startZ] = key.split(',').map(Number);
    
    // Create new geometry with new LOD level
    const chunkData = this.createChunkGeometry(startX, startZ);
    
    // Return old geometry to pool instead of disposing
    this.returnGeometryToPool(mesh.geometry);
    
    // Update mesh with new geometry and material
    mesh.geometry = chunkData.geometry;
    mesh.material = this.terrainLOD.materials[newLodLevel];
    mesh.userData.lodLevel = newLodLevel;
    
    // Clear cached bounding sphere since geometry changed
    this.boundingSpheres.delete(mesh.id);
  }
  
  /**
   * Update frustum for culling calculations
   */
  updateFrustum() {
    // Get the camera's projection matrix and view matrix
    if (!this.engine.camera) return;
    
    // Calculate the view-projection matrix
    this.cameraViewProjectionMatrix.multiplyMatrices(
      this.engine.camera.projectionMatrix,
      this.engine.camera.matrixWorldInverse
    );
    
    // Update the frustum from the view-projection matrix
    this.frustum.setFromProjectionMatrix(this.cameraViewProjectionMatrix);
    
    // Memory management for bounding spheres cache
    if (this.boundingSpheres.size > this.memorySettings.maxBoundingSpheres) {
      // Remove random entries when the cache gets too large
      const keysToDelete = Array.from(this.boundingSpheres.keys())
        .slice(0, this.boundingSpheres.size - this.memorySettings.maxBoundingSpheres);
        
      keysToDelete.forEach(key => this.boundingSpheres.delete(key));
    }
  }
  
  /**
   * Checks if an object is within the camera's view frustum
   * @param {THREE.Object3D} object - The object to check
   * @returns {boolean} True if the object is in view
   */
  isInView(object) {
    // If frustum culling is disabled or we're on mobile (where it can cause issues with popping),
    // always return true
    if (this.engine.isMobile) return true;
    
    // Get or create bounding sphere for this object
    if (!this.boundingSpheres.has(object.id)) {
      if (!object.geometry) {
        // Objects without geometry (like groups) are always visible
        return true;
      }
      
      // Create bounding sphere if needed
      if (!object.geometry.boundingSphere) {
        object.geometry.computeBoundingSphere();
      }
      
      // Clone the sphere to avoid modifying the original
      const sphere = object.geometry.boundingSphere.clone();
      
      // Scale the sphere radius based on object scale
      sphere.radius *= Math.max(
        object.scale.x, 
        object.scale.y, 
        object.scale.z
      );
      
      // Store the sphere for future checks
      this.boundingSpheres.set(object.id, sphere);
    }
    
    // Get the cached sphere
    const boundingSphere = this.boundingSpheres.get(object.id);
    
    // Transform sphere center to world space
    const center = boundingSphere.center.clone();
    center.applyMatrix4(object.matrixWorld);
    
    // Check if the sphere intersects with the frustum
    return this.frustum.intersectsSphere(
      new THREE.Sphere(center, boundingSphere.radius)
    );
  }
  
  update(delta, elapsed) {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    // Update frustum for culling
    this.updateFrustum();
    
    // Move water with player
    if (this.water) {
      this.water.position.x = player.position.x;
      this.water.position.z = player.position.z;
      // Gentle water animation
      this.water.position.y = this.waterLevel + Math.sin(elapsed * 0.5) * 0.05; // REDUCED water movement
    }
    
    // Check if we need more mana nodes
    if (this.manaNodes.filter(node => !node.userData.collected).length < 10) {
      this.createManaNodes();
    }

    // Update terrain chunks
    this.updateChunks();

    // Animate mana nodes
    this.manaNodes.forEach((node, index) => {
      if (!node.userData.collected) {
        // Apply frustum culling to mana nodes as well
        node.visible = this.isInView(node);
        
        // Only animate visible nodes to save performance
        if (node.visible) {
          // Bobbing motion - reduced movement
          node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.02;
          // Rotation
          node.rotation.y += delta * 0.5;
        }
      }
    });
  }

  checkManaCollection(position, radius) {
    const collectedNodes = [];
    
    this.manaNodes.forEach((node) => {
      if (!node.userData.collected) {
        const distance = position.distanceTo(node.position);
        if (distance < radius + 2) {
          node.userData.collected = true;
          node.visible = false;
          
          collectedNodes.push({
            position: node.position.clone(),
            value: node.userData.value || 10,
          });
        }
      }
    });
    
    return collectedNodes;
  }
}
