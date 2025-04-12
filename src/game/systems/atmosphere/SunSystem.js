import * as THREE from "three";

export class SunSystem {
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.engine = atmosphereSystem.engine;
    
    // Constants - centralized configuration
    this.SUN_RADIUS = 120;
    this.SUN_DISTANCE = 15000;
    this.MAX_HEIGHT = 3000;
    this.HORIZON_LEVEL = 0;
    
    // Components
    this.sunLight = null;
    this.sunSphere = null;
    this.sunGlow = null;
    this.ambientLight = null;
    this.sunPosition = new THREE.Vector3();
    
    // Configuration for render layers
    this.renderLayer = 10; // Default layer for the sun (used by water reflections)
    
    // Configuration for different materials/appearances
    this.sunMaterialConfig = {
      color: 0xffff00,
      opacity: 0.9
    };
    
    // Track visibility state
    this.isVisible = true;
  }
  
  async initialize() {
    this.createSunLight();
    this.createSunSphere();
    console.log("SunSystem initialized");
  }
  
  createSunLight() {
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.bias = -0.0005;
    
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.7);
    
    this.scene.add(this.sunLight);
    this.scene.add(this.ambientLight);
  }
  
  createSunSphere() {
    // Simple, small sun disk
    const sunGeometry = new THREE.CircleGeometry(this.SUN_RADIUS, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: this.sunMaterialConfig.color,
      transparent: true,
      opacity: this.sunMaterialConfig.opacity,
      side: THREE.FrontSide,
      depthWrite: false, 
      // Use depth test but with a custom depth function that always passes
      // This ensures the sun is rendered last but still positioned correctly in 3D space
      depthTest: true,
      depthFunc: THREE.AlwaysDepth
    });
    
    this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    // Set high render order to ensure sun is rendered after all landscape elements
    this.sunSphere.renderOrder = 99; // High value ensures it's drawn after terrain
    // Add the sun to a specific layer (layer 10) so we can control its visibility in reflections
    this.sunSphere.layers.set(this.renderLayer);
    this.sunSphere.visible = this.isVisible;
    this.scene.add(this.sunSphere);
    
    // Subtle glow
    const glowGeometry = new THREE.CircleGeometry(this.SUN_RADIUS * 1.8, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      depthFunc: THREE.AlwaysDepth
    });
    
    this.sunGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    // Glow inherits the layer from its parent (the sun sphere)
    this.sunSphere.add(this.sunGlow);
  }
  
  update(delta) {
    const timeOfDay = this.atmosphereSystem.getTimeOfDay();
    const yearProgress = this.atmosphereSystem.yearProgress || 0;
    
    this.updateSunPosition(timeOfDay, yearProgress);
    this.updateSunAppearance(timeOfDay);
  }
  
  updateSunPosition(timeOfDay, yearProgress) {  
    // Calculate seasonal tilt effect on path
    const seasonalTilt = 1.0 + Math.sin(yearProgress * Math.PI * 2) * 0.15;
    
    // Sun angle based on time of day (midnight = -π/2)
    const angle = (timeOfDay * Math.PI * 2) - (Math.PI/2);
    
    // Calculate position on elliptical path
    this.sunPosition.x = Math.cos(angle) * this.SUN_DISTANCE;
    this.sunPosition.y = Math.max(-200, Math.sin(angle) * this.MAX_HEIGHT * seasonalTilt);
    this.sunPosition.z = 0;
    
    // Update sun visuals and light position
    this.sunSphere.position.copy(this.sunPosition);
    this.sunLight.position.copy(this.sunPosition);
    
    // Face camera
    if (this.engine.camera) {
      this.sunSphere.lookAt(this.engine.camera.position);
    }
    
    // Apply visibility based on tracking state
    this.sunSphere.visible = this.isVisible;
  }
  
  updateSunAppearance(timeOfDay) {
    // Calculate time-independent horizon proximity
    const altitude = this.sunPosition.y;
    const horizonProximity = Math.max(0, 1 - Math.abs(altitude) / 1500);
    
    // Adjust opacity based on altitude to fade sun below horizon
    const belowHorizonFactor = altitude > 0 ? 1.0 : Math.max(0, 1.0 + (altitude / 300));
    this.sunSphere.material.opacity = 0.9 * belowHorizonFactor;
    this.sunGlow.material.opacity = 0.2 * belowHorizonFactor;
    
    this.updateSunLight(timeOfDay);
      
    // Determine color based on height and time for the sun sphere
    if (altitude > -300) {
      if (horizonProximity > 0.3) {
        // Sunrise/sunset colors
        const color = timeOfDay < 0.5 ? 0xffaa33 : 0xff7733;
        this.sunSphere.material.color.setHex(color);
        this.sunGlow.material.color.setHex(color);
      } else {
        // Daytime - yellow
        this.sunSphere.material.color.setHex(0xffff00);
        this.sunGlow.material.color.setHex(0xffff80);
      }
      
      // Scale at horizon
      const scale = 1.0 + (horizonProximity * 0.2);
      this.sunSphere.scale.set(scale, scale, 1);
    }
  }
  
  updateSunLight(timeOfDay) {
    // Update the sun light position based on the computed sunPosition
    this.sunLight.position.copy(this.sunPosition);
    
    const altitude = this.sunPosition.y;
    const horizonProximity = Math.max(0, 1 - Math.abs(altitude) / 1500);
    
    if (timeOfDay > 0.25 && timeOfDay < 0.35) {
      // Sunrise: warm hues and increased brightness
      this.sunLight.color.setHex(0xffaa33);
      this.sunLight.intensity = 1.0;
      this.ambientLight.color.setHex(0xffddaa);
      this.ambientLight.intensity = 0.4 + 0.3 * ((timeOfDay - 0.25) / 0.1);
    } else if (timeOfDay > 0.65 && timeOfDay < 0.75) {
      // Sunset: warm, fading light
      this.sunLight.color.setHex(0xff7733);
      this.sunLight.intensity = 1.0;
      this.ambientLight.color.setHex(0xffccaa);
      this.ambientLight.intensity = 0.4 + 0.3 * (1 - ((timeOfDay - 0.65) / 0.1));
    } else if (timeOfDay > 0.35 && timeOfDay < 0.65) {
      // Daytime: bright and clear
      this.sunLight.color.setHex(0xffffcc);
      this.sunLight.intensity = 1.2;
      this.ambientLight.color.setHex(0xaaccff);
      this.ambientLight.intensity = 0.7;
    } else {
      // Night: dark and cooler-toned
      this.sunLight.color.setHex(0x223344);
      this.sunLight.intensity = 0.05;
      this.ambientLight.color.setHex(0x001122);
      this.ambientLight.intensity = altitude > -300 ? Math.max(0.05, 0.3 + (1 - horizonProximity) * 0.2) : 0.05;
    }
  }
  
  getSunPosition() {
    return this.sunPosition.clone();
  }
  
  // Public methods for controlling appearance
  setSunColor(color) {
    this.sunMaterialConfig.color = color;
    if (this.sunSphere && this.sunSphere.material) {
      this.sunSphere.material.color.setHex(color);
    }
  }
  
  setSunVisibility(isVisible) {
    this.isVisible = isVisible;
    if (this.sunSphere) {
      this.sunSphere.visible = isVisible;
    }
  }
  
  // Methods to support water reflections
  enableReflections(enable) {
    if (this.sunSphere) {
      if (enable) {
        this.sunSphere.layers.enable(this.renderLayer);
      } else {
        this.sunSphere.layers.disable(this.renderLayer);
      }
    }
  }

  // Add these methods to SunSystem class
getSunDirection() {
  return this.sunDirection.clone().normalize();
}

getSunWorldPosition() {
  return this.sun.position.clone();
}

getSunColor() {
  return this.sunMaterial.color.clone();
}

getSunIntensity() {
  return this.sunLight.intensity;
}

// Add this initialization method
initSun() {
  // Remove any existing sun initialization from other systems
  this.sun = new THREE.DirectionalLight(0xffffff, 1);
  this.sun.position.set(100, 100, 100);
  this.sun.castShadow = true;
  this.scene.add(this.sun);
  
  // Add sun to physics world if needed
  this.physics.addBody(this.sun, { isStatic: true });
  
  // Initialize uniform update callback
  this.engine.onBeforeRender(() => {
    this.updateSunPosition();
    this.updateShaders();
  });
}

// Update all dependent shaders when sun changes
updateShaders() {
  const systems = [
    this.engine.systems.water,
    this.engine.systems.sky,
    this.engine.systems.terrain
  ];
  
  systems.forEach(sys => {
    if (sys?.material?.uniforms?.sunDirection) {
      sys.material.uniforms.sunDirection.value.copy(this.getSunDirection());
    }
  });
}
}