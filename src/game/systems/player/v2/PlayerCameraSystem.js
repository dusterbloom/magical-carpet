import * as THREE from 'three';
import { System } from '../../../core/v2/System';

/**
 * Manages camera positioning and following for player entities
 */
export class PlayerCameraSystem extends System {
  constructor(engine) {
    super(engine, 'playerCamera');
    this.requireDependencies(['playerState']);
    
    // Camera settings
    this.desktopSettings = {
      cameraOffset: new THREE.Vector3(0, 10, -25), // Higher and further back
      lookAheadDistance: new THREE.Vector3(0, 5, 25) // Standard look ahead
    };
    
    this.mobileSettings = {
      cameraOffset: new THREE.Vector3(0, 12, -20), // Higher and closer
      lookAheadDistance: new THREE.Vector3(0, 3, 30) // Look further ahead
    };
    
    // Smoothing factors
    this.positionSmoothFactor = 0.1;
  }
  
  async _initialize() {
    console.log("PlayerCameraSystem initialized");
  }
  
  _update(delta) {
    this.updateCamera();
  }
  
  updateCamera() {
    const playerState = this.engine.systems.playerState;
    if (!playerState || !playerState.localPlayer) return;
    
    const player = playerState.localPlayer;
    
    // Check if we're on mobile
    const isMobile = this.engine.input.isTouchDevice;
    
    // Different camera settings for mobile vs desktop
    const settings = isMobile ? this.mobileSettings : this.desktopSettings;
    
    // Create quaternion from player's full rotation (pitch and yaw)
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(
      player.rotation.x,  // Include pitch
      player.rotation.y,  // Include yaw
      0,                  // No roll in camera
      'YXZ'               // Important: YXZ order for FPS-style controls
    ));
    
    // Apply rotation to offset and look target
    const rotatedOffset = settings.cameraOffset.clone().applyQuaternion(quaternion);
    const rotatedLookAhead = settings.lookAheadDistance.clone().applyQuaternion(quaternion);
    
    // Position camera relative to player with smoothing
    const targetCameraPos = player.position.clone().add(rotatedOffset);
    this.engine.camera.position.lerp(targetCameraPos, this.positionSmoothFactor);
    
    // Look at point ahead of player
    const lookTarget = player.position.clone().add(rotatedLookAhead);
    this.engine.camera.lookAt(lookTarget);
  }
  
  // Handle visibility changes (for managing camera state when tab is hidden)
  handleVisibilityChange(visible) {
    // Reset any camera state if needed when tab visibility changes
  }
}
