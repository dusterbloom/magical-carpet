import * as THREE from 'three';

export class CarpetTrailSystem {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    
    // Contrail system
    this.leftContrailPoints = [];
    this.rightContrailPoints = [];
    this.maxContrailPoints = 150;
    this.leftContrailLine = null;
    this.rightContrailLine = null;
    this.contrailMaterial = null;
    this.emissionRate = 20; // points per second - increased for continuity
    this.minSpeedForEmission = 5; // Minimum speed to emit contrails - reduced threshold
    this.contrailLifespan = 8.0; // seconds - increased for longer trails
    this.contrailFadeStart = 4.0; // when contrails start to fade
    this.timeSinceLastEmission = 0;
    this.contrailWidth = 0.6; // width of the contrail - reduced from 1.5
    
    // Player input state
    this.spaceBarPressed = false;
    
    // Carpet dimensions for contrail positioning
    this.carpetWidth = 5;  // Based on the BoxGeometry in PlayerModels.js
    this.carpetLength = 8; // Based on the BoxGeometry in PlayerModels.js
  }
  
  /**
   * Set space bar state (for boost trail)
   */
  setSpaceBarState(pressed) {
    this.spaceBarPressed = pressed;
    // No clearing - trails will fade naturally
  }
  
  /**
   * Calculate lifespan based on speed
   * Faster speeds = longer-lasting trails
   */
  getSpeedAdjustedLifespan(speed) {
    const baseLifespan = 4.0; // base seconds
    const maxLifespan = 8.0;  // maximum seconds
    const speedFactor = Math.min(1.0, speed / 100); // normalize speed to 0-1 range
    
    return baseLifespan + (maxLifespan - baseLifespan) * speedFactor;
  }
  
  /**
   * Reset trail when tab regains focus or on error
   */
  resetTrail() {
    console.log('Resetting carpet contrail system');
    
    // Clear contrail points
    this.leftContrailPoints = [];
    this.rightContrailPoints = [];
    
    // Remove contrail lines if they exist
    if (this.leftContrailLine) {
      this.scene.remove(this.leftContrailLine);
      if (this.leftContrailLine.geometry) this.leftContrailLine.geometry.dispose();
      this.leftContrailLine = null;
    }
    
    if (this.rightContrailLine) {
      this.scene.remove(this.rightContrailLine);
      if (this.rightContrailLine.geometry) this.rightContrailLine.geometry.dispose();
      this.rightContrailLine = null;
    }
    
    // Reset timers
    this.timeSinceLastEmission = 0;
  }
  
  /**
   * Handle visibility change event
   */
  handleVisibilityChange(isVisible) {
    if (isVisible) {
      // Reset the trail when tab becomes visible again
      this.resetTrail();
    }
  }
  
  initialize() {
    console.log("Initializing CarpetTrailSystem");
    
    // Create contrail material
    this.contrailMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      linewidth: 10
    });
    
    // Ensure contrails start emitting immediately
    this.timeSinceLastEmission = 999; // Force immediate emission on first update
  }
  
  /**
   * Add a new point to the contrail system
   */
  addContrailPoints(playerPosition, playerRotation, playerVelocity, speed) {
    try {
      // Validate position and rotation
      if (!playerPosition || !playerRotation || isNaN(playerPosition.x)) {
        console.warn('Invalid position for contrail:', playerPosition);
        return;
      }
      
      // Create rotation matrix to orient the contrail points correctly
      const rotationMatrix = new THREE.Matrix4().makeRotationY(playerRotation.y);
      
      // Calculate contrail origin points (bottom left and right corners of carpet)
      const leftOrigin = new THREE.Vector3(
        -this.carpetWidth/2, 
        -0.25,  // Bottom of carpet
        -this.carpetLength/2
      );
      
      const rightOrigin = new THREE.Vector3(
        this.carpetWidth/2, 
        -0.25,  // Bottom of carpet
        -this.carpetLength/2
      );
      
      // Apply rotation
      leftOrigin.applyMatrix4(rotationMatrix);
      rightOrigin.applyMatrix4(rotationMatrix);
      
      // Add to player position
      const leftPoint = playerPosition.clone().add(leftOrigin);
      const rightPoint = playerPosition.clone().add(rightOrigin);
      
      // Store emission point with speed info
      const timestamp = performance.now() / 1000; // Convert to seconds
      const emissionData = {
        position: leftPoint,
        timestamp: timestamp,
        speed: speed // Store speed at emission time
      };
      
      // Add to contrail points
      this.leftContrailPoints.push(emissionData);
      
      // Right contrail with same data structure
      this.rightContrailPoints.push({
        position: rightPoint,
        timestamp: timestamp,
        speed: speed
      });
      
      // Keep contrails at max length
      while (this.leftContrailPoints.length > this.maxContrailPoints) {
        this.leftContrailPoints.shift();
      }
      
      while (this.rightContrailPoints.length > this.maxContrailPoints) {
        this.rightContrailPoints.shift();
      }
      
      // Update contrail visuals
      this.updateContrailLines(speed);
    } catch (error) {
      console.error('Error adding contrail points:', error);
    }
  }
  
  /**
   * Update the visual representation of the contrails
   */
  updateContrailLines(currentSpeed) {
    try {
      // Current time for age-based fading
      const currentTime = performance.now() / 1000;
      
      // Get lifespan based on speed
      const lifespan = this.getSpeedAdjustedLifespan(currentSpeed);
      const fadeStart = lifespan / 2; // fade starts halfway through lifespan
      
      // Filter out points that are too old and prepare positions/colors
      const leftPositions = [];
      const leftColors = [];
      const rightPositions = [];
      const rightColors = [];
      
      // Process left contrail
      for (const point of this.leftContrailPoints) {
        const age = currentTime - point.timestamp;
        const pointLifespan = this.getSpeedAdjustedLifespan(point.speed || 0);
        
        // Skip if too old - using dynamic lifespan
        if (age > pointLifespan) continue;
        
        // Add position
        leftPositions.push(point.position.x, point.position.y, point.position.z);
        
        // Calculate opacity based on age
        let opacity = 1.0;
        const pointFadeStart = pointLifespan / 2;
        if (age > pointFadeStart) {
          opacity = 1.0 - ((age - pointFadeStart) / (pointLifespan - pointFadeStart));
        }
        opacity = Math.max(0, Math.min(1, opacity)); // Clamp between 0 and 1
        
        // Add color with opacity
        leftColors.push(1, 1, 1, opacity);
      }
      
      // Process right contrail
      for (const point of this.rightContrailPoints) {
        const age = currentTime - point.timestamp;
        const pointLifespan = this.getSpeedAdjustedLifespan(point.speed || 0);
        
        // Skip if too old - using dynamic lifespan
        if (age > pointLifespan) continue;
        
        // Add position
        rightPositions.push(point.position.x, point.position.y, point.position.z);
        
        // Calculate opacity based on age
        let opacity = 1.0;
        const pointFadeStart = pointLifespan / 2;
        if (age > pointFadeStart) {
          opacity = 1.0 - ((age - pointFadeStart) / (pointLifespan - pointFadeStart));
        }
        opacity = Math.max(0, Math.min(1, opacity)); // Clamp between 0 and 1
        
        // Add color with opacity
        rightColors.push(1, 1, 1, opacity);
      }
      
      // Remove old lines
      if (this.leftContrailLine) {
        this.scene.remove(this.leftContrailLine);
        this.leftContrailLine.geometry.dispose();
      }
      
      if (this.rightContrailLine) {
        this.scene.remove(this.rightContrailLine);
        this.rightContrailLine.geometry.dispose();
      }
      
      // Create new lines if we have enough points
      if (leftPositions.length >= 6) { // At least 2 points
        // Create geometry for the line
        const leftGeometry = new THREE.BufferGeometry();
        leftGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leftPositions, 3));
        
        // Extract Vector3 points for curve creation
        const leftPoints = [];
        for (let i = 0; i < leftPositions.length; i += 3) {
          leftPoints.push(new THREE.Vector3(
            leftPositions[i],
            leftPositions[i + 1],
            leftPositions[i + 2]
          ));
        }
        
        // Create smooth curve
        const leftCurve = new THREE.CatmullRomCurve3(leftPoints);
        
        // Create tube geometry for the curve
        const tubeGeometry = new THREE.TubeGeometry(
          leftCurve,
          leftPoints.length * 2, // more segments for smoother curve
          this.contrailWidth, // radius
          8, // radiusSegments
          false // closed
        );
        
        // Create material with fading
        const leftMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        });
        
        // Create tube mesh
        this.leftContrailLine = new THREE.Mesh(tubeGeometry, leftMaterial);
        this.scene.add(this.leftContrailLine);
      }
      
      if (rightPositions.length >= 6) { // At least 2 points
        // Create geometry for the line  
        const rightGeometry = new THREE.BufferGeometry();
        rightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rightPositions, 3));
        
        // Extract Vector3 points for curve creation
        const rightPoints = [];
        for (let i = 0; i < rightPositions.length; i += 3) {
          rightPoints.push(new THREE.Vector3(
            rightPositions[i],
            rightPositions[i + 1],
            rightPositions[i + 2]
          ));
        }
        
        // Create smooth curve
        const rightCurve = new THREE.CatmullRomCurve3(rightPoints);
        
        // Create tube geometry for the curve
        const rightTubeGeometry = new THREE.TubeGeometry(
          rightCurve,
          rightPoints.length * 2, // more segments for smoother curve
          this.contrailWidth, // radius
          8, // radiusSegments
          false // closed
        );
        
        // Create material with fading
        const rightMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        });
        
        // Create tube mesh
        this.rightContrailLine = new THREE.Mesh(rightTubeGeometry, rightMaterial);
        this.scene.add(this.rightContrailLine);
      }
    } catch (error) {
      console.error('Error updating contrail lines:', error);
    }
  }
  
  update(delta) {
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    // Get player position, rotation, and velocity
    const position = player.position.clone();
    const rotation = player.rotation.clone();
    const velocity = player.velocity.clone();
    const speed = velocity.length();
    
    // Update emission timer
    this.timeSinceLastEmission += delta;
    
    // Only emit contrail points when space bar is pressed AND moving fast enough
    if (this.spaceBarPressed && speed > this.minSpeedForEmission) {
      // Ensure continuous emission with reasonable frequency
      // Minimum emission rate regardless of speed to prevent gaps
      const baseRate = this.emissionRate;
      const speedFactor = 0.5 + speed / 100;
      const emissionInterval = 1.0 / (baseRate * speedFactor);
      // Cap the interval to prevent too sparse emissions at low speeds
      const maxInterval = 1.0 / 10; // At least 10 points per second
      const finalInterval = Math.min(emissionInterval, maxInterval);
      
      if (this.timeSinceLastEmission > finalInterval) {
        this.addContrailPoints(position, rotation, velocity, speed);
        this.timeSinceLastEmission = 0;
      }
    }
    
    // Clean up expired contrail points
    this.cleanupExpiredPoints();
    
    // Always update the visual representation of the contrails
    // This ensures fading works even when not emitting new points
    this.updateContrailLines(speed);
  }
  
  cleanupExpiredPoints() {
    // Current time
    const currentTime = performance.now() / 1000;
    
    // Remove expired points from left contrail
    this.leftContrailPoints = this.leftContrailPoints.filter(point => {
      const pointLifespan = this.getSpeedAdjustedLifespan(point.speed || 0);
      return (currentTime - point.timestamp) <= pointLifespan;
    });
    
    // Remove expired points from right contrail
    this.rightContrailPoints = this.rightContrailPoints.filter(point => {
      const pointLifespan = this.getSpeedAdjustedLifespan(point.speed || 0);
      return (currentTime - point.timestamp) <= pointLifespan;
    });
  }
}