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
    this.chunkSize = 1024;
    this.terrainResolution = 64;  // Increased from 32 for smoother terrain
    this.maxHeight = 400;  // Increased significantly for dramatic mountains
    this.minHeight = -50;  // Much deeper valleys for contrast
    // Water level removed
    this.viewDistance = 6;
    
    // Terrain parameters
    this.terrainParams = {
      baseScale: 0.0015,       // Reduced for larger, smoother terrain features
      detailScale: 0.01,        // Adjusted for better detail balance
      mountainScale: 0.002,     // Reduced for larger, more sweeping mountains
      baseHeight: 60,          // Increased for higher base terrain
      mountainHeight: 180,     // Significantly increased for dramatic mountains
      detailHeight: 15         // Moderate terrain details for natural appearance
    };

    // Initialize noise generator
    this.seed = Math.random() * 1000;
    this.noise = createNoise2D();
    
    // Define biomes
    this.biomes = {
      ocean: { threshold: 0.02, color: new THREE.Color(0x0066aa) },
      beach: { threshold: 0.02, color: new THREE.Color(0xdddd77) },
      plains: { threshold: 0.03, color: new THREE.Color(0x44aa44) },
      forest: { threshold: 0.04, color: new THREE.Color(0x227722) },
      mountains: { threshold: 0.02, color: new THREE.Color(0x888888) },
      snow: { threshold: 0.008, color: new THREE.Color(0xffffff) }
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
        requiresWater: false  // Water requirement removed (was true)
      }
    ];
  }

  /**
   * Creates multi-octave noise for more natural terrain with improved coherence
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {number} baseFrequency - Base frequency of the noise
   * @param {number} octaves - Number of noise layers to combine
   * @param {number} persistence - How much each octave contributes
   * @param {number} lacunarity - How frequency increases with each octave
   * @returns {number} Combined noise value in range [-1, 1]
   */
  fractalNoise(x, z, baseFrequency, octaves, persistence, lacunarity) {
    // Ensure chunk-coherent noise by using whole numbers for chunk boundaries
    // Remove small floating point errors by rounding to a reasonable precision
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    
    // Calculate position within chunk for smooth interpolation
    const fracX = x - chunkX * this.chunkSize;
    const fracZ = z - chunkZ * this.chunkSize;
    
    // Calculate noise at four corners of nearby chunks for proper blending
    const blendDistance = 10; // Distance to blend between chunks
    const blendFactor = Math.min(fracX, this.chunkSize - fracX, fracZ, this.chunkSize - fracZ) / blendDistance;
    const edgeWeight = Math.min(1.0, blendFactor);
    
    let frequency = baseFrequency;
    let amplitude = 2.0;
    let total = 0;
    let maxValue = 0;
    
    // Sum multiple layers of noise with improved weighting
    for (let i = 0; i < octaves; i++) {
      // Sample noise at current frequency with consistent seed values
      // Using smooth domain modification to avoid chunk boundaries
      const noiseValue = this.noise(
        x * frequency + this.seed * (i * 3 + 1),
        z * frequency + this.seed * (i * 3 + 2)
      );
      
      // Add weighted noise to total with enhanced amplitude modulation
      const weightedNoise = noiseValue * amplitude;
      total += weightedNoise;
      maxValue += amplitude;
      
      // Each octave has higher frequency but lower amplitude
      // Slightly decreased persistence for more natural terrain
      amplitude *= persistence * (1.0 - 0.01 * i);  // Gradual reduction in influence
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
  ridgedNoise(x, z, frequency, octaves = 5) {  // Increased octaves for more detail
    let result = 0;
    let amplitude = 1.0;
    let freq = frequency;
    let weight = 1.0;
    
    for (let i = 0; i < octaves; i++) {
      // Get absolute noise value and invert it with improved seed variation
      let noiseValue = Math.abs(this.noise(
        x * freq + this.seed * (i * 3.7 + 1),  // More varied seed offsets
        z * freq + this.seed * (i * 3.7 + 2)
      ));
      noiseValue = 1.0 - noiseValue;
      
      // Variable power adjustment for different mountain types
      // Lower passes (i=0,1) use higher power for sharper main ridges
      // Higher passes use lower power for smoother details
      const powerValue = i < 2 ? 1.5 : 1.1;  // Creates sharper main ridges but smoother details
      noiseValue = Math.pow(noiseValue, powerValue);
      
      // Apply weighting to successive octaves with enhanced variation
      noiseValue *= weight;
      
      // Weight successive octaves by previous noise value with varying scale
      // This creates more natural ridge patterns with secondary features
      const weightScale = 0.7 + 0.2 * Math.sin(i * 1.5);
      weight = Math.min(1.0, noiseValue * weightScale);
      
      // Add to result with slight variation per octave
      result += noiseValue * amplitude * (1.0 + 0.1 * Math.sin(i * 2.7));
      
      // Next octave with variable frequency multiplier for more natural results
      freq *= 2.0 + 0.1 * Math.sin(i);
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
    // Water creation removed
    this.createManaNodes();

    if (this.engine.camera) {
      this.engine.camera.far = 22000; // Increased from 15000
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
    
    // Water material removed
  }

  createLights() {
    // Clear any existing lights first
    this.scene.traverse((object) => {
      if (object.isDirectionalLight || object.isAmbientLight) {
        this.scene.remove(object);
      }
    });

    // Main directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffeb, 1.5);
    sunLight.position.set(300, 400, 200);
    
    // Improved shadow settings
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 1000;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    
    // Softer shadows
    sunLight.shadow.radius = 2;
    
    this.scene.add(sunLight);
    
    // Secondary directional light for softer shadows on other side
    const secondaryLight = new THREE.DirectionalLight(0xffffcc, 0.7);
    secondaryLight.position.set(-200, 300, -100);
    this.scene.add(secondaryLight);

    // Stronger ambient light to fill shadows
    const ambientLight = new THREE.AmbientLight(0x445566, 1.2);
    this.scene.add(ambientLight);
    
    // Add a subtle hemispheric light
    const hemisphereLight = new THREE.HemisphereLight(0x88aaff, 0x665544, 0.5);
    this.scene.add(hemisphereLight);
    
    // Expose the primary sun light for time-of-day updates
    this.sunLight = sunLight;
  }

  createSky() {
    // Existing day sky setup
    const skyGeometry = new THREE.SphereGeometry(8000, 32, 15);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x3388ff) },
        bottomColor: { value: new THREE.Color(0xaaddff) },
        offset: { value: 400 },
        exponent: { value: 0.7 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      fog: false
    });
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.onBeforeRender = () => {
      if (this.engine.camera) {
        this.sky.position.copy(this.engine.camera.position);
      }
    };
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(0x88ccff, 0.0003);
  }

  getTerrainHeight(x, z) {
    try {
      // Generate continent shape using large-scale noise
      const continentShape = this.fractalNoise(
        x, z,
        0.00007, // Even lower frequency for much larger landmasses
        5,       // Increased octaves for more varied continent shape
        0.45,    // Slightly reduced persistence for smoother large features
        1.7      // Increased lacunarity for more varied scales
      );
      
      // Apply continent mask to create valleys and landmasses
      const continentMask = Math.max(0, (continentShape + 0.25) * 1.3);  // Adjusted for better distribution
      
      // Deep valleys
      if (continentMask <= 0.12) {  // Slightly increased threshold for wider valleys
        // Deep valley depth with enhanced natural falloff and smoother transitions
        // Multi-scale sine variation creates more organic valley floors
        const valleyProgress = Math.max(0, (0.12 - continentMask) / 0.12); // 0 to 1 scale
        const smoothValleyFactor = valleyProgress * valleyProgress * (3 - 2 * valleyProgress); // Smoothstep
      
      // Add multi-scale variation for more natural valley shapes
      const valleyVariation = 
          0.2 * Math.sin(x * 0.005 + this.seed * 0.3) * Math.sin(z * 0.005 + this.seed * 0.7) +
          0.1 * Math.sin(x * 0.015 + this.seed * 1.1) * Math.sin(z * 0.015 + this.seed * 1.3) +
          0.05 * Math.sin(x * 0.03 + this.seed * 2.1) * Math.sin(z * 0.03 + this.seed * 2.3);
      
      // Apply smoothly varying depth with improved curve
      const valleyDepth = this.minHeight - 15 - 100 * smoothValleyFactor * (1.0 + valleyVariation);
        return valleyDepth;
      }
      
      // Transition zone converted to much gentler slopes (Tuscan-like)
      if (continentMask > 0.10 && continentMask < 0.48) {  // Much wider transition zone
        // Calculate how far into the transition zone we are (0.0 to 1.0)
        const slopeProgress = (continentMask - 0.10) / 0.38;
        
        // Multi-stage blending for ultra-smooth transitions
        // Use double-sigmoid for even smoother S-curve with extended middle section
        const sigmoidBase = 1 / (1 + Math.exp(-(slopeProgress * 8 - 4)));
        const secondSigmoid = 1 / (1 + Math.exp(-((slopeProgress - 0.5) * 6)));
        const blendedSigmoid = sigmoidBase * (1 - slopeProgress * 0.4) + secondSigmoid * (slopeProgress * 0.4);
        
        // Apply polynomial smoothing for extra gradual transition
        const asymmetricCurve = blendedSigmoid * (1.15 - 0.3 * blendedSigmoid);  // More asymmetric
        
        // Calculate base height with much more gradual curve
        const baseHeight = this.minHeight + (asymmetricCurve * 65);  // Significantly increased height range
        
        // Modified noise system with more complex gradient-dependent intensity
        const largeScale = 0.004;  // Even larger undulations
        const mediumScale = 0.02;  // Medium details
        const smallScale = 0.09;   // Small details
        const microScale = 0.3;    // Micro details specifically for transition points
        
        // Create multi-peak intensity curve for transition-focused noise
        // This creates stronger noise at both transition edges and in the middle
        const edgeFactor1 = Math.pow(1 - Math.min(1, slopeProgress / 0.2), 2); // Strong at start (0-20%)
        const edgeFactor2 = Math.pow(Math.max(0, Math.min(1, (slopeProgress - 0.8) / 0.2)), 2); // Strong at end (80-100%)
        const midFactor = 4 * Math.pow(slopeProgress * (1 - slopeProgress), 1.5); // Strong in middle, cubic shape
        
        // Create specialized noise for transition boundaries
        const boundaryScale = 0.015;
        const boundaryNoise = this.fractalNoise(
          x * boundaryScale + this.seed * 53, 
          z * boundaryScale + this.seed * 59, 
          4, 0.6, 2.0
        ) * 12.0 * (edgeFactor1 * 0.8 + edgeFactor2 * 0.8);
        
        // Combine different noise scales with enhanced position-adaptive influence
        const largeNoise = this.fractalNoise(x, z, largeScale, 4, 0.5, 2.0) * 
                         (4 + edgeFactor1 * 3.5 + edgeFactor2 * 3.0);  // Much stronger terrain variation
        
        const mediumNoise = this.fractalNoise(x, z, mediumScale, 3, 0.5, 2.0) * 
                          (2.5 + midFactor * 2.8);  // Enhanced mid-scale detail
        
        const smallNoise = this.fractalNoise(x, z, smallScale, 2, 0.5, 2.0) * 
                         (1.2 + edgeFactor1 * 1.0 + midFactor * 1.5);  // Stronger small detail
                         
        const microNoise = this.fractalNoise(x, z, microScale, 2, 0.5, 2.0) * 
                         (0.8 + edgeFactor1 * 1.2 + edgeFactor2 * 1.2);  // Micro-detail for transition boundaries
        
        // Directional warping to create more organic transitions
        // Creates subtle noise-based directionality paralleling the beach
        const beachDirection = Math.sin(x * 0.001 + z * 0.002 + this.seed * 0.3) * 0.5 + 0.5;
        const directionalFactor = Math.pow(beachDirection, 1.5) * 3.0 * Math.max(edgeFactor1, edgeFactor2);
        
        // Apply directional warping to all noise types
        // This creates uneven transition boundaries that break up any straight lines
        const warpedLargeNoise = largeNoise * (1.0 + directionalFactor * 0.3);
        const warpedMediumNoise = mediumNoise * (1.0 + directionalFactor * 0.2);
        
        // Noise intensity increases gradually and smoothly across transition
        // Enhanced blending with specialized weighting for transition points
        const combinedNoise = 
            warpedLargeNoise * (0.4 + 0.6 * asymmetricCurve) + 
            warpedMediumNoise * (0.3 + 0.7 * midFactor) + 
            smallNoise * (0.2 + 0.8 * Math.min(edgeFactor1, midFactor, edgeFactor2)) +
            microNoise * (0.1 + 0.9 * Math.max(edgeFactor1, edgeFactor2)) +
            boundaryNoise; // Additional focused noise just for transition boundaries
        
        return baseHeight + combinedNoise;
      }
      
      // Generate base terrain with multiple noise octaves
      const baseNoise = this.fractalNoise(
        x, z,
        this.terrainParams.baseScale,
        8, // More octaves for varied terrain
        0.5,
        2.0
      );
      
      // Start with base terrain height
      let height = (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;
      
      // Add coastal cliffs in some areas but not others
      if (continentMask > 0.15 && continentMask < 0.2) {
        // Calculate coastal influence (0.0 to 1.0)
        const coastProgress = (continentMask - 0.25) / 0.25;
        
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
      
      // Apply mountain foothills with smoothed transition that start earlier
      if (continentMask > 0.6) { // Extended transition zone (previously 0.75)
        // Calculate mountain influence factor with smoother transition
        // Using smoothstep curve for influence (0 at continentMask=0.6, 1 at continentMask=0.8)
        const mountainTransition = Math.min(1.0, Math.max(0.0, (continentMask - 0.6) / 0.2));
        const mountainInfluence = mountainTransition * mountainTransition * (3 - 2 * mountainTransition);
        
        // Create foothills that start earlier but remain lower
        const foothillsNoise = this.ridgedNoise(
          x, z,
          this.terrainParams.mountainScale * 1.1,  // Medium scale for foothills
          3  // Fewer octaves for smoother foothills
        );
        
        // First pass creates the main mountain ranges with larger features
        const mainRangeNoise = this.ridgedNoise(
          x, z,
          this.terrainParams.mountainScale * 0.7,  // Larger main ranges
          5  // Increased octaves for more detailed mountain ranges
        );
        
        // Second pass adds smaller mountain chains and foothills
        const secondaryRangeNoise = this.ridgedNoise(
          x + 128.37, z - 94.21, // Phase offset prevents aligned patterns
          this.terrainParams.mountainScale * 1.4,  // Smaller secondary ranges
          4
        );
        
        // Third pass adds micro-details that enhance transition zones
        const detailRangeNoise = this.ridgedNoise(
          x - 57.44, z + 63.18, // Different phase offset
          this.terrainParams.mountainScale * 2.1,  // Small detail features
          3
        );
        
        // Mountain height variation across landscape
        const mountainHeightVariation = 1.0 + 0.4 * this.fractalNoise(
          x * 0.0004, z * 0.0004, // Larger scale variation
          3, 0.5, 2.0
        );
        
        // Create progressive multi-scale blending based on transition
        // Lower transitions get more foothills, higher transitions get more mountains
        const foothillWeight = (1.0 - mountainInfluence) * 0.8;
        const mainRangeWeight = 0.6 + mountainInfluence * 0.2;
        const secondaryRangeWeight = 0.25 + mountainInfluence * 0.1;
        const detailRangeWeight = 0.15 - mountainInfluence * 0.05;
        
        // Multi-scale mountains with improved blending
        // Creates smoother transitions from hills to mountains
        const combinedMountainNoise = 
            (foothillsNoise * foothillWeight +
             mainRangeNoise * mainRangeWeight + 
             secondaryRangeNoise * secondaryRangeWeight +
             detailRangeNoise * detailRangeWeight) / 
            (foothillWeight + mainRangeWeight + secondaryRangeWeight + detailRangeWeight);
        
        // Apply mountain height with improved falloff
        // Progressive multiplier creates smoother transitions
        const mountainHeightMultiplier = mountainInfluence * mountainHeightVariation;
        
        // Apply mountain height with spatial variation for more natural ranges
        const spatialVariation = 1.0 + 0.7 * this.fractalNoise(x * 0.0008, z * 0.0008, 3, 0.5, 2.0);
        
        // Add mountains with improved height scaling
        height += combinedMountainNoise * this.terrainParams.mountainHeight * mountainHeightMultiplier * spatialVariation;
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
      
      // Add Tuscan-style plateaus and hill features with enhanced system
      const plateauNoise = this.fractalNoise(
        x, z,
        0.0004,  // Scale for larger plateau features
        2,       // Just a few octaves for smoother plateaus
        0.5, 
        2.0
      );
      
      // Add hills in mid-altitude ranges (ideal for Tuscan landscapes)
      if (plateauNoise > 0.5 && height > 20 && height < 100) {
        // Several height bands for different types of terrain features
        let targetHeight;
        
        // Different plateau heights based on elevation bands
        if (height < 40) {
          // Lower Tuscan valleys and farmland-like areas
          targetHeight = 30 + plateauNoise * 10;
        } else if (height < 70) {
          // Middle level - classic Tuscan hills
          targetHeight = 60 + plateauNoise * 15;
        } else {
          // Higher plateaus and mesas
          targetHeight = 80 + plateauNoise * 20;
        }
        
        // Variable plateau weight creates more natural transitions
        // Higher values approach targetHeight more strongly
        const baseWeight = (plateauNoise - 0.5) * (1 / 0.5);
        
        // Adjust weight based on noise for variety
        const edgeNoise = this.noise(x * 0.002 + this.seed * 19, z * 0.002 + this.seed * 21);
        const plateauWeight = baseWeight * (0.7 + 0.5 * edgeNoise);
        
        // Apply plateau effect with smoothing
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
    
    // DEEP VALLEYS
    if (height < this.minHeight) {
      // Ocean bed - should be darker
      const depth = Math.min(1, (this.minHeight - height) / 50);
      color.setRGB(
        0.25 - depth * 0.1,  // Reduced red (darker)
        0.2 - depth * 0.1,   // Reduced green (darker)
        0.15 - depth * 0.05  // Reduced blue (darker)
      );
    }
    // VALLEY FLOORS with ultra-enhanced transitions
    else if (height < this.minHeight + 18) {  // Much wider transition zone
      // Calculate position in valley floor with improved easing
      const valleyDepth = this.minHeight + 18 - height;
      const maxDepth = 18;  // Extended significantly
      const depthFactor = Math.min(1.0, valleyDepth / maxDepth);
      
      // Create enhanced easing function for smoother color transition
      // Using improved smootherstep for better transitions near boundaries
      const smootherStep = x => x * x * x * (x * (x * 6 - 15) + 10); // Ken Perlin's smootherstep
      const easedDepth = smootherStep(depthFactor);
      
      // Valley floor colors with enhanced multi-scale position-based variation
      const valleyFloorColor = new THREE.Color(0xd5c7a8); // Lighter sandy color for better distant view
      
      // Apply fractal noise at multiple scales with different phases
      // Using improved coherence between scales with phase offsets
      const largeScaleVariation = this.fractalNoise(
        x * 0.007 + this.seed * 19, 
        z * 0.007 + this.seed * 23, 
        4, 0.5, 2.0  // More octaves for better detail
      ) * 0.09;  // Stronger variation
      
      const mediumScaleVariation = this.fractalNoise(
        x * 0.035 + this.seed * 31, 
        z * 0.035 + this.seed * 37, 
        3, 0.5, 2.0  // More octaves
      ) * 0.07;  // Stronger variation
      
      const smallScaleVariation = this.fractalNoise(
        x * 0.12 + this.seed * 43, 
        z * 0.12 + this.seed * 47, 
        2, 0.5, 2.0  // More octaves
      ) * 0.05;  // Stronger variation
      
      // Apply multi-scale noise for more natural variation with improved coherence
      // Using weighted combination based on depth creates more natural appearance
      const largeWeight = 0.5 + easedDepth * 0.3; // Stronger large features in deeper areas
      const mediumWeight = 0.35 - easedDepth * 0.1; // Less medium detail in deeper areas
      const smallWeight = 0.15 - easedDepth * 0.05; // Less small detail in deeper areas
      
      // Adjusted valley color with scale-aware noise application
      const adjustedValleyColor = new THREE.Color(
        valleyFloorColor.r + largeScaleVariation * largeWeight,
        valleyFloorColor.g + largeScaleVariation * largeWeight * 0.8 + mediumScaleVariation * mediumWeight * 0.7,
        valleyFloorColor.b + largeScaleVariation * largeWeight * 0.6 + smallScaleVariation * smallWeight * 0.9
      );
      
      // Enhanced transition colors with multiple intermediate steps
      // Using more similar hues for smoother color transitions
      const transColor1 = new THREE.Color(0xd2caa0); // First transition color (still mostly sand)
      const transColor2 = new THREE.Color(0xbfc291); // Second transition color (sand-grass mix)
      const transColor3 = new THREE.Color(0x9dbc88); // Third transition color (mostly grass)
      
      // Apply consistent multi-scale noise to transition colors for seamless boundaries
      const adjustedTransColor1 = new THREE.Color(
        transColor1.r + largeScaleVariation * largeWeight * 0.7,
        transColor1.g + largeScaleVariation * largeWeight * 0.6 + mediumScaleVariation * mediumWeight * 0.8,
        transColor1.b + mediumScaleVariation * mediumWeight * 0.6 + smallScaleVariation * smallWeight * 0.7
      );
      
      const adjustedTransColor2 = new THREE.Color(
        transColor2.r + largeScaleVariation * largeWeight * 0.6,
        transColor2.g + largeScaleVariation * largeWeight * 0.7 + mediumScaleVariation * mediumWeight * 0.9,
        transColor2.b + mediumScaleVariation * mediumWeight * 0.7 + smallScaleVariation * smallWeight * 0.8
      );
      
      const adjustedTransColor3 = new THREE.Color(
        transColor3.r + largeScaleVariation * largeWeight * 0.5,
        transColor3.g + largeScaleVariation * largeWeight * 0.8 + mediumScaleVariation * mediumWeight * 0.9,
        transColor3.b + mediumScaleVariation * mediumWeight * 0.8 + smallScaleVariation * smallWeight * 0.9
      );
      
      // Enhanced boundary-aware color blending with multi-stage transitions
      // Special handling divided into 6 distinct transition zones
      if (height > this.minHeight + 15) { // Zone 6 - Final transition
        const factor = (height - (this.minHeight + 15)) / 3.0;
        const eased = smootherStep(factor);
        color.copy(adjustedTransColor3);
      } else if (height > this.minHeight + 12) { // Zone 5
        const factor = (height - (this.minHeight + 12)) / 3.0;
        const eased = smootherStep(factor);
        color.copy(adjustedTransColor2).lerp(adjustedTransColor3, eased);
      } else if (height > this.minHeight + 9) { // Zone 4
        const factor = (height - (this.minHeight + 9)) / 3.0;
        const eased = smootherStep(factor);
        color.copy(adjustedTransColor1).lerp(adjustedTransColor2, eased);
      } else if (height > this.minHeight + 6) { // Zone 3
        const factor = (height - (this.minHeight + 6)) / 3.0;
        const eased = smootherStep(factor);
        // Additional intermediate blend for even smoother transition
        const interBlend = new THREE.Color().copy(adjustedValleyColor).lerp(adjustedTransColor1, 0.5);
        color.copy(interBlend).lerp(adjustedTransColor1, eased);
      } else if (height > this.minHeight + 3) { // Zone 2
        const factor = (height - (this.minHeight + 3)) / 3.0;
        const eased = smootherStep(factor);
        color.copy(adjustedValleyColor).lerp(adjustedValleyColor.clone().lerp(adjustedTransColor1, 0.3), eased);
      } else { // Zone 1 - Pure valley floor
        color.copy(adjustedValleyColor);
      }
      
      // Position-based direction vector (parallel to shore) for texture alignment
      const coastDir = Math.sin(x * 0.0008 + z * 0.0015) * 0.5 + 0.5;
      
      // Add coherent micro-detail with height-aware and direction-aware application
      // Specialized high-frequency noise along beach boundaries
      const microNoiseFreq1 = 0.2 + depthFactor * 0.1 + coastDir * 0.1; // Direction+depth-dependent
      const microNoiseFreq2 = 0.4 + (1.0 - depthFactor) * 0.3; // More detail near transition
      
      const edgeNoise1 = this.fractalNoise(
        x * microNoiseFreq1 + this.seed * 95, 
        z * microNoiseFreq1 + this.seed * 97,
        3, 0.6, 2.0
      ) * 0.04;
      
      const edgeNoise2 = this.fractalNoise(
        x * microNoiseFreq2 + this.seed * 123, 
        z * microNoiseFreq2 + this.seed * 129,
        2, 0.5, 2.0
      ) * 0.03;
      
      // Distance from transition boundary for edge-focused application
      const edgeFactor = Math.pow(Math.sin(Math.PI * depthFactor), 2);
      
      // Apply with channel-specific influence for more natural look
      color.r += edgeNoise1 * (0.9 + 0.2 * depthFactor) + edgeNoise2 * edgeFactor * 0.7;
      color.g += edgeNoise1 * (1.0 + 0.1 * depthFactor) + edgeNoise2 * edgeFactor * 1.2;
      color.b += edgeNoise1 * (0.7 - 0.1 * depthFactor) + edgeNoise2 * edgeFactor * 0.8;
      
      // Apply subtle directional streaking parallel to the shore
      // This creates texture that appears to follow the beach orientation
      const streakNoise = this.fractalNoise(
        x * 0.03 * (1.0 + coastDir * 0.5) + this.seed * 159, 
        z * 0.03 * (1.0 - coastDir * 0.4) + this.seed * 167,
        2, 0.7, 1.8
      ) * 0.03;
      
      // Apply streaking only near transition boundaries
      if (height > this.minHeight + 6) {
        const streakFactor = (height - (this.minHeight + 6)) / 12.0;
        color.lerp(new THREE.Color(
          color.r + streakNoise * 0.4,
          color.g + streakNoise * 0.7,
          color.b + streakNoise * 0.3
        ), streakFactor * 0.5);
      }
    }
    // LOWER TERRAIN - gradual transition from valley to hills with finer transition steps
    else if (height < this.minHeight + 50) { // Much wider transition zone
      // Calculate normalized position in the transition zone
      const transitionProgress = (height - this.minHeight - 18) / 32;  // Adjusted for new boundaries
      
      // Multi-stage easing with blended approaches
      // Combines smootherstep with logistic curve for extra smooth transition
      const smootherStep = x => {
        const clamped = Math.max(0, Math.min(1, x));
        return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
      };
      
      const logisticCurve = x => {
        const clamped = Math.max(0, Math.min(1, x));
        return 1.0 / (1.0 + Math.exp(-10 * (clamped - 0.5)));
      };
      
      // Blend between two easing functions for more organic transition
      const blendFactor = Math.sin(transitionProgress * Math.PI) * 0.5 + 0.5; // 0-1-0 curve
      const easing1 = smootherStep(transitionProgress);
      const easing2 = logisticCurve(transitionProgress);
      const blendedEasing = easing1 * (1.0 - blendFactor * 0.5) + easing2 * (blendFactor * 0.5);
      
      // Add subtle wobble to break up any linear patterns
      const enhancedTransition = blendedEasing + 
        0.04 * Math.sin(transitionProgress * Math.PI * 3) * (1 - Math.abs(transitionProgress - 0.5) * 2);
      
      const smoothTransition = Math.max(0, Math.min(1, enhancedTransition));
      
      // Generate base color with 5-stage gradient instead of continuous
      // This creates a more controlled color transition with multiple intermediate steps
      let baseColor;
      
      // 5-zone color system with smoothed transitions between zones
      if (smoothTransition < 0.2) { // Zone 1 - Sandy soil (continuing from beach transition)
        const zoneProgress = smoothTransition / 0.2;
        const sandyColor = new THREE.Color(0x9dbc88); // Match the final beach transition color
        const sandySoilColor = new THREE.Color(0x8eb87d); // Slightly more vegetation
        baseColor = new THREE.Color().copy(sandyColor).lerp(sandySoilColor, smootherStep(zoneProgress));
      } else if (smoothTransition < 0.4) { // Zone 2 - Beginning vegetation
        const zoneProgress = (smoothTransition - 0.2) / 0.2;
        const sandySoilColor = new THREE.Color(0x8eb87d);
        const lightVegColor = new THREE.Color(0x7eb377); // Light vegetation
        baseColor = new THREE.Color().copy(sandySoilColor).lerp(lightVegColor, smootherStep(zoneProgress));
      } else if (smoothTransition < 0.6) { // Zone 3 - Medium vegetation
        const zoneProgress = (smoothTransition - 0.4) / 0.2;
        const lightVegColor = new THREE.Color(0x7eb377);
        const mediumVegColor = new THREE.Color(0x67aa6b); // Medium vegetation
        baseColor = new THREE.Color().copy(lightVegColor).lerp(mediumVegColor, smootherStep(zoneProgress));
      } else if (smoothTransition < 0.8) { // Zone 4 - Full vegetation
        const zoneProgress = (smoothTransition - 0.6) / 0.2;
        const mediumVegColor = new THREE.Color(0x67aa6b);
        const fullVegColor = new THREE.Color(0x4ea25f); // Full vegetation
        baseColor = new THREE.Color().copy(mediumVegColor).lerp(fullVegColor, smootherStep(zoneProgress));
      } else { // Zone 5 - Rich vegetation (transition to hills)
        const zoneProgress = (smoothTransition - 0.8) / 0.2;
        const fullVegColor = new THREE.Color(0x4ea25f);
        const richVegColor = new THREE.Color(0x389552); // Rich vegetation 
        baseColor = new THREE.Color().copy(fullVegColor).lerp(richVegColor, smootherStep(zoneProgress));
      }
      
      // Apply base color
      color.copy(baseColor);
      
      // Apply multi-scale noise for texture variation with boundary coherence
      // Using hierarchical noise with consistent offsets that continue from beach
      
      // Direction-based modulation to align with beach boundaries
      const coastDir = Math.sin(x * 0.0008 + z * 0.0015) * 0.5 + 0.5;
      const perpFactor = Math.cos(x * 0.0012 + z * 0.0007) * 0.5 + 0.5;
      
      // Multi-scale noise with varying frequencies and consistent seed offsets
      const largeScaleNoise = this.fractalNoise(
        x * (0.008 + perpFactor * 0.003) + this.seed * 89, 
        z * (0.008 + coastDir * 0.003) + this.seed * 97, 
        4, 0.55, 2.0
      ) * 0.1;
      
      const mediumScaleNoise = this.fractalNoise(
        x * (0.04 + coastDir * 0.01) + this.seed * 107, 
        z * (0.04 + perpFactor * 0.01) + this.seed * 113, 
        3, 0.5, 2.0
      ) * 0.07;
      
      const smallScaleNoise = this.fractalNoise(
        x * 0.15 + this.seed * 127, 
        z * 0.15 + this.seed * 131, 
        2, 0.45, 2.0
      ) * 0.05;
      
      // Edge-focused noise for transitions between color zones
      // Strongest at the 0.2, 0.4, 0.6, 0.8 boundaries
      const edgeFactor = 4.0 * Math.pow(
        Math.min(
          Math.abs(smoothTransition - 0.2),
          Math.abs(smoothTransition - 0.4),
          Math.abs(smoothTransition - 0.6),
          Math.abs(smoothTransition - 0.8)
        ), 2); // Strong at zone boundaries, weak elsewhere
      
      // Special boundary noise that gets stronger at zone transitions
      const boundaryNoise = this.fractalNoise(
        x * 0.06 + this.seed * 151, 
        z * 0.06 + this.seed * 157, 
        3, 0.6, 2.0
      ) * 0.08 * edgeFactor;
      
      // Combine noise with position-dependent weighting
      // Each noise has different influence based on terrain type
      const vegetationFactor = Math.pow(smoothTransition, 1.2); // Stronger at higher elevations
      const sandFactor = Math.pow(1.0 - smoothTransition, 1.2); // Stronger at lower elevations
      
      // Apply boundary-aware and zone-aware noise
      color.r += largeScaleNoise * (sandFactor * 0.8 + vegetationFactor * 0.3) + boundaryNoise * 0.4;
      color.g += largeScaleNoise * (sandFactor * 0.6 + vegetationFactor * 0.9) + 
                mediumScaleNoise * (sandFactor * 0.4 + vegetationFactor * 0.8) + 
                boundaryNoise * 0.8;
      color.b += largeScaleNoise * (sandFactor * 0.4 + vegetationFactor * 0.5) + 
                smallScaleNoise * (sandFactor * 0.3 + vegetationFactor * 0.4) + 
                boundaryNoise * 0.5;
      
      // Add subtle position-dependent micro-variation to further break up zoning
      const microVariation = (
        this.noise(x * 0.5 + this.seed * 67, z * 0.5 + this.seed * 71) * 0.5 +
        this.noise(x * 1.0 + this.seed * 79, z * 1.0 + this.seed * 83) * 0.5
      ) * 0.03;
      
      // Apply with slight randomization to prevent visible patterns
      const randomShift = this.noise(x * 0.02 + this.seed * 173, z * 0.02 + this.seed * 179) * 0.01;
      color.r += microVariation * 1.2 + randomShift;
      color.g += microVariation * 1.5 + randomShift * 0.8;
      color.b += microVariation * 0.8 + randomShift * 0.6;
      
      // Add vegetation-specific texturing (small patches and variation)
      if (smoothTransition > 0.3) { // Only in vegetated areas
        const vegTexture = this.fractalNoise(
          x * 0.2 + this.seed * 191, 
          z * 0.2 + this.seed * 197, 
          3, 0.6, 2.0
        ) * 0.06 * Math.min(1.0, (smoothTransition - 0.3) / 0.3);
        
        // Directional vegetation patterns (like wind-blown grass)
        const windDir = Math.sin(x * 0.003 + z * 0.001) * 0.5 + 0.5;
        const windStrength = Math.pow(windDir, 1.5) * vegTexture;
        
        // Apply vegetation texture primarily to green channel
        color.r -= windStrength * 0.3;
        color.g += windStrength * 0.7;
        color.b -= windStrength * 0.1;
      }
    }
    // MID-ALTITUDE - Hills and forests (Tuscan-style landscapes) with improved transitions
    else if (height < 120) {
    // Smoother biome transitions with terrain-adaptive factors
    // Create distance from boundaries for smoother transition effects
    const lowBoundary = this.minHeight + 30;
    const highBoundary = 120;
    const normalizedHeight = (height - lowBoundary) / (highBoundary - lowBoundary);
    
    // Enhanced boundary blending with improved smoothstep
    // Gradually fade in from lower terrain with wider transition zone
    const boundaryBlend = normalizedHeight < 0.2 ? 
        normalizedHeight * normalizedHeight * normalizedHeight * (normalizedHeight * (normalizedHeight * 6 - 15) + 10) / 0.2 : 1.0;
    
    // Create multi-scale vegetation variation with improved frequency scaling and consistency
    const vegetationNoise = this.fractalNoise(
    x * 0.012 + this.seed * 71, // Slightly reduced frequency for smoother transitions 
    z * 0.012 + this.seed * 73, 
      3, 0.5, 2.0
    );
    
    // Better moisture blending for progressive biome transitions
    // Wider transition zones with more gradual boundaries
    const baseTemperature = normalizedTemp + latitudeEffect * 0.3;
    const baseMoisture = normalizedMoisture + vegetationNoise * 0.2;
    
    // Add large-scale variation that extends beyond single chunks
    const regionalTemp = baseTemperature + this.fractalNoise(x * 0.0005, z * 0.0005, 2, 0.5, 2.0) * 0.15;
    const regionalMoisture = baseMoisture + this.fractalNoise(x * 0.0004, z * 0.0004, 2, 0.5, 2.0) * 0.2;
    
    // Apply boundary blending for smoother transition from valleys
    const moistureGradient = regionalMoisture + vegetationNoise * (0.15 + 0.15 * boundaryBlend);
    
    // Smooth transition with progressive thresholds and wider blend zones
    // Height-dependent biome boundaries create more natural patterns with smoother transitions
    const forestThreshold = 0.46 - (height - lowBoundary) / (highBoundary - lowBoundary) * 0.08;
        const grassThreshold = 0.20 + (height - lowBoundary) / (highBoundary - lowBoundary) * 0.05;
        
        // Use fuzzy boundaries with transition zones instead of hard thresholds
        // Create gradual transition regions between biome types with wider overlap
        const forestInfluence = Math.min(1.0, Math.max(0.0, (moistureGradient - forestThreshold + 0.15) / 0.3));
        const grassInfluence = Math.min(1.0, Math.max(0.0, (moistureGradient - grassThreshold + 0.15) / 0.3));
        
        // Calculate transition indicators with smoother boundary handling
        const isForested = forestInfluence > 0.5 && slope < 0.6;
        const isGrassy = grassInfluence > 0.5 || slope < 0.4;
      
      // Create biome base colors with improved variance and smoother transitions
      let forestColor, grassColor, rockColor;
      
      // Use consistent noise patterns for all colors to prevent boundary artifacts
      const colorNoise1 = this.fractalNoise(x * 0.03 + this.seed * 123, z * 0.03 + this.seed * 127, 3, 0.5, 2.0);
      const colorNoise2 = this.fractalNoise(x * 0.07 + this.seed * 131, z * 0.07 + this.seed * 137, 2, 0.5, 2.0);
      const colorVariation = (colorNoise1 * 0.7 + colorNoise2 * 0.3) * 0.06;
      
      // Enhanced forest coloration with temperature zones and smoother variations
      if (regionalTemp > 0.65) {
        // Warm forest (Mediterranean)
        forestColor = new THREE.Color(
          0.2 + colorVariation * 1.2,
          0.4 + colorVariation * 1.0,
          0.1 + colorVariation * 0.6
        );
      } else if (regionalTemp > 0.35) {
        // Temperate forest (typical Tuscan)
        forestColor = new THREE.Color(
          0.13 + colorVariation * 0.9,
          0.4 + colorVariation * 1.4,
          0.13 + colorVariation * 0.9
        );
      } else {
        // Cold forest (coniferous)
        forestColor = new THREE.Color(
          0.1 + colorVariation * 0.5,
          0.3 + colorVariation * 1.0,
          0.15 + colorVariation * 0.6
        );
      }
      
      // Enhanced grassland coloration with more natural variation
      // Base color varies smoothly with regional conditions
      const baseGrassR = 0.55 + regionalTemp * 0.1 - regionalMoisture * 0.15;
      const baseGrassG = 0.55 + regionalMoisture * 0.2 - regionalTemp * 0.05;
      const baseGrassB = 0.25 + regionalMoisture * 0.1 - regionalTemp * 0.1;
      
      grassColor = new THREE.Color(
        baseGrassR + colorNoise1 * 0.15,
        baseGrassG + colorNoise1 * 0.25 + colorNoise2 * 0.1,
        baseGrassB + colorNoise2 * 0.15
      );
      
      // Rocky terrain color with moisture and temperature influence
      // Use common noise patterns for consistency
      const rockMoistureFactor = regionalMoisture > 0.5 ? 0.6 : 1.0; // Darker when wet
      const baseRockR = 0.45 + regionalTemp * 0.15;
      const baseRockG = 0.42 + regionalTemp * 0.1 - regionalMoisture * 0.05;
      const baseRockB = 0.38 - regionalTemp * 0.05 + regionalMoisture * 0.05;
      
      rockColor = new THREE.Color(
        baseRockR * rockMoistureFactor + colorVariation * 0.8,
        baseRockG * rockMoistureFactor + colorVariation * 0.7,
        baseRockB * rockMoistureFactor + colorVariation * 0.5
      );
      
      // Apply biome color blending based on influence factors and slope
      // This creates smooth transitions between biome types instead of hard switches
      // We'll use a progressive multi-step blending approach for better transitions
      
      // Calculate blending factors with improved smoothstep functions
      // Use wider transition zones for more gradual changes
      
      // Convert influence values to transition factors with smoother curves
      const forestFactor = Math.min(1.0, Math.max(0.0, (forestInfluence - 0.3) / 0.6)); // Wider transition zone
      const forestFactorSmooth = forestFactor * forestFactor * (3 - 2 * forestFactor);
      
      const grassFactor = Math.min(1.0, Math.max(0.0, (grassInfluence - 0.2) / 0.6)); // Wider transition zone
      const grassFactorSmooth = grassFactor * grassFactor * (3 - 2 * grassFactor);
      
      // Adjust slope influence with smoother transition
      const slopeFactor = Math.max(0.0, Math.min(1.0, (slope - 0.2) / 0.5));
      const slopeFactorSmooth = slopeFactor * slopeFactor * (3 - 2 * slopeFactor);
      
      // Start with a weighted base color influenced by regional properties
      // This ensures a consistent base everywhere that other biomes blend into
      const baseColor = new THREE.Color();
      baseColor.copy(grassColor);
      
      // Apply progressive multi-step blending
      if (forestFactorSmooth > 0.1 && slopeFactorSmooth < 0.8) {
        // Create forest blend with smooth transitions at boundaries
        // Stronger forest influence on flatter areas, gradually decreasing with slope
        const forestBlendStrength = forestFactorSmooth * (1.0 - slopeFactorSmooth * 0.8);
        baseColor.lerp(forestColor, forestBlendStrength);
      }
      
      // Add rock influence for steeper areas with smooth transition
      if (slopeFactorSmooth > 0.2) {
        // Apply rock color proportionally to slope with smooth transition
        const rockBlendStrength = slopeFactorSmooth * 0.8;
        // Progressive rock influence
        baseColor.lerp(rockColor, rockBlendStrength);
      }
      
      // Set final color with additional micro-variations
      color.copy(baseColor);
      
      // Enhanced slope shading with smoother transition
      // Graduated slope effect creates more natural shadowing
      if (slope > 0.3) { // Lower threshold for more gradual effect
        // Calculate slope intensity with smoothstep function
        const slopeProgress = Math.min(1.0, (slope - 0.3) / 0.7); // 0 at slope=0.3, 1 at slope=1.0
        const slopeFactor = slopeProgress * slopeProgress * (3 - 2 * slopeProgress); // Smoothstep
        
        // Progressive darkening with more subtle effect
        color.multiplyScalar(0.95 - slopeFactor * 0.25);
      }
      
      // Enhanced multi-scale texture variation with terrain-awareness
      // Using consistent noise patterns across terrain types to prevent seams
      
      // Apply different scales with varying phases for more natural appearance
      // Use consistent positions and seeds for all terrains to avoid boundary artifacts
      const textureNoise1 = this.fractalNoise(
        x * 0.008 + this.seed * 191, 
        z * 0.008 + this.seed * 193, 
        3, 0.5, 2.0
      ) * 0.05;
      
      const textureNoise2 = this.fractalNoise(
        x * 0.05 + this.seed * 211, 
        z * 0.05 + this.seed * 223, 
        2, 0.5, 2.0
      ) * 0.03;
      
      const textureNoise3 = this.fractalNoise(
        x * 0.2 + this.seed * 233, 
        z * 0.2 + this.seed * 239, 
        1, 0.5, 2.0
      ) * 0.02;
      
      // Apply texture noise consistently across all terrain types
      // Different influence per channel for more natural appearance
      color.r += textureNoise1 * 0.9 + textureNoise2 * 0.4 + textureNoise3 * 0.2;
      color.g += textureNoise1 * 0.7 + textureNoise2 * 0.6 + textureNoise3 * 0.3;
      color.b += textureNoise1 * 0.5 + textureNoise2 * 0.4 + textureNoise3 * 0.1;
      
      // Add height-based subtle contour bands for terrain readability
      // Use higher frequency for low-height variations
      const heightBand = (Math.sin(height * 0.1) * 0.5 + 0.5) * 0.02;
      color.r += heightBand * 0.7;
      color.g += heightBand * 0.9;
      
      // Add large-scale regional variation for natural landscape zones
      const regionalVariation = this.fractalNoise(x * 0.0008 + this.seed * 241, z * 0.0008 + this.seed * 251, 2, 0.5, 2.0) * 0.03;
      color.multiplyScalar(1.0 + regionalVariation);
    }
    // HIGH ALTITUDE - Mountains with enhanced transitions
    else if (height < 340) {  // Increased for higher mountains
      // Create smoother transition from hills to mountains
      const hillsMountainBoundary = 120;
      const mountainHeight = 340;
      const transitionWidth = 30; // Width of transition zone
      
      // Calculate transition factor with smoothstep for boundary with hills
      let boundarySmoothFactor = 0;
      if (height < hillsMountainBoundary + transitionWidth) {
        const transitionProgress = (height - hillsMountainBoundary) / transitionWidth;
        boundarySmoothFactor = 1.0 - (transitionProgress * transitionProgress * (3 - 2 * transitionProgress));
      }
      
      // Base rock color varies with temperature, moisture, and height
      // Creates zones of different rock types for more natural transitions
      let baseRockColor;
      
      // Add spatial coherence to rock types with multi-scale noise
      const rockTypeNoise = this.fractalNoise(
        x * 0.001 + this.seed * 63, 
        z * 0.001 + this.seed * 67,
        3, 0.5, 2.0
      ) * 0.15;
      
      // Adjust temperature boundaries with noise for less abrupt transitions
      const adjustedTemp = normalizedTemp + rockTypeNoise;
      
      if (adjustedTemp > 0.6) {
        // Warm rock (more reddish variants)
        baseRockColor = new THREE.Color(
          0.48 + this.fractalNoise(x * 0.05, z * 0.05, 2, 0.5, 2.0) * 0.06, 
          0.38 + this.fractalNoise(x * 0.07, z * 0.07, 2, 0.5, 2.0) * 0.05, 
          0.32 + this.fractalNoise(x * 0.09, z * 0.09, 2, 0.5, 2.0) * 0.04
        );
      } else if (adjustedTemp > 0.3) {
        // Temperate rock (gray-brown)
        baseRockColor = new THREE.Color(
          0.42 + this.fractalNoise(x * 0.06, z * 0.06, 2, 0.5, 2.0) * 0.06, 
          0.38 + this.fractalNoise(x * 0.08, z * 0.08, 2, 0.5, 2.0) * 0.06, 
          0.35 + this.fractalNoise(x * 0.1, z * 0.1, 2, 0.5, 2.0) * 0.05
        );
      } else {
        // Cold rock (more bluish-gray)
        baseRockColor = new THREE.Color(
          0.38 + this.fractalNoise(x * 0.07, z * 0.07, 2, 0.5, 2.0) * 0.05, 
          0.38 + this.fractalNoise(x * 0.09, z * 0.09, 2, 0.5, 2.0) * 0.05, 
          0.4 + this.fractalNoise(x * 0.11, z * 0.11, 2, 0.5, 2.0) * 0.06
        );
      }
      
      // Create smoother elevation gradient with improved curve
      const normalizedMountainHeight = (height - hillsMountainBoundary) / (mountainHeight - hillsMountainBoundary);
      const gradientCurve = Math.pow(normalizedMountainHeight, 0.7); // Softer power curve
      
      // Darker color for higher elevations with improved gradient
      const darkRock = new THREE.Color(0.28, 0.28, 0.3);  // Slightly bluer dark rock
      
      // Special handling for transition zone from hills to mountains
      if (boundarySmoothFactor > 0) {
        // Get the color from the hills biome for blending
        // Use temperature and moisture to select consistent color with hills zone
        const vegetationNoise = this.fractalNoise(
          x * 0.015 + this.seed * 71, 
          z * 0.015 + this.seed * 73, 
          3, 0.5, 2.0
        );
        
        const moistureGradient = normalizedMoisture + vegetationNoise * 0.3;
        
        // Select hill color based on moisture and slope for consistent transition
        let hillColor;
        if (moistureGradient > 0.5 && slope < 0.5) {
          // Forested hills
          if (normalizedTemp > 0.7) {
            // Warm forest (Mediterranean)
            hillColor = new THREE.Color(0.2, 0.4, 0.1);
          } else if (normalizedTemp > 0.4) {
            // Temperate forest (typical Tuscan)
            hillColor = new THREE.Color(0.13, 0.4, 0.13);
          } else {
            // Cold forest (coniferous)
            hillColor = new THREE.Color(0.1, 0.3, 0.15);
          }
        } else if (moistureGradient > 0.25 || slope < 0.4) {
          // Grassy hills
          hillColor = new THREE.Color(
            0.55 + vegetationNoise * 0.15,
            0.55 + vegetationNoise * 0.25,
            0.25 + vegetationNoise * 0.15
          );
        } else {
          // Rocky hills
          hillColor = normalizedMoisture > 0.5 ?
            new THREE.Color(0.35, 0.35, 0.3) :  // Darker wet rock
            new THREE.Color(0.55, 0.5, 0.4);    // Lighter dry rock
        }
        
        // Calculate rock base color with blend from hills
        // Apply multi-step blending for smoother transition
        const baseColor = new THREE.Color().copy(hillColor).lerp(baseRockColor, 1 - boundarySmoothFactor * 0.7);
        color.copy(baseColor).lerp(darkRock, gradientCurve * 0.7 * (1 - boundarySmoothFactor * 0.5));
      } else {
        // Normal mountain coloring away from transition zone
        color.copy(baseRockColor).lerp(darkRock, gradientCurve * 0.7);
      }
      
      // Add enhanced rock striations and texture with multiple scales and better coherence
      const largeStriation = Math.abs(this.fractalNoise(x * 0.03 + this.seed * 15, z * 0.03 + this.seed * 16, 3, 0.5, 2.0));
      const mediumStriation = Math.abs(this.fractalNoise(x * 0.08 + this.seed * 23, z * 0.08 + this.seed * 24, 2, 0.5, 2.0));
      const smallStriation = Math.abs(this.fractalNoise(x * 0.2 + this.seed * 31, z * 0.2 + this.seed * 32, 1, 0.5, 2.0));
      
      // Improved striation weighting based on elevation for more natural rock appearance
      const largeWeight = 0.6 - gradientCurve * 0.2;
      const mediumWeight = 0.3 + gradientCurve * 0.1;
      const smallWeight = 0.1 + gradientCurve * 0.1;
      
      // Combine striations with elevation-aware weighting
      const striation = largeStriation * largeWeight + mediumStriation * mediumWeight + smallStriation * smallWeight;
      
      // Apply with subtle height-dependent variation
      const striationStrength = 0.15 * (1.0 + 0.2 * Math.sin(height * 0.02));
      color.r += striation * striationStrength - 0.05;
      color.g += striation * striationStrength - 0.05;
      color.b += striation * striationStrength - 0.05;
      
      // Add snow patches with improved transition zone and multi-scale blending
      if (height > 240) {  // Lower snow line for wider transition
        // Enhanced snow noise system with better frequency scaling
        const largeSnowNoise = this.fractalNoise(x * 0.04 + this.seed * 17, z * 0.04 + this.seed * 18, 3, 0.5, 2.0);
        const mediumSnowNoise = this.fractalNoise(x * 0.1 + this.seed * 25, z * 0.1 + this.seed * 26, 2, 0.5, 2.0);
        const smallSnowNoise = this.fractalNoise(x * 0.25 + this.seed * 33, z * 0.25 + this.seed * 34, 1, 0.5, 2.0);
        
        // Create scale-aware noise with improved coherence
        const snowNoiseStrength = 0.4 + 0.2 * ((height - 240) / 100); // More noise variation at higher elevations
        const combinedSnowNoise = 
            largeSnowNoise * 0.5 + 
            mediumSnowNoise * 0.3 + 
            smallSnowNoise * 0.2;
        
        // Improved snow cover calculation with enhanced slope influence
        // Progressive slope handling for more natural snow accumulation
        const slopeInfluence = Math.pow(Math.max(0, 1 - slope * 3.5), 1.5); // Stronger falloff on steeper slopes
        
        // Enhanced snow line with temperature influence
        const temperatureEffect = normalizedTemp * 15; // Adjust snow line based on temperature
        const adjustedSnowLine = 240 + temperatureEffect;
        
        // Wider and more natural transition zone based on height and temperature
        const transitionRange = 70 + temperatureEffect * 0.5; // Wider transition range in warmer areas
        
        // Calculate snow amount with improved transition curve
        // Use smootherstep for more gradual onset of snow
        const snowProgress = Math.max(0, (height - adjustedSnowLine) / transitionRange);
        const snowTransition = snowProgress < 1 ? 
            snowProgress * snowProgress * snowProgress * (snowProgress * (snowProgress * 6 - 15) + 10) : 
            1.0;
            
        // Combine factors with improved weighting
        const snowAmount = snowTransition * slopeInfluence + 
                        combinedSnowNoise * snowNoiseStrength * snowTransition;
        
        if (snowAmount > 0) {
          // Mix in snow with enhanced coloration based on light conditions and altitude
          // Higher elevations get slightly bluer snow
          const blueSnowTint = Math.min(1, (height - 240) / 200) * 0.05;
          const snowColor = new THREE.Color(0.92, 0.92, 0.97 + blueSnowTint);
          
          // Progressive snow application to avoid abrupt transitions
          if (snowAmount < 0.2) {
            // Very light dusting with subtle transition
            const dustFactor = snowAmount / 0.2;
            color.lerp(snowColor, dustFactor * 0.3);
          } else {
            // Normal snow cover with full transition
            color.lerp(snowColor, Math.min(snowAmount, 1));
          }
        }
      }
    }
    // PEAKS - Snow-covered with enhanced transitions
    else {
    color.setRGB(0.6, 0.6, 0.6); // Assign a fixed mid-grey/blue color
    
}

// Ensure color values are valid (KEEP THIS FINAL CLAMP)
color.r = Math.max(0, Math.min(1, color.r));
color.g = Math.max(0, Math.min(1, color.g));
color.b = Math.max(0, Math.min(1, color.b));

return color;

  }

  createChunkGeometry(startX, startZ) {
    // Create plane geometry with higher resolution at chunk borders for smoother transitions
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
    
    // Extra sampling points used for calculating smooth transitions between chunks
    const smoothingRadius = 3; // Smoothing radius for edges
    
    // Identify the chunk grid position
    const chunkX = Math.floor(startX / this.chunkSize);
    const chunkZ = Math.floor(startZ / this.chunkSize);

    // Modify vertices to create terrain shape with special edge handling
    for (let i = 0; i < vertices.length; i += 3) {
      // Get world coordinates
      const x = vertices[i] + startX;
      const z = vertices[i + 2] + startZ;
      
      // Identify position within chunk (0-1 range)
      const relX = (x - startX) / this.chunkSize;
      const relZ = (z - startZ) / this.chunkSize;
      
      // Detect if we're near an edge for special handling
      const isNearEdgeX = relX < 0.02 || relX > 0.98;
      const isNearEdgeZ = relZ < 0.02 || relZ > 0.98;
      
      // Calculate height with standard method
      const height = this.getTerrainHeight(x, z);
      
      // Apply height to vertex Y coordinate
      vertices[i + 1] = height;
      
      // Assign color based on biome/height
      // Always use the same world coordinate space for consistent color calculations
      const color = this.getBiomeColor(height, x, z);
      colors.push(color.r, color.g, color.b);
    }

    // Add colors to geometry
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Implement a smoother normal calculation to prevent glitches at mountain peaks
    this.computeSmoothedNormals(geometry, startX, startZ);
    
    // Fix for z-fighting issues between chunks - use a consistent approach
    // Instead of random noise that can create seams, use deterministic micro-adjustments
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Create a predictable micro-variation based on world position
      // This ensures the same adjustment at chunk boundaries
      const worldX = x + startX;
      const worldZ = z + startZ;
      
      // Generate deterministic micro-noise based on position
      const deterministicNoise = Math.sin(worldX * 0.1) * Math.cos(worldZ * 0.1) * 0.01;
      
      positions.setY(i, y + deterministicNoise);
    }
    
    // Re-apply smoothed normals after the height adjustments
    this.computeSmoothedNormals(geometry, startX, startZ);
    geometry.attributes.position.needsUpdate = true;
    
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

            // Ensure terrain renders properly - increased factor to avoid z-fighting
            mesh.renderOrder = 0;
            this.materials.terrain.polygonOffset = true;
            this.materials.terrain.polygonOffsetFactor = 2; // Increased from 1
            this.materials.terrain.polygonOffsetUnits = 2;  // Increased from 1
            
            // Add to scene only once
            this.scene.add(mesh);
            this.currentChunks.set(key, mesh);
          } catch (error) {
            console.error("Error creating chunk:", error);
          }
        }
      }
    }
  }

  // Water creation method removed completely

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
      
      // Place node above terrain (10 units above terrain)
      const y = terrainHeight + 10;
      
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
    
    // Water requirement check removed since there's no water
    if (landmarkType.requiresWater) {
      // Always return false for landmarks that required water
      return false;
    }
    
    return true;
  }

  // computeSmoothedNormals(geometry, startX, startZ) {
  //   const positions = geometry.attributes.position;
  //   const vertexCount = positions.count;
  //   const tempNormals = [];
    
  //   // First, compute normal for each face and accumulate to vertices
  //   for (let i = 0; i < vertexCount; i++) {
  //     tempNormals[i] = new THREE.Vector3(0, 0, 0);
  //   }
    
  //   const indices = geometry.index ? geometry.index.array : null;
  //   let triangleCount;
    
  //   if (indices) {
  //     triangleCount = indices.length / 3;
  //   } else {
  //     triangleCount = vertexCount / 3;
  //   }
    
  //   // Calculate normals for each face and accumulate
  //   for (let i = 0; i < triangleCount; i++) {
  //     let vA, vB, vC;
      
  //     if (indices) {
  //       vA = indices[i * 3];
  //       vB = indices[i * 3 + 1];
  //       vC = indices[i * 3 + 2];
  //     } else {
  //       vA = i * 3;
  //       vB = i * 3 + 1;
  //       vC = i * 3 + 2;
  //     }
      
  //     const pA = new THREE.Vector3().fromBufferAttribute(positions, vA);
  //     const pB = new THREE.Vector3().fromBufferAttribute(positions, vB);
  //     const pC = new THREE.Vector3().fromBufferAttribute(positions, vC);
      
  //     const cb = new THREE.Vector3().subVectors(pC, pB);
  //     const ab = new THREE.Vector3().subVectors(pA, pB);
  //     const normal = new THREE.Vector3().crossVectors(cb, ab).normalize();
      
  //     // Add face normal to each vertex normal with distance-based weighting
  //     // This creates smoother transitions at sharp edges
  //     tempNormals[vA].add(normal);
  //     tempNormals[vB].add(normal);
  //     tempNormals[vC].add(normal);
  //   }
    
  //   // Second pass: identify problematic mountain peaks and smooth them more aggressively
  //   const worldCoords = new Map();
  //   for (let i = 0; i < vertexCount; i++) {
  //     // Store world coordinates for each vertex
  //     const x = positions.getX(i) + startX;
  //     const y = positions.getY(i);
  //     const z = positions.getZ(i) + startZ;
  //     worldCoords.set(i, { x, y, z });

  //     // Pre-normalize for initial comparison
  //     tempNormals[i].normalize();
  //   }
    
  //   // Find vertices with problematic normals (mountain peaks/sharp edges)
  //   const problematicVertices = new Set();
  //   for (let i = 0; i < vertexCount; i++) {
  //     // Check if this is a mountain peak (high altitude + nearly horizontal normal)
  //     const worldY = worldCoords.get(i).y;
  //     const normalY = tempNormals[i].y;
      
  //     // Identify sharper peaks at higher elevations with more horizontal normals
  //     if (worldY > 200 && Math.abs(normalY) < 0.5) {
  //       problematicVertices.add(i);
  //     }

  //     // Identify extremely sharp edges regardless of height
  //     if (Math.abs(normalY) < 0.2) {
  //       problematicVertices.add(i);
  //     }
      
  //     // Additional check for high mountain peaks with any downward facing normals
  //     if (worldY > 340 && normalY < 0) {
  //       problematicVertices.add(i);
  //     }
  //   }
    
  //   // Perform additional smoothing on problematic vertices
  //   // for (const vertexIndex of problematicVertices) {
  //   //   // Find neighboring vertices
  //   //   const neighbors = new Set();
  //   //   for (let i = 0; i < triangleCount; i++) {
  //   //     let vA, vB, vC;
        
  //   //     if (indices) {
  //   //       vA = indices[i * 3];
  //   //       vB = indices[i * 3 + 1];
  //   //       vC = indices[i * 3 + 2];
  //   //     } else {
  //   //       vA = i * 3;
  //   //       vB = i * 3 + 1;
  //   //       vC = i * 3 + 2;
  //   //     }
        
  //   //     // If this vertex is part of this triangle
  //   //     if (vA === vertexIndex || vB === vertexIndex || vC === vertexIndex) {
  //   //       // Add all vertices from this triangle
  //   //       neighbors.add(vA);
  //   //       neighbors.add(vB);
  //   //       neighbors.add(vC);
  //   //     }
  //   //   }
      
  //   //   // Calculate smoothed normal from neighbors
  //   //   const smoothedNormal = new THREE.Vector3(0, 0, 0);
  //   //   for (const neighborIndex of neighbors) {
  //   //     smoothedNormal.add(tempNormals[neighborIndex].clone());
  //   //   }
  //   //   smoothedNormal.normalize();
      
  //   //   // Blend with an upward-facing normal proportional to the height
  //   //   // Higher elevations get more upward normal blending
  //   //   const worldY = worldCoords.get(vertexIndex).y;
  //   //   const upNormal = new THREE.Vector3(0, 1, 0);
      
  //   //   // Modified height factor calculation - stronger correction at higher elevation

  //   //   // Apply stronger correction when we're at high elevations
  //   //   const heightFactor = Math.min(1, (worldY - 200) / 200) * 0.5;
  //   //   const snowFactor = worldY > 340 ? 0.3 : 0;
  //   //   let blendFactor = 0.5 + heightFactor + snowFactor;
  //   //   blendFactor = Math.min(blendFactor, 0.5); // Clamp below 1.0 (e.g., 0.95)
      
  //   //   tempNormals[vertexIndex].copy(smoothedNormal).lerp(upNormal, blendFactor).normalize();      
      
  //   //   // Ensure no downward-facing normals on peaks
  //   //   if (worldY > 340 && tempNormals[vertexIndex].y < 0.1) {
  //   //     tempNormals[vertexIndex].y = 0.1;
  //   //     tempNormals[vertexIndex].normalize();
  //   //   }
  //   // }
    
  //   // Final normalization of all normals
  //   for (let i = 0; i < vertexCount; i++) {
  //     tempNormals[i].normalize();
  //   }
    
  //   // Create normal buffer attribute
  //   const normalArray = new Float32Array(vertexCount * 3);
    
  //   for (let i = 0; i < vertexCount; i++) {
  //     normalArray[i * 3] = tempNormals[i].x;
  //     normalArray[i * 3 + 1] = tempNormals[i].y;
  //     normalArray[i * 3 + 2] = tempNormals[i].z;
  //   }
    
  //   geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
  // }

  
  computeSmoothedNormals(geometry, startX, startZ) {
    const positions = geometry.attributes.position;
    const vertexCount = positions.count;
    // Initialize tempNormals as an array of Vector3 instances
    const tempNormals = Array.from({ length: vertexCount }, () => new THREE.Vector3());

    const indices = geometry.index ? geometry.index.array : null;
    const triangleCount = indices ? indices.length / 3 : vertexCount / 3;

    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    const pC = new THREE.Vector3();
    const cb = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const normal = new THREE.Vector3();

    // First pass: Calculate face normals and accumulate them onto vertices
    for (let i = 0; i < triangleCount; i++) {
      let vA_idx, vB_idx, vC_idx;

      if (indices) {
        vA_idx = indices[i * 3];
        vB_idx = indices[i * 3 + 1];
        vC_idx = indices[i * 3 + 2];
      } else {
        vA_idx = i * 3;
        vB_idx = i * 3 + 1;
        vC_idx = i * 3 + 2;
      }

      pA.fromBufferAttribute(positions, vA_idx);
      pB.fromBufferAttribute(positions, vB_idx);
      pC.fromBufferAttribute(positions, vC_idx);

      cb.subVectors(pC, pB);
      ab.subVectors(pA, pB);
      normal.crossVectors(cb, ab); // Don't normalize yet, magnitude weights contribution

      // Add face normal (magnitude matters for weighting)
      // Check if indices are valid before adding
       if (tempNormals[vA_idx]) tempNormals[vA_idx].add(normal);
       if (tempNormals[vB_idx]) tempNormals[vB_idx].add(normal);
       if (tempNormals[vC_idx]) tempNormals[vC_idx].add(normal);
    }

    // Store world coordinates and pre-normalize for initial checks
    const worldCoords = new Map();
    for (let i = 0; i < vertexCount; i++) {
        const worldX = positions.getX(i) + startX;
        const worldY = positions.getY(i);
        const worldZ = positions.getZ(i) + startZ;
        worldCoords.set(i, { x: worldX, y: worldY, z: worldZ });

        // Normalize the accumulated normals from the first pass
        if (tempNormals[i] && tempNormals[i].lengthSq() > 0.0001) {
             tempNormals[i].normalize();
        } else if (tempNormals[i]) {
             // If zero length, default to up
             tempNormals[i].set(0, 1, 0);
        }
    }

    // Find vertices with potentially problematic normals (peaks/sharp edges)
    // Let's be a bit more conservative here initially
    const problematicVertices = new Set();
    for (let i = 0; i < vertexCount; i++) {
        const worldY = worldCoords.get(i).y;
        const normalY = tempNormals[i].y; // Use the pre-normalized value

        // Only target high peaks with significantly flat or downward normals
        if (worldY > 300 && normalY < 0.3) { problematicVertices.add(i); }
        // Or very sharp edges regardless of height
        // if (Math.abs(normalY) < 0.1) { problematicVertices.add(i); } // Maybe disable this one?
    }

    // --- Second pass: Apply gentler smoothing to problematic vertices ---
    const smoothedNormal = new THREE.Vector3(); // Re-use this vector
    const upNormal = new THREE.Vector3(0, 1, 0);

    for (const vertexIndex of problematicVertices) {
        // Find neighboring vertices
        const neighbors = new Set();
        for (let i = 0; i < triangleCount; i++) {
             let vA_idx, vB_idx, vC_idx;
             if (indices) {
                  vA_idx = indices[i * 3]; vB_idx = indices[i * 3 + 1]; vC_idx = indices[i * 3 + 2];
             } else {
                  vA_idx = i * 3; vB_idx = i * 3 + 1; vC_idx = i * 3 + 2;
             }

             if (vA_idx === vertexIndex || vB_idx === vertexIndex || vC_idx === vertexIndex) {
                  neighbors.add(vA_idx); neighbors.add(vB_idx); neighbors.add(vC_idx);
             }
        }

        // Calculate averaged normal from neighbors (using already normalized tempNormals)
        smoothedNormal.set(0, 0, 0);
        let validNeighbors = 0;
        for (const neighborIndex of neighbors) {
             // Make sure the neighbor normal exists and is valid
             if (tempNormals[neighborIndex] && !isNaN(tempNormals[neighborIndex].x)) {
                 smoothedNormal.add(tempNormals[neighborIndex]);
                 validNeighbors++;
             }
        }

        // Only proceed if we have valid neighbors and the smoothed normal is not zero
        if (validNeighbors > 0 && smoothedNormal.lengthSq() > 0.0001) {
            smoothedNormal.normalize();

            // Apply a GENTLE upward bias, especially at higher altitudes
            const worldY = worldCoords.get(vertexIndex).y;

            // --- Start with a very small base blend factor ---
            let blendFactor = 0.1;
            // Increase blend slightly based on how high it is above the 'problem' threshold
            if (worldY > 300) {
                 blendFactor += Math.min(0.4, (worldY - 300) / 150 * 0.4); // Max 0.4 added blend for height
            }
            // Make sure blendFactor never reaches 1.0
            blendFactor = Math.min(blendFactor, 0.99); // Hard cap at 0.6

            // Lerp towards the 'up' vector using the calculated gentle blendFactor
            tempNormals[vertexIndex].copy(smoothedNormal).lerp(upNormal, blendFactor).normalize();

            // Optional: A less aggressive final clamp to prevent extreme downward normals on peaks
            if (worldY > 340 && tempNormals[vertexIndex].y < 0.05) {
                 tempNormals[vertexIndex].y = 0.05; // Ensure it's at least slightly positive
                 tempNormals[vertexIndex].normalize();
            }

        } else {
             // Fallback if no valid neighbors or smoothedNormal was zero:
             // Keep the original normal from the first pass (which defaults to up if it was zero)
             // tempNormals[vertexIndex] already holds the value from the first pass normalization.
        }
    } // End loop over problematicVertices

    // --- Final normalization and buffer creation ---
    const normalArray = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
        // Final normalization (handles cases that skipped the second pass too)
        // Check again for safety, though previous steps should handle most issues
        if (tempNormals[i] && !isNaN(tempNormals[i].x) && tempNormals[i].lengthSq() > 0.0001) {
             tempNormals[i].normalize();
        } else if (tempNormals[i]) {
             tempNormals[i].set(0, 1, 0); // Default to up if invalid/zero
        } else {
            // Should not happen if initialized correctly, but good fallback
            tempNormals[i] = new THREE.Vector3(0, 1, 0);
        }

        normalArray[i * 3] = tempNormals[i].x;
        normalArray[i * 3 + 1] = tempNormals[i].y;
        normalArray[i * 3 + 2] = tempNormals[i].z;
    }

    geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
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
   * Creates a small grove landmark (replacement for oasis)
   * @param {THREE.Group} group - Parent group
   * @param {number} size - Size of the landmark
   */
  createOasis(group, size) {
    // Create central clearing
    const clearingRadius = size * 0.4;
    const clearingGeometry = new THREE.CircleGeometry(clearingRadius, 24);
    clearingGeometry.rotateX(-Math.PI / 2);
    const clearingMaterial = new THREE.MeshStandardMaterial({
      color: 0x88aa66,
      roughness: 0.9
    });
    const clearing = new THREE.Mesh(clearingGeometry, clearingMaterial);
    clearing.position.y = 0.01; // Slightly above ground
    clearing.receiveShadow = true;
    group.add(clearing);
    
    // Create palm trees (now regular trees)
    const treeCount = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < treeCount; i++) {
      this.createPalmTree(
        group,
        size * 0.15,
        Math.random() * Math.PI * 2,
        clearingRadius * (0.9 + Math.random() * 0.3)
      );
    }
    
    // Add rocks around the grove
    const rockCount = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < rockCount; i++) {
      const rockSize = size * (0.03 + Math.random() * 0.05);
      const rockGeometry = new THREE.DodecahedronGeometry(rockSize, 0);
      const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.9
      });
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);
      
      // Position around the clearing
      const angle = Math.random() * Math.PI * 2;
      const distance = clearingRadius * (1 + Math.random() * 0.2);
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
      
      // Position around the clearing
      const angle = Math.random() * Math.PI * 2;
      const distance = clearingRadius * (0.8 + Math.random() * 0.5);
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
          // console.log(`Creating ${landmarkType.name} landmark at ${worldX}, ${worldZ}`);
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
              try {
                const geometry = this.createChunkGeometry(worldX, worldZ);
                const mesh = new THREE.Mesh(geometry, this.materials.terrain);
                mesh.position.set(worldX, 0, worldZ);
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