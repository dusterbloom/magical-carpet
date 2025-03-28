import * as THREE from "three";

export class StarsParticleSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.starField = null;
    this.kissStarField = null;
    this.horizonStarField = null;
  }

  async initialize() {
    // Create three star systems:
    // 1. Regular stars across the sky
    // 2. Special KISS stars pattern
    // 3. Horizon stars to ensure coverage near the horizon line
    this.createRegularStars();
    this.createKISSStars();
    this.createHorizonStars();
  }

  createRegularStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const sizes = [];
    const colors = [];
    
    // Create 3000 regular stars in the upper hemisphere
    for (let i = 0; i < 3000; i++) {
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

  createKISSStars() {
    // Create special pattern of brighter stars that form a "KISS" pattern
    // (Keep It Simple, Stupid) stars - a simple, distinctive pattern
    const geometry = new THREE.BufferGeometry();
    
    // Define the KISS pattern star positions
    // K
    const kPositions = [
      // Vertical line
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], 
      // Diagonals
      [1, 2], [2, 1], [3, 0],
      [1, 2], [2, 3], [3, 4]
    ];
    
    // I
    const iPositions = [
      [5, 0], [5, 1], [5, 2], [5, 3], [5, 4]
    ];
    
    // S
    const s1Positions = [
      [7, 0], [8, 0], [9, 0],
      [7, 1], [7, 2],
      [8, 2], [9, 2],
      [9, 3], [9, 4],
      [7, 4], [8, 4]
    ];
    
    // S (repeat)
    const s2Positions = [
      [11, 0], [12, 0], [13, 0],
      [11, 1], [11, 2],
      [12, 2], [13, 2],
      [13, 3], [13, 4],
      [11, 4], [12, 4]
    ];
    
    // Combine all pattern positions
    const patternPositions = [...kPositions, ...iPositions, ...s1Positions, ...s2Positions];
    
    // Setup the actual star coordinates
    const positions = [];
    const colors = [];
    const sizes = [];
    
    // Scale and position for the pattern
    const gridSize = 160; // Increased size for better visibility
    const patternScale = 200;
    // Position the KISS pattern in the sky but not too high
    // This ensures it's visible within the player's normal field of view
    const patternOffset = [-7 * gridSize / 2, 1300, -4500];
    
    // Add the KISS stars
    for (const pos of patternPositions) {
      positions.push(
        patternOffset[0] + pos[0] * gridSize,
        patternOffset[1] + pos[1] * patternScale,
        patternOffset[2]
      );
      
      // Bright white color
      colors.push(1.0, 1.0, 1.0);
      
      // Larger size for visibility
      sizes.push(6);  // Bigger stars for the pattern
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    
    const starsMaterial = new THREE.PointsMaterial({
      size: 8, // Increased size for more visibility
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false  // No perspective scaling for stars
    });
    
    this.kissStarField = new THREE.Points(geometry, starsMaterial);
    this.scene.add(this.kissStarField);
  }
  
  createHorizonStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    
    // Create 1500 stars concentrated near the horizon
    for (let i = 0; i < 1500; i++) {
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
      
      // Update KISS starfield position
      if (this.kissStarField) {
        this.kissStarField.position.copy(this.camera.position);
      }
      
      // Update horizon starfield position
      if (this.horizonStarField) {
        this.horizonStarField.position.copy(this.camera.position);
      }
    }
  }
}