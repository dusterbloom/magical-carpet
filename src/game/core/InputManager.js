export class InputManager {
  constructor() {
    this.keys = {};
    this.touches = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: 0 };
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.listeners = {};
    this.pointerLocked = false;
  }
  
  initialize() {
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
      window.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
      window.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
      window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
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
    event.preventDefault();
    
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
}
