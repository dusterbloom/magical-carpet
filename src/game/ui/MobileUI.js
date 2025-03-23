export class MobileUI {
    constructor() {
        this.uiElements = new Map();
    }

    initialize() {
        this.createJoystickContainer();
        this.createSpellButtons();
        this.createHealthBar();
    }

    createJoystickContainer() {
        const container = document.createElement('div');
        container.id = 'joystick-container';
        container.style.cssText = `
            position: fixed;
            bottom: 120px;  /* Position above the health bar */
            left: 40px;     /* Positioned to the left side */
            width: 120px;
            height: 120px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 50%;
            z-index: 1000;
            border: 2px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(4px);
        `;
        document.body.appendChild(container);
        this.uiElements.set('joystick', container);
    }

    createSpellButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'spell-buttons';
        buttonContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 1000;
        `;

        // Create 3 spell buttons matching the screenshot
        const colors = ['#ff4444', '#44aaff', '#ffaa44'];
        for (let i = 1; i <= 3; i++) {
            const button = document.createElement('div');
            button.style.cssText = `
                width: 60px;
                height: 60px;
                background: ${colors[i-1]};
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                color: white;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                cursor: pointer;
                user-select: none;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            `;
            button.textContent = i;
            buttonContainer.appendChild(button);
        }

        document.body.appendChild(buttonContainer);
        this.uiElements.set('spellButtons', buttonContainer);
    }

    createHealthBar() {
        const healthBar = document.createElement('div');
        healthBar.id = 'health-bar';
        healthBar.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 300px;
            height: 20px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 10px;
            overflow: hidden;
            z-index: 1000;
        `;

        const healthFill = document.createElement('div');
        healthFill.style.cssText = `
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #ff0055, #ff2277);
            border-radius: 10px;
            transition: width 0.3s ease;
        `;
        
        healthBar.appendChild(healthFill);
        document.body.appendChild(healthBar);
        this.uiElements.set('healthBar', healthBar);
    }

    updateHealthBar(percentage) {
        const healthBar = this.uiElements.get('healthBar');
        if (healthBar) {
            const fill = healthBar.firstChild;
            fill.style.width = `${percentage}%`;
        }
    }

    dispose() {
        this.uiElements.forEach(element => element.remove());
        this.uiElements.clear();
    }
}
