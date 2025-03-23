export class MobileUI {
    constructor(engine) {
        this.engine = engine || { qualityManager: { uiAnimationLevel: 'low' } };
        this.uiElements = new Map();
        this.visibleElements = new Set();
        this.touchElements = new Map();
        this.elementPool = new Map(); // For UI component pooling
        this.batterySaving = false;
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
        this.orientationLayout = this.screenWidth > this.screenHeight ? 'landscape' : 'portrait';
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.hasHapticFeedback = 'vibrate' in navigator;
        this.isDeviceSmall = Math.min(this.screenWidth, this.screenHeight) < 600;
        
        // Ensure consistent state
        this.frameCounter = 0;
        this.batteryUpdateFrequency = 1;
        
        // Optimize sizes based on screen size for better touch targets
        this.sizes = {
            buttonSize: this.isDeviceSmall ? 70 : 80, // Larger buttons on small devices
            joystickSize: this.isDeviceSmall ? 130 : 150,
            healthBarWidth: Math.min(320, this.screenWidth * 0.6),
            spacing: this.isDeviceSmall ? 10 : 15,
        };
        
        // Track memory usage
        this.memoryUsage = {
            elementsCreated: 0,
            activeElements: 0,
            poolSize: 0
        };
        
        // Current UI visibility state
        this.visible = true;
        
        // Register window resize event
        window.addEventListener('resize', this.onResize.bind(this));
    }
    
    // Control buttons for manual carpet movement (no auto-movement)

    initialize() {
        this.createUIContainer();
        
        // Create essential controls
        this.createSimpleControls();
        this.createBatterySavingToggle();
        
        // Setup invisible camera controls for right-side of screen
        this.setupCameraControls();
        
        // Ensure the minimap is visible on mobile
        this.ensureMobileMinimapVisibility();
        
        console.log("Mobile UI initialized with simplified user controls");
    }
    
    createUIContainer() {
        // Main container for all UI elements
        const container = document.createElement('div');
        container.id = 'mobile-ui-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            touch-action: none;
        `;
        document.body.appendChild(container);
        this.uiElements.set('container', container);
        this.uiContainer = container;
        
        // Apply a viewport height fix for mobile browsers
        // This addresses the issue with 100vh on mobile browsers
        const setViewportHeight = () => {
            document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
            container.style.height = 'calc(var(--vh, 1vh) * 100)';
        };
        
        window.addEventListener('resize', setViewportHeight);
        setViewportHeight();
    }
    
    // Helper to check if a touch is on another UI element
    touchOnUIElement(e) {
        const touch = e.changedTouches[0];
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        // Check each UI element with 'button' or 'toggle' type
        for (const [id, info] of this.touchElements.entries()) {
            if (info.type === 'button' || info.type === 'toggle') {
                const elem = info.element;
                if (!elem) continue;
                
                const rect = elem.getBoundingClientRect();
                
                // Check if touch is within element boundaries
                if (touchX >= rect.left && touchX <= rect.right && 
                    touchY >= rect.top && touchY <= rect.bottom) {
                    return true; // Touch is on a UI element
                }
            }
        }
        
        return false; // Touch is not on any UI element
    }
    
    // Setup invisible camera controls (full screen, no visible division)
    setupCameraControls() {
        // Camera control area (full screen)
        const cameraControls = this.getElementFromPool('div') || document.createElement('div');
        cameraControls.id = 'camera-controls';
        cameraControls.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%; /* Full screen */
            height: 100%;
            z-index: 500; /* Below other UI controls */
            pointer-events: auto;
            touch-action: none;
            user-select: none;
        `;
        
        // Camera control state
        this.cameraState = {
            active: false,
            lastX: 0,
            lastY: 0,
            deltaX: 0,
            deltaY: 0,
            touchId: null,
            startX: 0,  // Track start position to determine if it's a tap
            startY: 0
        };
        
        // Add touch events for camera control
        cameraControls.addEventListener('touchstart', (e) => {
            // Check if touch is on a UI element - if so, don't handle it here
            if (this.touchOnUIElement(e)) return;
            
            e.preventDefault(); // Prevent default to avoid scrolling
            if (this.cameraState.active) return;
            
            const touch = e.changedTouches[0];
            this.cameraState.touchId = touch.identifier;
            this.cameraState.active = true;
            this.cameraState.lastX = touch.clientX;
            this.cameraState.lastY = touch.clientY;
            this.cameraState.startX = touch.clientX;
            this.cameraState.startY = touch.clientY;
            this.cameraState.deltaX = 0;
            this.cameraState.deltaY = 0;
        });
        
        cameraControls.addEventListener('touchmove', (e) => {
            if (!this.cameraState.active) return;
            e.preventDefault(); // Prevent scrolling
            
            // Find our touch
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.cameraState.touchId) {
                    // Calculate delta movement
                    const deltaX = touch.clientX - this.cameraState.lastX;
                    const deltaY = touch.clientY - this.cameraState.lastY;
                    
                    // Update last position
                    this.cameraState.lastX = touch.clientX;
                    this.cameraState.lastY = touch.clientY;
                    
                    // Set current delta - increase multiplier for more sensitivity
                    this.cameraState.deltaX = deltaX * 1.0; // Increased sensitivity
                    this.cameraState.deltaY = deltaY * 1.0; // Increased sensitivity
                    
                    // Emit camera movement event
                    if (this.engine && this.engine.input) {
                        this.engine.input.emit('mobileCameraMove', {
                            deltaX: this.cameraState.deltaX,
                            deltaY: this.cameraState.deltaY
                        });
                    }
                    
                    break;
                }
            }
        });
        
        const endCameraTouch = (e) => {
            if (!this.cameraState.active) return;
            e.preventDefault(); // Prevent default
            
            // Find our touch
            let found = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.cameraState.touchId) {
                    found = true;
                    
                    // Check if it was a tap (minimal movement) - can use for firing/selection
                    const distMoved = Math.sqrt(
                        Math.pow(touch.clientX - this.cameraState.startX, 2) +
                        Math.pow(touch.clientY - this.cameraState.startY, 2)
                    );
                    
                    if (distMoved < 10) { // If less than 10px movement, consider it a tap
                        // Emit tap event if needed
                        if (this.engine && this.engine.input) {
                            this.engine.input.emit('mobileTap', {
                                x: touch.clientX,
                                y: touch.clientY
                            });
                        }
                    }
                    
                    break;
                }
            }
            
            if (found) {
                // Reset camera control state
                this.cameraState.active = false;
                this.cameraState.touchId = null;
                this.cameraState.deltaX = 0;
                this.cameraState.deltaY = 0;
                
                // Emit camera stop event
                if (this.engine && this.engine.input) {
                    this.engine.input.emit('mobileCameraMove', {
                        deltaX: 0,
                        deltaY: 0
                    });
                }
            }
        };
        
        cameraControls.addEventListener('touchend', endCameraTouch);
        cameraControls.addEventListener('touchcancel', endCameraTouch);
        
        this.uiContainer.appendChild(cameraControls);
        this.uiElements.set('cameraControls', cameraControls);
        this.visibleElements.add('cameraControls');
        this.memoryUsage.activeElements += 1;
    }
    
    // Create simple control buttons
    createSimpleControls() {
        // Container for the controls
        const controlsContainer = this.getElementFromPool('div') || document.createElement('div');
        controlsContainer.id = 'simple-controls';
        controlsContainer.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            z-index: 1000;
            pointer-events: none;
        `;

        // Create the forward (W) button
        const forwardButton = this.getElementFromPool('div') || document.createElement('div');
        forwardButton.id = 'forward-button';
        forwardButton.style.cssText = `
            width: 80px;
            height: 80px;
            background: rgba(30, 144, 255, 0.3);
            border: 2px solid rgba(255, 255, 255, 0.6);
            border-radius: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 30px;
            pointer-events: auto;
            text-shadow: 0 0 4px rgba(0, 0, 0, 0.7);
            user-select: none;
        `;
        forwardButton.textContent = 'W';

        // Create the backward (S) button
        const backwardButton = this.getElementFromPool('div') || document.createElement('div');
        backwardButton.id = 'backward-button';
        backwardButton.style.cssText = `
            width: 80px;
            height: 80px;
            background: rgba(160, 160, 160, 0.3);
            border: 2px solid rgba(255, 255, 255, 0.6);
            border-radius: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 30px;
            pointer-events: auto;
            text-shadow: 0 0 4px rgba(0, 0, 0, 0.7);
            user-select: none;
        `;
        backwardButton.textContent = 'S';
        
        // Add touch events for forward button (W key)
        forwardButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            forwardButton.style.background = 'rgba(30, 144, 255, 0.7)';
            
            // Press W key
            if (this.engine && this.engine.input && this.engine.input.keys) {
                this.engine.input.keys['KeyW'] = true;
                this.engine.input.keys['KeyS'] = false; // Make sure S is not pressed
            }
            
            // Also set throttle directly in PlayerInput
            if (this.engine && this.engine.systems && this.engine.systems.player && 
                this.engine.systems.player.input) {
                this.engine.systems.player.input.currentThrottle = 1.0;
            }
            
            // Provide haptic feedback
            this.triggerHapticFeedback('button');
        });
        
        forwardButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            forwardButton.style.background = 'rgba(30, 144, 255, 0.3)';
            
            // Release W key
            if (this.engine && this.engine.input && this.engine.input.keys) {
                this.engine.input.keys['KeyW'] = false;
            }
            
            // Also reset throttle in PlayerInput
            if (this.engine && this.engine.systems && this.engine.systems.player && 
                this.engine.systems.player.input) {
                this.engine.systems.player.input.currentThrottle = 0.0;
            }
        });
        
        // Add touch events for backward button (S key)
        backwardButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            backwardButton.style.background = 'rgba(160, 160, 160, 0.7)';
            
            // Press S key
            if (this.engine && this.engine.input && this.engine.input.keys) {
                this.engine.input.keys['KeyS'] = true;
                this.engine.input.keys['KeyW'] = false; // Make sure W is not pressed
            }
            
            // Provide haptic feedback
            this.triggerHapticFeedback('button');
        });
        
        backwardButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            backwardButton.style.background = 'rgba(160, 160, 160, 0.3)';
            
            // Release S key
            if (this.engine && this.engine.input && this.engine.input.keys) {
                this.engine.input.keys['KeyS'] = false;
            }
        });
        
        // Create the wrapper div for W and S buttons (vertical layout)
        const wsButtonsWrapper = this.getElementFromPool('div') || document.createElement('div');
        wsButtonsWrapper.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        
        wsButtonsWrapper.appendChild(forwardButton);
        wsButtonsWrapper.appendChild(backwardButton);
        
        // Add buttons to the container
        controlsContainer.appendChild(wsButtonsWrapper);
        // Boost button removed
        
        // Add container to the UI
        this.uiContainer.appendChild(controlsContainer);
        
        // Store references
        this.uiElements.set('controlsContainer', controlsContainer);
        this.uiElements.set('forwardButton', forwardButton);
        this.uiElements.set('backwardButton', backwardButton);
        this.visibleElements.add('controlsContainer');
        
        // Register touch elements
        this.touchElements.set('forward-button', {
            element: forwardButton,
            type: 'button',
            action: 'forward'
        });
        
        this.touchElements.set('backward-button', {
            element: backwardButton,
            type: 'button',
            action: 'backward'
        });
        
        this.memoryUsage.activeElements += 3; // Reduced from 4 (removed boost button)
    }
    
    createBatterySavingToggle() {
        const toggleContainer = this.getElementFromPool('div') || document.createElement('div');
        toggleContainer.id = 'battery-toggle';
        toggleContainer.style.cssText = `
            position: fixed;
            top: ${this.sizes.spacing}px;
            right: ${this.sizes.spacing}px;
            display: flex;
            align-items: center;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 20px;
            padding: 4px 8px;
            z-index: 1000;
            pointer-events: auto;
        `;
        
        const label = this.getElementFromPool('div') || document.createElement('div');
        label.textContent = 'Power Save';
        label.style.cssText = `
            color: white;
            font-size: 12px;
            margin-right: 5px;
        `;
        
        const toggle = this.getElementFromPool('div') || document.createElement('div');
        toggle.style.cssText = `
            width: 30px;
            height: 16px;
            background: #555;
            border-radius: 8px;
            position: relative;
            transition: background 0.3s;
        `;
        
        const toggleHandle = this.getElementFromPool('div') || document.createElement('div');
        toggleHandle.style.cssText = `
            position: absolute;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: white;
            top: 2px;
            left: 2px;
            transition: transform 0.3s;
        `;
        
        toggle.appendChild(toggleHandle);
        toggleContainer.appendChild(label);
        toggleContainer.appendChild(toggle);
        
        this.uiContainer.appendChild(toggleContainer);
        this.uiElements.set('batterySaver', toggleContainer);
        this.uiElements.set('batterySaverToggle', toggle);
        this.uiElements.set('batterySaverHandle', toggleHandle);
        this.visibleElements.add('batterySaver');
        this.memoryUsage.activeElements += 3;
        
        // Add touch event
        toggle.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.toggleBatterySavingMode();
            this.triggerHapticFeedback('toggle');
        });
        
        // Register in touchElements map
        this.touchElements.set('battery-toggle', {
            element: toggle,
            type: 'toggle',
            action: 'battery'
        });
    }
    
    ensureMobileMinimapVisibility() {
        // This method ensures the minimap is visible on mobile
        setTimeout(() => {
            // Get the minimap container created by MinimapSystem
            const minimapContainer = document.getElementById('minimap-container');
            
            if (minimapContainer) {
                // Set explicit styles to ensure visibility
                minimapContainer.style.position = 'absolute';
                minimapContainer.style.top = '10px';
                minimapContainer.style.left = '10px';
                minimapContainer.style.width = '100px';
                minimapContainer.style.height = '100px';
                minimapContainer.style.zIndex = '1500'; // Higher z-index to ensure visibility
                minimapContainer.style.display = 'block'; // Force display
                minimapContainer.style.opacity = '1'; // Ensure it's not transparent
                minimapContainer.style.visibility = 'visible'; // Ensure it's not hidden
                
                console.log('Mobile minimap visibility enforced');
            } else {
                console.warn('Minimap container not found, creating it manually');
                
                // If the minimap container doesn't exist, create it temporarily
                const tempContainer = document.createElement('div');
                tempContainer.id = 'minimap-container';
                tempContainer.style.cssText = `
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    overflow: hidden;
                    background-color: rgba(0, 0, 20, 0.5);
                    border: 2px solid rgba(255, 255, 255, 0.5);
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                    z-index: 1500;
                    display: block;
                    opacity: 1;
                    visibility: visible;
                `;
                
                // Add it to the UI container
                this.uiContainer.appendChild(tempContainer);
                
                // It will be replaced when MinimapSystem initializes
            }
        }, 1000); // Delay execution to ensure the minimap system has initialized
    }
    
    toggleBatterySavingMode() {
        this.batterySaving = !this.batterySaving;
        
        // Update toggle appearance
        const toggle = this.uiElements.get('batterySaverToggle');
        const handle = this.uiElements.get('batterySaverHandle');
        
        if (this.batterySaving) {
            toggle.style.background = '#4CAF50';
            handle.style.transform = 'translateX(16px)';
            
            // Apply battery saving techniques
            this.applyBatterySavingMode(true);
        } else {
            toggle.style.background = '#555';
            handle.style.transform = 'translateX(0)';
            
            // Remove battery saving mode
            this.applyBatterySavingMode(false);
        }
    }
    
    applyBatterySavingMode(enabled) {
        // Apply UI-specific battery saving techniques
        if (enabled) {
            // Reduce animations
            document.documentElement.style.setProperty('--ui-animation-speed', '0.5');
            
            // Disable blur effects for better performance
            this.uiElements.forEach((element) => {
                if (element.style && element.style.backdropFilter) {
                    element.style.backdropFilter = 'none';
                }
                if (element.style && element.style.boxShadow) {
                    element.style.boxShadow = 'none';
                }
            });
            
            // Reduce update frequency for non-critical elements
            this.batteryUpdateFrequency = 3; // Update less frequently
        } else {
            // Restore normal animations
            document.documentElement.style.setProperty('--ui-animation-speed', '1');
            
            // Restore normal update frequency
            this.batteryUpdateFrequency = 1;
        }
        
        // Notify engine about battery saving mode
        if (this.engine) {
            if (typeof this.engine.setBatterySavingMode === 'function') {
                this.engine.setBatterySavingMode(enabled);
            } else if (this.engine.qualityManager) {
                // Adjust quality settings directly if the API isn't available
                this.engine.qualityManager.targetFPS = enabled ? 30 : 60;
            }
        }
    }
    
    // Haptic feedback with battery saving consideration
    triggerHapticFeedback(type) {
        if (!this.hasHapticFeedback || this.batterySaving) return;
        
        // Different vibration patterns for different interactions
        switch (type) {
            case 'button':
                navigator.vibrate(20);
                break;
            case 'toggle':
                navigator.vibrate(15);
                break;
            case 'boost':
                navigator.vibrate([20, 30, 40]); // Pattern for boost
                break;
            default:
                navigator.vibrate(25);
        }
    }
    
    onResize() {
        // Update screen dimensions
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
    }
    
    // Pooling system for memory efficiency
    getElementFromPool(type) {
        if (!this.elementPool.has(type)) {
            this.elementPool.set(type, []);
        }
        
        const pool = this.elementPool.get(type);
        
        if (pool.length > 0) {
            const element = pool.pop();
            this.memoryUsage.poolSize--;
            return element;
        }
        
        this.memoryUsage.elementsCreated++;
        return null;
    }
    
    returnElementToPool(element) {
        if (!element) return;
        
        // Reset element
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
        
        element.className = '';
        element.id = '';
        element.textContent = '';
        element.innerHTML = '';
        
        // Clear all inline styles
        element.removeAttribute('style');
        
        // Remove all event listeners
        element.replaceWith(element.cloneNode(false));
        
        // Add to appropriate pool
        const tagName = element.tagName.toLowerCase();
        if (!this.elementPool.has(tagName)) {
            this.elementPool.set(tagName, []);
        }
        
        this.elementPool.get(tagName).push(element);
        this.memoryUsage.poolSize++;
        this.memoryUsage.activeElements--;
    }
    
    // Public update method called from game loop
    update(delta, player) {
        try {
            // Initialize counter if needed
            if (this.frameCounter === undefined) {
                this.frameCounter = 0;
            }
            
            // Skip updates in battery saving mode to reduce CPU usage
            if (this.batterySaving && (this.frameCounter++ % (this.batteryUpdateFrequency || 1) !== 0)) {
                return;
            }
            
            // Check minimap visibility periodically (every 60 frames)
            if (this.frameCounter % 60 === 0) {
                const minimapContainer = document.getElementById('minimap-container');
                if (minimapContainer && (minimapContainer.style.display === 'none' || !minimapContainer.isConnected)) {
                    // Re-enforce visibility if needed
                    this.ensureMobileMinimapVisibility();
                }
            }
        } catch (error) {
            console.warn('Error updating mobile UI:', error);
        }
    }

    dispose() {
        // Return all elements to pool
        this.uiElements.forEach((element) => {
            // Only return if element exists
            if (element && element.parentNode) {
                this.returnElementToPool(element);
            }
        });
        
        // Clear collections
        this.uiElements.clear();
        this.visibleElements.clear();
        this.touchElements.clear();
        
        // Remove event listeners
        window.removeEventListener('resize', this.onResize);
        
        console.log("Mobile UI disposed with memory stats:", this.memoryUsage);
    }
}