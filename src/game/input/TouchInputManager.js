import nipplejs from 'nipplejs';

export class TouchInputManager {
    constructor() {
        this.moveJoystick = null;
        this.turnJoystick = null;
        this.moveData = { x: 0, y: 0 };
        this.turnData = { x: 0, y: 0 };
    }

    async initialize() {
        // Create containers
        this.createJoystickContainers();
        
        // Setup left joystick (movement)
        this.moveJoystick = nipplejs.create({
            zone: document.getElementById('move-joystick'),
            mode: 'static',
            position: { left: '80px', bottom: '100px' },
            color: 'white',
            size: 100
        });

        // Setup right joystick (turning)
        this.turnJoystick = nipplejs.create({
            zone: document.getElementById('turn-joystick'),
            mode: 'static',
            position: { right: '80px', bottom: '100px' },
            color: 'white',
            size: 100
        });

        this.setupEvents();
        console.log('TouchInputManager initialized');
    }

    createJoystickContainers() {
        // Left joystick
        const moveZone = document.createElement('div');
        moveZone.id = 'move-joystick';
        moveZone.style.cssText = 'position: fixed; bottom: 20px; left: 20px; width: 120px; height: 120px;';
        document.body.appendChild(moveZone);

        // Right joystick
        const turnZone = document.createElement('div');
        turnZone.id = 'turn-joystick';
        turnZone.style.cssText = 'position: fixed; bottom: 20px; right: 20px; width: 120px; height: 120px;';
        document.body.appendChild(turnZone);
    }

    setupEvents() {
        // Move joystick events
        this.moveJoystick.on('move', (e, data) => {
            const x = data.vector.x;
            const y = data.vector.y;
            this.moveData = { x, y };
        });

        this.moveJoystick.on('end', () => {
            this.moveData = { x: 0, y: 0 };
        });

        // Turn joystick events
        this.turnJoystick.on('move', (e, data) => {
            const x = data.vector.x;
            const y = data.vector.y;
            this.turnData = { x, y };
        });

        this.turnJoystick.on('end', () => {
            this.turnData = { x: 0, y: 0 };
        });
    }

    getInput() {
        return {
            move: this.moveData,
            turn: this.turnData
        };
    }

    dispose() {
        if (this.moveJoystick) this.moveJoystick.destroy();
        if (this.turnJoystick) this.turnJoystick.destroy();
        document.getElementById('move-joystick')?.remove();
        document.getElementById('turn-joystick')?.remove();
    }
}
