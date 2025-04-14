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
    if (this.engine.systems.world) {
      // Position with a larger offset from terrain minHeight to avoid z-fighting
      const baseLevel = this.engine.systems.world.minHeight || 0;
      // Ensure water isn't absurdly deep if minHeight is very low
      this.waterLevel = Math.max(baseLevel - 5, -55); // Increased offset from 2 to 5
      console.log(`Setting water level to ${this.waterLevel.toFixed(2)} based on terrain`);
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

    await this.createWater(); // Use await if texture loading needs it

    // Apply specific platform optimizations after water creation
    if (isAndroid && !this.reflectionsEnabled) {
      // Ensure Android-specific reflection disabling is active from the start
      if (this.water && this.water.onBeforeRender) {
        // Store original for later restoration
        this._savedAndroidBeforeRender = this.water.onBeforeRender;

        // Replace with no-op
        this.water.onBeforeRender = () => {};
        console.log("Android: Applied reflection optimizations at initialization");
      }
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
   * This avoids all the complex reflection/refraction issues on Android WebGL
   * @private
   */
  async createAndroidSimplifiedWater() {
    // Create much simpler water with flat shading and no reflections
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000, 16, 16); // Changed from 4, 4 to 16, 16

    // Load texture for simple water
    const waterTexture = await new Promise((resolve) => {
      new TextureLoader().load('textures/2waternormals.jpg', texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(16, 16); // Large repeat for simpler pattern
        resolve(texture);
      }, undefined, err => {
        console.error("Failed to load water texture", err);
        // Create fallback texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0077bb';
        ctx.fillRect(0, 0, 128, 128);
        // Add simple wave pattern
        ctx.strokeStyle = '#0099cc';
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 16);
          for (let x = 0; x < 128; x++) {
            ctx.lineTo(x, i * 16 + Math.sin(x * 0.1) * 5);
          }
          ctx.stroke();
        }
        resolve(new THREE.CanvasTexture(canvas));
      });
    });

    // Use simple PhongMaterial instead of complex Water shader
    const waterMaterial = new THREE.MeshPhongMaterial({
      color: 0x0088cc, // Brighter blue for better visibility
      specular: 0x111111,
      shininess: 50,
      transparent: true,
      opacity: 0.85,
      flatShading: false,
      map: waterTexture
    });

    // Store animation data
    this._waterOffset = { x: 0, y: 0 };

    // Create basic mesh
    this.water = new THREE.Mesh(waterGeometry, waterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    // --- POSITION FIX ---
    // Position at world origin, Y at calculated water level
    this.water.position.set(0, this.waterLevel - 1.0, 0); // Changed from -0.2 to -1.0
    // --- END POSITION FIX ---
    this.water.renderOrder = 10; // Ensure water renders after terrain

    // No reflections for Android simplified water
    this.reflectionsEnabled = false;
    this._waterQuality = 'low';

    // Add to scene
    this.scene.add(this.water);
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
    
    // Handle platform-specific water updates
    if (isAndroid && this.engine.settings && this.engine.settings.isMobile) {
      this.updateAndroidSimplifiedWater(deltaTime);
    } else {
      this.updateStandardWater(deltaTime);
    }

    // Update water position to align with terrain grid
    const worldSystem = this.engine.systems.world;
    if (worldSystem && worldSystem.cacheResolution) {
      // Get the camera position for centering the water plane
      const cameraX = this.engine.camera.position.x;
      const cameraZ = this.engine.camera.position.z;
      
      // Calculate grid-aligned position
      const gridX = Math.round(cameraX / worldSystem.cacheResolution) * worldSystem.cacheResolution;
      const gridZ = Math.round(cameraZ / worldSystem.cacheResolution) * worldSystem.cacheResolution;
      
      // Apply exact quantized position
      this.water.position.x = gridX;
      this.water.position.z = gridZ;
      
      // Calculate deterministic micro-noise to match terrain
      const deterministicNoise = Math.sin(gridX * 0.1) * Math.cos(gridZ * 0.1) * 0.01;
      
      // Adjust Y position based on platform
      const platformOffset = isAndroid ? 0.2 : 0.05;
      this.water.position.y = this.waterLevel + deterministicNoise - platformOffset;
    }
  }

  /**
   * Update simplified Android water
   * @private
   */
  updateAndroidSimplifiedWater(deltaTime) {
    // Simple texture-based animation for Android water
    if (this.water && this.water.material && this.water.material.map) {
      // Slow continuous movement for water texture
      const texture = this.water.material.map;
      const speed = 0.03; // Reduced animation speed for better performance

      // Initialize offset if needed
      this._waterOffset = this._waterOffset || { x: 0, y: 0 };

      // Increment offset for animation
      this._waterOffset.y += deltaTime * speed * 0.5;
      this._waterOffset.x += deltaTime * speed * 0.2;

      // Apply texture offset for simple water animation
      texture.offset.set(this._waterOffset.x % 1, this._waterOffset.y % 1);
      this.water.material.needsUpdate = true;
    }
  }

  /**
   * Update standard water with reflections (iOS/Desktop)
   * @private
   */
  updateStandardWater(deltaTime) {
    // --- Animation Speed ---
    let animationSpeed = 0.8;
    if (this.engine.settings && this.engine.settings.isMobile) {
        animationSpeed = this._waterQuality === 'low' ? 0.3 :
                          this._waterQuality === 'medium' ? 0.5 : 0.8;
    }

    // Only update time uniform if it exists
    if (this.water.material && this.water.material.uniforms && this.water.material.uniforms['time']) {
      this.water.material.uniforms['time'].value += deltaTime * animationSpeed;
    }

    // --- Sun Direction ---
    if (this.engine.systems.atmosphere?.sunSystem &&
        this.water.material &&
        this.water.material.uniforms &&
        this.water.material.uniforms['sunDirection']) {
      const sunPosition = this.engine.systems.atmosphere.sunSystem.getSunPosition();
      const sunDirection = sunPosition.clone().normalize();
      this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
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