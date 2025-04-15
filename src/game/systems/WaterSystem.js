// FILE: src/game/systems/WaterSystem.js

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
    this._savedAndroidBeforeRender = null; // Android-specific render function storage

    // State flag for reflections
    this.reflectionsEnabled = true; // Assume enabled by default

    // Track saved resolution for efficient reflection toggling
    this._savedResolution = null;

    // Platform detection
    this.isAndroid = /android/i.test(navigator.userAgent);

    // Debug flag
    this._debugChecked = false;
  }

  async initialize() {
    console.log("Initializing WaterSystem...");
    
    // Debug info about world's state
    if (this.engine.systems.world) {
      console.log("World System Details:");
      console.log(`- minHeight: ${this.engine.systems.world.minHeight}`);
      console.log(`- maxHeight: ${this.engine.systems.world.maxHeight}`);
      console.log(`- Ocean biome threshold: ${this.engine.systems.world.biomes.ocean.threshold}`);
      
      // Calculate water level with diagnostic info
      const baseLevel = this.engine.systems.world.minHeight || 0;
      this.waterLevel = Math.max(baseLevel + 10, -40); // Position water ABOVE minimum height
      console.log(`Setting water level to ${this.waterLevel.toFixed(2)} (baseLevel=${baseLevel})`);
    } else {
      this.waterLevel = 0;
      console.warn("World system not available, defaulting water level to 0");
    }

    // Detailed platform detection for better debugging
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(userAgent);
    this.isAndroid = isAndroid; // Store platform info

    // Log detailed platform information
    console.log(`WaterSystem initializing for ${isAndroid ? 'Android' : isIOS ? 'iOS' : 'Desktop'} platform`);
    if (isAndroid) {
      console.log(`Android device info: ${userAgent}`);
    }

    // Initial quality setting based on platform
    if (this.engine.settings && this.engine.settings.isMobile) {
      // Start with reflections disabled on mobile by default for performance
      this.reflectionsEnabled = false;
      this._waterQuality = 'low'; // Reflect the disabled state
      console.log(`Mobile ${isAndroid ? 'Android' : 'iOS'} device detected, starting with water reflections disabled.`);
    } else {
      this.reflectionsEnabled = true;
      this._waterQuality = 'high';
    }

    // Set global THREE.js color management to ensure proper color interpretation
    THREE.ColorManagement.enabled = true;
    
    await this.createWater(); // Use await if texture loading needs it

    // Add debug visualization to show where water level is
    if (isAndroid) {
      console.log("Adding water level debug markers");
      
      // Add a bright marker at water level
      const markerGeometry = new THREE.SphereGeometry(10, 8, 8);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(0, this.waterLevel, 0);
      this.scene.add(marker);
      
      // Log camera position
      setInterval(() => {
        if (this.engine.camera) {
          const pos = this.engine.camera.position;
          console.log(`Camera at [${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)}], Water at Y=${this.waterLevel}`);
        }
      }, 5000);
    }

    console.log("WaterSystem initialized");
  }

  /**
   * Toggle water reflections without recreating water materials
   * @param {boolean} enabled - Whether to enable reflections
   */
  setReflectionEnabled(enabled) {
    // Skip if already in the requested state
    if (this.reflectionsEnabled === enabled) return;

    // Track state change
    const prevEnabled = this.reflectionsEnabled;
    this.reflectionsEnabled = enabled;

    // Update the internal quality tracker for consistency
    if (!enabled && this._waterQuality !== 'low') {
      this._waterQuality = 'low';
    } else if (enabled && this._waterQuality === 'low') {
      this._waterQuality = 'medium';
    }

    // Detect platform for platform-specific optimizations
    const isAndroid = /android/i.test(navigator.userAgent);
    console.log(`Water reflections ${enabled ? 'enabled' : 'disabled'} without recreation (${isAndroid ? 'Android' : 'iOS/Desktop'})`);

    // Apply changes to existing water material
    if (this.water && this.water.material) {
      // Platform-agnostic changes (work on all platforms)
      if (this.water.material.uniforms) {
        // Update distortion scale
        if (this.water.material.uniforms.distortionScale) {
          this.water.material.uniforms.distortionScale.value = enabled ? 0.8 : 0.1;
        }

        // Explicitly set useReflection if it exists, but don't rely on it
        if (this.water.material.uniforms.useReflection) {
          this.water.material.uniforms.useReflection.value = enabled;
        }
      }

      // PLATFORM-SPECIFIC: Handle reflection method override for Android
      if (isAndroid) {
        // Use method replacement approach for Android
        if (!enabled) {
          // Store original onBeforeRender function if not already stored
          if (!this._savedAndroidBeforeRender && this.water.onBeforeRender) {
            this._savedAndroidBeforeRender = this.water.onBeforeRender;

            // Replace with minimal no-op function to prevent reflection updates
            this.water.onBeforeRender = (renderer, scene, camera) => {
              // Do nothing - skip reflection rendering entirely
              // This is the most direct way to prevent reflections on Android
            };
            console.log("Android: Replaced water onBeforeRender with no-op function");
          }
        } else if (this._savedAndroidBeforeRender) {
          // Restore original function when re-enabling
          this.water.onBeforeRender = this._savedAndroidBeforeRender;
          this._savedAndroidBeforeRender = null;
          console.log("Android: Restored original water onBeforeRender function");
        }
      } else {
        // NON-ANDROID: Handle reflection textures/render targets (iOS/Desktop approach)
        const reflector = this.water;
        if (reflector && reflector.getRenderTarget) {
          // Enable/disable reflection texture updates
          const target = reflector.getRenderTarget();
          if (target) {
            // Keep texture but stop updates if disabled
            if (!enabled) {
              // Store existing resolution to restore if re-enabled
              this._savedResolution = target.width;
              // Set to 2x2 minimal texture while disabled (near zero cost)
              target.setSize(2, 2);
            } else if (this._savedResolution) {
              // Restore previous resolution
              target.setSize(this._savedResolution, this._savedResolution);
            }
          }
        }
      }

      // Force material update on all platforms
      this.water.material.needsUpdate = true;
    }

    // Dispatch event for other systems
    if (this.engine.events) {
      this.engine.events.emit('water-reflection-changed', { enabled });
    }
  }

  /**
   * Set water quality with multiple parameters
   * This is a comprehensive method to control all water quality settings
   * @param {Object} options - Water quality options
   * @param {boolean} options.reflectionEnabled - Whether reflections are enabled
   * @param {string} options.quality - Quality level ('low', 'medium', 'high')
   * @param {number} options.renderDistance - Max distance for reflections
   * @param {number} options.textureSize - Size for reflection texture
   */
  setQuality(options) {
    console.log('WaterSystem: Applying quality settings:', options);

    // First handle reflection toggle - this is the most basic operation
    // and doesn't require recreation of water
    if (options.reflectionEnabled !== undefined) {
      this.setReflectionEnabled(options.reflectionEnabled);
    }

    // Update internal quality tracker
    if (options.quality) {
      this._waterQuality = options.quality;
    }

    // For other settings, we currently don't have a way to apply them without
    // recreating the water. In a future update, more parameters could be made
    // dynamic, but for now we'll just log what we would have done.
    if (options.renderDistance) {
      console.log(`Water render distance would be set to ${options.renderDistance}`);
      // Would need to update internal variables and possibly recreate water
    }

    if (options.textureSize) {
      console.log(`Water texture size would be set to ${options.textureSize}`);
      // Would need recreation of water object with new texture size
    }

    // Note: In a more advanced implementation, we could store these settings
    // and apply them when/if water is recreated, or implement more dynamic
    // control over the existing water object.
  }


  async createWater() {
    // Platform-specific water creation strategies
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = /android/i.test(userAgent);

    if (isAndroid && this.engine.settings && this.engine.settings.isMobile) {
      // Use completely different water implementation for Android
      await this.createAndroidSimplifiedWater();
      console.log("Created simplified water implementation for Android");
      return;
    }

    // Standard water implementation for iOS and desktop
    await this.createStandardWater();
  }

  /**
   * Create simplified water for Android devices
   * Avoids complex reflection/refraction issues on Android WebGL
   * @private
   */
  async createAndroidSimplifiedWater() {
    // Use a large, bright blue plane for water
    const geometry = new THREE.PlaneGeometry(20000, 20000);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0066ff, // Bright blue for visibility
      side: THREE.DoubleSide,
      depthTest: true,
      transparent: false
    });

    this.water = new THREE.Mesh(geometry, material);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, this.waterLevel, 0);
    this.water.renderOrder = 0;
    this.scene.add(this.water);

    // Set state flags
    this.reflectionsEnabled = false;
    this._waterQuality = 'low';
    this.waterHigh = null;
    this.waterLow = null;

    console.log(`Android simplified water created at y=${this.waterLevel}`);
  }

  /**
   * Create standard water with reflections for iOS and Desktop
   * @private
   */
  async createStandardWater() {
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
        console.log('Mobile water color: 0x00ccff'); // Log the color for debugging

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
    // --- POSITION FIX ---
    // Position at world origin, Y at calculated water level
    this.water.position.set(0, this.waterLevel, 0);
    // --- END POSITION FIX ---
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
        // reflectionCamera.layers.enable(2); // Clouds (disabled for clean water reflection)
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
             // reflectionCamera.layers.enable(2); // Clouds (disabled for clean water reflection)
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

    // Shoreline mesh removed
    this.shoreline = null; // No shoreline mesh
  }


  update(deltaTime) {
    if (!this.water) return; // Safety check
    
    const isAndroid = this.isAndroid || /android/i.test(navigator.userAgent);
    
    // Platform-specific water updates
    if (isAndroid && this.engine.settings && this.engine.settings.isMobile) {
      // For Android, simple updates to keep water blue and properly positioned
      if (this.engine.camera) {
        // Keep water following the camera horizontally
        const cameraPos = this.engine.camera.position;
        this.water.position.x = cameraPos.x;
        this.water.position.z = cameraPos.z;
        
        // Keep Y position at water level - this is crucial for proper rendering
        this.water.position.y = this.waterLevel;
        
        // Ensure water stays blue every frame
        if (this.water.material && this.water.material.color) {
          this.water.material.color.setHex(0x0066ff);
        }
      }
    } else {
      // Normal update for other platforms
      this.updateStandardWater(deltaTime);
      
      // Update water position to center on camera
      if (this.engine.camera) {
        const cameraPos = this.engine.camera.position;
        this.water.position.x = cameraPos.x;
        this.water.position.z = cameraPos.z;
      }
    }
  }

  /**
   * Update simplified Android water
   * @private
   */
  updateAndroidSimplifiedWater(deltaTime) {
    // ABSOLUTE MINIMAL UPDATE: Just enforce color and position
    if (!this.water) return;
    
    try {
      // Force pure blue every frame
      if (this.water.material && this.water.material.color) {
        // Set direct RGB values
        this.water.material.color.set(new THREE.Color(0, 0, 1));
      }
      
      // Keep water at consistent depth
      this.water.position.y = this.waterLevel - 5;
    } catch (e) {
      console.error("Error in Android water update:", e);
    }
  }

  /**
   * Update standard water with reflections (iOS/Desktop)
   * @private
   */
  updateStandardWater(deltaTime) {
    // --- Animation Speed ---
    let animationSpeed = 0.8;
    
    try {
      // Apply mobile-specific optimizations
      if (this.engine.settings && this.engine.settings.isMobile) {
          // Adjust animation speed based on quality level
          animationSpeed = this._waterQuality === 'low' ? 0.3 :
                           this._waterQuality === 'medium' ? 0.5 : 0.8;
                          
          // CRITICAL: Ensure consistent water color on mobile in every frame
          // This is essential to prevent the brown water issue
          if (this.water.material && this.water.material.uniforms) {
            // Force water color in multiple uniforms to ensure it takes effect
            if (this.water.material.uniforms['waterColor']) {
              this.water.material.uniforms['waterColor'].value = new THREE.Color(0x0099ff);
            }
            
            // Also update baseColor if it exists (some shader variants use this)
            if (this.water.material.uniforms['baseColor']) {
              this.water.material.uniforms['baseColor'].value = new THREE.Color(0x0099ff);
            }
            
            // Reduce distortion on mobile for better stability
            if (this.water.material.uniforms['distortionScale']) {
              const distortion = this._waterQuality === 'low' ? 0.1 :
                                this._waterQuality === 'medium' ? 0.3 : 0.5;
              this.water.material.uniforms['distortionScale'].value = distortion;
            }
          }
      }
  
      // Only update time uniform if it exists (with safety checks)
      if (this.water.material && 
          this.water.material.uniforms && 
          this.water.material.uniforms['time']) {
        
        // Cap deltaTime to prevent large jumps
        const cappedDelta = Math.min(deltaTime, 0.1);
        this.water.material.uniforms['time'].value += cappedDelta * animationSpeed;
      }
      
      // --- Sun Direction ---
      if (this.engine.systems.atmosphere && this.engine.systems.atmosphere.sunSystem &&
          this.water.material &&
          this.water.material.uniforms &&
          this.water.material.uniforms['sunDirection']) {
        const sunPosition = this.engine.systems.atmosphere.sunSystem.getSunPosition();
        const sunDirection = sunPosition.clone().normalize();
        this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
      }
    } catch (err) {
      // Graceful error handling to prevent crashes
      console.error("Error in updateStandardWater:", err);
    }
  }

  isUnderwater(position) {
    return position.y < this.waterLevel;
  }

  getUnderwaterDepth(position) {
    if (!this.isUnderwater(position)) return 0;
    return this.waterLevel - position.y;
  }

  /**
   * Clean up reflection resources specifically
   */
  cleanupReflectionResources() {
    if (this.water && this.water.getRenderTarget) {
      const target = this.water.getRenderTarget();
      if (target) {
        target.dispose();
      }
    }

    // Clean up any additional reflection-related resources
    if (this.water && this.water.material) {
      if (this.water.material.uniforms.tReflectionMap?.value) {
        this.water.material.uniforms.tReflectionMap.value.dispose();
      }
    }
  }

  /**
   * Clean up resources used by this system
   */
  dispose() {
    // Shoreline cleanup removed as shoreline mesh was removed

    // Clean up reflection resources first
    this.cleanupReflectionResources();

    // Clean up test interval if it exists
    if (this._testInterval) {
      clearInterval(this._testInterval);
      this._testInterval = null;
    }

    // Clean up diagnostic planes
    if (this.waterHigh) {
      this.scene.remove(this.waterHigh);
      if (this.waterHigh.geometry) this.waterHigh.geometry.dispose();
      if (this.waterHigh.material) this.waterHigh.material.dispose();
      this.waterHigh = null;
    }
    
    if (this.waterLow) {
      this.scene.remove(this.waterLow);
      if (this.waterLow.geometry) this.waterLow.geometry.dispose();
      if (this.waterLow.material) this.waterLow.material.dispose();
      this.waterLow = null;
    }

    if (this.water) {
      // IMPORTANT: Restore original onBeforeRender if we wrapped it
      if (this._originalOnBeforeRender) {
        this.water.onBeforeRender = this._originalOnBeforeRender;
        this._originalOnBeforeRender = null;
      }

      // IMPORTANT: Also restore the Android-specific onBeforeRender if it was saved
      if (this._savedAndroidBeforeRender) {
        this.water.onBeforeRender = this._savedAndroidBeforeRender;
        this._savedAndroidBeforeRender = null;
        console.log("Android: Restored original water render function during disposal");
      }

      this.scene.remove(this.water);
      // Safely dispose geometry and material
      if (this.water.geometry) this.water.geometry.dispose();
      if (this.water.material) {
           // Dispose water normals texture if it exists
           if (this.water.material.uniforms?.waterNormals?.value) { // Added optional chaining
             this.water.material.uniforms.waterNormals.value.dispose();
           }
           this.water.material.dispose();
      }
      this.water = null;
      console.log("WaterSystem disposed.");
    }
  }
}