import * as THREE from 'three';

export class PlayerInput {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;
    
    // Reduce mouse sensitivity and add rotation damping
    this.mouseSensitivity = 0.0025;  // Increased sensitivity for mouse
    this.throttleSpeed = 1.0;
    this.bankingSensitivity = 0.3;   // Reduced from 0.5
    this.rotationDamping = 0.92;     // New: dampens rotation
    
    this.currentThrottle = 0;
    
    // Touch control values from revised mobile controls
    this.verticalControl = 0;       // For altitude control via buttons
    this.touchRotationSensitivity = 0.01; // Increased for better responsiveness
    this.isBatterySaving = false;   // Battery saving mode tracking
    this.speedMultiplier = 1.0;     // Normal speed
    this.boostMultiplier = 1.0;     // No boost by default
    this.boostActive = false;       // Boost state
    this.boostTimeout = null;       // For tracking boost duration
  }
  

  
  setupInput() {
    const input = this.engine.input;
    
    input.on('mousemove', (event) => {
      if (input.pointerLocked && this.playerSystem.localPlayer) {
        const player = this.playerSystem.localPlayer;
        
        // Apply smoothing to mouse input
        const smoothedDX = input.mouse.dx * this.mouseSensitivity;
        const smoothedDY = input.mouse.dy * this.mouseSensitivity;
        
        // Yaw (left/right rotation) with damping
        player.rotation.y -= smoothedDX;
        
        // Pitch (up/down rotation) with improved constraints
        const newPitch = player.rotation.x - smoothedDY;
        player.rotation.x = THREE.MathUtils.clamp(
          newPitch, 
          -Math.PI / 4,  // Reduced vertical range
          Math.PI / 4
        );
        
        // Smoother banking effect
        const targetBankAngle = -smoothedDX * 5; // Banking proportional to turn rate
        player.bankAngle = THREE.MathUtils.lerp(
          player.bankAngle,
          targetBankAngle,
          0.1 // Smooth transition
        );
      }
    });

    // Handle keyboard input
    input.on('keydown', (event) => {
      // Prevent default for game controls
      if (['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(event.code)) {
        event.preventDefault();
      }
    });
  }
  
  handleInput(delta) {
    const player = this.playerSystem.localPlayer;
    if (!player) return;
    
    const input = this.engine.input;
    const physics = this.playerSystem.physics;
    
    // Apply rotation damping
    player.bankAngle *= this.rotationDamping;
    
    // Get keys state for direct keyboard controls - Mobile overrides have priority
    const wPressed = input.isKeyDown('KeyW') || this.currentThrottle > 0.2;
    const sPressed = input.isKeyDown('KeyS') && !wPressed; // W has priority
    const aPressed = input.isKeyDown('KeyA');
    const dPressed = input.isKeyDown('KeyD');
    const spacePressed = input.isKeyDown('Space');
    const shiftPressed = input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight');
    
    // Flag to track if mobile controls were used
    let mobileControlsUsed = false;
    
    // Check if using mobile controls
    if (input.isTouchDevice && input.mobileControls) {
      // -- MOBILE INPUT HANDLING --
      const mobileControls = input.mobileControls;
      
      // Process camera movement from mobile UI
      if (mobileControls.camera && (mobileControls.camera.deltaX !== 0 || mobileControls.camera.deltaY !== 0)) {
        const deltaX = mobileControls.camera.deltaX || 0;
        const deltaY = mobileControls.camera.deltaY || 0;
        
        // Apply camera rotation based on touch movement
        if (deltaX !== 0) {
          player.rotation.y -= deltaX * this.touchRotationSensitivity;
        }
        
        if (deltaY !== 0) {
          // Apply with limits to prevent flipping over
          const newPitch = player.rotation.x - deltaY * this.touchRotationSensitivity;
          player.rotation.x = Math.max(-0.8, Math.min(0.8, newPitch));
        }
        
        // Apply banking based on horizontal rotation rate
        if (deltaX !== 0) {
          const targetBankAngle = deltaX * this.touchRotationSensitivity * 5;
          player.bankAngle = THREE.MathUtils.lerp(
            player.bankAngle,
            -targetBankAngle, // Negative for correct banking direction
            0.1 // Smooth transition
          );
        }
      }
      
      // Process movement from joystick
      if (mobileControls.joystick && mobileControls.joystick.active) {
        mobileControlsUsed = true;
        // Forward/backward movement
        const forwardInput = -mobileControls.joystick.deltaY; // Negative because up is negative
        const strafeInput = mobileControls.joystick.deltaX;
        
        if (forwardInput !== 0) {
          // Calculate speed based on input intensity
          const intensity = mobileControls.joystick.intensity || 1.0;
          const moveSpeed = player.maxSpeed * this.speedMultiplier * intensity * 1.5; // Increased speed multiplier
          
          // Apply forward movement in player's direction
          const forwardDirection = new THREE.Vector3(0, 0, -1).applyEuler(player.rotation);
          physics.applyForwardForce(player, moveSpeed * forwardInput * delta);
        }
        
        // Handle strafing (left/right movement)
        if (strafeInput !== 0) {
          // Apply side force for strafing
          physics.applySideForce(player, player.accelerationValue * strafeInput * delta * 0.3);
        }
      }
    }
    
    // Only use keyboard controls if mobile controls weren't used
    if (!mobileControlsUsed) {
      // --- KEYBOARD CONTROLS ---
      
      // Throttle control with smoother acceleration
      if (wPressed) {
        this.currentThrottle = Math.min(1.0, this.currentThrottle + this.throttleSpeed * delta);
      } else if (sPressed) {
        this.currentThrottle = Math.max(0.0, this.currentThrottle - this.throttleSpeed * delta);
      }
      
      // Calculate forward movement based on throttle with smoother acceleration
      const forwardForce = this.currentThrottle * player.maxSpeed;
      physics.applyForwardForce(player, forwardForce * delta);
      
      // Gentler strafing
      let strafeForce = 0;
      if (aPressed) strafeForce -= 0.3; // Reduced from 0.5
      if (dPressed) strafeForce += 0.3; // Reduced from 0.5
      
      if (strafeForce !== 0) {
        physics.applySideForce(player, player.accelerationValue * strafeForce * delta * 0.3);
      }
    }
    
    // Always handle vertical movement (works for both input methods)
    let verticalForce = 0;
    if (spacePressed) verticalForce += 1;
    if (shiftPressed) verticalForce -= 1;
    
    if (verticalForce !== 0) {
      physics.applyAltitudeChange(player, 30 * verticalForce * delta);
    } else {
      // Apply natural falling when not using vertical controls
      physics.applyAltitudeChange(player, -5 * delta); // Gentle falling
    }
    
    // Reduce effects in battery saving mode
    if (this.isBatterySaving) {
      // Reduce particle effects, camera shake, etc.
      player.particleIntensity = 0.5; // Half the normal particle intensity
    } else {
      player.particleIntensity = 1.0;
    }
  }
  
  // Forward to touch manager's boost functionality
  applyBoost(multiplier, duration) {
    // Store existing speed multiplier
    const normalSpeed = this.speedMultiplier;
    
    // Set boost state
    this.boostActive = true;
    this.boostMultiplier = multiplier;
    
    // Clear any existing boost timeout
    if (this.boostTimeout) clearTimeout(this.boostTimeout);
    
    // Set timeout to end boost
    this.boostTimeout = setTimeout(() => {
      this.boostActive = false;
      this.boostMultiplier = 1.0;
      
      // Restore pre-boost speed
      this.speedMultiplier = normalSpeed;
    }, duration);
  }
  
  // Set speed multiplier
  setSpeedMultiplier(value) {
    // Only update if not currently boosting
    if (!this.boostActive) {
      this.speedMultiplier = value;
    }
  }
  
  // Control vertical movement
  setVerticalMovement(value) {
    this.verticalControl = Math.max(-1, Math.min(1, value));
  }
  
  // Set battery saving mode
  setBatterySavingMode(enabled) {
    this.isBatterySaving = enabled;
    
    if (enabled) {
      // Reduce control sensitivity for better battery performance
      this.mouseSensitivity = 0.0012; // Slightly less sensitive
      this.touchRotationSensitivity = 0.0025; // Reduced for mobile
      this.rotationDamping = 0.95;    // More damping (smoother, fewer updates)
    } else {
      // Restore normal control sensitivity
      this.mouseSensitivity = 0.0015;
      this.touchRotationSensitivity = 0.003;
      this.rotationDamping = 0.92;
    }
    
    console.log(`Input battery saving mode: ${enabled ? 'enabled' : 'disabled'}`);
  }
}