import * as THREE from "three";

/**
 * SunSystem - Manages the sun appearance and lighting
 */
export class SunSystem {
  /**
   * Create a new SunSystem
   * @param {AtmosphereSystem} atmosphereSystem - The parent atmosphere system
   */
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    
    // Sun components
    this.sunLight = null;
    this.ambientLight = null;
    this.sunSphere = null;
    this.sunGlow = null;
    this.sunOuterGlow = null;
    
    // Sun position tracking
    this.sunPosition = new THREE.Vector3();
  }
  
  /**
   * Initialize the sun system
   */
  async initialize() {
    // Create directional sunlight
    this.createSunLight();
    
    // Create visible sun sphere with glow effects
    this.createSunSphere();
  }
  
  /**
   * Create directional light for sun illumination
   */
  createSunLight() {
    // Main directional light
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(0, 1000, 0);
    this.sunLight.castShadow = true;
    
    // Configure shadow properties
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 100;
    this.sunLight.shadow.camera.far = 5000;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.sunLight.shadow.bias = -0.0005;
    
    // Add ambient light for general illumination
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.7);
    
    this.scene.add(this.sunLight);
    this.scene.add(this.ambientLight);
  }
  
  /**
   * Create visible sun sphere with glow effects
   */
  createSunSphere() {
    // Create sun sphere
    const sunGeometry = new THREE.SphereGeometry(200, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff80,
      transparent: false,
      fog: false
    });
    
    this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunSphere.renderOrder = 10000; // Render after sky
    this.scene.add(this.sunSphere);
    
    // Add inner glow layer
    const sunGlowGeometry = new THREE.SphereGeometry(320, 32, 32);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3,
      fog: false
    });
    
    this.sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    this.sunSphere.add(this.sunGlow);
    
    // Add outer glow layer
    const sunOuterGlowGeometry = new THREE.SphereGeometry(500, 32, 32);
    const sunOuterGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff80,
      transparent: true,
      opacity: 0.15,
      fog: false
    });
    
    this.sunOuterGlow = new THREE.Mesh(sunOuterGlowGeometry, sunOuterGlowMaterial);
    this.sunSphere.add(this.sunOuterGlow);
  }
  
  /**
   * Update the sun system
   * @param {number} delta - Time delta in minutes
   */
  update(delta) {
    const timeOfDay = this.atmosphereSystem.getTimeOfDay();
    
    // Calculate sun position based on time of day
    const sunAngle = timeOfDay * Math.PI * 2;
    const radius = 10000;
    const height = 5000;
    
    this.sunPosition.set(
      Math.cos(sunAngle) * radius,
      Math.sin(sunAngle) * height,
      Math.sin(sunAngle * 0.5) * radius
    );
    
    // Update sun sphere position
    this.sunSphere.position.copy(this.sunPosition);
    
    // Update sun visibility (visible during day only)
    this.sunSphere.visible = timeOfDay > 0.25 && timeOfDay < 0.75;
    
    // Update sunlight position and color
    this.updateSunLight(timeOfDay);
  }
  
  /**
   * Update sunlight direction and color based on time of day
   * @param {number} timeOfDay - Current time of day (0.0-1.0)
   */
  updateSunLight(timeOfDay) {
    // Update sunlight position
    this.sunLight.position.copy(this.sunPosition);
    
    const nightFactor = this.atmosphereSystem.getNightFactor();
    
    // Update sunlight color and intensity based on time of day
    if (timeOfDay > 0.25 && timeOfDay < 0.35) {
      // Sunrise - more orange
      this.sunLight.color.setHex(0xffaa33);
      this.sunLight.intensity = 1.0;
      this.ambientLight.intensity = 0.4 + 0.3 * ((timeOfDay - 0.25) / 0.1);
      this.ambientLight.color.setHex(0x505040); // Yellowish morning ambient
    } else if (timeOfDay > 0.65 && timeOfDay < 0.75) {
      // Sunset - more orange/red
      this.sunLight.color.setHex(0xff7733);
      this.sunLight.intensity = 1.0;
      this.ambientLight.intensity = 0.4 + 0.3 * (1 - ((timeOfDay - 0.65) / 0.1));
      this.ambientLight.color.setHex(0x503030); // Reddish evening ambient
    } else if (timeOfDay > 0.35 && timeOfDay < 0.65) {
      // Day - yellow/white
      this.sunLight.color.setHex(0xffffcc);
      this.sunLight.intensity = 1.2;
      this.ambientLight.intensity = 0.7;
      this.ambientLight.color.setHex(0x404060); // Reset to default daytime ambient
    } else {
      // Night - dim blue
      this.sunLight.color.setHex(0x334455);
      this.sunLight.intensity = 0.1;
      
      // Reduce ambient light at night for darkness
      // Use a minimum value to avoid complete darkness
      this.ambientLight.intensity = 0.1;
      this.ambientLight.color.setHex(0x112233); // Bluish night ambient
    }
  }
  
  /**
   * Get the current sun position
   * @returns {THREE.Vector3} Sun position
   */
  getSunPosition() {
    return this.sunPosition.clone();
  }
}
