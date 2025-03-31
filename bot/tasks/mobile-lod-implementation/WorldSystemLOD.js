// WorldSystem extension with LOD for terrain chunks
// This file contains only the methods that need to be modified for LOD support

/**
 * Create terrain geometry with adaptive LOD based on distance from player
 * @param {number} startX - X coordinate of chunk
 * @param {number} startZ - Z coordinate of chunk
 * @returns {THREE.BufferGeometry} - The terrain geometry
 */
export function createChunkGeometry(startX, startZ) {
  // Get the appropriate resolution based on distance from player and device capabilities
  let resolution = this.terrainResolution;
  
  // Apply LOD if MobileLODManager is available and we have a player position
  if (this.engine.systems.mobileLOD && this.engine.systems.player?.localPlayer) {
    const player = this.engine.systems.player.localPlayer;
    const chunkCenterX = startX + this.chunkSize / 2;
    const chunkCenterZ = startZ + this.chunkSize / 2;
    
    // Create a Vector3 for the chunk center
    const chunkCenter = new THREE.Vector3(chunkCenterX, 0, chunkCenterZ);
    
    // Calculate distance from player to chunk center
    const distanceFromPlayer = chunkCenter.distanceTo(player.position);
    
    // Get resolution from MobileLODManager
    resolution = this.engine.systems.mobileLOD.getTerrainResolution(distanceFromPlayer);
    
    // Ensure we don't use different resolutions along chunk boundaries that are at similar distances
    // by snapping to discrete values
    resolution = Math.max(8, Math.floor(resolution / 8) * 8);
  }
  
  // Create plane geometry with resolution based on LOD
  const geometry = new THREE.PlaneGeometry(
    this.chunkSize,
    this.chunkSize,
    resolution,
    resolution
  );

  // Rotate the plane to be horizontal (X-Z plane)
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array;
  const colors = [];
  
  // Extra sampling points used for calculating smooth transitions between chunks
  const smoothingRadius = 3; // Smoothing radius for edges
  
  // Identify the chunk grid position
  const chunkX = Math.floor(startX / this.chunkSize);
  const chunkZ = Math.floor(startZ / this.chunkSize);

  // Modify vertices to create terrain shape with special edge handling
  for (let i = 0; i < vertices.length; i += 3) {
    // Get world coordinates
    const x = vertices[i] + startX;
    const z = vertices[i + 2] + startZ;
    
    // Identify position within chunk (0-1 range)
    const relX = (x - startX) / this.chunkSize;
    const relZ = (z - startZ) / this.chunkSize;
    
    // Detect if we're near an edge for special handling
    const isNearEdgeX = relX < 0.02 || relX > 0.98;
    const isNearEdgeZ = relZ < 0.02 || relZ > 0.98;
    
    // Calculate height with standard method
    const height = this.getTerrainHeight(x, z);
    
    // Apply height to vertex Y coordinate
    vertices[i + 1] = height;
    
    // Assign color based on biome/height
    // Always use the same world coordinate space for consistent color calculations
    const color = this.getBiomeColor(height, x, z);
    colors.push(color.r, color.g, color.