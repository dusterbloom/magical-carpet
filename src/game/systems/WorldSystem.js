import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export class WorldSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.terrain = null;
    this.water = null;
    this.sky = null;
    this.manaNodes = [];
    this.noise = new SimplexNoise();
    this.worldSize = 1000;
    this.heightScale = 60;
    this.seed = Math.random() * 1000;
  }
  
  async initialize() {
    this.createLights();
    this.createSky();
    this.createTerrain();
    this.createWater();
    this.createManaNodes();
    
    // Set camera position
    this.engine.camera.position.set(0, 50, 0);
    this.engine.camera.lookAt(50, 0, 50);
    
    console.log("World system initialized");
  }
  
  createLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    this.scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    
    // Set up shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.bias = -0.0005;
    
    this.scene.add(directionalLight);
    this.sunLight = directionalLight;
  }
  
  createSky() {
    // Create sky
    this.sky = new Sky();
    this.sky.scale.setScalar(10000);
    this.scene.add(this.sky);
    
    // Set up sun parameters
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;
    
    const sunPosition = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(90 - 10); // Sun elevation
    const theta = THREE.MathUtils.degToRad(180); // Sun azimuth
    
    sunPosition.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sunPosition);
    
    // Update sun light direction to match sky
    this.sunLight.position.copy(sunPosition.multiplyScalar(100));
    this.sunLight.updateMatrixWorld();
  }
  
  createTerrain() {
    // Create terrain geometry
    const geometry = new THREE.PlaneGeometry(
      this.worldSize,
      this.worldSize,
      128,
      128
    );
    geometry.rotateX(-Math.PI / 2);
    
    // Create terrain material
    const terrainTexture = this.engine.assets.getTexture('terrain');
    if (terrainTexture) {
      terrainTexture.wrapS = THREE.RepeatWrapping;
      terrainTexture.wrapT = THREE.RepeatWrapping;
      terrainTexture.repeat.set(16, 16);
    }
    
    const material = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: 0.8,
      metalness: 0.2,
      vertexColors: true
    });
    
    // Apply height map using simplex noise
    const vertices = geometry.attributes.position;
    const colors = new Float32Array(vertices.count * 3);
    const color = new THREE.Color();
    
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const z = vertices.getZ(i);
      
      // Get noise value for current position
      const nx = x / this.worldSize;
      const nz = z / this.worldSize;
      
      // Combine multiple noise scales for more detailed terrain
      const noise1 = this.noise.noise(nx * 1.5 + this.seed, nz * 1.5 + this.seed) * 0.5;
      const noise2 = this.noise.noise(nx * 3 + this.seed * 2, nz * 3 + this.seed * 2) * 0.25;
      const noise3 = this.noise.noise(nx * 6 + this.seed * 3, nz * 6 + this.seed * 3) * 0.125;
      
      // Combine different noise scales
      const combinedNoise = noise1 + noise2 + noise3;
      
      // Calculate height and apply to vertex
      const height = combinedNoise * this.heightScale;
      vertices.setY(i, height);
      
      // Color based on height
      if (height < 2) {
        color.setRGB(0.8, 0.7, 0.5); // Sand
      } else if (height < 10) {
        color.setRGB(0.1, 0.8, 0.1); // Grass
      } else if (height < 20) {
        color.setRGB(0.5, 0.5, 0.1); // Forest
      } else {
        color.setRGB(0.5, 0.5, 0.5); // Mountain
      }
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    
    // Create terrain mesh
    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    this.scene.add(this.terrain);
    
    // Create collision data for terrain
    this.createTerrainCollision();
  }
  
  createTerrainCollision() {
    // Simple heightmap lookup for collision detection
    // In a full implementation, you might use a more sophisticated approach
    this.heightMap = [];
    const resolution = 100;
    const step = this.worldSize / resolution;
    
    for (let i = 0; i <= resolution; i++) {
      this.heightMap[i] = [];
      for (let j = 0; j <= resolution; j++) {
        const x = (i / resolution) * this.worldSize - this.worldSize / 2;
        const z = (j / resolution) * this.worldSize - this.worldSize / 2;
        
        const nx = x / this.worldSize;
        const nz = z / this.worldSize;
        
        // Same noise function as in createTerrain
        const noise1 = this.noise.noise(nx * 1.5 + this.seed, nz * 1.5 + this.seed) * 0.5;
        const noise2 = this.noise.noise(nx * 3 + this.seed * 2, nz * 3 + this.seed * 2) * 0.25;
        const noise3 = this.noise.noise(nx * 6 + this.seed * 3, nz * 6 + this.seed * 3) * 0.125;
        
        this.heightMap[i][j] = (noise1 + noise2 + noise3) * this.heightScale;
      }
    }
  }
  
  getTerrainHeight(x, z) {
    // Convert world coordinates to heightmap coordinates
    const halfSize = this.worldSize / 2;
    const nx = ((x + halfSize) / this.worldSize) * (this.heightMap.length - 1);
    const nz = ((z + halfSize) / this.worldSize) * (this.heightMap[0].length - 1);
    
    // Get the four surrounding height values
    const x1 = Math.floor(nx);
    const x2 = Math.min(Math.ceil(nx), this.heightMap.length - 1);
    const z1 = Math.floor(nz);
    const z2 = Math.min(Math.ceil(nz), this.heightMap[0].length - 1);
    
    const h11 = this.heightMap[x1][z1];
    const h21 = this.heightMap[x2][z1];
    const h12 = this.heightMap[x1][z2];
    const h22 = this.heightMap[x2][z2];
    
    // Bilinear interpolation
    const fx = nx - x1;
    const fz = nz - z1;
    
    const h1 = h11 * (1 - fx) + h21 * fx;
    const h2 = h12 * (1 - fx) + h22 * fx;
    
    return h1 * (1 - fz) + h2 * fz;
  }
  
  createWater() {
    const waterGeometry = new THREE.PlaneGeometry(this.worldSize * 2, this.worldSize * 2);
    
    // Create water with reflections
    this.water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load('assets/textures/waternormals.jpg', function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: this.scene.fog !== undefined
    });
    
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0; // Water level
    this.scene.add(this.water);
  }
  
  createManaNodes() {
    // Create mana collection points throughout the world
    const nodeCount = 20;
    this.manaNodes = [];
    
    for (let i = 0; i < nodeCount; i++) {
      // Random position within the world bounds
      const x = (Math.random() - 0.5) * this.worldSize * 0.8;
      const z = (Math.random() - 0.5) * this.worldSize * 0.8;
      const y = this.getTerrainHeight(x, z) + 10; // Floating above terrain
      
      // Create mana node visual
      const geometry = new THREE.SphereGeometry(2, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00aaff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
      });
      
      const node = new THREE.Mesh(geometry, material);
      node.position.set(x, y, z);
      node.castShadow = true;
      node.userData = {
        type: 'mana',
        value: 10 + Math.floor(Math.random() * 20), // Random value
        collected: false
      };
      
      // Add glow effect
      const glowGeometry = new THREE.SphereGeometry(3, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
      });
      
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      node.add(glowMesh);
      
      this.scene.add(node);
      this.manaNodes.push(node);
    }
  }
  
  update(delta, elapsed) {
    // Animate water
    if (this.water) {
      this.water.material.uniforms['time'].value += delta;
    }
    
    // Animate mana nodes (bobbing and rotating)
    this.manaNodes.forEach((node, index) => {
      if (!node.userData.collected) {
        node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.03;
        node.rotation.y += delta * 0.5;
      }
    });
  }
  
  // Check if a mana node is collected
  checkManaCollection(position, radius) {
    const collectedNodes = [];
    
    this.manaNodes.forEach((node) => {
      if (!node.userData.collected) {
        const distance = position.distanceTo(node.position);
        if (distance < radius + 2) { // 2 is the node radius
          node.userData.collected = true;
          
          // Make the node disappear
          node.visible = false;
          
          collectedNodes.push({
            position: node.position.clone(),
            value: node.userData.value
          });
        }
      }
    });
    
    return collectedNodes;
  }
}
