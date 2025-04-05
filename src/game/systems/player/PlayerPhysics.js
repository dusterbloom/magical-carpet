import * as THREE from "three";

export class PlayerPhysics {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;

    // Physics constants (unchanged)
    this.gravity = 5.8;
    this.minAltitude = 5;
    this.maxAltitude = 450;
    this.dragCoefficient = 0.15;
    this.altitudeDamping = 0.92;
    this.bankingSensitivity = 0.08;
    this.turnDamping = 0.97;
    
    // Add reusable vector objects to eliminate allocations
    this._tempVec1 = new THREE.Vector3();
    this._tempVec2 = new THREE.Vector3();
    this._tempVec3 = new THREE.Vector3();
    
    // Performance optimization flags
    this._skipThreshold = 0.0005; // Skip physics updates below this delta
    this._lastSignificantUpdate = 0; // Time tracking for forced updates
    this._forceUpdateInterval = 0.1; // Force update every 100ms regardless of delta
  }

  updatePhysics(delta) {
    const player = this.playerSystem.localPlayer;
    if (!player) return;
    
    // Skip micro-updates to reduce CPU load
    // However, always force an update periodically to maintain consistency
    this._lastSignificantUpdate += delta;
    if (delta < this._skipThreshold && this._lastSignificantUpdate < this._forceUpdateInterval) {
      return;
    }
    this._lastSignificantUpdate = 0;

    // Preserve momentum during turns with reused vectors
    if (Math.abs(player.bankAngle) > 0.01) {
      const currentSpeed = player.velocity.length();
      if (currentSpeed > 0.01) {
        // Get forward direction using reused vector
        this._tempVec1.set(0, 0, 1).applyEuler(player.rotation);
        
        // Scale to match current speed
        this._tempVec1.multiplyScalar(currentSpeed);
        
        // Lerp velocity toward forward direction 
        player.velocity.lerp(this._tempVec1, 0.1);
      }
    }
    
    // Update velocity with acceleration (reuse vector for scaled acceleration)
    this._tempVec1.copy(player.acceleration).multiplyScalar(delta);
    player.velocity.add(this._tempVec1);
    
    // Apply progressive drag based on speed (without creating new objects)
    const currentSpeed = player.velocity.length();
    if (currentSpeed > 0.001) { // Only apply drag when actually moving
      const dragFactor = 1 - (this.dragCoefficient * (currentSpeed / player.maxSpeed)) * delta;
      player.velocity.multiplyScalar(dragFactor);
    }
    
    // Update position (reuse vector for position delta)
    this._tempVec1.copy(player.velocity).multiplyScalar(delta);
    player.position.add(this._tempVec1);
    
    // Enhanced altitude control (no changes to logic, just optimized calculation)
    this.updateAltitude(player, delta);
    
    // Reset acceleration (without allocating new vector)
    player.acceleration.set(0, 0, 0);
  }

  // Optimized version of altitude control
  updateAltitude(player, delta) {
    // Apply altitude changes from user input
    if (Math.abs(player.altitudeVelocity) > 0.001) {
      player.position.y += player.altitudeVelocity * delta;
      
      // Apply damping to altitude velocity
      player.altitudeVelocity *= this.altitudeDamping;
      
      // Zero out extremely small values to prevent endless damping calculations
      if (Math.abs(player.altitudeVelocity) < 0.001) {
        player.altitudeVelocity = 0;
      }
    }

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

  // Optimized helper methods for adding forces
  applyForwardForce(player, force) {
    // Calculate forward direction based on player's rotation using the reused vector
    this._tempVec1.set(0, 0, 1).applyEuler(player.rotation);
    
    // Add scaled forward vector to acceleration
    player.acceleration.addScaledVector(this._tempVec1, force);
  }

  applySideForce(player, force) {
    // Calculate right direction based on player's rotation using reused vector
    this._tempVec1.set(1, 0, 0).applyEuler(player.rotation);
    
    // Add scaled right vector to acceleration
    player.acceleration.addScaledVector(this._tempVec1, force);

    // Apply banking effect for turns (unchanged logic)
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