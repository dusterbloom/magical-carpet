// MaterialSystemIntegration.js
import * as THREE from 'three';
import { MaterialManager } from './MaterialManager.js';

export class MaterialSystemIntegration {
    constructor(engine) {
        this.engine = engine;
        this.materialManager = new MaterialManager(engine);
    }
    
    async initialize() {
        // Apply integrations
        this.integrateWithCarpetTrail();
        this.integrateWithCarpetController();
    }
    
    integrateWithCarpetTrail() {
        const trailSystem = this.engine.systems.carpetTrail;
        if (!trailSystem) return;
        
        // Override material creation methods
        const originalInitialize = trailSystem.initialize.bind(trailSystem);
        trailSystem.initialize = () => {
            console.log("Using optimized materials for carpet trail");
            
            // Create the geometries needed for particles
            trailSystem.particleGeometry = new THREE.SphereGeometry(
                0.1,
                trailSystem.isMobile ? 3 : 4,
                trailSystem.isMobile ? 3 : 4
            );
            
            // Also create the steam geometry that's needed
            trailSystem.steamGeometry = new THREE.PlaneGeometry(0.5, 0.5);
            
            // Use optimized materials from manager
            trailSystem.particleMaterial = this.materialManager.getMaterial('particle').clone();
            trailSystem.ribbonMaterial = this.materialManager.getMaterial('trail').clone();
            trailSystem.motionLineMaterial = this.materialManager.getMaterial('trail').clone();
            trailSystem.steamMaterial = this.materialManager.getMaterial('particle').clone();
            
            // Initialize pools
            trailSystem.initializePools();
        };
        
        // Override particle creation to use optimized materials
        const originalCreateParticle = trailSystem.createParticle.bind(trailSystem);
        trailSystem.createParticle = (position) => {
            const particle = originalCreateParticle(position);
            if (particle) {
                particle.material = this.materialManager.getMaterial('particle').clone();
            }
            return particle;
        };
        
        // Override steam particle creation
        const originalCreateSteamParticle = trailSystem.createSteamParticle.bind(trailSystem);
        trailSystem.createSteamParticle = (position) => {
            const particle = originalCreateSteamParticle(position);
            if (particle) {
                particle.material = this.materialManager.getMaterial('particle').clone();
                particle.material.opacity = 0.4; // Steam specific opacity
            }
            return particle;
        };
        
        // Override ribbon material updates
        const originalUpdateRibbonTrail = trailSystem.updateRibbonTrail.bind(trailSystem);
        trailSystem.updateRibbonTrail = (position) => {
            const result = originalUpdateRibbonTrail(position);
            if (trailSystem.ribbonMesh) {
                trailSystem.ribbonMesh.material = this.materialManager.getMaterial('trail').clone();
            }
            return result;
        };
    }
    
    integrateWithCarpetController() {
        const player = this.engine.systems.player?.localPlayer;
        if (!player) return;
        
        // Replace carpet material with optimized version
        const carpetMesh = player.getObjectByName('carpet');
        if (carpetMesh) {
            carpetMesh.material = this.materialManager.getMaterial('carpet');
        }
    }
    
    update(delta) {
        // Update time-based effects
        this.materialManager.updateMaterials(this.engine.elapsed);
    }
    
    reoptimizeMaterials() {
        console.log('Reoptimizing materials for new device capabilities');
        
        // Store old materials for smooth transition
        const oldMaterials = new Map(this.materialManager.materialCache);
        
        // Reinitialize material manager
        this.materialManager = new MaterialManager(this.engine);
        
        // Reapply materials to all relevant objects
        this.integrateWithCarpetTrail();
        this.integrateWithCarpetController();
        
        // Dispose old materials after a delay to ensure smooth transition
        setTimeout(() => {
            oldMaterials.forEach(material => {
                if (material.uniforms) {
                    Object.values(material.uniforms).forEach(uniform => {
                        if (uniform.value && uniform.value.isTexture) {
                            uniform.value.dispose();
                        }
                    });
                }
                material.dispose();
            });
        }, 1000);
    }
    
    dispose() {
        this.materialManager.dispose();
    }
}