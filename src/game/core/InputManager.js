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

    // Add these properties to the constructor
    this.touchScale = 1; // Remove DPI scaling which causes issues on some devices
    this.lastTapTime = 0;
    this.doubleTapThreshold = 300;


    this.boundOnDeviceOrientation = this.onDeviceOrientation.bind(this);
    this.boundOnDeviceMotion = this.onDeviceMotion.bind(this);
    this.prevRotationRate = { alpha: 0, beta: 0, gamma: 0 };

    this.pointerLocked = false;
    this.pointerLockRequested = false;
    this.isAndroid = /android/i.test(navigator.userAgent);
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  initialize() {


    // Only set up pointer lock on non-touch devices or when specifically requested
    if (!this.isTouchDevice) {
      // document.addEventListener('click', this.requestPointerLock.bind(this));
      document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
      document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));
    }

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
        console.debug('Device Motion:', {
          interval: event.interval,
          acceleration: event.acceleration,
          rotationRate: event.rotationRate
        });
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
    // Handle mouse movement differently based on pointer lock state
    if (this.pointerLocked) {
      // Use movementX/Y for accurate mouse control when pointer is locked
      this.mouse.dx = event.movementX ||
        event.mozMovementX ||
        event.webkitMovementX ||
        0;
      this.mouse.dy = event.movementY ||
        event.mozMovementY ||
        event.webkitMovementY ||
        0;
    } else {
      // Fall back to calculating movement from position when not locked
      const prevX = this.mouse.x;
      const prevY = this.mouse.y;

      this.mouse.x = event.clientX;
      this.mouse.y = event.clientY;

      // Only calculate delta if we have previous values
      if (typeof prevX === 'number' && typeof prevY === 'number') {
        this.mouse.dx = this.mouse.x - prevX;
        this.mouse.dy = this.mouse.y - prevY;
      } else {
        this.mouse.dx = 0;
        this.mouse.dy = 0;
      }
    }

    // Scale mouse movement for consistency
    const movementScale = this.pointerLocked ? 1.0 : 0.5;
    this.mouse.dx *= movementScale;
    this.mouse.dy *= movementScale;

    this.emit('mousemove', {
      originalEvent: event,
      dx: this.mouse.dx,
      dy: this.mouse.dy,
      x: this.mouse.x,
      y: this.mouse.y
    });
  }

  // Add method to check if pointer lock is available
  isPointerLockAvailable() {
    return !this.isTouchDevice &&
      'pointerLockElement' in document &&
      'requestPointerLock' in document.body;
  }

  // Add method to explicitly release pointer lock
  releasePointerLock() {
    if (this.pointerLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  onTouchStart(event) {
    // Check if the event target is an input or textarea element
    if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
      return; // Do not prevent default behavior for input fields
    }
    event.preventDefault();

    console.log('Touch start detected', event.touches.length, 'touches');

    const touchData = {
      originalEvent: event,  // Pass the original event
      touches: []
    };

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchInfo = {
        identifier: touch.identifier,
        x: touch.clientX * this.touchScale,
        y: touch.clientY * this.touchScale,
        startX: touch.clientX * this.touchScale,
        startY: touch.clientX * this.touchScale,
        timestamp: performance.now()
      };
      this.touches[touch.identifier] = touchInfo;
      touchData.touches.push(touchInfo);
    }

    this.emit('touchstart', touchData);
  }

  onTouchEnd(event) {
    // Check if the event target is an input or textarea element
    if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
      return; // Do not prevent default behavior for input fields
    }
    event.preventDefault();

    const touchData = {
      originalEvent: event,
      touches: []
    };

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (this.touches[touch.identifier]) {
        touchData.touches.push({
          identifier: touch.identifier,
          x: touch.clientX * this.touchScale,
          y: touch.clientY * this.touchScale
        });
        delete this.touches[touch.identifier];
      }
    }

    this.emit('touchend', touchData);
  }

  onTouchMove(event) {
    // Check if the event target is an input or textarea element
    if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
      return; // Do not prevent default behavior for input fields
    }
    event.preventDefault();

    const touchData = {
      originalEvent: event,
      touches: []
    };

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (this.touches[touch.identifier]) {
        const touchInfo = {
          identifier: touch.identifier,
          x: touch.clientX * this.touchScale,
          y: touch.clientY * this.touchScale
        };
        Object.assign(this.touches[touch.identifier], touchInfo);
        touchData.touches.push(touchInfo);
      }
    }

    this.emit('touchmove', touchData);
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
    // Don't request pointer lock on touch devices
    if (this.isTouchDevice) return;

    // Don't request if already locked or requesting
    if (this.pointerLocked || this.pointerLockRequested) return;

    try {
      // Only request pointer lock if we're in a user gesture
      if (document.body.requestPointerLock) {
        this.pointerLockRequested = true;
        document.body.requestPointerLock();
      }
    } catch (error) {
      console.warn('Pointer lock request failed:', error);
      this.pointerLockRequested = false;
    }
  }

  onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === document.body;
    this.pointerLockRequested = false;

    if (this.pointerLocked) {
      console.log('Pointer lock acquired');
    } else {
      console.log('Pointer lock released');
    }

    this.emit('pointerlock', this.pointerLocked);
  }

  onPointerLockError(error) {
    console.warn('Pointer lock error:', error);
    this.pointerLocked = false;
    this.pointerLockRequested = false;

    // Emit error event so other systems can respond
    this.emit('pointerlockerror', error);
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
    if (!this.deviceMotionEnabled || !this.deviceMotion.rotationRate) return;

    // Add low-pass filter to rotation rates
    const smoothFactor = 0.2;
    const gyroAlpha = this.lerp(
      this.prevRotationRate.alpha,
      this.deviceMotion.rotationRate.alpha * (Math.PI / 180),
      smoothFactor
    );

    const now = performance.now();
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = now;
      return;
    }

    // Calculate time difference if not provided
    const dt = delta || (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    // Get rotation rates (in deg/s, convert to rad/s)
    // const gyroAlpha = this.deviceMotion.rotationRate.alpha * (Math.PI / 180);
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

  lerp(a, b, t) {
    return a * (1 - t) + b * t;
  }

  // Modified permission handling for iOS
  async setDeviceMotionEnabled(enabled) {
    if (enabled && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          console.warn('Device orientation permission denied');
          return false;
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
        return false;
      }
    }

    // Enable/disable event listeners
    if (enabled) {
      window.addEventListener('deviceorientation', this.boundOnDeviceOrientation);
      window.addEventListener('devicemotion', this.boundOnDeviceMotion);
      this.calibrateDeviceOrientation();
    } else {
      window.removeEventListener('deviceorientation', this.boundOnDeviceOrientation);
      window.removeEventListener('devicemotion', this.boundOnDeviceMotion);
    }

    this.deviceMotionEnabled = enabled;
    return enabled;
  }
}
