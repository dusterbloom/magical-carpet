import * as THREE from 'three';

export class PlayerPhysics {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;
    
    // Physics constants
    this.gravity = 9.8;
    this.minAltitude = 5;
    this.maxAltitude = 200;
    this.dragCoefficient = 0.2;
    this.altitudeDamping = 0.85;
  }
  
  updatePhysics(delta) {
    const player = this.playerSystem.localPlayer;
    if (!player) return;
    
    // Apply forces to acceleration
    this.applyForces(player, delta);
    
    // Update velocity based on acceleration
    player.velocity.add(player.acceleration.clone().multiplyScalar(delta));
    
    // Apply drag (air resistance)
    player.velocity.multiplyScalar(1 - this.dragCoefficient * delta);
    
    // Apply velocity to position
    player.position.add(player.velocity.clone().multiplyScalar(delta));
    
    // Apply altitude controls and constraints
    this.updateAltitude(player, delta);
    
    // Reset acceleration for next frame
    player.acceleration.set(0, 0, 0);
  }
  
  applyForces(player, delta) {
    // Apply gravity
    player.acceleration.y -= this.gravity * delta;
    
    // Apply banking forces (if player is tilting/turning)
    const bankForce = 0.1;
    if (Math.abs(player.bankAngle) > 0.01) {
      // Gradually reduce bank angle
      player.bankAngle *= 0.95;
      
      // Apply sideways force proportional to bank angle
      const sidewaysForce = player.bankAngle * bankForce;
      
      // Get right vector
      const rightVector = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
      
      // Apply force in the right direction
      player.acceleration.addScaledVector(rightVector, sidewaysForce);
    }
    
    // Apply terrain avoidance - push up if too close to ground
    const terrainHeight = this.engine.systems.world.getTerrainHeight(
      player.position.x,
      player.position.z
    );
    
    const heightAboveTerrain = player.position.y - terrainHeight;
    const minSafeHeight = 5;
    
    if (heightAboveTerrain < minSafeHeight) {
      // Strong upward force when close to terrain
      const avoidanceForce = (minSafeHeight - heightAboveTerrain) * 5;
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
    const forwardVector = new THREE.Vector3(0, 0, 1).applyEuler(player.rotation);
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
