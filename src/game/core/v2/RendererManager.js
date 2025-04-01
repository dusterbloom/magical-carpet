// src/game/core/v2/RendererManager.js
import * as THREE from "three";

export class RendererManager {
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    this.renderer = null;
    this.currentCamera = null; // Track current camera

  }
  
  setup() {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    
    // Configure renderer
    this.renderer.setClearColor(0x88ccff);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    THREE.ColorManagement.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    return this;
  }
  
  updateResolution(resolutionScale = 1.0) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * resolutionScale);
    
    return this;
  }
  
  handleResize() {
    this.updateResolution();
    
    // Update camera if available
    if (this.engine.camera) {
      this.engine.camera.aspect = window.innerWidth / window.innerHeight;
      this.engine.camera.updateProjectionMatrix();
    }
    
    return this;
  }
  
  render(scene, camera) {
    if (!this.renderer || !scene || !camera) {
      return;
    }
    
    this.renderer.render(scene, camera);
    
    return this;
  }
}