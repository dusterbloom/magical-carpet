// src/game/systems/WaterSystem.js

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
    this.waterLevel = 0;
    this.water = null;
    this.shoreline = null; // Reference to shoreline mesh for smooth transitions
    this._reflectionCameraInitialized = false;
    this._waterQuality = 'high';
    this._originalOnBeforeRender = null; // Store the original function

    // NEW: State flag for reflections
    this.reflectionsEnabled = true; // Assume enabled by default

    // Debug flag
    this._debugChecked = false;
  }

  async initialize() {
    console.log("Initializing WaterSystem...");
    if (this.engine.systems.world) {
      // Position with a larger offset from terrain minHeight to avoid z-fighting
      const baseLevel = this.engine.systems.world.minHeight || 0;
      // Ensure water isn't absurdly deep if minHeight is very low
      this.waterLevel = Math.max(baseLevel - 5, -55); // Increased offset from 2 to 5
      console.log(`Setting water level to ${this.waterLevel.toFixed(2)} based on terrain`);
    }

    // Initial quality setting based on platform
    if (this.engine.settings && this.engine.settings.isMobile) {
       // Start with reflections disabled on mobile by default for performance
      this.reflectionsEnabled = false;
      this._waterQuality = 'low'; // Reflect the disabled state
      console.log('Mobile device detected, starting with water reflections disabled.');
    } else {
      this.reflectionsEnabled = true;
      this._waterQuality = 'high';
    }


    await this.createWater(); // Use await if texture loading needs it
    console.log("WaterSystem initialized");
  }

  // NEW: Method to efficiently toggle reflections
  /**
   * Enables or disables water reflections without recreating the water object.
   * @param {boolean} enabled - True to enable reflections, false to disable.
   */
  setReflectionEnabled(enabled) {
    if (this.reflectionsEnabled === enabled) {
      return; // No change needed
    }

    this.reflectionsEnabled = enabled;
    console.log(`Water reflections set to: ${enabled}`);

    // Update the internal quality tracker if necessary (optional, but helps consistency)
    if (!enabled && this._waterQuality !== 'low') {
         this._waterQuality = 'low';
    } else if (enabled && this._waterQuality === 'low') {
         // If enabling, maybe default to medium? Or let LOD manager decide further.
         this._waterQuality = 'medium';
    }

    // No need to recreate water here. The change will be picked up
    // by the wrapped onBeforeRender function.
    // We might adjust other quality settings like distortion/texture size here
    // if needed, separate from the reflection toggle itself.
    if (this.water && this.water.material) {
         // Example: Adjust distortion based on reflection state
         // this.water.material.uniforms.distortionScale.value = enabled ? 0.8 : 0.1;
    }
  }


  async createWater() {
    // --- Determine Quality Settings (Texture Size, Distortion, Alpha) ---
    let textureSize = 2048;
    let distortionScale = 0.8;
    let alpha = 0.95;
    let waterColorHex = 0x001e0f; // Default desktop color
    
    // Shoreline transition width
    let shorelineWidth = 2.0;

    // Adjust quality based on internal state (_waterQuality)
    if (this.engine.settings && this.engine.settings.isMobile) {
        // Use the mobile-specific bright color
        waterColorHex = 0x00ccff; // Consistent bright blue for mobile visibility

        switch (this._waterQuality) {
            case 'low': // Corresponds to reflectionsEnabled = false
                textureSize = 128;
                distortionScale = 0.0; // No distortion without reflections
                alpha = 0.85;
                break;
            case 'medium':
                textureSize = 256;
                distortionScale = 0.2;
                alpha = 0.9;
                break;
            case 'high':
            default:
                textureSize = 512;
                distortionScale = 0.4; // Keep distortion moderate even on high mobile
                alpha = 0.95;
                break;
        }
        console.log(`Mobile Water: Quality='${this._waterQuality}', Reflections=${this.reflectionsEnabled}, TexSize=${textureSize}, Distortion=${distortionScale}`);
    } else {
        // Desktop quality settings (can still have high/medium/low if implemented)
        // For now, assume high for desktop
        textureSize = 1024; // Decent quality for desktop
        distortionScale = 0.8;
        alpha = 0.95;
        waterColorHex = 0x001e0f; // Standard desktop color
        console.log(`Desktop Water: Quality='high', Reflections=${this.reflectionsEnabled}, TexSize=${textureSize}, Distortion=${distortionScale}`);
    }

    // --- Create Water Geometry and Object ---
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

    // Load normals texture asynchronously
    const waterNormals = await new Promise((resolve, reject) => {
        new TextureLoader().load('textures/2waternormals.jpg',
            (texture) => {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(32, 32);
                resolve(texture);
            },
            undefined, // onProgress
            (error) => {
                 console.error("Failed to load water normals texture", error);
                 // Create a fallback normal map (flat blue)
                 const fallbackCanvas = document.createElement('canvas');
                 fallbackCanvas.width = 1;
                 fallbackCanvas.height = 1;
                 const ctx = fallbackCanvas.getContext('2d');
                 ctx.fillStyle = 'rgb(128, 128, 255)'; // Neutral normal color
                 ctx.fillRect(0, 0, 1, 1);
                 resolve(new THREE.CanvasTexture(fallbackCanvas));
            }
        );
    });


    this.water = new Water(waterGeometry, {
      textureWidth: textureSize,
      textureHeight: textureSize,
      waterNormals: waterNormals,
      sunDirection: new THREE.Vector3(), // Updated in update loop
      sunColor: 0xffffff,
      waterColor: waterColorHex,
      distortionScale: distortionScale,
      clipBias: 0.001,
      fog: this.scene.fog !== undefined,
      alpha: alpha
    });

    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = this.waterLevel;
    this._reflectionCameraInitialized = false;

    // --- Wrap onBeforeRender ---
    if (this.water.onBeforeRender) {
        this._originalOnBeforeRender = this.water.onBeforeRender; // Store original
    } else {
         // Should not happen with THREE.Water, but good practice
         this._originalOnBeforeRender = () => {};
    }

    // Assign the wrapper function
    this.water.onBeforeRender = (renderer, scene, camera) => {
      // Initialize reflection camera layers ONCE
      if (!this._reflectionCameraInitialized && this.water.material.uniforms.reflectionCamera) {
        const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
        reflectionCamera.layers.set(0); // Base layer
        reflectionCamera.layers.enable(1); // Regular scene objects
        reflectionCamera.layers.enable(2); // Clouds
        reflectionCamera.layers.enable(10); // Sun layer (initially enabled)
        this._reflectionCameraInitialized = true;
        console.log("Reflection camera initialized with layers.");
      }

      // Conditionally execute the original reflection rendering
      if (this.reflectionsEnabled && this._originalOnBeforeRender) {
         // Check if sun should be visible in reflections
         const sunSystem = this.engine.systems.atmosphere?.sunSystem;
         if (sunSystem && this._reflectionCameraInitialized) {
             const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
             const sunPos = sunSystem.getSunPosition();
             // Use a higher threshold to account for mountains/horizon variations
             const safeThreshold = sunSystem.HORIZON_LEVEL + 100;
             const isSunHighEnough = sunPos.y > safeThreshold;

             // Enable/disable sun layer (10) for reflection camera
             if (isSunHighEnough) {
                 reflectionCamera.layers.enable(10);
             } else {
                 reflectionCamera.layers.disable(10);
             }
             // Ensure other layers remain enabled
             reflectionCamera.layers.enable(0);
             reflectionCamera.layers.enable(1);
             reflectionCamera.layers.enable(2);
         }

        // Call the original onBeforeRender using the water object as context
        this._originalOnBeforeRender.call(this.water, renderer, scene, camera);

      } else {
        // Reflections are disabled, skip the original onBeforeRender
        // Ensure the reflection map uniform is handled gracefully if needed
        // Option: Set reflection map to null or a dummy texture?
        // if (this.water.material.uniforms.tReflectionMap) {
        //    this.water.material.uniforms.tReflectionMap.value = null; // Or a dummy texture
        // }
        // For THREE.Water, simply skipping onBeforeRender might be enough
        // as it won't update the render target.

         // If reflections are off, ensure sun layer is disabled for reflection camera
         if (this._reflectionCameraInitialized) {
              const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
              reflectionCamera.layers.disable(10);
         }
      }
    };

    this.scene.add(this.water);
    
    // Create transparent shore edge material for smoother shoreline transition
    const shorelineMaterial = new THREE.ShaderMaterial({
      uniforms: {
        waterColor: { value: new THREE.Color(waterColorHex) },
        shorelineWidth: { value: shorelineWidth },  // Width of shoreline transition in world units
        waterLevel: { value: this.waterLevel }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 waterColor;
        uniform float shorelineWidth;
        uniform float waterLevel;
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        
        void main() {
          // Calculate distance to shoreline
          float distToShoreline = abs(vWorldPosition.y - waterLevel);
          
          // Create a smooth transition at the edge
          float edgeFactor = smoothstep(0.0, shorelineWidth, distToShoreline);
          
          // Adjust alpha based on distance to shore
          float alpha = mix(0.7, 0.95, edgeFactor);
          
          gl_FragColor = vec4(waterColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    // REMOVING the shoreline geometry as it causes visual artifacts
    // We'll rely on the improved water-terrain matching instead
    // The position and deterministic noise alignment should be sufficient
    this.shoreline = null; // No shoreline mesh
  }


  update(deltaTime) {
    if (!this.water || !this.water.material) return; // Safety check

    // --- Animation Speed ---
    let animationSpeed = 0.8;
    if (this.engine.settings && this.engine.settings.isMobile) {
        animationSpeed = this._waterQuality === 'low' ? 0.3 :
                          this._waterQuality === 'medium' ? 0.5 : 0.8;
    }
    this.water.material.uniforms['time'].value += deltaTime * animationSpeed;

    // --- Sun Direction ---
    if (this.engine.systems.atmosphere?.sunSystem) {
      const sunPosition = this.engine.systems.atmosphere.sunSystem.getSunPosition();
      const sunDirection = sunPosition.clone().normalize();
      this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
    }

    // --- Position Update with Grid Quantization ---
    if (this.engine.camera) {
      const cameraX = this.engine.camera.position.x;
      const cameraZ = this.engine.camera.position.z;
      
      // Quantize the water position to match terrain grid
      const worldSystem = this.engine.systems.world;
      if (worldSystem && worldSystem.cacheResolution) {
        // Align to the same grid as terrain (multiple of cache resolution)
        const gridX = Math.floor(cameraX / worldSystem.cacheResolution) * worldSystem.cacheResolution;
        const gridZ = Math.floor(cameraZ / worldSystem.cacheResolution) * worldSystem.cacheResolution;
        
        // Apply exact quantized position
        this.water.position.x = gridX;
        this.water.position.z = gridZ;
        
        // Apply matching deterministic micro-noise to keep consistent with terrain
        const deterministicNoise = Math.sin(gridX * 0.1) * Math.cos(gridZ * 0.1) * 0.01;
        this.water.position.y = this.waterLevel + deterministicNoise - 0.05; // Small offset to avoid z-fighting
      } else {
        // Fallback to original behavior if world system not available
        this.water.position.x = cameraX;
        this.water.position.z = cameraZ;
      }
    }
    
    // No shoreline to update - removed due to visual artifacts

    // --- REMOVED Redundant Mobile Hacks ---
    // No need to force color or zero matrix here anymore.
    // Reflection state is handled by the onBeforeRender wrapper.
    // Water color is set during creation based on platform/quality.

    // --- Performance Check & Quality Update (Moved to MobileLODManager) ---
    // The logic to check FPS and recreate water is now removed from here.
    // MobileLODManager will call setReflectionEnabled() when needed.
  }

  isUnderwater(position) {
    return position.y < this.waterLevel;
  }

  getUnderwaterDepth(position) {
    if (!this.isUnderwater(position)) return 0;
    return this.waterLevel - position.y;
  }

  dispose() {
    // Clean up shoreline resources
    if (this.shoreline) {
      this.scene.remove(this.shoreline);
      if (this.shoreline.geometry) this.shoreline.geometry.dispose();
      if (this.shoreline.material) this.shoreline.material.dispose();
      this.shoreline = null;
    }
    
    if (this.water) {
      // IMPORTANT: Restore original onBeforeRender if we wrapped it
      if (this._originalOnBeforeRender) {
        this.water.onBeforeRender = this._originalOnBeforeRender;
        this._originalOnBeforeRender = null;
      }

      this.scene.remove(this.water);
      // Safely dispose geometry and material
      if (this.water.geometry) this.water.geometry.dispose();
      if (this.water.material) {
           // Dispose textures if they are managed here
           if (this.water.material.uniforms.tReflectionMap?.value) this.water.material.uniforms.tReflectionMap.value.dispose();
           if (this.water.material.uniforms.waterNormals?.value) this.water.material.uniforms.waterNormals.value.dispose();
           this.water.material.dispose();
      }
      this.water = null;
      console.log("WaterSystem disposed.");
    }
  }
}
// import * as THREE from "three";
// import { Water } from 'three/examples/jsm/objects/Water.js';
// import { TextureLoader } from 'three';

// // Constants for water system
// const WATER_CONSTANTS = {
//   // Water geometry
//   WATER_SIZE: 10000,
//   WATER_LEVEL_OFFSET: 10,
  
//   // Water quality settings
//   TEXTURE_SIZES: {
//     LOW: 64,
//     MEDIUM: 256,
//     HIGH: 1024,
//     HIGH_MOBILE: 512
//   },
  
//   DISTORTION_SCALES: {
//     LOW: 0.1,
//     MEDIUM: 0.3,
//     HIGH: 0.6,
//     HIGH_MOBILE: 0.5
//   },
  
//   ALPHA_VALUES: {
//     LOW: 0.8,
//     MEDIUM: 0.85,
//     HIGH: 0.9
//   },
  
//   // Reflection matrix scales
//   REFLECTION_SCALES: {
//     LOW: 0.05,
//     MEDIUM: 0.3,
//     HIGH: 0.7
//   },
  
//   // Animation speeds
//   ANIMATION_SPEEDS: {
//     DEFAULT: 0.8,
//     LOW_MOBILE: 0.3,
//     MEDIUM_MOBILE: 0.5
//   },
  
//   // FPS thresholds
//   FPS_THRESHOLDS: {
//     VERY_LOW: 10,
//     LOW: 15,
//     RECOVER: 20
//   },
  
//   // Colors
//   WATER_COLOR: 0x0066aa,
//   SUN_COLOR: 0xffffff,
  
//   // Texture settings
//   NORMAL_MAP_REPEAT: 32,
//   CLIP_BIAS: 0.001
// };
// /**
//  * Water system that integrates with the terrain's ocean beds
//  */
// export class WaterSystem {
//   constructor(engine) {
//     this.engine = engine;
//     this.scene = engine.scene;
    
//     // Default water level matches terrain's ocean design
//     this.waterLevel = 0;

//     // Water mesh reference
//     this.water = null;
    
//     // Debug flag
//     this._debugChecked = false;
//   }
  
//   /**
//    * Initialize the water system
//    */
//   async initialize() {
//     try {
//       console.log("Initializing WaterSystem...");
      
//       // Get the minimum height from world system if available
//       if (this.engine.systems.world) {
//         // Critical: Set water level below terrain minimum but not too far
//         // This fixes the flickering by ensuring no z-fighting at shoreline
//         this.waterLevel = this.engine.systems.world.minHeight - WATER_CONSTANTS.WATER_LEVEL_OFFSET;
//         console.log(`Setting water level to ${this.waterLevel} based on terrain`);
//       } else {
//         console.warn("World system not available - using default water level");
//       }
      
//       // Create water plane with simple material (best performance)
//       this.createWater();
      
//       console.log("WaterSystem initialized");
//     } catch (error) {
//       console.error("Failed to initialize WaterSystem:", error);
//       // Still allow the game to run even if water fails - non-critical system
//     }
//   }
  
//   /**
//    * Create the water surface
//    */
  
//   // WaterSystem.js
// createWater() {
//   try {
//     const waterGeometry = new THREE.PlaneGeometry(WATER_CONSTANTS.WATER_SIZE, WATER_CONSTANTS.WATER_SIZE);
  
//   // Get quality setting from engine if available
//   let waterQuality = 'high';
//   if (this.engine.settings && this.engine.settings.quality) {
//     waterQuality = this.engine.settings.quality.water;
//     console.log(`Creating water with ${waterQuality} quality`);
//   }
  
//   // If MobileLODManager is available, check if water reflections should be enabled
//   if (this.engine.systems.mobileLOD && 
//       this.engine.settings && 
//       this.engine.settings.isMobile) {
//     if (!this.engine.systems.mobileLOD.currentWaterReflectionEnabled) {
//       waterQuality = 'low';
//       console.log(`Mobile LOD Manager disabled water reflections for performance`);
//     }
//   }
  
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



//   // /**
//   //  * Update the water system (called each frame)
//   //  * @param {number} deltaTime - Time elapsed since last update
//   //  */

// update(deltaTime) {
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
    
//     // Update sun direction using SunSystem reference
//     if (this.engine.systems.atmosphere && 
//         this.engine.systems.atmosphere.sunSystem) {
//       const sunPosition = this.engine.systems.atmosphere.sunSystem.getSunPosition();
//       const sunDirection = sunPosition.clone().normalize();
//       this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
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


//   /**
//    * Test if a position is underwater
//    * @param {THREE.Vector3} position - The position to test
//    * @returns {boolean} True if the position is underwater
//    */
//   isUnderwater(position) {
//     return position.y < this.waterLevel;
//   }
  
//   /**
//    * Get the depth of a point underwater
//    * @param {THREE.Vector3} position - The position to test
//    * @returns {number} Depth below water (0 if not underwater)
//    */
//   getUnderwaterDepth(position) {
//     if (!this.isUnderwater(position)) return 0;
//     return this.waterLevel - position.y;
//   }
  
//   /**
//    * Clean up resources used by this system
//    */
//   dispose() {
//     if (this.water) {
//       // Restore original onBeforeRender if we overrode it
//       if (this._originalOnBeforeRender) {
//         this.water.onBeforeRender = this._originalOnBeforeRender;
//         this._originalOnBeforeRender = null;
//       }
      
//       this.scene.remove(this.water);
//       this.water.geometry.dispose();
//       this.water.material.dispose();
//       this.water = null;
//     }
//   }
// }