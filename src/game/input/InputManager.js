import { TouchInputManager } from './TouchInputManager';

export class InputManager {
  constructor() {
    this.keys = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: 0 };
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.listeners = {};
    this.pointerLocked = false;
    this.touchManager = new TouchInputManager();
    
    // Control states for carpet movement
    this.moveState = {
      forward: 0,
      right: 0,
      up: 0,
      rotation: 0
    };
  }
  
  async initialize() {
    // Initialize touch controls if on mobile
    if (this.isTouchDevice) {
      await this.touchManager.initialize();
      this.startTouchInputLoop();
    }
    
    // Keyboard events
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
  }

  startTouchInputLoop() {
    const updateTouchInput = () => {
      if (!this.touchManager) return;
      
      const input = this.touchManager.getInput();
      
      // Update movement state from joystick
      if (input.joystick.moving) {
        // Convert angle to forward/right movement
        this.moveState.forward = -Math.cos(input.joystick.angle) * input.joystick.force;
        this.moveState.right = -Math.sin(input.joystick.angle) * input.joystick.force;
      } else {
        this.moveState.forward = 0;
        this.moveState.right = 0;
      }
      
      // Update vertical movement from tilt
      if (input.hasDeviceMotion) {
        // Convert tilt to up/down movement
        // Beta (forward/back tilt) controls up/down
        // Normalize beta from [-90, 90] to [-1, 1]
        this.moveState.up = input.tilt.smoothedBeta / 90;
        
        // Clamp values
        this.moveState.up = Math.max(-1, Math.min(1, this.moveState.up));
      }
      
      // Emit movement update event
      this.emit('moveUpdate', this.moveState);
      
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
  }
  
  onKeyUp(event) {
    this.keys[event.code] = false;
    this.updateKeyboardMoveState();
    this.emit('keyup', event);
  }
  
  updateKeyboardMoveState() {
    // Only update keyboard movement if not using touch
    if (!this.isTouchDevice) {
      this.moveState.forward = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
      this.moveState.right = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
      this.moveState.up = (this.keys['Space'] ? 1 : 0) - (this.keys['ShiftLeft'] ? 1 : 0);
      this.emit('moveUpdate', this.moveState);
    }
  }
  
  // Mouse handlers...
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
  
  // Clean up
  dispose() {
    if (this.touchManager) {
      this.touchManager.dispose();
    }
  }
}
