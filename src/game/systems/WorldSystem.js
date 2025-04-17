import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

export class WorldSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;

    // Renderer settings moved to Engine.js or AtmosphereSystem where appropriate
    // if (engine.renderer) { ... } // Removed

    // Initialize maps and collections
    this.currentChunks = new Map();
    this.manaNodes = [];

    // Height cache system
    this.heightCache = new Map(); // Key format: `${gridX},${gridZ}`
    this.cacheResolution = 8; // Store heights at 1/8th resolution of actual terrain
    this.maxCacheSize = 15000; // Prevent unbounded memory growth
    this.cacheHits = 0;
    this.cacheMisses = 0;

    // World configuration
    this.chunkSize = 1024;
    this.terrainResolution = 64;
    this.maxHeight = 400;
    this.minHeight = -50;
    this.viewDistance = 8;  // Increased view distance for better horizon rendering

    // Initialize frustum culling objects
    this._frustum = new THREE.Frustum();
    this._frustumMatrix = new THREE.Matrix4();
    this._cameraViewProjectionMatrix = new THREE.Matrix4();

    // Terrain parameters
    this.terrainParams = {
      baseScale: 0.0015,
      detailScale: 0.01,
      mountainScale: 0.002,
      baseHeight: 60,
      mountainHeight: 180,
      detailHeight: 15
    };

    // Initialize noise generator
    this.seed = Math.random() * 1000;
    this.noise = createNoise2D();

    // Define biomes (used for terrain coloring)
    this.biomes = {
      ocean: { threshold: 0.02, color: new THREE.Color(0x0066aa) },
      beach: { threshold: 0.02, color: new THREE.Color(0xdddd77) },
      plains: { threshold: 0.03, color: new THREE.Color(0x44aa44) },
      forest: { threshold: 0.04, color: new THREE.Color(0x227722) },
      mountains: { threshold: 0.02, color: new THREE.Color(0x888888) },
      snow: { threshold: 0.008, color: new THREE.Color(0xffffff) }
    };

    // Materials collection (Only terrain materials remain)
    this.materials = {};

    // Landmarks configuration (Remains unchanged)
    this.landmarks = new Map();
    this.landmarkTypes = [
        // ... (landmark types remain the same) ...
        {
            name: "ancient_ruins",
            minHeight: 10, maxHeight: 60, minDistance: 1000, maxSlope: 0.2,
            frequency: 0.00001, size: { min: 20, max: 40 }, requiresWater: false
        },
        {
            name: "magical_circle",
            minHeight: 5, maxHeight: 80, minDistance: 800, maxSlope: 0.3,
            frequency: 0.00002, size: { min: 10, max: 25 }, requiresWater: false
        },
        {
            name: "crystal_formation",
            minHeight: 40, maxHeight: 120, minDistance: 1200, maxSlope: 0.6,
            frequency: 0.000015, size: { min: 15, max: 35 }, requiresWater: false
        },
        {
            name: "stone_arch",
            minHeight: 20, maxHeight: 90, minDistance: 1500, maxSlope: 0.4,
            frequency: 0.000008, size: { min: 25, max: 50 }, requiresWater: false
        },
        {
            name: "ancient_temple",
            minHeight: 30, maxHeight: 70, minDistance: 2000, maxSlope: 0.1,
            frequency: 0.000005, size: { min: 40, max: 80 }, requiresWater: false
        },
        {
            name: "oasis",
            minHeight: 5, maxHeight: 30, minDistance: 1000, maxSlope: 0.15,
            frequency: 0.00001, size: { min: 15, max: 35 }, requiresWater: false
        }
    ];
  }

  // --- fractalNoise method remains unchanged ---
  fractalNoise(x, z, baseFrequency, octaves, persistence, lacunarity) {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const fracX = x - chunkX * this.chunkSize;
    const fracZ = z - chunkZ * this.chunkSize;
    const blendDistance = 10;
    const blendFactor = Math.min(fracX, this.chunkSize - fracX, fracZ, this.chunkSize - fracZ) / blendDistance;
    const edgeWeight = Math.min(1.0, blendFactor);
    let frequency = baseFrequency;
    let amplitude = 2.0;
    let total = 0;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      const noiseValue = this.noise(
        x * frequency + this.seed * (i * 3 + 1),
        z * frequency + this.seed * (i * 3 + 2)
      );
      const weightedNoise = noiseValue * amplitude;
      total += weightedNoise;
      maxValue += amplitude;
      amplitude *= persistence * (1.0 - 0.01 * i);
      frequency *= lacunarity;
    }
    return total / maxValue;
  }

  // --- ridgedNoise method remains unchanged ---
  ridgedNoise(x, z, frequency, octaves = 5) {
    let result = 0;
    let amplitude = 1.0;
    let freq = frequency;
    let weight = 1.0;
    for (let i = 0; i < octaves; i++) {
      let noiseValue = Math.abs(this.noise(
        x * freq + this.seed * (i * 3.7 + 1),
        z * freq + this.seed * (i * 3.7 + 2)
      ));
      noiseValue = 1.0 - noiseValue;
      const powerValue = i < 2 ? 1.5 : 1.1;
      noiseValue = Math.pow(noiseValue, powerValue);
      noiseValue *= weight;
      const weightScale = 0.7 + 0.2 * Math.sin(i * 1.5);
      weight = Math.min(1.0, noiseValue * weightScale);
      result += noiseValue * amplitude * (1.0 + 0.1 * Math.sin(i * 2.7));
      freq *= 2.0 + 0.1 * Math.sin(i);
      amplitude *= 0.5;
    }
    return result;
  }

  async initialize() {
    console.log("Initializing WorldSystem...");

    // --- REMOVED Atmosphere elements ---
    await this.createMaterials(); // Only terrain materials now
    // this.createLights(); // Removed
    // this.createSky(); // Removed
    // --- END REMOVED Atmosphere elements ---

    // Set initial camera position (can remain here or move to Engine)
    this.engine.camera.position.set(0, 500, 500);
    this.engine.camera.lookAt(0, 0, 0);

    // Generate initial world geometry
    this.createInitialTerrain();
    this.createManaNodes();

    // Camera far plane adjustment removed - handled by Engine.js

    console.log("WorldSystem initialized");
  }

  createMaterials() {
    // Create main terrain material
    this.materials.terrain = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.5, // This might need adjustment depending on AtmosphereSystem's env map
      normalScale: new THREE.Vector2(0.05, 0.05),
    });

    // Lower detail terrain material (for distant chunks)
    this.materials.terrainLOD = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0.01,
      envMapIntensity: 0.3,
    });
  }


  // --- getTerrainHeight method remains unchanged ---
  getTerrainHeight(x, z) {
    const gridX = Math.floor(x / this.cacheResolution) * this.cacheResolution;
    const gridZ = Math.floor(z / this.cacheResolution) * this.cacheResolution;
    const cacheKey = `${gridX},${gridZ}`;
    if (this.heightCache.has(cacheKey)) {
      this.cacheHits++;
      return this.heightCache.get(cacheKey);
    }
    this.cacheMisses++;
    try {
      const continentShape = this.fractalNoise(x, z, 0.00007, 5, 0.45, 1.7);
      const continentMask = Math.max(0, (continentShape + 0.25) * 1.3);
      if (continentMask <= 0.12) {
        const valleyProgress = Math.max(0, (0.12 - continentMask) / 0.12);
        const smoothValleyFactor = valleyProgress * valleyProgress * (3 - 2 * valleyProgress);
        const valleyVariation = 0.2 * Math.sin(x * 0.005 + this.seed * 0.3) * Math.sin(z * 0.005 + this.seed * 0.7) + 0.1 * Math.sin(x * 0.015 + this.seed * 1.1) * Math.sin(z * 0.015 + this.seed * 1.3) + 0.05 * Math.sin(x * 0.03 + this.seed * 2.1) * Math.sin(z * 0.03 + this.seed * 2.3);
        const valleyDepth = this.minHeight - 15 - 100 * smoothValleyFactor * (1.0 + valleyVariation);
        this._addToHeightCache(cacheKey, valleyDepth);
        return valleyDepth;
      }
      if (continentMask > 0.10 && continentMask < 0.48) {
        const slopeProgress = (continentMask - 0.10) / 0.38;
        const sigmoidBase = 1 / (1 + Math.exp(-(slopeProgress * 8 - 4)));
        const secondSigmoid = 1 / (1 + Math.exp(-((slopeProgress - 0.5) * 6)));
        const blendedSigmoid = sigmoidBase * (1 - slopeProgress * 0.4) + secondSigmoid * (slopeProgress * 0.4);
        const asymmetricCurve = blendedSigmoid * (1.15 - 0.3 * blendedSigmoid);
        const baseHeight = this.minHeight + (asymmetricCurve * 65);
        const largeScale = 0.004; const mediumScale = 0.02; const smallScale = 0.09; const microScale = 0.3;
        const edgeFactor1 = Math.pow(1 - Math.min(1, slopeProgress / 0.2), 2);
        const edgeFactor2 = Math.pow(Math.max(0, Math.min(1, (slopeProgress - 0.8) / 0.2)), 2);
        const midFactor = 4 * Math.pow(slopeProgress * (1 - slopeProgress), 1.5);
        const boundaryScale = 0.015;
        const boundaryNoise = this.fractalNoise(x * boundaryScale + this.seed * 53, z * boundaryScale + this.seed * 59, 4, 0.6, 2.0) * 12.0 * (edgeFactor1 * 0.8 + edgeFactor2 * 0.8);
        const largeNoise = this.fractalNoise(x, z, largeScale, 4, 0.5, 2.0) * (4 + edgeFactor1 * 3.5 + edgeFactor2 * 3.0);
        const mediumNoise = this.fractalNoise(x, z, mediumScale, 3, 0.5, 2.0) * (2.5 + midFactor * 2.8);
        const smallNoise = this.fractalNoise(x, z, smallScale, 2, 0.5, 2.0) * (1.2 + edgeFactor1 * 1.0 + midFactor * 1.5);
        const microNoise = this.fractalNoise(x, z, microScale, 2, 0.5, 2.0) * (0.8 + edgeFactor1 * 1.2 + edgeFactor2 * 1.2);
        const beachDirection = Math.sin(x * 0.001 + z * 0.002 + this.seed * 0.3) * 0.5 + 0.5;
        const directionalFactor = Math.pow(beachDirection, 1.5) * 3.0 * Math.max(edgeFactor1, edgeFactor2);
        const warpedLargeNoise = largeNoise * (1.0 + directionalFactor * 0.3);
        const warpedMediumNoise = mediumNoise * (1.0 + directionalFactor * 0.2);
        const combinedNoise = warpedLargeNoise * (0.4 + 0.6 * asymmetricCurve) + warpedMediumNoise * (0.3 + 0.7 * midFactor) + smallNoise * (0.2 + 0.8 * Math.min(edgeFactor1, midFactor, edgeFactor2)) + microNoise * (0.1 + 0.9 * Math.max(edgeFactor1, edgeFactor2)) + boundaryNoise;
        const finalHeight = baseHeight + combinedNoise;
        this._addToHeightCache(cacheKey, finalHeight);
        return finalHeight;
      }
      const baseNoise = this.fractalNoise(x, z, this.terrainParams.baseScale, 8, 0.5, 2.0);
      let height = (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;
      if (continentMask > 0.15 && continentMask < 0.2) {
        const coastProgress = (continentMask - 0.25) / 0.25;
        const cliffNoiseScale = 0.02;
        const cliffVariation = this.fractalNoise(x, z, cliffNoiseScale, 2, 0.5, 2.0);
        if (cliffVariation > 0.3) {
          const cliffFactor = Math.pow((cliffVariation - 0.3) / 0.7, 2) * coastProgress;
          height += 40 * cliffFactor;
        }
      }
      if (continentMask > 0.6) {
        const mountainTransition = Math.min(1.0, Math.max(0.0, (continentMask - 0.6) / 0.2));
        const mountainInfluence = mountainTransition * mountainTransition * (3 - 2 * mountainTransition);
        const foothillsNoise = this.ridgedNoise(x, z, this.terrainParams.mountainScale * 1.1, 3);
        const mainRangeNoise = this.ridgedNoise(x, z, this.terrainParams.mountainScale * 0.7, 5);
        const secondaryRangeNoise = this.ridgedNoise(x + 128.37, z - 94.21, this.terrainParams.mountainScale * 1.4, 4);
        const detailRangeNoise = this.ridgedNoise(x - 57.44, z + 63.18, this.terrainParams.mountainScale * 2.1, 3);
        const mountainHeightVariation = 1.0 + 0.4 * this.fractalNoise(x * 0.0004, z * 0.0004, 3, 0.5, 2.0);
        const foothillWeight = (1.0 - mountainInfluence) * 0.8;
        const mainRangeWeight = 0.6 + mountainInfluence * 0.2;
        const secondaryRangeWeight = 0.25 + mountainInfluence * 0.1;
        const detailRangeWeight = 0.15 - mountainInfluence * 0.05;
        const combinedMountainNoise = (foothillsNoise * foothillWeight + mainRangeNoise * mainRangeWeight + secondaryRangeNoise * secondaryRangeWeight + detailRangeNoise * detailRangeWeight) / (foothillWeight + mainRangeWeight + secondaryRangeWeight + detailRangeWeight);
        const mountainHeightMultiplier = mountainInfluence * mountainHeightVariation;
        const spatialVariation = 1.0 + 0.7 * this.fractalNoise(x * 0.0008, z * 0.0008, 3, 0.5, 2.0);
        height += combinedMountainNoise * this.terrainParams.mountainHeight * mountainHeightMultiplier * spatialVariation;
      }
      const rawTemperature = this.fractalNoise(x, z, 0.0005, 2, 0.5, 2.0);
      const rawMoisture = this.fractalNoise(x, z, 0.0004, 2, 0.5, 2.0);
      const temperature = (rawTemperature + 1) * 0.5;
      const moisture = (rawMoisture + 1) * 0.5;
      if (temperature > 0.7 && moisture < 0.3) {
        const duneNoise = this.fractalNoise(x, z, 0.02, 2, 0.5, 2.0);
        height += duneNoise * 5;
      }
      const plateauNoise = this.fractalNoise(x, z, 0.0004, 2, 0.5, 2.0);
      if (plateauNoise > 0.5 && height > 20 && height < 100) {
        let targetHeight;
        if (height < 40) { targetHeight = 30 + plateauNoise * 10; }
        else if (height < 70) { targetHeight = 60 + plateauNoise * 15; }
        else { targetHeight = 80 + plateauNoise * 20; }
        const baseWeight = (plateauNoise - 0.5) * (1 / 0.5);
        const edgeNoise = this.noise(x * 0.002 + this.seed * 19, z * 0.002 + this.seed * 21);
        const plateauWeight = baseWeight * (0.7 + 0.5 * edgeNoise);
        height = height * (1 - plateauWeight) + targetHeight * plateauWeight;
      }
      const detailNoise = this.fractalNoise(x, z, this.terrainParams.detailScale, 2, 0.5, 2.0);
      height += detailNoise * this.terrainParams.detailHeight * 0.5;
      this._addToHeightCache(cacheKey, height);
      return height;
    } catch (error) {
      console.warn("Error in getTerrainHeight:", error);
      this._addToHeightCache(cacheKey, 0);
      return 0;
    }
  }

  // --- calculateSlope method remains unchanged ---
  calculateSlope(x, z) {
    const sampleDistance = 2;
    const heightCenter = this.getTerrainHeight(x, z);
    const heightNorth = this.getTerrainHeight(x, z - sampleDistance);
    const heightSouth = this.getTerrainHeight(x, z + sampleDistance);
    const heightEast = this.getTerrainHeight(x + sampleDistance, z);
    const heightWest = this.getTerrainHeight(x - sampleDistance, z);
    const gradientX = (heightEast - heightWest) / (2 * sampleDistance);
    const gradientZ = (heightSouth - heightNorth) / (2 * sampleDistance);
    const slope = Math.sqrt(gradientX * gradientX + gradientZ * gradientZ);
    return slope;
  }

  // --- getBiomeColor method remains unchanged ---
  getBiomeColor(height, x, z) {
    const rawTemperature = this.fractalNoise(x, z, 0.0005, 2, 0.5, 2.0);
    const rawMoisture = this.fractalNoise(x, z, 0.0004, 2, 0.5, 2.0);
    const latitudeEffect = Math.cos((z / 10000) * Math.PI) * 0.2;
    const normalizedTemp = ((rawTemperature + 1) * 0.5) + latitudeEffect;
    const normalizedMoisture = (rawMoisture + 1) * 0.5;
    const slope = this.calculateSlope(x, z);
    const isSteep = slope > 0.5;
    const textureNoise = this.noise(x * 0.1 + this.seed * 11, z * 0.1 + this.seed * 12);
    const textureVariation = textureNoise * 0.05;
    let color = new THREE.Color();
    if (height < this.minHeight) {
      const depth = Math.min(1, (this.minHeight - height) / 50);
      color.setRGB(0.25 - depth * 0.1, 0.2 - depth * 0.1, 0.15 - depth * 0.05);
    } else if (height < this.minHeight + 18) {
      const valleyDepth = this.minHeight + 18 - height;
      const maxDepth = 18;
      const depthFactor = Math.min(1.0, valleyDepth / maxDepth);
      const smootherStep = x => x * x * x * (x * (x * 6 - 15) + 10);
      const easedDepth = smootherStep(depthFactor);
      const valleyFloorColor = new THREE.Color(0xd5c7a8);
      const largeScaleVariation = this.fractalNoise(x * 0.007 + this.seed * 19, z * 0.007 + this.seed * 23, 4, 0.5, 2.0) * 0.09;
      const mediumScaleVariation = this.fractalNoise(x * 0.035 + this.seed * 31, z * 0.035 + this.seed * 37, 3, 0.5, 2.0) * 0.07;
      const smallScaleVariation = this.fractalNoise(x * 0.12 + this.seed * 43, z * 0.12 + this.seed * 47, 2, 0.5, 2.0) * 0.05;
      const largeWeight = 0.5 + easedDepth * 0.3;
      const mediumWeight = 0.35 - easedDepth * 0.1;
      const smallWeight = 0.15 - easedDepth * 0.05;
      const adjustedValleyColor = new THREE.Color(valleyFloorColor.r + largeScaleVariation * largeWeight, valleyFloorColor.g + largeScaleVariation * largeWeight * 0.8 + mediumScaleVariation * mediumWeight * 0.7, valleyFloorColor.b + largeScaleVariation * largeWeight * 0.6 + smallScaleVariation * smallWeight * 0.9);
      const transColor1 = new THREE.Color(0xd2caa0);
      const transColor2 = new THREE.Color(0xbfc291);
      const transColor3 = new THREE.Color(0x9dbc88);
      const adjustedTransColor1 = new THREE.Color(transColor1.r + largeScaleVariation * largeWeight * 0.7, transColor1.g + largeScaleVariation * largeWeight * 0.6 + mediumScaleVariation * mediumWeight * 0.8, transColor1.b + mediumScaleVariation * mediumWeight * 0.6 + smallScaleVariation * smallWeight * 0.7);
      const adjustedTransColor2 = new THREE.Color(transColor2.r + largeScaleVariation * largeWeight * 0.6, transColor2.g + largeScaleVariation * largeWeight * 0.7 + mediumScaleVariation * mediumWeight * 0.9, transColor2.b + mediumScaleVariation * mediumWeight * 0.7 + smallScaleVariation * smallWeight * 0.8);
      const adjustedTransColor3 = new THREE.Color(transColor3.r + largeScaleVariation * largeWeight * 0.5, transColor3.g + largeScaleVariation * largeWeight * 0.8 + mediumScaleVariation * mediumWeight * 0.9, transColor3.b + mediumScaleVariation * mediumWeight * 0.8 + smallScaleVariation * smallWeight * 0.9);
      if (height > this.minHeight + 15) { const factor = (height - (this.minHeight + 15)) / 3.0; const eased = smootherStep(factor); color.copy(adjustedTransColor3); }
      else if (height > this.minHeight + 12) { const factor = (height - (this.minHeight + 12)) / 3.0; const eased = smootherStep(factor); color.copy(adjustedTransColor2).lerp(adjustedTransColor3, eased); }
      else if (height > this.minHeight + 9) { const factor = (height - (this.minHeight + 9)) / 3.0; const eased = smootherStep(factor); color.copy(adjustedTransColor1).lerp(adjustedTransColor2, eased); }
      else if (height > this.minHeight + 6) { const factor = (height - (this.minHeight + 6)) / 3.0; const eased = smootherStep(factor); const interBlend = new THREE.Color().copy(adjustedValleyColor).lerp(adjustedTransColor1, 0.5); color.copy(interBlend).lerp(adjustedTransColor1, eased); }
      else if (height > this.minHeight + 3) { const factor = (height - (this.minHeight + 3)) / 3.0; const eased = smootherStep(factor); color.copy(adjustedValleyColor).lerp(adjustedValleyColor.clone().lerp(adjustedTransColor1, 0.3), eased); }
      else { color.copy(adjustedValleyColor); }
      const coastDir = Math.sin(x * 0.0008 + z * 0.0015) * 0.5 + 0.5;
      const microNoiseFreq1 = 0.2 + depthFactor * 0.1 + coastDir * 0.1;
      const microNoiseFreq2 = 0.4 + (1.0 - depthFactor) * 0.3;
      const edgeNoise1 = this.fractalNoise(x * microNoiseFreq1 + this.seed * 95, z * microNoiseFreq1 + this.seed * 97, 3, 0.6, 2.0) * 0.04;
      const edgeNoise2 = this.fractalNoise(x * microNoiseFreq2 + this.seed * 123, z * microNoiseFreq2 + this.seed * 129, 2, 0.5, 2.0) * 0.03;
      const edgeFactor = Math.pow(Math.sin(Math.PI * depthFactor), 2);
      color.r += edgeNoise1 * (0.9 + 0.2 * depthFactor) + edgeNoise2 * edgeFactor * 0.7;
      color.g += edgeNoise1 * (1.0 + 0.1 * depthFactor) + edgeNoise2 * edgeFactor * 1.2;
      color.b += edgeNoise1 * (0.7 - 0.1 * depthFactor) + edgeNoise2 * edgeFactor * 0.8;
      const streakNoise = this.fractalNoise(x * 0.03 * (1.0 + coastDir * 0.5) + this.seed * 159, z * 0.03 * (1.0 - coastDir * 0.4) + this.seed * 167, 2, 0.7, 1.8) * 0.03;
      if (height > this.minHeight + 6) { const streakFactor = (height - (this.minHeight + 6)) / 12.0; color.lerp(new THREE.Color(color.r + streakNoise * 0.4, color.g + streakNoise * 0.7, color.b + streakNoise * 0.3), streakFactor * 0.5); }
    } else if (height < this.minHeight + 50) {
      const transitionProgress = (height - this.minHeight - 18) / 32;
      const smootherStep = x => { const clamped = Math.max(0, Math.min(1, x)); return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10); };
      const logisticCurve = x => { const clamped = Math.max(0, Math.min(1, x)); return 1.0 / (1.0 + Math.exp(-10 * (clamped - 0.5))); };
      const blendFactor = Math.sin(transitionProgress * Math.PI) * 0.5 + 0.5;
      const easing1 = smootherStep(transitionProgress); const easing2 = logisticCurve(transitionProgress);
      const blendedEasing = easing1 * (1.0 - blendFactor * 0.5) + easing2 * (blendFactor * 0.5);
      const enhancedTransition = blendedEasing + 0.04 * Math.sin(transitionProgress * Math.PI * 3) * (1 - Math.abs(transitionProgress - 0.5) * 2);
      const smoothTransition = Math.max(0, Math.min(1, enhancedTransition));
      let baseColor;
      if (smoothTransition < 0.2) { const zoneProgress = smoothTransition / 0.2; const sandyColor = new THREE.Color(0x9dbc88); const sandySoilColor = new THREE.Color(0x8eb87d); baseColor = new THREE.Color().copy(sandyColor).lerp(sandySoilColor, smootherStep(zoneProgress)); }
      else if (smoothTransition < 0.4) { const zoneProgress = (smoothTransition - 0.2) / 0.2; const sandySoilColor = new THREE.Color(0x8eb87d); const lightVegColor = new THREE.Color(0x7eb377); baseColor = new THREE.Color().copy(sandySoilColor).lerp(lightVegColor, smootherStep(zoneProgress)); }
      else if (smoothTransition < 0.6) { const zoneProgress = (smoothTransition - 0.4) / 0.2; const lightVegColor = new THREE.Color(0x7eb377); const mediumVegColor = new THREE.Color(0x67aa6b); baseColor = new THREE.Color().copy(lightVegColor).lerp(mediumVegColor, smootherStep(zoneProgress)); }
      else if (smoothTransition < 0.8) { const zoneProgress = (smoothTransition - 0.6) / 0.2; const mediumVegColor = new THREE.Color(0x67aa6b); const fullVegColor = new THREE.Color(0x4ea25f); baseColor = new THREE.Color().copy(mediumVegColor).lerp(fullVegColor, smootherStep(zoneProgress)); }
      else { const zoneProgress = (smoothTransition - 0.8) / 0.2; const fullVegColor = new THREE.Color(0x4ea25f); const richVegColor = new THREE.Color(0x389552); baseColor = new THREE.Color().copy(fullVegColor).lerp(richVegColor, smootherStep(zoneProgress)); }
      color.copy(baseColor);
      const coastDir = Math.sin(x * 0.0008 + z * 0.0015) * 0.5 + 0.5; const perpFactor = Math.cos(x * 0.0012 + z * 0.0007) * 0.5 + 0.5;
      const largeScaleNoise = this.fractalNoise(x * (0.008 + perpFactor * 0.003) + this.seed * 89, z * (0.008 + coastDir * 0.003) + this.seed * 97, 4, 0.55, 2.0) * 0.1;
      const mediumScaleNoise = this.fractalNoise(x * (0.04 + coastDir * 0.01) + this.seed * 107, z * (0.04 + perpFactor * 0.01) + this.seed * 113, 3, 0.5, 2.0) * 0.07;
      const smallScaleNoise = this.fractalNoise(x * 0.15 + this.seed * 127, z * 0.15 + this.seed * 131, 2, 0.45, 2.0) * 0.05;
      const edgeFactor = 4.0 * Math.pow(Math.min(Math.abs(smoothTransition - 0.2), Math.abs(smoothTransition - 0.4), Math.abs(smoothTransition - 0.6), Math.abs(smoothTransition - 0.8)), 2);
      const boundaryNoise = this.fractalNoise(x * 0.06 + this.seed * 151, z * 0.06 + this.seed * 157, 3, 0.6, 2.0) * 0.08 * edgeFactor;
      const vegetationFactor = Math.pow(smoothTransition, 1.2); const sandFactor = Math.pow(1.0 - smoothTransition, 1.2);
      color.r += largeScaleNoise * (sandFactor * 0.8 + vegetationFactor * 0.3) + boundaryNoise * 0.4;
      color.g += largeScaleNoise * (sandFactor * 0.6 + vegetationFactor * 0.9) + mediumScaleNoise * (sandFactor * 0.4 + vegetationFactor * 0.8) + boundaryNoise * 0.8;
      color.b += largeScaleNoise * (sandFactor * 0.4 + vegetationFactor * 0.5) + smallScaleNoise * (sandFactor * 0.3 + vegetationFactor * 0.4) + boundaryNoise * 0.5;
      const microVariation = (this.noise(x * 0.5 + this.seed * 67, z * 0.5 + this.seed * 71) * 0.5 + this.noise(x * 1.0 + this.seed * 79, z * 1.0 + this.seed * 83) * 0.5) * 0.03;
      const randomShift = this.noise(x * 0.02 + this.seed * 173, z * 0.02 + this.seed * 179) * 0.01;
      color.r += microVariation * 1.2 + randomShift; color.g += microVariation * 1.5 + randomShift * 0.8; color.b += microVariation * 0.8 + randomShift * 0.6;
      if (smoothTransition > 0.3) {
        const vegTexture = this.fractalNoise(x * 0.2 + this.seed * 191, z * 0.2 + this.seed * 197, 3, 0.6, 2.0) * 0.06 * Math.min(1.0, (smoothTransition - 0.3) / 0.3);
        const windDir = Math.sin(x * 0.003 + z * 0.001) * 0.5 + 0.5; const windStrength = Math.pow(windDir, 1.5) * vegTexture;
        color.r -= windStrength * 0.3; color.g += windStrength * 0.7; color.b -= windStrength * 0.1;
      }
    } else if (height < 120) {
      const lowBoundary = this.minHeight + 30; const highBoundary = 120; const normalizedHeight = (height - lowBoundary) / (highBoundary - lowBoundary);
      const boundaryBlend = normalizedHeight < 0.2 ? normalizedHeight * normalizedHeight * normalizedHeight * (normalizedHeight * (normalizedHeight * 6 - 15) + 10) / 0.2 : 1.0;
      const vegetationNoise = this.fractalNoise(x * 0.012 + this.seed * 71, z * 0.012 + this.seed * 73, 3, 0.5, 2.0);
      const baseTemperature = normalizedTemp + latitudeEffect * 0.3; const baseMoisture = normalizedMoisture + vegetationNoise * 0.2;
      const regionalTemp = baseTemperature + this.fractalNoise(x * 0.0005, z * 0.0005, 2, 0.5, 2.0) * 0.15;
      const regionalMoisture = baseMoisture + this.fractalNoise(x * 0.0004, z * 0.0004, 2, 0.5, 2.0) * 0.2;
      const moistureGradient = regionalMoisture + vegetationNoise * (0.15 + 0.15 * boundaryBlend);
      const forestThreshold = 0.46 - (height - lowBoundary) / (highBoundary - lowBoundary) * 0.08; const grassThreshold = 0.20 + (height - lowBoundary) / (highBoundary - lowBoundary) * 0.05;
      const forestInfluence = Math.min(1.0, Math.max(0.0, (moistureGradient - forestThreshold + 0.15) / 0.3));
      const grassInfluence = Math.min(1.0, Math.max(0.0, (moistureGradient - grassThreshold + 0.15) / 0.3));
      const isForested = forestInfluence > 0.5 && slope < 0.6; const isGrassy = grassInfluence > 0.5 || slope < 0.4;
      let forestColor, grassColor, rockColor;
      const colorNoise1 = this.fractalNoise(x * 0.03 + this.seed * 123, z * 0.03 + this.seed * 127, 3, 0.5, 2.0);
      const colorNoise2 = this.fractalNoise(x * 0.07 + this.seed * 131, z * 0.07 + this.seed * 137, 2, 0.5, 2.0);
      const colorVariation = (colorNoise1 * 0.7 + colorNoise2 * 0.3) * 0.06;
      if (regionalTemp > 0.65) { forestColor = new THREE.Color(0.2 + colorVariation * 1.2, 0.4 + colorVariation * 1.0, 0.1 + colorVariation * 0.6); }
      else if (regionalTemp > 0.35) { forestColor = new THREE.Color(0.13 + colorVariation * 0.9, 0.4 + colorVariation * 1.4, 0.13 + colorVariation * 0.9); }
      else { forestColor = new THREE.Color(0.1 + colorVariation * 0.5, 0.3 + colorVariation * 1.0, 0.15 + colorVariation * 0.6); }
      const baseGrassR = 0.55 + regionalTemp * 0.1 - regionalMoisture * 0.15; const baseGrassG = 0.55 + regionalMoisture * 0.2 - regionalTemp * 0.05; const baseGrassB = 0.25 + regionalMoisture * 0.1 - regionalTemp * 0.1;
      grassColor = new THREE.Color(baseGrassR + colorNoise1 * 0.15, baseGrassG + colorNoise1 * 0.25 + colorNoise2 * 0.1, baseGrassB + colorNoise2 * 0.15);
      const rockMoistureFactor = regionalMoisture > 0.5 ? 0.6 : 1.0; const baseRockR = 0.45 + regionalTemp * 0.15; const baseRockG = 0.42 + regionalTemp * 0.1 - regionalMoisture * 0.05; const baseRockB = 0.38 - regionalTemp * 0.05 + regionalMoisture * 0.05;
      rockColor = new THREE.Color(baseRockR * rockMoistureFactor + colorVariation * 0.8, baseRockG * rockMoistureFactor + colorVariation * 0.7, baseRockB * rockMoistureFactor + colorVariation * 0.5);
      const forestFactor = Math.min(1.0, Math.max(0.0, (forestInfluence - 0.3) / 0.6)); const forestFactorSmooth = forestFactor * forestFactor * (3 - 2 * forestFactor);
      const grassFactor = Math.min(1.0, Math.max(0.0, (grassInfluence - 0.2) / 0.6)); const grassFactorSmooth = grassFactor * grassFactor * (3 - 2 * grassFactor);
      const slopeFactor = Math.max(0.0, Math.min(1.0, (slope - 0.2) / 0.5)); const slopeFactorSmooth = slopeFactor * slopeFactor * (3 - 2 * slopeFactor);
      const baseColor = new THREE.Color(); baseColor.copy(grassColor);
      if (forestFactorSmooth > 0.1 && slopeFactorSmooth < 0.8) { const forestBlendStrength = forestFactorSmooth * (1.0 - slopeFactorSmooth * 0.8); baseColor.lerp(forestColor, forestBlendStrength); }
      if (slopeFactorSmooth > 0.2) { const rockBlendStrength = slopeFactorSmooth * 0.8; baseColor.lerp(rockColor, rockBlendStrength); }
      color.copy(baseColor);
      if (slope > 0.3) { const slopeProgress = Math.min(1.0, (slope - 0.3) / 0.7); const slopeFactor = slopeProgress * slopeProgress * (3 - 2 * slopeProgress); color.multiplyScalar(0.95 - slopeFactor * 0.25); }
      const textureNoise1 = this.fractalNoise(x * 0.008 + this.seed * 191, z * 0.008 + this.seed * 193, 3, 0.5, 2.0) * 0.05;
      const textureNoise2 = this.fractalNoise(x * 0.05 + this.seed * 211, z * 0.05 + this.seed * 223, 2, 0.5, 2.0) * 0.03;
      const textureNoise3 = this.fractalNoise(x * 0.2 + this.seed * 233, z * 0.2 + this.seed * 239, 1, 0.5, 2.0) * 0.02;
      color.r += textureNoise1 * 0.9 + textureNoise2 * 0.4 + textureNoise3 * 0.2; color.g += textureNoise1 * 0.7 + textureNoise2 * 0.6 + textureNoise3 * 0.3; color.b += textureNoise1 * 0.5 + textureNoise2 * 0.4 + textureNoise3 * 0.1;
      const heightBand = (Math.sin(height * 0.1) * 0.5 + 0.5) * 0.02; color.r += heightBand * 0.7; color.g += heightBand * 0.9;
      const regionalVariation = this.fractalNoise(x * 0.0008 + this.seed * 241, z * 0.0008 + this.seed * 251, 2, 0.5, 2.0) * 0.03; color.multiplyScalar(1.0 + regionalVariation);
    } else if (height < 340) {
      const hillsMountainBoundary = 120; const mountainHeight = 340; const transitionWidth = 30;
      let boundarySmoothFactor = 0; if (height < hillsMountainBoundary + transitionWidth) { const transitionProgress = (height - hillsMountainBoundary) / transitionWidth; boundarySmoothFactor = 1.0 - (transitionProgress * transitionProgress * (3 - 2 * transitionProgress)); }
      let baseRockColor; const rockTypeNoise = this.fractalNoise(x * 0.001 + this.seed * 63, z * 0.001 + this.seed * 67, 3, 0.5, 2.0) * 0.15; const adjustedTemp = normalizedTemp + rockTypeNoise;
      if (adjustedTemp > 0.6) { baseRockColor = new THREE.Color(0.48 + this.fractalNoise(x * 0.05, z * 0.05, 2, 0.5, 2.0) * 0.06, 0.38 + this.fractalNoise(x * 0.07, z * 0.07, 2, 0.5, 2.0) * 0.05, 0.32 + this.fractalNoise(x * 0.09, z * 0.09, 2, 0.5, 2.0) * 0.04); }
      else if (adjustedTemp > 0.3) { baseRockColor = new THREE.Color(0.42 + this.fractalNoise(x * 0.06, z * 0.06, 2, 0.5, 2.0) * 0.06, 0.38 + this.fractalNoise(x * 0.08, z * 0.08, 2, 0.5, 2.0) * 0.06, 0.35 + this.fractalNoise(x * 0.1, z * 0.1, 2, 0.5, 2.0) * 0.05); }
      else { baseRockColor = new THREE.Color(0.38 + this.fractalNoise(x * 0.07, z * 0.07, 2, 0.5, 2.0) * 0.05, 0.38 + this.fractalNoise(x * 0.09, z * 0.09, 2, 0.5, 2.0) * 0.05, 0.4 + this.fractalNoise(x * 0.11, z * 0.11, 2, 0.5, 2.0) * 0.06); }
      const normalizedMountainHeight = (height - hillsMountainBoundary) / (mountainHeight - hillsMountainBoundary); const gradientCurve = Math.pow(normalizedMountainHeight, 0.7);
      const darkRock = new THREE.Color(0.28, 0.28, 0.3);
      if (boundarySmoothFactor > 0) {
        const vegetationNoise = this.fractalNoise(x * 0.015 + this.seed * 71, z * 0.015 + this.seed * 73, 3, 0.5, 2.0); const moistureGradient = normalizedMoisture + vegetationNoise * 0.3; let hillColor;
        if (moistureGradient > 0.5 && slope < 0.5) { if (normalizedTemp > 0.7) { hillColor = new THREE.Color(0.2, 0.4, 0.1); } else if (normalizedTemp > 0.4) { hillColor = new THREE.Color(0.13, 0.4, 0.13); } else { hillColor = new THREE.Color(0.1, 0.3, 0.15); } }
        else if (moistureGradient > 0.25 || slope < 0.4) { hillColor = new THREE.Color(0.55 + vegetationNoise * 0.15, 0.55 + vegetationNoise * 0.25, 0.25 + vegetationNoise * 0.15); }
        else { hillColor = normalizedMoisture > 0.5 ? new THREE.Color(0.35, 0.35, 0.3) : new THREE.Color(0.55, 0.5, 0.4); }
        const baseColor = new THREE.Color().copy(hillColor).lerp(baseRockColor, 1 - boundarySmoothFactor * 0.7); color.copy(baseColor).lerp(darkRock, gradientCurve * 0.7 * (1 - boundarySmoothFactor * 0.5));
      } else { color.copy(baseRockColor).lerp(darkRock, gradientCurve * 0.7); }
      const largeStriation = Math.abs(this.fractalNoise(x * 0.03 + this.seed * 15, z * 0.03 + this.seed * 16, 3, 0.5, 2.0)); const mediumStriation = Math.abs(this.fractalNoise(x * 0.08 + this.seed * 23, z * 0.08 + this.seed * 24, 2, 0.5, 2.0)); const smallStriation = Math.abs(this.fractalNoise(x * 0.2 + this.seed * 31, z * 0.2 + this.seed * 32, 1, 0.5, 2.0));
      const largeWeight = 0.6 - gradientCurve * 0.2; const mediumWeight = 0.3 + gradientCurve * 0.1; const smallWeight = 0.1 + gradientCurve * 0.1;
      const striation = largeStriation * largeWeight + mediumStriation * mediumWeight + smallStriation * smallWeight;
      const striationStrength = 0.15 * (1.0 + 0.2 * Math.sin(height * 0.02)); color.r += striation * striationStrength - 0.05; color.g += striation * striationStrength - 0.05; color.b += striation * striationStrength - 0.05;
      if (height > 240) {
        const largeSnowNoise = this.fractalNoise(x * 0.04 + this.seed * 17, z * 0.04 + this.seed * 18, 3, 0.5, 2.0); const mediumSnowNoise = this.fractalNoise(x * 0.1 + this.seed * 25, z * 0.1 + this.seed * 26, 2, 0.5, 2.0); const smallSnowNoise = this.fractalNoise(x * 0.25 + this.seed * 33, z * 0.25 + this.seed * 34, 1, 0.5, 2.0);
        const snowNoiseStrength = 0.4 + 0.2 * ((height - 240) / 100); const combinedSnowNoise = largeSnowNoise * 0.5 + mediumSnowNoise * 0.3 + smallSnowNoise * 0.2;
        const slopeInfluence = Math.pow(Math.max(0, 1 - slope * 3.5), 1.5); const temperatureEffect = normalizedTemp * 15; const adjustedSnowLine = 240 + temperatureEffect;
        const transitionRange = 70 + temperatureEffect * 0.5; const snowProgress = Math.max(0, (height - adjustedSnowLine) / transitionRange);
        const snowTransition = snowProgress < 1 ? snowProgress * snowProgress * snowProgress * (snowProgress * (snowProgress * 6 - 15) + 10) : 1.0;
        const snowAmount = snowTransition * slopeInfluence + combinedSnowNoise * snowNoiseStrength * snowTransition;
        if (snowAmount > 0) {
          const blueSnowTint = Math.min(1, (height - 240) / 200) * 0.05; const snowColor = new THREE.Color(0.92, 0.92, 0.97 + blueSnowTint);
          if (snowAmount < 0.2) { const dustFactor = snowAmount / 0.2; color.lerp(snowColor, dustFactor * 0.3); } else { color.lerp(snowColor, Math.min(snowAmount, 1)); }
        }
      }
    } else {
      color.setRGB(0.6, 0.6, 0.6);
    }
    color.r = Math.max(0, Math.min(1, color.r)); color.g = Math.max(0, Math.min(1, color.g)); color.b = Math.max(0, Math.min(1, color.b));
    return color;
  }

  // --- createChunkGeometry method (refactored version) remains unchanged ---
  createChunkGeometry(startX, startZ) {
    const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, this.terrainResolution, this.terrainResolution);
    geometry.rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position.array;
    const colors = [];
    for (let i = 0; i < vertices.length; i += 3) {
      const localX = vertices[i]; const localZ = vertices[i + 2];
      const worldX = localX + startX; const worldZ = localZ + startZ;
      const height = this.getTerrainHeight(worldX, worldZ);
      const deterministicNoise = Math.sin(worldX * 0.1) * Math.cos(worldZ * 0.1) * 0.01;
      const finalHeight = height + deterministicNoise;
      vertices[i + 1] = finalHeight;
      const color = this.getBiomeColor(finalHeight, worldX, worldZ);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.computeSmoothedNormals(geometry, startX, startZ);
    return geometry;
  }

  createInitialTerrain() {
    console.log("Creating initial terrain...");
    // Increased initial terrain area to reduce visible terrain loading
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
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
            mesh.renderOrder = 0;
            this.scene.add(mesh);
            this.currentChunks.set(key, mesh);
          } catch (error) {
            console.error("Error creating chunk:", error);
          }
        }
      }
    }
    
    // Pre-cache some terrain heights to improve initial performance
    const chunkSize = this.chunkSize;
    const resolution = this.terrainResolution;
    
    // Pre-calculate some heights for nearby terrain
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const startX = x * chunkSize;
        const startZ = z * chunkSize;
        
        // Sample some points in each chunk for the height cache
        for (let i = 0; i <= resolution; i += 4) {
          for (let j = 0; j <= resolution; j += 4) {
            const worldX = startX + (i / resolution) * chunkSize;
            const worldZ = startZ + (j / resolution) * chunkSize;
            this.getTerrainHeight(worldX, worldZ);
          }
        }
      }
    }
  }

  // --- createManaNodes method remains unchanged ---
  createManaNodes() {
    this.manaNodes.forEach(node => { if (node.parent) { this.scene.remove(node); } });
    this.manaNodes = [];
    const player = this.engine.systems.player?.localPlayer; if (!player) return;
    const nodeCount = 30; const spawnRadius = this.chunkSize * 5;
    for (let i = 0; i < nodeCount; i++) {
      const angle = Math.random() * Math.PI * 2; const distance = Math.random() * spawnRadius;
      const x = player.position.x + Math.cos(angle) * distance; const z = player.position.z + Math.sin(angle) * distance;
      const terrainHeight = this.getTerrainHeight(x, z); const y = terrainHeight + 30; // Further increased height for better accessibility
      const nodeMesh = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 16), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.7, transparent: true, opacity: 0.8 })); // Increased size
      const glowMesh = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3, side: THREE.BackSide })); // Increased size
      nodeMesh.add(glowMesh);
      nodeMesh.position.set(x, y, z);
      nodeMesh.userData = { type: 'mana', value: 10 + Math.floor(Math.random() * 20), collected: false };
      this.manaNodes.push(nodeMesh); this.scene.add(nodeMesh);
    }
  }

  // --- isPositionSuitableForLandmark method remains unchanged ---
  isPositionSuitableForLandmark(x, z, landmarkType) {
    const height = this.getTerrainHeight(x, z);
    if (height < landmarkType.minHeight || height > landmarkType.maxHeight) { return false; }
    const slope = this.calculateSlope(x, z);
    if (slope > landmarkType.maxSlope) { return false; }
    for (const [key, landmark] of this.landmarks.entries()) {
      if (landmark.type === landmarkType.name) {
        const dx = landmark.position.x - x; const dz = landmark.position.z - z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance < landmarkType.minDistance) { return false; }
      }
    }
    if (landmarkType.requiresWater) { return false; }
    return true;
  }

  // --- _addToHeightCache method remains unchanged ---
  _addToHeightCache(key, value) {
    if (this.heightCache.size >= this.maxCacheSize) {
      const keysToRemove = Math.floor(this.maxCacheSize * 0.1);
      const keys = [...this.heightCache.keys()];
      for (let i = 0; i < keysToRemove; i++) { this.heightCache.delete(keys[i]); }
    }
    this.heightCache.set(key, value);
  }

  // --- getCacheStats method remains unchanged ---
  getCacheStats() {
    const hitRate = this.cacheHits / (this.cacheHits + this.cacheMisses || 1) * 100;
    return { size: this.heightCache.size, hits: this.cacheHits, misses: this.cacheMisses, hitRate: `${hitRate.toFixed(1)}%`, memorySizeEstimate: `~${(this.heightCache.size * 16 / 1024).toFixed(1)} KB` };
  }

  // --- clearHeightCache method remains unchanged ---
  clearHeightCache() {
    this.heightCache.clear(); this.cacheHits = 0; this.cacheMisses = 0;
    console.log("Terrain height cache cleared");
  }

  // --- computeSmoothedNormals method remains unchanged ---
  computeSmoothedNormals(geometry, startX, startZ) {
    const positions = geometry.attributes.position; const vertexCount = positions.count;
    const tempNormals = Array.from({ length: vertexCount }, () => new THREE.Vector3());
    const indices = geometry.index ? geometry.index.array : null;
    const triangleCount = indices ? indices.length / 3 : vertexCount / 3;
    const pA = new THREE.Vector3(); const pB = new THREE.Vector3(); const pC = new THREE.Vector3();
    const cb = new THREE.Vector3(); const ab = new THREE.Vector3(); const normal = new THREE.Vector3();
    for (let i = 0; i < triangleCount; i++) {
      let vA_idx, vB_idx, vC_idx;
      if (indices) { vA_idx = indices[i * 3]; vB_idx = indices[i * 3 + 1]; vC_idx = indices[i * 3 + 2]; }
      else { vA_idx = i * 3; vB_idx = i * 3 + 1; vC_idx = i * 3 + 2; }
      pA.fromBufferAttribute(positions, vA_idx); pB.fromBufferAttribute(positions, vB_idx); pC.fromBufferAttribute(positions, vC_idx);
      cb.subVectors(pC, pB); ab.subVectors(pA, pB); normal.crossVectors(cb, ab);
      if (tempNormals[vA_idx]) tempNormals[vA_idx].add(normal); if (tempNormals[vB_idx]) tempNormals[vB_idx].add(normal); if (tempNormals[vC_idx]) tempNormals[vC_idx].add(normal);
    }
    const worldCoords = new Map();
    for (let i = 0; i < vertexCount; i++) {
      const worldX = positions.getX(i) + startX; const worldY = positions.getY(i); const worldZ = positions.getZ(i) + startZ;
      worldCoords.set(i, { x: worldX, y: worldY, z: worldZ });
      if (tempNormals[i] && tempNormals[i].lengthSq() > 0.0001) { tempNormals[i].normalize(); }
      else if (tempNormals[i]) { tempNormals[i].set(0, 1, 0); }
    }
    const problematicVertices = new Set();
    for (let i = 0; i < vertexCount; i++) {
      const worldY = worldCoords.get(i).y; const normalY = tempNormals[i].y;
      if (worldY > 300 && normalY < 0.3) { problematicVertices.add(i); }
    }
    const smoothedNormal = new THREE.Vector3(); const upNormal = new THREE.Vector3(0, 1, 0);
    for (const vertexIndex of problematicVertices) {
      const neighbors = new Set();
      for (let i = 0; i < triangleCount; i++) {
        let vA_idx, vB_idx, vC_idx;
        if (indices) { vA_idx = indices[i * 3]; vB_idx = indices[i * 3 + 1]; vC_idx = indices[i * 3 + 2]; }
        else { vA_idx = i * 3; vB_idx = i * 3 + 1; vC_idx = i * 3 + 2; }
        if (vA_idx === vertexIndex || vB_idx === vertexIndex || vC_idx === vertexIndex) { neighbors.add(vA_idx); neighbors.add(vB_idx); neighbors.add(vC_idx); }
      }
      smoothedNormal.set(0, 0, 0); let validNeighbors = 0;
      for (const neighborIndex of neighbors) { if (tempNormals[neighborIndex] && !isNaN(tempNormals[neighborIndex].x)) { smoothedNormal.add(tempNormals[neighborIndex]); validNeighbors++; } }
      if (validNeighbors > 0 && smoothedNormal.lengthSq() > 0.0001) {
        smoothedNormal.normalize(); const worldY = worldCoords.get(vertexIndex).y; let blendFactor = 0.1;
        if (worldY > 300) { blendFactor += Math.min(0.4, (worldY - 300) / 150 * 0.4); } blendFactor = Math.min(blendFactor, 0.5);
        tempNormals[vertexIndex].copy(smoothedNormal).lerp(upNormal, blendFactor).normalize();
        if (worldY > 340 && tempNormals[vertexIndex].y < 0.05) { tempNormals[vertexIndex].y = 0.05; tempNormals[vertexIndex].normalize(); }
      }
    }
    const normalArray = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      if (tempNormals[i] && !isNaN(tempNormals[i].x) && tempNormals[i].lengthSq() > 0.0001) { tempNormals[i].normalize(); }
      else if (tempNormals[i]) { tempNormals[i].set(0, 1, 0); }
      else { tempNormals[i] = new THREE.Vector3(0, 1, 0); }
      normalArray[i * 3] = tempNormals[i].x; normalArray[i * 3 + 1] = tempNormals[i].y; normalArray[i * 3 + 2] = tempNormals[i].z;
    }
    geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
  }

  // --- Landmark creation methods (createLandmark, createAncientRuins, etc.) remain unchanged ---
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
  

  }}

  updateChunks() {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    // Get camera for frustum culling
    const camera = this.engine.camera;
    if (!camera) return;

    // Updated: Use MobileLODManager view distance if available for determining chunks to keep
    let viewDistance = this.viewDistance;
    if (this.engine.systems.mobileLOD && this.engine.settings && this.engine.settings.isMobile) {
      // Get extended view distance for horizon for better terrain continuity
      const horizonExtendedDistance = Math.ceil(this.engine.systems.mobileLOD.getHorizonLODDistance() / this.chunkSize);
      viewDistance = Math.max(viewDistance, horizonExtendedDistance / this.chunkSize);
    }
    
    // Calculate current chunk
    const playerChunkX = Math.floor(player.position.x / this.chunkSize);
    const playerChunkZ = Math.floor(player.position.z / this.chunkSize);
    
    // Keep track of chunks that are now in view range
    const chunksToKeep = new Set();
    
    // Create camera projection matrix for frustum culling
    this._cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._cameraViewProjectionMatrix);
    
    // Generate chunks within view distance
    for (let x = -viewDistance; x <= viewDistance; x++) {
      for (let z = -viewDistance; z <= viewDistance; z++) {
        const distanceSquared = x * x + z * z;
        if (distanceSquared <= viewDistance * viewDistance) {
          const chunkX = playerChunkX + x;
          const chunkZ = playerChunkZ + z;
          const startX = chunkX * this.chunkSize;
          const startZ = chunkZ * this.chunkSize;
          const key = `${startX},${startZ}`;
          
          chunksToKeep.add(key);
          
          if (!this.currentChunks.has(key)) {
            // Check if chunk would be visible (frustum culling)
            const chunkCenter = new THREE.Vector3(
              startX + this.chunkSize / 2,
              0, // Use estimated height
              startZ + this.chunkSize / 2
            );
            
            // Get estimated terrain height at center for better frustum culling
            chunkCenter.y = this.getTerrainHeight(chunkCenter.x, chunkCenter.z);
            
            // Create bounding sphere for chunk
            const boundingSphere = new THREE.Sphere(chunkCenter, this.chunkSize * 0.75);
            
            // Skip chunk creation if definitely not visible
            const distanceToCamera = chunkCenter.distanceTo(camera.position);
            const isFarAway = distanceToCamera > this.chunkSize * viewDistance * 1.5;
            
            // Special handling for horizon chunks
            const horizonAngle = Math.atan2(
              chunkCenter.y - camera.position.y,
              Math.sqrt(
                Math.pow(chunkCenter.x - camera.position.x, 2) +
                Math.pow(chunkCenter.z - camera.position.z, 2)
              )
            );
            const isNearHorizon = Math.abs(horizonAngle) < 0.15; // ~8.6 degrees
            
            // If far away and not on horizon, apply stricter culling
            if (isFarAway && !isNearHorizon && !this._frustum.intersectsSphere(boundingSphere)) {
              continue; // Skip creation of definitely invisible chunks
            }
            
            try {
              const geometry = this.createChunkGeometry(startX, startZ);
              const material = this.materials.terrain;
              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.set(startX, 0, startZ);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.renderOrder = 0;
              this.scene.add(mesh);
              this.currentChunks.set(key, mesh);
              // LOG: InfiniteWorldDebug - Chunk created
              // console.info(`[InfiniteWorldDebug] Created chunk at (${chunkX}, ${chunkZ}) [key=${key}]`);
            } catch (error) {
              console.error(`Error creating terrain chunk at ${startX},${startZ}:`, error);
            }
          }
        }
      }
    }
    
    // Remove chunks that are no longer in view range
    for (const [key, mesh] of this.currentChunks.entries()) {
      if (!chunksToKeep.has(key)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        // LOG: InfiniteWorldDebug - Chunk removed
        // console.info(`[InfiniteWorldDebug] Removed chunk at [key=${key}]`);
        this.currentChunks.delete(key);
      }
    }
  }

  // --- updateVisibility method remains unchanged ---
  updateVisibility(camera) { /* ... */ }

  update(delta, elapsed) {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    // Check if we need more mana nodes
    if (this.manaNodes.filter(node => node.userData && !node.userData.collected).length < 10) {
      this.createManaNodes();
    }

    // Update terrain chunks
    this.updateChunks();

    // Update landmarks
    this.updateLandmarks(delta, elapsed);

    // Animate mana nodes
    this.manaNodes.forEach((node, index) => {
      if (node.userData && !node.userData.collected) {
        node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.03;
        node.rotation.y += delta * 0.5;
      }
    });
  }

  // --- checkManaCollection method remains unchanged ---
  checkManaCollection(position, radius) {
    const collectedNodes = [];
    this.manaNodes.forEach((node) => {
      if (node.userData && !node.userData.collected) {
        const distance = position.distanceTo(node.position);
        if (distance < radius + 2) {
          node.userData.collected = true; node.visible = false;
          collectedNodes.push({ position: node.position.clone(), value: node.userData.value || 10, });
        }
      }
    });
    return collectedNodes;
  }
}