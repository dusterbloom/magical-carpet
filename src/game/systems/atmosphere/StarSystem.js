import * as THREE from "three";

/**
 * StarSystem - Manages star fields
 */
export class StarSystem {
  /**
   * Create a new StarSystem
   * @param {AtmosphereSystem} atmosphereSystem - The parent atmosphere system
   */
  constructor(atmosphereSystem) {
    this.atmosphereSystem = atmosphereSystem;
    this.scene = atmosphereSystem.scene;
    this.engine = atmosphereSystem.engine;
    
    // Star fields
    this.starField = null;
    this.horizonStarField = null;
    
    // Configuration
    this.regularStarCount = 4500;
    this.horizonStarCount = 2000;
  }
  
  /**
   * Initialize the star system
   */
  async initialize() {
    // Create regular stars across the sky
    this.createRegularStars();
    
    // Create horizon stars
    this.createHorizonStars();
  }
  
  /**
   * Create regular stars across the sky
   */
  createRegularStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const sizes = [];
    const colors = [];
    
    // Generate star positions, sizes, and colors
    this.generateStarAttributes(
      positions, 
      sizes, 
      colors, 
      this.regularStarCount, 
      true
    );
    
    // Set buffer attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Create star material
    const starsMaterial = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false
    });
    
    // Create star field
    this.starField = new THREE.Points(geometry, starsMaterial);
    this.scene.add(this.starField);
  }
  
  /**
   * Create horizon stars
   */
  createHorizonStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const sizes = [];
    const colors = [];
    
    // Generate star positions, sizes, and colors
    this.generateStarAttributes(
      positions, 
      sizes, 
      colors, 
      this.horizonStarCount, 
      false
    );
    
    // Set buffer attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Create star material
    const starsMaterial = new THREE.PointsMaterial({
      size: 2, // Slightly smaller for horizon stars
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false
    });
    
    // Create horizon star field
    this.horizonStarField = new THREE.Points(geometry, starsMaterial);
    this.scene.add(this.horizonStarField);
  }
  
  /**
   * Generate star attributes (positions, sizes, colors)
   * @param {Array} positions - Output array for positions
   * @param {Array} sizes - Output array for sizes
   * @param {Array} colors - Output array for colors
   * @param {number} count - Number of stars to generate
   * @param {boolean} isRegularField - Whether this is for regular field (true) or horizon field (false)
   */
  generateStarAttributes(positions, sizes, colors, count, isRegularField) {
    for (let i = 0; i < count; i++) {
      // Random angles
      const theta = Math.random() * Math.PI * 2;
      let phi;
      
      if (isRegularField) {
        // Regular stars - full hemisphere distribution
        phi = Math.random() * Math.PI * 0.5; // Full hemisphere (0 to 90 degrees)
      } else {
        // Horizon stars - concentrated near horizon
        phi = Math.PI * (0.45 + Math.random() * 0.08); // Range ~81-95 degrees
      }
      
      // Convert to Cartesian coordinates on a sphere
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      
      // Scale to place stars far away
      const scale = isRegularField ? 6000 : (5500 + Math.random() * 500);
      positions.push(x * scale, y * scale, z * scale);
      
      // Vary the star sizes
      sizes.push(isRegularField ? (2 + Math.random() * 2) : (1 + Math.random() * 2));
      
      // Add color variation
      const starType = Math.random();
      if (isRegularField) {
        // More color variation for regular stars
        if (starType > 0.9) {
          // Blue-white stars
          colors.push(0.8, 0.9, 1.0);
        } else if (starType > 0.8) {
          // Yellow stars
          colors.push(1.0, 0.9, 0.7);
        } else if (starType > 0.7) {
          // Reddish stars
          colors.push(1.0, 0.8, 0.8);
        } else {
          // White stars (majority)
          colors.push(1.0, 1.0, 1.0);
        }
      } else {
        // Mostly white/blue for horizon stars
        if (starType > 0.7) {
          // Light blue tint
          colors.push(0.8, 0.9, 1.0);
        } else {
          // White
          colors.push(1.0, 1.0, 1.0);
        }
      }
    }
  }
  
  /**
   * Update the star system
   * @param {number} delta - Time delta in minutes
   */
  update(delta) {
    const nightFactor = this.atmosphereSystem.getNightFactor();
    
    // Update stars visibility based on night factor
    this.updateStarsVisibility(nightFactor);
    
    // Make stars follow camera
    if (this.engine.camera) {
      if (this.starField) {
        this.starField.position.copy(this.engine.camera.position);
      }
      
      if (this.horizonStarField) {
        this.horizonStarField.position.copy(this.engine.camera.position);
      }
    }
  }
  
  /**
   * Update stars visibility based on night factor
   * @param {number} nightFactor - Night factor (0.0-1.0)
   */
  updateStarsVisibility(nightFactor) {
    // Compute a flicker effect
    const time = this.atmosphereSystem.elapsed;
    const flickerRegular = 0.05 * Math.sin(time * 10);
    const flickerHorizon = 0.05 * Math.sin(time * 10 + Math.PI / 2);
    
    // Update regular stars
    if (this.starField) {
      this.starField.visible = nightFactor > 0.1; // Visible only when dark enough
      
      if (this.starField.material) {
        const baseOpacity = 0.5 + nightFactor * 0.5;
        this.starField.material.opacity = baseOpacity + flickerRegular;
      }
    }
    
    // Update horizon stars
    if (this.horizonStarField) {
      this.horizonStarField.visible = nightFactor > 0.08;
      
      if (this.horizonStarField.material) {
        const baseOpacity = Math.min(1.0, 0.6 + nightFactor * 0.4);
        this.horizonStarField.material.opacity = baseOpacity + flickerHorizon;
      }
    }
  }
}
