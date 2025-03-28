import * as THREE from "three";

export class StarsParticleSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.starField = null;
    this.horizonStarField = null;
  }

  async initialize() {
    // Create two star systems:
    // 1. Regular stars across the sky
    // 2. Horizon stars to ensure coverage near the horizon line
    this.createRegularStars();
    this.createHorizonStars();
  }

  createRegularStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const sizes = [];
    const colors = [];
    
    // Create 4500 regular stars in the upper hemisphere (increased for more density)
    for (let i = 0; i < 4500; i++) {
      // Random angles
      const theta = Math.random() * Math.PI * 2;
      // Use full hemisphere range to distribute stars from zenith to horizon
      const phi = Math.random() * Math.PI * 0.5; // Full hemisphere (0 to 90 degrees)
      
      // Convert to Cartesian coordinates on a sphere
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi); // This will always be positive due to phi range
      const z = Math.sin(phi) * Math.sin(theta);
      
      // Scale to place stars far away
      const scale = 6000;
      positions.push(x * scale, y * scale, z * scale);
      
      // Vary the star sizes slightly
      sizes.push(2 + Math.random() * 2);
      
      // Add slight color variation
      const starType = Math.random();
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
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false
    });
    
    this.starField = new THREE.Points(geometry, starsMaterial);
    this.scene.add(this.starField);
  }
  
  createHorizonStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    
    // Create 2000 stars concentrated near the horizon (increased from 1500)
    for (let i = 0; i < 2000; i++) {
      // Random angles around the full circle
      const theta = Math.random() * Math.PI * 2;
      
      // Phi angle concentrated near the horizon
      // Biased distribution to place more stars near horizon (phi close to PI/2)
      const phi = Math.PI * (0.45 + Math.random() * 0.08); // Range ~81-95 degrees
      
      // Convert to Cartesian coordinates on a sphere
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi); // Near-zero values for horizon
      const z = Math.sin(phi) * Math.sin(theta);
      
      // Place stars at varying distances
      const distance = 5500 + Math.random() * 500; // Slightly varied distances
      positions.push(x * distance, y * distance, z * distance);
      
      // Vary sizes - smaller on average to give depth perception
      sizes.push(1 + Math.random() * 2);
      
      // Use mostly white/blue colors for horizon stars
      if (Math.random() > 0.7) {
        // Light blue tint
        colors.push(0.8, 0.9, 1.0);
      } else {
        // White
        colors.push(1.0, 1.0, 1.0);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 2, // Slightly smaller for horizon stars
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false
    });
    
    this.horizonStarField = new THREE.Points(geometry, starsMaterial);
    this.scene.add(this.horizonStarField);
  }
  
  update() {
    if (this.camera) {
      // Update regular starfield position
      if (this.starField) {
        this.starField.position.copy(this.camera.position);
      }
      
      // Update horizon starfield position
      if (this.horizonStarField) {
        this.horizonStarField.position.copy(this.camera.position);
      }
    }
  }
}