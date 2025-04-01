// src/game/systems/atmosphere/SkySystem.js
import * as THREE from 'three';

export class SkySystem {
    constructor(atmosphereSystem) {
        this.atmosphereSystem = atmosphereSystem;
        this.scene = atmosphereSystem.scene;
        
        // Sky colors
        this.dayColor = new THREE.Color(0x87CEEB);    // Sky blue
        this.nightColor = new THREE.Color(0x1a1a2a);  // Dark blue
        this.dawnColor = new THREE.Color(0xFF7F50);   // Coral
        this.currentColor = new THREE.Color();
    }

    async initialize() {
        console.log("Initializing SkySystem");
    }

    update(deltaTime, state) {
        this.updateSkyColors(state);
    }

    updateSkyColors(state) {
        const { timeOfDay, nightFactor } = state;
        
        if (nightFactor <= 0) {
            // Full day
            this.currentColor.copy(this.dayColor);
        } else if (nightFactor >= 1) {
            // Full night
            this.currentColor.copy(this.nightColor);
        } else {
            // Dawn/dusk transition
            if (timeOfDay < 0.5) {
                // Dawn
                this.currentColor.lerpColors(this.dawnColor, this.dayColor, 1 - nightFactor);
            } else {
                // Dusk
                this.currentColor.lerpColors(this.dawnColor, this.nightColor, nightFactor);
            }
        }

        // Update renderer clear color
        const renderer = this.atmosphereSystem.engine.renderer.instance;
        if (renderer) {
            renderer.setClearColor(this.currentColor);
        }
    }

    handleVisibilityChange(isVisible) {
        // Handle visibility changes if needed
    }
}