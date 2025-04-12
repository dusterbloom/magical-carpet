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
        high: 2000,    // Increased from 1500
        medium: 4000,  // Increased from 3000
        low: 6000      // Kept the same
      },
      vegetation: {
        high: 200,     // Increased from 150
        medium: 500,   // Increased from 400
        low: 1000      // Increased from 900
      },
      water: {
        reflection: 1500,     // Increased from 1000
        highDetail: 750,      // Increased from 500
        mediumDetail: 2000    // Increased from 1500
      }
    };
    
    // Scaling factors to apply to LOD distances based on device performance
    // More powerful devices can use higher detail at greater distances
    this.distanceScalingFactor = 1.0;
    
    // Mobile-specific scaling (reduced distances = earlier LOD transitions)
    if (this.isMobile) {
      this.distanceScalingFactor = 0.7; // Start with 50% of standard distances
    }
    
    // Performance tracking for dynamic adjustment
    this.lastAdjustmentTime = 0;
    this.adjustmentInterval = 5000; // Check every 5 seconds
    this.targetFPS = 60; // Target framerate for mobile
    
    this.currentTerrainLOD = "adaptive"; // Default is adaptive LOD for terrain
    this.currentVegetationDensity = 0.7; // Start with reduced vegetation density on mobile
    this.currentWaterReflectionEnabled = true; // Start with reflections enabled
    
    // Flags to track enabled optimizations
    this.optimizations = {
      aggressiveDistanceCulling: this.isMobile, // Enable by default on mobile
      reduced3DTextures: this.isMobile, // Reduce texture sizes on mobile
      simplifiedShadows: this.isMobile, // Use simpler shadows on mobile
      dynamicResolutionScaling: this.isMobile // Enable dynamic resolution on mobile
    };
    
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
    
    console.log("MobileLODManager initialized");
    return true;
  }
  
  /**
   * Update method called every frame
   */
  update(deltaTime) {
    // Skip if not on mobile
    if (!this.isMobile) return;
    
    // Periodically check if we need to adjust LOD settings
    const now = Date.now();
    if (now - this.lastAdjustmentTime > this.adjustmentInterval) {
      this.dynamicallyAdjustLOD();
      this.lastAdjustmentTime = now;
    }
  }
  
  /**
   * Detect device capabilities beyond just mobile/desktop
   */
  detectDeviceCapabilities() {
    // Only run detailed detection on mobile
    if (!this.isMobile) return;
    
    // Get device pixel ratio as a rough estimate of device capability
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    
    // Check available memory if possible
    let memoryScore = 1;
    if (navigator.deviceMemory) {
      // deviceMemory is in GB, ranges from 0.25 to 8
      memoryScore = Math.min(Math.max(navigator.deviceMemory / 4, 0.5), 1.5);
    }
    
    // Check for specific mobile GPU hints in the user agent
    const ua = navigator.userAgent.toLowerCase();
    let gpuScore = 1;
    
    // Detect high-end mobile GPUs (very rough heuristics)
    if (ua.includes('apple')) {
      // Recent iOS devices tend to have good GPUs
      gpuScore = 1.3;
    } else if (ua.includes('sm-g') || ua.includes('pixel') || ua.includes('snapdragon')) {
      // Higher-end Android devices
      gpuScore = 1.2;
    }
    
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
   * Dynamically adjust LOD settings based on performance
   */
  dynamicallyAdjustLOD() {
    if (!this.isMobile) return;
    
    const report = this.engine.performanceMonitor.generateReport();
    const currentFPS = report.current.fps;
    const avgFPS = report.averages.fps;
    
    // Adjusted thresholds
    if (avgFPS < 20) {
      // Critical performance - but keep reasonable view distance
      this.distanceScalingFactor = 0.6; // Changed from more aggressive values
      this.currentVegetationDensity = 0.5; // Increased from 0.4
      
      if (avgFPS < 15 && this.engine.renderer) {
        const currentPixelRatio = this.engine.renderer.getPixelRatio();
        if (currentPixelRatio > 0.7) { // Changed from 0.6
          this.engine.renderer.setPixelRatio(Math.max(0.7, currentPixelRatio * 0.9));
        }
      }
    }
    else if (avgFPS < this.targetFPS) {
      // Below target but not critical
      this.distanceScalingFactor = 0.7;
      this.currentVegetationDensity = 0.6;
    }
    else if (avgFPS > this.targetFPS * 1.2) {
      // Good performance - gradually increase quality
      this.distanceScalingFactor = Math.min(0.8, this.distanceScalingFactor + 0.05);
      
      if (this.currentVegetationDensity < 0.7) {
        this.currentVegetationDensity = Math.min(0.7, this.currentVegetationDensity + 0.1);
      }
    }
  
    
    // Apply updates to affected systems
    this.updateLODSettings();
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
  shouldCull(position, cameraPosition, baseCullDistance = 12000) {
    const distance = position.distanceTo(cameraPosition);
    
    // Special handling for water
    if (position.y < 0) { // Assuming water is below y=0
      const waterCullDistance = baseCullDistance * 0.9; // Less aggressive culling for water
      return distance > waterCullDistance;
    }
  
    // Original culling logic for other objects
    if (!this.isMobile) {
      return distance > baseCullDistance;
    }
  
    const cullDistance = this.optimizations.aggressiveDistanceCulling ? 
      baseCullDistance * 0.8 : 
      baseCullDistance * 0.9;
  
    const isInMinimapRange = distance < 2000;
    if (isInMinimapRange) {
      return false;
    }
  
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
