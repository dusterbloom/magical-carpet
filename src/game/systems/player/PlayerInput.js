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
    
    // Motion control properties
    this.motionControlsEnabled = false;
    this.motionSensitivity = {
      pitch: 0.05,  // Controls up/down movement
      yaw: 0.08     // Controls left/right turning
    };
    
    // Touch altitude control state
    this.touchAltitude = { up: false, down: false };
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
    let spacePressed = input.isKeyDown('Space');
    if (spacePressed) verticalForce += 1;
    if (input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight')) verticalForce -= 1;
    
    // Handle touch altitude controls
    if (this.touchAltitude.up) verticalForce += 1;
    if (this.touchAltitude.down) verticalForce -= 1;
    
    // Update contrail system based on space key state
    if (this.engine.systems.carpetTrail) {
      this.engine.systems.carpetTrail.setSpaceBarState(spacePressed || this.touchAltitude.up);
    }
    
    if (verticalForce !== 0) {
      physics.applyAltitudeChange(player, 30 * verticalForce * delta);
    }
    
    // Apply natural falling when not using vertical controls
    if (verticalForce === 0) {
      physics.applyAltitudeChange(player, -5 * delta); // Gentle falling
    }
    
    // Handle device motion controls if enabled
    if (this.motionControlsEnabled && input.deviceMotionEnabled && input.initialOrientation) {
      const orientation = input.deviceOrientation;
      const initial = input.initialOrientation;
      
      // Calculate differences from initial orientation
      const betaDiff = (orientation.beta - initial.beta) * this.motionSensitivity.pitch;
      const gammaDiff = (orientation.gamma - initial.gamma) * this.motionSensitivity.yaw;
      
      // Map beta (forward/back tilt) to altitude changes
      if (Math.abs(betaDiff) > 3) { // Reduced threshold from 5 to 3
        // Forward tilt (negative beta diff) -> go down
        // Backward tilt (positive beta diff) -> go up
        physics.applyAltitudeChange(player, betaDiff * delta * 0.5);
      }
      
      // Map gamma (left/right tilt) to turning
      if (Math.abs(gammaDiff) > 1) { // Reduced threshold from 2 to 1
        // Right tilt (positive gamma diff) -> turn right
        // Left tilt (negative gamma diff) -> turn left
        player.rotation.y -= gammaDiff * delta;
        
        // Apply banking effect
        const targetBankAngle = -gammaDiff * 0.03;
        player.bankAngle = THREE.MathUtils.lerp(
          player.bankAngle,
          targetBankAngle,
          0.1
        );
      }
      
      // IMPORTANT ADDITION: Always apply forward force when using motion controls
      // This ensures the carpet is always moving forward
      const motionForwardForce = player.maxSpeed * 0.5; // Use 50% of max speed
      physics.applyForwardForce(player, motionForwardForce * delta);
    }
  }
  
  setupTouchControls() {
    const input = this.engine.input;
    
    // Create virtual joystick for mobile
    const joystickContainer = document.createElement('div');
    joystickContainer.style.position = 'absolute';
    joystickContainer.style.bottom = '20px';
    joystickContainer.style.left = '20px';
    joystickContainer.style.width = '120px';
    joystickContainer.style.height = '120px';
    joystickContainer.style.borderRadius = '60px';
    joystickContainer.style.background = 'rgba(255, 255, 255, 0.2)';
    document.body.appendChild(joystickContainer);
    
    const joystick = document.createElement('div');
    joystick.style.position = 'absolute';
    joystick.style.top = '35px';
    joystick.style.left = '35px';
    joystick.style.width = '50px';
    joystick.style.height = '50px';
    joystick.style.borderRadius = '25px';
    joystick.style.background = 'rgba(255, 255, 255, 0.5)';
    joystickContainer.appendChild(joystick);
    
    // Create altitude controls
    const altUpButton = document.createElement('div');
    altUpButton.style.position = 'absolute';
    altUpButton.style.bottom = '150px';
    altUpButton.style.right = '20px';
    altUpButton.style.width = '60px';
    altUpButton.style.height = '60px';
    altUpButton.style.borderRadius = '30px';
    altUpButton.style.background = 'rgba(255, 255, 255, 0.5)';
    altUpButton.style.display = 'flex';
    altUpButton.style.alignItems = 'center';
    altUpButton.style.justifyContent = 'center';
    altUpButton.style.fontSize = '24px';
    altUpButton.textContent = '↑';
    altUpButton.style.pointerEvents = 'auto';
    document.body.appendChild(altUpButton);
    
    const altDownButton = document.createElement('div');
    altDownButton.style.position = 'absolute';
    altDownButton.style.bottom = '80px';
    altDownButton.style.right = '20px';
    altDownButton.style.width = '60px';
    altDownButton.style.height = '60px';
    altDownButton.style.borderRadius = '30px';
    altDownButton.style.background = 'rgba(255, 255, 255, 0.5)';
    altDownButton.style.display = 'flex';
    altDownButton.style.alignItems = 'center';
    altDownButton.style.justifyContent = 'center';
    altDownButton.style.fontSize = '24px';
    altDownButton.textContent = '↓';
    altDownButton.style.pointerEvents = 'auto';
    document.body.appendChild(altDownButton);
    
    // Create fire button
    const fireButton = document.createElement('div');
    fireButton.style.position = 'absolute';
    fireButton.style.bottom = '80px';
    fireButton.style.right = '100px';
    fireButton.style.width = '80px';
    fireButton.style.height = '80px';
    fireButton.style.borderRadius = '40px';
    fireButton.style.background = 'rgba(255, 0, 0, 0.5)';
    fireButton.style.display = 'flex';
    fireButton.style.alignItems = 'center';
    fireButton.style.justifyContent = 'center';
    fireButton.style.fontSize = '16px';
    fireButton.textContent = 'FIRE';
    fireButton.style.pointerEvents = 'auto';
    document.body.appendChild(fireButton);
    
    // Initialize joystick state
    this.joystick = {
      active: false,
      position: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 },
      container: {
        rect: joystickContainer.getBoundingClientRect(),
        radius: 60
      }
    };
    
    // Update joystick container rect on resize
    window.addEventListener('resize', () => {
      this.joystick.container.rect = joystickContainer.getBoundingClientRect();
    });
    
    // Handle altitude button events
    altUpButton.addEventListener('touchstart', () => {
      this.touchAltitude.up = true;
    });
    
    altUpButton.addEventListener('touchend', () => {
      this.touchAltitude.up = false;
    });
    
    altDownButton.addEventListener('touchstart', () => {
      this.touchAltitude.down = true;
    });
    
    altDownButton.addEventListener('touchend', () => {
      this.touchAltitude.down = false;
    });
    
    // Handle fire button events
    fireButton.addEventListener('touchstart', () => {
      this.playerSystem.spells.castSpell();
    });
    
    this.setupJoystickEvents(input, joystick);
  }
  
  // Toggle motion controls on/off
  toggleMotionControls(enabled) {
    this.motionControlsEnabled = enabled;
    const input = this.engine.input;
    
    if (enabled) {
      input.setDeviceMotionEnabled(true);
      
      // Hide virtual joystick when using motion controls
      if (this.joystick) {
        this.joystick.active = false;
        this.joystick.position.x = 0;
        this.joystick.position.y = 0;
      }
    } else {
      input.setDeviceMotionEnabled(false);
    }
    
    return this.motionControlsEnabled;
  }
  
  setupJoystickEvents(input, joystickElement) {
    // Handle touch events for joystick
    input.on('touchstart', (event) => {
      for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        // Check if touch is within joystick container
        const containerRect = this.joystick.container.rect;
        if (
          touchX >= containerRect.left &&
          touchX <= containerRect.right &&
          touchY >= containerRect.top &&
          touchY <= containerRect.bottom
        ) {
          this.joystick.active = true;
          this.joystick.startPosition.x = touchX;
          this.joystick.startPosition.y = touchY;
          break;
        }
      }
    });
    
    input.on('touchmove', (event) => {
      if (this.joystick.active) {
        for (let i = 0; i < event.touches.length; i++) {
          const touch = event.touches[i];
          const touchX = touch.clientX;
          const touchY = touch.clientY;
          
          const containerRect = this.joystick.container.rect;
          const centerX = containerRect.left + containerRect.width / 2;
          const centerY = containerRect.top + containerRect.height / 2;
          
          // Calculate joystick position
          let dx = touchX - centerX;
          let dy = touchY - centerY;
          
          // Limit to container radius
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = this.joystick.container.radius;
          
          if (distance > maxDistance) {
            dx = dx * (maxDistance / distance);
            dy = dy * (maxDistance / distance);
          }
          
          // Update joystick position
          joystickElement.style.transform = `translate(${dx}px, ${dy}px)`;
          
          // Store normalized joystick position (-1 to 1)
          this.joystick.position.x = dx / maxDistance;
          this.joystick.position.y = dy / maxDistance;
          
          break;
        }
      }
    });
    
    input.on('touchend', (event) => {
      this.joystick.active = false;
      this.joystick.position.x = 0;
      this.joystick.position.y = 0;
      joystickElement.style.transform = 'translate(0px, 0px)';
    });
  }
}
