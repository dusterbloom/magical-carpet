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
        
        // Define gestures
        this.gestures = {
            lastTapTime: 0,
            touchStartPos: null,
            recognizingGesture: false
        };
        
        // Current UI visibility state
        this.visible = true;
        
        // Register window resize event
        window.addEventListener('resize', this.onResize.bind(this));
        
        // Register gesture events
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    }

    initialize() {
        this.createUIContainer();
        this.createJoystickContainer();
        this.createSpellButtons();
        this.createHealthBar();
        this.createBatterySavingToggle();
        this.createAdaptiveLayout();
        console.log("Mobile UI initialized with optimized touch targets and adaptive layout");
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
    }

    createJoystickContainer() {
        // Create from pool or new
        const container = this.getElementFromPool('div') || document.createElement('div');
        container.id = 'joystick-container';
        container.style.cssText = `
            position: fixed;
            bottom: ${this.sizes.spacing * 2 + 40}px;
            left: ${this.sizes.spacing * 2}px;
            width: ${this.sizes.joystickSize}px;
            height: ${this.sizes.joystickSize}px;
            background: rgba(255, 255, 255, 0.25);
            border-radius: 50%;
            z-index: 1000;
            border: 3px solid rgba(255, 255, 255, 0.4);
            backdrop-filter: blur(4px);
            pointer-events: auto;
            touch-action: none;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            transform: translate3d(0,0,0); /* Hardware acceleration */
        `;
        this.uiContainer.appendChild(container);
        this.uiElements.set('joystick', container);
        this.visibleElements.add('joystick');
        this.memoryUsage.activeElements++;
        
        // Add touch action note to debug
        console.log('Joystick container created with ID:', container.id, 'and style:', container.style.cssText);
        
        // Inner joystick handle for better visual feedback
        const handle = this.getElementFromPool('div') || document.createElement('div');
        handle.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${this.sizes.joystickSize * 0.4}px;
            height: ${this.sizes.joystickSize * 0.4}px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        container.appendChild(handle);
        this.uiElements.set('joystickHandle', handle);
    }

    createSpellButtons() {
        // Create spellbuttons container
        const buttonContainer = this.getElementFromPool('div') || document.createElement('div');
        buttonContainer.id = 'spell-buttons';
        buttonContainer.style.cssText = `
            position: fixed;
            bottom: ${this.sizes.spacing * 2}px;
            right: ${this.sizes.spacing * 2}px;
            display: flex;
            gap: ${this.sizes.spacing}px;
            z-index: 1000;
            pointer-events: auto;
            transform: translate3d(0,0,0); /* Hardware acceleration */
        `;

        // Create 3 spell buttons with larger hit areas
        const colors = ['#ff4444', '#44aaff', '#ffaa44'];
        const spellNames = ['Fire', 'Ice', 'Lightning'];
        
        for (let i = 1; i <= 3; i++) {
            const button = this.getElementFromPool('div') || document.createElement('div');
            button.id = `spell-button-${i}`;
            button.style.cssText = `
                width: ${this.sizes.buttonSize}px;
                height: ${this.sizes.buttonSize}px;
                background: rgba(0, 0, 0, 0.4);
                border: 2px solid ${colors[i-1]};
                border-radius: 15px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: ${this.sizes.buttonSize * 0.35}px;
                color: white;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                cursor: pointer;
                user-select: none;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                transition: transform 0.1s, background-color 0.2s;
                touch-action: none;
            `;
            
            // Add spell icon
            const icon = this.getElementFromPool('div') || document.createElement('div');
            icon.style.cssText = `
                width: ${this.sizes.buttonSize * 0.5}px;
                height: ${this.sizes.buttonSize * 0.5}px;
                background: ${colors[i-1]};
                border-radius: 50%;
                margin-bottom: 5px;
            `;
            
            // Add spell name for better UX
            const name = this.getElementFromPool('div') || document.createElement('div');
            name.textContent = spellNames[i-1];
            name.style.cssText = `
                font-size: ${this.sizes.buttonSize * 0.2}px;
                opacity: 0.9;
            `;
            
            button.appendChild(icon);
            button.appendChild(name);
            buttonContainer.appendChild(button);
            
            // Track memory usage
            this.memoryUsage.activeElements += 3;
            
            // Add touch event listeners
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                button.style.transform = 'scale(1.1)';
                button.style.backgroundColor = `${colors[i-1]}80`;
                
                // Trigger haptic feedback
                this.triggerHapticFeedback('spell');
                
                // Notify game about spell selection
                if (this.engine && this.engine.systems.player) {
                    this.engine.systems.player.selectSpell(i-1);
                }
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                button.style.transform = 'scale(1)';
                button.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
            });
            
            // Register in touchElements map for gesture recognition
            this.touchElements.set(`spell-button-${i}`, {
                element: button,
                type: 'spell',
                index: i-1
            });
        }

        this.uiContainer.appendChild(buttonContainer);
        this.uiElements.set('spellButtons', buttonContainer);
        this.visibleElements.add('spellButtons');
    }

    createHealthBar() {
        const healthBar = this.getElementFromPool('div') || document.createElement('div');
        healthBar.id = 'health-bar';
        healthBar.style.cssText = `
            position: fixed;
            bottom: ${this.sizes.spacing}px;
            left: 50%;
            transform: translateX(-50%);
            width: ${this.sizes.healthBarWidth}px;
            height: 24px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 12px;
            overflow: hidden;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;

        const healthFill = this.getElementFromPool('div') || document.createElement('div');
        healthFill.style.cssText = `
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #ff0055, #ff2277);
            border-radius: 10px;
            transition: width 0.2s ease;
        `;
        
        // Add health percentage text
        const healthText = this.getElementFromPool('div') || document.createElement('div');
        healthText.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
        `;
        healthText.textContent = '100%';
        
        healthBar.appendChild(healthFill);
        healthBar.appendChild(healthText);
        this.uiContainer.appendChild(healthBar);
        this.uiElements.set('healthBar', healthBar);
        this.uiElements.set('healthFill', healthFill);
        this.uiElements.set('healthText', healthText);
        this.visibleElements.add('healthBar');
        this.memoryUsage.activeElements += 3;
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
            background: rgba(0, 0, 0, 0.5);
            border-radius: 20px;
            padding: 5px 10px;
            z-index: 1000;
            pointer-events: auto;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        `;
        
        const icon = this.getElementFromPool('div') || document.createElement('div');
        icon.style.cssText = `
            width: 20px;
            height: 20px;
            background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M16 4h-2V2h-4v2H8C7.45 4 7 4.45 7 5v16c0 .55.45 1 1 1h8c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zm-1 10h-2v2h-2v-2H9v-2h2v-2h2v2h2v2z"/></svg>') center/contain no-repeat;
            margin-right: 5px;
        `;
        
        const label = this.getElementFromPool('div') || document.createElement('div');
        label.textContent = 'Battery Saver';
        label.style.cssText = `
            color: white;
            font-size: 12px;
        `;
        
        const toggle = this.getElementFromPool('div') || document.createElement('div');
        toggle.style.cssText = `
            width: 36px;
            height: 20px;
            background: #555;
            border-radius: 10px;
            margin-left: 8px;
            position: relative;
            transition: background 0.3s;
        `;
        
        const toggleHandle = this.getElementFromPool('div') || document.createElement('div');
        toggleHandle.style.cssText = `
            position: absolute;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: white;
            top: 2px;
            left: 2px;
            transition: transform 0.3s;
        `;
        
        toggle.appendChild(toggleHandle);
        toggleContainer.appendChild(icon);
        toggleContainer.appendChild(label);
        toggleContainer.appendChild(toggle);
        
        this.uiContainer.appendChild(toggleContainer);
        this.uiElements.set('batterySaver', toggleContainer);
        this.uiElements.set('batterySaverToggle', toggle);
        this.uiElements.set('batterySaverHandle', toggleHandle);
        this.visibleElements.add('batterySaver');
        this.memoryUsage.activeElements += 4;
        
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
                if (element.style.backdropFilter) {
                    element.style.backdropFilter = 'none';
                }
                if (element.style.boxShadow) {
                    element.style.boxShadow = 'none';
                }
            });
            
            // Reduce update frequency for non-critical elements
            this.batteryUpdateFrequency = 3; // Update less frequently
        } else {
            // Restore normal animations
            document.documentElement.style.setProperty('--ui-animation-speed', '1');
            
            // Restore blur effects
            this.uiElements.get('joystick').style.backdropFilter = 'blur(4px)';
            
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
    
    createAdaptiveLayout() {
        // Apply different layouts based on device orientation
        this.adjustLayoutForOrientation();
    }
    
    adjustLayoutForOrientation() {
        const isLandscape = window.innerWidth > window.innerHeight;
        
        if (isLandscape) {
            // Landscape layout - optimized for gameplay
            if (this.uiElements.get('joystick')) {
                this.uiElements.get('joystick').style.bottom = `${this.sizes.spacing * 2 + 40}px`;
                this.uiElements.get('joystick').style.left = `${this.sizes.spacing * 2}px`;
            }
            
            if (this.uiElements.get('spellButtons')) {
                this.uiElements.get('spellButtons').style.bottom = `${this.sizes.spacing * 2}px`;
                this.uiElements.get('spellButtons').style.right = `${this.sizes.spacing * 2}px`;
            }
            
            if (this.uiElements.get('healthBar')) {
                this.uiElements.get('healthBar').style.bottom = `${this.sizes.spacing}px`;
                this.uiElements.get('healthBar').style.width = `${this.sizes.healthBarWidth}px`;
            }
        } else {
            // Portrait layout - compress layout to fit
            if (this.uiElements.get('joystick')) {
                this.uiElements.get('joystick').style.bottom = `${this.sizes.spacing * 2 + 60}px`;
                this.uiElements.get('joystick').style.left = `${this.sizes.spacing}px`;
            }
            
            if (this.uiElements.get('spellButtons')) {
                this.uiElements.get('spellButtons').style.bottom = `${this.sizes.spacing * 2 + 60}px`;
                this.uiElements.get('spellButtons').style.right = `${this.sizes.spacing}px`;
            }
            
            if (this.uiElements.get('healthBar')) {
                this.uiElements.get('healthBar').style.bottom = `${this.sizes.spacing}px`;
                this.uiElements.get('healthBar').style.width = `${Math.min(280, window.innerWidth * 0.8)}px`;
            }
        }
        
        this.orientationLayout = isLandscape ? 'landscape' : 'portrait';
    }
    
    onResize() {
        // Update screen dimensions
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
        
        // Recalculate sizes for adaptive layout
        this.sizes.healthBarWidth = Math.min(320, this.screenWidth * 0.6);
        
        // Apply new layout
        this.adjustLayoutForOrientation();
        
        // Update UI culling
        this.updateElementCulling();
    }
    
    updateHealthBar(percentage) {
        // Only update if visible and if exists
        if (!this.visibleElements.has('healthBar')) return;
        
        const healthFill = this.uiElements.get('healthFill');
        const healthText = this.uiElements.get('healthText');
        
        if (healthFill && healthText) {
            // Make transition smoother by using requestAnimationFrame
            requestAnimationFrame(() => {
                healthFill.style.width = `${percentage}%`;
                healthText.textContent = `${Math.round(percentage)}%`;
                
                // Change color based on health
                if (percentage < 30) {
                    healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
                } else if (percentage < 60) {
                    healthFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
                } else {
                    healthFill.style.background = 'linear-gradient(90deg, #ff0055, #ff2277)';
                }
            });
        }
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
    
    // UI element culling - hide offscreen elements
    updateElementCulling() {
        if (!this.uiElements || this.uiElements.size === 0) return;
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Check each trackable element
        this.uiElements.forEach((element, key) => {
            // Skip container element
            if (key === 'container') return;
            
            // Get element position
            const rect = element.getBoundingClientRect();
            
            // Check if element is outside viewport
            const isOutside = (
                rect.bottom < 0 ||
                rect.top > viewportHeight ||
                rect.right < 0 ||
                rect.left > viewportWidth
            );
            
            // Only update visibility if needed
            if (isOutside && this.visibleElements.has(key)) {
                // Element moved outside viewport - hide it
                element.style.display = 'none';
                this.visibleElements.delete(key);
            } else if (!isOutside && !this.visibleElements.has(key)) {
                // Element moved into viewport - show it
                element.style.display = '';
                this.visibleElements.add(key);
            }
        });
    }
    
    // Gesture recognition system
    handleTouchStart(e) {
        if (!e.touches || e.touches.length === 0) return;
        
        // Store touch start position for gesture detection
        this.gestures.touchStartPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            time: Date.now()
        };
    }
    
    handleTouchMove(e) {
        if (!this.gestures.touchStartPos || !e.touches || e.touches.length === 0) return;
        
        // Check for swipe gesture
        const touch = e.touches[0];
        const touchPos = { x: touch.clientX, y: touch.clientY };
        
        // Calculate distance moved
        const dx = touchPos.x - this.gestures.touchStartPos.x;
        const dy = touchPos.y - this.gestures.touchStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If moved far enough, check for swipe direction
        if (distance > 80 && !this.gestures.recognizingGesture) {
            this.gestures.recognizingGesture = true;
            
            // Determine direction (up, down, left, right)
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // Handle swipe gesture
            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal swipe
                if (dx > 0) {
                    this.handleGesture('swipeRight');
                } else {
                    this.handleGesture('swipeLeft');
                }
            } else {
                // Vertical swipe
                if (dy > 0) {
                    this.handleGesture('swipeDown');
                } else {
                    this.handleGesture('swipeUp');
                }
            }
        }
    }
    
    handleTouchEnd(e) {
        if (!this.gestures.touchStartPos) return;
        
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - this.gestures.touchStartPos.time;
        
        // If touch duration is short, check for double tap
        if (touchDuration < 300) {
            const timeSinceLastTap = touchEndTime - this.gestures.lastTapTime;
            
            // Double tap detection (within 300ms)
            if (timeSinceLastTap < 300 && !this.gestures.recognizingGesture) {
                this.handleGesture('doubleTap');
            }
            
            this.gestures.lastTapTime = touchEndTime;
        }
        
        // Reset gesture tracking
        this.gestures.touchStartPos = null;
        this.gestures.recognizingGesture = false;
    }
    
    handleGesture(gestureType) {
        console.log(`Detected gesture: ${gestureType}`);
        
        // Handle different gestures
        switch (gestureType) {
            case 'swipeUp':
                // Example: Trigger ascend
                if (this.engine && this.engine.systems.player) {
                    this.engine.systems.player.setVerticalMovement(1);
                }
                this.triggerHapticFeedback('swipe');
                break;
                
            case 'swipeDown':
                // Example: Trigger descend
                if (this.engine && this.engine.systems.player) {
                    this.engine.systems.player.setVerticalMovement(-1);
                }
                this.triggerHapticFeedback('swipe');
                break;
                
            case 'doubleTap':
                // Example: Trigger special ability
                if (this.engine && this.engine.systems.player) {
                    this.engine.systems.player.triggerSpecialAbility();
                }
                this.triggerHapticFeedback('doubleTap');
                break;
        }
    }
    
    // Haptic feedback with battery saving consideration
    triggerHapticFeedback(type) {
        if (!this.hasHapticFeedback || this.batterySaving) return;
        
        // Different vibration patterns for different interactions
        switch (type) {
            case 'spell':
                navigator.vibrate(20);
                break;
            case 'swipe':
                navigator.vibrate(30);
                break;
            case 'doubleTap':
                navigator.vibrate([20, 50, 20]);
                break;
            case 'toggle':
                navigator.vibrate(15);
                break;
            default:
                navigator.vibrate(25);
        }
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
            
            // Update UI element culling
            this.updateElementCulling();
            
            // Update health bar if player provided
            if (player && player.health !== undefined && player.maxHealth !== undefined) {
                const healthPercentage = (player.health / player.maxHealth) * 100;
                this.updateHealthBar(healthPercentage);
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
        document.removeEventListener('touchstart', this.handleTouchStart);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        
        console.log("Mobile UI disposed with memory stats:", this.memoryUsage);
    }
}
