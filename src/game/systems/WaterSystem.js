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
   
  createWater() {
    
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
  
    const water = new Water(waterGeometry, {
      textureWidth: 2048,
      textureHeight: 2048,
      waterNormals: new TextureLoader().load('textures/2waternormals.jpg', function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2); // Gentle repeat to reduce stretching
      }),
      sunDirection: new THREE.Vector3(), // Will be updated in update method
      sunColor: 0xffffff,
      waterColor: 0x001e8f, // More vibrant blue that won't show terrain
      distortionScale: 1.2, // Only slightly reduced from 1.5
      clipBias: 0.0001, // Moderately increased from 0.00001
      fog: this.scene.fog !== undefined,
      alpha: 0.95 // Higher opacity to mask terrain
    });
  
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
      // Update time at a reduced rate to slow down wave animation
      this.water.material.uniforms['time'].value += deltaTime * 0.8;
      
      // Sync with atmosphere system sun direction if available
      if (this.engine.systems.atmosphere && this.engine.systems.atmosphere.sunLight) {
        const sunDirection = this.engine.systems.atmosphere.sunLight.position.clone().normalize();
        this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
      }
    }
  
    if (this.engine.camera) {
      // Follow camera but round to integer to avoid sub-pixel rendering issues
      this.water.position.x = Math.round(this.engine.camera.position.x);
      this.water.position.z = Math.round(this.engine.camera.position.z);
      
      // Adjust water transparency based on camera position
      // More transparent when underwater, more opaque when above
      if (this.isUnderwater(this.engine.camera.position)) {
        this.water.material.uniforms['alpha'].value = 0.8;
        } else {
        this.water.material.uniforms['alpha'].value = 0.95;
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