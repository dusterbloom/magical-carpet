import * as THREE from 'three';
import { useGameState, GameStates, selectIsPlaying } from '../../state/gameState';

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
    
    // Track state subscription
    this.unsubscribeState = null;
    
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
    
    // Mobile-specific settings
    this.isMobile = this.engine.input.isTouchDevice;
    this.mobileAutoForward = true;  // Auto-forward for mobile
    
    // Touch altitude control state
    this.touchAltitude = { up: false, down: false };
  }
  
  setupInput() {
    const input = this.engine.input;
    
    // Subscribe to game state changes
    this.unsubscribeState = useGameState.subscribe(
      (state) => {
        const isPlaying = state.currentState === GameStates.PLAYING;
        this.setControlsActive(isPlaying);
      }
    );
    
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
    
    // Handle joystick input for mobile
    if (this.joystick && this.joystick.active) {
      // Use joystick X axis for left/right steering
      if (Math.abs(this.joystick.position.x) > 0.1) { // Add a small deadzone
        player.rotation.y -= this.joystick.position.x * 0.05;
        
        // Apply banking effect
        const targetBankAngle = -this.joystick.position.x * 0.5;
        player.bankAngle = THREE.MathUtils.lerp(
          player.bankAngle,
          targetBankAngle,
          0.1
        );
      }
      
      // Use joystick Y axis for up/down movement (altitude control)
      if (Math.abs(this.joystick.position.y) > 0.1) {
        // Negative Y is up (pulling joystick toward bottom of screen)
        // Positive Y is down (pushing joystick toward top of screen)
        physics.applyAltitudeChange(player, -this.joystick.position.y * 30 * delta);
        
        // Update player pitch based on joystick Y position (look up/down)
        const targetPitch = this.joystick.position.y * 0.5; // Up to 0.5 radians (about 30 degrees)
        player.rotation.x = THREE.MathUtils.lerp(
          player.rotation.x,
          targetPitch,
          0.1
        );
        
        // Update contrail system based on altitude change
        if (this.engine.systems.carpetTrail && this.joystick.position.y < -0.3) {
          this.engine.systems.carpetTrail.setSpaceBarState(true);
        } else if (this.engine.systems.carpetTrail) {
          this.engine.systems.carpetTrail.setSpaceBarState(false);
        }
      }
    }
    
    // Throttle control with smoother acceleration
    if (input.isKeyDown('KeyW')) {
      this.currentThrottle = Math.min(1.0, this.currentThrottle + this.throttleSpeed * delta);
    } else if (input.isKeyDown('KeyS')) {
      this.currentThrottle = Math.max(0.0, this.currentThrottle - this.throttleSpeed * delta);
    }
    
    // Auto-forward for mobile
    if (this.isMobile && this.mobileAutoForward && this.currentThrottle < 0.5) {
      this.currentThrottle = 0.5; // Keep a constant base speed for mobile
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
    
    // Handle touch altitude controls from turbo button
    if (this.touchAltitude.up) verticalForce += 1;
    if (this.touchAltitude.down) verticalForce -= 1;
    
    // Update contrail system based on space key or turbo button
    if (this.engine.systems.carpetTrail) {
      this.engine.systems.carpetTrail.setSpaceBarState(spacePressed || this.touchAltitude.up);
    }
    
    if (verticalForce !== 0) {
      physics.applyAltitudeChange(player, 30 * verticalForce * delta);
    }
    
    // Apply natural falling when not using vertical controls
    if (verticalForce === 0 && (!this.joystick || !this.joystick.active || Math.abs(this.joystick.position.y) <= 0.1)) {
      physics.applyAltitudeChange(player, -5 * delta); // Gentle falling
    }
    
    // Contrail system is already updated above
    
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
  }
  
  /**
   * Set controls active or inactive based on game state
   */
  setControlsActive(active) {
    if (active) {
      // Show mobile controls if on mobile
      if (this.engine.input.isTouchDevice) {
        this.showMobileControls();
      }
      // Enable keyboard/mouse input
    } else {
      // Hide mobile controls if on mobile
      if (this.engine.input.isTouchDevice && this.mobileControlElements) {
        this.hideMobileControls();
      }
      // Disable keyboard/mouse input when not playing
    }
  }
  
  /**
   * Clean up resources when component is destroyed
   */
  destroy() {
    // Clean up state subscription
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }
  }
  
  // setupTouchControls() {
  //   console.log('Setting up touch controls UI elements');
  //   const input = this.engine.input;
    
  //   // Store UI elements in a collection for easy access
  //   this.mobileControlElements = [];
    
  //   // Debug overlay for mobile input
  //   this.createDebugOverlay();
    
  //   // Create virtual joystick for mobile - now on the right side
  //   const joystickContainer = document.createElement('div');
  //   joystickContainer.style.position = 'fixed';
  //   joystickContainer.style.bottom = '20px';
  //   joystickContainer.style.right = '20px'; // Changed from left to right
  //   joystickContainer.style.width = '150px';
  //   joystickContainer.style.height = '150px';
  //   joystickContainer.style.borderRadius = '75px';
  //   joystickContainer.style.background = 'rgba(255, 255, 255, 0.3)';
  //   joystickContainer.style.border = '2px solid rgba(255, 255, 255, 0.5)';
  //   joystickContainer.style.zIndex = '1000';
  //   joystickContainer.style.display = 'none'; // Initially hidden until game starts
  //   document.body.appendChild(joystickContainer);
  //   this.mobileControlElements.push(joystickContainer);
    
  //   const joystick = document.createElement('div');
  //   joystick.style.position = 'absolute';
  //   joystick.style.top = '50px';
  //   joystick.style.left = '50px';
  //   joystick.style.width = '50px';
  //   joystick.style.height = '50px';
  //   joystick.style.borderRadius = '25px';
  //   joystick.style.background = 'rgba(255, 255, 255, 0.7)';
  //   joystick.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
  //   joystickContainer.appendChild(joystick);
    
  //   // Create space button (acts like spacebar for altitude)
  //   const spaceButton = document.createElement('div');
  //   spaceButton.style.position = 'fixed';
  //   spaceButton.style.bottom = '20px';
  //   spaceButton.style.left = '20px'; // Left side
  //   spaceButton.style.width = '80px';
  //   spaceButton.style.height = '80px';
  //   spaceButton.style.borderRadius = '40px';
  //   spaceButton.style.background = 'rgba(30, 144, 255, 0.7)'; // Blue color like spacebar function
  //   spaceButton.style.display = 'flex';
  //   spaceButton.style.alignItems = 'center';
  //   spaceButton.style.justifyContent = 'center';
  //   spaceButton.style.fontSize = '28px';
  //   spaceButton.innerHTML = '🚀'; // Rocket emoji
  //   // Controls already centered
  //   spaceButton.style.pointerEvents = 'auto';
  //   spaceButton.style.color = 'white';
  //   spaceButton.style.boxShadow = '0 0 15px rgba(30, 144, 255, 0.5)';
  //   spaceButton.style.zIndex = '1000';
  //   spaceButton.style.userSelect = 'none';
  //   spaceButton.style.display = 'none'; // Initially hidden until game starts
  //   document.body.appendChild(spaceButton);
  //   this.mobileControlElements.push(spaceButton);
    
  //   // Initialize joystick state
  //   this.joystick = {
  //     active: false,
  //     position: { x: 0, y: 0 },
  //     startPosition: { x: 0, y: 0 },
  //     container: {
  //       rect: joystickContainer.getBoundingClientRect(),
  //       radius: 75
  //     }
  //   };
    
  //   // Update joystick container rect on resize
  //   window.addEventListener('resize', () => {
  //     // Update joystick container rect when visible
  //     if (joystickContainer.style.display !== 'none') {
  //       this.joystick.container.rect = joystickContainer.getBoundingClientRect();
  //     }
  //   });
    
  //   // Also update the rect when container becomes visible
  //   const updateJoystickRect = new MutationObserver((mutations) => {
  //     mutations.forEach((mutation) => {
  //       if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
  //         if (joystickContainer.style.display !== 'none') {
  //           this.joystick.container.rect = joystickContainer.getBoundingClientRect();
  //         }
  //       }
  //     });
  //   });
    
  //   updateJoystickRect.observe(joystickContainer, { attributes: true });
    
  //   // Handle space button events - works exactly like spacebar
  //   spaceButton.addEventListener('touchstart', () => {
  //     this.touchAltitude.up = true;
  //     spaceButton.style.background = 'rgba(0, 119, 255, 0.8)'; // Highlight when active
  //   });
    
  //   spaceButton.addEventListener('touchend', () => {
  //     this.touchAltitude.up = false;
  //     spaceButton.style.background = 'rgba(30, 144, 255, 0.7)'; // Back to normal color
  //   });
    
  //   this.setupJoystickEvents(input, joystick);
  // }
  
  // Toggle motion controls on/off
  
 // In PlayerInput.js
setupTouchControls() {
  console.log('Setting up touch controls UI elements');
  const input = this.engine.input;
  
  // Store UI elements in a collection for easy access
  this.mobileControlElements = [];
  
  // Debug overlay for mobile input
  this.createDebugOverlay();
  
  // Create virtual joystick for mobile - now on the right side
  const joystickContainer = document.createElement('div');
  joystickContainer.style.position = 'fixed';
  joystickContainer.style.bottom = '20px';
  joystickContainer.style.right = '20px'; // Changed from left to right
  joystickContainer.style.width = '150px';
  joystickContainer.style.height = '150px';
  joystickContainer.style.borderRadius = '75px';
  joystickContainer.style.background = 'rgba(255, 255, 255, 0.3)';
  joystickContainer.style.border = '2px solid rgba(255, 255, 255, 0.5)';
  joystickContainer.style.zIndex = '1000';
  joystickContainer.style.display = 'none'; // Initially hidden until game starts
  document.body.appendChild(joystickContainer);
  this.mobileControlElements.push(joystickContainer);
  
  const joystick = document.createElement('div');
  joystick.style.position = 'absolute';
  joystick.style.top = '50px';
  joystick.style.left = '50px';
  joystick.style.width = '50px';
  joystick.style.height = '50px';
  joystick.style.borderRadius = '25px';
  joystick.style.background = 'rgba(255, 255, 255, 0.7)';
  joystick.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
  joystickContainer.appendChild(joystick);
  
  // Create space button (acts like spacebar for altitude)
  const spaceButton = document.createElement('div');
  spaceButton.style.position = 'fixed';
  spaceButton.style.bottom = '20px';
  spaceButton.style.left = '20px'; // Left side
  spaceButton.style.width = '80px';
  spaceButton.style.height = '80px';
  spaceButton.style.borderRadius = '40px';
  spaceButton.style.background = 'rgba(30, 144, 255, 0.7)';
  spaceButton.style.display = 'flex';
  spaceButton.style.alignItems = 'center';
  spaceButton.style.justifyContent = 'center';
  spaceButton.style.fontSize = '28px';
  spaceButton.innerHTML = '🚀';
  spaceButton.style.pointerEvents = 'auto';
  spaceButton.style.color = 'white';
  spaceButton.style.boxShadow = '0 0 15px rgba(30, 144, 255, 0.5)';
  spaceButton.style.zIndex = '1000';
  spaceButton.style.userSelect = 'none';
  spaceButton.style.display = 'none';
  document.body.appendChild(spaceButton);
  this.mobileControlElements.push(spaceButton);
  
  // Initialize joystick state
  this.joystick = {
    active: false,
    position: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    container: {
      rect: joystickContainer.getBoundingClientRect(),
      radius: joystickContainer.getBoundingClientRect().width / 2
    }
  };
  
  // Update joystick container rect on resize
  window.addEventListener('resize', () => {
    if (joystickContainer.style.display !== 'none') {
      this.joystick.container.rect = joystickContainer.getBoundingClientRect();
    }
  });
  
  // Update rect when container becomes visible
  const updateJoystickRect = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        if (joystickContainer.style.display !== 'none') {
          this.joystick.container.rect = joystickContainer.getBoundingClientRect();
        }
      }
    });
  });
  
  updateJoystickRect.observe(joystickContainer, { attributes: true });
  
  // Handle space button events
  spaceButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    this.touchAltitude.up = true;
    spaceButton.style.background = 'rgba(0, 119, 255, 0.8)';
  }, { passive: false });
  
  spaceButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    this.touchAltitude.up = false;
    spaceButton.style.background = 'rgba(30, 144, 255, 0.7)';
  }, { passive: false });
  
  // Setup joystick events using the Input Manager's touch events
  this.setupJoystickEvents(input, joystick);
}
  
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
  
  // setupJoystickEvents(input, joystickElement) {
  //   console.log('Setting up joystick event handlers');
    
  //   // Create a dedicated handler to track which touch ID is controlling the joystick
  //   let joystickTouchId = null;
    
  //   // Handle touch events for joystick
  //   input.on('touchstart', (event) => {
  //     // Prevent default to avoid scrolling
  //     event.preventDefault();
      
  //     // Don't process if we already have an active touch for the joystick
  //     if (joystickTouchId !== null) return;
      
  //     for (let i = 0; i < event.touches.length; i++) {
  //       const touch = event.touches[i];
  //       const touchX = touch.clientX;
  //       const touchY = touch.clientY;
        
  //       // Check if touch is within joystick container
  //       const containerRect = this.joystick.container.rect;
  //       if (
  //         touchX >= containerRect.left &&
  //         touchX <= containerRect.right &&
  //         touchY >= containerRect.top &&
  //         touchY <= containerRect.bottom
  //       ) {
  //         joystickTouchId = touch.identifier; // Store the touch ID
  //         this.joystick.active = true;
  //         this.joystick.startPosition.x = touchX;
  //         this.joystick.startPosition.y = touchY;
          
  //         console.log('Joystick activated with touch ID:', joystickTouchId);
  //         break;
  //       }
  //     }
  //   });
    
  //   input.on('touchmove', (event) => {
  //     // Prevent default to avoid scrolling
  //     event.preventDefault();
      
  //     if (this.joystick.active && joystickTouchId !== null) {
  //       // Find our specific touch by ID
  //       let foundTouch = false;
        
  //       for (let i = 0; i < event.touches.length; i++) {
  //         const touch = event.touches[i];
          
  //         if (touch.identifier === joystickTouchId) {
  //           foundTouch = true;
  //           const touchX = touch.clientX;
  //           const touchY = touch.clientY;
            
  //           const containerRect = this.joystick.container.rect;
  //           const centerX = containerRect.left + containerRect.width / 2;
  //           const centerY = containerRect.top + containerRect.height / 2;
            
  //           // Calculate joystick position
  //           let dx = touchX - centerX;
  //           let dy = touchY - centerY;
            
  //           // Limit to container radius
  //           const distance = Math.sqrt(dx * dx + dy * dy);
  //           const maxDistance = this.joystick.container.radius;
            
  //           if (distance > maxDistance) {
  //             dx = dx * (maxDistance / distance);
  //             dy = dy * (maxDistance / distance);
  //           }
            
  //           // Update joystick position
  //           joystickElement.style.transform = `translate(${dx}px, ${dy}px)`;
            
  //           // Store normalized joystick position (-1 to 1)
  //           this.joystick.position.x = dx / maxDistance;
  //           this.joystick.position.y = dy / maxDistance;
            
  //           break;
  //         }
  //       }
        
  //       // If we didn't find our touch, it may have been canceled
  //       if (!foundTouch) {
  //         this.resetJoystick(joystickElement);
  //         joystickTouchId = null;
  //       }
  //     }
  //   });
    
  //   input.on('touchend', (event) => {
  //     // Prevent default
  //     event.preventDefault();
      
  //     // Check if our joystick touch ended
  //     for (let i = 0; i < event.changedTouches.length; i++) {
  //       const touch = event.changedTouches[i];
        
  //       if (touch.identifier === joystickTouchId) {
  //         this.resetJoystick(joystickElement);
  //         joystickTouchId = null;
  //         console.log('Joystick released');
  //         break;
  //       }
  //     }
  //   });
    
  //   // Also handle touchcancel event
  //   input.on('touchcancel', (event) => {
  //     // Prevent default
  //     event.preventDefault();
      
  //     // Check if our joystick touch was canceled
  //     for (let i = 0; i < event.changedTouches.length; i++) {
  //       const touch = event.changedTouches[i];
        
  //       if (touch.identifier === joystickTouchId) {
  //         this.resetJoystick(joystickElement);
  //         joystickTouchId = null;
  //         console.log('Joystick touch canceled');
  //         break;
  //       }
  //     }
  //   });
  // }
  

  // In PlayerInput.js, modify the touch event handlers:
setupJoystickEvents(input, joystickElement) {
  console.log('Setting up joystick event handlers');
  
  let joystickTouchId = null;
  
  input.on('touchstart', (touchData) => {
    // Use originalEvent for preventDefault
    touchData.originalEvent.preventDefault();
    
    if (joystickTouchId !== null) return;
    
    for (let i = 0; i < touchData.originalEvent.touches.length; i++) {
      const touch = touchData.originalEvent.touches[i];
      const touchX = touch.clientX;
      const touchY = touch.clientY;
      
      const containerRect = this.joystick.container.rect;
      if (
        touchX >= containerRect.left &&
        touchX <= containerRect.right &&
        touchY >= containerRect.top &&
        touchY <= containerRect.bottom
      ) {
        joystickTouchId = touch.identifier;
        this.joystick.active = true;
        this.joystick.startPosition.x = touchX;
        this.joystick.startPosition.y = touchY;
        
        console.log('Joystick activated with touch ID:', joystickTouchId);
        break;
      }
    }
  });
  
  input.on('touchmove', (touchData) => {
    touchData.originalEvent.preventDefault();
    
    if (this.joystick.active && joystickTouchId !== null) {
      let foundTouch = false;
      
      for (let i = 0; i < touchData.originalEvent.touches.length; i++) {
        const touch = touchData.originalEvent.touches[i];
        
        if (touch.identifier === joystickTouchId) {
          foundTouch = true;
          // Rest of your joystick movement code...
          break;
        }
      }
      
      if (!foundTouch) {
        this.resetJoystick(joystickElement);
        joystickTouchId = null;
      }
    }
  });
  
  input.on('touchend', (touchData) => {
    touchData.originalEvent.preventDefault();
    
    for (let i = 0; i < touchData.originalEvent.changedTouches.length; i++) {
      const touch = touchData.originalEvent.changedTouches[i];
      
      if (touch.identifier === joystickTouchId) {
        this.resetJoystick(joystickElement);
        joystickTouchId = null;
        console.log('Joystick released');
        break;
      }
    }
  });
  
  input.on('touchcancel', (touchData) => {
    touchData.originalEvent.preventDefault();
    
    for (let i = 0; i < touchData.originalEvent.changedTouches.length; i++) {
      const touch = touchData.originalEvent.changedTouches[i];
      
      if (touch.identifier === joystickTouchId) {
        this.resetJoystick(joystickElement);
        joystickTouchId = null;
        console.log('Joystick touch canceled');
        break;
      }
    }
  });
}
  resetJoystick(joystickElement) {
    this.joystick.active = false;
    this.joystick.position.x = 0;
    this.joystick.position.y = 0;
    joystickElement.style.left = '33%';
    joystickElement.style.top = '33%';
  }
  
  createDebugOverlay() {
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
    // Add reference to allow hiding specifically
    this.calibrateButton = calibrateButton;

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
    
    // Create debug overlay to show mobile input status
    const debugOverlay = document.createElement('div');
    debugOverlay.id = 'mobile-debug-overlay';
    debugOverlay.style.position = 'fixed';
    debugOverlay.style.top = '10px';
    debugOverlay.style.left = '10px';
    debugOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
    debugOverlay.style.color = 'white';
    debugOverlay.style.padding = '10px';
    debugOverlay.style.borderRadius = '5px';
    debugOverlay.style.fontFamily = 'monospace';
    debugOverlay.style.fontSize = '12px';
    // debugOverlay.style.zIndex = '2000';
    debugOverlay.style.pointerEvents = 'none'; // Don't capture touch events
    document.body.appendChild(debugOverlay);
    
    // Store for updating
    this.debugOverlay = debugOverlay;
    
    // Add toggle to enable/disable the debug overlay
    const debugToggle = document.createElement('div');
    debugToggle.style.position = 'fixed';
    debugToggle.style.top = '10px';
    debugToggle.style.right = '10px';
    debugToggle.style.width = '40px';
    debugToggle.style.height = '40px';
    debugToggle.style.borderRadius = '20px';
    debugToggle.style.background = 'rgba(255, 255, 255, 0.5)';
    debugToggle.style.display = 'flex';
    debugToggle.style.alignItems = 'center';
    debugToggle.style.justifyContent = 'center';
    debugToggle.style.fontSize = '18px';
    debugToggle.textContent = 'D';
    debugToggle.style.zIndex = '2001';
    debugToggle.style.userSelect = 'none';
    debugToggle.style.display = 'none'; // Initially hidden until game starts
    document.body.appendChild(debugToggle);
    this.mobileControlElements.push(debugToggle);
    
    // Toggle debug display on click
    debugToggle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.debugOverlay.style.display = this.debugOverlay.style.display === 'none' ? 'block' : 'none';
    });
    
    // Start with debug hidden
    this.debugOverlay.style.display = 'none';
    this.mobileControlElements.push(this.debugOverlay);
  }
  
  /**
   * Show mobile controls after game starts
   */
  showMobileControls() {
    console.log('Showing mobile controls');
    // Always show touch controls first
    this.setupTouchControls();
    
    // Hide the calibration button by default on mobile
    if (this.calibrateButton) {
      this.calibrateButton.style.display = 'none';
    }
    
    // Optionally offer motion controls
    const motionButton = document.createElement('button');
    motionButton.innerHTML = '📱 Enable Motion Controls';
    motionButton.onclick = async () => {
      const enabled = await this.toggleMotionControls(true);
      if (enabled) {
        // Motion controls working, can hide some touch UI
        this.minimizeTouchControls();
        
        // Show calibration button only when motion controls are active
        if (this.calibrateButton) {
          this.calibrateButton.style.display = 'flex';
        }
      } else {
        // Motion failed, keep using touch controls
        alert('Motion controls not available. Using touch controls.');
      }
    };
  }
  
  /**
   * Hide mobile controls when not in playing state
   */
  hideMobileControls() {
    console.log('Hiding mobile controls');
    if (this.mobileControlElements) {
      this.mobileControlElements.forEach(element => {
        element.style.display = 'none';
      });
    }
  }
  
  updateDebugOverlay() {
    if (!this.debugOverlay) return;
    
    const input = this.engine.input;
    const player = this.playerSystem.localPlayer;
    
    if (!player) {
      this.debugOverlay.textContent = 'Player not initialized';
      return;
    }
    
    const joystickInfo = this.joystick ? 
      `Joystick: ${this.joystick.active ? 'Active' : 'Inactive'} (${this.joystick.position.x.toFixed(2)}, ${this.joystick.position.y.toFixed(2)})` : 
      'Joystick: Not initialized';
    
    const motionInfo = `Motion Controls: ${this.motionControlsEnabled ? 'Enabled' : 'Disabled'}`;
    const orientationInfo = input.deviceOrientation ? 
      `Orientation: α:${input.deviceOrientation.alpha.toFixed(0)}° β:${input.deviceOrientation.beta.toFixed(0)}° γ:${input.deviceOrientation.gamma.toFixed(0)}°` : 
      'Orientation: Not available';
      
    const fusedInfo = input.fusedOrientation ? 
      `Fused: α:${input.fusedOrientation.alpha.toFixed(0)}° β:${input.fusedOrientation.beta.toFixed(0)}° γ:${input.fusedOrientation.gamma.toFixed(0)}°` : 
      'Fused: Not available';
    
    const playerInfo = `Position: (${player.position.x.toFixed(0)}, ${player.position.y.toFixed(0)}, ${player.position.z.toFixed(0)})`;
    const velocityInfo = `Velocity: (${player.velocity.x.toFixed(1)}, ${player.velocity.y.toFixed(1)}, ${player.velocity.z.toFixed(1)})`;
    
    this.debugOverlay.innerHTML = [
      `<div>Mobile Controls Debug</div>`,
      `<div>${joystickInfo}</div>`,
      `<div>${motionInfo}</div>`,
      `<div>${orientationInfo}</div>`,
      `<div>${fusedInfo}</div>`,
      `<div>${playerInfo}</div>`,
      `<div>${velocityInfo}</div>`,
      `<div>Throttle: ${this.currentThrottle.toFixed(2)}</div>`,
      `<div>Touch Alt: Up=${this.touchAltitude.up} Down=${this.touchAltitude.down}</div>`
    ].join('<br>');
    
    // Schedule next update
    requestAnimationFrame(() => this.updateDebugOverlay());
  }


  setupTouchControls() {
    console.log('Setting up touch controls UI elements');
    
    // Store UI elements in a collection for easy access
    this.mobileControlElements = [];
    
    // Create virtual joystick container
    const joystickContainer = document.createElement('div');
    joystickContainer.style.position = 'fixed';
    joystickContainer.style.bottom = '5%';
    joystickContainer.style.right = '5%';
    joystickContainer.style.width = '20vmin';
    joystickContainer.style.height = '20vmin';
    joystickContainer.style.borderRadius = '50%';
    joystickContainer.style.background = 'rgba(255, 255, 255, 0.2)';
    joystickContainer.style.border = '2px solid rgba(255, 255, 255, 0.4)';
    joystickContainer.style.zIndex = '1000';
    document.body.appendChild(joystickContainer);
    this.mobileControlElements.push(joystickContainer);
  
    // Create joystick knob
    const joystick = document.createElement('div');
    joystick.style.position = 'absolute';
    joystick.style.top = '33%';
    joystick.style.left = '33%';
    joystick.style.width = '33%';
    joystick.style.height = '33%';
    joystick.style.borderRadius = '50%';
    joystick.style.background = 'rgba(255, 255, 255, 0.8)';
    joystick.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    joystickContainer.appendChild(joystick);
  
    // Create boost button
    const boostButton = document.createElement('div');
    boostButton.style.position = 'fixed';
    boostButton.style.bottom = '5%';
    boostButton.style.left = '5%';
    boostButton.style.width = '15vmin';
    boostButton.style.height = '15vmin';
    boostButton.style.borderRadius = '50%';
    boostButton.style.background = 'rgba(30, 144, 255, 0.7)';
    boostButton.style.display = 'flex';
    boostButton.style.alignItems = 'center';
    boostButton.style.justifyContent = 'center';
    boostButton.style.fontSize = 'min(28px, 4vmin)';
    boostButton.innerHTML = '🚀';
    boostButton.style.color = 'white';
    boostButton.style.boxShadow = '0 0 15px rgba(30, 144, 255, 0.5)';
    boostButton.style.zIndex = '1000';
    document.body.appendChild(boostButton);
    this.mobileControlElements.push(boostButton);
  
    // Initialize joystick state
    this.joystick = {
      active: false,
      position: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 },
      container: {
        rect: joystickContainer.getBoundingClientRect(),
        radius: 75
      }
    };
  
    // Handle boost button events
    boostButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.touchAltitude.up = true;
      boostButton.style.background = 'rgba(0, 119, 255, 0.8)';
    }, { passive: false });
  
    boostButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.touchAltitude.up = false;
      boostButton.style.background = 'rgba(30, 144, 255, 0.7)';
    }, { passive: false });
  
    // Setup joystick touch handling
    this.setupJoystickEvents(joystick);
  
    // Update joystick container rect on resize
    window.addEventListener('resize', () => {
      this.joystick.container.rect = joystickContainer.getBoundingClientRect();
    });
  }
  
  setupJoystickEvents(joystickElement) {
    let joystickTouchId = null;
  
    const handleTouchStart = (e) => {
      // Only prevent default for the joystick control, not all touches
      // This allows other touch events (like boost button) to work simultaneously
      
      if (joystickTouchId !== null) return;
      
      // Find a touch that's within the joystick container
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const rect = this.joystick.container.rect;
        
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          // Prevent default only for this specific touch
          e.preventDefault();
          joystickTouchId = touch.identifier;
          this.joystick.active = true;
          updateJoystickPosition(touch);
          break;
        }
      }
    };
  
    const handleTouchMove = (e) => {
      // Don't prevent default for all touches, only handle our joystick
      if (!this.joystick.active) return;
  
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === joystickTouchId) {
          // Only prevent default for the joystick touch
          e.preventDefault();
          updateJoystickPosition(e.touches[i]);
          break;
        }
      }
    };
  
    const handleTouchEnd = (e) => {
      // Don't prevent default for all touches
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId) {
          // Only prevent default for the joystick touch
          e.preventDefault();
          resetJoystick();
          break;
        }
      }
    };
  
    const updateJoystickPosition = (touch) => {
      const rect = this.joystick.container.rect;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;
      
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > this.joystick.container.radius) {
        dx *= this.joystick.container.radius / distance;
        dy *= this.joystick.container.radius / distance;
      }
      
      // Use left/top positioning instead of transform for better compatibility
      joystickElement.style.left = `calc(33% + ${dx}px)`;
      joystickElement.style.top = `calc(33% + ${dy}px)`;
      
      this.joystick.position.x = dx / this.joystick.container.radius;
      this.joystick.position.y = dy / this.joystick.container.radius;
    };
  
    const resetJoystick = () => {
      joystickTouchId = null;
      this.joystick.active = false;
      this.joystick.position.x = 0;
      this.joystick.position.y = 0;
      joystickElement.style.left = '33%';
      joystickElement.style.top = '33%';
    };
  
    // Add touch event listeners
    const container = joystickElement.parentElement;
    document.body.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.body.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.body.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    
    // These event listeners are attached to document.body instead of just the joystick container
    // to ensure we can track touches even if they move outside the joystick area
    // This helps with simultaneous input handling
  }
}
