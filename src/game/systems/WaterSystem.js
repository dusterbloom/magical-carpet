import * as THREE from "three";
import { Water } from 'three/examples/jsm/objects/Water.js';
import { TextureLoader } from 'three';
/**
 * Water system that integrates with the terrain's ocean beds
 */
export class WaterSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    
    // Default water level matches terrain's ocean design
    this.waterLevel = 0;

    // Water mesh reference
    this.water = null;
    
    // Debug flag
    this._debugChecked = false;
  }
  
  /**
   * Initialize the water system
   */
  async initialize() {
    console.log("Initializing WaterSystem...");
    
    // Get the minimum height from world system if available
    if (this.engine.systems.world) {
      // Critical: Set water level below terrain minimum but not too far
      // This fixes the flickering by ensuring no z-fighting at shoreline
      this.waterLevel = this.engine.systems.world.minHeight - 10;
      console.log(`Setting water level to ${this.waterLevel} based on terrain`);
    }
    
    // Create water plane with simple material (best performance)
    this.createWater();
    
    console.log("WaterSystem initialized");
  }
  
  /**
   * Create the water surface
   */
  
  // WaterSystem.js
createWater() {
  const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
  
  // Get quality setting from engine if available - only apply reduced quality on mobile
  let waterQuality = 'high';
  if (this.engine.settings && this.engine.settings.quality && this.engine.settings.isMobile) {
    waterQuality = this.engine.settings.quality.water;
    console.log(`Mobile device: Creating water with ${waterQuality} quality`);
  }
  
  // If MobileLODManager is available, check if water reflections should be enabled
  if (this.engine.systems.mobileLOD && 
      this.engine.settings && 
      this.engine.settings.isMobile) {
    if (!this.engine.systems.mobileLOD.currentWaterReflectionEnabled) {
      waterQuality = 'low';
      console.log(`Mobile LOD Manager disabled water reflections for performance`);
    }
  }
  
  // Configure water based on quality setting (only for mobile)
  let textureSize = 2048;
  let distortionScale = 0.8;
  let alpha = 0.95;
  
  // Only apply reduced settings on mobile
  if (this.engine.settings && this.engine.settings.isMobile) {
    switch (waterQuality) {
      case 'low':
        textureSize = 128; // Extremely low texture
        distortionScale = 0; // No distortion at all
        alpha = 0.8; // More transparent
        break;
      case 'medium':
        textureSize = 256; // Much smaller than before
        distortionScale = 0.1; // Very little distortion
        alpha = 0.85;
        break;
      case 'high':
        textureSize = 512; // Half of previous
        distortionScale = 0.2;
        alpha = 0.9;
        break;
    }
    
    // Add a debug message about the current water quality setting
    console.log(`Water quality on mobile: ${waterQuality}, texture size: ${textureSize}, distortion: ${distortionScale}`);
  }
  
  // Choose water color based on mobile & quality settings
  let waterColor = 0x001e0f; // Default water color

  // For mobile, use a more vibrant blue regardless of quality setting
  if (this.engine.settings && this.engine.settings.isMobile) {
    waterColor = 0x00aaff; // Extra vibrant blue that looks better without reflections
    console.log('Mobile device: Using alternative water color ' + waterColor.toString(16));
  }

  const water = new Water(waterGeometry, {
    textureWidth: textureSize,
    textureHeight: textureSize,
    waterNormals: new TextureLoader().load('textures/2waternormals.jpg', function (texture) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(32, 32); // Gentle repeat to reduce stretching
    }),
    sunDirection: new THREE.Vector3(), // Will be updated in update method
    sunColor: 0xffffff,
    waterColor: waterColor, // Use the selected water color
    distortionScale: distortionScale,
    clipBias: 0.001, // Moderately increased from 0.00001
    fog: this.scene.fog !== undefined,
    alpha: alpha // Opacity adjusted based on quality
  });
  
  water.rotation.x = -Math.PI / 2;
  water.position.y = this.waterLevel;
  
  // Store a reference to handle the reflection camera setup
  // (We'll initialize it properly in the update method since it might not exist yet)
  this._reflectionCameraInitialized = false;
  this._waterQuality = waterQuality;
  
  // For all mobile devices, completely disable reflections
  if (this.engine.settings && this.engine.settings.isMobile) {
    // Completely disable reflections by setting texture matrix to zero
    const zeroMatrix = new THREE.Matrix4().set(
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0
    );
    water.material.uniforms['textureMatrix'].value = zeroMatrix;
    
    // Use a very vibrant blue color
    const vividBlue = new THREE.Color(0x00ccff);
    water.material.uniforms['waterColor'].value = vividBlue;
    
    console.log('Mobile: Disabling all reflections and using vivid blue water');
    
    // Simplify shader for mobile
    if (water.material) {
      water.material.defines = water.material.defines || {};
      water.material.defines.DEPTH_EFFECT = 0;
      water.material.defines.SKY_EFFECT = 0;
      water.material.needsUpdate = true;
    }
  }

  water.rotation.x = -Math.PI / 2;
  water.position.y = this.waterLevel;

  this.water = water;
  this.scene.add(water);
}



  // /**
  //  * Update the water system (called each frame)
  //  * @param {number} deltaTime - Time elapsed since last update
  //  */

update(deltaTime) {
  if (this.water) {
    // Force water color on mobile devices consistently every frame
    if (this.engine.settings && this.engine.settings.isMobile && 
        this.water.material && this.water.material.uniforms['waterColor']) {
      this.water.material.uniforms['waterColor'].value = new THREE.Color(0x00ccff);
      
      // Keep reflections completely disabled
      if (this.water.material.uniforms['textureMatrix']) {
        const zeroMatrix = new THREE.Matrix4().set(
          0, 0, 0, 0,
          0, 0, 0, 0,
          0, 0, 0, 0,
          0, 0, 0, 0
        );
        this.water.material.uniforms['textureMatrix'].value.copy(zeroMatrix);
      }
    }
    
    // Use default animation speed for desktop, adjust for mobile only
    let animationSpeed = 0.8;
    
    // Only adjust animation speed on mobile
    if (this.engine.settings && this.engine.settings.isMobile && this._waterQuality) {
      animationSpeed = this._waterQuality === 'low' ? 0.3 : 
                        this._waterQuality === 'medium' ? 0.5 : 0.8;
    }
    
    this.water.material.uniforms['time'].value += deltaTime * animationSpeed;
    
    // Update sun direction using SunSystem reference
    if (this.engine.systems.atmosphere && 
        this.engine.systems.atmosphere.sunSystem) {
      const sunPosition = this.engine.systems.atmosphere.sunSystem.getSunPosition();
      const sunDirection = sunPosition.clone().normalize();
      this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
    }

    // Update position without rounding to avoid reflection jumps
    if (this.engine.camera) {
      this.water.position.x = this.engine.camera.position.x;
      this.water.position.z = this.engine.camera.position.z;
    }
    
    // Modify reflection processing for mobile
    if (this.engine.settings && this.engine.settings.isMobile) {
      // For all quality levels, disable reflections completely
      const zeroMatrix = new THREE.Matrix4().set(
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0
      );
      
      if (this.water && this.water.material) {
        // Ensure water color is maintained
        if (this.water.material.uniforms['waterColor']) {
          this.water.material.uniforms['waterColor'].value = new THREE.Color(0x00ccff);
        }
        
        // Disable reflections
        if (this.water.material.uniforms['textureMatrix']) {
          this.water.material.uniforms['textureMatrix'].value.copy(zeroMatrix);
        }
      }
      
      // Skip the rest of reflection processing
      return;
    }
    
    // Initialize reflection camera when it becomes available
    if (!this._reflectionCameraInitialized && this.water.material.uniforms.reflectionCamera) {
      const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
      // Configure base layers (default scene content)
      reflectionCamera.layers.set(0);  // Reset to default layer
      reflectionCamera.layers.enable(1); // Regular scene
      
      // On mobile, only enable cloud reflections for high quality
      if (!this.engine.settings || !this.engine.settings.isMobile || 
          this._waterQuality === 'high') {
        reflectionCamera.layers.enable(2); // Cloud reflections
      }
      
      this._reflectionCameraInitialized = true;
    }
    
    // Update reflection using SunSystem's enableReflections method
    if (this.engine.systems.atmosphere && this.engine.systems.atmosphere.sunSystem) {
      const sunSystem = this.engine.systems.atmosphere.sunSystem;
      
      // Store the original onBeforeRender function
      if (!this._originalOnBeforeRender && this.water.onBeforeRender) {
        this._originalOnBeforeRender = this.water.onBeforeRender;
      }
      
      // Override onBeforeRender to control the sun in water reflections
      this.water.onBeforeRender = (renderer, scene, camera) => {
      // Force water color on mobile devices in render loop
      if (this.engine.settings && this.engine.settings.isMobile && 
          this.water.material && this.water.material.uniforms['waterColor']) {
        this.water.material.uniforms['waterColor'].value = new THREE.Color(0x00ccff);
        
        // Keep reflections completely disabled
        if (this.water.material.uniforms['textureMatrix']) {
          const zeroMatrix = new THREE.Matrix4().set(
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0
          );
          this.water.material.uniforms['textureMatrix'].value.copy(zeroMatrix);
        }
      }

          if (!this._reflectionCameraInitialized || !this.water.material.uniforms.reflectionCamera) {
          // Skip if reflection camera isn't ready
          if (this._originalOnBeforeRender) {
            this._originalOnBeforeRender(renderer, scene, camera);
          }
          return;
        }
        
        // Get the sun position and check if it's above horizon AND visible
        const sunPos = sunSystem.getSunPosition();
        // Use a higher threshold to account for mountains
        const safeThreshold = sunSystem.HORIZON_LEVEL + 200;
        const isSunHighEnough = sunPos.y > safeThreshold;
        
        // Check distance from camera for LOD if MobileLODManager is available
        let enableReflections = isSunHighEnough;
        
        if (this.engine.systems.mobileLOD && 
            this.engine.settings && 
            this.engine.settings.isMobile) {
          // Get distance-based water reflection settings
          const distanceThresholds = this.engine.systems.mobileLOD.getLODDistances().water;
          const player = this.engine.systems.player?.localPlayer;
          
          if (player) {
            const playerDistance = this.water.position.distanceTo(player.position);
            
            // Only enable high-quality water reflections for nearby water
            if (playerDistance > distanceThresholds.reflection) {
              enableReflections = false;
            }
          }
        }
        
        // Use SunSystem's enableReflections method
        sunSystem.enableReflections(enableReflections);
        
        // Call original render function
        if (this._originalOnBeforeRender) {
          this._originalOnBeforeRender(renderer, scene, camera);
        }
      };
    }
  }
  
  // Check performance and update quality if needed - but ONLY on mobile
  if (this.engine.settings && this.engine.settings.isMobile) {
    const currentQuality = this._waterQuality;
    let shouldUpdateQuality = false;
    let newQuality = currentQuality;
    
    // Check if MobileLODManager wants to change water quality
    if (this.engine.systems.mobileLOD) {
      const reflectionEnabled = this.engine.systems.mobileLOD.currentWaterReflectionEnabled;
      
      if (!reflectionEnabled && currentQuality !== 'low') {
        newQuality = 'low';
        shouldUpdateQuality = true;
        console.log('MobileLOD Manager: Downgrading water quality to improve performance');
      } else if (reflectionEnabled && currentQuality === 'low') {
        newQuality = 'medium';
        shouldUpdateQuality = true;
        console.log('MobileLOD Manager: Upgrading water quality as performance allows');
      }
    }
    
    // Also check direct performance metrics for very low FPS situations
    if (this.engine.performanceMonitor && this._waterQuality) {
      const report = this.engine.performanceMonitor.generateReport();
      
      // If FPS drops below threshold, check if we need to update water quality
      // More aggressive for mobile - force low quality on very poor performance
      if (report.current.fps < 15) { // Lowered from 20
        newQuality = 'low'; // Always set to low for poor performance mobile
        shouldUpdateQuality = true;
        console.log(`Mobile: Very low FPS detected (${report.current.fps.toFixed(1)}), setting water quality to low`);
      }
    }
      
    // Apply quality changes if needed
    if (shouldUpdateQuality && newQuality !== currentQuality) {
      // Remove existing water
      if (this.water) {
        this.scene.remove(this.water);
        this.water.geometry.dispose();
        this.water.material.dispose();
      }
      
      // Update settings
      if (this.engine.settings) {
        this.engine.settings.setQuality('water', newQuality);
      }
      
      // Create new water with updated quality
      this.createWater();
      
      // Extra check: Force blue water color for any mobile quality
      if (this.water && this.water.material && 
          this.engine.settings && this.engine.settings.isMobile) {
        
        // Use a very vibrant blue color
        if (this.water.material.uniforms['waterColor']) {
          this.water.material.uniforms['waterColor'].value = new THREE.Color(0x00ccff);
        }
        
        // Keep reflections completely disabled
        if (this.water.material.uniforms['textureMatrix']) {
          const zeroMatrix = new THREE.Matrix4().set(
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0
          );
          this.water.material.uniforms['textureMatrix'].value.copy(zeroMatrix);
        }
        
        console.log('Mobile: Enforcing vivid blue water color after quality change');
      }
    }
    
    // If FPS still extremely low after applying low quality settings, disable water entirely
    if (this.engine.performanceMonitor) {
      const report = this.engine.performanceMonitor.generateReport();
      if (report.current.fps < 10 && this._waterQuality === 'low' && this.water && this.water.visible) {
        console.log(`Mobile: Emergency performance mode - making water invisible`);
        // Hide water entirely without removing it
        this.water.visible = false;
      }
      // If FPS recovers, make water visible again
      else if (report.current.fps > 20 && this._waterQuality === 'low' && this.water && !this.water.visible) {
        console.log(`Mobile: Performance recovered - making water visible again`);
        this.water.visible = true;
      }
    }
  }
}


  /**
   * Test if a position is underwater
   * @param {THREE.Vector3} position - The position to test
   * @returns {boolean} True if the position is underwater
   */
  isUnderwater(position) {
    return position.y < this.waterLevel;
  }
  
  /**
   * Get the depth of a point underwater
   * @param {THREE.Vector3} position - The position to test
   * @returns {number} Depth below water (0 if not underwater)
   */
  getUnderwaterDepth(position) {
    if (!this.isUnderwater(position)) return 0;
    return this.waterLevel - position.y;
  }
  
  /**
   * Clean up resources used by this system
   */
  dispose() {
    if (this.water) {
      // Restore original onBeforeRender if we overrode it
      if (this._originalOnBeforeRender) {
        this.water.onBeforeRender = this._originalOnBeforeRender;
        this._originalOnBeforeRender = null;
      }
      
      this.scene.remove(this.water);
      this.water.geometry.dispose();
      this.water.material.dispose();
      this.water = null;
    }
  }
}