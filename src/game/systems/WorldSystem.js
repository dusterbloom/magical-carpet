import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

export class WorldSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    

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

    // World configuration
    this.chunkSize = 256;
    this.terrainResolution = 64;
    this.maxHeight = 400;  // Increased from 120
    this.minHeight = -40;  // Deeper valleys
    this.waterLevel = 0;
    this.viewDistance = 6;
    
    // Terrain parameters
    this.terrainParams = {
      baseScale: 0.0015,        // Reduced from 0.003 - larger features
      detailScale: 0.01,        // Reduced from 0.015 - smoother details
      mountainScale: 0.004,     // Reduced from 0.008 - larger mountains
      baseHeight: 80,          // Increased from 40
      mountainHeight: 240,      // Increased from 80 
      detailHeight: 40          // Increased from 20
    };

    // Initialize noise generator
    this.seed = Math.random() * 10000;
    this.noise = createNoise2D();
    
    // Define biomes
    this.biomes = {
      ocean: { threshold: -0.3, color: new THREE.Color(0x0066aa) },
      beach: { threshold: -0.2, color: new THREE.Color(0xdddd77) },
      plains: { threshold: 0.2, color: new THREE.Color(0x44aa44) },
      forest: { threshold: 0.4, color: new THREE.Color(0x227722) },
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
        minDistance: 1000,    // Minimum distance between same type
        maxSlope: 0.2,        // Must be on relatively flat ground
        frequency: 0.00001,   // Rarity factor
        size: { min: 20, max: 40 },
        requiresWater: false
      },
      {
        name: "magical_circle",
        minHeight: 5,
        maxHeight: 80,
        minDistance: 800,
        maxSlope: 0.3,
        frequency: 0.00002,
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
        minDistance: 1500,
        maxSlope: 0.4,
        frequency: 0.000008,
        size: { min: 25, max: 50 },
        requiresWater: false
      },
      {
        name: "ancient_temple",
        minHeight: 30,
        maxHeight: 70,
        minDistance: 2000,    // Very rare
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
        frequency: 0.00001,
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
    
    // Generate initial world
    this.createInitialTerrain();
    this.createWater();
    this.createManaNodes();

    if (this.engine.camera) {
      this.engine.camera.far = 25000; // Increased from 15000
      this.engine.camera.updateProjectionMatrix();
    }
    
    console.log("WorldSystem initialized");
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
    
    // Lower detail terrain material (for distant chunks)
    this.materials.terrainLOD = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0.01,
      envMapIntensity: 0.3,
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
      if (height > 200) {  // Increased from 80
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

  createChunkGeometry(startX, startZ) {
    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      this.terrainResolution,
      this.terrainResolution
    );

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
    
    return geometry;
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
            const geometry = this.createChunkGeometry(startX, startZ);
            const mesh = new THREE.Mesh(geometry, this.materials.terrain);
            
            mesh.position.set(startX, 0, startZ);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
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

  /**
   * Check if a position is suitable for a landmark
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {Object} landmarkType - Landmark type configuration
   * @returns {boolean} True if position is suitable
   */
  isPositionSuitableForLandmark(x, z, landmarkType) {
    // Check terrain height constraints
    const height = this.getTerrainHeight(x, z);
    if (height < landmarkType.minHeight || height > landmarkType.maxHeight) {
      return false;
    }
    
    // Check slope constraints
    const slope = this.calculateSlope(x, z);
    if (slope > landmarkType.maxSlope) {
      return false;
    }
    
    // Check distance from other landmarks of same type
    for (const [key, landmark] of this.landmarks.entries()) {
      if (landmark.type === landmarkType.name) {
        const dx = landmark.position.x - x;
        const dz = landmark.position.z - z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < landmarkType.minDistance) {
          return false;
        }
      }
    }
    
    // Check water requirement
    if (landmarkType.requiresWater) {
      let hasWaterNearby = false;
      
      // Sample several points around the position looking for water
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const checkDist = 50; // Check 50 units away
        const checkX = x + Math.cos(angle) * checkDist;
        const checkZ = z + Math.sin(angle) * checkDist;
        const checkHeight = this.getTerrainHeight(checkX, checkZ);
        
        if (checkHeight < this.waterLevel) {
          hasWaterNearby = true;
          break;
        }
      }
      
      if (!hasWaterNearby) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Creates a procedural landmark at a position
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {Object} landmarkType - Landmark type configuration
   * @returns {THREE.Group} The landmark mesh group
   */
  createLandmark(x, z, landmarkType) {
    const height = this.getTerrainHeight(x, z);
    const y = height;
    
    // Create landmark group
    const landmarkGroup = new THREE.Group();
    landmarkGroup.position.set(x, y, z);
    
    // Determine size (with some randomness)
    const sizeRange = landmarkType.size.max - landmarkType.size.min;
    const size = landmarkType.size.min + Math.random() * sizeRange;
    
    // Create different landmark types
    switch (landmarkType.name) {
      case "ancient_ruins":
        this.createAncientRuins(landmarkGroup, size);
        break;
      case "magical_circle":
        this.createMagicalCircle(landmarkGroup, size);
        break;
      case "crystal_formation":
        this.createCrystalFormation(landmarkGroup, size);
        break;
      case "stone_arch":
        this.createStoneArch(landmarkGroup, size);
        break;
      case "ancient_temple":
        this.createAncientTemple(landmarkGroup, size);
        break;
      case "oasis":
        this.createOasis(landmarkGroup, size);
        break;
    }
    
    // Save landmark with unique ID
    const landmarkId = `${landmarkType.name}_${this.landmarks.size}`;
    this.landmarks.set(landmarkId, {
      id: landmarkId,
      type: landmarkType.name,
      position: new THREE.Vector3(x, y, z),
      size: size,
      mesh: landmarkGroup
    });
    
    // Add to scene
    this.scene.add(landmarkGroup);
    
    return landmarkGroup;
  }

  /**
   * Creates ancient ruins landmark
   * @param {THREE.Group} group - Parent group
   * @param {number} size - Size of the landmark
   */
  createAncientRuins(group, size) {
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.8,
      metalness: 0.1
    });
    
    const ruinedStoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.9,
      metalness: 0.05
    });
    
    // Create circular arrangement of broken columns
    const columnCount = Math.floor(5 + size / 8);
    const radius = size * 0.5;
    
    for (let i = 0; i < columnCount; i++) {
      const angle = (i / columnCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      // Random column height (some broken)
      const height = size * 0.3 * (0.3 + Math.random() * 0.7);
      const isIntact = Math.random() > 0.6;
      
      // Create column
      const columnGeometry = new THREE.CylinderGeometry(
        size * 0.05, size * 0.06, height, 8
      );
      const column = new THREE.Mesh(
        columnGeometry,
        isIntact ? stoneMaterial : ruinedStoneMaterial
      );
      
      column.position.set(x, height * 0.5, z);
      column.castShadow = true;
      column.receiveShadow = true;
      
      // Add some randomness to rotation
      column.rotation.y = Math.random() * 0.2;
      
      // If broken, tilt the column
      if (!isIntact) {
        const tiltAmount = Math.random() * 0.3;
        const tiltDirection = Math.random() * Math.PI * 2;
        column.rotation.x = Math.cos(tiltDirection) * tiltAmount;
        column.rotation.z = Math.sin(tiltDirection) * tiltAmount;
      }
      
      group.add(column);
      
      // Add broken pieces around some columns
      if (Math.random() > 0.5) {
        const pieceCount = Math.floor(Math.random() * 3) + 1;
        
        for (let j = 0; j < pieceCount; j++) {
          const pieceSize = size * 0.03 + Math.random() * size * 0.03;
          const pieceGeometry = new THREE.BoxGeometry(
            pieceSize, pieceSize, pieceSize
          );
          const piece = new THREE.Mesh(pieceGeometry, ruinedStoneMaterial);
          
          // Position relative to column
          const distance = size * 0.1 * Math.random();
          const pieceAngle = Math.random() * Math.PI * 2;
          piece.position.set(
            x + Math.cos(pieceAngle) * distance,
            pieceSize * 0.5, // Half height
            z + Math.sin(pieceAngle) * distance
          );
          
          // Random rotation
          piece.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          );
          
          piece.castShadow = true;
          piece.receiveShadow = true;
          group.add(piece);
        }
      }
    }
    
    // Add central platform or altar
    const platformGeometry = new THREE.CylinderGeometry(
      size * 0.3,
      size * 0.35,
      size * 0.1,
      16
    );
    const platform = new THREE.Mesh(platformGeometry, stoneMaterial);
    platform.position.y = size * 0.05;
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);
    
    // Add decorative patterns to the platform
    const patternGeometry = new THREE.RingGeometry(
      size * 0.15,
      size * 0.25,
      16
    );
    patternGeometry.rotateX(-Math.PI / 2);
    const patternMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.7
    });
    const pattern = new THREE.Mesh(patternGeometry, patternMaterial);
    pattern.position.y = size * 0.1 + 0.01; // Slightly above platform
    group.add(pattern);
  }

  /**
   * Creates magical circle landmark
   * @param {THREE.Group} group - Parent group
   * @param {number} size - Size of the landmark
   */
  createMagicalCircle(group, size) {
    // Create circular platform
    const platformGeometry = new THREE.CylinderGeometry(
      size * 0.5,
      size * 0.5,
      size * 0.05,
      32
    );
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.3,
      metalness: 0.5
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = size * 0.025;
    platform.receiveShadow = true;
    group.add(platform);
    
    // Create magical runes and circles
    for (let i = 0; i < 3; i++) {
      const radius = size * 0.2 * (i + 1) / 3;
      
      const circleGeometry = new THREE.RingGeometry(
        radius - size * 0.01,
        radius,
        32
      );
      circleGeometry.rotateX(-Math.PI / 2);
      
      const circleMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7
      });
      
      const circle = new THREE.Mesh(circleGeometry, circleMaterial);
      circle.position.y = size * 0.051 + i * 0.002; // Slightly above platform
      circle.userData.isGlowing = true;
      group.add(circle);
    }
    
    // Add pillars around the circle
    const pillarCount = 5;
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const x = Math.cos(angle) * size * 0.4;
      const z = Math.sin(angle) * size * 0.4;
      
      const pillarGeometry = new THREE.CylinderGeometry(
        size * 0.03,
        size * 0.03,
        size * 0.4,
        8
      );
      const pillarMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 0.7
      });
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      
      pillar.position.set(x, size * 0.2, z);
      pillar.castShadow = true;
      group.add(pillar);
      
      // Add glowing crystal on top of each pillar
      const crystalGeometry = new THREE.OctahedronGeometry(size * 0.05);
      const crystalMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.8
      });
      const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
      
      crystal.position.set(x, size * 0.4 + size * 0.05, z);
      crystal.castShadow = true;
      crystal.userData.isGlowing = true;
      crystal.userData.originalIntensity = 0.7;
      group.add(crystal);
    }
  }

  /**
   * Creates crystal formation landmark
   * @param {THREE.Group} group - Parent group
   * @param {number} size - Size of the landmark
   */
  createCrystalFormation(group, size) {
    const baseColor = new THREE.Color(0x8866ff); // Purple base
    const colors = [
      new THREE.Color(0x8866ff), // Purple
      new THREE.Color(0x66aaff), // Blue
      new THREE.Color(0xff66aa), // Pink
      new THREE.Color(0x66ffaa)  // Green
    ];
    
    // Choose main color theme for this formation
    const mainColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Create base rock formation
    const baseGeometry = new THREE.DodecahedronGeometry(size * 0.3);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.9,
      metalness: 0.1
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    
    // Distort the base geometry for more natural look
    const basePositions = baseGeometry.attributes.position;
    for (let i = 0; i < basePositions.count; i++) {
      const x = basePositions.getX(i);
      const y = basePositions.getY(i);
      const z = basePositions.getZ(i);
      
      const distortAmount = size * 0.05;
      const noise = Math.random() * distortAmount;
      
      basePositions.setXYZ(
        i,
        x + (Math.random() - 0.5) * noise,
        y + (Math.random() - 0.5) * noise,
        z + (Math.random() - 0.5) * noise
      );
    }
    
    baseGeometry.computeVertexNormals();
    base.position.y = size * 0.2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    
    // Add crystal clusters
    const crystalCount = Math.floor(size / 4) + 5;
    for (let i = 0; i < crystalCount; i++) {
      // Vary crystal properties
      const crystalSize = size * (0.05 + Math.random() * 0.1);
      const crystalType = Math.floor(Math.random() * 3);
      
      // Choose geometry based on type
      let crystalGeometry;
      if (crystalType === 0) {
        crystalGeometry = new THREE.ConeGeometry(
          crystalSize * 0.4,
          crystalSize * 2,
          6
        );
      } else if (crystalType === 1) {
        crystalGeometry = new THREE.OctahedronGeometry(crystalSize);
      } else {
        crystalGeometry = new THREE.TetrahedronGeometry(crystalSize);
      }
      
      // Slightly vary crystal color from main theme
      const hue = Math.random() * 0.1 - 0.05;
      const saturation = Math.random() * 0.2 - 0.1;
      const lightness = Math.random() * 0.2 - 0.1;
      
      const crystalColor = mainColor.clone();
      const hsColor = {h: 0, s: 0, l: 0};
      crystalColor.getHSL(hsColor);
      crystalColor.setHSL(
        hsColor.h + hue,
        Math.min(1, Math.max(0, hsColor.s + saturation)),
        Math.min(1, Math.max(0, hsColor.l + lightness))
      );
      
      const crystalMaterial = new THREE.MeshStandardMaterial({
        color: crystalColor,
        emissive: crystalColor,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.9,
        roughness: 0.2,
        metalness: 0.8
      });
      
      const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
      
      // Position crystal on base rock
      const angle = Math.random() * Math.PI * 2;
      const distance = size * 0.3 * Math.random();
      const height = size * 0.2 + size * 0.1 * Math.random();
      
      crystal.position.set(
        Math.cos(angle) * distance,
        height,
        Math.sin(angle) * distance
      );
      
      // Random rotation
      crystal.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      crystal.castShadow = true;
      crystal.userData.isGlowing = true;
      crystal.userData.originalIntensity = 0.4;
      crystal.userData.pulseRate = 0.5 + Math.random();
      group.add(crystal);
    }
    
    // Add glowing particles
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const particleGeometry = new THREE.SphereGeometry(size * 0.01);
      const particleColor = mainColor.clone();
      
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: 0.7
      });
      
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      
      // Random position around the formation
      const angle = Math.random() * Math.PI * 2;
      const height = size * 0.3 + size * 0.3 * Math.random();
      const distance = size * 0.4 * Math.random();
      
      particle.position.set(
        Math.cos(angle) * distance,
        height,
        Math.sin(angle) * distance
      );
      
      particle.userData.originalY = particle.position.y;
      particle.userData.floatSpeed = 0.2 + Math.random() * 0.5;
      particle.userData.floatHeight = size * 0.05 * Math.random();
      particle.userData.isFloating = true;
      
      group.add(particle);
    }
  }

  /**
   * Creates stone arch landmark
   * @param {THREE.Group} group - Parent group
   * @param {number} size - Size of the landmark
   */
  createStoneArch(group, size) {
    // Create arch base material
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x776655,
      roughness: 0.9,
      metalness: 0.1
    });
    
    // Create arch supports (pillars)
    const pillarHeight = size * 0.7;
    const pillarRadius = size * 0.1;
    const pillarGeometry = new THREE.CylinderGeometry(
      pillarRadius,
      pillarRadius * 1.2,
      pillarHeight,
      8
    );
    
    const leftPillar = new THREE.Mesh(pillarGeometry, stoneMaterial);
    leftPillar.position.set(-size * 0.3, pillarHeight * 0.5, 0);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    group.add(leftPillar);
    
    const rightPillar = new THREE.Mesh(pillarGeometry, stoneMaterial);
    rightPillar.position.set(size * 0.3, pillarHeight * 0.5, 0);
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    group.add(rightPillar);
    
    // Create arch top (curved)
    const archCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-size * 0.3, pillarHeight, 0),
      new THREE.Vector3(0, pillarHeight + size * 0.3, 0),
      new THREE.Vector3(size * 0.3, pillarHeight, 0)
    );
    
    const points = archCurve.getPoints(20);
    const archGeometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      20,
      pillarRadius,
      8,
      false
    );
    
    const arch = new THREE.Mesh(archGeometry, stoneMaterial);
    arch.castShadow = true;
    arch.receiveShadow = true;
    group.add(arch);
    
    // Add decorative elements
    const decorRadius = pillarRadius * 0.7;
    
    // Add base decorations to pillars
    for (const pillar of [leftPillar, rightPillar]) {
      const baseDecorGeometry = new THREE.BoxGeometry(
        pillarRadius * 3,
        pillarRadius * 0.5,
        pillarRadius * 3
      );
      const baseDecor = new THREE.Mesh(baseDecorGeometry, stoneMaterial);
      baseDecor.position.copy(pillar.position);
      baseDecor.position.y = 0;
      group.add(baseDecor);
      
      // Add top decorations
      const topDecorGeometry = new THREE.BoxGeometry(
        pillarRadius * 2.5,
        pillarRadius * 0.5,
        pillarRadius * 2.5
      );
      const topDecor = new THREE.Mesh(topDecorGeometry, stoneMaterial);
      topDecor.position.copy(pillar.position);
      topDecor.position.y = pillarHeight;
      group.add(topDecor);
    }
    
    // Add keystone at top of arch
    const keystoneGeometry = new THREE.BoxGeometry(
      pillarRadius * 2,
      pillarRadius * 1.5,
      pillarRadius * 1.5
    );
    const keystone = new THREE.Mesh(keystoneGeometry, stoneMaterial);
    keystone.position.set(0, pillarHeight + size * 0.3, 0);
    keystone.castShadow = true;
    group.add(keystone);
    
    // Add some fallen rubble around base
    const rubbleCount = Math.floor(Math.random() * 6) + 3;
    
    for (let i = 0; i < rubbleCount; i++) {
      const rubbleSize = pillarRadius * (0.3 + Math.random() * 0.5);
      let rubbleGeometry;
      
      // Different shapes for variety
      const shapeType = Math.floor(Math.random() * 3);
      if (shapeType === 0) {
        rubbleGeometry = new THREE.BoxGeometry(
          rubbleSize, rubbleSize, rubbleSize
        );
      } else if (shapeType === 1) {
        rubbleGeometry = new THREE.DodecahedronGeometry(rubbleSize, 0);
      } else {
        rubbleGeometry = new THREE.TetrahedronGeometry(rubbleSize);
      }
      
      const rubbleMaterial = new THREE.MeshStandardMaterial({
        color: 0x776655,
        roughness: 1.0,
        metalness: 0.05
      });
      
      const rubble = new THREE.Mesh(rubbleGeometry, rubbleMaterial);
      
      // Position randomly around the base
      const angle = Math.random() * Math.PI * 2;
      const distance = size * (0.2 + Math.random() * 0.3);
      
      rubble.position.set(
        Math.cos(angle) * distance,
        rubbleSize * 0.5,
        Math.sin(angle) * distance
      );
      
      // Random rotation
      rubble.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      rubble.castShadow = true;
      rubble.receiveShadow = true;
      
      group.add(rubble);
    }
  }

  /**
   * Creates ancient temple landmark
   * @param {THREE.Group} group - Parent group
   * @param {number} size - Size of the landmark
   */
  createAncientTemple(group, size) {
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xDDDDCC,
      roughness: 0.9,
      metalness: 0.1
    });
    
    const decorMaterial = new THREE.MeshStandardMaterial({
      color: 0xCCAA88,
      roughness: 0.7,
      metalness: 0.2
    });
    
    // Create base platform
    const baseHeight = size * 0.1;
    const baseSize = size * 0.9;
    const baseGeometry = new THREE.BoxGeometry(baseSize, baseHeight, baseSize);
    const base = new THREE.Mesh(baseGeometry, stoneMaterial);
    base.position.y = baseHeight * 0.5;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    
    // Add steps to the platform
    const stepCount = 3;
    const stepHeight = baseHeight * 0.3;
    const stepDepth = size * 0.1;
    
    for (let i = 0; i < stepCount; i++) {
      const stepWidth = size * 0.5;
      const stepGeometry = new THREE.BoxGeometry(
        stepWidth,
        stepHeight,
        stepDepth
      );
      const step = new THREE.Mesh(stepGeometry, stoneMaterial);
      step.position.set(
        0,
        stepHeight * 0.5,
        baseSize * 0.5 - stepDepth * (i + 0.5)
      );
      step.castShadow = true;
      step.receiveShadow = true;
      group.add(step);
    }
    
    // Add columns
    const columnHeight = size * 0.5;
    const columnRadius = size * 0.04;
    const columnGeometry = new THREE.CylinderGeometry(
      columnRadius,
      columnRadius * 1.2,
      columnHeight,
      8
    );
    
    const columnPositions = [
      [-baseSize * 0.4, 0, -baseSize * 0.4],
      [baseSize * 0.4, 0, -baseSize * 0.4],
      [-baseSize * 0.4, 0, baseSize * 0.4],
      [baseSize * 0.4, 0, baseSize * 0.4],
      
      [-baseSize * 0.2, 0, -baseSize * 0.4],
      [baseSize * 0.2, 0, -baseSize * 0.4],
      [-baseSize * 0.2, 0, baseSize * 0.4],
      [baseSize * 0.2, 0, baseSize * 0.4]
    ];
    
    for (const pos of columnPositions) {
      const column = new THREE.Mesh(columnGeometry, stoneMaterial);
      column.position.set(
        pos[0],
        baseHeight + columnHeight * 0.5,
        pos[2]
      );
      column.castShadow = true;
      column.receiveShadow = true;
      group.add(column);
      
      // Add column capital
      const capitalGeometry = new THREE.BoxGeometry(
        columnRadius * 3,
        columnRadius * 2,
        columnRadius * 3
      );
      const capital = new THREE.Mesh(capitalGeometry, decorMaterial);
      capital.position.set(
        pos[0],
        baseHeight + columnHeight,
        pos[2]
      );
      capital.castShadow = true;
      group.add(capital);
    }
    
    // Add architrave
    const architraveHeight = size * 0.06;
    const architraveWidth = baseSize * 0.95;
    const frontArchitrave = new THREE.Mesh(
      new THREE.BoxGeometry(architraveWidth, architraveHeight, columnRadius * 2),
      stoneMaterial
    );
    frontArchitrave.position.set(
      0,
      baseHeight + columnHeight + architraveHeight * 0.5,
      -baseSize * 0.4
    );
    frontArchitrave.castShadow = true;
    group.add(frontArchitrave);
    
    const backArchitrave = new THREE.Mesh(
      new THREE.BoxGeometry(architraveWidth, architraveHeight, columnRadius * 2),
      stoneMaterial
    );
    backArchitrave.position.set(
      0,
      baseHeight + columnHeight + architraveHeight * 0.5,
      baseSize * 0.4
    );
    backArchitrave.castShadow = true;
    group.add(backArchitrave);
    
    const leftArchitrave = new THREE.Mesh(
      new THREE.BoxGeometry(columnRadius * 2, architraveHeight, baseSize * 0.8),
      stoneMaterial
    );
    leftArchitrave.position.set(
      -baseSize * 0.4,
      baseHeight + columnHeight + architraveHeight * 0.5,
      0
    );
    leftArchitrave.castShadow = true;
    group.add(leftArchitrave);
    
    const rightArchitrave = new THREE.Mesh(
      new THREE.BoxGeometry(columnRadius * 2, architraveHeight, baseSize * 0.8),
      stoneMaterial
    );
    rightArchitrave.position.set(
      baseSize * 0.4,
      baseHeight + columnHeight + architraveHeight * 0.5,
      0
    );
    rightArchitrave.castShadow = true;
    group.add(rightArchitrave);
    
    // Add temple roof
    const roofGeometry = new THREE.BoxGeometry(
      baseSize * 0.8,
      size * 0.05,
      baseSize * 0.8
    );
    const roof = new THREE.Mesh(roofGeometry, stoneMaterial);
    roof.position.y = baseHeight + columnHeight + architraveHeight + size * 0.025;
    roof.castShadow = true;
    group.add(roof);
    
    // Add central altar
    const altarGeometry = new THREE.BoxGeometry(
      size * 0.2,
      size * 0.15,
      size * 0.2
    );
    const altar = new THREE.Mesh(altarGeometry, decorMaterial);
    altar.position.y = baseHeight + size * 0.075;
    altar.castShadow = true;
    group.add(altar);
    
    // Add decorative objects on the altar
    const altarObjectSize = size * 0.05;
    const altarObject = new THREE.Mesh(
      new THREE.TetrahedronGeometry(altarObjectSize),
      new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        metalness: 0.8,
        roughness: 0.2
      })
    );
    altarObject.position.y = baseHeight + size * 0.15 + altarObjectSize * 0.5;
    altarObject.userData.isGlowing = true;
    altarObject.userData.originalIntensity = 0.3;
    group.add(altarObject);
  }

  /**
   * Creates an oasis landmark with palm trees
   * @param {THREE.Group} group - Parent group
   * @param {number} size - Size of the landmark
   */
  createOasis(group, size) {
    // Create water pool
    const waterRadius = size * 0.4;
    const waterDepth = size * 0.1;
    const waterGeometry = new THREE.CylinderGeometry(
      waterRadius,
      waterRadius * 0.8,
      waterDepth,
      24
    );
    const waterMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0077ff,
      transparent: true,
      opacity: 0.8,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.5,
      ior: 1.4
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.y = -waterDepth * 0.5;
    group.add(water);
    
    // Create shoreline
    const shoreRadius = waterRadius * 1.2;
    const shoreGeometry = new THREE.RingGeometry(
      waterRadius,
      shoreRadius,
      24,
      1
    );
    shoreGeometry.rotateX(-Math.PI / 2);
    const shoreMaterial = new THREE.MeshStandardMaterial({
      color: 0xddcc99,
      roughness: 1.0
    });
    const shore = new THREE.Mesh(shoreGeometry, shoreMaterial);
    shore.position.y = 0.01; // Slightly above ground
    shore.receiveShadow = true;
    group.add(shore);
    
    // Create palm trees
    const palmCount = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < palmCount; i++) {
      this.createPalmTree(
        group,
        size * 0.15,
        Math.random() * Math.PI * 2,
        waterRadius * (0.9 + Math.random() * 0.3)
      );
    }
    
    // Add rocks around the oasis
    const rockCount = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < rockCount; i++) {
      const rockSize = size * (0.03 + Math.random() * 0.05);
      const rockGeometry = new THREE.DodecahedronGeometry(rockSize, 0);
      const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.9
      });
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      
      // Position around the oasis
      const angle = Math.random() * Math.PI * 2;
      const distance = shoreRadius * (1 + Math.random() * 0.2);
      rock.position.set(
        Math.cos(angle) * distance,
        rockSize * 0.3,
        Math.sin(angle) * distance
      );
      
      // Random rotation
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
    }
    
    // Add some vegetation
    const grassCount = 20;
    for (let i = 0; i < grassCount; i++) {
      const grassSize = size * 0.02;
      const grassGeometry = new THREE.PlaneGeometry(grassSize, grassSize * 3);
      const grassMaterial = new THREE.MeshBasicMaterial({
        color: 0x55aa44,
        side: THREE.DoubleSide,
        transparent: true
      });
      const grass = new THREE.Mesh(grassGeometry, grassMaterial);
      
      // Position around the oasis
      const angle = Math.random() * Math.PI * 2;
      const distance = waterRadius * (0.8 + Math.random() * 0.5);
      grass.position.set(
        Math.cos(angle) * distance,
        grassSize * 1.5,
        Math.sin(angle) * distance
      );
      
      // Random rotation around Y-axis
      grass.rotation.y = Math.random() * Math.PI;
      
      group.add(grass);
    }
  }

  /**
   * Creates a palm tree
   * @param {THREE.Group} parentGroup - Parent group
   * @param {number} height - Height of the tree
   * @param {number} angle - Angle around center
   * @param {number} distance - Distance from center
   */
  createPalmTree(parentGroup, height, angle, distance) {
    const group = new THREE.Group();
    
    // Position the tree
    group.position.set(
      Math.cos(angle) * distance,
      0,
      Math.sin(angle) * distance
    );
    
    // Add some randomness to the tree angle
    group.rotation.y = Math.random() * Math.PI * 2;
    
    // Create trunk
    const trunkHeight = height * 0.8;
    const trunkRadius = height * 0.05;
    const trunkGeometry = new THREE.CylinderGeometry(
      trunkRadius * 0.7,
      trunkRadius,
      trunkHeight,
      8
    );
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B5A2B,
      roughness: 0.9,
      metalness: 0.1
    });
    
    // Bend the trunk slightly for a more natural look
    const bendAngle = (Math.random() - 0.5) * 0.2;
    const bendDirection = Math.random() * Math.PI * 2;
    
    // Apply bend by moving vertices
    const positions = trunkGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      // Only bend upper portion
      if (y > 0) {
        const bendFactor = (y / trunkHeight) * bendAngle;
        positions.setX(
          i,
          positions.getX(i) + Math.cos(bendDirection) * bendFactor * trunkHeight
        );
        positions.setZ(
          i,
          positions.getZ(i) + Math.sin(bendDirection) * bendFactor * trunkHeight
        );
      }
    }
    
    trunkGeometry.computeVertexNormals();
    
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = trunkHeight * 0.5;
    trunk.castShadow = true;
    group.add(trunk);
    
    // Create palm fronds
    const frondCount = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < frondCount; i++) {
      const frondAngle = (i / frondCount) * Math.PI * 2;
      const frondLength = height * 0.4;
      const frondWidth = height * 0.08;
      
      const frondGeometry = new THREE.PlaneGeometry(frondWidth, frondLength, 1, 4);
      const frondMaterial = new THREE.MeshStandardMaterial({
        color: 0x44aa44,
        side: THREE.DoubleSide,
        roughness: 0.8
      });
      
      // Curve the frond by adjusting vertices
      const positions = frondGeometry.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const y = positions.getY(j);
        if (y !== 0) {
          // Apply curve - higher points bend more
          const normalizedY = y / (frondLength * 0.5);
          const curveFactor = Math.pow(Math.abs(normalizedY), 2) * Math.sign(normalizedY);
          positions.setX(j, positions.getX(j) + curveFactor * frondWidth * 0.2);
        }
      }
      
      frondGeometry.computeVertexNormals();
      
      const frond = new THREE.Mesh(frondGeometry, frondMaterial);
      
      // Position and rotate frond
      frond.position.y = trunkHeight;
      frond.rotation.y = frondAngle;
      
      // Tilt frond upward
      frond.rotation.x = -Math.PI / 4;
      
      frond.castShadow = true;
      group.add(frond);
    }
    
    // Add coconuts
    if (Math.random() > 0.5) {
      const coconutCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < coconutCount; i++) {
        const coconutSize = height * 0.05;
        const coconutGeometry = new THREE.SphereGeometry(coconutSize, 8, 8);
        const coconutMaterial = new THREE.MeshStandardMaterial({
          color: 0x5B3C11,
          roughness: 0.8
        });
        const coconut = new THREE.Mesh(coconutGeometry, coconutMaterial);
        
        // Position coconut near top of trunk
        const coconutAngle = Math.random() * Math.PI * 2;
        coconut.position.set(
          Math.cos(coconutAngle) * trunkRadius * 1.5,
          trunkHeight - coconutSize,
          Math.sin(coconutAngle) * trunkRadius * 1.5
        );
        
        coconut.castShadow = true;
        group.add(coconut);
      }
    }
    
    parentGroup.add(group);
    return group;
  }

  /**
   * Check for potential landmark locations in loaded chunks
   * Should be called periodically during gameplay
   */
  checkForLandmarkLocations() {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    // Only check occasionally
    if (Math.random() > 0.01) return; // 1% chance per call
    
    // Get player chunk
    const playerChunkX = Math.floor(player.position.x / this.chunkSize);
    const playerChunkZ = Math.floor(player.position.z / this.chunkSize);
    
    // Check a larger area around player
    const checkDistance = this.viewDistance + 2;
    
    // Try several random locations
    const attemptCount = 5;
    
    for (let i = 0; i < attemptCount; i++) {
      // Pick random chunk in range
      const dx = Math.floor(Math.random() * checkDistance * 2) - checkDistance;
      const dz = Math.floor(Math.random() * checkDistance * 2) - checkDistance;
      
      const chunkX = playerChunkX + dx;
      const chunkZ = playerChunkZ + dz;
      
      // Convert to world coordinates
      const worldX = chunkX * this.chunkSize + Math.random() * this.chunkSize;
      const worldZ = chunkZ * this.chunkSize + Math.random() * this.chunkSize;
      
      // Use global frequency check
      if (Math.random() > 0.2) continue; // Only consider 20% of attempts
      
      // Try each landmark type
      for (const landmarkType of this.landmarkTypes) {
        // Check if this type should spawn based on frequency
        if (Math.random() > landmarkType.frequency * 1000) continue;
        
        // Check if location is suitable
        if (this.isPositionSuitableForLandmark(worldX, worldZ, landmarkType)) {
          console.log(`Creating ${landmarkType.name} landmark at ${worldX}, ${worldZ}`);
          this.createLandmark(worldX, worldZ, landmarkType);
          return; // Only create one landmark at a time
        }
      }
    }
  }

  /**
   * Update landmarks
   * @param {number} delta - Time since last frame in seconds
   * @param {number} elapsed - Total elapsed time
   */
  updateLandmarks(delta, elapsed) {
    // Check for new landmark locations
    this.checkForLandmarkLocations();
    
    // Apply animations to landmark elements
    for (const [id, landmark] of this.landmarks.entries()) {
      const landmarkMesh = landmark.mesh;
      
      // Skip if not in scene
      if (!landmarkMesh.parent) continue;
      
      // Animate any glowing objects
      landmarkMesh.traverse(object => {
        if (object.userData.isGlowing) {
          // Pulsing glow effect
          const pulseRate = object.userData.pulseRate || 1.0;
          const intensity = object.userData.originalIntensity || 0.5;
          
          const newIntensity = intensity * (0.7 + Math.sin(elapsed * pulseRate) * 0.3);
          if (object.material && object.material.emissiveIntensity !== undefined) {
            object.material.emissiveIntensity = newIntensity;
          }
        }
        
        // Animate floating particles
        if (object.userData.isFloating) {
          const floatHeight = object.userData.floatHeight || 1.0;
          const floatSpeed = object.userData.floatSpeed || 1.0;
          const originalY = object.userData.originalY || object.position.y;
          
          object.position.y = originalY + Math.sin(elapsed * floatSpeed) * floatHeight;
        }
      });
    }
    
    // Remove landmarks that are too far from player
    const player = this.engine.systems.player?.localPlayer;
    if (player) {
      const maxDistance = this.chunkSize * (this.viewDistance + 4);
      
      for (const [id, landmark] of this.landmarks.entries()) {
        const dx = landmark.position.x - player.position.x;
        const dz = landmark.position.z - player.position.z;
        const distanceSquared = dx * dx + dz * dz;
        
        if (distanceSquared > maxDistance * maxDistance) {
          // Remove landmark from scene
          this.scene.remove(landmark.mesh);
          this.landmarks.delete(id);
        }
      }
    }
  }

  updateChunks() {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    try {
      // Calculate current chunk coordinates
      const chunkX = Math.floor(player.position.x / this.chunkSize);
      const chunkZ = Math.floor(player.position.z / this.chunkSize);

      // Keep track of chunks that should remain
      const chunksToKeep = new Set();

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

            // Create new chunk if it doesn't exist
            if (!this.currentChunks.has(key)) {
              const geometry = this.createChunkGeometry(worldX, worldZ);
              const mesh = new THREE.Mesh(geometry, this.materials.terrain);
              mesh.position.set(worldX, 0, worldZ);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              this.scene.add(mesh);
              this.currentChunks.set(key, mesh);
            }
          }
        }
      }

      // Remove chunks that are too far away
      for (const [key, mesh] of this.currentChunks.entries()) {
        if (!chunksToKeep.has(key)) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.currentChunks.delete(key);
        }
      }
    } catch (error) {
      console.warn("Error in updateChunks:", error);
    }
  }

  update(delta, elapsed) {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    // Move water with player
    if (this.water) {
      this.water.position.x = player.position.x;
      this.water.position.z = player.position.z;
      // Gentle water animation
      this.water.position.y = this.waterLevel + Math.sin(elapsed * 0.5) * 0.1;
    }

    // Check if we need more mana nodes
    if (this.manaNodes.filter(node => !node.userData.collected).length < 10) {
      this.createManaNodes();
    }

    // Update terrain chunks
    this.updateChunks();
    
    // Update landmarks
    this.updateLandmarks(delta, elapsed);

    // Animate mana nodes
    this.manaNodes.forEach((node, index) => {
      if (!node.userData.collected) {
        // Bobbing motion
        node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.03;
        // Rotation
        node.rotation.y += delta * 0.5;
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
// import * as THREE from "three";
// import { createNoise2D } from "simplex-noise"; // Updated import

// export class WorldSystem {
//   constructor(engine) {
//     this.engine = engine;
//     this.scene = engine.scene;
//     // Initialize maps and collections first
//     this.currentChunks = new Map();
//     this.manaNodes = [];

//     // // Core world properties
//     // this.worldSize = 2000;
//     // this.worldBounds = 10000;
//     this.water = null;
//     this.manaNodes = [];
//     // Adjusted terrain generation settings for better gameplay
//     this.terrainResolution = 64; // Higher detail
//     this.chunkSize = 256; // Larger chunks
//     this.maxHeight = 100; // Much higher mountains
//     this.minHeight = -20; // Allow valleys below sea level
//     this.waterLevel = 0; // Sea level
//     // Adjusted terrain parameters for more visible features
//     this.terrainParams = {
//       baseScale: 0.005,      // Increased for more visible variation
//       detailScale: 0.02,     // Surface detail
//       mountainScale: 0.008,  // More frequent mountains
//       baseHeight: 40,        // Higher base terrain
//       mountainHeight: 60,    // Taller mountains
//       detailHeight: 15       // More pronounced detail
//   };

//   // Set a proper view distance
//   this.viewDistance = 6;
//     // Initialize noise with random seed
//     this.seed = Math.random() * 10000;
//     this.noise = createNoise2D();

//     this.biomes = {
//       safeZone: { scale: 0.0005, height: 0.2 }, // Gentler safe zone
//       mountains: { scale: 0.001, height: 0.8 }, // Less extreme mountains
//       valleys: { scale: 0.001, height: 0.4 },
//       plains: { scale: 0.002, height: 0.3 },
//     };

//     // Reduced feature intensity
//     this.features = {
//       ridges: { scale: 0.005, strength: 0.3 },
//       detail: { scale: 0.02, strength: 0.1 },
//     };

//     // Terrain materials
//     this.materials = {};
//   }

//   // async initialize() {
//   //   await this.createMaterials();
//   //   this.createLights();
//   //   this.createSky();
//   //   this.createInitialTerrain();
//   //   this.createWater();
//   //   this.createManaNodes();

//   //   // Set initial camera position
//   //   this.engine.camera.position.set(0, 50, 0);
//   //   this.engine.camera.lookAt(50, 0, 50);

//   //   console.log("World system initialized");
//   // }


//   createInitialTerrain() {
//     console.log("Creating initial terrain..."); // Debug log

//     // Create larger initial area
//     for (let x = -3; x <= 3; x++) {
//         for (let z = -3; z <= 3; z++) {
//             const startX = x * this.chunkSize;
//             const startZ = z * this.chunkSize;
//             const key = `${startX},${startZ}`;
            
//             if (!this.currentChunks.has(key)) {
//                 try {
//                     const geometry = this.createChunkGeometry(startX, startZ);
//                     const mesh = new THREE.Mesh(
//                         geometry, 
//                         new THREE.MeshStandardMaterial({
//                             vertexColors: true,
//                             wireframe: true // Temporary for debugging
//                         })
//                     );
                    
//                     mesh.position.set(startX, 0, startZ);
//                     mesh.castShadow = true;
//                     mesh.receiveShadow = true;
                    
//                     console.log(`Creating chunk at ${startX}, ${startZ}`); // Debug log
//                     this.scene.add(mesh);
//                     this.currentChunks.set(key, mesh);
//                 } catch (error) {
//                     console.error("Error creating chunk:", error);
//                 }
//             }
//         }
//     }
// }

// getTerrainHeight(x, z) {
//     // Make sure we're getting real values
//     console.log(`Getting height for ${x}, ${z}`); // Debug log
    
//     try {
//         // Base terrain (gentle rolling hills)
//         const baseNoise = this.noise(
//             x * this.terrainParams.baseScale, 
//             z * this.terrainParams.baseScale
//         );
//         let height = (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;

//         // Log the height value
//         console.log(`Calculated height: ${height}`); // Debug log
        
//         return height;
//     } catch (error) {
//         console.warn('Error in getTerrainHeight:', error);
//         return 0;
//     }
// }

// createChunkGeometry(startX, startZ) {
//     console.log(`Creating chunk geometry at ${startX}, ${startZ}`); // Debug log

//     const geometry = new THREE.PlaneGeometry(
//         this.chunkSize,
//         this.chunkSize,
//         this.terrainResolution,
//         this.terrainResolution
//     );

//     // IMPORTANT: Rotate the plane to be horizontal
//     geometry.rotateX(-Math.PI / 2);

//     const vertices = geometry.attributes.position.array;
//     const colors = [];

//     // Debug first few vertices
//     console.log("First few vertices before modification:", 
//         vertices.slice(0, 9)); // Debug log

//     for (let i = 0; i < vertices.length; i += 3) {
//         const x = vertices[i] + startX;
//         const z = vertices[i + 1] + startZ;
        
//         const height = this.getTerrainHeight(x, z);
//         vertices[i + 2] = height; // Y is up after rotation

//         // Simple color based on height for debugging
//         const color = new THREE.Color();
//         color.setHSL(height / 100, 0.7, 0.5);
//         colors.push(color.r, color.g, color.b);
//     }

//     // Debug first few vertices after modification
//     console.log("First few vertices after modification:", 
//         vertices.slice(0, 9)); // Debug log

//     geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
//     geometry.computeVertexNormals();
    
//     return geometry;
// }

// async initialize() {
//     console.log("Initializing WorldSystem..."); // Debug log
    
//     await this.createMaterials();
//     this.createLights();
//     this.createSky();
    
//     // Set initial camera position for better debugging view
//     this.engine.camera.position.set(0, 200, 200);
//     this.engine.camera.lookAt(0, 0, 0);
    
//     // Create terrain after camera is positioned
//     this.createInitialTerrain();
//     this.createWater();
//     this.createManaNodes();

//     console.log("WorldSystem initialized"); // Debug log
// }

// createMaterials() {
//     this.materials.terrain = new THREE.MeshStandardMaterial({
//         vertexColors: true,
//         wireframe: true, // Temporary for debugging
//         side: THREE.DoubleSide, // Make sure both sides are visible
//         roughness: 0.8,
//         metalness: 0.1
//     });
// }

// async initialize() {
//   console.log("Initializing WorldSystem..."); // Debug log
  
//   await this.createMaterials();
//   this.createLights();
//   this.createSky();
  
//   // Set initial camera position for better debugging view
//   this.engine.camera.position.set(0, 200, 200);
//   this.engine.camera.lookAt(0, 0, 0);
  
//   // Create terrain after camera is positioned
//   this.createInitialTerrain();
//   this.createWater();
//   this.createManaNodes();

//   console.log("WorldSystem initialized"); // Debug log
// }

// createMaterials() {
//   this.materials.terrain = new THREE.MeshStandardMaterial({
//       vertexColors: true,
//       wireframe: true, // Temporary for debugging
//       side: THREE.DoubleSide, // Make sure both sides are visible
//       roughness: 0.8,
//       metalness: 0.1
//   });
// }


//   createLights() {
//     // Main directional light (sun)
//     const sunLight = new THREE.DirectionalLight(0xffffcc, 1);
//     sunLight.position.set(100, 100, 0);
//     this.scene.add(sunLight);

//     // Ambient light for general illumination
//     const ambientLight = new THREE.AmbientLight(0x334455, 0.5);
//     this.scene.add(ambientLight);
//   }

//   createSky() {
//     // Simple sky color
//     this.scene.background = new THREE.Color(0x88ccff);
//     this.scene.fog = new THREE.Fog(0x88ccff, 500, 1500);
//   }
//   getTerrainHeight(x, z) {
//     try {
//       // Base terrain with more dramatic hills
//       const baseNoise = this.noise(
//         x * this.terrainParams.baseScale,
//         z * this.terrainParams.baseScale
//       );
//       let height = (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;

//       // More dramatic mountains using ridged multifractal approach
//       const mountainNoise = Math.abs(
//         this.noise(
//           x * this.terrainParams.mountainScale,
//           z * this.terrainParams.mountainScale
//         )
//       );
//       height +=
//         Math.pow(mountainNoise, 1.2) * this.terrainParams.mountainHeight;

//       // Add sharp ridges and valleys
//       const ridgeNoise = Math.abs(
//         this.noise(
//           x * this.terrainParams.detailScale,
//           z * this.terrainParams.detailScale
//         )
//       );
//       height += ridgeNoise * ridgeNoise * this.terrainParams.detailHeight;

//       return height;
//     } catch (error) {
//       console.warn("Error in getTerrainHeight:", error);
//       return 0;
//     }
//   }

//   createChunkGeometry(startX, startZ) {
//     const geometry = new THREE.PlaneGeometry(
//         this.chunkSize,
//         this.chunkSize,
//         this.terrainResolution,
//         this.terrainResolution
//     );

//     // CRITICAL FIX: Rotate the plane to be horizontal
//     geometry.rotateX(-Math.PI / 2);

//     const vertices = geometry.attributes.position.array;
//     const colors = [];

//     for (let i = 0; i < vertices.length; i += 3) {
//         // FIXED: After rotation, y and z are swapped
//         const x = vertices[i] + startX;
//         const y = vertices[i + 2];  // This is now height
//         const z = vertices[i + 1] + startZ;
        
//         const height = this.getTerrainHeight(x, z);
//         vertices[i + 2] = height;  // Apply height to Y after rotation

//         // More vibrant colors for better visibility
//         let color = new THREE.Color();
//         if (height < this.waterLevel) {
//             color.setRGB(0.1, 0.2, 0.5); // Deep water areas
//         } else if (height < this.waterLevel + 5) {
//             color.setRGB(0.8, 0.7, 0.3); // Beaches
//         } else if (height < 30) {
//             color.setRGB(0.2, 0.5, 0.1); // Lowlands
//         } else if (height < 60) {
//             color.setRGB(0.4, 0.3, 0.2); // Hills
//         } else {
//             // Gradient for high mountains
//             const t = (height - 60) / 40;
//             color.setRGB(
//                 0.4 + t * 0.4, // More red in higher areas
//                 0.3 + t * 0.3,
//                 0.2 + t * 0.4
//             );
//         }

//         colors.push(color.r, color.g, color.b);
//     }

//     geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
//     geometry.computeVertexNormals();
//     return geometry;
// }

//   createInitialTerrain() {
//     // Create larger initial area
//     for (let x = -3; x <= 3; x++) {
//       for (let z = -3; z <= 3; z++) {
//         const startX = x * this.chunkSize;
//         const startZ = z * this.chunkSize;
//         const key = `${startX},${startZ}`;

//         if (!this.currentChunks.has(key)) {
//           const geometry = this.createChunkGeometry(startX, startZ);
//           const mesh = new THREE.Mesh(geometry, this.materials.terrain);
//           mesh.position.set(startX, 0, startZ);
//           mesh.castShadow = true;
//           mesh.receiveShadow = true;
//           this.scene.add(mesh);
//           this.currentChunks.set(key, mesh);
//         }
//       }
//     }
//   }

//   createWater() {
//     // Create larger water plane that follows the player
//     const waterGeometry = new THREE.PlaneGeometry(
//       this.chunkSize * 12, // Much larger water plane
//       this.chunkSize * 12
//     );
//     waterGeometry.rotateX(-Math.PI / 2);

//     // More dramatic water material
//     this.materials.water = new THREE.MeshStandardMaterial({
//       color: 0x0066cc,
//       transparent: true,
//       opacity: 0.6,
//       metalness: 0.9,
//       roughness: 0.1,
//     });

//     this.water = new THREE.Mesh(waterGeometry, this.materials.water);
//     this.water.position.y = this.waterLevel;
//     this.scene.add(this.water);
//   }
//   createManaNodes() {
//     // Keep your existing mana nodes creation logic
//     // This is just a placeholder implementation
//     for (let i = 0; i < 20; i++) {
//       const x = (Math.random() - 0.5) * this.worldSize;
//       const z = (Math.random() - 0.5) * this.worldSize;
//       const y = this.getTerrainHeight(x, z) + 10;

//       const nodeMesh = new THREE.Mesh(
//         new THREE.SphereGeometry(2, 8, 8),
//         new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff })
//       );

//       nodeMesh.position.set(x, y, z);
//       nodeMesh.userData.collected = false;

//       this.manaNodes.push(nodeMesh);
//       this.scene.add(nodeMesh);
//     }
//   }

//   calculateSlope(x, z) {
//     const sampleDistance = 2;
//     const heightDiffX = Math.abs(
//       this.getTerrainHeight(x + sampleDistance, z) -
//         this.getTerrainHeight(x - sampleDistance, z)
//     );
//     const heightDiffZ = Math.abs(
//       this.getTerrainHeight(x, z + sampleDistance) -
//         this.getTerrainHeight(x, z - sampleDistance)
//     );
//     return (
//       Math.sqrt(heightDiffX * heightDiffX + heightDiffZ * heightDiffZ) /
//       (sampleDistance * 2)
//     );
//   }

//   updateChunks() {
//     const player = this.engine.systems.player?.localPlayer;
//     if (!player) return;

//     try {
//       // Get current chunk coordinates from player position
//       const chunkX = Math.floor(player.position.x / this.chunkSize);
//       const chunkZ = Math.floor(player.position.z / this.chunkSize);

//       const chunksToKeep = new Set();

//       // Generate chunks in a circular pattern around player
//       for (let x = -this.viewDistance; x <= this.viewDistance; x++) {
//         for (let z = -this.viewDistance; z <= this.viewDistance; z++) {
//           const distance = Math.sqrt(x * x + z * z);
//           if (distance <= this.viewDistance) {
//             const worldX = (chunkX + x) * this.chunkSize;
//             const worldZ = (chunkZ + z) * this.chunkSize;
//             const key = `${worldX},${worldZ}`;

//             chunksToKeep.add(key);

//             if (!this.currentChunks.has(key)) {
//               const geometry = this.createChunkGeometry(worldX, worldZ);
//               const mesh = new THREE.Mesh(geometry, this.materials.terrain);
//               mesh.position.set(worldX, 0, worldZ);
//               mesh.castShadow = true;
//               mesh.receiveShadow = true;
//               this.scene.add(mesh);
//               this.currentChunks.set(key, mesh);
//             }
//           }
//         }
//       }

//       // Remove chunks that are too far from player
//       for (const [key, mesh] of this.currentChunks.entries()) {
//         if (!chunksToKeep.has(key)) {
//           this.scene.remove(mesh);
//           mesh.geometry.dispose();
//           this.currentChunks.delete(key);
//         }
//       }
//     } catch (error) {
//       console.warn("Error in updateChunks:", error);
//     }
//   }

//   createManaNodes() {
//     // Dynamically create mana nodes around the player
//     const player = this.engine.systems.player?.localPlayer;
//     if (!player) return;

//     // Create nodes within visible chunks
//     const spawnRadius = this.chunkSize * (this.viewDistance - 1);
//     const nodeCount = 20;

//     for (let i = 0; i < nodeCount; i++) {
//       const angle = Math.random() * Math.PI * 2;
//       const distance = Math.random() * spawnRadius;

//       const x = player.position.x + Math.cos(angle) * distance;
//       const z = player.position.z + Math.sin(angle) * distance;
//       const y = this.getTerrainHeight(x, z) + 10;

//       const nodeMesh = new THREE.Mesh(
//         new THREE.SphereGeometry(2, 8, 8),
//         new THREE.MeshStandardMaterial({
//           color: 0x00ffff,
//           emissive: 0x00ffff,
//           emissiveIntensity: 0.5,
//         })
//       );

//       nodeMesh.position.set(x, y, z);
//       nodeMesh.userData.collected = false;
//       this.manaNodes.push(nodeMesh);
//       this.scene.add(nodeMesh);
//     }
//   }

//   update(delta, elapsed) {
//     const player = this.engine.systems.player?.localPlayer;
//     if (!player) return;

//     // Update water to follow player
//     if (this.water) {
//       this.water.position.x = player.position.x;
//       this.water.position.z = player.position.z;
//       this.water.position.y = this.waterLevel + Math.sin(elapsed * 0.5) * 0.1;
//     }

//     // Dynamically manage mana nodes
//     if (this.manaNodes.length < 20) {
//       this.createManaNodes();
//     }

//     // Update chunks more frequently for smoother generation
//     this.updateChunks();

//     // Update existing mana nodes
//     this.manaNodes.forEach((node, index) => {
//       if (!node.userData.collected) {
//         node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.03;
//         node.rotation.y += delta * 0.5;
//       }
//     });
//   }
//   checkManaCollection(position, radius) {
//     const collectedNodes = [];

//     this.manaNodes.forEach((node) => {
//       if (!node.userData.collected) {
//         const distance = position.distanceTo(node.position);
//         if (distance < radius + 2) {
//           node.userData.collected = true;
//           node.visible = false;

//           collectedNodes.push({
//             position: node.position.clone(),
//             value: node.userData.value || 10,
//           });
//         }
//       }
//     });

//     return collectedNodes;
//   }
// }


// // V1
// // import * as THREE from 'three';
// // import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
// // import { Water } from 'three/examples/jsm/objects/Water.js';
// // import { Sky } from 'three/examples/jsm/objects/Sky.js';

// // export class WorldSystem {
// //   constructor(engine) {
// //     this.engine = engine;
// //     this.scene = engine.scene;
// //     this.terrain = null;
// //     this.water = null;
// //     this.sky = null;
// //     this.manaNodes = [];
// //     this.noise = new SimplexNoise();
// //     this.worldSize = 1000;
// //     this.heightScale = 60;
// //     this.seed = Math.random() * 1000;
// //   }

// //   async initialize() {
// //     this.createLights();
// //     this.createSky();
// //     this.createTerrain();
// //     this.createWater();
// //     this.createManaNodes();

// //     // Set camera position
// //     this.engine.camera.position.set(0, 50, 0);
// //     this.engine.camera.lookAt(50, 0, 50);

// //     console.log("World system initialized");
// //   }

// //   createLights() {
// //     // Ambient light
// //     const ambientLight = new THREE.AmbientLight(0x404040, 1);
// //     this.scene.add(ambientLight);

// //     // Directional light (sun)
// //     const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
// //     directionalLight.position.set(100, 100, 100);
// //     directionalLight.castShadow = true;

// //     // Set up shadow properties
// //     directionalLight.shadow.mapSize.width = 2048;
// //     directionalLight.shadow.mapSize.height = 2048;
// //     directionalLight.shadow.camera.near = 0.5;
// //     directionalLight.shadow.camera.far = 500;
// //     directionalLight.shadow.camera.left = -100;
// //     directionalLight.shadow.camera.right = 100;
// //     directionalLight.shadow.camera.top = 100;
// //     directionalLight.shadow.camera.bottom = -100;
// //     directionalLight.shadow.bias = -0.0005;

// //     this.scene.add(directionalLight);
// //     this.sunLight = directionalLight;
// //   }

// //   createSky() {
// //     // Create sky
// //     this.sky = new Sky();
// //     this.sky.scale.setScalar(10000);
// //     this.scene.add(this.sky);

// //     // Set up sun parameters
// //     const skyUniforms = this.sky.material.uniforms;
// //     skyUniforms['turbidity'].value = 10;
// //     skyUniforms['rayleigh'].value = 2;
// //     skyUniforms['mieCoefficient'].value = 0.005;
// //     skyUniforms['mieDirectionalG'].value = 0.8;

// //     const sunPosition = new THREE.Vector3();
// //     const phi = THREE.MathUtils.degToRad(90 - 10); // Sun elevation
// //     const theta = THREE.MathUtils.degToRad(180); // Sun azimuth

// //     sunPosition.setFromSphericalCoords(1, phi, theta);
// //     skyUniforms['sunPosition'].value.copy(sunPosition);

// //     // Update sun light direction to match sky
// //     this.sunLight.position.copy(sunPosition.multiplyScalar(100));
// //     this.sunLight.updateMatrixWorld();
// //   }

// //   createTerrain() {
// //     // Create terrain geometry
// //     const geometry = new THREE.PlaneGeometry(
// //       this.worldSize,
// //       this.worldSize,
// //       128,
// //       128
// //     );
// //     geometry.rotateX(-Math.PI / 2);

// //     // Create terrain material
// //     const terrainTexture = this.engine.assets.getTexture('terrain');
// //     if (terrainTexture) {
// //       terrainTexture.wrapS = THREE.RepeatWrapping;
// //       terrainTexture.wrapT = THREE.RepeatWrapping;
// //       terrainTexture.repeat.set(16, 16);
// //     }

// //     const material = new THREE.MeshStandardMaterial({
// //       map: terrainTexture,
// //       roughness: 0.8,
// //       metalness: 0.2,
// //       vertexColors: true
// //     });

// //     // Apply height map using simplex noise
// //     const vertices = geometry.attributes.position;
// //     const colors = new Float32Array(vertices.count * 3);
// //     const color = new THREE.Color();

// //     for (let i = 0; i < vertices.count; i++) {
// //       const x = vertices.getX(i);
// //       const z = vertices.getZ(i);

// //       // Get noise value for current position
// //       const nx = x / this.worldSize;
// //       const nz = z / this.worldSize;

// //       // Combine multiple noise scales for more detailed terrain
// //       const noise1 = this.noise.noise(nx * 1.5 + this.seed, nz * 1.5 + this.seed) * 0.5;
// //       const noise2 = this.noise.noise(nx * 3 + this.seed * 2, nz * 3 + this.seed * 2) * 0.25;
// //       const noise3 = this.noise.noise(nx * 6 + this.seed * 3, nz * 6 + this.seed * 3) * 0.125;

// //       // Combine different noise scales
// //       const combinedNoise = noise1 + noise2 + noise3;

// //       // Calculate height and apply to vertex
// //       const height = combinedNoise * this.heightScale;
// //       vertices.setY(i, height);

// //       // Color based on height
// //       if (height < 2) {
// //         color.setRGB(0.8, 0.7, 0.5); // Sand
// //       } else if (height < 10) {
// //         color.setRGB(0.1, 0.8, 0.1); // Grass
// //       } else if (height < 20) {
// //         color.setRGB(0.5, 0.5, 0.1); // Forest
// //       } else {
// //         color.setRGB(0.5, 0.5, 0.5); // Mountain
// //       }

// //       colors[i * 3] = color.r;
// //       colors[i * 3 + 1] = color.g;
// //       colors[i * 3 + 2] = color.b;
// //     }

// //     geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
// //     geometry.computeVertexNormals();

// //     // Create terrain mesh
// //     this.terrain = new THREE.Mesh(geometry, material);
// //     this.terrain.receiveShadow = true;
// //     this.terrain.castShadow = true;
// //     this.scene.add(this.terrain);

// //     // Create collision data for terrain
// //     this.createTerrainCollision();
// //   }

// //   createTerrainCollision() {
// //     // Simple heightmap lookup for collision detection
// //     // In a full implementation, you might use a more sophisticated approach
// //     this.heightMap = [];
// //     const resolution = 100;
// //     const step = this.worldSize / resolution;

// //     for (let i = 0; i <= resolution; i++) {
// //       this.heightMap[i] = [];
// //       for (let j = 0; j <= resolution; j++) {
// //         const x = (i / resolution) * this.worldSize - this.worldSize / 2;
// //         const z = (j / resolution) * this.worldSize - this.worldSize / 2;

// //         const nx = x / this.worldSize;
// //         const nz = z / this.worldSize;

// //         // Same noise function as in createTerrain
// //         const noise1 = this.noise.noise(nx * 1.5 + this.seed, nz * 1.5 + this.seed) * 0.5;
// //         const noise2 = this.noise.noise(nx * 3 + this.seed * 2, nz * 3 + this.seed * 2) * 0.25;
// //         const noise3 = this.noise.noise(nx * 6 + this.seed * 3, nz * 6 + this.seed * 3) * 0.125;

// //         this.heightMap[i][j] = (noise1 + noise2 + noise3) * this.heightScale;
// //       }
// //     }
// //   }

// //   getTerrainHeight(x, z) {
// //     // Convert world coordinates to heightmap coordinates
// //     const halfSize = this.worldSize / 2;
// //     const nx = ((x + halfSize) / this.worldSize) * (this.heightMap.length - 1);
// //     const nz = ((z + halfSize) / this.worldSize) * (this.heightMap[0].length - 1);

// //     // Get the four surrounding height values
// //     const x1 = Math.floor(nx);
// //     const x2 = Math.min(Math.ceil(nx), this.heightMap.length - 1);
// //     const z1 = Math.floor(nz);
// //     const z2 = Math.min(Math.ceil(nz), this.heightMap[0].length - 1);

// //     const h11 = this.heightMap[x1][z1];
// //     const h21 = this.heightMap[x2][z1];
// //     const h12 = this.heightMap[x1][z2];
// //     const h22 = this.heightMap[x2][z2];

// //     // Bilinear interpolation
// //     const fx = nx - x1;
// //     const fz = nz - z1;

// //     const h1 = h11 * (1 - fx) + h21 * fx;
// //     const h2 = h12 * (1 - fx) + h22 * fx;

// //     return h1 * (1 - fz) + h2 * fz;
// //   }

// //   createWater() {
// //     const waterGeometry = new THREE.PlaneGeometry(this.worldSize * 2, this.worldSize * 2);

// //     // Create water with reflections
// //     this.water = new Water(waterGeometry, {
// //       textureWidth: 512,
// //       textureHeight: 512,
// //       waterNormals: new THREE.TextureLoader().load('assets/textures/waternormals.jpg', function (texture) {
// //         texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
// //       }),
// //       sunDirection: new THREE.Vector3(0, 1, 0),
// //       sunColor: 0xffffff,
// //       waterColor: 0x001e0f,
// //       distortionScale: 3.7,
// //       fog: this.scene.fog !== undefined
// //     });

// //     this.water.rotation.x = -Math.PI / 2;
// //     this.water.position.y = 0; // Water level
// //     this.scene.add(this.water);
// //   }

// //   createManaNodes() {
// //     // Create mana collection points throughout the world
// //     const nodeCount = 20;
// //     this.manaNodes = [];

// //     for (let i = 0; i < nodeCount; i++) {
// //       // Random position within the world bounds
// //       const x = (Math.random() - 0.5) * this.worldSize * 0.8;
// //       const z = (Math.random() - 0.5) * this.worldSize * 0.8;
// //       const y = this.getTerrainHeight(x, z) + 10; // Floating above terrain

// //       // Create mana node visual
// //       const geometry = new THREE.SphereGeometry(2, 16, 16);
// //       const material = new THREE.MeshStandardMaterial({
// //         color: 0x00ffff,
// //         emissive: 0x00aaff,
// //         emissiveIntensity: 0.5,
// //         transparent: true,
// //         opacity: 0.8
// //       });

// //       const node = new THREE.Mesh(geometry, material);
// //       node.position.set(x, y, z);
// //       node.castShadow = true;
// //       node.userData = {
// //         type: 'mana',
// //         value: 10 + Math.floor(Math.random() * 20), // Random value
// //         collected: false
// //       };

// //       // Add glow effect
// //       const glowGeometry = new THREE.SphereGeometry(3, 16, 16);
// //       const glowMaterial = new THREE.MeshBasicMaterial({
// //         color: 0x00ffff,
// //         transparent: true,
// //         opacity: 0.3,
// //         side: THREE.BackSide
// //       });

// //       const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
// //       node.add(glowMesh);

// //       this.scene.add(node);
// //       this.manaNodes.push(node);
// //     }
// //   }

// //   update(delta, elapsed) {
// //     // Animate water
// //     if (this.water) {
// //       this.water.material.uniforms['time'].value += delta;
// //     }

// //     // Animate mana nodes (bobbing and rotating)
// //     this.manaNodes.forEach((node, index) => {
// //       if (!node.userData.collected) {
// //         node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.03;
// //         node.rotation.y += delta * 0.5;
// //       }
// //     });
// //   }

// //   // Check if a mana node is collected
// //   checkManaCollection(position, radius) {
// //     const collectedNodes = [];

// //     this.manaNodes.forEach((node) => {
// //       if (!node.userData.collected) {
// //         const distance = position.distanceTo(node.position);
// //         if (distance < radius + 2) { // 2 is the node radius
// //           node.userData.collected = true;

// //           // Make the node disappear
// //           node.visible = false;

// //           collectedNodes.push({
// //             position: node.position.clone(),
// //             value: node.userData.value
// //           });
// //         }
// //       }
// //     });

// //     return collectedNodes;
// //   }
// // }
