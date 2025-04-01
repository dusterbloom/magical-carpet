import * as THREE from "three";
import { Water } from 'three/examples/jsm/objects/Water.js';
import { TextureLoader } from 'three';
import { System } from "../core/v2/System";


// Constants for water system
const WATER_CONSTANTS = {
  // Water geometry
  WATER_SIZE: 10000,
  WATER_LEVEL_OFFSET: 10,
  
  // Water quality settings
  TEXTURE_SIZES: {
    MOBILE: {
      LOW: 32,
      MEDIUM: 64,
      HIGH: 128
    },
    DESKTOP: {
      LOW: 64,
      MEDIUM: 256,
      HIGH: 1024
    }
  },
  
  DISTORTION_SCALES: {
    MOBILE: {
      LOW: 0.05,
      MEDIUM: 0.1,
      HIGH: 0.2
    },
    DESKTOP: {
      LOW: 0.1,
      MEDIUM: 0.3,
      HIGH: 0.6
    }
  },
  
  ALPHA_VALUES: {
    LOW: 0.8,
    MEDIUM: 0.85,
    HIGH: 0.9
  },
  
  // Reflection matrix scales
  REFLECTION_SCALES: {
    LOW: 0.05,
    MEDIUM: 0.3,
    HIGH: 0.7
  },
  
  // Animation speeds
  ANIMATION_SPEEDS: {
    DEFAULT: 0.8,
    LOW_MOBILE: 0.3,
    MEDIUM_MOBILE: 0.5
  },
  
  // FPS thresholds
  FPS_THRESHOLDS: {
    VERY_LOW: 10,
    LOW: 15,
    RECOVER: 20
  },

  UPDATE_INTERVALS: {
    MOBILE: {
      POSITION: 500,  // Update position every 500ms on mobile
      REFLECTION: 1000 // Update reflections every 1s on mobile
    }
  },
  
  // Colors
  WATER_COLOR: 0x0066aa,
  SUN_COLOR: 0xffffff,
  
  // Texture settings
  NORMAL_MAP_REPEAT: 32,
  CLIP_BIAS: 0.001
};
/**
 * Water system that integrates with the terrain's ocean beds
 */
export class WaterSystem extends System {
  constructor(engine) {
      super(engine, 'water');
      
      // Declare dependencies
      this.requireDependencies(['world']);
      
      this.scene = engine.scene;
      this.waterLevel = 0;
      this.water = null;
      this._debugChecked = false;
      this._reflectionCameraInitialized = false;
      this._waterQuality = 'high';
  }

  async _initialize() {
      try {
          console.log("Initializing WaterSystem...");
          
          // Get the minimum height from world system
          const worldSystem = this.engine.systems.get('world');
          if (worldSystem) {
              this.waterLevel = worldSystem.minHeight - WATER_CONSTANTS.WATER_LEVEL_OFFSET;
              console.log(`Setting water level to ${this.waterLevel} based on terrain`);
          } else {
              console.warn("World system not available - using default water level");
          }
          
          await this.createWater();
          console.log("WaterSystem initialized");
      } catch (error) {
          console.error("Failed to initialize WaterSystem:", error);
      }
  }
  /**
   * Create the water surface
   */
  
//   // WaterSystem.js
// createWater() {
//     try {
//         const waterGeometry = new THREE.PlaneGeometry(
//             WATER_CONSTANTS.WATER_SIZE, 
//             WATER_CONSTANTS.WATER_SIZE
//         );

//         // Get quality setting from engine if available
//         let waterQuality = 'high';
//         if (this.engine.settings && this.engine.settings.quality) {
//             waterQuality = this.engine.settings.quality.water;
//             console.log(`Creating water with ${waterQuality} quality`);
//         }

//         // If MobileLODManager is available, check if water reflections should be enabled
//         if (this.engine.mobileLOD && 
//           this.engine.settings && 
//           this.engine.settings.isMobile) {
//           if (!this.engine.mobileLOD.currentWaterReflectionEnabled) {
//               waterQuality = 'low';
//               console.log('Mobile LOD Manager disabled water reflections for performance');
//           }
//       }
  
//   // Configure water based on quality setting - applies to all devices now
//   let textureSize = WATER_CONSTANTS.TEXTURE_SIZES.HIGH;  // Default high quality
//   let distortionScale = WATER_CONSTANTS.DISTORTION_SCALES.HIGH;
//   let alpha = WATER_CONSTANTS.ALPHA_VALUES.HIGH;
  
//   // Apply quality settings based on device capability and quality setting
//   switch (waterQuality) {
//     case 'low':
//       textureSize = WATER_CONSTANTS.TEXTURE_SIZES.LOW;  // Very small texture for reflections
//       distortionScale = WATER_CONSTANTS.DISTORTION_SCALES.LOW;  // Minimal distortion
//       alpha = WATER_CONSTANTS.ALPHA_VALUES.LOW;  // More transparent
//       break;
//     case 'medium':
//       textureSize = WATER_CONSTANTS.TEXTURE_SIZES.MEDIUM;  // Medium texture size
//       distortionScale = WATER_CONSTANTS.DISTORTION_SCALES.MEDIUM;  // Moderate distortion
//       alpha = WATER_CONSTANTS.ALPHA_VALUES.MEDIUM;
//       break;
//     case 'high':
//       textureSize = this.engine.settings && this.engine.settings.isMobile ? 
//         WATER_CONSTANTS.TEXTURE_SIZES.HIGH_MOBILE : WATER_CONSTANTS.TEXTURE_SIZES.HIGH;  // Scaled based on device
//       distortionScale = WATER_CONSTANTS.DISTORTION_SCALES.HIGH;  // Significant distortion but not full
//       alpha = WATER_CONSTANTS.ALPHA_VALUES.HIGH;
//       break;
//   }
  
//   console.log(`Water quality: ${waterQuality}, texture size: ${textureSize}, distortion: ${distortionScale}`);
  
//   // Use a color that works correctly on all devices - fix for the brown water issue
//   // Medium blue that renders consistently across devices
//   const waterColor = WATER_CONSTANTS.WATER_COLOR;

//   const water = new Water(waterGeometry, {
//     textureWidth: textureSize,
//     textureHeight: textureSize,
//     waterNormals: new TextureLoader().load('textures/2waternormals.jpg', function (texture) {
//       texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
//       texture.repeat.set(WATER_CONSTANTS.NORMAL_MAP_REPEAT, WATER_CONSTANTS.NORMAL_MAP_REPEAT); // Gentle repeat to reduce stretching
//     }),
//     sunDirection: new THREE.Vector3(), // Will be updated in update method
//     sunColor: WATER_CONSTANTS.SUN_COLOR,
//     waterColor: waterColor, // Use the selected water color
//     distortionScale: distortionScale,
//     clipBias: WATER_CONSTANTS.CLIP_BIAS, // Moderately increased from 0.00001
//     fog: this.scene.fog !== undefined,
//     alpha: alpha // Opacity adjusted based on quality
//   });
  
//   water.rotation.x = -Math.PI / 2;
//   water.position.y = this.waterLevel;
  
//   // Store a reference to handle the reflection camera setup
//   // (We'll initialize it properly in the update method since it might not exist yet)
//   this._reflectionCameraInitialized = false;
//   this._waterQuality = waterQuality;
  
//   // Apply quality-specific reflection settings instead of completely disabling
//   if (this.engine.settings && this.engine.settings.isMobile) {
//     // Apply appropriately scaled reflection matrix instead of zero matrix
//     let reflectionMatrix;
    
//     switch (waterQuality) {
//     case 'low':
//     // Very minimal reflection - almost zero but not completely disabled
//     const lowScale = WATER_CONSTANTS.REFLECTION_SCALES.LOW;
//     reflectionMatrix = new THREE.Matrix4().makeScale(lowScale, lowScale, lowScale);
//     console.log('Mobile: Using minimal reflections for low quality water');
//     break;
      
//     case 'medium':
//     // Reduced reflection
//     const medScale = WATER_CONSTANTS.REFLECTION_SCALES.MEDIUM;
//     reflectionMatrix = new THREE.Matrix4().makeScale(medScale, medScale, medScale);
//     console.log('Mobile: Using reduced reflections for medium quality water');
//       break;
    
//     case 'high':
//     // Still slightly reduced from full reflection for mobile performance
//     const highScale = WATER_CONSTANTS.REFLECTION_SCALES.HIGH;
//         reflectionMatrix = new THREE.Matrix4().makeScale(highScale, highScale, highScale);
//           console.log('Mobile: Using moderate reflections for high quality water');
//           break;
//       }
    
//     // Apply the appropriate reflection matrix
//     water.material.uniforms['textureMatrix'].value = reflectionMatrix;
    
//     // Simplify shader for mobile if needed
//     if (water.material && waterQuality === 'low') {
//       water.material.defines = water.material.defines || {};
//       water.material.defines.DEPTH_EFFECT = 0;
//       water.material.defines.SKY_EFFECT = 0;
//       water.material.needsUpdate = true;
//     }
//   }

//   water.rotation.x = -Math.PI / 2;
//   water.position.y = this.waterLevel;

//   this.water = water;
//   this.scene.add(water);
//   } catch (error) {
//     console.error("Error creating water:", error);
//     // Allow game to continue without water
//   }
// }


createWater() {
  try {
    const isMobile = this.engine.settings?.isMobile;
    
    // Use much simpler geometry for mobile
    const waterGeometry = new THREE.PlaneGeometry(
      WATER_CONSTANTS.WATER_SIZE, 
      WATER_CONSTANTS.WATER_SIZE,
      isMobile ? 1 : 4,  // Absolute minimum segments for mobile
      isMobile ? 1 : 4
    );

    // Even smaller textures for mobile
    const textureSize = isMobile ? 32 : 512; // Drastically reduced for mobile

    // Create water with mobile-optimized settings
    const water = new Water(waterGeometry, {
      textureWidth: textureSize,
      textureHeight: textureSize,
      waterNormals: new TextureLoader().load('textures/2waternormals.jpg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(isMobile ? 8 : 32, isMobile ? 8 : 32); // Much less repeat on mobile
        texture.minFilter = THREE.NearestFilter; // Use nearest filtering on mobile
        texture.magFilter = THREE.NearestFilter;
      }),
      sunDirection: new THREE.Vector3(),
      sunColor: WATER_CONSTANTS.SUN_COLOR,
      waterColor: WATER_CONSTANTS.WATER_COLOR,
      distortionScale: isMobile ? 0.05 : 0.3, // Minimal distortion on mobile
      fog: false,
      alpha: isMobile ? 0.7 : 0.9 // More transparent on mobile for better performance
    });

    if (isMobile) {
      // Disable ALL expensive shader features on mobile
      water.material.defines = {
        DEPTH_EFFECT: 0,
        SKY_EFFECT: 0,
        USE_CAUSTICS: 0,
        USE_REFLECTION: 0,
        USE_CUSTOM_FRAGMENT: 1
      };
      
      // Use absolute minimum precision in shaders
      water.material.precision = 'lowp';
      
      // Disable all unnecessary material features
      water.material.fog = false;
      water.material.lights = false;
      water.material.dithering = false;
      
      // Force material update
      water.material.needsUpdate = true;
    }

    water.rotation.x = -Math.PI / 2;
    water.position.y = this.waterLevel;
    
    // Mobile-specific optimizations
    if (isMobile) {
      water.frustumCulled = true;
      water.matrixAutoUpdate = false;
      water.renderOrder = -1; // Render water first
    }
    // Ensure reflection camera is properly initialized
    if (water.material.uniforms.reflectionCamera?.value) {
      const reflectionCamera = water.material.uniforms.reflectionCamera.value;
      reflectionCamera.matrixAutoUpdate = true;
      reflectionCamera.updateMatrixWorld();
      reflectionCamera.matrixWorldInverse.copy(reflectionCamera.matrixWorld).invert();
    }

    this.water = water;
    this.scene.add(water);

  } catch (error) {
    console.error("Error creating water:", error);
  }
}

_initializeMobileShader() {
  if (!this.engine.settings?.isMobile) return;
  
  const water = this.water;
  
  // Replace complex water shader with ultra-simple version
  water.material.onBeforeCompile = (shader) => {
    // Simplified vertex shader
    shader.vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    // Simplified fragment shader
    shader.fragmentShader = `
      uniform vec3 waterColor;
      uniform float time;
      uniform sampler2D waterNormals;
      varying vec2 vUv;
      
      void main() {
        vec2 uv = vUv * 8.0 + time * 0.05;
        vec4 normal = texture2D(waterNormals, uv);
        
        vec3 finalColor = waterColor + normal.rgb * 0.1;
        gl_FragColor = vec4(finalColor, 0.7);
      }
    `;
    
    water.material.needsUpdate = true;
  };
}

_checkPerformance() {
  if (!this.engine.settings?.isMobile) return;
  
  const fps = this.engine.performanceMonitor?.getCurrentFPS() || 30;
  
  if (fps < 30) {
    // Emergency optimizations
    this.water.material.uniforms['alpha'].value = 0.5;
    this.water.material.transparent = true;
    this.water.material.defines.USE_REFLECTION = 0;
    this.water.material.defines.USE_REFRACTION = 0;
    this.water.material.needsUpdate = true;
    
    // Increase position update interval
    this._updateInterval = 1000; // Only update every second
    
    console.log('Water: Emergency performance mode activated');
  }
}
  // /**
  //  * Update the water system (called each frame)
  //  * @param {number} deltaTime - Time elapsed since last update
  //  */

// _update(deltaTime) {
//   if (this.water) {
//     // No longer forcing water color - we've fixed the root cause
//     // Just maintain consistent reflections based on quality level
    
//     // Use default animation speed for desktop, adjust for mobile only
//     let animationSpeed = WATER_CONSTANTS.ANIMATION_SPEEDS.DEFAULT;
    
//     // Only adjust animation speed on mobile
//     if (this.engine.settings && this.engine.settings.isMobile && this._waterQuality) {
//       animationSpeed = this._waterQuality === 'low' ? WATER_CONSTANTS.ANIMATION_SPEEDS.LOW_MOBILE : 
//                         this._waterQuality === 'medium' ? WATER_CONSTANTS.ANIMATION_SPEEDS.MEDIUM_MOBILE : 
//                         WATER_CONSTANTS.ANIMATION_SPEEDS.DEFAULT;
//     }
    
//     this.water.material.uniforms['time'].value += deltaTime * animationSpeed;
    
//     const atmosphereSystem = this.engine.systems.get('atmosphere');
//     if (atmosphereSystem && atmosphereSystem.sun) {
//         // Use getSunPosition() instead of accessing position directly
//         const sunDirection = atmosphereSystem.sun.getSunPosition().normalize();
//         this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
//     }

//     // Update position without rounding to avoid reflection jumps
//     if (this.engine.camera) {
//       this.water.position.x = this.engine.camera.position.x;
//       this.water.position.z = this.engine.camera.position.z;
//     }
    
//     // Modify reflection processing for mobile
//     if (this.engine.settings && this.engine.settings.isMobile) {
//       // Apply reflection matrix based on current quality
//       let reflectionMatrix;
      
//       switch (this._waterQuality) {
//         case 'low':
//           // Very minimal reflection
//           reflectionMatrix = new THREE.Matrix4().makeScale(0.05, 0.05, 0.05);
//           break;
          
//         case 'medium':
//           // Reduced reflection
//           reflectionMatrix = new THREE.Matrix4().makeScale(0.3, 0.3, 0.3);
//           break;
          
//         case 'high':
//           // Moderate reflection for mobile
//           reflectionMatrix = new THREE.Matrix4().makeScale(0.7, 0.7, 0.7);
//           break;
//       }
      
//       // Apply the appropriate reflection matrix
//       if (this.water && this.water.material && this.water.material.uniforms['textureMatrix']) {
//         this.water.material.uniforms['textureMatrix'].value.copy(reflectionMatrix);
//       }
      
//       // Skip the rest of desktop-specific reflection processing
//       return;
//     }
    
//     // Initialize reflection camera when it becomes available
//     if (!this._reflectionCameraInitialized && this.water.material.uniforms.reflectionCamera) {
//       const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
//       // Configure base layers (default scene content)
//       reflectionCamera.layers.set(0);  // Reset to default layer
//       reflectionCamera.layers.enable(1); // Regular scene
      
//       // On mobile, only enable cloud reflections for high quality
//       if (!this.engine.settings || !this.engine.settings.isMobile || 
//           this._waterQuality === 'high') {
//         reflectionCamera.layers.enable(2); // Cloud reflections
//       }
      
//       this._reflectionCameraInitialized = true;
//     }
    
//     // Update reflection using SunSystem's enableReflections method
//     if (this.engine.systems.atmosphere && this.engine.systems.atmosphere.sunSystem) {
//       const sunSystem = this.engine.systems.atmosphere.sunSystem;
      
//       // Store the original onBeforeRender function
//       if (!this._originalOnBeforeRender && this.water.onBeforeRender) {
//         this._originalOnBeforeRender = this.water.onBeforeRender;
//       }
      
//       // Override onBeforeRender to control the sun in water reflections
//       this.water.onBeforeRender = (renderer, scene, camera) => {
//       // For mobile devices, ensure consistent reflections based on quality
//       if (this.engine.settings && this.engine.settings.isMobile) {
//         // Apply quality-appropriate reflection matrix
//         let reflectionMatrix;
        
//         switch (this._waterQuality) {
//           case 'low':
//             reflectionMatrix = new THREE.Matrix4().makeScale(0.05, 0.05, 0.05);
//             break;
//           case 'medium':
//             reflectionMatrix = new THREE.Matrix4().makeScale(0.3, 0.3, 0.3);
//             break;
//           case 'high':
//             reflectionMatrix = new THREE.Matrix4().makeScale(0.7, 0.7, 0.7);
//             break;
//         }
        
//         // Apply the appropriate reflection matrix
//         if (this.water.material.uniforms['textureMatrix']) {
//           this.water.material.uniforms['textureMatrix'].value.copy(reflectionMatrix);
//         }
//       }

//           if (!this._reflectionCameraInitialized || !this.water.material.uniforms.reflectionCamera) {
//           // Skip if reflection camera isn't ready
//           if (this._originalOnBeforeRender) {
//             this._originalOnBeforeRender(renderer, scene, camera);
//           }
//           return;
//         }
        
//         // Get the sun position and check if it's above horizon AND visible
//         const sunPos = sunSystem.getSunPosition();
//         // Use a higher threshold to account for mountains
//         const safeThreshold = sunSystem.HORIZON_LEVEL + 200;
//         const isSunHighEnough = sunPos.y > safeThreshold;
        
//         // Check distance from camera for LOD if MobileLODManager is available
//         let enableReflections = isSunHighEnough;
        
//         if (this.engine.systems.mobileLOD && 
//             this.engine.settings && 
//             this.engine.settings.isMobile) {
//           // Get distance-based water reflection settings
//           const distanceThresholds = this.engine.systems.mobileLOD.getLODDistances().water;
//           const player = this.engine.systems.player?.localPlayer;
          
//           if (player) {
//             const playerDistance = this.water.position.distanceTo(player.position);
            
//             // Only enable high-quality water reflections for nearby water
//             if (playerDistance > distanceThresholds.reflection) {
//               enableReflections = false;
//             }
//           }
//         }
        
//         // Use SunSystem's enableReflections method
//         sunSystem.enableReflections(enableReflections);
        
//         // Call original render function
//         if (this._originalOnBeforeRender) {
//           this._originalOnBeforeRender(renderer, scene, camera);
//         }
//       };
//     }
//   }
  
//   // Check performance and update quality if needed - but ONLY on mobile
//   if (this.engine.settings && this.engine.settings.isMobile) {
//     const currentQuality = this._waterQuality;
//     let shouldUpdateQuality = false;
//     let newQuality = currentQuality;
    
//     // Check if MobileLODManager wants to change water quality
//     if (this.engine.systems.mobileLOD) {
//       const reflectionEnabled = this.engine.systems.mobileLOD.currentWaterReflectionEnabled;
      
//       if (!reflectionEnabled && currentQuality !== 'low') {
//         newQuality = 'low';
//         shouldUpdateQuality = true;
//         console.log('MobileLOD Manager: Downgrading water quality to improve performance');
//       } else if (reflectionEnabled && currentQuality === 'low') {
//         newQuality = 'medium';
//         shouldUpdateQuality = true;
//         console.log('MobileLOD Manager: Upgrading water quality as performance allows');
//       }
//     }
    
//     // Also check direct performance metrics for very low FPS situations
//     if (this.engine.performanceMonitor && this._waterQuality) {
//       const report = this.engine.performanceMonitor.generateReport();
      
//       // If FPS drops below threshold, check if we need to update water quality
//       // More aggressive for mobile - force low quality on very poor performance
//       if (report.current.fps < WATER_CONSTANTS.FPS_THRESHOLDS.LOW) {
//         newQuality = 'low'; // Always set to low for poor performance mobile
//         shouldUpdateQuality = true;
//         console.log(`Mobile: Very low FPS detected (${report.current.fps.toFixed(1)}), setting water quality to low`);
//       }
//     }
      
//     // Apply quality changes if needed
//     if (shouldUpdateQuality && newQuality !== currentQuality) {
//       // Remove existing water
//       if (this.water) {
//         this.scene.remove(this.water);
//         this.water.geometry.dispose();
//         this.water.material.dispose();
//       }
      
//       // Update settings
//       if (this.engine.settings) {
//         this.engine.settings.setQuality('water', newQuality);
//       }
      
//       // Create new water with updated quality
//       this.createWater();
      
//       // Apply proper reflection settings for the new quality level
//       if (this.water && this.water.material && 
//           this.engine.settings && this.engine.settings.isMobile) {
        
//         // Apply appropriate reflection matrix based on new quality
//         let reflectionMatrix;
        
//         switch (newQuality) {
//           case 'low':
//             reflectionMatrix = new THREE.Matrix4().makeScale(0.05, 0.05, 0.05);
//             break;
//           case 'medium':
//             reflectionMatrix = new THREE.Matrix4().makeScale(0.3, 0.3, 0.3);
//             break;
//           case 'high':
//             reflectionMatrix = new THREE.Matrix4().makeScale(0.7, 0.7, 0.7);
//             break;
//         }
        
//         // Apply the reflection matrix
//         if (this.water.material.uniforms['textureMatrix']) {
//           this.water.material.uniforms['textureMatrix'].value.copy(reflectionMatrix);
//         }
        
//         console.log(`Mobile: Applied ${newQuality} quality water reflections after quality change`);
//       }
//     }
    
//     // If FPS still extremely low after applying low quality settings, disable water entirely
//     if (this.engine.performanceMonitor) {
//       const report = this.engine.performanceMonitor.generateReport();
//       if (report.current.fps < WATER_CONSTANTS.FPS_THRESHOLDS.VERY_LOW && 
//           this._waterQuality === 'low' && this.water && this.water.visible) {
//         console.log(`Mobile: Emergency performance mode - making water invisible`);
//         // Hide water entirely without removing it
//         this.water.visible = false;
//       }
//       // If FPS recovers, make water visible again
//       else if (report.current.fps > WATER_CONSTANTS.FPS_THRESHOLDS.RECOVER && 
//                this._waterQuality === 'low' && this.water && !this.water.visible) {
//         console.log(`Mobile: Performance recovered - making water visible again`);
//         this.water.visible = true;
//       }
//     }
//   }
// }


// In WaterSystem.js
_update(deltaTime) {
  if (!this.water) return;

  const isMobile = this.engine.settings?.isMobile;
  
  // Get current camera from renderer manager
  const camera = this.engine.renderer.getCurrentCamera();
  if (!camera) return;

  // Update water position relative to camera
  if (isMobile) {
    // On mobile, update less frequently
    const now = performance.now();
    if (!this._lastUpdate || now - this._lastUpdate > 500) {
      this.water.position.x = Math.round(camera.position.x / 10) * 10;
      this.water.position.z = Math.round(camera.position.z / 10) * 10;
      this.water.updateMatrix();
      this._lastUpdate = now;
    }
  } else {
    // On desktop, update every frame
    this.water.position.x = camera.position.x;
    this.water.position.z = camera.position.z;
  }

  // Update water animation
  const animationSpeed = isMobile ? 0.2 : 1.0;
  this.water.material.uniforms['time'].value += deltaTime * animationSpeed;

  // Update reflections
  if (!isMobile || !this._lastReflectionUpdate || 
      performance.now() - this._lastReflectionUpdate > 1000) {
    
    const atmosphereSystem = this.engine.systems.get('atmosphere');
    if (atmosphereSystem?.sun) {
      const sunDirection = atmosphereSystem.sun.getSunPosition().normalize();
      this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
    }

    // Ensure reflection camera matrices are up to date
    if (this.water.material.uniforms.reflectionCamera?.value) {
      const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
      reflectionCamera.matrixWorldInverse.copy(reflectionCamera.matrixWorld).invert();
    }

    this._lastReflectionUpdate = performance.now();
  }
}

// Update water creation to handle reflection camera properly
createWater() {
  try {
    const isMobile = this.engine.settings?.isMobile;
    
    // ... existing water creation code ...

    // Ensure reflection camera is properly initialized
    if (water.material.uniforms.reflectionCamera?.value) {
      const reflectionCamera = water.material.uniforms.reflectionCamera.value;
      reflectionCamera.matrixAutoUpdate = true;
      reflectionCamera.updateMatrixWorld();
      reflectionCamera.matrixWorldInverse.copy(reflectionCamera.matrixWorld).invert();
    }

    // ... rest of the creation code ...

  } catch (error) {
    console.error("Error creating water:", error);
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
        this.scene.remove(this.water);
        this.water.geometry.dispose();
        this.water.material.dispose();
    }
}
}