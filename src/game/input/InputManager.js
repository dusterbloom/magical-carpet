import { TouchInputManager } from './TouchInputManager';
import { MobileUI } from '../ui/MobileUI';

export class InputManager {
  constructor() {
    this.keys = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: 0 };
    
    // More careful device detection - don't assume touch-enabled means ONLY touch
    this.hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.isTouchDevice = this.hasTouchSupport && this.isMobile; // Only if both touch support AND mobile UA
    this.isTablet = this.isTouchDevice && Math.min(window.innerWidth, window.innerHeight) > 600;
    
    console.log('Input device detection:', {
      hasTouchSupport: this.hasTouchSupport,
      isMobile: this.isMobile,
      isTouchDevice: this.isTouchDevice,
      isTablet: this.isTablet
    });
    this.listeners = {};
    this.pointerLocked = false;
    // Initialize touch-related components with error handling
    try {
      this.touchManager = new TouchInputManager(this);
      
      // Only create mobile UI if on touch device
      if (this.isTouchDevice) {
        try {
          this.mobileUI = new MobileUI(this);
          console.log('Mobile UI initialized successfully');
        } catch (uiError) {
          console.warn('Error creating Mobile UI:', uiError);
          this.mobileUI = null;
        }
      } else {
        this.mobileUI = null;
      }
    } catch (error) {
      console.error('Error initializing touch components:', error);
      // Fallback to empty touch manager if creation fails
      this.touchManager = { initialize: () => {}, getInput: () => ({ move: {x:0, y:0}, turn: {x:0, y:0} }) };
      this.mobileUI = null;
    }
    
    // Control states for carpet movement
    this.moveState = {
      forward: 0,
      right: 0,
      up: 0,
      rotation: 0
    };
  }
  
  async initialize() {
    try {
      // Initialize touch controls if on mobile
      if (this.hasTouchSupport) {
        console.log('Touch support detected - initializing mobile input');
        
        // Create fallback joysticks directly if needed
        this.createFallbackJoysticks();
        
        try {
          await this.touchManager.initialize();
          this.startTouchInputLoop();
          
          // Register double tap gesture if using touch input
          if (this.touchManager.setDoubleTapCallback) {
            this.touchManager.setDoubleTapCallback(() => {
              // Trigger a special ability or jump action on double tap
              this.emit('doubleTap', {});
            });
          }
        } catch (error) {
          console.error('Error initializing touch manager:', error);
        }
      
      // Set up standard keyboard and mouse events
      window.addEventListener('keydown', this.onKeyDown.bind(this));
      window.addEventListener('keyup', this.onKeyUp.bind(this));
      
      // Mouse events (for desktop)
      if (!this.isTouchDevice) {
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
      }
      
      // Prevent context menu
      window.addEventListener('contextmenu', (e) => e.preventDefault());
      
      // Initialize mobile UI optimizations after everything else is ready
      if (this.isTouchDevice && this.mobileUI) {
        // Small delay to ensure other systems are ready
        setTimeout(() => {
          try {
            this.mobileUI.initialize();
            console.log('Mobile UI successfully initialized');
          } catch (error) {
            console.warn('Error initializing Mobile UI:', error);
          }
        }, 200);
      }
      
      console.log('Input system successfully initialized');
    } catch (error) {
      console.error('Error initializing input system:', error);
    }
  }
  }

  startTouchInputLoop() {
    console.log('Starting touch input loop');
    
    const updateTouchInput = () => {
      if (!this.touchManager) return;
      
      try {
        // Get optimized input data from the touch manager
        const input = this.touchManager.getInput();
        console.log('Touch input:', input);
        
        // Clear the previous move state to prevent stale values
        this.moveState = {
          forward: 0,
          right: 0,
          up: 0,
          rotation: 0
        };
        
        // Update movement state from optimized joystick with dead zones
        if (input && input.joystick && input.joystick.moving) {
          // Improved angle-to-movement conversion for better responsiveness
          const angle = input.joystick.angle || 0;
          const force = input.joystick.force || 0;
          
          // Forward/backward is based on cosine of the angle (since 0 is right)
          this.moveState.forward = -Math.sin(angle) * force;
          
          // Left/right is based on sine of the angle
          this.moveState.right = Math.cos(angle) * force;
          
          // Apply small deadzone for more stability
          if (Math.abs(this.moveState.forward) < 0.1) this.moveState.forward = 0;
          if (Math.abs(this.moveState.right) < 0.1) this.moveState.right = 0;
          
          console.log('Updated move state from joystick:', this.moveState);
        }
        
        // Update turning from either turn joystick or tilt
        if (input.turn && input.turn.turning) {
          // Use dedicated turn joystick if available (tablets/larger screens)
          this.moveState.rotation = input.turn.x * 0.5;  // Scale for better control
          console.log('Updated rotation from turn joystick:', this.moveState.rotation);
        } else if (input.hasDeviceMotion) {
          // Use device tilt for rotation on smaller devices
          this.moveState.rotation = input.tilt.smoothedGamma / 45;  // Normalize for sensitivity
          
          // Apply small deadzone
          if (Math.abs(this.moveState.rotation) < 0.08) this.moveState.rotation = 0;
          
          console.log('Updated rotation from device motion:', this.moveState.rotation);
        }
        
        // Update vertical movement from tilt or second joystick axis
        if (input.hasDeviceMotion) {
          // Convert beta tilt (forward/back) to up/down movement
          const rawUp = input.tilt.smoothedBeta / 45;  // More sensitive than before
          this.moveState.up = Math.abs(rawUp) < 0.1 ? 0 : rawUp;
          
          // Clamp values
          this.moveState.up = Math.max(-1, Math.min(1, this.moveState.up));
          
          console.log('Updated vertical movement from device motion:', this.moveState.up);
        }
        
        // Update touchManager if it has an update method
        if (typeof this.touchManager.update === 'function') {
          this.touchManager.update();
        }
        
        // Update mobile UI if active
        if (this.mobileUI) {
          // Get player state for UI updates if available
          const player = this.getPlayerState ? this.getPlayerState() : null;
          this.mobileUI.update(0.016, player); // 0.016 ~= 60fps
        }
        
        // Emit movement update event
        this.emit('moveUpdate', this.moveState);
      } catch (error) {
        console.error('Error in touch input loop:', error);
      }
      
      // Continue the loop
      requestAnimationFrame(updateTouchInput);
    };
    
    // Start the update loop
    updateTouchInput();
  }
  
  // Existing keyboard and mouse handlers...
  onKeyDown(event) {
    this.keys[event.code] = true;
    this.updateKeyboardMoveState();
    this.emit('keydown', event);
    console.log('Key pressed:', event.code);
  }
  
  onKeyUp(event) {
    this.keys[event.code] = false;
    this.updateKeyboardMoveState();
    this.emit('keyup', event);
  }
  
  // Check if a key is currently pressed
  isKeyDown(keyCode) {
    return this.keys[keyCode] === true;
  }
  
  updateKeyboardMoveState() {
    // Allow keyboard input on all devices, regardless of touch capability
    // This helps devices like tablets with keyboard attachments
    
    // Update moveState based on current key states
    this.moveState.forward = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    this.moveState.right = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    this.moveState.up = (this.keys['Space'] ? 1 : 0) - (this.keys['ShiftLeft'] ? 1 : 0);
    console.log('Keyboard move state updated:', this.moveState);
    
    // Emit the movement update event
    this.emit('moveUpdate', this.moveState);
  }
  
  // Mouse handlers...
  onMouseDown(event) {
    this.mouse.buttons = event.buttons;
    this.emit('mousedown', event);
  }
  
  // Create fallback joysticks for mobile if TouchInputManager fails
  createFallbackJoysticks() {
    try {
      // Only create fallback joysticks if touch is supported but we're on a mobile device
      if (!this.hasTouchSupport || !this.isMobile) return;
      
      console.log('Creating fallback joysticks');
      
      // Create a simple move joystick
      const moveJoystick = document.createElement('div');
      moveJoystick.id = 'fallback-move-joystick';
      moveJoystick.style.cssText = `
        position: fixed;
        bottom: 120px;
        left: 40px;
        width: 150px;
        height: 150px;
        background: rgba(255, 255, 255, 0.4);
        border-radius: 50%;
        border: 4px solid white;
        z-index: 2000;
        touch-action: none;
        pointer-events: auto;
      `;
      
      // Add inner circle
      const moveInner = document.createElement('div');
      moveInner.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 60px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
      `;
      moveJoystick.appendChild(moveInner);
      document.body.appendChild(moveJoystick);
      
      // Only add turn joystick for tablets and larger screens
      if (this.isTablet || window.innerWidth >= 768) {
        const turnJoystick = document.createElement('div');
        turnJoystick.id = 'fallback-turn-joystick';
        turnJoystick.style.cssText = `
          position: fixed;
          bottom: 120px;
          right: 40px;
          width: 150px;
          height: 150px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 50%;
          border: 4px solid white;
          z-index: 2000;
          touch-action: none;
          pointer-events: auto;
        `;
        
        // Add inner circle
        const turnInner = document.createElement('div');
        turnInner.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 60px;
          height: 60px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 50%;
        `;
        turnJoystick.appendChild(turnInner);
        document.body.appendChild(turnJoystick);
      }
      
      console.log('Fallback joysticks created');
    } catch (error) {
      console.error('Error creating fallback joysticks:', error);
    }
  }
  
  onMouseUp(event) {
    this.mouse.buttons = event.buttons;
    this.emit('mouseup', event);
  }
  
  onMouseMove(event) {
    if (this.pointerLocked) {
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
  
  // Set battery saving mode
  setBatterySavingMode(enabled) {
    // Forward to touch manager
    if (this.touchManager && typeof this.touchManager.setBatterySavingMode === 'function') {
      this.touchManager.setBatterySavingMode(enabled);
    }
    
    // Forward to mobile UI
    if (this.mobileUI && typeof this.mobileUI.applyBatterySavingMode === 'function') {
      this.mobileUI.applyBatterySavingMode(enabled);
    }
  }
  
  // Used by touch input system to get player state
  setPlayerStateProvider(callback) {
    if (typeof callback === 'function') {
      this.getPlayerState = callback;
      console.log('Player state provider set successfully');
    }
  }
  
  // Clean up
  dispose() {
    if (this.touchManager) {
      this.touchManager.dispose();
    }
    
    if (this.mobileUI) {
      this.mobileUI.dispose();
    }
    
    // Remove all event listeners
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('contextmenu', e => e.preventDefault());
  }
}
