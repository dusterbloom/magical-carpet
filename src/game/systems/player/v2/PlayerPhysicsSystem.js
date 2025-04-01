import * as THREE from 'three';
import { System } from '../../../core/v2/System';

/**
 * Manages physics and movement for player entities
 */
export class PlayerPhysicsSystem extends System {
  constructor(engine) {
    super(engine, 'playerPhysics');
    this.requireDependencies(['playerState']);
    
    // Adjusted physics constants for better control
    this.gravity = 5.8; // Reduced for gentler falling
    this.minAltitude = 5;
    this.maxAltitude = 450;
    this.dragCoefficient = 0.15; // Reduced for smoother movement
    this.altitudeDamping = 0.92; // Increased for more gradual altitude changes
    this.bankingSensitivity = 0.08; // For banking control
    this.turnDamping = 0.97;
  }
  
  async _initialize() {
    console.log("PlayerPhysicsSystem initialized");
  }
  
  _update(delta) {
    const playerState = this.engine.systems.playerState;
    
    if (!playerState || !playerState.localPlayer) return;
    
    const player = playerState.localPlayer;
    
    // Apply momentum preservation during turns
    this.preserveMomentum(player, delta);
    
    // Update velocity with smoother acceleration
    player.velocity.add(player.acceleration.clone().multiplyScalar(delta));
    
    // Apply progressive drag based on speed
    const currentSpeed = player.velocity.length();
    const dragFactor = 1 - (this.dragCoefficient * (currentSpeed / player.maxSpeed)) * delta;
    player.velocity.multiplyScalar(dragFactor);
    
    // Update position with delta smoothing
    player.position.add(player.velocity.clone().multiplyScalar(delta));
    
    // Enhanced altitude control
    this.updateAltitude(player, delta);
    
    // Reset acceleration
    player.acceleration.set(0, 0, 0);
  }
  
  preserveMomentum(player, delta) {
    // Preserve forward momentum during turns
    if (Math.abs(player.bankAngle) > 0.01) {
      const currentSpeed = player.velocity.length();
      const forwardDir = new THREE.Vector3(0, 0, 1).applyEuler(player.rotation);
      player.velocity.lerp(forwardDir.multiplyScalar(currentSpeed), 0.1);
    }
  }
  
  applyForces(player, delta) {
    // Apply gravity
    player.acceleration.y -= this.gravity * delta;
    
    // Enhanced banking forces
    if (Math.abs(player.bankAngle) > 0.01) {
      player.bankAngle *= this.turnDamping;
      const sidewaysForce = player.bankAngle * this.bankingSensitivity * player.velocity.length();
      const rightVector = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
      player.acceleration.addScaledVector(rightVector, sidewaysForce);
    }
    
    // Progressive terrain avoidance
    const terrainHeight = this.engine.systems.world.getTerrainHeight(
      player.position.x,
      player.position.z
    );
    
    const heightAboveTerrain = player.position.y - terrainHeight;
    const minSafeHeight = 5;
    
    if (heightAboveTerrain < minSafeHeight) {
      const avoidanceForce = (minSafeHeight - heightAboveTerrain) * 8 * (1 - heightAboveTerrain/minSafeHeight);
      player.acceleration.y += avoidanceForce;
    }
  }
  
  updateAltitude(player, delta) {
    // Apply altitude changes from user input
    player.position.y += player.altitudeVelocity * delta;
    
    // Apply damping to altitude velocity
    player.altitudeVelocity *= this.altitudeDamping;
    
    // Enforce minimum altitude (above terrain)
    const terrainHeight = this.engine.systems.world.getTerrainHeight(
      player.position.x,
      player.position.z
    );
    
    const minHeightAboveTerrain = Math.max(this.minAltitude, terrainHeight + 5);
    
    if (player.position.y < minHeightAboveTerrain) {
      player.position.y = minHeightAboveTerrain;
      
      // Stop downward velocity
      if (player.velocity.y < 0) {
        player.velocity.y = 0;
      }
    }
    
    // Enforce maximum altitude
    if (player.position.y > this.maxAltitude) {
      player.position.y = this.maxAltitude;
      
      // Stop upward velocity
      if (player.velocity.y > 0) {
        player.velocity.y = 0;
      }
    }
  }
  
  // Helper methods for adding forces
  applyForwardForce(player, force) {
    // Calculate forward direction based on player's rotation
    const forwardVector = new THREE.Vector3(0, 0, 1).applyEuler(
      player.rotation
    );
    player.acceleration.addScaledVector(forwardVector, force);
  }
  
  applySideForce(player, force) {
    // Calculate right direction based on player's rotation
    const rightVector = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
    player.acceleration.addScaledVector(rightVector, force);
    
    // Apply banking effect for turns
    const maxBankAngle = Math.PI / 6; // 30 degrees
    player.bankAngle = THREE.MathUtils.clamp(
      player.bankAngle + force * 0.01,
      -maxBankAngle,
      maxBankAngle
    );
  }
  
  applyAltitudeChange(player, force) {
    player.altitudeVelocity += force;
    
    // Limit maximum altitude velocity
    const maxAltitudeVelocity = 40;
    player.altitudeVelocity = THREE.MathUtils.clamp(
      player.altitudeVelocity,
      -maxAltitudeVelocity,
      maxAltitudeVelocity
    );
  }
}
