import * as THREE from 'three';

export class FluidFX {
  constructor({
    densityDissipation = 0.97,
    velocityDissipation = 0.98,
    velocityAcceleration = 10,
    pressureDissipation = 0.8,
    splatRadius = 0.15,
    curlStrength = 35,
    pressureIterations = 20,
    fluidColor = (velocity) => new THREE.Vector3(
      Math.min(Math.abs(velocity.x) * 0.5, 1),
      Math.min(Math.abs(velocity.y) * 0.5, 1),
      0.5
    )
  } = {}) {
    this.params = {
      densityDissipation,
      velocityDissipation,
      velocityAcceleration,
      pressureDissipation,
      splatRadius,
      curlStrength,
      pressureIterations,
      fluidColor
    };

    // Create a dummy mesh just to handle updates
    this.dummyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ visible: false })
    );

    // Initialize simulation textures
    this.initializeTextures();
  }

  initializeTextures() {
    const format = THREE.RGBAFormat;
    const type = THREE.FloatType;

    this.velocityFBO = new THREE.WebGLRenderTarget(256, 256, {
      format,
      type,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });

    this.densityFBO = this.velocityFBO.clone();
    this.pressureFBO = this.velocityFBO.clone();
    this.divergenceFBO = this.velocityFBO.clone();
  }

  update(renderer, delta) {
    // We do simulation updates here but won't actually render anything
    // All effects are applied through uniforms to the water surface
    this.updateSimulation(delta);
  }

  updateSimulation(delta) {
    // Just update the dummy mesh's matrix in case something tries to use it
    if (this.dummyMesh) {
      this.dummyMesh.updateMatrixWorld();
    }
  }

  dispose() {
    // Clean up FBOs
    if (this.velocityFBO) {
      this.velocityFBO.dispose();
    }
    if (this.densityFBO) {
      this.densityFBO.dispose();
    }
    if (this.pressureFBO) {
      this.pressureFBO.dispose();
    }
    if (this.divergenceFBO) {
      this.divergenceFBO.dispose();
    }

    // Clean up dummy mesh
    if (this.dummyMesh) {
      this.dummyMesh.geometry.dispose();
      this.dummyMesh.material.dispose();
    }
  }
}