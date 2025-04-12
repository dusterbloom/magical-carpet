import * as THREE from 'three';

class RenderService {
  constructor(container) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer();
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.setupCamera();
    this.setupLighting();
  }

  setupCamera() {
    this.camera.position.z = 5;
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    this.scene.add(pointLight);
  }

  addObject(object) {
    this.scene.add(object);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  animate(updateCallback) {
    const animate = () => {
      requestAnimationFrame(animate);
      if (updateCallback) updateCallback();
      this.render();
    };
    animate();
  }
}

export default RenderService;
