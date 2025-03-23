import nipplejs from 'nipplejs';

export class TouchInputManager {
    constructor(engine) {
        this.engine = engine;
        this.moveJoystick = null;
        this.cameraControl = null;
        this.speedButton = null;
        this.boostButton = null;
        this.ascendButton = null;
        this.descendButton = null;
        
        // Input state tracking
        this.moveData = { forward: 0 };
        this.cameraData = { deltaX: 0, deltaY: 0, active: false };
        this.verticalControl = 0;
        this.speedMultiplier = 1.0; // Default medium speed
        this.boostActive = false;
        
        // Cooldown and animation tracking
        this.boostCooldown = false;
        this.boostCooldownTime = 5000; // 5 seconds
        this.boostCooldownDisplay = null;
        this.boostTimeout = null;
        
        // Device detection
        this.device = this.detectDeviceType();
        
        // Gesture tracking
        this.gestureDetection = {
            enabled: true,
            doubleTapTime: 300,  // ms between taps for double-tap
            lastTapTime: 0,
            tapPosition: { x: 0, y: 0 },
            doubleTapCallback: null
        };
        
        // Battery saving mode
        this.batterySavingMode = false;
    }

    async initialize() {
        try {
            console.log('Initializing revised mobile touch controls...');
            
            // Create all UI elements
            this.createMovementJoystick();
            this.createActionButtons();
            this.createCameraControl();
            this.createAltitudeControls();
            
            // Set up orientation change handler
            window.addEventListener('orientationchange', () => {
                // Give time for orientation change to complete
                setTimeout(() => this.adjustControlsForOrientation(), 300);
            });
            
            // Set up touch gesture detection
            this.setupTouchGestures();
            
            // Initial adjustment for current orientation
            this.adjustControlsForOrientation();
            
            console.log('Mobile touch controls initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing mobile touch controls:', error);
            return false;
        }
    }

    detectDeviceType() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const smallerDimension = Math.min(width, height);
        
        return {
            type: smallerDimension < 600 ? 'phone' : 'tablet',
            isPhone: smallerDimension < 600,
            isTablet: smallerDimension >= 600,
            isLandscape: width > height,
            screenWidth: width,
            screenHeight: height
        };
    }

    isMobilePhone() {
        return this.device.isPhone;
    }

    createMovementJoystick() {
        try {
            const joystickContainer = document.createElement('div');
            joystickContainer.id = 'movement-joystick-container';
            joystickContainer.style.cssText = `
                position: absolute;
                left: 30px;
                bottom: 100px;
                width: ${this.isMobilePhone() ? '120px' : '150px'};
                height: ${this.isMobilePhone() ? '120px' : '150px'};
                background: rgba(255, 255, 255, 0.15);
                border-radius: 50%;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                touch-action: none;
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
            this.moveJoystick = nipplejs.create({
                zone: joystickContainer,
                mode: 'static',
                position: { left: '50%', top: '50%' },
                color: 'rgba(255, 255, 255, 0.3)',
                size: this.isMobilePhone() ? 100 : 130,
                lockY: false,  // Allow only vertical movement
                lockX: true    // Lock horizontal movement
            });
            
            // Handle movement - only use Y component (forward/backward)
            this.moveJoystick.on('move', (evt, data) => {
                // Extract only the Y component (forward/backward)
                // Forward is UP on the joystick, backward is DOWN
                const forward = -Math.cos(data.angle.radian) * data.force;
                
                // Only send values between -1 and 1
                const clampedForward = Math.max(-1, Math.min(1, forward));
                
                // Update move data
                this.moveData.forward = clampedForward;
            });
            
            this.moveJoystick.on('end', () => {
                // Stop movement when joystick is released
                this.moveData.forward = 0;
            });
            
            console.log('Movement joystick created successfully');
        } catch (error) {
            console.error('Error creating movement joystick:', error);
        }
    }

    createActionButtons() {
        try {
            const buttonSize = this.isMobilePhone() ? '70px' : '100px';
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'action-buttons';
            buttonContainer.style.cssText = `
                position: absolute;
                left: 30px;
                bottom: ${this.isMobilePhone() ? '240px' : '270px'};
                display: flex;
                flex-direction: column;
                gap: 20px;
                z-index: 1000;
                touch-action: none;
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
                touch-action: none;
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
                touch-action: none;
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
            
            // Store references for later use
            this.boostButton = boostButton;
            this.speedButton = speedButton;
            this.boostCooldownDisplay = boostButton.querySelector('#boost-cooldown');
            
            // Set up event handlers
            this.setupBoostButton(boostButton);
            this.setupSpeedButton(speedButton);
            
            console.log('Action buttons created successfully');
        } catch (error) {
            console.error('Error creating action buttons:', error);
        }
    }

    setupBoostButton(button) {
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            if (this.boostCooldown) return; // Still in cooldown
            
            // Apply boost effect
            this.applyBoost(2.0, 2000); // 2x speed for 2 seconds
            button.style.background = 'rgba(255, 150, 50, 0.7)'; // Visual feedback
            
            // Start cooldown
            this.boostCooldown = true;
            this.boostCooldownDisplay.style.display = 'block';
            
            // Animate cooldown timer (circular progress)
            const startTime = Date.now();
            const animateCooldown = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1, elapsed / this.boostCooldownTime);
                
                // Update cooldown display (circular progress)
                const angle = 360 * progress;
                this.boostCooldownDisplay.style.clipPath = `polygon(50% 50%, 50% 0%, ${progress > 0.25 ? '100% 0%' : `${50 + 50 * Math.tan(angle * Math.PI / 180)}% 0%`}, ${progress > 0.5 ? '100% 100%' : '100% 100%'}, ${progress > 0.75 ? '0% 100%' : '0% 100%'}, ${progress > 0.99 ? '0% 0%' : '0% 0%'}, 50% 0%)`;
                
                if (progress < 1) {
                    requestAnimationFrame(animateCooldown);
                } else {
                    // Cooldown finished
                    this.boostCooldown = false;
                    this.boostCooldownDisplay.style.display = 'none';
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

    setupSpeedButton(button) {
        const speedLevels = [
            { name: 'slow', value: 0.5, width: '30%' },
            { name: 'medium', value: 1.0, width: '50%' },
            { name: 'fast', value: 1.5, width: '80%' }
        ];
        let currentSpeedIndex = 1; // Start at medium speed
        const speedIndicator = button.querySelector('#speed-indicator');
        
        // Initialize with medium speed
        this.speedMultiplier = speedLevels[currentSpeedIndex].value;
        speedIndicator.style.width = speedLevels[currentSpeedIndex].width;
        
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            // Cycle to next speed level
            currentSpeedIndex = (currentSpeedIndex + 1) % speedLevels.length;
            const newSpeed = speedLevels[currentSpeedIndex];
            
            // Apply new speed
            this.speedMultiplier = newSpeed.value;
            
            // Update visual indicator
            speedIndicator.style.width = newSpeed.width;
            
            // Visual feedback
            button.style.background = 'rgba(50, 150, 255, 0.7)';
            setTimeout(() => {
                button.style.background = 'rgba(50, 150, 255, 0.4)';
            }, 200);
        });
    }

    createCameraControl() {
        try {
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
            
            // Store camera control reference
            this.cameraControl = touchArea;
            this.cameraIndicator = indicator;
            
            // Touch event handlers (using function declarations for proper 'this' binding)
            const self = this;
            
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
                
                // Set camera active state
                self.cameraData.active = true;
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
                
                // Update camera data for rotation
                self.cameraData.deltaX = deltaX;
                self.cameraData.deltaY = deltaY;
                
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
                
                // Reset camera data
                self.cameraData.active = false;
                self.cameraData.deltaX = 0;
                self.cameraData.deltaY = 0;
            }
            
            console.log('Camera control created successfully');
        } catch (error) {
            console.error('Error creating camera control:', error);
        }
    }

    createAltitudeControls() {
        try {
            const buttonSize = this.isMobilePhone() ? '70px' : '100px';
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
                touch-action: none;
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
                touch-action: none;
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
            
            // Store button references
            this.ascendButton = ascendButton;
            this.descendButton = descendButton;
            
            // Set up event handlers
            this.setupAltitudeButton(ascendButton, 1);  // Up
            this.setupAltitudeButton(descendButton, -1); // Down
            
            console.log('Altitude controls created successfully');
        } catch (error) {
            console.error('Error creating altitude controls:', error);
        }
    }

    setupAltitudeButton(button, direction) {
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.verticalControl = direction;
            button.style.background = 'rgba(255, 255, 255, 0.5)';
        });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.verticalControl = 0;
            button.style.background = 'rgba(255, 255, 255, 0.3)';
        });
        
        // Also handle touch cancel event (e.g., when notifications appear)
        button.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.verticalControl = 0;
            button.style.background = 'rgba(255, 255, 255, 0.3)';
        });
    }

    // Method to adjust controls based on screen orientation
    adjustControlsForOrientation() {
        // Update device information
        this.device = this.detectDeviceType();
        const isLandscape = this.device.isLandscape;
        
        // Adjust joystick positioning
        if (document.getElementById('movement-joystick-container')) {
            document.getElementById('movement-joystick-container').style.bottom = 
                isLandscape ? '80px' : '120px';
        }
        
        // Adjust action buttons
        if (document.getElementById('action-buttons')) {
            document.getElementById('action-buttons').style.bottom = 
                isLandscape ? 
                (this.isMobilePhone() ? '220px' : '250px') : 
                (this.isMobilePhone() ? '260px' : '290px');
        }
        
        // Adjust altitude buttons
        if (document.getElementById('altitude-buttons')) {
            document.getElementById('altitude-buttons').style.bottom = 
                isLandscape ? '80px' : '120px';
        }
        
        console.log(`Controls adjusted for ${isLandscape ? 'landscape' : 'portrait'} orientation`);
    }

    // Set up touch gestures for double tap
    setupTouchGestures() {
        if (!this.gestureDetection.enabled) return;
        
        const handleTouchStart = (e) => {
            if (e.touches.length !== 1) return; // Only handle single touches
            
            const touch = e.touches[0];
            const now = Date.now();
            
            // Calculate distance from previous tap for double-tap detection
            const dx = touch.clientX - this.gestureDetection.tapPosition.x;
            const dy = touch.clientY - this.gestureDetection.tapPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check for double tap (close in time and position)
            if (
                now - this.gestureDetection.lastTapTime < this.gestureDetection.doubleTapTime &&
                distance < 40 &&
                this.gestureDetection.doubleTapCallback
            ) {
                this.gestureDetection.doubleTapCallback();
                e.preventDefault();
                return;
            }
            
            // Store this tap data for potential double-tap detection
            this.gestureDetection.lastTapTime = now;
            this.gestureDetection.tapPosition = { x: touch.clientX, y: touch.clientY };
        };
        
        // Add listeners to document for global gesture detection
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
    }

    // Set the double tap callback
    setDoubleTapCallback(callback) {
        if (typeof callback === 'function') {
            this.gestureDetection.doubleTapCallback = callback;
        }
    }
    
    // Apply boost effect
    applyBoost(multiplier, duration) {
        this.boostActive = true;
        
        // Store normal speed multiplier to restore later
        const normalSpeed = this.speedMultiplier;
        
        // Clear any existing boost timeout
        if (this.boostTimeout) clearTimeout(this.boostTimeout);
        
        // Set timeout to end boost
        this.boostTimeout = setTimeout(() => {
            this.boostActive = false;
            
            // Restore pre-boost speed
            this.speedMultiplier = normalSpeed;
        }, duration);
    }

    // Enable/disable battery saving mode
    setBatterySavingMode(enabled) {
        this.batterySavingMode = enabled;
        
        // Adjust visual feedback for battery saving
        if (enabled) {
            // Reduce opacity of visual elements
            const elements = [
                document.getElementById('movement-joystick-container'),
                document.getElementById('camera-control'),
                document.getElementById('action-buttons'),
                document.getElementById('altitude-buttons')
            ];
            
            elements.forEach(el => {
                if (el) {
                    el.style.opacity = '0.7';
                }
            });
        } else {
            // Restore normal opacity
            const elements = [
                document.getElementById('movement-joystick-container'),
                document.getElementById('camera-control'),
                document.getElementById('action-buttons'),
                document.getElementById('altitude-buttons')
            ];
            
            elements.forEach(el => {
                if (el) {
                    el.style.opacity = '1';
                }
            });
        }
        
        console.log(`Touch input battery saving mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Get the current input state
    getInput() {
        try {
            // Calculate the effective speed multiplier
            const effectiveSpeedMultiplier = this.boostActive ? 
                this.speedMultiplier * 2.0 : // 2.0 is the boost multiplier
                this.speedMultiplier;
                
            return {
                // Forward/backward movement from joystick
                move: {
                    forward: this.moveData.forward,
                    right: 0, // We don't use right movement in the new controls
                    up: this.verticalControl // Up/down from altitude buttons
                },
                
                // Camera rotation from right touch area
                camera: {
                    deltaX: this.cameraData.deltaX,
                    deltaY: this.cameraData.deltaY,
                    active: this.cameraData.active
                },
                
                // Speed control
                speed: {
                    multiplier: this.speedMultiplier,
                    effectiveMultiplier: effectiveSpeedMultiplier,
                    boosting: this.boostActive
                },
                
                // For compatibility with existing systems
                moveState: {
                    forward: this.moveData.forward,
                    right: 0,
                    up: this.verticalControl,
                    rotation: 0
                }
            };
        } catch (error) {
            console.error('Error in getInput:', error);
            // Return fallback empty input
            return {
                move: { forward: 0, right: 0, up: 0 },
                camera: { deltaX: 0, deltaY: 0, active: false },
                speed: { multiplier: 1.0, effectiveMultiplier: 1.0, boosting: false },
                moveState: { forward: 0, right: 0, up: 0, rotation: 0 }
            };
        }
    }

    // Update method that can be called from game loop
    update(delta) {
        // Nothing to update continuously in this implementation
        // All updates are event-driven
    }

    // Clean up resources
    dispose() {
        try {
            // Destroy joystick
            if (this.moveJoystick) {
                this.moveJoystick.destroy();
            }
            
            // Remove DOM elements
            const elements = [
                document.getElementById('movement-joystick-container'),
                document.getElementById('camera-control'),
                document.getElementById('camera-indicator'),
                document.getElementById('action-buttons'),
                document.getElementById('altitude-buttons')
            ];
            
            elements.forEach(el => {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
            
            // Clear any active timeouts
            if (this.boostTimeout) {
                clearTimeout(this.boostTimeout);
                this.boostTimeout = null;
            }
            
            // Remove event listeners
            window.removeEventListener('orientationchange', this.adjustControlsForOrientation);
            
            console.log('Touch input manager disposed successfully');
        } catch (error) {
            console.error('Error disposing touch input manager:', error);
        }
    }
}