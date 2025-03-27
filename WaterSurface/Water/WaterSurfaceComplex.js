import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water2.js';

// Create texture loader
const textureLoader = new THREE.TextureLoader();

export class WaterSurfaceComplex {
  constructor({
    width = 1000,
    length = 1000,
    position = [0, 0, 0],
    color = 0x4a7eb5,
    scale = 3,
    flowDirection = [1, 1],
    flowSpeed = 0.15,
    dimensions = 512,
    reflectivity = 0.25,
    fxDistortionFactor = 0.05,
    fxDisplayColorAlpha = 0.2
  } = {}) {
    // Load normal maps
    const normalMap1 = textureLoader.load('/water/complex/Water_1_M_Normal.jpg');
    const normalMap2 = textureLoader.load('/water/complex/Water_2_M_Normal.jpg');
    
    // Configure normal maps
    normalMap1.wrapS = normalMap1.wrapT = THREE.RepeatWrapping;
    normalMap2.wrapS = normalMap2.wrapT = THREE.RepeatWrapping;
    
    this.params = {
      color,
      scale,
      flowDirection: new THREE.Vector2(...flowDirection),
      flowSpeed,
      textureWidth: dimensions,
      textureHeight: dimensions,
      reflectivity,
      normalMap0: normalMap1,
      normalMap1: normalMap2,
      fxDistortionFactor,
      fxDisplayColorAlpha,
      distortionScale: 3.7,
      fog: false,
      clipBias: 0.0,
      alpha: 0.8
    };

    this.time = 0;
    this.geometry = new THREE.PlaneGeometry(width, length);
    this.water = new Water(this.geometry, this.params);
    this.water.position.set(...position);
    this.water.rotation.x = -Math.PI / 2;

    // Initialize custom uniforms if they don't exist
    if (!this.water.material.uniforms.time) {
      this.water.material.uniforms.time = { value: 0 };
    }
    if (!this.water.material.uniforms.fxDistortionFactor) {
      this.water.material.uniforms.fxDistortionFactor = { value: fxDistortionFactor };
    }
    if (!this.water.material.uniforms.fxDisplayColorAlpha) {
      this.water.material.uniforms.fxDisplayColorAlpha = { value: fxDisplayColorAlpha };
    }
  }

  update(delta) {
    if (this.water.material && this.water.material.uniforms) {
      this.time += delta;
      
      // Update flow animations using our own time variable
      if (this.water.material.uniforms.time) {
        this.water.material.uniforms.time.value = this.time * this.params.flowSpeed;
      }

      // Update distortion effects
      if (this.water.material.uniforms.distortionScale) {
        this.water.material.uniforms.distortionScale.value = 
          Math.sin(this.time * 0.2) * 0.3 + this.params.scale;
      }
      
      // Update normal map animation
      if (this.water.material.uniforms.normalSampler0 && this.water.material.uniforms.normalSampler1) {
        const flowSpeedFactor = 0.05;
        if (!this.water.material.uniforms.normalTransform0) {
          this.water.material.uniforms.normalTransform0 = { value: new THREE.Vector2(0, 0) };
        }
        if (!this.water.material.uniforms.normalTransform1) {
          this.water.material.uniforms.normalTransform1 = { value: new THREE.Vector2(0, 0) };
        }
        
        this.water.material.uniforms.normalTransform0.value.x = this.time * flowSpeedFactor;
        this.water.material.uniforms.normalTransform0.value.y = this.time * flowSpeedFactor * 0.8;
        
        this.water.material.uniforms.normalTransform1.value.x = -this.time * flowSpeedFactor * 0.6;
        this.water.material.uniforms.normalTransform1.value.y = this.time * flowSpeedFactor * 0.5;
      }
      
      // Animate water opacity slightly for more realistic effect
      if (this.water.material.uniforms.opacity) {
        const baseOpacity = this.params.alpha || 0.8;
        const variation = Math.sin(this.time * 0.5) * 0.05;
        this.water.material.uniforms.opacity.value = baseOpacity + variation;
      }
    }
  }

  dispose() {
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.water) {
      this.water.material.dispose();
      this.water.geometry.dispose();
    }
  }

  getMesh() {
    return this.water;
  }
}