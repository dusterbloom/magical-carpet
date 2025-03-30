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
  // Configure which layers the water reflection camera should see
  if (water.material.uniforms.reflectionCamera) {
    const reflectionCamera = water.material.uniforms.reflectionCamera.value;
    reflectionCamera.layers.set(0); // Reset layers
    reflectionCamera.layers.enable(1); // Regular scene
    reflectionCamera.layers.enable(2); // Cloud reflections
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
      this.water = null;
    }
  }
}