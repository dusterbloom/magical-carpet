import * as THREE from 'three';

/**
 * Manages directional markers to help players find each other
 */
export class PlayerMarkers {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;
    this.scene = playerSystem.scene;
    this.camera = this.engine.camera;
    
    this.markers = new Map();
    this.markerGeometry = null;
    this.markerMaterials = [];
    
    this.visibilityDistance = 300; // Show markers for players within this distance
    this.fadeStartDistance = 250;  // Start fading markers at this distance
    this.updateInterval = 0.2;     // Update marker visibility/position every 0.2 seconds
    this.lastUpdate = 0;
  }
  
  initialize() {
    // Create marker geometry - a simple arrow shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 2);
    shape.lineTo(1, 0);
    shape.lineTo(0.5, 0);
    shape.lineTo(0.5, -1);
    shape.lineTo(-0.5, -1);
    shape.lineTo(-0.5, 0);
    shape.lineTo(-1, 0);
    shape.lineTo(0, 2);
    
    this.markerGeometry = new THREE.ShapeGeometry(shape);
    
    // Create materials with different colors for player markers
    const colors = [
      0xff3333, // Red
      0x33ff33, // Green
      0x3333ff, // Blue
      0xffff33, // Yellow
      0xff33ff, // Magenta
      0x33ffff  // Cyan
    ];
    
    this.markerMaterials = colors.map(color => 
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false // Always render on top
      })
    );
    
    console.log("Player markers initialized");
  }
  
  /**
   * Create or update a marker for a player
   * @param {Object} player - The player to create a marker for
   */
  createOrUpdateMarker(player) {
    // Don't create markers for local player
    if (player.isLocal) return;
    
    // Check if marker already exists
    if (this.markers.has(player.id)) {
      this.updateMarkerPosition(player);
      return;
    }
    
    // Create new marker
    const materialIndex = this.getPlayerColorIndex(player.id);
    const material = this.markerMaterials[materialIndex];
    const marker = new THREE.Mesh(this.markerGeometry, material);
    
    // Set marker properties
    marker.renderOrder = 1000; // Ensure it renders on top
    marker.scale.set(2, 2, 2); // Scale to visible size
    
    // Add to scene and store reference
    this.scene.add(marker);
    this.markers.set(player.id, marker);
  }
  
  /**
   * Update a player marker's position
   * @param {Object} player - The player whose marker to update
   */
  updateMarkerPosition(player) {
    const marker = this.markers.get(player.id);
    if (!marker) return;
    
    const localPlayer = this.playerSystem.localPlayer;
    if (!localPlayer) return;
    
    // Calculate direction to player
    const direction = new THREE.Vector3()
      .subVectors(player.position, localPlayer.position)
      .normalize();
    
    // Calculate distance to player
    const distance = localPlayer.position.distanceTo(player.position);
    
    // Skip if player is too far away
    if (distance > this.visibilityDistance) {
      marker.visible = false;
      return;
    }
    
    // Make marker visible
    marker.visible = true;
    
    // Fade based on distance
    if (distance > this.fadeStartDistance) {
      const fade = 1 - ((distance - this.fadeStartDistance) / (this.visibilityDistance - this.fadeStartDistance));
      marker.material.opacity = Math.max(0.3, fade) * 0.8;
    } else {
      marker.material.opacity = 0.8;
    }
    
    // Position marker at edge of screen in direction of player
    
    // Convert direction to screen space
    const playerScreenPosition = this.getScreenEdgePosition(direction, 0.8);
    
    // Position marker in world space based on camera and screen position
    const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    
    // Create position relative to camera
    const markerPosition = new THREE.Vector3()
      .addScaledVector(cameraDirection, -5) // 5 units in front of camera
      .addScaledVector(cameraRight, playerScreenPosition.x * 3)
      .addScaledVector(cameraUp, playerScreenPosition.y * 2);
    
    // Set final position
    marker.position.copy(this.camera.position).add(markerPosition);
    
    // Make marker face camera
    marker.lookAt(this.camera.position);
    
    // Calculate angle to point in direction of player
    const angleToPlayer = Math.atan2(direction.x, direction.z);
    const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
    const relativeAngle = angleToPlayer - cameraAngle;
    
    // Rotate marker to point to player
    marker.rotation.z = relativeAngle;
  }
  
  /**
   * Calculate position on screen edge in direction of target
   * @param {THREE.Vector3} direction - Direction vector to target
   * @param {number} edgeDistance - Distance from center to edge (0-1)
   * @returns {THREE.Vector2} Screen position
   */
  getScreenEdgePosition(direction, edgeDistance) {
    // Project direction onto camera's local XY plane
    const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const cameraPlaneNormal = cameraDirection;
    
    // Project the direction vector onto the camera plane
    const projectedDir = new THREE.Vector3()
      .copy(direction)
      .projectOnPlane(cameraPlaneNormal)
      .normalize();
    
    // Calculate angle in camera's XY plane
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    
    const angleRight = projectedDir.angleTo(cameraRight) * (projectedDir.dot(cameraUp) < 0 ? -1 : 1);
    const angleUp = projectedDir.angleTo(cameraUp) * (projectedDir.dot(cameraRight) < 0 ? 1 : -1);
    
    // Convert angle to screen position
    const x = Math.sin(angleRight) * edgeDistance;
    const y = Math.sin(angleUp) * edgeDistance;
    
    return new THREE.Vector2(x, y);
  }
  
  /**
   * Remove a player's marker
   * @param {string} playerId - ID of player whose marker to remove
   */
  removeMarker(playerId) {
    const marker = this.markers.get(playerId);
    if (marker) {
      this.scene.remove(marker);
      this.markers.delete(playerId);
    }
  }
  
  /**
   * Get consistent color index for a player based on ID
   * @param {string} playerId - Player ID to hash
   * @returns {number} - Index into materials array
   */
  getPlayerColorIndex(playerId) {
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = ((hash << 5) - hash) + playerId.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % this.markerMaterials.length;
  }
  
  /**
   * Update all markers
   * @param {number} delta - Time since last update
   */
  update(delta) {
    this.lastUpdate += delta;
    
    // Update at fixed interval for performance
    if (this.lastUpdate < this.updateInterval) return;
    this.lastUpdate = 0;
    
    const localPlayer = this.playerSystem.localPlayer;
    if (!localPlayer) return;
    
    // Update markers for all other players
    this.playerSystem.players.forEach(player => {
      if (!player.isLocal) {
        this.createOrUpdateMarker(player);
      }
    });
    
    // Remove markers for players who have left
    this.markers.forEach((marker, playerId) => {
      if (!this.playerSystem.players.has(playerId)) {
        this.removeMarker(playerId);
      }
    });
  }
}
