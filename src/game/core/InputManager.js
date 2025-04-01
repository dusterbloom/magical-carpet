export class InputManager {
  constructor() {
    this.keys = {};
    this.touches = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: 0 };
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.listeners = {};
    this.pointerLocked = false;
    
    // Device orientation properties for motion controls
    this.deviceOrientation = { alpha: 0, beta: 0, gamma: 0 };
    this.deviceMotionEnabled = false;
    this.deviceMotionAvailable = typeof DeviceOrientationEvent !== 'undefined';
    this.initialOrientation = null;
    
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
  }
  
  initialize() {
    // Start the sensor fusion update loop
    this.updateInterval = setInterval(() => {
      this.updateFusedOrientation();
    }, 16); // ~60fps update
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    
    // Mouse events
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    
    // Pointer lock for camera control
    document.addEventListener('click', this.requestPointerLock.bind(this));
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));
    
    // Touch events for mobile
    if (this.isTouchDevice) {
      console.log('Touch device detected, setting up touch event handlers');
      window.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
      window.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
      window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
      window.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: false });
      
      // Add device orientation event listener for motion controls
      if (this.deviceMotionAvailable) {
        console.log('Device orientation available, setting up orientation event handler');
        window.addEventListener('deviceorientation', this.onDeviceOrientation.bind(this));
        
        // Add device motion event listener
        if (typeof DeviceMotionEvent !== 'undefined') {
          console.log('Device motion available, setting up motion event handler');
          window.addEventListener('devicemotion', this.onDeviceMotion.bind(this));
        }
      }
    }
    
    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  // Input event handlers
  onKeyDown(event) {
    this.keys[event.code] = true;
    this.emit('keydown', event);
  }
  
  onKeyUp(event) {
    this.keys[event.code] = false;
    this.emit('keyup', event);
  }
  
  onMouseDown(event) {
    this.mouse.buttons = event.buttons;
    this.emit('mousedown', event);
  }
  
  onMouseUp(event) {
    this.mouse.buttons = event.buttons;
    this.emit('mouseup', event);
  }
  
  onMouseMove(event) {
    if (this.pointerLocked) {
      // Use movementX/Y for more accurate mouse control when pointer is locked
      this.mouse.dx = event.movementX || 0;
      this.mouse.dy = event.movementY || 0;
    } else {
      const prevX = this.mouse.x;
      const prevY = this.mouse.y;
      
      this.mouse.x = event.clientX;
      this.mouse.y = event.clientY;
      this.mouse.dx = this.mouse.x - prevX;
      this.mouse.dy = this.mouse.y - prevY;
    }
    
    this.emit('mousemove', event);
  }
  
  onTouchStart(event) {
    // Prevent default behaviors like scrolling
    event.preventDefault();
    
    console.log('Touch start detected', event.touches.length, 'touches');
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches[touch.identifier] = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY
      };
    }
    
    this.emit('touchstart', event);
  }
  
  onTouchEnd(event) {
    event.preventDefault();
    
    console.log('Touch end detected', event.changedTouches.length, 'touches');
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      delete this.touches[touch.identifier];
    }
    
    this.emit('touchend', event);
  }
  
  onTouchMove(event) {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (this.touches[touch.identifier]) {
        this.touches[touch.identifier].x = touch.clientX;
        this.touches[touch.identifier].y = touch.clientY;
      }
    }
    
    this.emit('touchmove', event);
  }
  
  onTouchCancel(event) {
    event.preventDefault();
    
    console.log('Touch cancel detected', event.changedTouches.length, 'touches');
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      delete this.touches[touch.identifier];
    }
    
    this.emit('touchcancel', event);
  }
  
  // Event system
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }
  
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
  
  emit(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        callback(data);
      }
    }
  }
  
  // Helper methods
  isKeyDown(keyCode) {
    return !!this.keys[keyCode];
  }
  
  getTouchCount() {
    return Object.keys(this.touches).length;
  }
  
  requestPointerLock() {
    if (!this.pointerLocked) {
      document.body.requestPointerLock();
    }
  }
  
  onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === document.body;
    this.emit('pointerlock', this.pointerLocked);
  }
  
  onPointerLockError() {
    console.error('Pointer lock error');
  }
  
  // Device orientation handling for motion controls
  onDeviceOrientation(event) {
    // Always update the values, even if not enabled
    this.deviceOrientation.alpha = event.alpha || 0; // Z-axis rotation
    this.deviceOrientation.beta = event.beta || 0;   // X-axis rotation
    this.deviceOrientation.gamma = event.gamma || 0; // Y-axis rotation
    
    // Log the first few orientation events to help with debugging
    if (!this._orientationLogged) {
      console.log('Device orientation event:', {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      });
      this._orientationLogged = true;
      
      // Enable device motion by default on mobile
      if (this.isTouchDevice && !this.deviceMotionEnabled) {
        console.log('Auto-enabling device motion for mobile');
        this.setDeviceMotionEnabled(true);
      }
    }
    
    if (!this.initialOrientation && this.deviceMotionEnabled) {
      // Set initial orientation for calibration
      this.initialOrientation = {
        alpha: event.alpha || 0,
        beta: event.beta || 0, 
        gamma: event.gamma || 0
      };
      console.log('Device orientation calibrated:', this.initialOrientation);
    }
    
    this.emit('deviceorientation', event);
  }
  
  // Method to calibrate device orientation
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
  
  // Helper to keep angle in range 0-360
  normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
  }
  
  // Helper to clamp angle between min and max
  clampAngle(angle, min, max) {
    return Math.max(min, Math.min(max, angle));
  }
  
  // Device motion event handler
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
  
  // Update fused orientation using sensor fusion
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
  
  // Method to enable/disable device motion controls
  setDeviceMotionEnabled(enabled) {
    console.log('Setting device motion enabled:', enabled);
    
    // Request permission for device orientation on iOS
    if (enabled && typeof DeviceOrientationEvent.requestPermission === 'function') {
      console.log('Requesting iOS device orientation permission');
      DeviceOrientationEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            console.log('iOS device orientation permission granted');
            this.deviceMotionEnabled = enabled;
            this.calibrateDeviceOrientation();
          } else {
            console.warn('Device orientation permission denied');
          }
        })
        .catch(err => {
          console.error('Error requesting device orientation permission:', err);
          // Fall back to standard orientation API
          this.deviceMotionEnabled = enabled;
          if (enabled) {
            this.calibrateDeviceOrientation();
          }
        });
    } else {
      // For non-iOS devices or when disabling
      this.deviceMotionEnabled = enabled;
      if (enabled) {
        this.calibrateDeviceOrientation();
      }
    }
    
    // Return the current state
    return this.deviceMotionEnabled;
  }
}
