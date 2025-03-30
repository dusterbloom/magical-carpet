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
      side: THREE.FrontSide
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
    
    // Calculate moon position (opposite to sun)
    const moonAngle = ((timeOfDay + 0.5) % 1.0) * Math.PI * 2;
    
    this.moonPosition.set(
      6000 * Math.cos(moonAngle),
      3000 * Math.sin(moonAngle),
      6000 * Math.sin(moonAngle * 0.5)
    );
    
    this.moonMesh.position.copy(this.moonPosition);
    
    // Update moon visibility based on night factor
    this.moonMesh.visible = nightFactor > 0.05;
    
    // Make moon face camera
    if (this.engine.camera) {
      this.moonMesh.lookAt(this.engine.camera.position);
    }
    
    // Update moonlight intensity based on night factor
    if (this.moonLight) {
      this.moonLight.intensity = 0.2 * nightFactor;
    }
  }
  
  /**
   * Get the current moon position
   * @returns {THREE.Vector3} Moon position
   */
  getMoonPosition() {
    return this.moonPosition.clone();
  }
}
