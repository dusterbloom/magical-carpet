import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { deviceCapabilities } from "../../core/utils/DeviceCapabilities.js"; // Import device caps

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
    this.sky = null;
    this.isFallbackSky = false; // Flag for fallback
    this.fallbackSkyMaterial = null; // Material for fallback
  }

  /**
   * Initialize the sky system
   */
  async initialize() {
    console.log("Initializing SkySystem...");

    // Use device capabilities to determine skybox approach
    if (deviceCapabilities.gpuTier === 'low' || deviceCapabilities.isMobile) {
      console.log("Using Fallback Sky for low-end/mobile device");
      this.isFallbackSky = true;
      this.createFallbackSky();
    } else {
      console.log("Using standard THREE.Sky");
      this.isFallbackSky = false;
      this.createStandardSky();
    }

    // Store original background color
    this.originalBackgroundColor = new THREE.Color(0x88ccff);

    // Set renderer tone mapping exposure
    this.engine.renderer.toneMappingExposure = 0.6;

    // Initialize scene fog
    this.scene.fog = new THREE.FogExp2(0x88ccff, 0.00003);

    console.log("SkySystem initialization complete");
  }


  // Direct sun creation method removed - now using SunSystem

  createStandardSky() {
    // Create Three.js Sky
    this.sky = new Sky();
    
    // Scale the sky appropriately relative to camera far plane
    const farPlane = this.engine.camera.far;
    const skyboxScale = farPlane * 0.8; // Keep skybox within far plane
    this.sky.scale.setScalar(skyboxScale);
    
    // Adjust sky mesh geometry based on screen ratio for better rendering
    const screenRatio = window.innerWidth / window.innerHeight;
    const skyMesh = this.sky.geometry;
    skyMesh.parameters.widthSegments = Math.max(32, Math.floor(32 * screenRatio));
    skyMesh.parameters.heightSegments = Math.max(32, Math.floor(32 * screenRatio));
    
    this.scene.add(this.sky);

    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 8;
    uniforms['rayleigh'].value = 1;
    uniforms['mieCoefficient'].value = 0.025;
    uniforms['mieDirectionalG'].value = 0.999;
    
    // Fix seam issue by adjusting material settings
    this.sky.material.side = THREE.BackSide;
    this.sky.material.depthWrite = false;
  }

  createFallbackSky() {
    // Calculate appropriate size based on camera far plane
    const farPlane = this.engine.camera.far;
    const skyboxRadius = farPlane * 0.8; // Keep within far plane
    
    // Create a sphere geometry to act as the skybox
    // Use more segments for better quality on mobile (prevent visible seams)
    const segmentsWidth = deviceCapabilities.gpuTier === 'low' ? 24 : 32;
    const segmentsHeight = deviceCapabilities.gpuTier === 'low' ? 12 : 16;
    const geometry = new THREE.SphereGeometry(skyboxRadius, segmentsWidth, segmentsHeight);
    
    // Basic material, color will be updated dynamically
    this.fallbackSkyMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ccff, // Start with a default blue
      side: THREE.BackSide, // Render inside of the sphere
      fog: false // Fallback sky shouldn't be affected by fog
    });
    
    this.sky = new THREE.Mesh(geometry, this.fallbackSkyMaterial);
    this.sky.renderOrder = -1; // Render very first
    this.scene.add(this.sky);
  }

  update(delta) {
    // Update sky colors based on time of day
    this.updateSkyColors(); // This method handles both sky types

    // Make sure sky precisely follows camera to avoid black areas
    // This is crucial for mobile where the skybox might be closer to the far plane
    if (this.sky && this.engine.camera) {
      this.sky.position.copy(this.engine.camera.position);
      
      // For mobile devices, we make an extra check to ensure the sky stays visible
      if (deviceCapabilities.isMobile && this.engine.systems.player && this.engine.systems.player.localPlayer) {
        // On mobile, also update rotation if needed to match camera's forward direction
        // This helps prevent black spots when turning quickly
        const camera = this.engine.camera;
        const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        
        // Only apply subtle rotation corrections to avoid jarring changes
        if (this.sky.userData.lastLookDir) {
          const angle = this.sky.userData.lastLookDir.angleTo(lookDir);
          if (angle > 0.2) { // Only update when significant rotation occurs
            this.sky.userData.lastLookDir = lookDir.clone();
          }
        } else {
          this.sky.userData.lastLookDir = lookDir.clone();
        }
      }
    }
  }

  updateSkyColors() {
    const timeOfDay = this.atmosphereSystem.getTimeOfDay();
    const nightFactor = this.atmosphereSystem.getNightFactor();
    let fogColor;
    let skyColor; // Color for the fallback sky

    // --- Calculate Colors (same logic as before) ---
    if (timeOfDay < 0.25) { // Night to sunrise
      const t = timeOfDay / 0.25;
      fogColor = new THREE.Color(0x000010).lerp(new THREE.Color(0xff9933), t);
      skyColor = new THREE.Color(0x000005).lerp(new THREE.Color(0x442211), t); // Dark blue to dark orange
    } else if (timeOfDay < 0.5) { // Sunrise to noon
      const t = (timeOfDay - 0.25) / 0.25;
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x88ccff), t);
      skyColor = new THREE.Color(0x664433).lerp(new THREE.Color(0x77bbff), t); // Orange to bright blue
    } else if (timeOfDay < 0.75) { // Noon to sunset
      const t = (timeOfDay - 0.5) / 0.25;
      fogColor = new THREE.Color(0x88ccff).lerp(new THREE.Color(0xff9933), t);
      skyColor = new THREE.Color(0x77bbff).lerp(new THREE.Color(0x664433), t); // Bright blue to orange
    } else { // Sunset to night
      const t = (timeOfDay - 0.75) / 0.25;
      fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x000010), t);
      skyColor = new THREE.Color(0x442211).lerp(new THREE.Color(0x000005), t); // Dark orange to dark blue
    }

    // --- Apply Colors ---
    // Update fog (applies regardless of sky type)
    if (this.scene.fog) {
      this.scene.fog.color.copy(fogColor);
    }

    // Update background clear color (applies regardless of sky type)
    if (nightFactor > 0) {
      const bgColor = new THREE.Color(0x000014).lerp(this.originalBackgroundColor, 1 - nightFactor);
      this.engine.renderer.setClearColor(bgColor);
    } else {
      this.engine.renderer.setClearColor(this.originalBackgroundColor);
    }

    // Update the actual sky object
    if (this.isFallbackSky) {
      // Update the fallback material color
      this.fallbackSkyMaterial.color.copy(skyColor);
    } else {
      // Update the standard THREE.Sky uniforms
      const uniforms = this.sky.material.uniforms;
      const sunPosition = this.atmosphereSystem.getSunPosition();
      uniforms['sunPosition'].value.copy(sunPosition.normalize());

      // Adjust sky parameters based on time (existing logic)
      if (timeOfDay < 0.25) {
        const t = timeOfDay / 0.25;
        this.engine.renderer.toneMappingExposure = 0.1 + t * 0.4;
        uniforms['turbidity'].value = 0.5 + t * 7.5;
        uniforms['rayleigh'].value = 0.05 + t * 0.95;
        uniforms['mieCoefficient'].value = 0.001 + t * 0.024;
      } else if (timeOfDay < 0.5) {
        const t = (timeOfDay - 0.25) / 0.25;
        this.engine.renderer.toneMappingExposure = 0.6;
        uniforms['turbidity'].value = 8;
        uniforms['rayleigh'].value = 1 + t * 0.5;
        uniforms['mieCoefficient'].value = 0.025;
      } else if (timeOfDay < 0.75) {
        const t = (timeOfDay - 0.5) / 0.25;
        this.engine.renderer.toneMappingExposure = 0.6;
        uniforms['turbidity'].value = 8 + t * 2;
        uniforms['rayleigh'].value = 1.5 - t * 0.5;
        uniforms['mieCoefficient'].value = 0.025;
      } else {
        const t = (timeOfDay - 0.75) / 0.25;
        this.engine.renderer.toneMappingExposure = 0.6 - t * 0.5;
        uniforms['turbidity'].value = 10 - t * 9.5;
        uniforms['rayleigh'].value = 1 - t * 0.95;
        uniforms['mieCoefficient'].value = 0.025 - t * 0.024;
      }
    }
  }
}