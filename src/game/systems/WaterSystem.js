import * as THREE from "three";

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
      // Set water level slightly above the minHeight from WorldSystem
      this.waterLevel = this.engine.systems.world.minHeight + 2;
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
    // Create a basic water plane that covers the entire world
    const worldSize = this.engine.systems.world?.chunkSize || 1024;
    const waterSize = worldSize * 20; // Large enough to cover visible area
    
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize);
    
    // Create a simple blue material with transparency
    const waterMaterial = new THREE.MeshBasicMaterial({
      color: 0x0099cc,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    this.water = new THREE.Mesh(waterGeometry, waterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = this.waterLevel;
    this.water.renderOrder = 1;
    
    // Add water to the scene
    this.scene.add(this.water);
    
    console.log(`Water plane created at height ${this.waterLevel}`);
  }
  
  /**
   * Update the water system (called each frame)
   * @param {number} deltaTime - Time elapsed since last update
   */
  update(deltaTime) {
    if (!this.water) return;
    
    // Keep water following camera position on XZ plane
    if (this.engine.camera) {
      this.water.position.x = this.engine.camera.position.x;
      this.water.position.z = this.engine.camera.position.z;
    }
    
    // Print debug info once
    if (!this._debugChecked) {
      this._debugChecked = true;
      console.log("Water system debug:", {
        waterExists: !!this.water,
        waterInScene: this.scene.children.includes(this.water),
        waterLevel: this.waterLevel
      });
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