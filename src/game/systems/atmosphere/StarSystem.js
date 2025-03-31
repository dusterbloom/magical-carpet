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
    // Initialize fade thresholds array if not already created
    this.starFadeThresholds = this.starFadeThresholds || {};
    this.starFadeThresholds[isRegularField ? 'regular' : 'horizon'] = new Float32Array(count);
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
      
      // Vary the star sizes with more randomness
      sizes.push(isRegularField ? 
        (1.5 + Math.random() * 3) : // Increased range for more variety
        (0.8 + Math.random() * 2.4));
        
      // Store individual fade thresholds for each star
      const fadeThreshold = Math.random() * 0.05; // Random fade-in offset
      this.starFadeThresholds[isRegularField ? 'regular' : 'horizon'][i] = fadeThreshold;
      
      // Add enhanced color variation
      const starType = Math.random();
      
      if (isRegularField) {
        // More color variation for regular stars
        if (starType > 0.92) {
          // Bright blue-white stars (O and B class)
          colors.push(0.8 + Math.random() * 0.2, 0.85 + Math.random() * 0.15, 1.0);
        } else if (starType > 0.85) {
          // Yellow-orange stars (G and K class)
          colors.push(1.0, 0.7 + Math.random() * 0.3, 0.4 + Math.random() * 0.3);
        } else if (starType > 0.78) {
          // Reddish stars (M class)
          colors.push(1.0, 0.5 + Math.random() * 0.3, 0.5 + Math.random() * 0.3);
        } else if (starType > 0.7) {
          // White-blue stars (A class)
          colors.push(0.9 + Math.random() * 0.1, 0.9 + Math.random() * 0.1, 1.0);
        } else {
          // White stars (majority)
          const value = 0.9 + Math.random() * 0.1;
          colors.push(value, value, value);
        }
      } else {
        // Mostly white/blue for horizon stars
        if (starType > 0.8) {
          // Light blue tint
          colors.push(0.7 + Math.random() * 0.3, 0.8 + Math.random() * 0.2, 1.0);
        } else if (starType > 0.6) {
          // Slight yellow tint
          colors.push(1.0, 0.9 + Math.random() * 0.1, 0.8 + Math.random() * 0.2);
        } else {
          // White with slight variation
          const value = 0.9 + Math.random() * 0.1;
          colors.push(value, value, value);
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
    
    // Update star twinkle effect (subtle size/color variation)
    this.updateStarTwinkle(delta);
  }
  
  /**
   * Update star twinkling effect
   * @param {number} delta - Time delta in minutes
   */
  updateStarTwinkle(delta) {
    // Only update twinkling if stars are visible
    if (!this.starField || !this.horizonStarField) return;
    
    // Slow subtle twinkling based on time
    const time = this.atmosphereSystem.elapsed;
    
    // We'll use sine waves at different frequencies for natural variation
    // This is very subtle but adds life to the stars
    if (Math.random() > 0.99) { // Only occasionally update to save performance
      // Get size attributes from both star fields
      const regularSizes = this.starField.geometry.getAttribute('size');
      const horizonSizes = this.horizonStarField.geometry.getAttribute('size');
      
      // Update a few random stars' sizes for twinkling effect
      for (let i = 0; i < 20; i++) {
        const regularIndex = Math.floor(Math.random() * this.regularStarCount);
        const horizonIndex = Math.floor(Math.random() * this.horizonStarCount);
        
        // Subtle size variations for twinkling
        const regularTwinkle = 0.1 * Math.sin(time * 3 + regularIndex);
        const horizonTwinkle = 0.1 * Math.sin(time * 2.7 + horizonIndex);
        
        // Apply the twinkle effect
        const baseRegularSize = regularSizes.getX(regularIndex);
        regularSizes.setX(regularIndex, baseRegularSize + regularTwinkle);
        
        const baseHorizonSize = horizonSizes.getX(horizonIndex);
        horizonSizes.setX(horizonIndex, baseHorizonSize + horizonTwinkle);
      }
      
      // Mark attributes as needing update
      regularSizes.needsUpdate = true;
      horizonSizes.needsUpdate = true;
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
    
    // Update regular stars - always visible, control with opacity
    if (this.starField) {
      // Only make visible when we're starting to fade in (performance optimization)
      this.starField.visible = nightFactor > 0.03;
      
      if (this.starField.material) {
        // Use smoothstep for a gradual fade-in transition
        const fadeValue = this.smoothstep(0.05, 0.3, nightFactor);
        const baseOpacity = fadeValue * 0.8; // Reduced max opacity
        this.starField.material.opacity = baseOpacity + flickerRegular;
      }
    }
    
    // Update horizon stars - always visible, control with opacity
    if (this.horizonStarField) {
      // Only make visible when we're starting to fade in (performance optimization)
      this.horizonStarField.visible = nightFactor > 0.02;
      
      if (this.horizonStarField.material) {
        // Use smoothstep for a gradual fade-in transition
        const fadeValue = this.smoothstep(0.03, 0.25, nightFactor);
        const baseOpacity = fadeValue * 0.7; // Reduced max opacity
        this.horizonStarField.material.opacity = baseOpacity + flickerHorizon;
      }
    }
  }
  
  /**
   * Smoothstep function for smooth interpolation
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {number} value - Value to interpolate
   * @returns {number} Smoothly interpolated value
   */
  smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
  }
}
