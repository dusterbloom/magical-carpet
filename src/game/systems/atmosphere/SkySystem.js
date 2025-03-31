import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

/**
 * SkySystem - Manages the sky background and fog
 */
export class SkySystem {
  /**
   * Create a new SkySystem
   * @param {AtmosphereSystem} atmosphereSystem - The parent atmosphere system
   */
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.engine = atmosphereSystem.engine;
    this.sky = null;
  }
  
  /**
   * Initialize the sky system
   */
  async initialize() {
    console.log("Initializing SkySystem...");
    
    // Create Three.js Sky
    this.sky = new Sky();
    this.sky.scale.setScalar(30000);
    this.scene.add(this.sky);
    
    // Configure sky parameters
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 8;
    uniforms['rayleigh'].value = 1;
    uniforms['mieCoefficient'].value = 0.025;
    uniforms['mieDirectionalG'].value = 0.999;
    
    // Set renderer tone mapping exposure
    this.engine.renderer.toneMappingExposure = 0.6;
    
    // Initialize scene fog
    this.scene.fog = new THREE.FogExp2(0x88ccff, 0.00003);
    
    console.log("SkySystem initialization complete");
  }
  
  // Direct sun creation method removed - now using SunSystem
  
  /**
   * Update the sky system
   * @param {number} delta - Time delta in minutes
   */
  update(delta) {
    // Update sky colors based on time of day
    this.updateSkyColors();
    
    // Make sure sky follows camera
    if (this.sky && this.engine.camera) {
      this.sky.position.copy(this.engine.camera.position);
    }
  }
  
  // Direct sun position update method removed - now using SunSystem
  
  /**
   * Update sky colors based on time of day
   */
  updateSkyColors() {
    const timeOfDay = this.atmosphereSystem.getTimeOfDay();
    const nightFactor = this.atmosphereSystem.getNightFactor();
    let fogColor;
    
    // Update sky material properties based on time of day
    const uniforms = this.sky.material.uniforms;
    
    // Update fog color based on time of day
    if (timeOfDay < 0.25) {
      // Night to sunrise transition
      const t = timeOfDay / 0.25;
      fogColor = new THREE.Color(0x000010).lerp(new THREE.Color(0xff9933), t);
      
      // Night sky parameters
      const sunriseProgress = timeOfDay / 0.25; // 0 at midnight, 1 at sunrise
      uniforms['turbidity'].value = 8 * sunriseProgress + 0.5;
      uniforms['rayleigh'].value = 1 * sunriseProgress + 0.2;
      uniforms['mieCoefficient'].value = 0.025 * sunriseProgress + 0.001;
    } else if (timeOfDay < 0.5) {
      // Sunrise to noon
      const t = (timeOfDay - 0.25) / 0.25;
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x89cff0), t);
      
      // Morning sky parameters
      uniforms['turbidity'].value = 8;
      uniforms['rayleigh'].value = 1 * t + 0.5;
      uniforms['mieCoefficient'].value = 0.025;
    } else if (timeOfDay < 0.75) {
      // Noon to sunset
      const t = (timeOfDay - 0.5) / 0.25;
      fogColor = new THREE.Color(0x89cff0).lerp(new THREE.Color(0xff9933), t);
      
      // Afternoon sky parameters
      uniforms['turbidity'].value = 8;
      uniforms['rayleigh'].value = 1;
      uniforms['mieCoefficient'].value = 0.025;
    } else {
      // Sunset to night
      const t = (timeOfDay - 0.75) / 0.25;
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x000010), t);
      
      // Evening sky parameters
      const nightProgress = (timeOfDay - 0.75) / 0.25; // 0 at sunset, 1 at midnight
      uniforms['turbidity'].value = 8 * (1 - nightProgress) + 0.5;
      uniforms['rayleigh'].value = 1 * (1 - nightProgress) + 0.2;
      uniforms['mieCoefficient'].value = 0.025 * (1 - nightProgress) + 0.001;
    }
    
    // Adjust renderer exposure based on time of day
    const baseExposure = 0.6;
    const exposureRange = 0.4;
    this.engine.renderer.toneMappingExposure = baseExposure - nightFactor * exposureRange;
    
    // Update fog
    if (this.scene.fog) {
      this.scene.fog.color = fogColor;
    }
  }
}
