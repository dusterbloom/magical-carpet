import * as THREE from "three";

/**
 * MoonSystem - Manages the moon appearance and night lighting
 */
export class MoonSystem {
  /**
   * Create a new MoonSystem
   * @param {AtmosphereSystem} atmosphereSystem - The parent atmosphere system
   */
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.engine = atmosphereSystem.engine;
    
    // Moon components
    this.moonMesh = null;
    this.moonLight = null;
    
    // Moon position tracking
    this.moonPosition = new THREE.Vector3();
  }
  
  /**
   * Initialize the moon system
   */
  async initialize() {
    // Load moon texture
    const textureLoader = new THREE.TextureLoader();
    const moonTexture = await new Promise((resolve) => {
      textureLoader.load(
        "/assets/textures/moon.jpg",
        (texture) => resolve(texture),
        undefined,
        () => {
          console.warn("Failed to load moon texture, using fallback");
          // Create a fallback texture if the moon texture fails to load
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#eeeeee';
          ctx.fillRect(0, 0, 256, 256);
          
          // Add some basic moon details
          for (let i = 0; i < 15; i++) {
            ctx.fillStyle = `rgba(100, 100, 120, ${Math.random() * 0.5})`;
            ctx.beginPath();
            ctx.arc(
              Math.random() * 256,
              Math.random() * 256,
              Math.random() * 30 + 5,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
          
          const fallbackTexture = new THREE.CanvasTexture(canvas);
          resolve(fallbackTexture);
        }
      );
    });
    
    // Create moon mesh
    const moonGeometry = new THREE.SphereGeometry(300, 32, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({
      map: moonTexture,
      fog: false,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 1.0
    });
    
    this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    this.moonMesh.renderOrder = 100; // Render moon after most other objects
    this.scene.add(this.moonMesh);
    
    // Add moonlight
    this.moonLight = new THREE.DirectionalLight(0xdedeff, 0.2);
    this.moonLight.position.set(0, 1, 0);
    this.moonMesh.add(this.moonLight);
  }
  
  /**
   * Update the moon system
   * @param {number} delta - Time delta in minutes
   */
  update(delta) {
    const timeOfDay = this.atmosphereSystem.getTimeOfDay();
    const nightFactor = this.atmosphereSystem.getNightFactor();
    const moonPhase = this.atmosphereSystem.getMoonPhase();
    const moonIllumination = this.atmosphereSystem.getMoonIllumination();
    
    // Define moon rise time (21:30 = 0.896 of day)
    const moonRiseTime = 0.896;
    // Define moonset time (approx 12 hours later, looping if needed)
    const moonSetTime = (moonRiseTime + 0.5) % 1.0;
    
    // Calculate time-based progress for moon's travel
    let moonProgress;
    if (moonRiseTime < moonSetTime) {
      // Simple case: rise and set within same day
      if (timeOfDay >= moonRiseTime && timeOfDay <= moonSetTime) {
        moonProgress = (timeOfDay - moonRiseTime) / (moonSetTime - moonRiseTime);
      } else {
        moonProgress = -1; // Moon below horizon
      }
    } else {
      // Complex case: moon rises today, sets tomorrow
      if (timeOfDay >= moonRiseTime || timeOfDay <= moonSetTime) {
        // Calculate progress wrapping around midnight
        if (timeOfDay >= moonRiseTime) {
          moonProgress = (timeOfDay - moonRiseTime) / ((1.0 - moonRiseTime) + moonSetTime);
        } else {
          moonProgress = ((1.0 - moonRiseTime) + timeOfDay) / ((1.0 - moonRiseTime) + moonSetTime);
        }
      } else {
        moonProgress = -1; // Moon below horizon
      }
    }
    
    // Calculate moon angle based on progress (0 to PI)
    // Only valid when moonProgress is between 0 and 1
    const moonAngle = (moonProgress >= 0) ? moonProgress * Math.PI : 0;
    
    // Modify height based on moon phase
    // Moon is higher in sky during full moon, lower during new moon
    const heightFactor = 0.8 + moonIllumination * 0.4; // 0.8 to 1.2
    
    // Calculate orbital path that starts below horizon and moves across the sky
    // Similar to sun but offset in time
    const radius = 9000; // Slightly smaller than sun distance
    const height = 5000 * heightFactor;
    
    // Only calculate position if moon is visible in the sky
    let x = 0, y = 0, z = 0;
    
    if (moonProgress >= 0) {
      // Calculate y position to make moon rise and set (sine curve from 0 to PI)
      y = Math.sin(moonAngle) * height;
      
      // Calculate horizontal positions (x and z)
      // Moon rises in the east (positive x) and sets in the west (negative x)
      x = Math.cos(moonAngle) * radius;
      
      // Add some slight north/south variation based on moon phase
      // This creates a more varied path across the sky
      z = Math.sin(moonPhase * Math.PI * 2) * radius * 0.2;
    } else {
      // Moon is below the horizon, position it there
      y = -height * 0.5; // Below horizon
      
      // Position in the direction it would rise from or set to
      if (timeOfDay < moonRiseTime && timeOfDay > moonSetTime) {
        // Before moonrise, after moonset - position it in the east (where it will rise)
        x = radius;
      } else {
        // After moonrise, before moonset - shouldn't happen, but position in west
        x = -radius;
      }
      z = Math.sin(moonPhase * Math.PI * 2) * radius * 0.2;
    }
    
    this.moonPosition.set(x, y, z);
    
    // Moon is above horizon when the calculated progress is valid and resulting y position is positive
    const isAboveHorizon = moonProgress >= 0 && y > 0;
    
    // Check for occlusion with terrain or other elements
    // For now, simply use a height-based check to avoid having the moon
    // appear to set inside visible terrain chunks
    const occlusionHeight = 300; // Minimum height above terrain for moon to be visible
    const isOccluded = y > 0 && y < occlusionHeight;
    
    // Moon is visible when above horizon, not occluded, and dark enough
    this.moonMesh.visible = isAboveHorizon && !isOccluded && nightFactor > 0.05;
    
    // If visible, update position
    if (this.moonMesh.visible) {
      this.moonMesh.position.copy(this.moonPosition);
      
      // Make moon face camera
      if (this.engine.camera) {
        this.moonMesh.lookAt(this.engine.camera.position);
      }
      
      // Update moon appearance based on phase
      if (this.moonMesh.material) {
        // Adjust opacity based on illumination to simulate phases
        // Keeping this subtle so the moon is still visible during all phases
        const opacity = 0.7 + moonIllumination * 0.3;
        this.moonMesh.material.opacity = opacity;
      }
    }
    
    // Update moonlight intensity based on night factor, moon illumination, and visibility
    if (this.moonLight) {
      // Moonlight is strongest during full moon, weakest during new moon
      // Only present when moon is above horizon
      this.moonLight.intensity = isAboveHorizon ? 0.2 * nightFactor * moonIllumination : 0;
    }
    
    // Rotate the moon to show the correct phase (simplified approximation)
    // This rotates the texture to match the current phase
    this.moonMesh.rotation.y = (moonPhase * Math.PI * 2) % (Math.PI * 2);
  }
  
  /**
   * Get the current moon position
   * @returns {THREE.Vector3} Moon position
   */
  getMoonPosition() {
    return this.moonPosition.clone();
  }
}