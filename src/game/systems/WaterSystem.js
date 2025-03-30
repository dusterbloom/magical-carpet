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
  
  const water = new Water(waterGeometry, {
    textureWidth: 2048,
    textureHeight: 2048,
    waterNormals: new TextureLoader().load('textures/2waternormals.jpg', function (texture) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(32, 32); // Gentle repeat to reduce stretching
    }),
    sunDirection: new THREE.Vector3(), // Will be updated in update method
    sunColor: 0xffffff,
    waterColor: 0x001e0f, // More vibrant blue that won't show terrain
    distortionScale: 0.8, // Only slightly reduced from 1.5
    clipBias: 0.001, // Moderately increased from 0.00001
    fog: this.scene.fog !== undefined,
    alpha: 0.95 // Higher opacity to mask terrain
  });
  
  water.rotation.x = -Math.PI / 2;
  water.position.y = this.waterLevel;
  
  // Store a reference to handle the reflection camera setup
  // (We'll initialize it properly in the update method since it might not exist yet)
  this._reflectionCameraInitialized = false;

  water.rotation.x = -Math.PI / 2;
  water.position.y = this.waterLevel;

  this.water = water;
  this.scene.add(water);
}



  // /**
  //  * Update the water system (called each frame)
  //  * @param {number} deltaTime - Time elapsed since last update
  //  */

// Add this to your update method
update(deltaTime) {
  if (this.water) {
    this.water.material.uniforms['time'].value += deltaTime * 0.8;
    
    // Update sun direction
    if (this.engine.systems.atmosphere && this.engine.systems.atmosphere.sunLight) {
      const sunDirection = this.engine.systems.atmosphere.sunLight.position.clone().normalize();
      this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
    }

    // Update position without rounding to avoid reflection jumps
    if (this.engine.camera) {
      this.water.position.x = this.engine.camera.position.x;
      this.water.position.z = this.engine.camera.position.z;
    }
    
    // Initialize reflection camera when it becomes available
    if (!this._reflectionCameraInitialized && this.water.material.uniforms.reflectionCamera) {
      const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
      // Configure base layers (default scene content)
      reflectionCamera.layers.set(0);  // Reset to default layer
      reflectionCamera.layers.enable(1); // Regular scene
      reflectionCamera.layers.enable(2); // Cloud reflections
      this._reflectionCameraInitialized = true;
    }
    
    // Check if sun is visible and set reflection accordingly
    if (this.engine.systems.atmosphere && this.engine.systems.atmosphere.sunSystem) {
      const sunSystem = this.engine.systems.atmosphere.sunSystem;
      
      // Store the original onBeforeRender function
      if (!this._originalOnBeforeRender && this.water.onBeforeRender) {
        this._originalOnBeforeRender = this.water.onBeforeRender;
      }
      
      // Override onBeforeRender to control the sun in water reflections
      this.water.onBeforeRender = (renderer, scene, camera) => {
        if (!this._reflectionCameraInitialized || !this.water.material.uniforms.reflectionCamera) {
          // Skip if reflection camera isn't ready
          if (this._originalOnBeforeRender) {
            this._originalOnBeforeRender(renderer, scene, camera);
          }
          return;
        }
        
        // Get the reflection camera
        const reflectionCamera = this.water.material.uniforms.reflectionCamera.value;
        
        // Get the sun position and check if it's above horizon AND visible
        const sunPos = sunSystem.getSunPosition();
        // Use a higher threshold to account for mountains
        // This creates a buffer zone where the sun won't reflect if it's near the horizon
        const safeThreshold = sunSystem.HORIZON_LEVEL + 200;
        const isSunHighEnough = sunPos.y > safeThreshold;
        
        // Only allow sun reflection if it's well above the horizon (above mountains)
        if (isSunHighEnough) {
          // Sun should be visible in reflection - enable layer 10
          reflectionCamera.layers.enable(10);
        } else {
          // Sun should be hidden - disable layer 10
          reflectionCamera.layers.disable(10);
        }
        
        // Call original render function
        if (this._originalOnBeforeRender) {
          this._originalOnBeforeRender(renderer, scene, camera);
        }
      };
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