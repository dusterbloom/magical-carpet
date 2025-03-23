import * as THREE from 'three';

class Spell {
    constructor(config) {
        this.type = config.type;
        this.damage = config.damage || 0;
        this.speed = config.speed || 20;
        this.lifetime = config.lifetime || 3;
        this.radius = config.radius || 0.5;
        this.manaRequired = config.manaRequired || 10;
        this.cooldown = config.cooldown || 1;
        this.lastCastTime = 0;
        
        // Physics properties
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.gravity = config.gravity || 0;
        
        // Visual properties
        this.color = config.color || 0xffffff;
        this.trailLength = config.trailLength || 10;
        this.scale = config.scale || 1;
    }

    canCast(currentTime, playerMana) {
        return currentTime - this.lastCastTime >= this.cooldown && playerMana >= this.manaRequired;
    }
}

export class SpellSystem {
    constructor(engine) {
        this.engine = engine;
        this.scene = engine.scene;
        this.spells = new Map();
        this.activeSpells = [];
        this.trails = new Map();
        
        // Reusable objects
        this._tempVec3 = new THREE.Vector3();
        
        // Initialize spell types
        this.initializeSpellTypes();
        // Create visual assets
        this.createSpellVisuals();
    }

    initializeSpellTypes() {
        // Define different spell types
        this.spellTypes = {
            fireball: {
                type: 'fireball',
                damage: 25,
                speed: 30,
                lifetime: 2,
                radius: 0.5,
                manaRequired: 15,
                cooldown: 1,
                gravity: -5,
                color: 0xff4400,
                trailLength: 20,
                scale: 1
            },
            lightning: {
                type: 'lightning',
                damage: 40,
                speed: 50,
                lifetime: 1,
                radius: 0.3,
                manaRequired: 25,
                cooldown: 2,
                gravity: 0,
                color: 0x00ffff,
                trailLength: 15,
                scale: 0.8
            },
            manaBlast: {
                type: 'manaBlast',
                damage: 15,
                speed: 25,
                lifetime: 3,
                radius: 1,
                manaRequired: 10,
                cooldown: 0.5,
                gravity: -3,
                color: 0x8800ff,
                trailLength: 25,
                scale: 1.2
            }
        };
    }

    createSpellVisuals() {
        // Create base geometries for spells
        this.spellGeometries = {
            sphere: new THREE.SphereGeometry(1, 16, 16),
            bolt: new THREE.ConeGeometry(0.3, 2, 8)
        };

        // Create materials for spells
        this.spellMaterials = new Map();
        
        // Create trail geometry
        this.trailGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(900); // 100 points * 3 coordinates * 3 vertices
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Trail material will be created per spell
    }

    createSpell(type, position, direction, caster) {
        const spellConfig = this.spellTypes[type];
        if (!spellConfig) return null;

        const spell = new Spell(spellConfig);
        const spellId = `spell_${Date.now()}_${Math.random()}`;
        
        // Set initial position and velocity
        spell.position.copy(position);
        spell.velocity.copy(direction).normalize().multiplyScalar(spell.speed);
        
        // Create visual representation
        const geometry = type === 'lightning' ? this.spellGeometries.bolt : this.spellGeometries.sphere;
        
        // Create or reuse material
        let material = this.spellMaterials.get(type);
        if (!material) {
            material = new THREE.MeshStandardMaterial({
                color: spell.color,
                emissive: spell.color,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.8
            });
            this.spellMaterials.set(type, material);
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.setScalar(spell.scale);
        mesh.position.copy(position);
        
        // Create spell trail
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: spell.color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        
        const trail = new THREE.Mesh(this.trailGeometry.clone(), trailMaterial);
        trail.geometry.setDrawRange(0, 0);
        
        // Store spell data
        this.spells.set(spellId, {
            spell,
            mesh,
            trail,
            caster,
            startTime: this.engine.elapsed,
            trailPoints: []
        });
        
        // Add to scene
        this.scene.add(mesh);
        this.scene.add(trail);
        
        return spellId;
    }

    castSpell(type, caster) {
        const spellConfig = this.spellTypes[type];
        if (!spellConfig) return null;

        const currentTime = this.engine.elapsed;
        const spell = new Spell(spellConfig);

        // Check if spell can be cast
        if (!spell.canCast(currentTime, caster.mana)) {
            return null;
        }

        // Deduct mana
        caster.mana -= spell.manaRequired;
        spell.lastCastTime = currentTime;

        // Calculate spawn position slightly in front of the caster
        const spawnPos = this._tempVec3.copy(caster.body.position)
            .add(new THREE.Vector3(0, 1, 0))  // Slightly above center
            .add(caster.controller.getForwardVector().multiplyScalar(2));

        // Get direction based on caster's orientation
        const direction = caster.controller.getForwardVector();

        // Create the spell
        const spellId = this.createSpell(type, spawnPos, direction, caster);

        // Notify UI system
        this.engine.systems.ui.onSpellCast(type, caster.mana);

        return spellId;
    }

    update(delta) {
        const currentTime = this.engine.elapsed;
        const gravity = new THREE.Vector3(0, -9.81, 0);
        
        // Update each active spell
        for (const [spellId, data] of this.spells.entries()) {
            const { spell, mesh, trail, startTime, trailPoints } = data;
            
            // Check lifetime
            if (currentTime - startTime > spell.lifetime) {
                this.removeSpell(spellId);
                continue;
            }
            
            // Update physics
            // Apply gravity if specified
            if (spell.gravity !== 0) {
                spell.velocity.y += spell.gravity * delta;
            }
            
            // Update position
            spell.position.addScaledVector(spell.velocity, delta);
            
            // Update mesh
            mesh.position.copy(spell.position);
            
            // Rotate mesh to face direction of travel
            if (spell.type === 'lightning') {
                mesh.quaternion.setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    spell.velocity.clone().normalize()
                );
            }
            
            // Update trail
            trailPoints.unshift(spell.position.clone());
            if (trailPoints.length > spell.trailLength) {
                trailPoints.pop();
            }
            
            // Update trail geometry
            if (trailPoints.length > 1) {
                const positions = trail.geometry.attributes.position.array;
                let vertexIndex = 0;
                
                for (let i = 0; i < trailPoints.length - 1; i++) {
                    const current = trailPoints[i];
                    const next = trailPoints[i + 1];
                    
                    // Calculate perpendicular vector for trail width
                    const forward = next.clone().sub(current).normalize();
                    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0))
                        .normalize().multiplyScalar(0.2 * (1 - i / trailPoints.length));
                    
                    // Create two vertices for the trail segment
                    const v1 = current.clone().add(right);
                    const v2 = current.clone().sub(right);
                    
                    // Add vertices to geometry
                    positions[vertexIndex++] = v1.x;
                    positions[vertexIndex++] = v1.y;
                    positions[vertexIndex++] = v1.z;
                    
                    positions[vertexIndex++] = v2.x;
                    positions[vertexIndex++] = v2.y;
                    positions[vertexIndex++] = v2.z;
                    
                    positions[vertexIndex++] = next.x;
                    positions[vertexIndex++] = next.y;
                    positions[vertexIndex++] = next.z;
                }
                
                trail.geometry.attributes.position.needsUpdate = true;
                trail.geometry.setDrawRange(0, (trailPoints.length - 1) * 3);
            }
            
            // Check collisions
            this.checkSpellCollisions(spellId, data);
        }
    }

    checkSpellCollisions(spellId, spellData) {
        const { spell, caster } = spellData;
        
        // Check terrain collision
        const terrainHeight = this.engine.systems.world.getTerrainHeight(
            spell.position.x,
            spell.position.z
        );
        
        if (spell.position.y <= terrainHeight) {
            this.handleSpellCollision(spellId, 'terrain', spell.position.clone());
            return;
        }
        
        // Check player collisions
        for (const [playerId, player] of this.engine.systems.player.players) {
            // Don't collide with caster
            if (player === caster) continue;
            
            const distance = player.body.position.distanceTo(spell.position);
            if (distance <= spell.radius + 1) { // 1 = player radius
                this.handleSpellCollision(spellId, 'player', player);
                return;
            }
        }
    }

    handleSpellCollision(spellId, type, target) {
        const spellData = this.spells.get(spellId);
        if (!spellData) return;
        
        const { spell } = spellData;
        
        // Create collision effect
        this.createCollisionEffect(spell, type, target);
        
        // Handle damage if hit player
        if (type === 'player' && target.health) {
            target.health = Math.max(0, target.health - spell.damage);
            
            // Notify UI system
            this.engine.systems.ui.onPlayerDamaged(target);
            
            // Apply knockback
            const knockbackForce = spell.velocity.clone()
                .normalize()
                .multiplyScalar(spell.damage * 0.5);
            target.body.velocity.add(knockbackForce);
        }
        
        // Remove the spell
        this.removeSpell(spellId);
    }

    createCollisionEffect(spell, type, position) {
        // Create particle effect based on spell type
        const particleCount = 20;
        const particles = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 4, 4),
                new THREE.MeshBasicMaterial({
                    color: spell.color,
                    transparent: true,
                    opacity: 0.8
                })
            );
            
            // Random position within sphere
            const radius = 0.5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            particle.position.set(
                position.x + radius * Math.sin(phi) * Math.cos(theta),
                position.y + radius * Math.sin(phi) * Math.sin(theta),
                position.z + radius * Math.cos(phi)
            );
            
            // Random velocity
            const speed = 5 + Math.random() * 5;
            particle.userData.velocity = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() * 0.5 + 0.5,
                Math.random() - 0.5
            ).normalize().multiplyScalar(speed);
            
            particle.userData.life = 1.0;
            particles.add(particle);
        }
        
        this.scene.add(particles);
        
        // Animate particles
        const animateParticles = (delta) => {
            let allDead = true;
            
            particles.children.forEach((particle) => {
                particle.position.add(
                    particle.userData.velocity.clone().multiplyScalar(delta)
                );
                
                particle.userData.velocity.y -= 9.81 * delta; // Apply gravity
                particle.userData.life -= delta * 2;
                
                const life = particle.userData.life;
                particle.scale.setScalar(life);
                particle.material.opacity = life;
                
                if (life > 0) allDead = false;
            });
            
            if (allDead) {
                this.scene.remove(particles);
                particles.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
                return;
            }
            
            requestAnimationFrame(() => animateParticles(0.016));
        };
        
        animateParticles(0.016);
    }

    removeSpell(spellId) {
        const spellData = this.spells.get(spellId);
        if (!spellData) return;
        
        const { mesh, trail } = spellData;
        
        // Remove from scene
        this.scene.remove(mesh);
        this.scene.remove(trail);
        
        // Dispose geometries and materials
        trail.geometry.dispose();
        
        // Remove from spells map
        this.spells.delete(spellId);
    }
}