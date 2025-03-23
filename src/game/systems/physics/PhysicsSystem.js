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
    constructor(engine) {
        this.engine = engine;
        
        // Physics constants
        this.gravity = -9.81; // m/s²
        this.airDensity = 1.225; // kg/m³
        this.timeStep = 1/60; // Fixed timestep for physics
        this.maxSubSteps = 3; // Maximum physics substeps per frame
        
        // Reusable vectors for calculations
        this._tempVec3 = new THREE.Vector3();
        this._tempVec3_2 = new THREE.Vector3();
        this._tempVec3_3 = new THREE.Vector3(); // Additional reusable vector
        this._tempQuat = new THREE.Quaternion();
        
        // Collection of physics bodies
        this.bodies = new Map();
        
        // Advanced terrain collision caching
        this.heightCache = new HeightCache();
        this.normalCache = new Map(); // Cache for terrain normals
        this.maxNormalCacheSize = 500;
        
        // Performance metrics
        this.lastPerformanceLog = 0;
        this.performanceLogInterval = 5000; // Log every 5 seconds
        
        // Adapt caching to device capabilities
        if (engine && engine.isMobile !== undefined) {
            this.heightCache.adaptToDeviceCapabilities(engine.isMobile);
        }
    }

    /**
     * Initialize the physics system
     */
    async initialize() {
        console.log("Initializing PhysicsSystem...");
        
        // Prepare height cache for terrain
        this.heightCache.clear();
        
        // Adapt to device capabilities
        if (this.engine && this.engine.isMobile !== undefined) {
            this.heightCache.adaptToDeviceCapabilities(this.engine.isMobile);
        }
        
        console.log("PhysicsSystem initialized");
        return Promise.resolve();
    }

    createRigidBody(id, mass = 1) {
        const body = new RigidBody(mass);
        this.bodies.set(id, body);
        return body;
    }

    removeRigidBody(id) {
        this.bodies.delete(id);
    }

    update(delta, world, elapsed) {
        // Calculate number of physics steps
        const numSteps = Math.min(Math.ceil(delta / this.timeStep), this.maxSubSteps);
        const stepDelta = delta / numSteps;

        for (let step = 0; step < numSteps; step++) {
            this.updatePhysics(stepDelta, world);
        }
        
        // Log performance metrics periodically
        if (elapsed && elapsed - this.lastPerformanceLog > this.performanceLogInterval) {
            this.logPerformanceMetrics();
            this.lastPerformanceLog = elapsed;
        }
    }
    
    logPerformanceMetrics() {
        if (!this.engine || !this.engine.debug) return;
        
        // Log cache hit rate and size
        const cacheStats = this.heightCache.getStats();
        console.log('Terrain Height Cache Stats:', cacheStats);
        console.log('Normal Cache Size:', this.normalCache.size);
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
        // Generate key for normal cache - use coarser resolution than height
        const normalCacheResolution = this.heightCache.resolution * 2;
        const nx = Math.floor(x / normalCacheResolution) * normalCacheResolution;
        const nz = Math.floor(z / normalCacheResolution) * normalCacheResolution;
        const key = `${nx},${nz}`;
        
        // Check if normal is already cached
        if (this.normalCache.has(key)) {
            return this._tempVec3.copy(this.normalCache.get(key));
        }
        
        const epsilon = 1.0; // Sample distance
        
        // Get heights at nearby points
        const h0 = this.getTerrainHeight(x, z, world);
        const hx = this.getTerrainHeight(x + epsilon, z, world);
        const hz = this.getTerrainHeight(x, z + epsilon, world);
        
        // Calculate normal using cross product of terrain vectors
        const normal = new THREE.Vector3(
            -(hx - h0) / epsilon,
            1,
            -(hz - h0) / epsilon
        ).normalize();
        
        // Cache the normal
        if (this.normalCache.size >= this.maxNormalCacheSize) {
            // Remove a random entry if cache is full
            const firstKey = this.normalCache.keys().next().value;
            this.normalCache.delete(firstKey);
        }
        this.normalCache.set(key, normal.clone());
        
        return this._tempVec3.copy(normal);
    }
}

class HeightCache {
    constructor(resolution = 32) {
        this.resolution = resolution;
        this.cache = new Map();
        this.maxEntries = 5000; // Increased from 1000 for better coverage
        this.hits = 0;
        this.misses = 0;
        this.accessCount = 0;
        
        // Maintain a list of keys in order of access for LRU eviction
        this.accessOrder = [];
        
        // Setup adaptive resolution based on access patterns
        this.adaptiveResolution = true;
        this.highActivityRegions = new Map(); // Tracks regions with frequent access
        this.regionAccessThreshold = 10; // How many accesses to consider a region high-activity
        this.regionSize = 512; // Size of regions for adaptive resolution
    }

    key(x, z) {
        // Get effective resolution for this region based on activity
        let effectiveResolution = this.resolution;
        
        if (this.adaptiveResolution) {
            const regionX = Math.floor(x / this.regionSize) * this.regionSize;
            const regionZ = Math.floor(z / this.regionSize) * this.regionSize;
            const regionKey = `${regionX},${regionZ}`;
            
            // Check if this is a high-activity region
            if (this.highActivityRegions.has(regionKey)) {
                // Use higher resolution (smaller cells) for high-activity regions
                effectiveResolution = this.resolution / 2;
            }
        }
        
        const qx = Math.floor(x / effectiveResolution) * effectiveResolution;
        const qz = Math.floor(z / effectiveResolution) * effectiveResolution;
        return `${qx},${qz}`;
    }

    get(x, z) {
        this.accessCount++;
        
        // Track region activity
        if (this.adaptiveResolution && this.accessCount % 10 === 0) { // Only track every 10th access for performance
            const regionX = Math.floor(x / this.regionSize) * this.regionSize;
            const regionZ = Math.floor(z / this.regionSize) * this.regionSize;
            const regionKey = `${regionX},${regionZ}`;
            
            const accessCount = this.highActivityRegions.get(regionKey) || 0;
            this.highActivityRegions.set(regionKey, accessCount + 1);
            
            // Clean up old regions periodically
            if (this.highActivityRegions.size > 20) {
                this.cleanupActivityRegions();
            }
        }
        
        const cacheKey = this.key(x, z);
        const value = this.cache.get(cacheKey);
        
        if (value !== undefined) {
            // Update access order for LRU (move to end of array)
            const index = this.accessOrder.indexOf(cacheKey);
            if (index !== -1) {
                this.accessOrder.splice(index, 1);
            }
            this.accessOrder.push(cacheKey);
            
            this.hits++;
            return value;
        }
        
        this.misses++;
        return undefined;
    }

    set(x, z, height) {
        const cacheKey = this.key(x, z);
        
        // Clear old entries if cache is too large using LRU policy
        while (this.cache.size >= this.maxEntries && this.accessOrder.length > 0) {
            const oldestKey = this.accessOrder.shift();
            this.cache.delete(oldestKey);
        }
        
        // Add to cache and update access order
        this.cache.set(cacheKey, height);
        this.accessOrder.push(cacheKey);
    }
    
    cleanupActivityRegions() {
        // Sort regions by access count
        const sortedRegions = Array.from(this.highActivityRegions.entries())
            .sort((a, b) => b[1] - a[1]); // Sort by count, descending
        
        // Keep only the top 10 most active regions
        this.highActivityRegions = new Map(
            sortedRegions.slice(0, 10)
                .filter(entry => entry[1] >= this.regionAccessThreshold)
        );
    }
    
    clear() {
        this.cache.clear();
        this.accessOrder = [];
        this.hits = 0;
        this.misses = 0;
        this.accessCount = 0;
    }
    
    getStats() {
        const hitRate = this.accessCount > 0 ? 
            this.hits / this.accessCount * 100 : 0;
            
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: hitRate.toFixed(2) + '%',
            highActivityRegions: this.highActivityRegions.size
        };
    }
    
    adaptToDeviceCapabilities(isMobile) {
        if (isMobile) {
            // Reduce cache size and use larger resolution cells on mobile
            this.maxEntries = 2000;
            this.resolution = 48; // Larger cells
            this.regionSize = 256;
        } else {
            // Full cache on desktop
            this.maxEntries = 5000;
            this.resolution = 32;
            this.regionSize = 512;
        }
    }
}