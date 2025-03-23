import * as THREE from 'three';

export class PlayerInput {
  constructor(playerSystem) {
    this.playerSystem = playerSystem;
    this.engine = playerSystem.engine;
    
    // Reduce mouse sensitivity and add rotation damping
    this.mouseSensitivity = 0.0015;  // Reduced from 0.002
    this.throttleSpeed = 1.0;
    this.bankingSensitivity = 0.3;   // Reduced from 0.5
    this.rotationDamping = 0.92;     // New: dampens rotation
    
    this.currentThrottle = 0;
    
    // Mobile input control values
    this.verticalControl = 0;       // For altitude control via gestures
    this.isBatterySaving = false;   // Battery saving mode tracking
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
    
    // Check if using mobile controls or keyboard
    const isMobile = input.isTouchDevice;
    
    if (isMobile) {
      // Get input from touch manager
      if (input.moveState) {
        // Apply forward movement based on joystick position
        const forwardAmount = input.moveState.forward; 
        this.currentThrottle = Math.abs(forwardAmount);
        
        // Apply forward force based on throttle
        physics.applyForwardForce(player, forwardAmount * player.maxSpeed * delta);
        
        // Apply side force for strafing
        const sideAmount = input.moveState.right;
        if (Math.abs(sideAmount) > 0.1) { // Apply small deadzone
          physics.applySideForce(player, player.accelerationValue * sideAmount * delta * 0.5);
        }
        
        // Apply rotation from touch controls (either from explicit turn control or derived from strafe)
        if (input.moveState.rotation !== undefined) {
          // Explicit rotation value
          player.rotation.y += input.moveState.rotation * delta * 3;
          
          // Apply banking based on rotation rate
          player.bankAngle = -input.moveState.rotation * 0.8; 
        } else if (Math.abs(sideAmount) > 0.1) {
          // Derive rotation from strafe when no explicit rotation
          player.rotation.y += sideAmount * delta * 2;
          player.bankAngle = sideAmount * 0.5;
        }
        
        console.log('Applied mobile movement:', {
          forward: forwardAmount,
          side: sideAmount,
          rotation: input.moveState.rotation
        });
      }
      
      // Handle altitude changes
      if (this.verticalControl !== 0) {
        // Use gestures or specific altitude control
        physics.applyAltitudeChange(player, 40 * this.verticalControl * delta);
        
        // Add gradual decay for smoother control
        this.verticalControl *= 0.95;
        if (Math.abs(this.verticalControl) < 0.05) this.verticalControl = 0;
      } else {
        // Apply gentle falling when no altitude control
        physics.applyAltitudeChange(player, -5 * delta);
      }
      
    } else {
      // --- KEYBOARD CONTROLS ---
      
      // Throttle control with smoother acceleration
      if (input.isKeyDown('KeyW')) {
        this.currentThrottle = Math.min(1.0, this.currentThrottle + this.throttleSpeed * delta);
      } else if (input.isKeyDown('KeyS')) {
        this.currentThrottle = Math.max(0.0, this.currentThrottle - this.throttleSpeed * delta);
      }
      
      // Calculate forward movement based on throttle with smoother acceleration
      const forwardForce = this.currentThrottle * player.maxSpeed;
      physics.applyForwardForce(player, forwardForce * delta);
      
      // Gentler strafing
      let strafeForce = 0;
      if (input.isKeyDown('KeyA')) strafeForce -= 0.3; // Reduced from 0.5
      if (input.isKeyDown('KeyD')) strafeForce += 0.3; // Reduced from 0.5
      
      if (strafeForce !== 0) {
        physics.applySideForce(player, player.accelerationValue * strafeForce * delta * 0.3);
      }
      
      // Vertical movement (Space/Shift) - more gradual
      let verticalForce = 0;
      if (input.isKeyDown('Space')) verticalForce += 1;
      if (input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight')) verticalForce -= 1;
      
      if (verticalForce !== 0) {
        physics.applyAltitudeChange(player, 30 * verticalForce * delta);
      }
      
      // Apply natural falling when not using vertical controls
      if (verticalForce === 0) {
        physics.applyAltitudeChange(player, -5 * delta); // Gentle falling
      }
    }
    
    // Reduce effects in battery saving mode
    if (this.isBatterySaving) {
      // Reduce particle effects, camera shake, etc.
      player.particleIntensity = 0.5; // Half the normal particle intensity
    } else {
      player.particleIntensity = 1.0;
    }
  }
  
  // Remove old touch control setup - replaced by optimized TouchInputManager
  setupTouchControls() {
    // This method is now deprecated in favor of the new TouchInputManager
    console.log("TouchInputManager now handles touch input - setupTouchControls is deprecated");
  }
  
  // Set battery saving mode
  setBatterySavingMode(enabled) {
    this.isBatterySaving = enabled;
    
    if (enabled) {
      // Reduce control sensitivity for better battery performance
      this.mouseSensitivity = 0.0012; // Slightly less sensitive
      this.rotationDamping = 0.95;    // More damping (smoother, fewer updates)
    } else {
      // Restore normal control sensitivity
      this.mouseSensitivity = 0.0015;
      this.rotationDamping = 0.92;
    }
    
    console.log(`Input battery saving mode: ${enabled ? 'enabled' : 'disabled'}`);
  }
}
