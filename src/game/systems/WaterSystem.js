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
      // Critical: Set water level significantly below terrain minimum
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
  // createWater() {
  //   // Create a basic water plane that covers the entire world
  //   const worldSize = this.engine.systems.world?.chunkSize || 1024;
  //   const waterSize = worldSize * 25; // Extra large to avoid edge visibility
    
  //   const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize);
    
  //   try {
  //     // Create a simple, flat blue material with no lighting effects
  //     const waterMaterial = new THREE.MeshBasicMaterial({
  //       color: 0x0066aa,
  //       transparent: true,
  //       opacity: 0.7,
  //       side: THREE.FrontSide,
  //       depthWrite: false
  //     });
      
  //     this.water = new THREE.Mesh(waterGeometry, waterMaterial);
  //     this.water.rotation.x = -Math.PI / 2;
  //     this.water.position.y = this.waterLevel;
      
  //     // Position water far below terrain, no polygon offset or render order needed
  //     // Set a large negative y position to eliminate z-fighting
      
  //     // Add water to the scene
  //     this.scene.add(this.water);
  //   } catch (error) {
  //     console.warn("Error creating water material:", error);
      
  //     // Fallback to even simpler material
  //     const fallbackMaterial = new THREE.MeshBasicMaterial({
  //       color: 0x0066aa,
  //       transparent: true,
  //       opacity: 0.7,
  //       side: THREE.FrontSide,
  //       depthWrite: false
  //     });
      
  //     this.water = new THREE.Mesh(waterGeometry, fallbackMaterial);
  //     this.water.rotation.x = -Math.PI / 2;
  //     this.water.position.y = this.waterLevel;
      
  //     // Add water to the scene
  //     this.scene.add(this.water);
  //   }
    
  //   console.log(`Water plane created at height ${this.waterLevel}`);
  // }
  
  createWater() {
    
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
  
    const water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new TextureLoader().load('textures/2waternormals.jpg', function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: this.scene.fog !== undefined
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
  // update(deltaTime) {
  //   if (!this.water) return;
    
  //   // Keep water following camera position on XZ plane
  //   if (this.engine.camera) {
  //     // Snap directly to camera position, rounding to avoid sub-pixel issues
  //     this.water.position.x = Math.round(this.engine.camera.position.x);
  //     this.water.position.z = Math.round(this.engine.camera.position.z);
      
  //     // Leave Y position fixed at the extreme low position
      
  //     // If camera is underwater, reduce opacity
  //     if (this.engine.camera.position.y < this.waterLevel) {
  //       this.water.material.opacity = 0.4;
  //     } else {
  //       this.water.material.opacity = 0.7;
  //     }
  //   }
    
  //   // Print debug info once
  //   if (!this._debugChecked) {
  //     this._debugChecked = true;
  //     console.log("Water system debug:", {
  //       waterExists: !!this.water,
  //       waterInScene: this.scene.children.includes(this.water),
  //       waterLevel: this.waterLevel
  //     });
  //   }
  // }
  
  update(deltaTime) {
    if (this.water) {
      this.water.material.uniforms['time'].value += deltaTime;
    }
  
    if (this.engine.camera) {
      this.water.position.x = Math.round(this.engine.camera.position.x);
      this.water.position.z = Math.round(this.engine.camera.position.z);
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