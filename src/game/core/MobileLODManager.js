import * as THREE from "three";
import { deviceCapabilities } from "./utils/DeviceCapabilities";

/**
 * MobileLODManager
 * 
 * Manages Level of Detail (LOD) settings specifically for mobile devices.
 * This centralized approach ensures consistent LOD policies across all systems
 * and provides dynamic adjustment based on performance metrics.
 */
export class MobileLODManager {
  constructor(engine) {
    this.engine = engine;
    this.isMobile = deviceCapabilities.isMobile;
    
    // Base LOD distances that will be scaled based on device performance
    this.baseLODDistances = {
      terrain: {
        high: 1500, // Use high detail up to this distance
        medium: 3000, // Use medium detail up to this distance
        low: 6000 // Use low detail up to this distance (beyond = ultra-low)
      },
      vegetation: {
        high: 150, // Use high detail up to this distance
        medium: 400, // Use medium detail up to this distance
        low: 900 // Use low detail up to this distance (beyond = culled)
      },
      water: {
        reflection: 2000, // Max distance for reflections
        highDetail: 1000, // Use high detail water effects within this distance
        mediumDetail: 3000 // Use medium detail water effects within this distance
      }
    };

      // Increase minimum scaling factor for water
  this.minWaterScalingFactor = 0.7; // New property for water-specific scaling

    
    // Scaling factors to apply to LOD distances based on device performance
    // More powerful devices can use higher detail at greater distances
    this.distanceScalingFactor = 1.0;
    
    // Mobile-specific scaling (reduced distances = earlier LOD transitions)
    if (this.isMobile) {
      this.distanceScalingFactor = 0.5; // Start with 50% of standard distances
    }
    
    // Performance tracking for dynamic adjustment
    this.lastAdjustmentTime = 0;
    this.adjustmentInterval = 5000; // Check every 5 seconds
    this.targetFPS = 60; // Target framerate for mobile


    // Quality level state variables for hysteresis
    this.qualityLevel = this.isMobile ? 1 : 2; // 0=Low, 1=Medium, 2=High
    this.timeAtCurrentQuality = 0; // Time spent at current quality level in ms
    this.lastQualityChangeTime = 0; // When the last quality change occurred
    
    // Hysteresis thresholds - minimum time at a quality level before changing
    this.minTimeBeforeIncrease = 10000; // 10 seconds before increasing quality
    this.minTimeBeforeDecrease = 5000; // 5 seconds before decreasing quality
    
    this.currentTerrainLOD = "adaptive"; // Default is adaptive LOD for terrain
    this.currentVegetationDensity = 0.7; // Start with reduced vegetation density on mobile
    this.currentWaterReflectionEnabled = true; // Start with reflections enabled
    
    // Triangle count thresholds
    this.triangleThresholds = {
    critical: 100000,  // Increased from 50000
    high: 80000,      // Increased from 40000
    medium: 60000,    // Increased from 30000
    low: 40000        // Increased from 20000
    };
    
    // FPS thresholds relative to target
    this.fpsThresholds = {
      critical: 0.4,    // Changed from 0.7 to 0.4
      low: 0.6,        // Changed from 0.9 to 0.6
      target: 1.0,     // Kept the same
      good: 1.1,       // Changed from 1.2 to 1.1
      excellent: 1.3   // Changed from 1.5 to 1.3
    };
    
    // Flags to track enabled optimizations
    this.optimizations = {
      aggressiveDistanceCulling: this.isMobile, // Enable by default on mobile
      reduced3DTextures: this.isMobile, // Reduce texture sizes on mobile
      simplifiedShadows: this.isMobile, // Use simpler shadows on mobile
      dynamicResolutionScaling: this.isMobile // Enable dynamic resolution on mobile
    };
    
    // Benchmark variables
    this.initialBenchmarkComplete = false;
    this.benchmarkStartTime = 0;
    this.benchmarkDuration = 2000; // 2 seconds of benchmark
    this.benchmarkFpsSamples = [];
    
    // Reference to current LOD settings (to avoid frequent recalculations)
    this.cachedLODDistances = null;
    this.updateLODSettings();
    // Add frame timing tracking
    this.frameTimings = new Array(60).fill(16.67); // Target 60fps
    this.frameIndex = 0;
    
    // Adjust quality thresholds
    this.qualityThresholds = {
      low: { fps: 30, triangles: 50000 },
      medium: { fps: 60, triangles: 75000 },
      high: { fps: 120, triangles: 150000 }
    };
  }
  
  /**
   * Initialize the manager
   */
  async initialize() {
    console.log("Initializing MobileLODManager...");
    
    // Detect device capabilities beyond just mobile/desktop classification
    this.detectDeviceCapabilities();
    
    // Apply initial optimizations based on device type
    this.applyInitialOptimizations();
    
    // Run a short initial benchmark if mobile
    if (this.isMobile) {
      console.log("Starting initial FPS benchmark for better LOD calibration...");
      this.benchmarkStartTime = Date.now();
    }
    
    console.log("MobileLODManager initialized");
    return true;
  }
  
  /**
   * Update method called every frame
   */
  update(deltaTime) {
    // Skip if not on mobile
    if (!this.isMobile) return;
    
    // Run initial benchmark if not completed yet
    if (!this.initialBenchmarkComplete) {
      const benchmarkElapsed = Date.now() - this.benchmarkStartTime;
      if (benchmarkElapsed < this.benchmarkDuration) {
        // During benchmark, collect FPS samples
        const report = this.engine.performanceMonitor.generateReport();
        this.benchmarkFpsSamples.push(report.current.fps);
      } else {
        // Benchmark complete, apply findings
        this.finalizeInitialBenchmark();
      }
    }
    
    // Increment time at current quality level
    this.timeAtCurrentQuality += deltaTime * 1000; // Convert to ms
    
    // Periodically check if we need to adjust LOD settings
    const now = Date.now();
    if (now - this.lastAdjustmentTime > this.adjustmentInterval) {
      this.dynamicallyAdjustLOD();
      this.lastAdjustmentTime = now;
    }
  }
  
  /**
   * Finalize the initial benchmark and use data to tune LOD settings
   */
  finalizeInitialBenchmark() {
    if (this.benchmarkFpsSamples.length === 0) {
      console.log("Benchmark completed but no samples collected. Using default settings.");
      this.initialBenchmarkComplete = true;
      return;
    }
    
    // Calculate average FPS from benchmark
    const benchmarkFps = this.benchmarkFpsSamples.reduce((sum, fps) => sum + fps, 0) / this.benchmarkFpsSamples.length;
    console.log(`Initial benchmark results: Average FPS = ${benchmarkFps.toFixed(1)}`);
    
    // Tune scaling factor based on initial performance
    if (benchmarkFps < this.targetFPS * 0.8) {
      // Poor initial performance, reduce scaling factor
      this.distanceScalingFactor = Math.max(0.3, this.distanceScalingFactor * 0.8);
      this.qualityLevel = 0; // Start at low quality
      console.log(`Benchmark indicates lower-end device. Reducing scaling to ${this.distanceScalingFactor.toFixed(2)} and starting at low quality.`);
    } else if (benchmarkFps > this.targetFPS * 1.5) {
      // Excellent initial performance, increase scaling factor
      this.distanceScalingFactor = Math.min(0.8, this.distanceScalingFactor * 1.2);
      this.qualityLevel = 2; // Start at high quality
      console.log(`Benchmark indicates higher-end device. Increasing scaling to ${this.distanceScalingFactor.toFixed(2)} and starting at high quality.`);
    } else {
      // Acceptable initial performance
      this.qualityLevel = 1; // Start at medium quality
      console.log(`Benchmark indicates mid-range device. Maintaining scaling at ${this.distanceScalingFactor.toFixed(2)} and starting at medium quality.`);
    }
    
    // Apply the updated settings
    this.updateQualityBasedOnLevel();
    this.updateLODSettings();
    
    this.initialBenchmarkComplete = true;
    this.lastQualityChangeTime = Date.now();
  }
  
  /**
   * Initialize device capabilities using the centralized detection
   */
  detectDeviceCapabilities() {
    // Only run detailed detection on mobile
    if (!this.isMobile) return;
    
    console.log("Using centralized device capabilities data");
    
    // Get device info from centralized detection
    const gpuTier = deviceCapabilities.gpuTier;
    const memoryLimited = deviceCapabilities.memoryLimited;
    const pixelRatio = deviceCapabilities.pixelRatio;
    
    // Adjust distance scaling based on detected capabilities
    if (gpuTier === 'high') {
      this.distanceScalingFactor = Math.min(0.8, this.distanceScalingFactor * 1.2);
    } else if (gpuTier === 'low') {
      this.distanceScalingFactor = Math.max(0.3, this.distanceScalingFactor * 0.8);
    }
    
    console.log(`Using device capabilities: GPU Tier: ${gpuTier}, Memory Limited: ${memoryLimited}`);
    console.log(`Adjusted distance scaling factor: ${this.distanceScalingFactor.toFixed(2)}`);
  }
  

  updateFrameTiming(deltaTime) {
    this.frameTimings[this.frameIndex] = deltaTime * 1000; // Convert to ms
    this.frameIndex = (this.frameIndex + 1) % this.frameTimings.length;
  }

  getAverageFrameTime() {
    return this.frameTimings.reduce((a, b) => a + b) / this.frameTimings.length;
  }


  /**
   * Apply initial optimizations based on device type
   */
  applyInitialOptimizations() {
    if (!this.isMobile) return;
    
    // Set renderer pixel ratio
    if (this.engine.renderer) {
      const optimalPixelRatio = Math.min(window.devicePixelRatio, 2);
      this.engine.renderer.setPixelRatio(optimalPixelRatio * 0.8);
      
      // Reduce shadow map size on mobile
      if (this.engine.renderer.shadowMap) {
        this.engine.renderer.shadowMap.type = THREE.BasicShadowMap;
      }
    }
    
    // Adjust camera frustum for mobile
    if (this.engine.camera) {
      // Increase FOV slightly for mobile to prevent sharp cutoffs
      this.engine.camera.fov = Math.min(75, this.engine.camera.fov + 5);
      
      // Extend far plane for better horizon visibility
      this.engine.camera.far = 25000; // Increased from default
      
      // Adjust near plane to help with precision
      this.engine.camera.near = 1;
      
      // Update projection matrix to apply changes
      this.engine.camera.updateProjectionMatrix();
    }
    
    // Adjust world view distance
    if (this.engine.systems.world) {
      // Increase view distance slightly to match camera far plane
      this.engine.systems.world.viewDistance = 6;
    }
    
    // Apply optimizations to vegetation
    if (this.engine.systems.vegetation) {
      const vegSystem = this.engine.systems.vegetation;
      vegSystem.densityScale = this.currentVegetationDensity;
      vegSystem.lodDistances = this.getLODDistances().vegetation;
    }
  }

  // Enhanced method for horizon-specific LOD
getHorizonLODDistance() {
  return this.baseLODDistances.terrain.low * 1.8; // Significantly extend horizon distance
}
  /**
   * Get current LOD distances based on scaling factor
   * @returns {Object} LOD distances for all systems
   */
  getLODDistances() {
    // Use cached value if available
    if (this.cachedLODDistances) return this.cachedLODDistances;
    
    // Apply scaling factor to base distances
    const scaled = {
      terrain: {
        high: this.baseLODDistances.terrain.high * this.distanceScalingFactor,
        medium: this.baseLODDistances.terrain.medium * this.distanceScalingFactor,
        low: this.baseLODDistances.terrain.low * this.distanceScalingFactor,
        horizon: this.getHorizonLODDistance() // New horizon-specific distance

      },
      vegetation: {
        high: this.baseLODDistances.vegetation.high * this.distanceScalingFactor,
        medium: this.baseLODDistances.vegetation.medium * this.distanceScalingFactor,
        low: this.baseLODDistances.vegetation.low * this.distanceScalingFactor
      },
      water: {
        reflection: this.baseLODDistances.water.reflection * this.distanceScalingFactor,
        highDetail: this.baseLODDistances.water.highDetail * this.distanceScalingFactor,
        mediumDetail: this.baseLODDistances.water.mediumDetail * this.distanceScalingFactor
      }
    };
    
    // Cache the result
    this.cachedLODDistances = scaled;
    
    return scaled;
  }
  
  /**
   * Get terrain resolution multiplier based on quality level
   * @returns {number} Resolution multiplier factor (0-1)
   */
  getTerrainResolutionMultiplier() {
    switch (this.qualityLevel) {
      case 0: // Low
        return 0.33; // 1/3 of full resolution
      case 1: // Medium
        return 0.67; // 2/3 of full resolution
      case 2: // High
      default:
        return 1.0; // Full resolution
    }
  }
  
  /**
   * Get terrain resolution based on distance and current settings
   * @param {number} distanceFromPlayer - Distance from player
   * @returns {number} Number of segments to use for this terrain chunk
   */
  getTerrainResolution(distanceFromPlayer) {
    if (!this.isMobile) {
      // Non-mobile always uses full resolution
      return this.engine.systems.world.terrainResolution;
    }
    
    // Fixed LOD level for all terrain on very low-end devices
    if (this.currentTerrainLOD === "low") {
      return 16; // Very low resolution
    } else if (this.currentTerrainLOD === "medium") {
      return 32; // Medium resolution
    } else if (this.currentTerrainLOD === "high") {
      return 48; // Higher resolution, but still below default
    }
    
    // For adaptive LOD, calculate based on distance
    const lodDistances = this.getLODDistances().terrain;
    
    if (distanceFromPlayer < lodDistances.high) {
      return 48; // High detail close to player
    } else if (distanceFromPlayer < lodDistances.medium) {
      return 32; // Medium detail at medium distance
    } else if (distanceFromPlayer < lodDistances.low) {
      return 16; // Low detail at far distance
    } else {
      return 8; // Ultra-low detail at very far distance
    }
  }
  
 /**
   * Apply quality settings based on current quality level
   */
 updateQualityBasedOnLevel() {
  let waterReflectionSetting = true;
  let waterQuality = 'medium'; // Default water quality

  switch (this.qualityLevel) {
    case 0: // Low quality
      this.currentTerrainLOD = "low";
      this.currentVegetationDensity = 0.4;
      // Don't completely disable water reflections, just reduce quality
      waterReflectionSetting = true;
      waterQuality = 'low';
      break;

    case 1: // Medium quality
      this.currentTerrainLOD = "medium";
      this.currentVegetationDensity = 0.6;
      waterReflectionSetting = true;
      waterQuality = 'medium';
      break;

    case 2: // High quality
      this.currentTerrainLOD = "adaptive";
      this.currentVegetationDensity = 0.7;
      waterReflectionSetting = true;
      waterQuality = 'high';
      break;
  }

  // Apply water settings with minimum scaling
  if (this.engine.systems.water) {
    const waterSystem = this.engine.systems.water;
    const waterScaling = Math.max(this.distanceScalingFactor, this.minWaterScalingFactor);
    
    waterSystem.setQuality({
      reflectionEnabled: waterReflectionSetting,
      quality: waterQuality,
      renderDistance: this.baseLODDistances.water.reflection * waterScaling,
      textureSize: this.getWaterTextureSize(waterQuality)
    });
  }
}


// New method for water texture sizing
getWaterTextureSize(quality) {
  switch(quality) {
    case 'low': return 256;
    case 'medium': return 512;
    case 'high': return 512;
    default: return 512;
  }
}


dynamicallyAdjustLOD() {
  if (!this.isMobile || !this.initialBenchmarkComplete) return; // Ensure benchmark ran

  const report = this.engine.performanceMonitor.generateReport();
  const avgFPS = report.averages.fps;
  const avgTriangles = report.averages.triangles || 0;

  const timeSinceLastChange = Date.now() - this.lastQualityChangeTime;

  if (timeSinceLastChange < 10000) {
    console.log(`Quality adjustment postponed (${(10000 - timeSinceLastChange)/1000}s cooldown remaining)`);
    return;
  }

  const fpsRatio = avgFPS / this.targetFPS;

  // Log current state
  console.log(`LOD Assessment: Avg FPS: ${avgFPS.toFixed(1)}/${this.targetFPS} (${(fpsRatio * 100).toFixed(0)}%), ` +
              `Triangles: ${avgTriangles.toFixed(0)}, ` +
              `Quality: ${this.qualityLevel}/2, ` +
              `Time at quality: ${(this.timeAtCurrentQuality / 1000).toFixed(1)}s`);

  let shouldDecrease = false;
  let shouldIncrease = false;
  const reasons = [];

  // --- Performance analysis (Simplified for clarity) ---
  if (fpsRatio < this.fpsThresholds.critical || avgTriangles > this.triangleThresholds.critical) {
    shouldDecrease = true;
    reasons.push(fpsRatio < this.fpsThresholds.critical ? `FPS critical (${(fpsRatio * 100).toFixed(0)}%)` : `Triangles critical (${avgTriangles.toFixed(0)})`);
  } else if (fpsRatio < this.fpsThresholds.low || (avgTriangles > this.triangleThresholds.high && fpsRatio < 1.1)) {
    shouldDecrease = true;
    reasons.push(fpsRatio < this.fpsThresholds.low ? `FPS low (${(fpsRatio * 100).toFixed(0)}%)` : `Triangles high (${avgTriangles.toFixed(0)})`);
  } else if (fpsRatio > this.fpsThresholds.good && avgTriangles < this.triangleThresholds.medium) {
    shouldIncrease = true;
    reasons.push(`FPS good (${(fpsRatio * 100).toFixed(0)}%) & Tris moderate`);
  } else if (fpsRatio > this.fpsThresholds.excellent && avgTriangles < this.triangleThresholds.high) {
     shouldIncrease = true;
     reasons.push(`FPS excellent (${(fpsRatio * 100).toFixed(0)}%) & Tris manageable`);
  }


  // --- Apply hysteresis constraints ---
  if (shouldDecrease && timeSinceLastChange < this.minTimeBeforeDecrease) {
    // console.log(`Quality decrease suggested but postponed (hysteresis)`);
    shouldDecrease = false;
  }
  if (shouldIncrease && timeSinceLastChange < this.minTimeBeforeIncrease) {
    // console.log(`Quality increase suggested but postponed (hysteresis)`);
    shouldIncrease = false;
  }

  // --- Apply quality changes ---
  let qualityChanged = false;
  if (shouldDecrease && this.qualityLevel > 0) {
    this.qualityLevel--;
    console.log(`⬇️ Decreasing quality to ${this.qualityLevel}/2. Reason: ${reasons.join(", ")}`);
    qualityChanged = true;
  } else if (shouldIncrease && this.qualityLevel < 2) {
    this.qualityLevel++;
    console.log(`⬆️ Increasing quality to ${this.qualityLevel}/2. Reason: ${reasons.join(", ")}`);
    qualityChanged = true;
  }

  if (qualityChanged) {
    this.updateQualityBasedOnLevel(); // This now calls waterSystem.setReflectionEnabled
    this.timeAtCurrentQuality = 0;
    this.lastQualityChangeTime = Date.now();
    this.updateLODSettings(); // Update other systems like vegetation density

    // Apply emergency pixel ratio reduction if critically low FPS triggered the change
    if (this.qualityLevel === 0 && fpsRatio < 0.6 && this.engine.renderer) {
      const currentPixelRatio = this.engine.renderer.getPixelRatio();
      if (currentPixelRatio > 0.6) {
        const newRatio = Math.max(0.6, currentPixelRatio * 0.9);
        this.engine.renderer.setPixelRatio(newRatio);
        console.log(`🚨 Emergency pixel ratio reduction to ${newRatio.toFixed(2)}`);
      }
    }
  }
  // else {
  //   console.log(`✓ Maintaining quality level ${this.qualityLevel}/2`);
  // }
}

  
  /**
   * Dynamically adjust LOD settings based on performance
   */
  dynamicallyAdjustLOD() {
    if (!this.isMobile) return;
    
    // Get latest performance data
    const report = this.engine.performanceMonitor.generateReport();
    const currentFPS = report.current.fps;
    const avgFPS = report.averages.fps;
    const avgTriangles = report.averages.triangles || 0;
    
    const timeSinceLastChange = Date.now() - this.lastQualityChangeTime;
    const fpsRatio = avgFPS / this.targetFPS;
    
    // Log current state
    console.log(`LOD Assessment: Avg FPS: ${avgFPS.toFixed(1)}/${this.targetFPS} (${(fpsRatio * 100).toFixed(0)}%), ` +
                `Triangles: ${avgTriangles.toFixed(0)}, ` +
                `Quality: ${this.qualityLevel}/2, ` +
                `Time at quality: ${(this.timeAtCurrentQuality / 1000).toFixed(1)}s`);
    
    // Variables to track decision factors
    let shouldDecrease = false;
    let shouldIncrease = false;
    const reasons = [];
    
    // ----- Performance analysis -----
    
    // FPS-based analysis
    if (fpsRatio < this.fpsThresholds.critical) {
      shouldDecrease = true;
      reasons.push(`FPS critically low (${(fpsRatio * 100).toFixed(0)}% of target)`);
    } else if (fpsRatio < this.fpsThresholds.low) {
      // FPS is low but not critical
      shouldDecrease = true;
      reasons.push(`FPS below target (${(fpsRatio * 100).toFixed(0)}% of target)`);
    } else if (fpsRatio > this.fpsThresholds.good && avgTriangles < this.triangleThresholds.medium) {
      // FPS is good and triangle count isn't too high
      shouldIncrease = true;
      reasons.push(`FPS above target (${(fpsRatio * 100).toFixed(0)}% of target) with moderate triangle count`);
    }
    
    // Triangle count analysis
    if (avgTriangles > this.triangleThresholds.critical) {
      shouldDecrease = true;
      reasons.push(`Triangle count critically high (${avgTriangles.toFixed(0)})`);
    } else if (avgTriangles > this.triangleThresholds.high && fpsRatio < 1.1) {
      // High triangle count with mediocre FPS
      shouldDecrease = true;
      reasons.push(`High triangle count (${avgTriangles.toFixed(0)}) with borderline FPS`);
    } else if (avgTriangles < this.triangleThresholds.low && fpsRatio > 1.3) {
      // Low triangle count with excellent FPS
      shouldIncrease = true;
      reasons.push(`Low triangle count (${avgTriangles.toFixed(0)}) with excellent FPS`);
    }
    
    // ----- Apply hysteresis constraints -----
    
    // Prevent rapid changes by enforcing minimum time at a quality level
    if (shouldDecrease && timeSinceLastChange < this.minTimeBeforeDecrease) {
      console.log(`Quality decrease suggested but postponed (${(timeSinceLastChange / 1000).toFixed(1)}s < ${(this.minTimeBeforeDecrease / 1000)}s minimum time)`);
      shouldDecrease = false;
    }
    
    if (shouldIncrease && timeSinceLastChange < this.minTimeBeforeIncrease) {
      console.log(`Quality increase suggested but postponed (${(timeSinceLastChange / 1000).toFixed(1)}s < ${(this.minTimeBeforeIncrease / 1000)}s minimum time)`);
      shouldIncrease = false;
    }
    
    // ----- Apply quality changes -----
    
    // Decrease quality if needed and possible
    if (shouldDecrease && this.qualityLevel > 0) {
      this.qualityLevel--;
      console.log(`⬇️ Decreasing quality to ${this.qualityLevel}/2 because: ${reasons.join(", ")}`);
      this.updateQualityBasedOnLevel();
      this.timeAtCurrentQuality = 0;
      this.lastQualityChangeTime = Date.now();
      
      // Apply an emergency pixel ratio reduction if FPS is critically low
      if (fpsRatio < 0.6 && this.engine.renderer) {
        const currentPixelRatio = this.engine.renderer.getPixelRatio();
        if (currentPixelRatio > 0.6) {
          const newRatio = Math.max(0.6, currentPixelRatio * 0.9);
          this.engine.renderer.setPixelRatio(newRatio);
          console.log(`🚨 Emergency pixel ratio reduction to ${newRatio.toFixed(2)}`);
        }
      }
    }
    // Increase quality if needed and possible
    else if (shouldIncrease && this.qualityLevel < 2) {
      this.qualityLevel++;
      console.log(`⬆️ Increasing quality to ${this.qualityLevel}/2 because: ${reasons.join(", ")}`);
      this.updateQualityBasedOnLevel();
      this.timeAtCurrentQuality = 0;
      this.lastQualityChangeTime = Date.now();
    }
    else {
      console.log(`✓ Maintaining quality level ${this.qualityLevel}/2`);
    }
    
    // Apply updates to affected systems if any changes were made
    if (shouldDecrease || shouldIncrease) {
      this.updateLODSettings();
    }
  }
  
   /**
   * Update LOD settings across all systems
   * REMOVED the water recreation logic from here.
   */
   updateLODSettings() {
    if (!this.isMobile) return;

    this.cachedLODDistances = null; // Invalidate cache

    // Update vegetation system density and LOD distances
    if (this.engine.systems.vegetation) {
      const vegSystem = this.engine.systems.vegetation;
      const newDensity = this.currentVegetationDensity;
      const newVegLODs = this.getLODDistances().vegetation;

      let needsRegen = false;
      if (Math.abs(vegSystem.densityScale - newDensity) > 0.01) {
        console.log(`Updating vegetation density to ${newDensity.toFixed(2)}`);
        vegSystem.densityScale = newDensity;
        needsRegen = true; // Density change requires regeneration
      }
      if (JSON.stringify(vegSystem.lodDistances) !== JSON.stringify(newVegLODs)) {
           vegSystem.lodDistances = newVegLODs;
           // Note: Changing LOD distances ideally shouldn't require full regen,
           // just re-evaluation in the update loop. If regen IS needed, keep it.
           // needsRegen = true;
      }

      if (needsRegen) {
        vegSystem.regenerateVegetation();
      }
    }

    // Water system reflections are now handled directly by setReflectionEnabled
    // No need to do anything here for water reflections.
    // We *could* adjust other water properties like texture size here if needed,
    // but that would still likely require recreation. Toggling reflections is now cheap.

    // Update terrain resolution (assuming getTerrainResolution is used dynamically)
    if (this.engine.systems.world) {
         // If terrain resolution depends on LOD manager state that changed,
         // we might need to trigger terrain chunk updates here.
         // Currently, getTerrainResolution is called *during* chunk creation/update,
         // so changes should apply automatically as chunks are loaded/updated.
         // Force a refresh if needed: this.engine.systems.world.forceChunkUpdate();
    }

    // Other potential optimizations based on this.optimizations flags...
    if (this.engine.renderer && this.engine.renderer.shadowMap) {
         this.engine.renderer.shadowMap.enabled = !this.optimizations.simplifiedShadows;
         // Or change shadow map type/size
    }
  }
  
  /**
   * Check if a position should be culled based on distance and current settings
   * @param {THREE.Vector3} position - Position to check
   * @param {THREE.Vector3} cameraPosition - Camera position
   * @param {number} [baseCullDistance=6000] - Base distance for culling
   * @returns {boolean} True if the object should be culled
   */
// Update the shouldCull method with improved horizon handling
shouldCull(position, cameraPosition, baseCullDistance = 8000) {
  if (!this.isMobile) {
    const distance = position.distanceTo(cameraPosition);
    return distance > baseCullDistance;
  }

  const distance = position.distanceTo(cameraPosition);
  
  // Calculate angle to horizon using the XZ plane (ignore Y)
  const xzDistance = Math.sqrt(
    Math.pow(position.x - cameraPosition.x, 2) + 
    Math.pow(position.z - cameraPosition.z, 2)
  );
  const angleToHorizon = Math.atan2(position.y - cameraPosition.y, xzDistance);
  
  // Special handling for horizon chunks (near horizontal view angle)
  // Increased angle threshold to better capture horizon
  const isNearHorizon = Math.abs(angleToHorizon) < 0.15; // About 8.6 degrees
  
  if (isNearHorizon) {
    // Much less aggressive culling for horizon chunks to prevent terrain gaps
    return distance > baseCullDistance * 1.5; // Significantly extend view distance for horizon
  }

  // Keep minimap chunks
  const isInMinimapRange = distance < 2000;
  if (isInMinimapRange) {
    return false;
  }

  // Normal culling with adjusted distances - made less aggressive
  const cullDistance = this.optimizations.aggressiveDistanceCulling ? 
    baseCullDistance * 0.9 : // Increased from 0.85
    baseCullDistance;        // No reduction for non-aggressive mode

  return distance > cullDistance;
}
  
  /**
   * Get the recommended texture size for the given base size
   * @param {number} baseSize - Base texture size (e.g., 1024)
   * @returns {number} Adjusted texture size
   */
  getTextureSize(baseSize) {
    if (!this.isMobile) {
      return baseSize;
    }
    
    // Reduce texture sizes on mobile
    if (this.optimizations.reduced3DTextures) {
      return Math.min(baseSize, 256); // Cap at 256 when optimization is active
    }
    
    return Math.min(baseSize, 512); // Cap at 512 on mobile
  }
}
