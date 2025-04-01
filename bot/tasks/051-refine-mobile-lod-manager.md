# Task 051: Refine Mobile LOD Management

## 1. Task & Context
**Task:** Improve the MobileLODManager by refining capability detection, smoothing dynamic adjustments, and integrating triangle count into decision logic.
**Scope:** src/game/core/MobileLODManager.js, potentially src/game/core/PerformanceMonitor.js
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Add hysteresis to LOD transitions, incorporate triangle count data alongside FPS in decision-making, implement early capability benchmarking, and improve logging.
**Complexity:** 2/3 (Moderate changes to existing logic)
**Uncertainty:** 1/3 (Clear path forward with existing code structure)
**Unknowns:** Optimal thresholds for triangle count decisions
**Human Input Needed:** No (Can implement using standard techniques)

## 3. Implementation

The primary changes will focus on three areas:

### 1. Improved Device Capability Detection

```javascript
// In MobileLODManager.js, modify detectDeviceCapabilities()
detectDeviceCapabilities() {
  // Only run detailed detection on mobile
  if (!this.isMobile) return;
  
  console.log("Detecting mobile device capabilities (note: this is approximate)");
  
  // Get device pixel ratio as a rough estimate of device capability
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
  
  // Check available memory if possible
  let memoryScore = 1;
  if (navigator.deviceMemory) {
    // deviceMemory is in GB, ranges from 0.25 to 8
    memoryScore = Math.min(Math.max(navigator.deviceMemory / 4, 0.5), 1.5);
    console.log(`Device memory detected: ${navigator.deviceMemory}GB`);
  } else {
    console.log("Device memory API not available");
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
  
  // Add a short initial benchmark to measure baseline performance
  this.runInitialBenchmark().then(benchmarkScore => {
    // Combine factors into a capability score with benchmark data
    const capabilityScore = (pixelRatio / 2) * memoryScore * gpuScore * benchmarkScore;
    
    // Adjust distance scaling based on capability score
    this.distanceScalingFactor = Math.min(Math.max(capabilityScore * 0.6, 0.3), 1.0);
    
    console.log(`Mobile device capability assessment complete:
      - Pixel ratio: ${pixelRatio.toFixed(2)}
      - Memory score: ${memoryScore.toFixed(2)}
      - GPU score: ${gpuScore.toFixed(2)}
      - Benchmark score: ${benchmarkScore.toFixed(2)}
      - Final capability score: ${capabilityScore.toFixed(2)}
      - LOD scaling factor: ${this.distanceScalingFactor.toFixed(2)}`);
  });
}

// Add a new method to run a quick benchmark
async runInitialBenchmark() {
  console.log("Running brief performance benchmark...");
  
  // Create a benchmark scene with a moderately complex object
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = this.engine.renderer;
  
  // Create a geometry with moderate complexity
  const geometry = new THREE.TorusKnotGeometry(10, 3, 100, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
  const torusKnot = new THREE.Mesh(geometry, material);
  scene.add(torusKnot);
  camera.position.z = 30;
  
  // Variables to track benchmark metrics
  let frameCount = 0;
  const startTime = performance.now();
  const targetDuration = 2000; // 2 seconds benchmark
  const maxFrames = 120; // Cap at 120 frames to avoid excessive time on high-end devices
  
  // Run the benchmark
  return new Promise(resolve => {
    const benchmark = () => {
      frameCount++;
      torusKnot.rotation.x += 0.01;
      torusKnot.rotation.y += 0.01;
      renderer.render(scene, camera);
      
      const elapsedTime = performance.now() - startTime;
      
      if (frameCount < maxFrames && elapsedTime < targetDuration) {
        requestAnimationFrame(benchmark);
      } else {
        // Calculate benchmark score based on FPS achieved
        const fps = (frameCount / elapsedTime) * 1000;
        const targetFPS = 60;
        const benchmarkScore = Math.min(Math.max(fps / targetFPS, 0.5), 1.5);
        
        // Clean up benchmark resources
        geometry.dispose();
        material.dispose();
        
        console.log(`Benchmark complete: ${fps.toFixed(1)} FPS, score: ${benchmarkScore.toFixed(2)}`);
        resolve(benchmarkScore);
      }
    };
    
    requestAnimationFrame(benchmark);
  });
}
```

### 2. Smooth Dynamic LOD Adjustments with Hysteresis

```javascript
// In MobileLODManager.js, add these properties to the constructor
constructor(engine) {
  // ... existing code ...
  
  // Add state tracking for LOD levels and transitions
  this.qualityLevel = 1; // 0=Low, 1=Medium, 2=High
  this.timeAtCurrentLevel = 0;
  this.transitionCooldown = 0;
  
  // Hysteresis settings
  this.upgradeThreshold = 1.3; // 30% above target FPS to upgrade
  this.downgradeThreshold = 0.8; // 20% below target FPS to downgrade
  this.minTimeAtLevel = 10000; // Min 10 seconds at a level before upgrading
  this.cooldownPeriod = 5000; // 5 second cooldown between transitions
  
  // Triangle count thresholds
  this.criticalTriangles = 500000; // Critical threshold for triangle count
  this.highTriangles = 400000; // High triangle count threshold
  this.lowTriangles = 200000; // Low triangle count threshold
}

// Replace the dynamicallyAdjustLOD method
dynamicallyAdjustLOD() {
  if (!this.isMobile) return;
  
  // Get latest performance data
  const report = this.engine.performanceMonitor.generateReport();
  const currentFPS = report.current.fps;
  const avgFPS = report.averages.fps;
  const avgTriangles = report.averages.triangles || 0;
  
  console.log(`Performance metrics: FPS=${avgFPS.toFixed(1)} (target=${this.targetFPS}), Triangles=${avgTriangles.toFixed(0)}, Quality level=${this.qualityLevel}`);
  
  // Update time at current level
  const now = Date.now();
  this.timeAtCurrentLevel += (now - this.lastAdjustmentTime);
  
  // Decrease cooldown timer if active
  if (this.transitionCooldown > 0) {
    this.transitionCooldown -= (now - this.lastAdjustmentTime);
    if (this.transitionCooldown < 0) this.transitionCooldown = 0;
  }
  
  // Only consider adjustments if we're not in cooldown
  if (this.transitionCooldown === 0) {
    // Evaluate whether we should change quality level
    let newQualityLevel = this.qualityLevel;
    let reason = "";
    
    // CRITICAL PERFORMANCE: Severe performance issues detected
    if (avgFPS < 15 || avgTriangles > this.criticalTriangles) {
      newQualityLevel = 0; // Force to lowest quality immediately
      reason = `critical performance (avgFPS=${avgFPS.toFixed(1)}, avgTris=${avgTriangles.toFixed(0)})`;
    } 
    // DOWNGRADE: Performance below target
    else if (avgFPS < this.targetFPS * this.downgradeThreshold && this.qualityLevel > 0) {
      newQualityLevel = this.qualityLevel - 1;
      reason = `performance below target (avgFPS=${avgFPS.toFixed(1)} < ${(this.targetFPS * this.downgradeThreshold).toFixed(1)})`;
    }
    // DOWNGRADE: Triangle count too high for current performance
    else if (avgTriangles > this.highTriangles && avgFPS < this.targetFPS && this.qualityLevel > 0) {
      newQualityLevel = this.qualityLevel - 1;
      reason = `high triangle count with below-target FPS (avgTris=${avgTriangles.toFixed(0)}, avgFPS=${avgFPS.toFixed(1)})`;
    }
    // UPGRADE: Performance consistently good for a while
    else if (avgFPS > this.targetFPS * this.upgradeThreshold && 
             avgTriangles < this.lowTriangles && 
             this.qualityLevel < 2 && 
             this.timeAtCurrentLevel > this.minTimeAtLevel) {
      newQualityLevel = this.qualityLevel + 1;
      reason = `sustained good performance (avgFPS=${avgFPS.toFixed(1)} > ${(this.targetFPS * this.upgradeThreshold).toFixed(1)}, avgTris=${avgTriangles.toFixed(0)} < ${this.lowTriangles})`;
    }
    
    // Apply quality change if needed
    if (newQualityLevel !== this.qualityLevel) {
      console.log(`Adjusting LOD quality to level ${newQualityLevel} because ${reason}`);
      this.qualityLevel = newQualityLevel;
      this.timeAtCurrentLevel = 0;
      this.transitionCooldown = this.cooldownPeriod;
      
      // Apply the appropriate settings for the new quality level
      this.applyQualityLevel();
    }
  } else {
    console.log(`LOD transition cooldown: ${(this.transitionCooldown / 1000).toFixed(1)}s remaining`);
  }
  
  this.lastAdjustmentTime = now;
}

// Add a new method to apply settings based on quality level
applyQualityLevel() {
  // Apply settings based on the current quality level
  switch (this.qualityLevel) {
    case 0: // Low quality
      console.log("Applying LOW quality settings");
      
      // Terrain settings
      this.currentTerrainLOD = "low";
      
      // Vegetation settings
      this.currentVegetationDensity = 0.4;
      
      // Water settings
      this.currentWaterReflectionEnabled = false;
      
      // Other optimizations
      this.optimizations.aggressiveDistanceCulling = true;
      this.optimizations.reduced3DTextures = true;
      this.optimizations.simplifiedShadows = true;
      this.optimizations.dynamicResolutionScaling = true;
      
      // Apply reduced resolution scaling for LOW quality
      if (this.engine.renderer) {
        const currentPixelRatio = this.engine.renderer.getPixelRatio();
        const targetRatio = Math.min(window.devicePixelRatio * 0.6, 1.2);
        if (Math.abs(currentPixelRatio - targetRatio) > 0.05) {
          this.engine.renderer.setPixelRatio(targetRatio);
          console.log(`Setting pixel ratio to ${targetRatio.toFixed(2)}`);
        }
      }
      break;
      
    case 1: // Medium quality
      console.log("Applying MEDIUM quality settings");
      
      // Terrain settings
      this.currentTerrainLOD = "medium";
      
      // Vegetation settings  
      this.currentVegetationDensity = 0.6;
      
      // Water settings
      this.currentWaterReflectionEnabled = true;
      
      // Other optimizations
      this.optimizations.aggressiveDistanceCulling = true;
      this.optimizations.reduced3DTextures = true;
      this.optimizations.simplifiedShadows = true;
      this.optimizations.dynamicResolutionScaling = false;
      
      // Apply medium resolution scaling
      if (this.engine.renderer) {
        const currentPixelRatio = this.engine.renderer.getPixelRatio();
        const targetRatio = Math.min(window.devicePixelRatio * 0.75, 1.5);
        if (Math.abs(currentPixelRatio - targetRatio) > 0.05) {
          this.engine.renderer.setPixelRatio(targetRatio);
          console.log(`Setting pixel ratio to ${targetRatio.toFixed(2)}`);
        }
      }
      break;
      
    case 2: // High quality
      console.log("Applying HIGH quality settings");
      
      // Terrain settings
      this.currentTerrainLOD = "adaptive";
      
      // Vegetation settings
      this.currentVegetationDensity = 0.8;
      
      // Water settings
      this.currentWaterReflectionEnabled = true;
      
      // Other optimizations
      this.optimizations.aggressiveDistanceCulling = false;
      this.optimizations.reduced3DTextures = false;
      this.optimizations.simplifiedShadows = false;
      this.optimizations.dynamicResolutionScaling = false;
      
      // Apply high resolution scaling
      if (this.engine.renderer) {
        const currentPixelRatio = this.engine.renderer.getPixelRatio();
        const targetRatio = Math.min(window.devicePixelRatio * 0.9, 2.0);
        if (Math.abs(currentPixelRatio - targetRatio) > 0.05) {
          this.engine.renderer.setPixelRatio(targetRatio);
          console.log(`Setting pixel ratio to ${targetRatio.toFixed(2)}`);
        }
      }
      break;
  }
  
  // Apply updates to affected systems
  this.updateLODSettings();
}
```

### 3. Smooth Visual Transitions

```javascript
// Add a transitioning flag to the constructor
constructor(engine) {
  // ... existing code ...
  
  // For visual transitions
  this.isTransitioning = false;
  this.transitionStartTime = 0;
  this.transitionDuration = 2000; // 2 seconds for smooth transitions
  this.previousVegetationDensity = this.currentVegetationDensity;
}

// Update the updateLODSettings method to add smooth transitions
updateLODSettings() {
  if (!this.isMobile) return;
  
  // Clear cached LOD distances
  this.cachedLODDistances = null;
  
  // Start a visual transition if not already transitioning
  if (!this.isTransitioning) {
    this.isTransitioning = true;
    this.transitionStartTime = Date.now();
    this.previousVegetationDensity = this.engine.systems.vegetation ? 
      this.engine.systems.vegetation.densityScale : this.currentVegetationDensity;
    
    console.log(`Starting visual transition from vegetation density ${this.previousVegetationDensity.toFixed(2)} to ${this.currentVegetationDensity.toFixed(2)}`);
  }
  
  // Update water system reflection settings immediately (no smooth transition)
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
}

// Add a new update method specifically for handling visual transitions
handleVisualTransitions(deltaTime) {
  if (!this.isTransitioning) return;
  
  const now = Date.now();
  const elapsed = now - this.transitionStartTime;
  const progress = Math.min(elapsed / this.transitionDuration, 1.0);
  
  // Apply easing function for smoother transition
  const easedProgress = this.easeInOutQuad(progress);
  
  // Update vegetation density with smooth transition
  if (this.engine.systems.vegetation) {
    const vegSystem = this.engine.systems.vegetation;
    const interpolatedDensity = this.previousVegetationDensity + 
      (this.currentVegetationDensity - this.previousVegetationDensity) * easedProgress;
    
    vegSystem.densityScale = interpolatedDensity;
    
    // If transition is complete, finalize changes
    if (progress >= 1.0) {
      this.isTransitioning = false;
      vegSystem.densityScale = this.currentVegetationDensity;
      vegSystem.regenerateVegetation();
      console.log(`Visual transition complete: vegetation density set to ${this.currentVegetationDensity.toFixed(2)}`);
    }
  } else {
    this.isTransitioning = false;
  }
}

// Add an easing function for smoother transitions
easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Update the main update method to handle transitions
update(deltaTime) {
  // Skip if not on mobile
  if (!this.isMobile) return;
  
  // Handle visual transitions
  this.handleVisualTransitions(deltaTime);
  
  // Periodically check if we need to adjust LOD settings
  const now = Date.now();
  if (now - this.lastAdjustmentTime > this.adjustmentInterval) {
    this.dynamicallyAdjustLOD();
    this.lastAdjustmentTime = now;
  }
}
```

## 4. Check & Commit
**Changes Made:**
- Added initial performance benchmarking for more accurate device capability assessment
- Implemented hysteresis for LOD transitions with cooldown periods to prevent rapid switching
- Integrated triangle count metrics into LOD decision logic
- Created a discrete quality level system (0-Low, 1-Medium, 2-High) for more predictable transitions
- Added smooth visual transitions for vegetation density changes
- Improved logging with detailed performance metrics and reasoning for LOD changes
- Fixed potential issues with renderer pixel ratio adjustments
- Added minimum time requirements before upgrading quality to ensure stability

**Commit Message:** refactor(mobile): Improve MobileLODManager with hysteresis, triangles-aware decisions, and smoother transitions

**Status:** Ready for implementation
