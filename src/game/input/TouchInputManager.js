import nipplejs from 'nipplejs';

export class TouchInputManager {
    constructor(engine) {
        this.engine = engine;
        this.moveJoystick = null;
        this.turnJoystick = null;
        this.moveData = { x: 0, y: 0 };
        this.turnData = { x: 0, y: 0 };
        
        // Performance optimization properties
        this.updateInterval = 1; // Update interval in frames (for battery saving)
        this.frameCounter = 0;
        this.batterySavingMode = false;
        this.joystickOptions = {
            size: 120,
            threshold: 0.1,   // Ignore very small movements for stability
            fadeTime: 100     // ms to fade out joystick when inactive
        };
        
        // Device motion data for tilt controls
        this.deviceMotion = {
            hasDeviceMotion: false,
            isCalibrated: false,
            calibrationAlpha: 0,
            calibrationBeta: 0,
            calibrationGamma: 0,
            alpha: 0,
            beta: 0,
            gamma: 0,
            smoothedBeta: 0,   // Smoothed values for responsiveness
            smoothedGamma: 0,
            smoothingFactor: 0.2  // Lower = smoother but more lag
        };
        
        // Touch gesture tracking
        this.gestureDetection = {
            enabled: true,
            doubleTapTime: 300,  // ms between taps for double-tap
            lastTapTime: 0,
            tapPosition: { x: 0, y: 0 },
            doubleTapCallback: null
        };
        
        // Device type detection for optimizations
        this.device = this.detectDeviceType();
    }

    async initialize() {
        try {
            // Create containers with optimized positioning
            this.createJoystickContainers();
            
            console.log('Creating move joystick...');
            // Setup move joystick with optimized settings
            const moveJoystickElement = document.getElementById(this.moveJoystickId);
            if (!moveJoystickElement) {
                console.error('Could not find move joystick element with ID:', this.moveJoystickId);
                return;
            }
            
            this.moveJoystick = nipplejs.create({
                zone: moveJoystickElement,
                mode: 'static',  // Static mode for more reliable positioning
                position: { left: '50%', top: '50%' },
                color: 'white',
                size: 100,
                restOpacity: 0.8,  // More visible when not in use
                catchDistance: 150, // Larger catch distance for easier control
                fadeTime: 100
            });

            // Move vs. turn based on orientation detection
            if (this.device.hasLargeScreen) {
                console.log('Creating turn joystick for large screen device');
                // Setup a separate turn joystick for tablets and larger screens
                const turnJoystickElement = document.getElementById(this.turnJoystickId);
                if (!turnJoystickElement) {
                    console.error('Could not find turn joystick element with ID:', this.turnJoystickId);
                } else {
                    this.turnJoystick = nipplejs.create({
                        zone: turnJoystickElement,
                        mode: 'static',  // Static mode for more reliable positioning
                        position: { left: '50%', top: '50%' },
                        color: 'white',
                        size: 100,
                        restOpacity: 0.8,
                        catchDistance: 150,
                        fadeTime: 100
                    });
                }
            } else {
                // On small screens, use single joystick + gestures/tilt
                this.setupDeviceMotion();
            }

            this.setupEvents();
            this.setupTouchGestures();
            console.log('TouchInputManager initialized successfully with device type:', this.device.type);
        } catch (error) {
            console.error('Error initializing TouchInputManager:', error);
        }
    }

    detectDeviceType() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const smallerDimension = Math.min(width, height);
        const largerDimension = Math.max(width, height);
        
        const deviceInfo = {
            type: 'unknown',
            isPhone: false,
            isTablet: false,
            hasLargeScreen: false,
            isLandscape: width > height,
            screenWidth: width,
            screenHeight: height
        };
        
        if (smallerDimension < 600) {
            deviceInfo.type = 'phone';
            deviceInfo.isPhone = true;
        } else if (smallerDimension < 960) {
            deviceInfo.type = 'tablet';
            deviceInfo.isTablet = true;
            deviceInfo.hasLargeScreen = true;
        } else {
            deviceInfo.type = 'desktop';
            deviceInfo.hasLargeScreen = true;
        }
        
        return deviceInfo;
    }

    createJoystickContainers() {
        try {
            // Generate unique IDs for the joysticks to avoid conflicts
            const moveJoystickId = 'move-joystick-' + Date.now();
            const turnJoystickId = 'turn-joystick-' + Date.now();
            
            // Remove any existing joystick containers
            const existingMove = document.getElementById('move-joystick');
            const existingTurn = document.getElementById('turn-joystick');
            
            if (existingMove) {
                console.log('Removing existing move joystick');
                existingMove.remove();
            }
            if (existingTurn) {
                console.log('Removing existing turn joystick');
                existingTurn.remove();
            }
            
            // Move joystick - everyone gets this
            const moveZone = document.createElement('div');
            moveZone.id = moveJoystickId;
            moveZone.setAttribute('data-role', 'move-joystick');
            moveZone.style.cssText = `
                position: fixed;
                bottom: 120px;
                left: 40px;
                width: 150px;
                height: 150px;
                z-index: 1001; /* Higher than UI elements */
                touch-action: none;
                user-select: none;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border: 3px solid rgba(255, 255, 255, 0.5);
                transform: translate3d(0,0,0); /* Hardware acceleration */
            `;
            document.body.appendChild(moveZone);
            console.log('Move joystick container created with ID:', moveJoystickId);
    
            // Turn joystick - only for larger screens
            if (this.device.hasLargeScreen) {
                const turnZone = document.createElement('div');
                turnZone.id = turnJoystickId;
                turnZone.setAttribute('data-role', 'turn-joystick');
                turnZone.style.cssText = `
                    position: fixed;
                    bottom: 120px;
                    right: 40px;
                    width: 150px;
                    height: 150px;
                    z-index: 1001; /* Higher than UI elements */
                    touch-action: none;
                    user-select: none;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border: 3px solid rgba(255, 255, 255, 0.5);
                    transform: translate3d(0,0,0); /* Hardware acceleration */
                `;
                document.body.appendChild(turnZone);
                console.log('Turn joystick container created with ID:', turnJoystickId);
            }
            
            // Save the IDs for later use
            this.moveJoystickId = moveJoystickId;
            this.turnJoystickId = turnJoystickId;
        } catch (error) {
            console.error('Error creating joystick containers:', error);
        }
    }

    setupEvents() {
        try {
            console.log('Setting up joystick events...');
            // Move joystick events with improved handling
            this.moveJoystick.on('start', () => {
                console.log('Move joystick: start');
            });
            
            this.moveJoystick.on('move', (e, data) => {
                // Apply threshold to avoid jitter with small movements
                const force = data.force > 0.05 ? data.force : 0;
                const angle = data.angle.radian;
                
                this.moveData = {
                    x: Math.cos(angle) * force,
                    y: Math.sin(angle) * force,
                    moving: force > 0,
                    force: force,
                    angle: angle
                };
                
                // Debug log - uncomment if needed
                // console.log('Move joystick:', this.moveData);
            });

            this.moveJoystick.on('end', () => {
                console.log('Move joystick: end');
                this.moveData = { 
                    x: 0, 
                    y: 0, 
                    moving: false,
                    force: 0,
                    angle: 0
                };
            });

            // Turn joystick events (if available)
            if (this.turnJoystick) {
                this.turnJoystick.on('start', () => {
                    console.log('Turn joystick: start');
                });
                
                this.turnJoystick.on('move', (e, data) => {
                    const force = data.force > 0.05 ? data.force : 0;
                    const angle = data.angle.radian;
                    
                    this.turnData = {
                        x: Math.cos(angle) * force,
                        y: Math.sin(angle) * force,
                        turning: force > 0,
                        force: force,
                        angle: angle
                    };
                    
                    // Debug log - uncomment if needed
                    // console.log('Turn joystick:', this.turnData);
                });

                this.turnJoystick.on('end', () => {
                    console.log('Turn joystick: end');
                    this.turnData = { 
                        x: 0, 
                        y: 0, 
                        turning: false,
                        force: 0,
                        angle: 0
                    };
                });
            }
            
            // Window orientation change handling
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    // Re-detect device type after orientation change
                    this.device = this.detectDeviceType();
                    
                    // Recalibrate device motion if using it
                    if (this.deviceMotion.hasDeviceMotion) {
                        this.deviceMotion.isCalibrated = false;
                    }
                    
                    // Reposition joysticks
                    this.repositionJoysticks();
                }, 300);  // Wait for orientation change to complete
            });
        } catch (error) {
            console.error('Error setting up joystick events:', error);
        }
    }
    
    repositionJoysticks() {
        if (this.moveJoystick) {
            // Destroy and recreate for proper positioning
            this.moveJoystick.destroy();
            
            this.moveJoystick = nipplejs.create({
                zone: document.getElementById('move-joystick'),
                mode: 'semi',
                position: { left: '80px', bottom: '90px' },
                color: 'white',
                size: this.joystickOptions.size,
                restOpacity: 0.5,
                catchDistance: 150,
                fadeTime: this.joystickOptions.fadeTime
            });
            
            // Reattach event handlers
            this.moveJoystick.on('move', (e, data) => {
                const force = data.force > this.joystickOptions.threshold ? data.force : 0;
                const angle = data.angle.radian;
                
                this.moveData = {
                    x: Math.cos(angle) * force,
                    y: Math.sin(angle) * force,
                    moving: force > 0,
                    force: force,
                    angle: angle
                };
            });
    
            this.moveJoystick.on('end', () => {
                this.moveData = { 
                    x: 0, 
                    y: 0, 
                    moving: false,
                    force: 0,
                    angle: 0
                };
            });
        }
        
        if (this.turnJoystick) {
            // Destroy and recreate for proper positioning
            this.turnJoystick.destroy();
            
            this.turnJoystick = nipplejs.create({
                zone: document.getElementById('turn-joystick'),
                mode: 'semi',
                position: { right: '80px', bottom: '90px' },
                color: 'white',
                size: this.joystickOptions.size,
                restOpacity: 0.5,
                catchDistance: 150,
                fadeTime: this.joystickOptions.fadeTime
            });
            
            // Reattach event handlers
            this.turnJoystick.on('move', (e, data) => {
                const force = data.force > this.joystickOptions.threshold ? data.force : 0;
                const angle = data.angle.radian;
                
                this.turnData = {
                    x: Math.cos(angle) * force,
                    y: Math.sin(angle) * force,
                    turning: force > 0,
                    force: force,
                    angle: angle
                };
            });
    
            this.turnJoystick.on('end', () => {
                this.turnData = { 
                    x: 0, 
                    y: 0, 
                    turning: false,
                    force: 0,
                    angle: 0
                };
            });
        }
    }
    
    // Set up advanced touch gestures for mobile optimization
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
        // Use passive: false only when needed to avoid performance issues
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
    }
    
    // Setup device motion for tilt controls on smaller devices
    setupDeviceMotion() {
        // Check if DeviceOrientationEvent is available
        if (window.DeviceOrientationEvent) {
            // Request permission on iOS 13+ devices
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // Create permission button
                const permissionBtn = document.createElement('button');
                permissionBtn.textContent = 'Enable Motion Controls';
                permissionBtn.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    padding: 12px 20px;
                    background: rgba(0, 120, 255, 0.8);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    z-index: 2000;
                `;
                
                permissionBtn.addEventListener('click', async () => {
                    try {
                        const permission = await DeviceOrientationEvent.requestPermission();
                        if (permission === 'granted') {
                            this.initializeDeviceMotion();
                            permissionBtn.remove();
                        }
                    } catch (error) {
                        console.error('Error requesting motion permission:', error);
                    }
                });
                
                document.body.appendChild(permissionBtn);
            } else {
                // No permission needed (non-iOS or older iOS)
                this.initializeDeviceMotion();
            }
        } else {
            console.log('Device motion not available on this device');
        }
    }
    
    initializeDeviceMotion() {
        const handleOrientation = (event) => {
            // Store raw orientation data
            this.deviceMotion.alpha = event.alpha || 0;
            this.deviceMotion.beta = event.beta || 0;  // Front/back tilt (-180 to 180)
            this.deviceMotion.gamma = event.gamma || 0; // Left/right tilt (-90 to 90)
            
            // Calibrate if not already done
            if (!this.deviceMotion.isCalibrated) {
                this.calibrateDeviceMotion();
            }
            
            // Apply calibration and smooth the values
            this.updateSmoothedMotionData();
            
            // Mark as having device motion
            this.deviceMotion.hasDeviceMotion = true;
        };
        
        window.addEventListener('deviceorientation', handleOrientation, true);
    }
    
    calibrateDeviceMotion() {
        // Store current values as calibration point
        this.deviceMotion.calibrationAlpha = this.deviceMotion.alpha;
        this.deviceMotion.calibrationBeta = this.deviceMotion.beta;
        this.deviceMotion.calibrationGamma = this.deviceMotion.gamma;
        this.deviceMotion.isCalibrated = true;
        
        console.log('Device motion calibrated');
    }
    
    updateSmoothedMotionData() {
        // Apply smoothing for more stable controls
        // Subtract calibration values to get relative movement
        const rawBeta = this.deviceMotion.beta - this.deviceMotion.calibrationBeta;
        const rawGamma = this.deviceMotion.gamma - this.deviceMotion.calibrationGamma;
        
        // Apply smoothing factor
        this.deviceMotion.smoothedBeta = 
            this.deviceMotion.smoothedBeta * (1 - this.deviceMotion.smoothingFactor) + 
            rawBeta * this.deviceMotion.smoothingFactor;
            
        this.deviceMotion.smoothedGamma = 
            this.deviceMotion.smoothedGamma * (1 - this.deviceMotion.smoothingFactor) + 
            rawGamma * this.deviceMotion.smoothingFactor;
    }
    
    // Set the double tap callback
    setDoubleTapCallback(callback) {
        if (typeof callback === 'function') {
            this.gestureDetection.doubleTapCallback = callback;
        }
    }
    
    // Enable/disable battery saving mode
    setBatterySavingMode(enabled) {
        this.batterySavingMode = enabled;
        this.updateInterval = enabled ? 3 : 1; // Update less frequently in battery saving mode
        
        // Adjust joystick sensitivity
        this.joystickOptions.threshold = enabled ? 0.15 : 0.1; // Require stronger movements in battery saving mode
        this.joystickOptions.fadeTime = enabled ? 200 : 100; // Slower fade in battery saving mode
        
        // Adjust motion smoothing
        if (this.deviceMotion.hasDeviceMotion) {
            this.deviceMotion.smoothingFactor = enabled ? 0.1 : 0.2; // More smoothing in battery saving
        }
        
        console.log(`Input battery saving mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    getInput() {
        try {
            // Create comprehensive input data object with proper defaults
            return {
                move: this.moveData || { x: 0, y: 0, moving: false },
                turn: this.turnData || { x: 0, y: 0, turning: false },
                tilt: {
                    smoothedBeta: this.deviceMotion.smoothedBeta || 0,
                    smoothedGamma: this.deviceMotion.smoothedGamma || 0
                },
                hasDeviceMotion: !!this.deviceMotion.hasDeviceMotion,
                joystick: {
                    moving: this.moveData?.moving || false,
                    angle: this.moveData?.angle || 0,
                    force: this.moveData?.force || 0
                }
            };
        } catch (error) {
            console.error('Error in getInput:', error);
            // Return fallback empty input
            return {
                move: { x: 0, y: 0, moving: false },
                turn: { x: 0, y: 0, turning: false },
                tilt: { smoothedBeta: 0, smoothedGamma: 0 },
                hasDeviceMotion: false,
                joystick: { moving: false, angle: 0, force: 0 }
            };
        }
    }
    
    // Update method that can be called from game loop
    update(delta) {
        // Skip some updates in battery saving mode
        if (this.batterySavingMode && (this.frameCounter++ % this.updateInterval !== 0)) {
            return;
        }
        
        // Additional update logic can go here if needed
    }

    dispose() {
        try {
            // Clean up joysticks
            if (this.moveJoystick) {
                this.moveJoystick.destroy();
                console.log('Destroyed move joystick');
            }
            if (this.turnJoystick) {
                this.turnJoystick.destroy();
                console.log('Destroyed turn joystick');
            }
            
            // Remove joystick container elements
            if (this.moveJoystickId) {
                const moveElement = document.getElementById(this.moveJoystickId);
                if (moveElement) moveElement.remove();
                console.log('Removed move joystick element');
            }
            
            if (this.turnJoystickId) {
                const turnElement = document.getElementById(this.turnJoystickId);
                if (turnElement) turnElement.remove();
                console.log('Removed turn joystick element');
            }
            
            // Remove any leftover elements by data-role
            document.querySelectorAll('[data-role="move-joystick"]').forEach(el => el.remove());
            document.querySelectorAll('[data-role="turn-joystick"]').forEach(el => el.remove());
            
            // Remove event listeners
            window.removeEventListener('orientationchange', this.handleOrientationChange);
            window.removeEventListener('deviceorientation', this.handleOrientation);
            document.removeEventListener('touchstart', this.handleTouchStart);
            
            console.log('TouchInputManager disposed successfully');
        } catch (error) {
            console.error('Error disposing TouchInputManager:', error);
        }
    }
}
