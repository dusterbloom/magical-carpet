import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

export class WorldSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    

    if (engine.renderer) {
      // Improve shadow mapping
      engine.renderer.shadowMap.enabled = true;
      engine.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Improve overall rendering quality
      engine.renderer.outputColorSpace = THREE.SRGBColorSpace;
      engine.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      engine.renderer.toneMappingExposure = 1.1;
    }

    // Initialize maps and collections
    this.currentChunks = new Map();
    this.manaNodes = [];

    // World configuration
    this.chunkSize = 256;
    this.terrainResolution = 64;
    this.maxHeight = 120;
    this.minHeight = -20;
    this.waterLevel = 0;
    this.viewDistance = 6;
    
    // Terrain parameters
    this.terrainParams = {
      baseScale: 0.003,
      detailScale: 0.015,
      mountainScale: 0.006,
      baseHeight: 40,
      mountainHeight: 80,
      detailHeight: 20
    };

    // Initialize noise generator
    this.seed = Math.random() * 10000;
    this.noise = createNoise2D();
    
    // Define biomes
    this.biomes = {
      ocean: { threshold: -0.3, color: new THREE.Color(0x0066aa) },
      beach: { threshold: -0.2, color: new THREE.Color(0xdddd77) },
      plains: { threshold: 0.2, color: new THREE.Color(0x44aa44) },
      forest: { threshold: 0.4, color: new THREE.Color(0x227722) },
      mountains: { threshold: 0.6, color: new THREE.Color(0x888888) },
      snow: { threshold: 0.8, color: new THREE.Color(0xffffff) }
    };

    // Materials collection
    this.materials = {};
  }

  async initialize() {
    console.log("Initializing WorldSystem...");
    
    // Create materials and setup environment
    await this.createMaterials();
    this.createLights();
    this.createSky();
    
    // Set initial camera position for a better view
    this.engine.camera.position.set(0, 200, 200);
    this.engine.camera.lookAt(0, 0, 0);
    
    // Generate initial world
    this.createInitialTerrain();
    this.createWater();
    this.createManaNodes();

    if (this.engine.camera) {
      this.engine.camera.far = 15000;
      this.engine.camera.updateProjectionMatrix();
    }
    
    console.log("AtmosphereSystem initialized");
  }

  createMaterials() {
    // Create main terrain material
    this.materials.terrain = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.5,
      
      // Add subtle normal mapping for micro details
      normalScale: new THREE.Vector2(0.05, 0.05)
    });
    
    // Create water material
    this.materials.water = new THREE.MeshPhysicalMaterial({
      color: 0x0099ee,
      transparent: true,
      opacity: 0.80,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.5,
      thickness: 1.0,
      side: THREE.DoubleSide,
      envMapIntensity: 1.0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2
    });
  }

  // Replace the createLights method in your WorldSystem.js file

createLights() {
  // Clear any existing lights first
  this.scene.traverse((object) => {
    if (object.isDirectionalLight || object.isAmbientLight) {
      this.scene.remove(object);
    }
  });

  // Main directional light (sun)
  const sunLight = new THREE.DirectionalLight(0xffffeb, 0.8);
  sunLight.position.set(300, 400, 200);
  
  // Improved shadow settings
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 1000;
  sunLight.shadow.camera.left = -500;
  sunLight.shadow.camera.right = 500;
  sunLight.shadow.camera.top = 500;
  sunLight.shadow.camera.bottom = -500;
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.02;
  
  // Softer shadows
  sunLight.shadow.radius = 2;
  
  this.scene.add(sunLight);
  
  // Secondary directional light for softer shadows on other side
  const secondaryLight = new THREE.DirectionalLight(0xffffcc, 0.3);
  secondaryLight.position.set(-200, 300, -100);
  this.scene.add(secondaryLight);

  // Stronger ambient light to fill shadows
  const ambientLight = new THREE.AmbientLight(0x445566, 0.7);
  this.scene.add(ambientLight);
  
  // Add a subtle hemispheric light
  const hemisphereLight = new THREE.HemisphereLight(0x88aaff, 0x665544, 0.5);
  this.scene.add(hemisphereLight);
  
  // Expose the primary sun light for time-of-day updates
  this.sunLight = sunLight;
}

createSky() {
  // Simple sky color
  this.scene.background = new THREE.Color(0x88ccff);
  
  // Use FogExp2 for more natural distance fog
  this.scene.fog = new THREE.FogExp2(0x88ccff, 0.0002); // Reduced density for longer view distance
}
  getTerrainHeight(x, z) {
    try {
      // Basic continent shape
      const continentShape = this.noise(
        x * 0.0007 + this.seed,
        z * 0.0007 + this.seed
      );
      
      // Base terrain with hills
      const baseNoise = this.noise(
        x * this.terrainParams.baseScale + this.seed,
        z * this.terrainParams.baseScale + this.seed
      );
      
      let height = (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;
      
      // Add mountains using ridged noise
      const mountainNoise = Math.abs(
        this.noise(
          x * this.terrainParams.mountainScale + this.seed * 2,
          z * this.terrainParams.mountainScale + this.seed * 2
        )
      );
      
      // Apply mountains with continent mask
      const continentMask = Math.max(0, (continentShape + 0.1) * 1.5);
      height += Math.pow(mountainNoise, 1.5) * this.terrainParams.mountainHeight * continentMask;
      
      // Add small terrain details
      const detailNoise = this.noise(
        x * this.terrainParams.detailScale + this.seed * 3,
        z * this.terrainParams.detailScale + this.seed * 3
      );
      
      height += detailNoise * this.terrainParams.detailHeight * 0.5;
      
      // Apply ocean depth for negative continent areas
      if (continentShape < -0.1) {
        height = Math.min(height, this.waterLevel - 10 - 20 * Math.abs(continentShape));
      }
      
      return height;
    } catch (error) {
      console.warn("Error in getTerrainHeight:", error);
      return 0;
    }
  }

// Update this function in your WorldSystem.js file

getBiomeColor(height, x, z) {
  // Get moisture and temperature values for more natural biome variation
  const moisture = this.noise(x * 0.001 + this.seed * 4, z * 0.001 + this.seed * 4);
  const temperature = this.noise(x * 0.0008 + this.seed * 7, z * 0.0008 + this.seed * 7);
  
  // Normalized values for interpolation
  const normalizedMoisture = (moisture + 1) * 0.5;  // 0 to 1
  const normalizedTemp = (temperature + 1) * 0.5;   // 0 to 1
  
  let color = new THREE.Color();
  
  // OCEAN - Deep to shallow transition
  if (height < this.waterLevel - 5) {
    // Deep water - blue
    color.setRGB(0.1, 0.2, 0.5);
  } 
  else if (height < this.waterLevel) {
    // Shallow water - lighter blue
    const t = (height - (this.waterLevel - 5)) / 5;
    color.setRGB(0.1, 0.2, 0.5).lerp(new THREE.Color(0.2, 0.4, 0.6), t);
  }
  // BEACHES
  else if (height < this.waterLevel + 3) {
    // Beach/shore - sandy
    color.setRGB(0.76, 0.7, 0.5);
  }
  // LOW LANDS - grass, plains, meadows
  else if (height < 30) {
    // Base green for grassland
    const baseGreen = new THREE.Color(0.2, 0.5, 0.15);
    
    // Adjust by moisture (drier areas are more yellow/brown)
    if (normalizedMoisture < 0.4) {
      // Dry grassland or savanna
      const dryness = 1 - (normalizedMoisture / 0.4);
      color.setRGB(0.5, 0.45, 0.15).lerp(baseGreen, 1 - dryness * 0.7);
    } else {
      // Lush grassland
      color.copy(baseGreen);
      
      // Add subtle variation based on position
      const variation = this.noise(x * 0.03 + this.seed * 9, z * 0.03 + this.seed * 9) * 0.1;
      color.r += variation;
      color.g += variation;
      color.b += variation * 0.5;
    }
  }
  // HILLS AND FORESTS
  else if (height < 60) {
    // Forest and hill colors
    const forestGreen = new THREE.Color(0.13, 0.4, 0.13);
    const hillBrown = new THREE.Color(0.36, 0.3, 0.2);
    
    // Blend based on height and moisture
    const hillBlend = (height - 30) / 30; // 0 at height 30, 1 at height 60
    const moistureEffect = normalizedMoisture * 0.7;
    
    // More moisture = more forest, less moisture = more exposed hills
    color.copy(forestGreen).lerp(hillBrown, hillBlend * (1 - moistureEffect));
    
    // Add subtle variation
    const variation = this.noise(x * 0.02 + this.seed * 11, z * 0.02 + this.seed * 11) * 0.08;
    color.r += variation;
    color.g += variation;
    color.b += variation * 0.5;
  }
  // MOUNTAINS
  else if (height < 90) {
    // Mountain gray
    const rockGray = new THREE.Color(0.4, 0.38, 0.35);
    const darkRock = new THREE.Color(0.3, 0.3, 0.3);
    
    // Vary mountain color slightly with height
    const rockVariation = (height - 60) / 30;
    color.copy(rockGray).lerp(darkRock, rockVariation * 0.6);
    
    // Add rock striations and variations
    const striation = Math.abs(this.noise(x * 0.05 + this.seed * 13, z * 0.05 + this.seed * 13));
    color.r += striation * 0.15 - 0.05;
    color.g += striation * 0.15 - 0.05;
    color.b += striation * 0.15 - 0.05;
  }
  // SNOW PEAKS
  else {
    // Snow - start white and add blue tinge for higher elevations
    const snowWhite = new THREE.Color(0.9, 0.9, 0.95);
    const snowBlue = new THREE.Color(0.8, 0.85, 1.0);
    
    const snowHeight = (height - 90) / 30;
    color.copy(snowWhite).lerp(snowBlue, Math.min(snowHeight, 1) * 0.4);
    
    // Add subtle variation
    const variation = this.noise(x * 0.04 + this.seed * 15, z * 0.04 + this.seed * 15) * 0.05;
    color.r += variation;
    color.g += variation;
    color.b += variation;
  }
  
  // Ensure color values are valid
  color.r = Math.max(0, Math.min(1, color.r));
  color.g = Math.max(0, Math.min(1, color.g));
  color.b = Math.max(0, Math.min(1, color.b));
  
  return color;
}

  createChunkGeometry(startX, startZ) {
    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      this.terrainResolution,
      this.terrainResolution
    );

    // Rotate the plane to be horizontal (X-Z plane)
    geometry.rotateX(-Math.PI / 2);

    const vertices = geometry.attributes.position.array;
    const colors = [];

    // Modify vertices to create terrain shape
    for (let i = 0; i < vertices.length; i += 3) {
      // Get world coordinates
      const x = vertices[i] + startX;
      const z = vertices[i + 2] + startZ;
      
      // Calculate terrain height
      const height = this.getTerrainHeight(x, z);
      
      // Apply height to vertex Y coordinate
      vertices[i + 1] = height;
      
      // Assign color based on biome/height
      const color = this.getBiomeColor(height, x, z);
      colors.push(color.r, color.g, color.b);
    }

    // Add colors to geometry
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Update normals
    geometry.computeVertexNormals();
    
    return geometry;
  }

  createInitialTerrain() {
    console.log("Creating initial terrain...");
    
    // Create terrain chunks in a grid
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const startX = x * this.chunkSize;
        const startZ = z * this.chunkSize;
        const key = `${startX},${startZ}`;
        
        if (!this.currentChunks.has(key)) {
          try {
            const geometry = this.createChunkGeometry(startX, startZ);
            const mesh = new THREE.Mesh(geometry, this.materials.terrain);
            
            mesh.position.set(startX, 0, startZ);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            this.scene.add(mesh);
            this.currentChunks.set(key, mesh);
          } catch (error) {
            console.error("Error creating chunk:", error);
          }
        }
      }
    }
  }

  createWater() {
    // Create a large water plane
    const waterGeometry = new THREE.PlaneGeometry(
      this.chunkSize * 20,
      this.chunkSize * 20
    );
    waterGeometry.rotateX(-Math.PI / 2);

    // Create water mesh
    this.water = new THREE.Mesh(waterGeometry, this.materials.water);
    this.water.position.y = this.waterLevel;
    this.water.receiveShadow = true;
    this.scene.add(this.water);
  }

  createManaNodes() {
    // Clear existing mana nodes
    this.manaNodes.forEach(node => {
      this.scene.remove(node);
    });
    this.manaNodes = [];
    
    // Create new mana nodes around the player
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    // Distribution parameters
    const nodeCount = 30;
    const spawnRadius = this.chunkSize * 5;
    
    for (let i = 0; i < nodeCount; i++) {
      // Calculate random position
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spawnRadius;
      
      const x = player.position.x + Math.cos(angle) * distance;
      const z = player.position.z + Math.sin(angle) * distance;
      
      // Get height at position
      const terrainHeight = this.getTerrainHeight(x, z);
      
      // Place node above terrain
      const y = Math.max(terrainHeight + 10, this.waterLevel + 10);
      
      // Create mana node
      const nodeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: 0x00ffff,
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.8
        })
      );
      
      // Add glow effect
      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(3, 12, 12),
        new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.3,
          side: THREE.BackSide
        })
      );
      nodeMesh.add(glowMesh);
      
      // Position node
      nodeMesh.position.set(x, y, z);
      nodeMesh.userData = {
        type: 'mana',
        value: 10 + Math.floor(Math.random() * 20),
        collected: false
      };
      
      this.manaNodes.push(nodeMesh);
      this.scene.add(nodeMesh);
    }
  }

  updateChunks() {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    try {
      // Calculate current chunk coordinates
      const chunkX = Math.floor(player.position.x / this.chunkSize);
      const chunkZ = Math.floor(player.position.z / this.chunkSize);

      // Keep track of chunks that should remain
      const chunksToKeep = new Set();

      // Update or create chunks in view distance
      for (let x = -this.viewDistance; x <= this.viewDistance; x++) {
        for (let z = -this.viewDistance; z <= this.viewDistance; z++) {
          // Check if within circular view distance
          const distance = Math.sqrt(x * x + z * z);
          if (distance <= this.viewDistance) {
            const worldX = (chunkX + x) * this.chunkSize;
            const worldZ = (chunkZ + z) * this.chunkSize;
            const key = `${worldX},${worldZ}`;

            chunksToKeep.add(key);

            // Create new chunk if it doesn't exist
            if (!this.currentChunks.has(key)) {
              const geometry = this.createChunkGeometry(worldX, worldZ);
              const mesh = new THREE.Mesh(geometry, this.materials.terrain);
              mesh.position.set(worldX, 0, worldZ);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              this.scene.add(mesh);
              this.currentChunks.set(key, mesh);
            }
          }
        }
      }

      // Remove chunks that are too far away
      for (const [key, mesh] of this.currentChunks.entries()) {
        if (!chunksToKeep.has(key)) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.currentChunks.delete(key);
        }
      }
    } catch (error) {
      console.warn("Error in updateChunks:", error);
    }
  }

  update(delta, elapsed) {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;

    // Move water with player
    if (this.water) {
      this.water.position.x = player.position.x;
      this.water.position.z = player.position.z;
      // Gentle water animation
      this.water.position.y = this.waterLevel + Math.sin(elapsed * 0.5) * 0.1;
    }

    // Check if we need more mana nodes
    if (this.manaNodes.filter(node => !node.userData.collected).length < 10) {
      this.createManaNodes();
    }

    // Update terrain chunks
    this.updateChunks();

    // Animate mana nodes
    this.manaNodes.forEach((node, index) => {
      if (!node.userData.collected) {
        // Bobbing motion
        node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.03;
        // Rotation
        node.rotation.y += delta * 0.5;
      }
    });
  }

  checkManaCollection(position, radius) {
    const collectedNodes = [];

    this.manaNodes.forEach((node) => {
      if (!node.userData.collected) {
        const distance = position.distanceTo(node.position);
        if (distance < radius + 2) {
          node.userData.collected = true;
          node.visible = false;

          collectedNodes.push({
            position: node.position.clone(),
            value: node.userData.value || 10,
          });
        }
      }
    });

    return collectedNodes;
  }
}

// import * as THREE from "three";
// import { createNoise2D } from "simplex-noise"; // Updated import

// export class WorldSystem {
//   constructor(engine) {
//     this.engine = engine;
//     this.scene = engine.scene;
//     // Initialize maps and collections first
//     this.currentChunks = new Map();
//     this.manaNodes = [];

//     // // Core world properties
//     // this.worldSize = 2000;
//     // this.worldBounds = 10000;
//     this.water = null;
//     this.manaNodes = [];
//     // Adjusted terrain generation settings for better gameplay
//     this.terrainResolution = 64; // Higher detail
//     this.chunkSize = 256; // Larger chunks
//     this.maxHeight = 100; // Much higher mountains
//     this.minHeight = -20; // Allow valleys below sea level
//     this.waterLevel = 0; // Sea level
//     // Adjusted terrain parameters for more visible features
//     this.terrainParams = {
//       baseScale: 0.005,      // Increased for more visible variation
//       detailScale: 0.02,     // Surface detail
//       mountainScale: 0.008,  // More frequent mountains
//       baseHeight: 40,        // Higher base terrain
//       mountainHeight: 60,    // Taller mountains
//       detailHeight: 15       // More pronounced detail
//   };

//   // Set a proper view distance
//   this.viewDistance = 6;
//     // Initialize noise with random seed
//     this.seed = Math.random() * 10000;
//     this.noise = createNoise2D();

//     this.biomes = {
//       safeZone: { scale: 0.0005, height: 0.2 }, // Gentler safe zone
//       mountains: { scale: 0.001, height: 0.8 }, // Less extreme mountains
//       valleys: { scale: 0.001, height: 0.4 },
//       plains: { scale: 0.002, height: 0.3 },
//     };

//     // Reduced feature intensity
//     this.features = {
//       ridges: { scale: 0.005, strength: 0.3 },
//       detail: { scale: 0.02, strength: 0.1 },
//     };

//     // Terrain materials
//     this.materials = {};
//   }

//   // async initialize() {
//   //   await this.createMaterials();
//   //   this.createLights();
//   //   this.createSky();
//   //   this.createInitialTerrain();
//   //   this.createWater();
//   //   this.createManaNodes();

//   //   // Set initial camera position
//   //   this.engine.camera.position.set(0, 50, 0);
//   //   this.engine.camera.lookAt(50, 0, 50);

//   //   console.log("World system initialized");
//   // }


//   createInitialTerrain() {
//     console.log("Creating initial terrain..."); // Debug log

//     // Create larger initial area
//     for (let x = -3; x <= 3; x++) {
//         for (let z = -3; z <= 3; z++) {
//             const startX = x * this.chunkSize;
//             const startZ = z * this.chunkSize;
//             const key = `${startX},${startZ}`;
            
//             if (!this.currentChunks.has(key)) {
//                 try {
//                     const geometry = this.createChunkGeometry(startX, startZ);
//                     const mesh = new THREE.Mesh(
//                         geometry, 
//                         new THREE.MeshStandardMaterial({
//                             vertexColors: true,
//                             wireframe: true // Temporary for debugging
//                         })
//                     );
                    
//                     mesh.position.set(startX, 0, startZ);
//                     mesh.castShadow = true;
//                     mesh.receiveShadow = true;
                    
//                     console.log(`Creating chunk at ${startX}, ${startZ}`); // Debug log
//                     this.scene.add(mesh);
//                     this.currentChunks.set(key, mesh);
//                 } catch (error) {
//                     console.error("Error creating chunk:", error);
//                 }
//             }
//         }
//     }
// }

// getTerrainHeight(x, z) {
//     // Make sure we're getting real values
//     console.log(`Getting height for ${x}, ${z}`); // Debug log
    
//     try {
//         // Base terrain (gentle rolling hills)
//         const baseNoise = this.noise(
//             x * this.terrainParams.baseScale, 
//             z * this.terrainParams.baseScale
//         );
//         let height = (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;

//         // Log the height value
//         console.log(`Calculated height: ${height}`); // Debug log
        
//         return height;
//     } catch (error) {
//         console.warn('Error in getTerrainHeight:', error);
//         return 0;
//     }
// }

// createChunkGeometry(startX, startZ) {
//     console.log(`Creating chunk geometry at ${startX}, ${startZ}`); // Debug log

//     const geometry = new THREE.PlaneGeometry(
//         this.chunkSize,
//         this.chunkSize,
//         this.terrainResolution,
//         this.terrainResolution
//     );

//     // IMPORTANT: Rotate the plane to be horizontal
//     geometry.rotateX(-Math.PI / 2);

//     const vertices = geometry.attributes.position.array;
//     const colors = [];

//     // Debug first few vertices
//     console.log("First few vertices before modification:", 
//         vertices.slice(0, 9)); // Debug log

//     for (let i = 0; i < vertices.length; i += 3) {
//         const x = vertices[i] + startX;
//         const z = vertices[i + 1] + startZ;
        
//         const height = this.getTerrainHeight(x, z);
//         vertices[i + 2] = height; // Y is up after rotation

//         // Simple color based on height for debugging
//         const color = new THREE.Color();
//         color.setHSL(height / 100, 0.7, 0.5);
//         colors.push(color.r, color.g, color.b);
//     }

//     // Debug first few vertices after modification
//     console.log("First few vertices after modification:", 
//         vertices.slice(0, 9)); // Debug log

//     geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
//     geometry.computeVertexNormals();
    
//     return geometry;
// }

// async initialize() {
//     console.log("Initializing WorldSystem..."); // Debug log
    
//     await this.createMaterials();
//     this.createLights();
//     this.createSky();
    
//     // Set initial camera position for better debugging view
//     this.engine.camera.position.set(0, 200, 200);
//     this.engine.camera.lookAt(0, 0, 0);
    
//     // Create terrain after camera is positioned
//     this.createInitialTerrain();
//     this.createWater();
//     this.createManaNodes();

//     console.log("WorldSystem initialized"); // Debug log
// }

// createMaterials() {
//     this.materials.terrain = new THREE.MeshStandardMaterial({
//         vertexColors: true,
//         wireframe: true, // Temporary for debugging
//         side: THREE.DoubleSide, // Make sure both sides are visible
//         roughness: 0.8,
//         metalness: 0.1
//     });
// }

// async initialize() {
//   console.log("Initializing WorldSystem..."); // Debug log
  
//   await this.createMaterials();
//   this.createLights();
//   this.createSky();
  
//   // Set initial camera position for better debugging view
//   this.engine.camera.position.set(0, 200, 200);
//   this.engine.camera.lookAt(0, 0, 0);
  
//   // Create terrain after camera is positioned
//   this.createInitialTerrain();
//   this.createWater();
//   this.createManaNodes();

//   console.log("WorldSystem initialized"); // Debug log
// }

// createMaterials() {
//   this.materials.terrain = new THREE.MeshStandardMaterial({
//       vertexColors: true,
//       wireframe: true, // Temporary for debugging
//       side: THREE.DoubleSide, // Make sure both sides are visible
//       roughness: 0.8,
//       metalness: 0.1
//   });
// }


//   createLights() {
//     // Main directional light (sun)
//     const sunLight = new THREE.DirectionalLight(0xffffcc, 1);
//     sunLight.position.set(100, 100, 0);
//     this.scene.add(sunLight);

//     // Ambient light for general illumination
//     const ambientLight = new THREE.AmbientLight(0x334455, 0.5);
//     this.scene.add(ambientLight);
//   }

//   createSky() {
//     // Simple sky color
//     this.scene.background = new THREE.Color(0x88ccff);
//     this.scene.fog = new THREE.Fog(0x88ccff, 500, 1500);
//   }
//   getTerrainHeight(x, z) {
//     try {
//       // Base terrain with more dramatic hills
//       const baseNoise = this.noise(
//         x * this.terrainParams.baseScale,
//         z * this.terrainParams.baseScale
//       );
//       let height = (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;

//       // More dramatic mountains using ridged multifractal approach
//       const mountainNoise = Math.abs(
//         this.noise(
//           x * this.terrainParams.mountainScale,
//           z * this.terrainParams.mountainScale
//         )
//       );
//       height +=
//         Math.pow(mountainNoise, 1.2) * this.terrainParams.mountainHeight;

//       // Add sharp ridges and valleys
//       const ridgeNoise = Math.abs(
//         this.noise(
//           x * this.terrainParams.detailScale,
//           z * this.terrainParams.detailScale
//         )
//       );
//       height += ridgeNoise * ridgeNoise * this.terrainParams.detailHeight;

//       return height;
//     } catch (error) {
//       console.warn("Error in getTerrainHeight:", error);
//       return 0;
//     }
//   }

//   createChunkGeometry(startX, startZ) {
//     const geometry = new THREE.PlaneGeometry(
//         this.chunkSize,
//         this.chunkSize,
//         this.terrainResolution,
//         this.terrainResolution
//     );

//     // CRITICAL FIX: Rotate the plane to be horizontal
//     geometry.rotateX(-Math.PI / 2);

//     const vertices = geometry.attributes.position.array;
//     const colors = [];

//     for (let i = 0; i < vertices.length; i += 3) {
//         // FIXED: After rotation, y and z are swapped
//         const x = vertices[i] + startX;
//         const y = vertices[i + 2];  // This is now height
//         const z = vertices[i + 1] + startZ;
        
//         const height = this.getTerrainHeight(x, z);
//         vertices[i + 2] = height;  // Apply height to Y after rotation

//         // More vibrant colors for better visibility
//         let color = new THREE.Color();
//         if (height < this.waterLevel) {
//             color.setRGB(0.1, 0.2, 0.5); // Deep water areas
//         } else if (height < this.waterLevel + 5) {
//             color.setRGB(0.8, 0.7, 0.3); // Beaches
//         } else if (height < 30) {
//             color.setRGB(0.2, 0.5, 0.1); // Lowlands
//         } else if (height < 60) {
//             color.setRGB(0.4, 0.3, 0.2); // Hills
//         } else {
//             // Gradient for high mountains
//             const t = (height - 60) / 40;
//             color.setRGB(
//                 0.4 + t * 0.4, // More red in higher areas
//                 0.3 + t * 0.3,
//                 0.2 + t * 0.4
//             );
//         }

//         colors.push(color.r, color.g, color.b);
//     }

//     geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
//     geometry.computeVertexNormals();
//     return geometry;
// }

//   createInitialTerrain() {
//     // Create larger initial area
//     for (let x = -3; x <= 3; x++) {
//       for (let z = -3; z <= 3; z++) {
//         const startX = x * this.chunkSize;
//         const startZ = z * this.chunkSize;
//         const key = `${startX},${startZ}`;

//         if (!this.currentChunks.has(key)) {
//           const geometry = this.createChunkGeometry(startX, startZ);
//           const mesh = new THREE.Mesh(geometry, this.materials.terrain);
//           mesh.position.set(startX, 0, startZ);
//           mesh.castShadow = true;
//           mesh.receiveShadow = true;
//           this.scene.add(mesh);
//           this.currentChunks.set(key, mesh);
//         }
//       }
//     }
//   }

//   createWater() {
//     // Create larger water plane that follows the player
//     const waterGeometry = new THREE.PlaneGeometry(
//       this.chunkSize * 12, // Much larger water plane
//       this.chunkSize * 12
//     );
//     waterGeometry.rotateX(-Math.PI / 2);

//     // More dramatic water material
//     this.materials.water = new THREE.MeshStandardMaterial({
//       color: 0x0066cc,
//       transparent: true,
//       opacity: 0.6,
//       metalness: 0.9,
//       roughness: 0.1,
//     });

//     this.water = new THREE.Mesh(waterGeometry, this.materials.water);
//     this.water.position.y = this.waterLevel;
//     this.scene.add(this.water);
//   }
//   createManaNodes() {
//     // Keep your existing mana nodes creation logic
//     // This is just a placeholder implementation
//     for (let i = 0; i < 20; i++) {
//       const x = (Math.random() - 0.5) * this.worldSize;
//       const z = (Math.random() - 0.5) * this.worldSize;
//       const y = this.getTerrainHeight(x, z) + 10;

//       const nodeMesh = new THREE.Mesh(
//         new THREE.SphereGeometry(2, 8, 8),
//         new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff })
//       );

//       nodeMesh.position.set(x, y, z);
//       nodeMesh.userData.collected = false;

//       this.manaNodes.push(nodeMesh);
//       this.scene.add(nodeMesh);
//     }
//   }

//   calculateSlope(x, z) {
//     const sampleDistance = 2;
//     const heightDiffX = Math.abs(
//       this.getTerrainHeight(x + sampleDistance, z) -
//         this.getTerrainHeight(x - sampleDistance, z)
//     );
//     const heightDiffZ = Math.abs(
//       this.getTerrainHeight(x, z + sampleDistance) -
//         this.getTerrainHeight(x, z - sampleDistance)
//     );
//     return (
//       Math.sqrt(heightDiffX * heightDiffX + heightDiffZ * heightDiffZ) /
//       (sampleDistance * 2)
//     );
//   }

//   updateChunks() {
//     const player = this.engine.systems.player?.localPlayer;
//     if (!player) return;

//     try {
//       // Get current chunk coordinates from player position
//       const chunkX = Math.floor(player.position.x / this.chunkSize);
//       const chunkZ = Math.floor(player.position.z / this.chunkSize);

//       const chunksToKeep = new Set();

//       // Generate chunks in a circular pattern around player
//       for (let x = -this.viewDistance; x <= this.viewDistance; x++) {
//         for (let z = -this.viewDistance; z <= this.viewDistance; z++) {
//           const distance = Math.sqrt(x * x + z * z);
//           if (distance <= this.viewDistance) {
//             const worldX = (chunkX + x) * this.chunkSize;
//             const worldZ = (chunkZ + z) * this.chunkSize;
//             const key = `${worldX},${worldZ}`;

//             chunksToKeep.add(key);

//             if (!this.currentChunks.has(key)) {
//               const geometry = this.createChunkGeometry(worldX, worldZ);
//               const mesh = new THREE.Mesh(geometry, this.materials.terrain);
//               mesh.position.set(worldX, 0, worldZ);
//               mesh.castShadow = true;
//               mesh.receiveShadow = true;
//               this.scene.add(mesh);
//               this.currentChunks.set(key, mesh);
//             }
//           }
//         }
//       }

//       // Remove chunks that are too far from player
//       for (const [key, mesh] of this.currentChunks.entries()) {
//         if (!chunksToKeep.has(key)) {
//           this.scene.remove(mesh);
//           mesh.geometry.dispose();
//           this.currentChunks.delete(key);
//         }
//       }
//     } catch (error) {
//       console.warn("Error in updateChunks:", error);
//     }
//   }

//   createManaNodes() {
//     // Dynamically create mana nodes around the player
//     const player = this.engine.systems.player?.localPlayer;
//     if (!player) return;

//     // Create nodes within visible chunks
//     const spawnRadius = this.chunkSize * (this.viewDistance - 1);
//     const nodeCount = 20;

//     for (let i = 0; i < nodeCount; i++) {
//       const angle = Math.random() * Math.PI * 2;
//       const distance = Math.random() * spawnRadius;

//       const x = player.position.x + Math.cos(angle) * distance;
//       const z = player.position.z + Math.sin(angle) * distance;
//       const y = this.getTerrainHeight(x, z) + 10;

//       const nodeMesh = new THREE.Mesh(
//         new THREE.SphereGeometry(2, 8, 8),
//         new THREE.MeshStandardMaterial({
//           color: 0x00ffff,
//           emissive: 0x00ffff,
//           emissiveIntensity: 0.5,
//         })
//       );

//       nodeMesh.position.set(x, y, z);
//       nodeMesh.userData.collected = false;
//       this.manaNodes.push(nodeMesh);
//       this.scene.add(nodeMesh);
//     }
//   }

//   update(delta, elapsed) {
//     const player = this.engine.systems.player?.localPlayer;
//     if (!player) return;

//     // Update water to follow player
//     if (this.water) {
//       this.water.position.x = player.position.x;
//       this.water.position.z = player.position.z;
//       this.water.position.y = this.waterLevel + Math.sin(elapsed * 0.5) * 0.1;
//     }

//     // Dynamically manage mana nodes
//     if (this.manaNodes.length < 20) {
//       this.createManaNodes();
//     }

//     // Update chunks more frequently for smoother generation
//     this.updateChunks();

//     // Update existing mana nodes
//     this.manaNodes.forEach((node, index) => {
//       if (!node.userData.collected) {
//         node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.03;
//         node.rotation.y += delta * 0.5;
//       }
//     });
//   }
//   checkManaCollection(position, radius) {
//     const collectedNodes = [];

//     this.manaNodes.forEach((node) => {
//       if (!node.userData.collected) {
//         const distance = position.distanceTo(node.position);
//         if (distance < radius + 2) {
//           node.userData.collected = true;
//           node.visible = false;

//           collectedNodes.push({
//             position: node.position.clone(),
//             value: node.userData.value || 10,
//           });
//         }
//       }
//     });

//     return collectedNodes;
//   }
// }


// // V1
// // import * as THREE from 'three';
// // import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
// // import { Water } from 'three/examples/jsm/objects/Water.js';
// // import { Sky } from 'three/examples/jsm/objects/Sky.js';

// // export class WorldSystem {
// //   constructor(engine) {
// //     this.engine = engine;
// //     this.scene = engine.scene;
// //     this.terrain = null;
// //     this.water = null;
// //     this.sky = null;
// //     this.manaNodes = [];
// //     this.noise = new SimplexNoise();
// //     this.worldSize = 1000;
// //     this.heightScale = 60;
// //     this.seed = Math.random() * 1000;
// //   }

// //   async initialize() {
// //     this.createLights();
// //     this.createSky();
// //     this.createTerrain();
// //     this.createWater();
// //     this.createManaNodes();

// //     // Set camera position
// //     this.engine.camera.position.set(0, 50, 0);
// //     this.engine.camera.lookAt(50, 0, 50);

// //     console.log("World system initialized");
// //   }

// //   createLights() {
// //     // Ambient light
// //     const ambientLight = new THREE.AmbientLight(0x404040, 1);
// //     this.scene.add(ambientLight);

// //     // Directional light (sun)
// //     const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
// //     directionalLight.position.set(100, 100, 100);
// //     directionalLight.castShadow = true;

// //     // Set up shadow properties
// //     directionalLight.shadow.mapSize.width = 2048;
// //     directionalLight.shadow.mapSize.height = 2048;
// //     directionalLight.shadow.camera.near = 0.5;
// //     directionalLight.shadow.camera.far = 500;
// //     directionalLight.shadow.camera.left = -100;
// //     directionalLight.shadow.camera.right = 100;
// //     directionalLight.shadow.camera.top = 100;
// //     directionalLight.shadow.camera.bottom = -100;
// //     directionalLight.shadow.bias = -0.0005;

// //     this.scene.add(directionalLight);
// //     this.sunLight = directionalLight;
// //   }

// //   createSky() {
// //     // Create sky
// //     this.sky = new Sky();
// //     this.sky.scale.setScalar(10000);
// //     this.scene.add(this.sky);

// //     // Set up sun parameters
// //     const skyUniforms = this.sky.material.uniforms;
// //     skyUniforms['turbidity'].value = 10;
// //     skyUniforms['rayleigh'].value = 2;
// //     skyUniforms['mieCoefficient'].value = 0.005;
// //     skyUniforms['mieDirectionalG'].value = 0.8;

// //     const sunPosition = new THREE.Vector3();
// //     const phi = THREE.MathUtils.degToRad(90 - 10); // Sun elevation
// //     const theta = THREE.MathUtils.degToRad(180); // Sun azimuth

// //     sunPosition.setFromSphericalCoords(1, phi, theta);
// //     skyUniforms['sunPosition'].value.copy(sunPosition);

// //     // Update sun light direction to match sky
// //     this.sunLight.position.copy(sunPosition.multiplyScalar(100));
// //     this.sunLight.updateMatrixWorld();
// //   }

// //   createTerrain() {
// //     // Create terrain geometry
// //     const geometry = new THREE.PlaneGeometry(
// //       this.worldSize,
// //       this.worldSize,
// //       128,
// //       128
// //     );
// //     geometry.rotateX(-Math.PI / 2);

// //     // Create terrain material
// //     const terrainTexture = this.engine.assets.getTexture('terrain');
// //     if (terrainTexture) {
// //       terrainTexture.wrapS = THREE.RepeatWrapping;
// //       terrainTexture.wrapT = THREE.RepeatWrapping;
// //       terrainTexture.repeat.set(16, 16);
// //     }

// //     const material = new THREE.MeshStandardMaterial({
// //       map: terrainTexture,
// //       roughness: 0.8,
// //       metalness: 0.2,
// //       vertexColors: true
// //     });

// //     // Apply height map using simplex noise
// //     const vertices = geometry.attributes.position;
// //     const colors = new Float32Array(vertices.count * 3);
// //     const color = new THREE.Color();

// //     for (let i = 0; i < vertices.count; i++) {
// //       const x = vertices.getX(i);
// //       const z = vertices.getZ(i);

// //       // Get noise value for current position
// //       const nx = x / this.worldSize;
// //       const nz = z / this.worldSize;

// //       // Combine multiple noise scales for more detailed terrain
// //       const noise1 = this.noise.noise(nx * 1.5 + this.seed, nz * 1.5 + this.seed) * 0.5;
// //       const noise2 = this.noise.noise(nx * 3 + this.seed * 2, nz * 3 + this.seed * 2) * 0.25;
// //       const noise3 = this.noise.noise(nx * 6 + this.seed * 3, nz * 6 + this.seed * 3) * 0.125;

// //       // Combine different noise scales
// //       const combinedNoise = noise1 + noise2 + noise3;

// //       // Calculate height and apply to vertex
// //       const height = combinedNoise * this.heightScale;
// //       vertices.setY(i, height);

// //       // Color based on height
// //       if (height < 2) {
// //         color.setRGB(0.8, 0.7, 0.5); // Sand
// //       } else if (height < 10) {
// //         color.setRGB(0.1, 0.8, 0.1); // Grass
// //       } else if (height < 20) {
// //         color.setRGB(0.5, 0.5, 0.1); // Forest
// //       } else {
// //         color.setRGB(0.5, 0.5, 0.5); // Mountain
// //       }

// //       colors[i * 3] = color.r;
// //       colors[i * 3 + 1] = color.g;
// //       colors[i * 3 + 2] = color.b;
// //     }

// //     geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
// //     geometry.computeVertexNormals();

// //     // Create terrain mesh
// //     this.terrain = new THREE.Mesh(geometry, material);
// //     this.terrain.receiveShadow = true;
// //     this.terrain.castShadow = true;
// //     this.scene.add(this.terrain);

// //     // Create collision data for terrain
// //     this.createTerrainCollision();
// //   }

// //   createTerrainCollision() {
// //     // Simple heightmap lookup for collision detection
// //     // In a full implementation, you might use a more sophisticated approach
// //     this.heightMap = [];
// //     const resolution = 100;
// //     const step = this.worldSize / resolution;

// //     for (let i = 0; i <= resolution; i++) {
// //       this.heightMap[i] = [];
// //       for (let j = 0; j <= resolution; j++) {
// //         const x = (i / resolution) * this.worldSize - this.worldSize / 2;
// //         const z = (j / resolution) * this.worldSize - this.worldSize / 2;

// //         const nx = x / this.worldSize;
// //         const nz = z / this.worldSize;

// //         // Same noise function as in createTerrain
// //         const noise1 = this.noise.noise(nx * 1.5 + this.seed, nz * 1.5 + this.seed) * 0.5;
// //         const noise2 = this.noise.noise(nx * 3 + this.seed * 2, nz * 3 + this.seed * 2) * 0.25;
// //         const noise3 = this.noise.noise(nx * 6 + this.seed * 3, nz * 6 + this.seed * 3) * 0.125;

// //         this.heightMap[i][j] = (noise1 + noise2 + noise3) * this.heightScale;
// //       }
// //     }
// //   }

// //   getTerrainHeight(x, z) {
// //     // Convert world coordinates to heightmap coordinates
// //     const halfSize = this.worldSize / 2;
// //     const nx = ((x + halfSize) / this.worldSize) * (this.heightMap.length - 1);
// //     const nz = ((z + halfSize) / this.worldSize) * (this.heightMap[0].length - 1);

// //     // Get the four surrounding height values
// //     const x1 = Math.floor(nx);
// //     const x2 = Math.min(Math.ceil(nx), this.heightMap.length - 1);
// //     const z1 = Math.floor(nz);
// //     const z2 = Math.min(Math.ceil(nz), this.heightMap[0].length - 1);

// //     const h11 = this.heightMap[x1][z1];
// //     const h21 = this.heightMap[x2][z1];
// //     const h12 = this.heightMap[x1][z2];
// //     const h22 = this.heightMap[x2][z2];

// //     // Bilinear interpolation
// //     const fx = nx - x1;
// //     const fz = nz - z1;

// //     const h1 = h11 * (1 - fx) + h21 * fx;
// //     const h2 = h12 * (1 - fx) + h22 * fx;

// //     return h1 * (1 - fz) + h2 * fz;
// //   }

// //   createWater() {
// //     const waterGeometry = new THREE.PlaneGeometry(this.worldSize * 2, this.worldSize * 2);

// //     // Create water with reflections
// //     this.water = new Water(waterGeometry, {
// //       textureWidth: 512,
// //       textureHeight: 512,
// //       waterNormals: new THREE.TextureLoader().load('assets/textures/waternormals.jpg', function (texture) {
// //         texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
// //       }),
// //       sunDirection: new THREE.Vector3(0, 1, 0),
// //       sunColor: 0xffffff,
// //       waterColor: 0x001e0f,
// //       distortionScale: 3.7,
// //       fog: this.scene.fog !== undefined
// //     });

// //     this.water.rotation.x = -Math.PI / 2;
// //     this.water.position.y = 0; // Water level
// //     this.scene.add(this.water);
// //   }

// //   createManaNodes() {
// //     // Create mana collection points throughout the world
// //     const nodeCount = 20;
// //     this.manaNodes = [];

// //     for (let i = 0; i < nodeCount; i++) {
// //       // Random position within the world bounds
// //       const x = (Math.random() - 0.5) * this.worldSize * 0.8;
// //       const z = (Math.random() - 0.5) * this.worldSize * 0.8;
// //       const y = this.getTerrainHeight(x, z) + 10; // Floating above terrain

// //       // Create mana node visual
// //       const geometry = new THREE.SphereGeometry(2, 16, 16);
// //       const material = new THREE.MeshStandardMaterial({
// //         color: 0x00ffff,
// //         emissive: 0x00aaff,
// //         emissiveIntensity: 0.5,
// //         transparent: true,
// //         opacity: 0.8
// //       });

// //       const node = new THREE.Mesh(geometry, material);
// //       node.position.set(x, y, z);
// //       node.castShadow = true;
// //       node.userData = {
// //         type: 'mana',
// //         value: 10 + Math.floor(Math.random() * 20), // Random value
// //         collected: false
// //       };

// //       // Add glow effect
// //       const glowGeometry = new THREE.SphereGeometry(3, 16, 16);
// //       const glowMaterial = new THREE.MeshBasicMaterial({
// //         color: 0x00ffff,
// //         transparent: true,
// //         opacity: 0.3,
// //         side: THREE.BackSide
// //       });

// //       const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
// //       node.add(glowMesh);

// //       this.scene.add(node);
// //       this.manaNodes.push(node);
// //     }
// //   }

// //   update(delta, elapsed) {
// //     // Animate water
// //     if (this.water) {
// //       this.water.material.uniforms['time'].value += delta;
// //     }

// //     // Animate mana nodes (bobbing and rotating)
// //     this.manaNodes.forEach((node, index) => {
// //       if (!node.userData.collected) {
// //         node.position.y += Math.sin(elapsed * 2 + index * 0.5) * 0.03;
// //         node.rotation.y += delta * 0.5;
// //       }
// //     });
// //   }

// //   // Check if a mana node is collected
// //   checkManaCollection(position, radius) {
// //     const collectedNodes = [];

// //     this.manaNodes.forEach((node) => {
// //       if (!node.userData.collected) {
// //         const distance = position.distanceTo(node.position);
// //         if (distance < radius + 2) { // 2 is the node radius
// //           node.userData.collected = true;

// //           // Make the node disappear
// //           node.visible = false;

// //           collectedNodes.push({
// //             position: node.position.clone(),
// //             value: node.userData.value
// //           });
// //         }
// //       }
// //     });

// //     return collectedNodes;
// //   }
// // }
