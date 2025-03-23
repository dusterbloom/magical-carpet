import * as THREE from "three";

export class PlayerPhysics {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;

    // Adjusted physics constants for better control
    this.gravity = 5.8; // Reduced from 9.8 for gentler falling
    this.minAltitude = 5;
    this.maxAltitude = 200;
    this.dragCoefficient = 0.15; // Reduced for smoother movement
    this.altitudeDamping = 0.92; // Increased for more gradual altitude changes
    this.bankingSensitivity = 0.08; // New constant for banking control
    this.turnDamping = 0.97; //
  }

  updatePhysics(delta) {
    const player = this.playerSystem.localPlayer;
    if (!player) return;
    
    // Apply forces before updating physics
    this.applyForces(player, delta);
    
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

    // Apply banking forces (if player is tilting/turning)
    const bankForce = 0.1;
    if (Math.abs(player.bankAngle) > 0.01) {
      // Gradually reduce bank angle
      player.bankAngle *= 0.95;

      // Apply sideways force proportional to bank angle
      const sidewaysForce = player.bankAngle * bankForce;

      // Get right vector
      const rightVector = new THREE.Vector3(1, 0, 0).applyEuler(
        player.rotation
      );

      // Apply force in the right direction
      player.acceleration.addScaledVector(rightVector, sidewaysForce);
    }

     // Enhanced banking forces
     if (Math.abs(player.bankAngle) > 0.01) {
      player.bankAngle *= this.turnDamping;
      const sidewaysForce = player.bankAngle * this.bankingSensitivity * player.velocity.length();
      const rightVector = new THREE.Vector3(1, 0, 0).applyEuler(player.rotation);
      player.acceleration.addScaledVector(rightVector, sidewaysForce);
    }

    // Progressive terrain avoidance - using cached terrain height
    const terrainHeight = this.engine.systems.physics.getTerrainHeight(
      player.position.x,
      player.position.z,
      this.engine.systems.world
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

    // Enforce minimum altitude (above terrain) - using cached terrain height
    const terrainHeight = this.engine.systems.physics.getTerrainHeight(
      player.position.x,
      player.position.z,
      this.engine.systems.world
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
