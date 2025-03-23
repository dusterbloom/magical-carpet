# Magical Carpet: Mobile Optimization Plan

## Progress Report

### Completed Optimizations

- ✅ **Task 1 (2025-03-23):** Implemented Adaptive Resolution Scaling and Optimized Renderer Configuration
  - Added dynamic resolution scaling based on FPS performance
  - Applied mobile-specific renderer settings (mediump precision, disabled antialiasing and shadows)
  - Set up the framework for progressive quality adjustments

- ✅ **Task 2 (2025-03-24):** Implemented Dynamic LOD (Level of Detail) System and Frustum Culling
  - Created multi-level LOD system that adjusts terrain detail based on distance from player
  - Implemented different LOD materials with varying complexity and shader cost
  - Added frustum culling to skip rendering objects outside of camera view
  - Applied culling optimizations to terrain chunks and game objects
  - Mobile-specific LOD adjustments to maintain smooth performance

### Next Tasks

- 🔄 **Task 3:** Set up Particle System Optimization with object pooling
  - Implement particle pooling for carpet trail effects
  - Reduce particle count and lifetime on mobile devices
  - Add instanced rendering for particles to reduce draw calls

- 🔄 **Task 4:** Implement Texture Optimization for mobile devices
  - Create mipmap chains for critical textures
  - Generate lower resolution texture variants for mobile
  - Implement on-demand texture loading based on proximity

- 🔄 **Task 5:** Add Terrain Height Caching and Memory Optimization
  - Implement efficient height caching for terrain collision checks
  - Set up chunk pooling to reduce garbage collection
  - Add dynamic memory management based on device capabilities

---

This implementation plan focuses on optimizing the Magical Carpet game to achieve 60 FPS performance on mobile devices while maintaining core gameplay functionality.

## Performance Analysis

Based on code review, the current bottlenecks likely include:

1. **Terrain Generation and Rendering** - The most complex visual system with high polygon count and multiple noise calculations
2. **Particle Effects** - The trail and visual effects system creates many objects
3. **World Updates** - Large number of objects updating every frame
4. **Rendering Configuration** - Non-optimized Three.js settings
5. **Asset Management** - Inefficient texture and model handling

## Implementation Plan

### 1. Renderer and Scene Optimization

#### 1.1 Adaptive Resolution Scaling
```javascript
// In Engine.js constructor
this.qualityManager = {
  targetFPS: 60,
  currentFPS: 60,
  sampleSize: 20,
  fpsHistory: [],
  resolutionScale: 1.0,
  minResolutionScale: 0.5,
  updateInterval: 1.0, // seconds
  timeSinceLastUpdate: 0
};

// Add this to Engine.js update method
updateQuality(delta) {
  const { qualityManager } = this;
  
  // Calculate current FPS
  const fps = 1 / delta;
  qualityManager.fpsHistory.push(fps);
  
  // Keep history to sample size
  if (qualityManager.fpsHistory.length > qualityManager.sampleSize) {
    qualityManager.fpsHistory.shift();
  }
  
  // Only update periodically
  qualityManager.timeSinceLastUpdate += delta;
  if (qualityManager.timeSinceLastUpdate < qualityManager.updateInterval) return;
  
  // Reset timer
  qualityManager.timeSinceLastUpdate = 0;
  
  // Calculate average FPS
  const avgFPS = qualityManager.fpsHistory.reduce((a, b) => a + b, 0) / 
                qualityManager.fpsHistory.length;
  qualityManager.currentFPS = avgFPS;
  
  // Adjust resolution if FPS is too low
  if (avgFPS < qualityManager.targetFPS * 0.8) {
    // Reduce resolution by 10%
    qualityManager.resolutionScale = Math.max(
      qualityManager.minResolutionScale,
      qualityManager.resolutionScale * 0.9
    );
    
    // Apply new resolution
    this.updateRendererResolution();
    console.log(`Performance: Decreasing resolution to ${qualityManager.resolutionScale.toFixed(2)}`);
  } 
  // Increase resolution if FPS is high enough
  else if (avgFPS > qualityManager.targetFPS * 1.1 && qualityManager.resolutionScale < 1.0) {
    // Increase resolution by 5%
    qualityManager.resolutionScale = Math.min(
      1.0,
      qualityManager.resolutionScale * 1.05
    );
    
    // Apply new resolution
    this.updateRendererResolution();
    console.log(`Performance: Increasing resolution to ${qualityManager.resolutionScale.toFixed(2)}`);
  }
}

// Add this method to Engine.js
updateRendererResolution() {
  const width = window.innerWidth * this.qualityManager.resolutionScale;
  const height = window.innerHeight * this.qualityManager.resolutionScale;
  
  this.renderer.setSize(width, height, false);
  this.renderer.domElement.style.width = '100%';
  this.renderer.domElement.style.height = '100%';
}
```

#### 1.2 Optimized Renderer Configuration
```javascript
// Update in Engine.js constructor
this.renderer.setPixelRatio(this.devicePixelRatio);
this.renderer.powerPreference = "high-performance";
this.renderer.logarithmicDepthBuffer = false;  // Disable for performance
this.renderer.shadowMap.enabled = false;  // Disable on mobile
this.renderer.shadowMap.autoUpdate = false;  // Disable dynamic shadows

// Device-specific optimizations
if (this.isMobile) {
  this.renderer.precision = "mediump";  // Use medium precision on mobile
  this.renderer.antialias = false;      // Disable antialiasing on mobile
}
```

#### 1.3 Frustum Culling Implementation
```javascript
// Add to WorldSystem.js
initializeFrustumCulling() {
  this.frustum = new THREE.Frustum();
  this.frustumMatrix = new THREE.Matrix4();
  this.cameraViewProjectionMatrix = new THREE.Matrix4();
  this.boundingSpheres = new Map();  // Store bounding spheres for quick checks
}

updateFrustum() {
  this.cameraViewProjectionMatrix.multiplyMatrices(
    this.engine.camera.projectionMatrix,
    this.engine.camera.matrixWorldInverse
  );
  this.frustum.setFromProjectionMatrix(this.cameraViewProjectionMatrix);
}

// Only update/render objects in view
isInView(object) {
  // Get or create bounding sphere
  if (!this.boundingSpheres.has(object.id)) {
    if (!object.geometry) return true; // Object without geometry (e.g., groups)
    
    // Create bounding sphere if needed
    if (!object.geometry.boundingSphere) {
      object.geometry.computeBoundingSphere();
    }
    
    const sphere = object.geometry.boundingSphere.clone();
    sphere.radius *= Math.max(object.scale.x, object.scale.y, object.scale.z);
    this.boundingSpheres.set(object.id, sphere);
  }
  
  // Get cached sphere
  const boundingSphere = this.boundingSpheres.get(object.id);
  
  // Transform sphere to world space
  const center = boundingSphere.center.clone();
  center.applyMatrix4(object.matrixWorld);
  
  // Check if sphere is in frustum
  return this.frustum.intersectsSphere(
    new THREE.Sphere(center, boundingSphere.radius)
  );
}
```

### 2. Terrain System Optimization

#### 2.1 Dynamic LOD (Level of Detail) System 
```javascript
// Add to WorldSystem.js constructor
this.terrainLOD = {
  distances: [
    { distance: 500, resolution: 64 },    // Close chunks: high detail
    { distance: 1000, resolution: 32 },   // Medium chunks: medium detail
    { distance: 1500, resolution: 16 },   // Far chunks: low detail
    { distance: 2000, resolution: 8 }     // Very far chunks: very low detail
  ]
};

// Update createChunkGeometry method to use LOD
createChunkGeometry(startX, startZ) {
  // Calculate distance from player to chunk center
  const player = this.engine.systems.player?.localPlayer;
  const chunkCenterX = startX + this.chunkSize / 2;
  const chunkCenterZ = startZ + this.chunkSize / 2;
  
  let resolution = this.terrainResolution; // Default resolution
  
  if (player) {
    const dx = player.position.x - chunkCenterX;
    const dz = player.position.z - chunkCenterZ;
    const distanceToChunk = Math.sqrt(dx * dx + dz * dz);
    
    // Find appropriate LOD level
    for (const lod of this.terrainLOD.distances) {
      if (distanceToChunk < lod.distance) {
        resolution = lod.resolution;
        break;
      }
    }
  }
  
  // Create geometry with appropriate resolution
  const geometry = new THREE.PlaneGeometry(
    this.chunkSize,
    this.chunkSize,
    resolution,
    resolution
  );
  
  // ... rest of the method remains the same ...
}
```

#### 2.2 Simplified Terrain Generation for Mobile
```javascript
// Add to WorldSystem.js constructor
this.isMobile = this.engine.isMobile;
if (this.isMobile) {
  // Simplified terrain parameters for mobile
  this.terrainParams = {
    baseScale: 0.003,        // Lower detail for base terrain
    detailScale: 0.02,       // Lower detail for terrain features
    mountainScale: 0.006,    // Lower detail for mountains
    baseHeight: 40,          // Keep heights similar
    mountainHeight: 80,      // Keep heights similar
    detailHeight: 15         // Reduce detail height slightly
  };
  
  // Reduce active chunk count on mobile
  this.viewDistance = 4;     // Fewer visible chunks
}

// Optimize getTerrainHeight for mobile
getTerrainHeight(x, z) {
  if (this.isMobile) {
    // Simpler terrain generation for mobile
    // Base terrain with less octaves
    const baseNoise = this.noise(x * this.terrainParams.baseScale, z * this.terrainParams.baseScale);
    let height = (baseNoise + 1) * 0.5 * this.terrainParams.baseHeight;
    
    // Simpler mountains
    const mountainNoise = Math.abs(this.noise(x * this.terrainParams.mountainScale, z * this.terrainParams.mountainScale));
    height += Math.pow(mountainNoise, 1.5) * this.terrainParams.mountainHeight;
    
    // Skip additional detail octaves on mobile
    return height;
  } else {
    // Original detailed terrain generation for desktop
    // ... existing method ...
  }
}
```

#### 2.3 Chunk Pooling System
```javascript
// Add to WorldSystem.js constructor
this.chunkPool = [];
this.maxPoolSize = 20; // Maximum number of unused chunks to keep in memory

// Update method to create or reuse chunks
getChunkFromPool() {
  if (this.chunkPool.length > 0) {
    return this.chunkPool.pop();
  } else {
    // Create new chunk geometry with placeholder
    const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 2, 2);
    geometry.rotateX(-Math.PI / 2);
    return new THREE.Mesh(geometry, this.materials.terrain);
  }
}

returnChunkToPool(chunk) {
  if (this.chunkPool.length < this.maxPoolSize) {
    // Reset chunk properties
    chunk.visible = false;
    chunk.position.set(0, -1000, 0); // Move off-screen
    this.chunkPool.push(chunk);
  } else {
    // Dispose chunk if pool is full
    chunk.geometry.dispose();
    if (chunk.material) {
      if (Array.isArray(chunk.material)) {
        chunk.material.forEach(m => m.dispose());
      } else {
        chunk.material.dispose();
      }
    }
  }
}

// Modify updateChunks method to use pooling
updateChunks() {
  // ... existing code ...
  
  // For chunks to remove
  for (const [key, mesh] of this.currentChunks.entries()) {
    if (!chunksToKeep.has(key)) {
      this.scene.remove(mesh);
      this.returnChunkToPool(mesh);
      this.currentChunks.delete(key);
    }
  }
  
  // For new chunks to add
  for (const [worldX, worldZ] of newChunksToAdd) {
    const key = `${worldX},${worldZ}`;
    const chunk = this.getChunkFromPool();
    
    // Update geometry for this chunk
    const geometry = this.createChunkGeometry(worldX, worldZ);
    chunk.geometry.dispose(); // Dispose old geometry
    chunk.geometry = geometry;
    
    chunk.position.set(worldX, 0, worldZ);
    chunk.visible = true;
    this.scene.add(chunk);
    this.currentChunks.set(key, chunk);
  }
}
```

### 3. Visual Effects Optimization

#### 3.1 Particle System Optimization
```javascript
// Update CarpetTrailSystem.js constructor
constructor(engine) {
  // ... existing code ...
  
  // Reduce particle counts for mobile
  if (engine.isMobile) {
    this.maxParticles = 50;           // 75% reduction
    this.particleLifespan = 1.0;      // Shorter lifespan
    this.emissionRate = 25;           // Lower emission rate
    this.maxMotionLines = 4;          // Fewer motion lines
    this.maxSteamParticles = 25;      // Fewer steam particles
    this.maxRibbonPoints = 20;        // Shorter ribbon trail
  }
  
  // Create particle geometry and materials once
  this.particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
  this.steamGeometry = new THREE.PlaneGeometry(0.5, 0.5);
}

// Use object pooling for particles
createParticlePool() {
  this.particlePool = [];
  this.steamPool = [];
  
  // Pre-create some particles
  for (let i = 0; i < 20; i++) {
    const particle = new THREE.Mesh(
      this.particleGeometry,
      this.particleMaterial.clone()
    );
    particle.visible = false;
    this.scene.add(particle);
    this.particlePool.push(particle);
    
    const steam = new THREE.Mesh(
      this.steamGeometry,
      this.steamMaterial.clone()
    );
    steam.visible = false;
    this.scene.add(steam);
    this.steamPool.push(steam);
  }
}

// Get particle from pool or create new one
getParticleFromPool() {
  if (this.particlePool.length > 0) {
    const particle = this.particlePool.pop();
    particle.visible = true;
    return particle;
  } else {
    const particle = new THREE.Mesh(
      this.particleGeometry, 
      this.particleMaterial.clone()
    );
    this.scene.add(particle);
    return particle;
  }
}

// Return particle to pool
returnParticleToPool(particle) {
  if (this.particlePool.length < 50) {
    particle.visible = false;
    particle.position.set(0, -1000, 0);
    this.particlePool.push(particle);
  } else {
    this.scene.remove(particle);
    particle.material.dispose();
  }
}

// Similar methods for steam particles and motion lines
```

#### 3.2 Instanced Mesh for Particles
```javascript
// Even more optimized alternative: Use InstancedMesh
initializeInstancedParticles() {
  // Create instanced mesh for particles (much more efficient)
  this.particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
  this.particleInstanceCount = this.maxParticles;
  this.particleInstancedMesh = new THREE.InstancedMesh(
    this.particleGeometry,
    this.particleMaterial,
    this.particleInstanceCount
  );
  
  // Initialize instances
  this.particleInstances = [];
  for (let i = 0; i < this.particleInstanceCount; i++) {
    this.particleInstances.push({
      active: false,
      lifetime: 0,
      maxLifetime: 0,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      scale: 1.0
    });
    
    // Set initial transform
    const matrix = new THREE.Matrix4();
    matrix.setPosition(0, -1000, 0); // Hide inactive particles
    this.particleInstancedMesh.setMatrixAt(i, matrix);
  }
  
  this.scene.add(this.particleInstancedMesh);
}

// Update instanced particles
updateInstancedParticles(delta) {
  let needsUpdate = false;
  
  for (let i = 0; i < this.particleInstances.length; i++) {
    const instance = this.particleInstances[i];
    
    if (!instance.active) continue;
    
    // Update lifetime
    instance.lifetime += delta;
    if (instance.lifetime >= instance.maxLifetime) {
      instance.active = false;
      
      // Hide particle
      const matrix = new THREE.Matrix4();
      matrix.setPosition(0, -1000, 0);
      this.particleInstancedMesh.setMatrixAt(i, matrix);
      needsUpdate = true;
      continue;
    }
    
    // Update position
    instance.position.add(instance.velocity.clone().multiplyScalar(delta));
    
    // Update scale based on lifetime
    const scale = instance.scale * (1 - instance.lifetime / instance.maxLifetime);
    
    // Update matrix
    const matrix = new THREE.Matrix4();
    matrix.makeScale(scale, scale, scale);
    matrix.setPosition(instance.position);
    this.particleInstancedMesh.setMatrixAt(i, matrix);
    needsUpdate = true;
  }
  
  if (needsUpdate) {
    this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
  }
}

// Emit a particle using instances
emitInstancedParticle(position) {
  // Find inactive instance
  for (let i = 0; i < this.particleInstances.length; i++) {
    const instance = this.particleInstances[i];
    if (!instance.active) {
      // Activate instance
      instance.active = true;
      instance.lifetime = 0;
      instance.maxLifetime = this.particleLifespan;
      instance.position.copy(position);
      instance.scale = 0.1 + Math.random() * 0.2;
      instance.velocity.set(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.2 - 0.05,
        (Math.random() - 0.5) * 0.5
      );
      
      // Update matrix
      const matrix = new THREE.Matrix4();
      matrix.makeScale(instance.scale, instance.scale, instance.scale);
      matrix.setPosition(instance.position);
      this.particleInstancedMesh.setMatrixAt(i, matrix);
      this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
      return true;
    }
  }
  
  return false; // No available instance
}
```

#### 3.3 Simplified Visual Effects for Mobile
```javascript
// In CarpetTrailSystem.js update method
update(delta) {
  const player = this.engine.systems.player?.localPlayer;
  if (!player) return;
  
  // Get player position and velocity
  const position = player.position.clone();
  position.y -= 0.7; // Emit from bottom of carpet
  const velocity = player.velocity.clone();
  const speed = velocity.length();
  
  // Mobile optimizations - different effects based on device
  if (this.engine.isMobile) {
    // On mobile, only show effects at higher speeds
    const speedThreshold = 10; // Higher threshold for mobile
    
    // Update timers
    this.timeSinceLastEmission += delta;
    this.timeSinceLastRibbonUpdate += delta;
    
    // Only emit particles at higher speeds and at lower rate
    if (speed > speedThreshold && this.timeSinceLastEmission > 1 / this.emissionRate) {
      this.createParticle(position);
      this.timeSinceLastEmission = 0;
    }
    
    // Skip motion lines and steam on mobile
    // Only update ribbon at higher speeds
    if (speed > speedThreshold && this.timeSinceLastRibbonUpdate > this.ribbonUpdateFrequency) {
      this.updateRibbonTrail(position);
      this.timeSinceLastRibbonUpdate = 0;
    }
  } else {
    // Desktop - full effects
    // ... existing update logic ...
  }
  
  // Update existing effects
  this.updateParticles(delta);
  this.updateMotionLines(delta);
  this.updateSteamParticles(delta);
}
```

### 4. Physics and Gameplay Optimizations

#### 4.1 Simplified Physics for Mobile
```javascript
// In PlayerPhysics.js
updatePhysics(delta) {
  const player = this.playerSystem.localPlayer;
  if (!player) return;
  
  // Mobile optimizations - simpler physics
  if (this.engine.isMobile) {
    // Apply simplified physics calculations for mobile
    
    // Apply momentum with fewer calculations
    this.simplifiedPreserveMomentum(player, delta);
    
    // Apply velocity with basic smoothing
    player.velocity.add(player.acceleration.clone().multiplyScalar(delta));
    
    // Simple drag factor
    const dragFactor = 0.98;
    player.velocity.multiplyScalar(dragFactor);
    
    // Update position
    player.position.add(player.velocity.clone().multiplyScalar(delta));
    
    // Basic altitude update
    this.updateAltitude(player, delta);
    
    // Reset acceleration
    player.acceleration.set(0, 0, 0);
  } else {
    // Desktop - full physics
    // ... existing physics logic ...
  }
}

// Simplified momentum preservation for mobile
simplifiedPreserveMomentum(player, delta) {
  if (Math.abs(player.bankAngle) > 0.01) {
    const currentSpeed = player.velocity.length();
    const forwardDir = new THREE.Vector3(0, 0, 1).applyEuler(player.rotation);
    
    // Use simplified lerp with fixed factor
    player.velocity.lerp(forwardDir.multiplyScalar(currentSpeed), 0.1);
  }
}
```

#### 4.2 Optimized Terrain Collision
```javascript
// In WorldSystem.js
// Create a terrain height cache to reduce calculations
initializeTerrainCache() {
  this.terrainHeightCache = new Map();
  this.maxCacheSize = 1000;
  this.cacheHits = 0;
  this.cacheMisses = 0;
}

// Update getTerrainHeight to use cache
getTerrainHeight(x, z) {
  // Round coordinates to reduce cache size and improve hit rate
  const roundFactor = 2; // Round to nearest 2 units
  const roundedX = Math.round(x / roundFactor) * roundFactor;
  const roundedZ = Math.round(z / roundFactor) * roundFactor;
  
  // Create cache key
  const key = `${roundedX},${roundedZ}`;
  
  // Check cache
  if (this.terrainHeightCache.has(key)) {
    this.cacheHits++;
    return this.terrainHeightCache.get(key);
  }
  
  // Cache miss - calculate height
  this.cacheMisses++;
  const height = this.calculateTerrainHeight(roundedX, roundedZ);
  
  // Add to cache
  if (this.terrainHeightCache.size >= this.maxCacheSize) {
    // Remove oldest entry (first key in map)
    const firstKey = this.terrainHeightCache.keys().next().value;
    this.terrainHeightCache.delete(firstKey);
  }
  
  this.terrainHeightCache.set(key, height);
  return height;
}

// Original calculation moved to this method
calculateTerrainHeight(x, z) {
  // ... existing terrain generation code ...
}
```

### 5. Asset and Resource Management

#### 5.1 Texture Optimization

#### 5.1 Texture Optimization
```javascript
// In AssetManager.js
optimizeTexturesForMobile() {
  if (!this.engine.isMobile) return;
  
  // Reduce texture sizes for mobile
  for (const [name, texture] of Object.entries(this.textures)) {
    // Set lower resolution for mobile
    texture.minFilter = THREE.LinearFilter; // Simpler filtering
    texture.anisotropy = 1; // Disable anisotropic filtering
    
    // Reduce memory usage by limiting mipmaps
    texture.generateMipmaps = false;
  }
  
  console.log("Optimized textures for mobile device");
}

async loadTextures() {
  const textureFiles = [
    { name: 'carpet', path: '/assets/textures/carpet.jpg', mobilePath: '/assets/textures/carpet_small.jpg' },
    { name: 'terrain', path: '/assets/textures/terrain.jpg', mobilePath: '/assets/textures/terrain_small.jpg' },
    { name: 'sky', path: '/assets/textures/sky.jpg', mobilePath: '/assets/textures/sky_small.jpg' },
    { name: 'particles', path: '/assets/textures/particles.png', mobilePath: '/assets/textures/particles_small.png' }
  ];
  
  const loader = this.textureLoader;
  
  textureFiles.forEach(({ name, path, mobilePath }) => {
    // Use smaller textures on mobile if available
    const texturePath = this.engine.isMobile && mobilePath ? mobilePath : path;
    
    loader.load(texturePath, (texture) => {
      texture.encoding = THREE.sRGBEncoding;
      this.textures[name] = texture;
    });
  });
}
```

#### 5.2 Procedural Asset Generation and Management
```javascript
// In PlayerModels.js
generateProceduralCarpet() {
  // Instead of loading detailed models, generate simple ones procedurally
  const carpetGeometry = new THREE.BoxGeometry(5, 0.2, 8);
  
  // Add some vertex displacement for a fabric-like appearance
  const positions = carpetGeometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    // Only disturb the top vertices (y > 0)
    if (positions[i + 1] > 0) {
      positions[i + 1] += (Math.random() - 0.5) * 0.1;
    }
  }
  
  // Create a simple material with procedural texture
  const canvas = document.createElement('canvas');
  canvas.width = 64;  // Very small for mobile
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  // Draw carpet pattern
  ctx.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 64, 64);
  
  // Add some pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 16);
    ctx.lineTo(64, i * 16);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.8,
    metalness: 0.2
  });
  
  return new THREE.Mesh(carpetGeometry, material);
}

// Generate smaller, procedural mana nodes
generateProceduralManaNode() {
  // For mobile, use much simpler geometry
  const geometry = this.engine.isMobile ? 
    new THREE.OctahedronGeometry(1.5, 0) : // Lower poly count
    new THREE.SphereGeometry(2, 8, 8);     // Higher poly for desktop
    
  // Simple emissive material - no textures needed
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.8
  });
  
  const node = new THREE.Mesh(geometry, material);
  
  // Add minimal glow effect
  if (!this.engine.isMobile) {
    const glowGeometry = new THREE.SphereGeometry(3, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    node.add(glowMesh);
  }
  
  return node;
}

// Asset cleanup and memory management
cleanupUnusedAssets() {
  // Called periodically to free memory
  
  // Check distance to each asset
  const player = this.engine.systems.player?.localPlayer;
  if (!player) return;
  
  const maxDistance = this.engine.isMobile ? 1000 : 2000;
  const cleanupDistance = this.engine.isMobile ? 500 : 1000;
  
  // Track memory usage
  if (window.performance && window.performance.memory) {
    const memoryInfo = window.performance.memory;
    console.log(`Memory usage: ${Math.round(memoryInfo.usedJSHeapSize / 1048576)} MB / ${Math.round(memoryInfo.jsHeapSizeLimit / 1048576)} MB`);
  }
  
  // Extra geometry and material cleanup
  THREE.Cache.clear(); // Clear internal Three.js cache
  
  // Force garbage collection if available (only in certain debug environments)
  if (window.gc) {
    window.gc();
  }
}

// In AssetManager.js - Dynamic asset loading based on device
async initialize() {
  // Determine device capabilities early
  this.isMobile = this.engine.isMobile;
  this.isLowEndDevice = this.detectLowEndDevice();
  
  if (this.isMobile) {
    console.log("Mobile device detected, loading optimized assets");
    await this.loadMobileAssets();
  } else {
    console.log("Desktop device detected, loading full assets");
    await this.loadDesktopAssets();
  }
  
  // Create materials after assets are loaded
  this.createMaterials();
}

detectLowEndDevice() {
  // Attempt to detect very low-end devices for extreme optimization
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  if (!isMobile) return false;
  
  // Check for low memory devices (theoretical)
  if (window.performance && window.performance.memory) {
    const memoryInfo = window.performance.memory;
    if (memoryInfo.jsHeapSizeLimit < 200 * 1024 * 1024) { // Less than 200MB
      return true;
    }
  }
  
  // Check for older mobile devices
  const isOlderDevice = /android 4|android 5|ios 9|ios 10/i.test(userAgent);
  
  return isOlderDevice;
}

#### 5.3 Shader Optimization

// In various material definitions
createMobileFriendlyMaterials() {
  // Create simplified mobile-friendly shaders
  const simpleVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `;
  
  const simpleFragmentShader = `
  uniform vec3 color;
  varying vec2 vUv;
  
  void main() {
    gl_FragColor = vec4(color, 1.0);
  }
  `;
  
  // Create a simple shader material
  this.simpleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0x3377aa) }
    },
    vertexShader: simpleVertexShader,
    fragmentShader: simpleFragmentShader
  });
  
  // Create optimized water shader for mobile
  const simpleWaterVertexShader = `
  uniform float time;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    
    // Simple wave animation
    vec3 pos = position;
    pos.y += sin(pos.x * 0.5 + time * 2.0) * 0.1;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
  `;
  
  const simpleWaterFragmentShader = `
  uniform vec3 waterColor;
  uniform float time;
  varying vec2 vUv;
  
  void main() {
    // Simple wave pattern
    float pattern = sin(vUv.x * 10.0 + time) * 0.1 + sin(vUv.y * 8.0 + time * 0.8) * 0.1;
    
    vec3 finalColor = waterColor + vec3(pattern * 0.1);
    gl_FragColor = vec4(finalColor, 0.8);
  }
  `;
  
  // Create a simple water shader material
  this.simpleWaterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      waterColor: { value: new THREE.Color(0x0066aa) },
      time: { value: 0.0 }
    },
    vertexShader: simpleWaterVertexShader,
    fragmentShader: simpleWaterFragmentShader,
    transparent: true
  });
}

// Update water material in render loop
updateWaterShader(delta) {
  if (this.simpleWaterMaterial) {
    this.simpleWaterMaterial.uniforms.time.value += delta;
  }
}

### 6. Multiplayer Optimizations

#### 6.1 Reduced Network Updates
```javascript
// In NetworkManager.js
constructor(engine) {
  // ... existing code ...
  
  // Update rate based on device capabilities
  this.updateRate = engine.isMobile ? 10 : 30; // Updates per second
  this.timeSinceLastUpdate = 0;
  
  // Store pending updates
  this.pendingUpdates = {};
}

sendPlayerUpdate(data) {
  // Store the latest data
  this.pendingUpdates = { ...this.pendingUpdates, ...data };
}

update(delta) {
  // Only send updates at specified rate
  this.timeSinceLastUpdate += delta;
  
  if (this.timeSinceLastUpdate >= 1 / this.updateRate) {
    // Send pending updates if there are any
    if (Object.keys(this.pendingUpdates).length > 0) {
      // Add local player ID
      if (this.localPlayerId) {
        this.pendingUpdates.id = this.localPlayerId;
        
        // In a real implementation, this would send to the server
        // this.socket.emit('player_update', this.pendingUpdates);
        
        // For simulation, update locally
        this.handlePlayerUpdate(this.pendingUpdates);
        
        // Clear pending updates
        this.pendingUpdates = {};
      }
    }
    
    this.timeSinceLastUpdate = 0;
  }
  
  // Simulate network updates for AI players at reduced rate on mobile
  const aiUpdateChance = this.engine.isMobile ? 0.02 : 0.05;
  if (Math.random() < aiUpdateChance) {
    // ... existing AI update code ...
  }
}
```

#### 6.2 Position Interpolation
```javascript
// In PlayerSystem.js - updateNetworkPlayer method
updateNetworkPlayer(data) {
  const player = this.players.get(data.id);
  if (player && !player.isLocal) {
    // Implement interpolation for smoother remote player movement
    if (!player.targetPosition) {
      player.targetPosition = new THREE.Vector3();
      player.previousPosition = new THREE.Vector3().copy(player.position);
      player.positionLerpFactor = 0.1;
      player.positionLerpStart = 0;
    }
    
    // Update target position with new data
    if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
      player.previousPosition.copy(player.position);
      player.targetPosition.set(data.x, data.y, data.z);
      player.positionLerpStart = 0;
    }
    
    // Rotation interpolation
    if (data.rotationY !== undefined) {
      if (!player.targetRotation) {
        player.targetRotation = new THREE.Euler();
        player.previousRotation = new THREE.Euler().copy(player.rotation);
        player.rotationLerpFactor = 0.1;
        player.rotationLerpStart = 0;
      }
      
      player.previousRotation.copy(player.rotation);
      player.targetRotation.set(player.rotation.x, data.rotationY, player.rotation.z);
      player.rotationLerpStart = 0;
    }
    
    // Update other properties
    if (data.mana !== undefined) player.mana = data.mana;
    if (data.health !== undefined) player.health = data.health;
  }
}

// In PlayerSystem.js - update method, add interpolation updates
updateNetworkPlayers(delta) {
  this.players.forEach(player => {
    if (!player.isLocal) {
      // Position interpolation
      if (player.targetPosition) {
        player.positionLerpStart += delta * 5; // Control speed of interpolation
        const t = Math.min(1, player.positionLerpStart);
        player.position.lerpVectors(player.previousPosition, player.targetPosition, t);
      }
      
      // Rotation interpolation
      if (player.targetRotation) {
        player.rotationLerpStart += delta * 5;
        const t = Math.min(1, player.rotationLerpStart);
        
        // Use slerp for Y rotation (only component that changes significantly)
        player.rotation.y = THREE.MathUtils.lerp(
          player.previousRotation.y,
          player.targetRotation.y,
          t
        );
      }
    }
  });
}
```

### 7. Comprehensive Mobile UI Improvements

#### 7.1 Simplified UI for Mobile
```javascript
// In UISystem.js
createMobileUI() {
  // Clear existing UI
  this.container.innerHTML = '';
  
  // Create a simplified UI with larger touch targets
  
  // Mana display - big and simple
  const manaContainer = document.createElement('div');
  manaContainer.style.position = 'absolute';
  manaContainer.style.top = '10px';
  manaContainer.style.right = '10px';
  manaContainer.style.width = '60px';
  manaContainer.style.height = '60px';
  manaContainer.style.background = 'rgba(0, 0, 30, 0.7)';
  manaContainer.style.borderRadius = '30px';
  manaContainer.style.display = 'flex';
  manaContainer.style.justifyContent = 'center';
  manaContainer.style.alignItems = 'center';
  manaContainer.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
  
  const manaText = document.createElement('div');
  manaText.textContent = '0';
  manaText.style.fontSize = '24px';
  manaText.style.fontWeight = 'bold';
  manaText.style.color = '#00ffff';
  
  manaContainer.appendChild(manaText);
  this.container.appendChild(manaContainer);
  this.elements.manaText = manaText;
  
  // Health bar - bigger and at bottom
  const healthContainer = document.createElement('div');
  healthContainer.style.position = 'absolute';
  healthContainer.style.bottom = '20px';
  healthContainer.style.left = '50%';
  healthContainer.style.transform = 'translateX(-50%)';
  healthContainer.style.width = '80%';
  healthContainer.style.height = '15px';
  healthContainer.style.background = 'rgba(0, 0, 30, 0.7)';
  healthContainer.style.borderRadius = '8px';
  
  const healthBar = document.createElement('div');
  healthBar.style.height = '100%';
  healthBar.style.width = '100%';
  healthBar.style.background = 'linear-gradient(90deg, #ff0066, #ff6699)';
  healthBar.style.borderRadius = '6px';
  
  healthContainer.appendChild(healthBar);
  this.container.appendChild(healthContainer);
  this.elements.healthBar = healthBar;
  
  // Minimap is simplified to a small dot indicator
  const minimapContainer = document.createElement('div');
  minimapContainer.style.position = 'absolute';
  minimapContainer.style.top = '10px';
  minimapContainer.style.left = '10px';
  minimapContainer.style.width = '60px';
  minimapContainer.style.height = '60px';
  minimapContainer.style.background = 'rgba(0, 0, 30, 0.7)';
  minimapContainer.style.borderRadius = '30px';
  minimapContainer.style.overflow = 'hidden';
  
  const minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = 60;
  minimapCanvas.height = 60;
  
  minimapContainer.appendChild(minimapCanvas);
  this.container.appendChild(minimapContainer);
  this.elements.minimapCanvas = minimapCanvas;
  this.elements.minimapContext = minimapCanvas.getContext('2d');
  
  // Mobile-specific spell buttons (bigger, fewer)
  this.createMobileSpellButtons();
}

// Simplified minimap rendering for mobile
updateMobileMinimap() {
  const ctx = this.elements.minimapContext;
  const canvas = this.elements.minimapCanvas;
  
  if (!ctx || !canvas) return;
  
  // Clear with simple background
  ctx.fillStyle = 'rgba(0, 10, 40, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw simple dots for players
  this.engine.systems.player.players.forEach(player => {
    const worldSize = this.engine.systems.world.worldSize;
    
    // Convert world position to minimap position
    const x = ((player.position.x + worldSize / 2) / worldSize) * canvas.width;
    const z = ((player.position.z + worldSize / 2) / worldSize) * canvas.height;
    
    // Draw player dot
    ctx.beginPath();
    if (player.isLocal) {
      ctx.fillStyle = 'white';
      ctx.arc(x, z, 3, 0, Math.PI * 2);
    } else {
      ctx.fillStyle = 'red';
      ctx.arc(x, z, 2, 0, Math.PI * 2);
    }
    ctx.fill();
  });
  
  // Draw mana nodes as tiny dots
  const manaNodes = this.engine.systems.world.manaNodes;
  ctx.fillStyle = 'cyan';
  
  manaNodes.forEach(node => {
    if (!node.userData.collected) {
      const worldSize = this.engine.systems.world.worldSize;
      const x = ((node.position.x + worldSize / 2) / worldSize) * canvas.width;
      const z = ((node.position.z + worldSize / 2) / worldSize) * canvas.height;
      
      ctx.beginPath();
      ctx.arc(x, z, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Create larger, touch-friendly spell buttons
createMobileSpellButtons() {
  const spellsContainer = document.createElement('div');
  spellsContainer.style.position = 'absolute';
  spellsContainer.style.bottom = '70px';
  spellsContainer.style.right = '10px';
  spellsContainer.style.display = 'flex';
  spellsContainer.style.flexDirection = 'column';
  spellsContainer.style.gap = '10px';
  spellsContainer.style.pointerEvents = 'auto';
  
  // Create spell slots - fewer, larger buttons for mobile
  const spells = [
    { name: 'Fireball', color: '#ff3300' },
    { name: 'Shield', color: '#ffcc00' }
  ];
  
  this.elements.spellSlots = [];
  
  spells.forEach((spell, index) => {
    const spellSlot = document.createElement('div');
    spellSlot.style.width = '70px';
    spellSlot.style.height = '70px';
    spellSlot.style.borderRadius = '35px';
    spellSlot.style.background = 'rgba(0, 0, 30, 0.7)';
    spellSlot.style.display = 'flex';
    spellSlot.style.justifyContent = 'center';
    spellSlot.style.alignItems = 'center';
    spellSlot.style.cursor = 'pointer';
    spellSlot.style.boxShadow = `0 0 10px ${spell.color}80`;
    
    const spellIndicator = document.createElement('div');
    spellIndicator.style.width = '50px';
    spellIndicator.style.height = '50px';
    spellIndicator.style.borderRadius = '25px';
    spellIndicator.style.background = spell.color;
    spellIndicator.style.boxShadow = `0 0 5px ${spell.color}`;
    
    spellSlot.appendChild(spellIndicator);
    spellsContainer.appendChild(spellSlot);
    
    // Add touch handler
    spellSlot.addEventListener('touchstart', () => {
      this.selectSpell(index);
    });
    
    this.elements.spellSlots.push({
      element: spellSlot,
      indicator: spellIndicator,
      data: spell
    });
  });
  
  this.container.appendChild(spellsContainer);
}
```

### 8. Performance Monitoring and Throttling

#### 8.1 Performance Tracking
```javascript
// In Engine.js - add detailed performance monitoring
initializePerformanceMonitoring() {
  this.performance = {
    fps: {
      current: 60,
      min: 60,
      max: 60,
      history: []
    },
    frameTime: {
      current: 0,
      min: 0,
      max: 0,
      history: []
    },
    memory: {
      current: 0, // MB
      peak: 0,    // MB
      history: []
    },
    systemTimings: {
      world: 0,
      player: 0,
      effects: 0,
      render: 0
    },
    startTime: performance.now(),
    lastCheck: performance.now(),
    checkInterval: 1000 // Check every second
  };
  
  // Create simple performance HUD if in dev mode
  if (import.meta.env.DEV) {
    this.createPerformanceHUD();
  }
}

// Update performance metrics each frame
updatePerformance() {
  const now = performance.now();
  const frameTime = this.delta * 1000; // Convert to ms
  const fps = 1000 / frameTime;
  
  // Update current values
  this.performance.frameTime.current = frameTime;
  this.performance.fps.current = fps;
  
  // Update min/max
  this.performance.frameTime.min = Math.min(this.performance.frameTime.min || 1000, frameTime);
  this.performance.frameTime.max = Math.max(this.performance.frameTime.max || 0, frameTime);
  this.performance.fps.min = Math.min(this.performance.fps.min || 1000, fps);
  this.performance.fps.max = Math.max(this.performance.fps.max || 0, fps);
  
  // Update histories (limited size)
  this.performance.frameTime.history.push(frameTime);
  this.performance.fps.history.push(fps);
  
  if (this.performance.frameTime.history.length > 60) {
    this.performance.frameTime.history.shift();
    this.performance.fps.history.shift();
  }
  
  // Check memory usage periodically
  if (now - this.performance.lastCheck > this.performance.checkInterval) {
    this.performance.lastCheck = now;
    
    // Get memory usage if available
    if (window.performance && window.performance.memory) {
      const memoryInfo = window.performance.memory;
      const usedMB = Math.round(memoryInfo.usedJSHeapSize / 1048576);
      this.performance.memory.current = usedMB;
      this.performance.memory.peak = Math.max(this.performance.memory.peak || 0, usedMB);
      this.performance.memory.history.push(usedMB);
      
      if (this.performance.memory.history.length > 60) {
        this.performance.memory.history.shift();
      }
    }
    
    // Update performance HUD if exists
    this.updatePerformanceHUD();
  }
}

// Time specific systems to identify bottlenecks
startSystemTiming(system) {
  this._systemTimingStart = performance.now();
  this._currentTimingSystem = system;
}

endSystemTiming() {
  if (this._systemTimingStart && this._currentTimingSystem) {
    const time = performance.now() - this._systemTimingStart;
    this.performance.systemTimings[this._currentTimingSystem] = time;
    
    this._systemTimingStart = null;
    this._currentTimingSystem = null;
  }
}

// Create simple performance display
createPerformanceHUD() {
  const hud = document.createElement('div');
  hud.style.position = 'absolute';
  hud.style.top = '10px';
  hud.style.left = '10px';
  hud.style.background = 'rgba(0, 0, 0, 0.7)';
  hud.style.color = 'white';
  hud.style.padding = '10px';
  hud.style.fontFamily = 'monospace';
  hud.style.fontSize = '12px';
  hud.style.zIndex = '1000';
  hud.style.pointerEvents = 'none';
  
  document.body.appendChild(hud);
  this.performanceHUD = hud;
}

// Update the performance HUD
updatePerformanceHUD() {
  if (!this.performanceHUD) return;
  
  this.performanceHUD.innerHTML = `
    FPS: ${this.performance.fps.current.toFixed(1)} (min: ${this.performance.fps.min.toFixed(1)}, max: ${this.performance.fps.max.toFixed(1)})<br>
    Frame: ${this.performance.frameTime.current.toFixed(1)}ms<br>
    Memory: ${this.performance.memory.current}MB (peak: ${this.performance.memory.peak}MB)<br>
    Timing:<br>
    - World: ${this.performance.systemTimings.world.toFixed(1)}ms<br>
    - Player: ${this.performance.systemTimings.player.toFixed(1)}ms<br>
    - Effects: ${this.performance.systemTimings.effects.toFixed(1)}ms<br>
    - Render: ${this.performance.systemTimings.render.toFixed(1)}ms<br>
    Mode: ${this.isMobile ? 'Mobile' : 'Desktop'}, DPR: ${this.devicePixelRatio.toFixed(1)}
  `;
}
```

#### 8.2 Automatic Performance Throttling
```javascript
// In Engine.js - Add automatic performance adaptation
initializePerformanceThrottling() {
  this.throttling = {
    enabled: true,
    targetFPS: 55,             // Target slightly below 60 to allow headroom
    checkInterval: 2,          // Seconds between throttling checks
    lastCheck: 0,
    
    // Throttling stages (in order of application)
    stages: [
      { 
        name: 'resolution', 
        applied: false, 
        apply: () => this.setResolutionScale(0.75),
        revert: () => this.setResolutionScale(1.0)
      },
      { 
        name: 'shadows', 
        applied: false, 
        apply: () => this.disableShadows(),
        revert: () => this.enableShadows()
      },
      { 
        name: 'effects', 
        applied: false, 
        apply: () => this.reduceEffects(),
        revert: () => this.restoreEffects()
      },
      { 
        name: 'terrain', 
        applied: false, 
        apply: () => this.reduceTerrainQuality(),
        revert: () => this.restoreTerrainQuality()
      },
      { 
        name: 'view_distance', 
        applied: false, 
        apply: () => this.reduceViewDistance(),
        revert: () => this.restoreViewDistance()
      }
    ]
  };
}

// Check performance and apply throttling if needed
updatePerformanceThrottling(delta) {
  if (!this.throttling.enabled) return;
  
  this.throttling.lastCheck += delta;
  
  // Only check periodically
  if (this.throttling.lastCheck < this.throttling.checkInterval) return;
  this.throttling.lastCheck = 0;
  
  // Calculate average FPS over recent history
  const fpsHistory = this.performance.fps.history;
  if (fpsHistory.length < 10) return; // Wait for enough data
  
  const recentFPS = fpsHistory.slice(-10);
  const avgFPS = recentFPS.reduce((sum, fps) => sum + fps, 0) / recentFPS.length;
  
  console.log(`Performance check: Avg FPS: ${avgFPS.toFixed(1)}, Target: ${this.throttling.targetFPS}`);
  
  // Apply throttling stages if FPS is too low
  if (avgFPS < this.throttling.targetFPS * 0.9) {
    // Find first unapplied stage and apply it
    for (const stage of this.throttling.stages) {
      if (!stage.applied) {
        console.log(`Performance throttling: Applying ${stage.name}`);
        stage.apply();
        stage.applied = true;
        return; // Only apply one stage at a time
      }
    }
  }
  
  // If FPS is consistently high, try to revert throttling stages
  if (avgFPS > this.throttling.targetFPS * 1.2) {
    // Find last applied stage and revert it
    for (let i = this.throttling.stages.length - 1; i >= 0; i--) {
      const stage = this.throttling.stages[i];
      if (stage.applied) {
        console.log(`Performance throttling: Reverting ${stage.name}`);
        stage.revert();
        stage.applied = false;
        return; // Only revert one stage at a time
      }
    }
  }
}

// Implementation of throttling stage methods
setResolutionScale(scale) {
  this.qualityManager.resolutionScale = scale;
  this.updateRendererResolution();
}

disableShadows() {
  this.renderer.shadowMap.enabled = false;
  this.scene.traverse(obj => {
    if (obj.isLight) {
      obj.castShadow = false;
    }
  });
}

enableShadows() {
  this.renderer.shadowMap.enabled = true;
  this.scene.traverse(obj => {
    if (obj.isLight && obj.userData.originalCastShadow) {
      obj.castShadow = true;
    }
  });
}

reduceEffects() {
  const carpetTrail = this.systems.carpetTrail;
  if (carpetTrail) {
    carpetTrail.maxParticles = 20;
    carpetTrail.emissionRate = 5;
    carpetTrail.maxMotionLines = 0;
    carpetTrail.maxSteamParticles = 0;
  }
}

restoreEffects() {
  const carpetTrail = this.systems.carpetTrail;
  if (carpetTrail) {
    carpetTrail.maxParticles = 50;
    carpetTrail.emissionRate = 25;
    carpetTrail.maxMotionLines = 4;
    carpetTrail.maxSteamParticles = 25;
  }
}

reduceTerrainQuality() {
  const world = this.systems.world;
  if (world) {
    world.terrainResolution = 32; // Lower resolution
    world.terrainLOD.distances = [
      { distance: 300, resolution: 32 },
      { distance: 600, resolution: 16 },
      { distance: 1000, resolution: 8 }
    ];
  }
}

restoreTerrainQuality() {
  const world = this.systems.world;
  if (world) {
    world.terrainResolution = this.isMobile ? 64 : 128;
    world.terrainLOD.distances = [
      { distance: 500, resolution: 64 },
      { distance: 1000, resolution: 32 },
      { distance: 1500, resolution: 16 },
      { distance: 2000, resolution: 8 }
    ];
  }
}

reduceViewDistance() {
  const world = this.systems.world;
  if (world) {
    world.viewDistance = Math.max(2, world.viewDistance - 1);
  }
}

restoreViewDistance() {
  const world = this.systems.world;
  if (world) {
    world.viewDistance = this.isMobile ? 4 : 6;
  }
}
```

### 9. Implementation Strategy and Prioritization

#### 9.1. Implementation Phases
To ensure the game runs at 60 FPS on mobile without breaking functionality, implement optimizations in these phases:

1. **Phase 1: Core Renderer Optimizations** (Highest Impact)
   - Implement adaptive resolution scaling (1.1)
   - Configure mobile-specific renderer settings (1.2)
   - Apply texture optimizations for mobile (5.1)
   - Implement frustum culling (1.3)

2. **Phase 2: Terrain and World Optimizations** (High Impact)
   - Implement terrain LOD system (2.1)
   - Create simplified terrain generation for mobile (2.2)
   - Implement terrain height caching (4.2)
   - Add chunk pooling (2.3)

3. **Phase 3: Visual Effects Optimization** (Medium-High Impact)
   - Optimize particle systems with instancing or pooling (3.1, 3.2)
   - Apply mobile-specific effect reductions (3.3)
   - Implement simplified shaders for mobile (5.3)

4. **Phase 4: Mobile UI and Input Improvements** (Medium Impact)
   - Create mobile-optimized UI (7.1)
   - Improve touch controls and feedback

5. **Phase 5: Multiplayer and Network Optimizations** (Low-Medium Impact)
   - Reduce network update frequency (6.1)
   - Implement position interpolation (6.2)

6. **Phase 6: Monitoring and Adaptive Performance** (Support)
   - Add performance monitoring (8.1)
   - Implement automatic throttling (8.2)

#### 9.2. Performance Testing Strategy

For each phase:

1. **Benchmark Baseline**
   - Measure FPS, frame time, and memory usage before changes
   - Identify specific bottlenecks using profiling tools

2. **Incremental Implementation**
   - Apply optimizations one at a time
   - Test after each change to measure impact
   - Revert or adjust if functionality breaks

3. **Device-Specific Testing**
   - Test on low-end, mid-range, and high-end mobile devices
   - Verify that auto-detection correctly identifies device capabilities
   - Ensure fallbacks work appropriately

4. **Stress Testing**
   - Test with multiple players
   - Test with many on-screen effects
   - Test with complex terrain areas

#### 9.3. Development Tools

1. **Chrome DevTools Performance Panel**
   - Identify JavaScript and rendering bottlenecks
   - Monitor memory usage and garbage collection

2. **Three.js Inspector**
   - Inspect scene graph complexity
   - Monitor draw calls and geometry complexity

3. **Custom Performance HUD**
   - Use the built-in performance monitoring (8.1)
   - Track system-specific metrics

4. **Remote Debugging**
   - Test on actual mobile devices using remote debugging
   - Capture performance traces for analysis

### 10. Conclusion

This implementation plan provides a comprehensive approach to optimize the Magical Carpet game for mobile devices while maintaining 60 FPS performance. The optimizations focus on:

1. **Adaptive Quality** - Automatically adjusting visual quality based on device capabilities
2. **Reduced Complexity** - Simplifying rendering, physics, and effects for mobile
3. **Resource Management** - Efficiently managing memory and assets
4. **Mobile-Specific UX** - Tailoring the user experience for touch screens and smaller displays

By implementing these optimizations in phases and continuously testing performance, you can achieve the target frame rate without sacrificing the core gameplay experience. The most impactful changes (renderer configuration, LOD systems, and effect simplification) should be prioritized to deliver the greatest performance improvements with the least development effort.

