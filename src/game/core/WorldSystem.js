import * as THREE from 'three';

class WorldSystem {
  constructor(scene, chunkSize, minHeight, maxHeight) {
    this.scene = scene;
    this.chunkSize = chunkSize || 16;
    this.minHeight = minHeight || -50;
    this.maxHeight = maxHeight || 100;
    this.currentChunks = new Map();
    this.landmarks = new Map();
    
    // Initialize frustum culling objects
    this._frustum = new THREE.Frustum();
    this._frustumMatrix = new THREE.Matrix4();
    this._cameraViewProjectionMatrix = new THREE.Matrix4();
  }
  
  // Frustum culling optimization method
  updateVisibility(camera) {
    if (!camera) return;
    
    // Update frustum from camera
    camera.updateMatrixWorld();
    this._cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._cameraViewProjectionMatrix);
    
    // Process active chunks for visibility
    for (const [key, chunk] of this.currentChunks) {
      if (!chunk) continue;
      
      // Skip chunks that don't have a proper bounding box
      if (!chunk.userData || !chunk.userData.bounds) {
        // Create bounds if missing
        if (!chunk.userData) chunk.userData = {};
        
        const keyParts = key.split(',');
        const chunkX = parseInt(keyParts[0]);
        const chunkZ = parseInt(keyParts[1]);
        
        // Estimate chunk bounds based on terrain height range
        const minY = this.minHeight;
        const maxY = this.maxHeight;
        
        // Create bounding box
        chunk.userData.bounds = new THREE.Box3(
          new THREE.Vector3(chunkX, minY, chunkZ),
          new THREE.Vector3(chunkX + this.chunkSize, maxY, chunkZ + this.chunkSize)
        );
      }
      
      // Check if chunk bounds intersect with camera frustum
      const isVisible = this._frustum.intersectsBox(chunk.userData.bounds);
      
      // Apply visibility state (skip if unchanged)
      if (chunk.visible !== isVisible) {
        chunk.visible = isVisible;
      }
    }
    
    // Similarly apply culling to landmarks and other distant objects
    if (this.landmarks) {
      for (const [id, landmark] of this.landmarks) {
        if (landmark.mesh) {
          // Get or create bounds
          if (!landmark.bounds) {
            landmark.mesh.updateMatrixWorld();
            landmark.bounds = new THREE.Box3().setFromObject(landmark.mesh);
          }
          
          // Check visibility
          const isVisible = this._frustum.intersectsBox(landmark.bounds);
          landmark.mesh.visible = isVisible;
        }
      }
    }
  }
  
  // Rest of WorldSystem implementation would go here
  // ...
}

export { WorldSystem };