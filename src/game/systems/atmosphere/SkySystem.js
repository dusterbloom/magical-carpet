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
    console.log("Initializing SkySystem with visible sun...");
    
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
    
    // Add direct sun disk to the scene
    this.createDirectSun();
    
    console.log("SkySystem initialization complete");
  }
  
  /**
   * Create a direct sun disk in the sky
   */
  createDirectSun() {
    // Create a simple, small sun disk
    const sunGeometry = new THREE.CircleGeometry(150, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.FrontSide,
      transparent: false,
      opacity: 0.91,
      // depthWrite: false,
      // depthTest: false
    });
    
    this.directSun = new THREE.Mesh(sunGeometry, sunMaterial);
    this.directSun.position.set(0, 10000, 0);
    this.directSun.renderOrder = 10001;
    this.scene.add(this.directSun);
    
    // Add a small, subtle glow
    const glowGeometry = new THREE.CircleGeometry(250, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff88,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false
    });
    
    this.sunGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.directSun.add(this.sunGlow);
    
    console.log("Direct sun created with size 150");
  }
  
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
    
    // Update direct sun position based on time of day
    if (this.directSun) {
      this.updateDirectSunPosition();
    }
  }
  
  /**
   * Update direct sun position based on time of day
   */
  updateDirectSunPosition() {
    const timeOfDay = this.atmosphereSystem.getTimeOfDay();
    const angle = (timeOfDay * Math.PI * 2) - Math.PI/2;
    const radius = 15000;
    const height = 3000; // Flatter arc
    
    // Position sun in the sky - much flatter arc to match horizon correctly
    this.directSun.position.x = Math.cos(angle) * radius; // East-West movement
    this.directSun.position.y = Math.max(-300, Math.sin(angle) * height); // Up-Down with min to hide below horizon
    this.directSun.position.z = 0; // Remove Z-axis movement
    
    // Make sun always face the camera
    if (this.engine.camera) {
      this.directSun.lookAt(this.engine.camera.position);
    }
    
    // Calculate horizon level based on terrain
    const terrainLevel = 0; // Approximate height of visible horizon
    
    // Only show sun when it's above the visual horizon 
    const isVisible = this.directSun.position.y > terrainLevel;
    this.directSun.visible = isVisible;
    this.sunGlow.visible = isVisible;
    
    // Smoother color transitions throughout the day
    if (isVisible) {
      // Calculate how close to horizon (normalized 0-1, where 1 is at horizon, 0 is high in sky)
      const horizonProximity = Math.max(0, 1 - ((this.directSun.position.y - terrainLevel) / 2000));
      
      if (timeOfDay < 0.5) { // Before noon
        // Sunrise transition (orange to yellow)
        const sunriseEffect = Math.max(0, 1 - ((timeOfDay - 0.25) / 0.15));
        const sunriseColor = new THREE.Color(0xff7700); // Deep orange
        const dayColor = new THREE.Color(0xffff00);     // Yellow
        const blendedColor = new THREE.Color().lerpColors(sunriseColor, dayColor, 1 - sunriseEffect * horizonProximity);
        
        this.directSun.material.color.copy(blendedColor);
        this.sunGlow.material.color.set(0xff9900); // Warmer glow for sunrise
      } else { // After noon
        // Sunset transition (yellow to red-orange)
        const sunsetEffect = Math.max(0, ((timeOfDay - 0.6) / 0.15));
        const sunsetColor = new THREE.Color(0xff3300); // Deep red-orange
        const dayColor = new THREE.Color(0xffff00);    // Yellow
        const blendedColor = new THREE.Color().lerpColors(dayColor, sunsetColor, sunsetEffect * horizonProximity);
        
        this.directSun.material.color.copy(blendedColor);
        this.sunGlow.material.color.set(0xff6600); // Warmer glow for sunset
      }
      
      // Scale sun size based on horizon proximity for larger sunrise/sunset
      const baseScale = 1.0;
      const horizonScale = 1.2; // 20% larger at horizon
      const scaleEffect = baseScale + (horizonScale - baseScale) * horizonProximity;
      this.directSun.scale.set(scaleEffect, scaleEffect, 1);
    }
  }
  
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
