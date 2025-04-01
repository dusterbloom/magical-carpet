# Task 049: Improve Mobile Motion Controls

## 1. Task & Context
**Task:** Replace the current DeviceOrientationEvent-based motion controls with a more stable and responsive system using DeviceMotionEvent. Implement basic sensor fusion if feasible.
**Scope:** src/game/core/InputManager.js, src/game/systems/player/PlayerInput.js
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Implement sensor fusion using complementary filter combining gyroscope (rotationRate) and accelerometer (accelerationIncludingGravity) data for better orientation tracking.
**Complexity:** 2/3 (Sensor fusion algorithm is well-established)
**Uncertainty:** 1/3 (DeviceMotionEvent is well-supported across mobile devices)
**Unknowns:** How well the filter parameters need to be tuned for optimal experience
**Human Input Needed:** No (Standard sensor fusion implementation)

## 3. Implementation

### InputManager.js Changes:

1. Add new deviceMotion properties:
```javascript
// Device motion properties
this.deviceMotion = {
  acceleration: { x: 0, y: 0, z: 0 },
  accelerationIncludingGravity: { x: 0, y: 0, z: 0 },
  rotationRate: { alpha: 0, beta: 0, gamma: 0 },
  interval: 0
};

// Sensor fusion variables
this.fusedOrientation = { alpha: 0, beta: 0, gamma: 0 };
this.lastUpdateTime = 0;
this.filterCoefficient = 0.98; // Complementary filter coefficient
```

2. Add devicemotion event listener in initialize():
```javascript
// Add device motion event listener
if (typeof DeviceMotionEvent !== 'undefined') {
  console.log('Device motion available, setting up motion event handler');
  window.addEventListener('devicemotion', this.onDeviceMotion.bind(this));
}
```

3. Add onDeviceMotion handler method:
```javascript
onDeviceMotion(event) {
  // Store motion data
  if (event.accelerationIncludingGravity) {
    this.deviceMotion.accelerationIncludingGravity.x = event.accelerationIncludingGravity.x || 0;
    this.deviceMotion.accelerationIncludingGravity.y = event.accelerationIncludingGravity.y || 0;
    this.deviceMotion.accelerationIncludingGravity.z = event.accelerationIncludingGravity.z || 0;
  }
  
  if (event.rotationRate) {
    this.deviceMotion.rotationRate.alpha = event.rotationRate.alpha || 0;
    this.deviceMotion.rotationRate.beta = event.rotationRate.beta || 0;
    this.deviceMotion.rotationRate.gamma = event.rotationRate.gamma || 0;
  }
  
  this.deviceMotion.interval = event.interval || 16;
  
  // Log first motion event for debugging
  if (!this._motionLogged) {
    console.log('Device motion event:', {
      acceleration: event.acceleration,
      accelerationIncludingGravity: event.accelerationIncludingGravity,
      rotationRate: event.rotationRate,
      interval: event.interval
    });
    this._motionLogged = true;
  }
  
  this.emit('devicemotion', event);
}
```

4. Add updateFusedOrientation method:
```javascript
updateFusedOrientation(delta) {
  if (!this.deviceMotionEnabled) return;
  
  const now = performance.now();
  if (this.lastUpdateTime === 0) {
    this.lastUpdateTime = now;
    return;
  }
  
  // Calculate time difference if not provided
  const dt = delta || (now - this.lastUpdateTime) / 1000;
  this.lastUpdateTime = now;
  
  // Get rotation rates (in deg/s, convert to rad/s)
  const gyroAlpha = this.deviceMotion.rotationRate.alpha * (Math.PI / 180);
  const gyroBeta = this.deviceMotion.rotationRate.beta * (Math.PI / 180);
  const gyroGamma = this.deviceMotion.rotationRate.gamma * (Math.PI / 180);
  
  // Integrate gyroscope data
  this.fusedOrientation.alpha += gyroAlpha * dt;
  this.fusedOrientation.beta += gyroBeta * dt;
  this.fusedOrientation.gamma += gyroGamma * dt;
  
  // Calculate angles from accelerometer
  const accel = this.deviceMotion.accelerationIncludingGravity;
  
  // Only use accelerometer data when relatively stable (not during high acceleration)
  const accelMagnitude = Math.sqrt(
    accel.x * accel.x + accel.y * accel.y + accel.z * accel.z
  );
  
  // Check if magnitude is close to gravity (9.8 m/s^2)
  if (Math.abs(accelMagnitude - 9.8) < 1.0) {
    // Calculate pitch and roll from accelerometer
    const accelBeta = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z));
    const accelGamma = Math.atan2(accel.y, accel.z);
    
    // Apply complementary filter (rad to deg for output)
    this.fusedOrientation.beta = this.filterCoefficient * this.fusedOrientation.beta + 
                                (1 - this.filterCoefficient) * accelBeta * (180 / Math.PI);
    this.fusedOrientation.gamma = this.filterCoefficient * this.fusedOrientation.gamma + 
                                 (1 - this.filterCoefficient) * accelGamma * (180 / Math.PI);
  }
  
  // Keep angles within range
  this.fusedOrientation.alpha = this.normalizeAngle(this.fusedOrientation.alpha);
  this.fusedOrientation.beta = this.clampAngle(this.fusedOrientation.beta, -90, 90);
  this.fusedOrientation.gamma = this.clampAngle(this.fusedOrientation.gamma, -90, 90);
  
  // Apply calibration
  if (this.initialOrientation) {
    this.fusedOrientation.beta -= this.initialOrientation.beta;
    this.fusedOrientation.gamma -= this.initialOrientation.gamma;
  }
  
  // Emit updated orientation
  this.emit('fusedorientation', this.fusedOrientation);
}
```

5. Add helper methods:
```javascript
// Helper to keep angle in range 0-360
normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

// Helper to clamp angle between min and max
clampAngle(angle, min, max) {
  return Math.max(min, Math.min(max, angle));
}
```

6. Update calibration method:
```javascript
calibrateDeviceOrientation() {
  console.log('Calibrating device orientation');
  
  // Store current fused orientation as baseline
  this.initialOrientation = {
    alpha: this.fusedOrientation.alpha,
    beta: this.fusedOrientation.beta,
    gamma: this.fusedOrientation.gamma
  };
  
  console.log('Initial orientation set:', this.initialOrientation);
}
```

7. Call the update method in constructor or initialize:
```javascript
// Add to initialize method
this.updateInterval = setInterval(() => {
  this.updateFusedOrientation();
}, 16); // ~60fps update
```

### PlayerInput.js Changes:

1. Update motion control parameters:
```javascript
// Motion control properties
this.motionControlsEnabled = false;
this.motionSensitivity = {
  pitch: 0.04,  // Controls up/down movement (reduced from 0.05)
  yaw: 0.06     // Controls left/right turning (reduced from 0.08)
};

// Add response curve parameters
this.motionResponseCurve = {
  deadzone: 2.0,  // Ignore small movements (degrees)
  maxResponse: 15.0  // Maximum input angle for full response
};
```

2. Modify handleInput motion control section:
```javascript
// Handle device motion controls if enabled
if (this.motionControlsEnabled && input.deviceMotionEnabled && input.initialOrientation) {
  // Use fused orientation data instead of raw orientation
  const fusedOrientation = input.fusedOrientation;
  
  // Apply response curve to beta (pitch control)
  let betaResponse = 0;
  if (Math.abs(fusedOrientation.beta) > this.motionResponseCurve.deadzone) {
    // Calculate response with deadzone and normalization
    const normalizedBeta = Math.sign(fusedOrientation.beta) * 
      (Math.abs(fusedOrientation.beta) - this.motionResponseCurve.deadzone);
    
    // Apply non-linear response curve (quadratic) for more precision
    betaResponse = Math.sign(normalizedBeta) * 
      Math.min(1.0, Math.pow(Math.abs(normalizedBeta) / this.motionResponseCurve.maxResponse, 2));
    
    // Apply to altitude with smoother response
    physics.applyAltitudeChange(player, betaResponse * 40 * delta);
  }
  
  // Apply response curve to gamma (roll/turning control)
  let gammaResponse = 0;
  if (Math.abs(fusedOrientation.gamma) > this.motionResponseCurve.deadzone) {
    // Calculate response with deadzone and normalization
    const normalizedGamma = Math.sign(fusedOrientation.gamma) * 
      (Math.abs(fusedOrientation.gamma) - this.motionResponseCurve.deadzone);
    
    // Apply non-linear response curve for more precision with gentle turns
    gammaResponse = Math.sign(normalizedGamma) * 
      Math.min(1.0, Math.pow(Math.abs(normalizedGamma) / this.motionResponseCurve.maxResponse, 2));
    
    // Apply to yaw rotation with improved smoothing
    player.rotation.y -= gammaResponse * this.motionSensitivity.yaw * 2;
    
    // Apply banking effect with improved response
    const targetBankAngle = -gammaResponse * 0.5;
    player.bankAngle = THREE.MathUtils.lerp(
      player.bankAngle,
      targetBankAngle,
      0.15  // Increased from 0.1 for slightly faster response
    );
  }
  
  // IMPORTANT: Always apply forward force when using motion controls
  const motionForwardForce = player.maxSpeed * 0.5; // 50% of max speed
  physics.applyForwardForce(player, motionForwardForce * delta);
}
```

3. Add calibration button to mobile UI:
```javascript
// Create calibration button
const calibrateButton = document.createElement('div');
calibrateButton.style.position = 'fixed';
calibrateButton.style.top = '20px';
calibrateButton.style.left = '20px';
calibrateButton.style.width = '50px';
calibrateButton.style.height = '50px';
calibrateButton.style.borderRadius = '25px';
calibrateButton.style.background = 'rgba(255, 255, 255, 0.7)';
calibrateButton.style.display = 'flex';
calibrateButton.style.alignItems = 'center';
calibrateButton.style.justifyContent = 'center';
calibrateButton.style.fontSize = '24px';
calibrateButton.innerHTML = '📱'; // Phone emoji
calibrateButton.style.zIndex = '1000';
calibrateButton.style.display = 'none'; // Initially hidden
document.body.appendChild(calibrateButton);
this.mobileControlElements.push(calibrateButton);

// Handle calibration button click
calibrateButton.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (this.motionControlsEnabled) {
    this.engine.input.calibrateDeviceOrientation();
    
    // Visual feedback
    calibrateButton.style.background = 'rgba(0, 255, 0, 0.7)';
    setTimeout(() => {
      calibrateButton.style.background = 'rgba(255, 255, 255, 0.7)';
    }, 500);
  }
});
```

## 4. Check & Commit
**Changes Made:**
- Added DeviceMotionEvent listener and data capture in InputManager.js
- Implemented sensor fusion using complementary filter to combine gyroscope and accelerometer data
- Created updateFusedOrientation method that runs at 60fps to maintain smooth control
- Added response curves with deadzone for more precise and intuitive controls
- Created calibration mechanism with UI button for easy recalibration
- Optimized sensitivity parameters for better handling

**Commit Message:** feat(mobile): Replace device orientation controls with DeviceMotionEvent and sensor fusion

**Status:** Ready for Implementation
