import * as THREE from 'three';

class RigidBody {
    constructor(mass = 1) {
        this.mass = mass;
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.rotation = new THREE.Euler();
        this.angularVelocity = new THREE.Vector3();
        this.quaternion = new THREE.Quaternion();
        this.forces = new THREE.Vector3();
        this.torques = new THREE.Vector3();
        
        // Flying characteristics
        this.surfaceArea = 10; // m²
        this.dragCoefficient = 0.1;
        this.liftCoefficient = 0.3;
    }

    integrate(delta) {
        // Update position
        this.position.addScaledVector(this.velocity, delta);
        
        // Update linear velocity with acceleration
        this.velocity.addScaledVector(this.acceleration, delta);
        
        // Update rotation
        this.quaternion.setFromEuler(this.rotation);
        const deltaRotation = new THREE.Quaternion();
        deltaRotation.setFromAxisAngle(this.angularVelocity.normalize(), this.angularVelocity.length() * delta);
        this.quaternion.premultiply(deltaRotation);
        this.rotation.setFromQuaternion(this.quaternion);
        
        // Clear forces and torques for next frame
        this.forces.set(0, 0, 0);
        this.torques.set(0, 0, 0);
    }
}

export class PhysicsSystem {
    constructor() {
        // Physics constants
        this.gravity = -9.81; // m/s²
        this.airDensity = 1.225; // kg/m³
        this.timeStep = 1/60; // Fixed timestep for physics
        this.maxSubSteps = 3; // Maximum physics substeps per frame
        
        // Reusable vectors for calculations
        this._tempVec3 = new THREE.Vector3();
        this._tempVec3_2 = new THREE.Vector3();
        this._tempQuat = new THREE.Quaternion();
        
        // Collection of physics bodies
        this.bodies = new Map();
        
        // Terrain collision cache
        this.heightCache = new HeightCache(32);
    }

    createRigidBody(id, mass = 1) {
        const body = new RigidBody(mass);
        this.bodies.set(id, body);
        return body;
    }

    removeRigidBody(id) {
        this.bodies.delete(id);
    }

    update(delta, world) {
        // Calculate number of physics steps
        const numSteps = Math.min(Math.ceil(delta / this.timeStep), this.maxSubSteps);
        const stepDelta = delta / numSteps;

        for (let step = 0; step < numSteps; step++) {
            this.updatePhysics(stepDelta, world);
        }
    }

    updatePhysics(delta, world) {
        for (const [id, body] of this.bodies) {
            // Apply gravity
            this.applyGravity(body);
            
            // Apply aerodynamic forces
            this.applyAerodynamics(body);
            
            // Calculate acceleration from forces
            body.acceleration.copy(body.forces).divideScalar(body.mass);
            
            // Integrate physics
            body.integrate(delta);
            
            // Handle terrain collision
            if (world) {
                this.handleTerrainCollision(body, world);
            }
        }
    }

    applyGravity(body) {
        // F = mg
        body.forces.y += body.mass * this.gravity;
    }

    applyAerodynamics(body) {
        // Get forward direction in world space
        const forward = this._tempVec3.set(0, 0, 1)
            .applyQuaternion(body.quaternion);
            
        // Calculate relative air velocity
        const relativeVelocity = this._tempVec3_2.copy(body.velocity);
        const airSpeed = relativeVelocity.length();
        
        if (airSpeed > 0.0001) {
            // Calculate angle of attack
            const angleOfAttack = Math.acos(forward.dot(relativeVelocity.normalize()));
            
            // Calculate lift and drag coefficients based on angle of attack
            const effectiveLiftCoeff = body.liftCoefficient * Math.sin(2 * angleOfAttack);
            const effectiveDragCoeff = body.dragCoefficient + (body.liftCoefficient * Math.pow(Math.sin(angleOfAttack), 2));
            
            // Calculate dynamic pressure
            const dynamicPressure = 0.5 * this.airDensity * airSpeed * airSpeed;
            
            // Calculate lift force
            const liftForce = this._tempVec3.set(0, 1, 0)
                .applyQuaternion(body.quaternion)
                .multiplyScalar(effectiveLiftCoeff * dynamicPressure * body.surfaceArea);
            
            // Calculate drag force
            const dragForce = this._tempVec3_2.copy(relativeVelocity)
                .normalize()
                .multiplyScalar(-effectiveDragCoeff * dynamicPressure * body.surfaceArea);
            
            // Apply forces
            body.forces.add(liftForce);
            body.forces.add(dragForce);
        }
    }

    handleTerrainCollision(body, world) {
        // Get terrain height at body position
        const terrainHeight = this.getTerrainHeight(body.position.x, body.position.z, world);
        const minHeight = terrainHeight + 2; // Minimum hover height
        
        if (body.position.y < minHeight) {
            // Calculate penetration depth
            const penetration = minHeight - body.position.y;
            
            // Move body out of collision
            body.position.y = minHeight;
            
            // Calculate terrain normal (approximate from nearby heights)
            const normal = this.calculateTerrainNormal(
                body.position.x, 
                body.position.z, 
                world
            );
            
            // Project velocity onto terrain plane
            const velocityDotNormal = body.velocity.dot(normal);
            if (velocityDotNormal < 0) {
                body.velocity.addScaledVector(
                    normal, 
                    -velocityDotNormal * (1 + 0.3) // 0.3 = restitution coefficient
                );
            }
            
            // Apply friction
            const friction = 0.3;
            const tangentialVelocity = this._tempVec3.copy(body.velocity)
                .addScaledVector(normal, -velocityDotNormal);
            
            if (tangentialVelocity.lengthSq() > 0.0001) {
                const frictionForce = tangentialVelocity.normalize()
                    .multiplyScalar(-friction * Math.abs(velocityDotNormal) * body.mass);
                body.forces.add(frictionForce);
            }
        }
    }

    getTerrainHeight(x, z, world) {
        // Check cache first
        const cached = this.heightCache.get(x, z);
        if (cached !== undefined) {
            return cached;
        }
        
        // Calculate actual height
        const height = world.getTerrainHeight(x, z);
        
        // Cache the result
        this.heightCache.set(x, z, height);
        
        return height;
    }

    calculateTerrainNormal(x, z, world) {
        const epsilon = 1.0; // Sample distance
        
        // Get heights at nearby points
        const h0 = this.getTerrainHeight(x, z, world);
        const hx = this.getTerrainHeight(x + epsilon, z, world);
        const hz = this.getTerrainHeight(x, z + epsilon, world);
        
        // Calculate normal using cross product of terrain vectors
        const normal = this._tempVec3;
        normal.set(
            -(hx - h0) / epsilon,
            1,
            -(hz - h0) / epsilon
        ).normalize();
        
        return normal;
    }
}

class HeightCache {
    constructor(resolution) {
        this.resolution = resolution;
        this.cache = new Map();
        this.maxEntries = 1000;
    }

    key(x, z) {
        const qx = Math.floor(x / this.resolution) * this.resolution;
        const qz = Math.floor(z / this.resolution) * this.resolution;
        return `${qx},${qz}`;
    }

    get(x, z) {
        return this.cache.get(this.key(x, z));
    }

    set(x, z, height) {
        // Clear old entries if cache is too large
        if (this.cache.size >= this.maxEntries) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(this.key(x, z), height);
    }
}