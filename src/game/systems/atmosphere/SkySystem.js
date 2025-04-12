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
    
    // Create Three.js Sky with responsive scaling
    this.sky = new Sky();
    const screenRatio = window.innerWidth / window.innerHeight;
    const baseScale = 30000;
    this.sky.scale.setScalar(baseScale * (screenRatio < 1 ? 1.5 : 1));
    
    // Adjust sky mesh geometry for better mobile rendering
    const skyMesh = this.sky.geometry;
    skyMesh.parameters.widthSegments = Math.max(32, Math.floor(32 * screenRatio));
    skyMesh.parameters.heightSegments = Math.max(32, Math.floor(32 * screenRatio));
    
    this.scene.add(this.sky);
    
    // Enhanced sky parameters for mobile
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 10;
    uniforms['rayleigh'].value = 2;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.8;
    
    // Fix seam issue by adjusting material settings
    this.sky.material.side = THREE.BackSide;
    this.sky.material.depthWrite = false;
    
    // Store original background color
    this.originalBackgroundColor = new THREE.Color(0x88ccff);
    
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
    
    // Make sure sky follows camera with offset compensation for small screens
    if (this.sky && this.engine.camera) {
      const pos = this.engine.camera.position.clone();
      if (window.innerWidth < window.innerHeight) {
        // Add slight vertical offset on mobile to prevent horizon line issues
        pos.y += 100;
      }
      this.sky.position.copy(pos);
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
    
    // Update sky shader parameters based on time of day
    const uniforms = this.sky.material.uniforms;
    const sunPosition = this.atmosphereSystem.getSunPosition();
    
    // Update sun position with rotation compensation
    const sunPos = sunPosition.clone().normalize();
    const cameraDirection = new THREE.Vector3();
    this.engine.camera.getWorldDirection(cameraDirection);
    
    // Apply camera-relative rotation to prevent sky split
    const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
    sunPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
    uniforms['sunPosition'].value.copy(sunPos);
    
    // Adjust background color based on time of day
    if (nightFactor > 0) {
      // Night background color - very dark blue
      const bgColor = new THREE.Color(0x000014);
      bgColor.lerp(this.originalBackgroundColor, 1 - nightFactor);
      this.engine.renderer.setClearColor(bgColor);
    } else {
      // Day background color (original)
      this.engine.renderer.setClearColor(this.originalBackgroundColor);
    }
    
    // Adjust sky parameters and fog color based on time of day
    if (timeOfDay < 0.25) { // Night to sunrise
      const t = timeOfDay / 0.25;
      fogColor = new THREE.Color(0x000010).lerp(new THREE.Color(0xff9933), t);
      
      // Night sky parameters
      this.engine.renderer.toneMappingExposure = 0.1 + t * 0.4;
      uniforms['turbidity'].value = 0.5 + t * 7.5;
      uniforms['rayleigh'].value = 0.05 + t * 0.95;
      uniforms['mieCoefficient'].value = 0.001 + t * 0.024;
      
    } else if (timeOfDay < 0.5) { // Sunrise to noon
      const t = (timeOfDay - 0.25) / 0.25;
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x88ccff), t);
      
      this.engine.renderer.toneMappingExposure = 0.6;
      uniforms['turbidity'].value = 8;
      uniforms['rayleigh'].value = 1 + t * 0.5;
      uniforms['mieCoefficient'].value = 0.025;
      
    } else if (timeOfDay < 0.75) { // Noon to sunset
      const t = (timeOfDay - 0.5) / 0.25;
      fogColor = new THREE.Color(0x88ccff).lerp(new THREE.Color(0xff9933), t);
      
      this.engine.renderer.toneMappingExposure = 0.6;
      uniforms['turbidity'].value = 8 + t * 2;
      uniforms['rayleigh'].value = 1.5 - t * 0.5;
      uniforms['mieCoefficient'].value = 0.025;
      
    } else { // Sunset to night
      const t = (timeOfDay - 0.75) / 0.25;
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x000010), t);
      
      // Evening -> night transition
      this.engine.renderer.toneMappingExposure = 0.6 - t * 0.5;
      uniforms['turbidity'].value = 10 - t * 9.5;
      uniforms['rayleigh'].value = 1 - t * 0.95;
      uniforms['mieCoefficient'].value = 0.025 - t * 0.024;
    }
    
    // Update fog
    if (this.scene.fog) {
      this.scene.fog.color.copy(fogColor);
    }
  }
}

