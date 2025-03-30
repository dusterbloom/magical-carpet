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
    console.log("Initializing SunSystem...");
    
    // Create directional sunlight
    this.createSunLight();
    
    // Create visible sun sphere with glow effects
    this.createSunSphere();
    
    // Position the sun in sky (will be updated in update method)
    this.sunPosition.set(0, 12000, 0);
    this.sunSphere.position.copy(this.sunPosition);
    
    console.log("SunSystem initialized, Sun at:", this.sunPosition);
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
    // Create a large sun sphere for better visibility
    const sunGeometry = new THREE.SphereGeometry(1200, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: false,
      fog: false
    });
    
    // Create the sun mesh
    this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunSphere.renderOrder = 10000; // Ensure it renders on top
    this.sunSphere.frustumCulled = false; // Never cull the sun
    this.scene.add(this.sunSphere);
    
    // Add a point light at the sun
    const sunLight = new THREE.PointLight(0xffffcc, 1.0, 50000);
    this.sunSphere.add(sunLight);
    
    // Add inner glow
    const glowSize = 1800;
    const sunGlowGeometry = new THREE.SphereGeometry(glowSize, 32, 32);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.4,
      fog: false
    });
    
    this.sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    this.sunSphere.add(this.sunGlow);
  }
  
  update(delta) {
    const timeOfDay = this.atmosphereSystem.getTimeOfDay();
    const hours = timeOfDay * 24; // Convert to 0-24 hour format
    
    // Calculate simple day/night cycle path
    this.updateSunPosition(timeOfDay);
    
    // Update lighting based on sun position
    this.updateSunLight(timeOfDay);
    
    // console.log(`Sun position: [${this.sunPosition.x.toFixed(0)}, ${this.sunPosition.y.toFixed(0)}, ${this.sunPosition.z.toFixed(0)}], visible=${this.sunSphere.visible}`);
  }
  
  /**
   * Update the sun's position based on time of day
   * @param {number} timeOfDay - Current time of day (0.0-1.0)
   */
  updateSunPosition(timeOfDay) {
    // Simple circular path with the sun above horizon during day (0.25-0.75)
    // and below horizon during night
    const angle = (timeOfDay * Math.PI * 2) - Math.PI/2;
    const radius = 12000;
    const height = 10000;
    
    // Calculate position
    this.sunPosition.x = Math.cos(angle) * radius; // East-West movement
    this.sunPosition.y = Math.sin(angle) * height;  // Up-Down movement
    this.sunPosition.z = 0;  // Keep on the North-South plane
    
    // Update sun's position and visibility
    this.sunSphere.position.copy(this.sunPosition);
    
    // Only show sun when it's above horizon
    this.sunSphere.visible = this.sunPosition.y > -500;
  }
  
  /**
   * Calculate realistic sun position based on time of day and season
   * @param {number} timeOfDay - Current time of day (0.0-1.0)
   * @param {number} yearProgress - Current progress through year (0.0-1.0)
   * @param {number} hours - Hours in 24-hour format
   * @param {number} sunriseTime - Time of sunrise in hours
   * @param {number} sunsetTime - Time of sunset in hours
   * @param {number} seasonalTilt - Current seasonal tilt in radians
   * @param {number} dayLength - Length of day in hours
   */
  calculateSunPosition(timeOfDay, yearProgress, hours, sunriseTime, sunsetTime, seasonalTilt, dayLength) {
    // All parameters (hours, sunriseTime, sunsetTime, seasonalTilt, dayLength) are now passed in
    // from the update method, so we don't need to recalculate them
    
    // Set radius and base for sun path
    const radius = 12000; // Distance from center
    
    // Calculate the sun's angle in the sky
    // This creates an arc from east to west with the peak based on seasonal tilt
    let sunAltitude;
    let sunAzimuth;
    
    // Calculate position using simple trigonometric arc (simplified approach)
    // Convert timeOfDay (0-1) to radians for a sunrise-to-sunset arc
    const dayProgress = Math.max(0, Math.min(1, (hours - sunriseTime) / dayLength)); // 0-1 range
    
    // Azimuth: Sun moves West (-X) to East (+X)
    // Morning: Sun rises in the East (+X)
    // Evening: Sun sets in the West (-X)
    sunAzimuth = (dayProgress - 0.5) * Math.PI; // -π/2 to π/2
    
    // Altitude: Follow a sine curve from horizon to peak and back
    // Higher peak in summer, lower in winter based on seasonal tilt
    const maxHeight = Math.PI / 2 + seasonalTilt; // ~90° ± tilt
    
    if (hours >= sunriseTime && hours <= sunsetTime) {
      // Daytime: Sun follows a sine curve above horizon
      sunAltitude = Math.sin(Math.PI * dayProgress) * maxHeight;
    } else {
      // Nighttime: Sun follows a sine curve below horizon
      if (hours < sunriseTime) {
        // Before sunrise (after midnight)
        const nightProgress = hours / sunriseTime;
        sunAltitude = Math.sin(Math.PI * (nightProgress + 1)) * maxHeight;
      } else {
        // After sunset (before midnight)
        const nightProgress = (hours - sunsetTime) / (24 - sunsetTime);
        sunAltitude = Math.sin(Math.PI * (2 + nightProgress)) * maxHeight;
      }
    }
    
    // Convert to Cartesian coordinates - note signs to get correct East/West direction
    this.sunPosition.set(
      radius * Math.cos(sunAltitude) * Math.sin(sunAzimuth), // X (east-west) 
      radius * Math.sin(sunAltitude),                        // Y (up-down)
      radius * Math.cos(sunAltitude) * Math.cos(sunAzimuth)  // Z (north-south)
    );
    
    console.log(`Sun pos: time=${hours.toFixed(2)}h, alt=${sunAltitude.toFixed(2)}, az=${sunAzimuth.toFixed(2)}, [${this.sunPosition.x.toFixed(0)}, ${this.sunPosition.y.toFixed(0)}, ${this.sunPosition.z.toFixed(0)}]`);
  }
  
  /**
   * Calculate day length based on seasonal tilt
   * @param {number} seasonalTilt - Seasonal tilt in radians
   * @returns {number} Day length in hours
   */
  calculateDayLength(seasonalTilt) {
    // On equinox (spring/fall), day length is 12 hours
    // Variation based on tilt (ranges from ~8h in winter to ~16h in summer at mid latitudes)
    const equinoxDayLength = 12;
    
    // Scale factor influences how dramatic the day length changes are
    // Higher values would represent locations closer to poles
    const latitudeScale = 4; // Mid-latitude scale (4 hours variation)
    
    return equinoxDayLength + (seasonalTilt * latitudeScale);
  }
  
  /**
   * Update sunlight direction and color based on time of day
   * @param {number} timeOfDay - Current time of day (0.0-1.0)
   */
  updateSunLight(timeOfDay) {
    // Update directional light position
    this.sunLight.position.copy(this.sunPosition);
    
    // Update colors based on time of day
    if (timeOfDay > 0.25 && timeOfDay < 0.75) {
      // Daytime
      if (timeOfDay < 0.35) {
        // Sunrise - orange tint
        this.sunLight.color.setHex(0xffaa33);
        this.sunSphere.material.color.setHex(0xffaa33);
        this.sunGlow.material.color.setHex(0xff8833);
      } else if (timeOfDay > 0.65) {
        // Sunset - orange/red tint
        this.sunLight.color.setHex(0xff7733);
        this.sunSphere.material.color.setHex(0xff5500);
        this.sunGlow.material.color.setHex(0xff3300);
      } else {
        // Middle of day - yellow/white
        this.sunLight.color.setHex(0xffffcc);
        this.sunSphere.material.color.setHex(0xffff00);
        this.sunGlow.material.color.setHex(0xffff00);
      }
      
      // Brighter during day
      this.sunLight.intensity = 1.2;
      this.ambientLight.intensity = 0.7;
    } else {
      // Nighttime
      this.sunLight.color.setHex(0x334455);
      this.sunLight.intensity = 0.1;
      this.ambientLight.intensity = 0.1;
    }
  }
  
  /**
   * Calculate how close the sun is to the horizon
   * @param {number} sunY - Y position of the sun
   * @returns {number} Horizon proximity (0-1), where 1.0 = at horizon, 0.0 = far from horizon
   */
  calculateHorizonProximity(sunY) {
    // Define horizon threshold - how high the "visual horizon" is
    const horizonThreshold = 3000; // Height at which we consider the sun "far" from horizon
    
    // Calculate proximity based on height above horizon
    return Math.max(0, 1 - (Math.abs(sunY) / horizonThreshold));
  }
  
  /**
   * Update sun's visual appearance based on horizon proximity
   * @param {number} sunY - Y position of the sun
   */
  updateSunAppearance(sunY) {
    // Calculate horizon proximity for visual effects
    const horizonProximity = this.calculateHorizonProximity(sunY);
    
    // Near horizon effects
    if (horizonProximity > 0.7) {
      // Sun is near horizon - appear larger and more orange/red
      const horizonRatio = (horizonProximity - 0.7) / 0.3; // 0-1 scale for close horizon
      
      // Make sun appear larger near horizon (atmospheric distortion effect)
      const baseScale = 1.0;
      const horizonScale = 1.2; // 20% larger at horizon
      const scaleValue = baseScale + (horizonScale - baseScale) * horizonRatio;
      this.sunSphere.scale.set(scaleValue, scaleValue, 1.0); // Flatten slightly on z-axis
      
      // Adjust sun color from yellow to orange-red near horizon
      if (sunY > 0) {
        // Above horizon
        this.sunSphere.material.color.setHex(0xffaa55); // Orange at horizon
        this.sunGlow.material.color.setHex(0xff8833);
        this.sunGlow.material.opacity = 0.4;
        this.sunOuterGlow.material.color.setHex(0xff5500);
        this.sunOuterGlow.material.opacity = 0.2;
      } else {
        // Below horizon but still visible (partial sunset/sunrise)
        this.sunSphere.material.color.setHex(0xff5500); // Deep red when partially below
        this.sunGlow.material.color.setHex(0xff3300);
        this.sunGlow.material.opacity = 0.3;
        this.sunOuterGlow.material.color.setHex(0xff2200);
        this.sunOuterGlow.material.opacity = 0.15;
      }
    } else {
      // Sun is high in sky - normal appearance
      this.sunSphere.scale.set(1.0, 1.0, 1.0);
      this.sunSphere.material.color.setHex(0xffff80);
      this.sunGlow.material.color.setHex(0xffff00);
      this.sunGlow.material.opacity = 0.3;
      this.sunOuterGlow.material.color.setHex(0xffff80);
      this.sunOuterGlow.material.opacity = 0.15;
    }
  }
  
  /**
   * Get the current sun position
   * @returns {THREE.Vector3} Sun position
   */
  getSunPosition() {
    // Return an actual clone to avoid reference issues
    const pos = this.sunPosition.clone();
    console.log("GetSunPosition returning:", pos);
    return pos;
  }
}
