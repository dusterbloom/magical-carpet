import * as THREE from "three";

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
    this.isMobile = engine.settings && engine.settings.isMobile;
    
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
        reflection: 1000, // Max distance for reflections
        highDetail: 500, // Use high detail water effects within this distance
        mediumDetail: 1500 // Use medium detail water effects within this distance
      }
    };
    
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
    this.targetFPS = 30; // Target framerate for mobile

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
      critical: 500000, // Critical - force quality reduction
      high: 400000,     // High - consider reduction if FPS is also marginal
      medium: 300000,   // Medium - maintain current level
      low: 200000       // Low - consider increasing quality if FPS is good
    };
    
    // FPS thresholds relative to target
    this.fpsThresholds = {
      critical: 0.7,   // Below 70% of target FPS - force quality reduction
      low: 0.9,        // Below 90% of target FPS - consider reduction
      target: 1.0,     // At target FPS - maintain current level
      good: 1.2,       // Above 120% of target FPS - consider quality increase
      excellent: 1.5   // Above 150% of target FPS - consider aggressive improvements
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
   * Detect device capabilities beyond just mobile/desktop
   */
  detectDeviceCapabilities() {
    // Only run detailed detection on mobile
    if (!this.isMobile) return;
    
    console.log("⚠️ Mobile device detection is inherently limited and may not perfectly reflect device capabilities.");
    console.log("Dynamic adjustments will refine settings based on actual performance during gameplay.");
    
    // Get device pixel ratio as a rough estimate of device capability
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    console.log(`Device pixel ratio: ${pixelRatio.toFixed(2)} (higher generally indicates better display)`);
    
    // Check available memory if possible
    let memoryScore = 1;
    if (navigator.deviceMemory) {
      // deviceMemory is in GB, ranges from 0.25 to 8
      memoryScore = Math.min(Math.max(navigator.deviceMemory / 4, 0.5), 1.5);
      console.log(`Device memory: ${navigator.deviceMemory}GB (score: ${memoryScore.toFixed(2)})`);
    } else {
      console.log("Device memory information not available");
    }
    
    // Check for specific mobile GPU hints in the user agent
    const ua = navigator.userAgent.toLowerCase();
    let gpuScore = 1;
    let deviceCategory = "unknown";
    
    // Detect high-end mobile GPUs (very rough heuristics)
    if (ua.includes('apple')) {
      // Recent iOS devices tend to have good GPUs
      gpuScore = 1.3;
      deviceCategory = "iOS";
    } else if (ua.includes('sm-g') || ua.includes('pixel') || ua.includes('snapdragon')) {
      // Higher-end Android devices
      gpuScore = 1.2;
      deviceCategory = "high-end Android";
    } else if (ua.includes('android')) {
      deviceCategory = "standard Android";
    }
    
    console.log(`Device category: ${deviceCategory} (GPU score: ${gpuScore.toFixed(2)})`);
    
    // Combine factors into a capability score
    // This is a very rough estimate - ideally we'd use proper benchmarking
    const capabilityScore = (pixelRatio / 2) * memoryScore * gpuScore;
    
    // Adjust distance scaling based on capability score
    this.distanceScalingFactor = Math.min(Math.max(capabilityScore * 0.6, 0.3), 1.0);
    
    console.log(`Mobile device capability score: ${capabilityScore.toFixed(2)}, scaling factor: ${this.distanceScalingFactor.toFixed(2)}`);
  }
  
  /**
   * Apply initial optimizations based on device type
   */
  applyInitialOptimizations() {
    if (!this.isMobile) return;
    
    // Set renderer pixel ratio
    if (this.engine.renderer) {
      // Use lower pixel ratio on mobile for better performance
      // The visual quality impact is minor compared to the performance gain
      const optimalPixelRatio = Math.min(window.devicePixelRatio, 2);
      this.engine.renderer.setPixelRatio(optimalPixelRatio * 0.8);
      
      // Reduce shadow map size on mobile
      if (this.engine.renderer.shadowMap) {
        this.engine.renderer.shadowMap.type = THREE.BasicShadowMap; // Use simpler shadows
      }
    }
    
    // Reduce draw distance on mobile
    if (this.engine.systems.world) {
      this.engine.systems.world.viewDistance = 4; // Reduced from default of 6
    }
    
    // Apply optimizations to all systems
    if (this.engine.systems.vegetation) {
      const vegSystem = this.engine.systems.vegetation;
      vegSystem.densityScale = this.currentVegetationDensity;
      // Reduce LOD distances for vegetation
      vegSystem.lodDistances = this.getLODDistances().vegetation;
    }
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
        low: this.baseLODDistances.terrain.low * this.distanceScalingFactor
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
    switch (this.qualityLevel) {
      case 0: // Low quality
        this.currentTerrainLOD = "low";
        this.currentVegetationDensity = 0.4;
        this.currentWaterReflectionEnabled = false;
        
        // Enable all optimizations
        this.optimizations.aggressiveDistanceCulling = true;
        this.optimizations.reduced3DTextures = true;
        this.optimizations.simplifiedShadows = true;
        this.optimizations.dynamicResolutionScaling = true;
        break;
        
      case 1: // Medium quality
        this.currentTerrainLOD = "medium";
        this.currentVegetationDensity = 0.6;
        this.currentWaterReflectionEnabled = true;
        
        // Enable most optimizations
        this.optimizations.aggressiveDistanceCulling = true;
        this.optimizations.reduced3DTextures = true;
        this.optimizations.simplifiedShadows = true;
        this.optimizations.dynamicResolutionScaling = false;
        break;
        
      case 2: // High quality
        this.currentTerrainLOD = "adaptive";
        this.currentVegetationDensity = 0.7;
        this.currentWaterReflectionEnabled = true;
        
        // Reduce optimizations
        this.optimizations.aggressiveDistanceCulling = false;
        this.optimizations.reduced3DTextures = true;
        this.optimizations.simplifiedShadows = false;
        this.optimizations.dynamicResolutionScaling = false;
        break;
    }
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
   */
  updateLODSettings() {
    if (!this.isMobile) return;
    
    // Clear cached LOD distances
    this.cachedLODDistances = null;
    
    // Update vegetation system
    if (this.engine.systems.vegetation) {
      const vegSystem = this.engine.systems.vegetation;
      
      // Update density scale
      if (vegSystem.densityScale !== this.currentVegetationDensity) {
        console.log(`Updating vegetation density to ${this.currentVegetationDensity.toFixed(2)}`);
        vegSystem.densityScale = this.currentVegetationDensity;
        
        // Force regeneration with new density
        vegSystem.regenerateVegetation();
      }
      
      // Update LOD distances
      vegSystem.lodDistances = this.getLODDistances().vegetation;
    }
    
    // Update water system reflection settings
    if (this.engine.systems.water && this.engine.systems.water.water) {
      const waterSystem = this.engine.systems.water;
      
      // Determine if we need to update water reflection state
      const waterReflectionEnabled = 
        waterSystem.water.material && 
        waterSystem.water.material.uniforms && 
        waterSystem.water.material.uniforms['reflectionCamera'];
      
      if (waterReflectionEnabled !== this.currentWaterReflectionEnabled) {
        console.log(`Updating water reflections to: ${this.currentWaterReflectionEnabled}`);
        
        // Update water quality based on current settings
        // Since water creation is encapsulated, we need to recreate water with new settings
        if (this.engine.settings) {
          const qualityLevel = this.currentWaterReflectionEnabled ? 'medium' : 'low';
          this.engine.settings.setQuality('water', qualityLevel);
          
          // Recreate water with new settings
          waterSystem.scene.remove(waterSystem.water);
          waterSystem.water.geometry.dispose();
          waterSystem.water.material.dispose();
          waterSystem.createWater();
        }
      }
    }
    
    // Apply resolution scaling if needed
    if (this.optimizations.dynamicResolutionScaling && this.engine.renderer) {
      // This will be called during the dynamic adjustment when needed
    }
  }
  
  /**
   * Check if a position should be culled based on distance and current settings
   * @param {THREE.Vector3} position - Position to check
   * @param {THREE.Vector3} cameraPosition - Camera position
   * @param {number} [baseCullDistance=6000] - Base distance for culling
   * @returns {boolean} True if the object should be culled
   */
  shouldCull(position, cameraPosition, baseCullDistance = 6000) {
    if (!this.isMobile) {
      // Less aggressive culling on desktop
      const distance = position.distanceTo(cameraPosition);
      return distance > baseCullDistance;
    }
    
    // More aggressive culling on mobile
    const distance = position.distanceTo(cameraPosition);
    const cullDistance = this.optimizations.aggressiveDistanceCulling ? 
      baseCullDistance * 0.6 : // 40% reduction in view distance when aggressive culling is on
      baseCullDistance * 0.8;  // 20% reduction in normal mode
      
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
