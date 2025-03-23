import * as THREE from 'three';

export class CarpetController {
    constructor(rigidbody) {
        this.body = rigidbody;
        
        // Control parameters
        this.maxThrust = 20.0; // Maximum thrust force
        this.turnRate = 2.0; // Rate of turning
        this.maxBankAngle = Math.PI / 4; // Maximum banking angle
        this.maxPitchAngle = Math.PI / 6; // Maximum pitch angle
        this.bankingSensitivity = 1.5; // How quickly the carpet banks into turns
        this.heightControl = 10.0; // Vertical thrust strength
        
        // Control state
        this.thrust = 0;
        this.turnInput = 0;
        this.pitchInput = 0;
        this.heightInput = 0;
        
        // Smoothing
        this.turnSmoothing = new ExponentialSmoothing(0.15);
        this.pitchSmoothing = new ExponentialSmoothing(0.15);
        this.bankSmoothing = new ExponentialSmoothing(0.1);
        
        // Temporary vectors for calculations
        this._tempVec3 = new THREE.Vector3();
        this._tempQuat = new THREE.Quaternion();
    }

    update(input, delta) {
        // Process input
        this.processInput(input);
        
        // Apply control forces
        this.applyThrust(delta);
        this.applyTurn(delta);
        this.applyBanking(delta);
        this.applyHeightControl(delta);
    }

    processInput(input) {
        // Get thrust input (-1 to 1)
        this.thrust = 0;
        if (input.isKeyDown('KeyW')) this.thrust += 1;
        if (input.isKeyDown('KeyS')) this.thrust -= 1;
        
        // Get turn input (-1 to 1)
        this.turnInput = 0;
        if (input.isKeyDown('KeyA')) this.turnInput += 1;
        if (input.isKeyDown('KeyD')) this.turnInput -= 1;
        
        // Get pitch input (-1 to 1)
        this.pitchInput = 0;
        if (input.isKeyDown('ArrowUp')) this.pitchInput -= 1;
        if (input.isKeyDown('ArrowDown')) this.pitchInput += 1;
        
        // Get height input (-1 to 1)
        this.heightInput = 0;
        if (input.isKeyDown('Space')) this.heightInput += 1;
        if (input.isKeyDown('ShiftLeft')) this.heightInput -= 1;
        
        // Handle touch input if available
        if (input.touches && Object.keys(input.touches).length > 0) {
            // Implement touch controls here
            // Could use virtual joystick values or touch positions
        }
    }

    applyThrust(delta) {
        // Calculate thrust vector in carpet's local space
        const thrustForce = this._tempVec3.set(0, 0, -this.thrust * this.maxThrust);
        
        // Transform to world space
        thrustForce.applyQuaternion(this.body.quaternion);
        
        // Apply force
        this.body.forces.add(heightForce);
    }

    getForwardVector() {
        return this._tempVec3.set(0, 0, -1).applyQuaternion(this.body.quaternion);
    }

    getUpVector() {
        return this._tempVec3.set(0, 1, 0).applyQuaternion(this.body.quaternion);
    }

    getRightVector() {
        return this._tempVec3.set(1, 0, 0).applyQuaternion(this.body.quaternion);
    }
}

// Helper class for smooth value transitions
class ExponentialSmoothing {
    constructor(smoothing = 0.1) {
        this.smoothing = smoothing;
        this.current = 0;
        this.target = 0;
    }

    update(target, delta) {
        this.target = target;
        const alpha = 1.0 - Math.pow(this.smoothing, delta);
        this.current += (this.target - this.current) * alpha;
        return this.current;
    }

    reset(value = 0) {
        this.current = value;
        this.target = value;
    }
}d(thrustForce);
    }

    applyTurn(delta) {
        // Smooth turn input
        const smoothedTurn = this.turnSmoothing.update(this.turnInput, delta);
        
        // Apply turn as angular velocity
        this.body.angularVelocity.y = -smoothedTurn * this.turnRate;
        
        // Calculate desired bank angle based on turn rate
        const desiredBank = -smoothedTurn * this.maxBankAngle;
        
        // Smooth bank angle transition
        const currentBank = this.body.rotation.z;
        const smoothedBank = this.bankSmoothing.update(desiredBank, delta);
        
        // Apply banking
        this.body.rotation.z = smoothedBank;
    }

    applyBanking(delta) {
        // Calculate banking force based on turn rate and velocity
        const speed = this.body.velocity.length();
        const turnRate = this.body.angularVelocity.y;
        
        if (Math.abs(speed) > 0.1 && Math.abs(turnRate) > 0.1) {
            // Calculate banking force magnitude
            const bankForce = speed * turnRate * this.bankingSensitivity;
            
            // Apply force in local up direction
            const forceDir = this._tempVec3.set(0, 1, 0)
                .applyQuaternion(this.body.quaternion);
            
            this.body.forces.addScaledVector(forceDir, bankForce);
        }
    }

    applyHeightControl(delta) {
        // Smooth pitch input
        const smoothedPitch = this.pitchSmoothing.update(this.pitchInput, delta);
        
        // Apply pitch rotation
        this.body.rotation.x = smoothedPitch * this.maxPitchAngle;
        
        // Apply vertical thrust
        const heightForce = this._tempVec3.set(
            0,
            this.heightInput * this.heightControl,
            0
        );
        
        this.body.forces.ad