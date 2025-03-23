# Revised Mobile Controls for Magical Carpet

This document outlines the refined control scheme for Magical Carpet on mobile devices, matching the web experience while optimizing for touch interfaces.

## Control Layout Overview

![Mobile Control Layout](https://placeholder.com/control-layout.jpg)

The mobile control scheme consists of:

1. **Left Joystick**: Controls forward/backward movement only (like W/S keys)
2. **Action Buttons**: Two dedicated buttons for boost and speed control
3. **Right Touch Area**: Camera control that replicates mouse functionality

## 1. Left Joystick (Forward/Backward Movement)

### Design

A vertical-only joystick on the left side that controls forward and backward movement:

- **Position**: Lower left portion of the screen
- **Size**: 120px diameter circle (150px on tablets)
- **Visual Style**: Semi-transparent background with clear directional indicator
- **Behavior**: Returns to center when released (spring back)
- **Limitation**: Constrained to vertical movement only (Y-axis)

### Implementation

```javascript
function createMovementJoystick() {
  const joystickContainer = document.createElement('div');
  joystickContainer.id = 'movement-joystick-container';
  joystickContainer.style.cssText = `
    position: absolute;
    left: 30px;
    bottom: 100px;
    width: ${isMobilePhone() ? '120px' : '150px'};
    height: ${isMobilePhone() ? '120px' : '150px'};
    background: rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Add directional indicator
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    width: 60%;
    height: 8px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 4px;
    position: relative;
  `;
  
  // Add arrow indicators
  const upArrow = document.createElement('div');
  upArrow.style.cssText = `
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 12px solid rgba(255, 255, 255, 0.5);
  `;
  
  const downArrow = document.createElement('div');
  downArrow.style.cssText = `
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 12px solid rgba(255, 255, 255, 0.5);
  `;
  
  indicator.appendChild(upArrow);
  indicator.appendChild(downArrow);
  joystickContainer.appendChild(indicator);
  document.body.appendChild(joystickContainer);
  
  // Initialize joystick using nipplejs library
  const joystick = nipplejs.create({
    zone: joystickContainer,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: 'rgba(255, 255, 255, 0.3)',
    size: isMobilePhone() ? 100 : 130,
    lockY: false,  // Allow only vertical movement
    lockX: true    // Lock horizontal movement
  });
  
  // Handle movement - only use Y component (forward/backward)
  joystick.on('move', (evt, data) => {
    // Extract only the Y component (forward/backward)
    // Forward is UP on the joystick, backward is DOWN
    const forward = -Math.cos(data.angle.radian) * data.force;
    
    // Only send values between -1 and 1
    const clampedForward = Math.max(-1, Math.min(1, forward));
    
    // Send to game engine - matches W/S keys
    gameEngine.setForwardMovement(clampedForward);
  });
  
  joystick.on('end', () => {
    // Stop movement when joystick is released
    gameEngine.setForwardMovement(0);
  });
  
  return joystick;
}
```

## 2. Action Buttons (Boost & Speed Control)

### Design

Two distinct buttons positioned above the movement joystick:

#### Boost Button
- **Function**: Temporary speed increase (like a nitro boost)
- **Position**: Above the joystick
- **Size**: 70×70px (100×100px on tablets)
- **Visual**: Rocket or lightning icon
- **Behavior**: Cooldown after use, visual feedback during cooldown

#### Speed Toggle Button
- **Function**: Toggle between different speed modes (slow/medium/fast)
- **Position**: Above the boost button
- **Size**: 70×70px (100×100px on tablets)
- **Visual**: Speedometer icon with current speed indicator
- **Behavior**: Cycles through speed modes with each tap

### Implementation

```javascript
function createActionButtons() {
  const buttonSize = isMobilePhone() ? '70px' : '100px';
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'action-buttons';
  buttonContainer.style.cssText = `
    position: absolute;
    left: 30px;
    bottom: ${isMobilePhone() ? '240px' : '270px'};
    display: flex;
    flex-direction: column;
    gap: 20px;
    z-index: 1000;
  `;
  
  // Create boost button
  const boostButton = document.createElement('div');
  boostButton.id = 'boost-button';
  boostButton.className = 'action-button';
  boostButton.style.cssText = `
    width: ${buttonSize};
    height: ${buttonSize};
    background: rgba(255, 100, 50, 0.4);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  `;
  
  // Add rocket icon SVG
  boostButton.innerHTML = `
    <svg width="50%" height="50%" viewBox="0 0 24 24" fill="white">
      <path d="M12,2C12,2 7,4 7,12C7,15.1 7.76,17.75 8.67,19.83C9.58,21.91 10.67,23 12,23C13.33,23 14.42,21.91 15.33,19.83C16.24,17.75 17,15.1 17,12C17,4 12,2 12,2Z" />
    </svg>
    <div id="boost-cooldown" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(0,0,0,0.5); clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 50% 0%); transform: rotate(0deg); display: none;"></div>
  `;
  
  // Create speed toggle button
  const speedButton = document.createElement('div');
  speedButton.id = 'speed-button';
  speedButton.className = 'action-button';
  speedButton.setAttribute('data-speed', '1'); // Default medium speed
  speedButton.style.cssText = `
    width: ${buttonSize};
    height: ${buttonSize};
    background: rgba(50, 150, 255, 0.4);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  `;
  
  // Add speedometer icon SVG
  speedButton.innerHTML = `
    <svg width="50%" height="50%" viewBox="0 0 24 24" fill="white">
      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M16.95,8.17L16.17,8.95L12.93,12.19L12.92,12.2L11.73,11L16.95,8.17Z" />
    </svg>
    <div id="speed-indicator" style="position: absolute; bottom: 5px; width: 50%; height: 5px; background: white; border-radius: 2px;"></div>
  `;
  
  // Add buttons to container
  buttonContainer.appendChild(speedButton);
  buttonContainer.appendChild(boostButton);
  document.body.appendChild(buttonContainer);
  
  // Set up event handlers
  setupBoostButton(boostButton);
  setupSpeedButton(speedButton);
  
  return { boostButton, speedButton };
}

function setupBoostButton(button) {
  let boostCooldown = false;
  const cooldownTime = 5000; // 5 seconds cooldown
  const cooldownDisplay = button.querySelector('#boost-cooldown');
  
  button.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    if (boostCooldown) return; // Still in cooldown
    
    // Apply boost effect
    gameEngine.applyBoost(2.0, 2000); // 2x speed for 2 seconds
    button.style.background = 'rgba(255, 150, 50, 0.7)'; // Visual feedback
    
    // Start cooldown
    boostCooldown = true;
    cooldownDisplay.style.display = 'block';
    
    // Animate cooldown timer (circular progress)
    const startTime = Date.now();
    const animateCooldown = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / cooldownTime);
      
      // Update cooldown display (circular progress)
      const angle = 360 * progress;
      cooldownDisplay.style.clipPath = `polygon(50% 50%, 50% 0%, ${progress > 0.25 ? '100% 0%' : `${50 + 50 * Math.tan(angle * Math.PI / 180)}% 0%`}, ${progress > 0.5 ? '100% 100%' : '100% 100%'}, ${progress > 0.75 ? '0% 100%' : '0% 100%'}, ${progress > 0.99 ? '0% 0%' : '0% 0%'}, 50% 0%)`;
      
      if (progress < 1) {
        requestAnimationFrame(animateCooldown);
      } else {
        // Cooldown finished
        boostCooldown = false;
        cooldownDisplay.style.display = 'none';
        button.style.background = 'rgba(255, 100, 50, 0.4)';
      }
    };
    
    animateCooldown();
  });
  
  button.addEventListener('touchend', (e) => {
    e.preventDefault();
    // We don't stop the boost here - it runs for its full duration
  });
}

function setupSpeedButton(button) {
  const speedLevels = [
    { name: 'slow', value: 0.5, width: '30%' },
    { name: 'medium', value: 1.0, width: '50%' },
    { name: 'fast', value: 1.5, width: '80%' }
  ];
  let currentSpeedIndex = 1; // Start at medium speed
  const speedIndicator = button.querySelector('#speed-indicator');
  
  // Initialize with medium speed
  gameEngine.setSpeedMultiplier(speedLevels[currentSpeedIndex].value);
  speedIndicator.style.width = speedLevels[currentSpeedIndex].width;
  
  button.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    // Cycle to next speed level
    currentSpeedIndex = (currentSpeedIndex + 1) % speedLevels.length;
    const newSpeed = speedLevels[currentSpeedIndex];
    
    // Apply new speed
    gameEngine.setSpeedMultiplier(newSpeed.value);
    
    // Update visual indicator
    speedIndicator.style.width = newSpeed.width;
    
    // Visual feedback
    button.style.background = 'rgba(50, 150, 255, 0.7)';
    setTimeout(() => {
      button.style.background = 'rgba(50, 150, 255, 0.4)';
    }, 200);
  });
}
```

## 3. Right Touch Area (Camera Control)

### Design

This control functions exactly like the mouse on web, allowing players to look around by dragging:

- **Area**: Entire right side of the screen (approximately 50%)
- **Functionality**: Drag to rotate camera/change view direction
- **Visual feedback**: Subtle indicator appears at touch point
- **Sensitivity**: Adjustable based on device size

### Implementation

```javascript
function createCameraControl() {
  const touchArea = document.createElement('div');
  touchArea.id = 'camera-control';
  touchArea.style.cssText = `
    position: absolute;
    top: 0;
    right: 0;
    width: 50%;
    height: 100%;
    z-index: 900;
    touch-action: none;
  `;

  // Create visual indicator that appears on touch
  const indicator = document.createElement('div');
  indicator.id = 'camera-indicator';
  indicator.style.cssText = `
    position: absolute;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.1);
    pointer-events: none;
    display: none;
    transform: translate(-50%, -50%);
  `;
  
  // Add crosshair in center of indicator
  const crosshair = document.createElement('div');
  crosshair.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
  `;
  
  crosshair.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="white">
      <path d="M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7Z" />
    </svg>
  `;
  
  indicator.appendChild(crosshair);
  document.body.appendChild(touchArea);
  document.body.appendChild(indicator);

  // Touch tracking variables
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let isRotating = false;

  // Add event listeners
  touchArea.addEventListener('touchstart', handleTouchStart);
  touchArea.addEventListener('touchmove', handleTouchMove);
  touchArea.addEventListener('touchend', handleTouchEnd);
  
  function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    lastTouchX = touchStartX;
    lastTouchY = touchStartY;
    isRotating = true;

    // Show and position the indicator
    indicator.style.display = 'block';
    indicator.style.left = `${touchStartX}px`;
    indicator.style.top = `${touchStartY}px`;
  }

  function handleTouchMove(e) {
    if (!isRotating) return;
    e.preventDefault();

    const touch = e.touches[0];
    
    // Calculate delta from last position (not start position)
    // This allows continuous rotation when holding at screen edge
    const deltaX = touch.clientX - lastTouchX;
    const deltaY = touch.clientY - lastTouchY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;

    // Convert touch movement to rotation
    // This exactly matches mouse movement on web
    const rotationSensitivity = 0.003; // Adjust as needed
    gameEngine.rotateCameraYaw(-deltaX * rotationSensitivity);
    gameEngine.rotateCameraPitch(-deltaY * rotationSensitivity);

    // Update indicator position - with limits to keep it visible
    const maxDistanceFromStart = 100;
    const currentDistanceX = touch.clientX - touchStartX;
    const currentDistanceY = touch.clientY - touchStartY;
    const distance = Math.sqrt(currentDistanceX * currentDistanceX + currentDistanceY * currentDistanceY);
    
    if (distance > maxDistanceFromStart) {
      // If exceeded max distance, limit indicator movement
      const angle = Math.atan2(currentDistanceY, currentDistanceX);
      const limitedX = touchStartX + Math.cos(angle) * maxDistanceFromStart;
      const limitedY = touchStartY + Math.sin(angle) * maxDistanceFromStart;
      indicator.style.left = `${limitedX}px`;
      indicator.style.top = `${limitedY}px`;
    } else {
      // Otherwise, follow touch position
      indicator.style.left = `${touch.clientX}px`;
      indicator.style.top = `${touch.clientY}px`;
    }
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    isRotating = false;
    
    // Hide the indicator
    indicator.style.display = 'none';
  }
}
```

## 4. Altitude Controls

For vertical movement (ascending and descending), we'll add two dedicated buttons on the right side:

```javascript
function createAltitudeControls() {
  const buttonSize = isMobilePhone() ? '70px' : '100px';
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'altitude-buttons';
  buttonContainer.style.cssText = `
    position: absolute;
    right: 30px;
    bottom: 100px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    z-index: 1000;
  `;
  
  // Create ascend button
  const ascendButton = document.createElement('div');
  ascendButton.id = 'ascend-button';
  ascendButton.className = 'altitude-button';
  ascendButton.style.cssText = `
    width: ${buttonSize};
    height: ${buttonSize};
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  `;
  
  // Add up arrow icon
  ascendButton.innerHTML = `
    <svg width="50%" height="50%" viewBox="0 0 24 24" fill="white">
      <path d="M7,15L12,10L17,15H7Z" />
    </svg>
  `;
  
  // Create descend button
  const descendButton = document.createElement('div');
  descendButton.id = 'descend-button';
  descendButton.className = 'altitude-button';
  descendButton.style.cssText = ascendButton.style.cssText;
  
  // Add down arrow icon
  descendButton.innerHTML = `
    <svg width="50%" height="50%" viewBox="0 0 24 24" fill="white">
      <path d="M7,10L12,15L17,10H7Z" />
    </svg>
  `;
  
  // Add buttons to container
  buttonContainer.appendChild(ascendButton);
  buttonContainer.appendChild(descendButton);
  document.body.appendChild(buttonContainer);
  
  // Set up event handlers
  setupAltitudeButton(ascendButton, 1);  // Up
  setupAltitudeButton(descendButton, -1); // Down
}

function setupAltitudeButton(button, direction) {
  button.addEventListener('touchstart', (e) => {
    e.preventDefault();
    gameEngine.setVerticalMovement(direction);
    button.style.background = 'rgba(255, 255, 255, 0.5)';
  });
  
  button.addEventListener('touchend', (e) => {
    e.preventDefault();
    gameEngine.setVerticalMovement(0);
    button.style.background = 'rgba(255, 255, 255, 0.3)';
  });
  
  // Also handle touch cancel event (e.g., when notifications appear)
  button.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    gameEngine.setVerticalMovement(0);
    button.style.background = 'rgba(255, 255, 255, 0.3)';
  });
}
```

## 5. Game Engine Integration

To connect these UI elements with the game functionality, add these methods to your player control system:

```javascript
// In PlayerInput.js or similar file

// Forward/backward movement (from joystick)
setForwardMovement(value) {
  this.movementZ = value; // -1 to 1 range
}

// Vertical movement (from altitude buttons)
setVerticalMovement(value) {
  this.movementY = value; // -1, 0, or 1
}

// Camera rotation (from right touch area)
rotateCameraYaw(amount) {
  this.playerSystem.localPlayer.rotation.y += amount;
}

rotateCameraPitch(amount) {
  // Apply with limits to prevent flipping over
  const newPitch = this.playerSystem.localPlayer.rotation.x + amount;
  this.playerSystem.localPlayer.rotation.x = Math.max(-0.8, Math.min(0.8, newPitch));
}

// Speed control (from speed button)
setSpeedMultiplier(value) {
  this.speedMultiplier = value; // 0.5, 1.0, or 1.5
}

// Boost (from boost button)
applyBoost(multiplier, duration) {
  this.boostActive = true;
  this.boostMultiplier = multiplier;
  
  // Store normal speed to restore later
  const normalSpeed = this.speedMultiplier;
  
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

// In the update method, apply all movement factors
update(delta) {
  if (!this.playerSystem.localPlayer) return;
  
  // Calculate final speed with all multipliers
  const finalSpeedMultiplier = this.speedMultiplier * (this.boostActive ? this.boostMultiplier : 1.0);
  
  // Apply forward/backward movement
  if (this.movementZ !== 0) {
    // Convert to direction vector based on carpet orientation
    const direction = new THREE.Vector3(0, 0, this.movementZ).applyQuaternion(
      this.playerSystem.localPlayer.quaternion
    );
    
    // Apply speed and delta time
    const speed = 300 * finalSpeedMultiplier * delta;
    this.playerSystem.localPlayer.position.add(direction.multiplyScalar(speed));
  }
  
  // Apply vertical movement
  if (this.movementY !== 0) {
    const verticalSpeed = 150 * delta;
    this.playerSystem.localPlayer.position.y += this.movementY * verticalSpeed;
  }
}
```

## 6. Full Control Initialization

```javascript
function initializeMobileControls() {
  // Only initialize on mobile devices
  if (!isMobile()) return;
  
  // Create all control elements
  const movementJoystick = createMovementJoystick();
  const actionButtons = createActionButtons();
  const cameraControl = createCameraControl();
  const altitudeControls = createAltitudeControls();
  
  // Listen for orientation changes
  window.addEventListener('orientationchange', () => {
    // Give time for orientation change to complete
    setTimeout(adjustControlsForOrientation, 300);
  });
  
  // Initial adjustment
  adjustControlsForOrientation();
}

function adjustControlsForOrientation() {
  const isLandscape = window.innerWidth > window.innerHeight;
  
  // Adjust controls based on orientation
  if (isLandscape) {
    // Standard positioning for landscape
    document.getElementById('movement-joystick-container').style.bottom = '80px';
    document.getElementById('action-buttons').style.bottom = 
      isMobilePhone() ? '220px' : '250px';
    document.getElementById('altitude-buttons').style.bottom = '80px';
  } else {
    // Adjusted positioning for portrait
    document.getElementById('movement-joystick-container').style.bottom = '120px';
    document.getElementById('action-buttons').style.bottom = 
      isMobilePhone() ? '260px' : '290px';
    document.getElementById('altitude-buttons').style.bottom = '120px';
  }
}
```

## Device Detection Helpers

```javascript
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

function isMobilePhone() {
  if (!isMobile()) return false;
  
  // Check if it's a phone (smaller screen) vs tablet
  const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
  return smallerDimension < 768; // Common breakpoint for tablets
}
```

## Implementation Summary

This control scheme provides a comprehensive mobile experience that matches the web version's functionality:

1. **Forward/Backward Movement**: Vertical-only joystick on left
2. **Speed Control**: Dedicated button that cycles through speed modes
3. **Boost**: Temporary speed increase with cooldown
4. **Camera Control**: Touch area on right that works like mouse movement
5. **Altitude Control**: Up/down buttons on right side

The controls are:
- Responsive to different device sizes
- Adaptable to orientation changes
- Provide clear visual feedback
- Match the web version's functionality
- Optimized for one-handed play in landscape mode

This implementation ensures that mobile players have the full Magical Carpet experience while enjoying intuitive touch controls that work well on smaller screens.
