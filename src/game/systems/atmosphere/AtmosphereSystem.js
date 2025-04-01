// src/game/systems/AtmosphereSystem.js
import { System } from "../../core/v2/System";
import { SkySystem } from './SkySystem';
import { StarSystem } from './StarSystem';
import { SunSystem } from './SunSystem';
import { MoonSystem } from './MoonSystem';
import { CloudSystem } from './CloudSystem';

export class AtmosphereSystem extends System {
    constructor(engine) {
        super(engine, 'atmosphere');
        
        this.requireDependencies(['world']);
        
        this.scene = engine.scene;
        
        // Initialize subsystems in the correct order
        this.sun = new SunSystem(this);
        this.sky = new SkySystem(this);
        this.moon = new MoonSystem(this);
        this.stars = new StarSystem(this);
        this.clouds = new CloudSystem(this);
        
        // Time settings
        this.timeOfDay = 0;
        this.dayLength = 600;
        this.timeScale = 1.0;
        
        // Moon phase tracking
        this.dayCount = 0;
        this.lunarCycle = 28; // 28 day lunar cycle
    }

    getNightFactor() {
        const sunPosition = this.sun.getSunPosition();
        if (!sunPosition) return 0;

        const altitude = sunPosition.y;
        
        if (altitude < -300) {
            return 1.0; // Full night
        } else if (altitude > 300) {
            return 0.0; // Full day
        } else {
            return (300 - altitude) / 600;
        }
    }

    getMoonPhase() {
        // Calculate moon phase (0-1)
        // 0 = new moon, 0.5 = full moon, 1 = back to new moon
        return (this.dayCount % this.lunarCycle) / this.lunarCycle;
    }

    getMoonIllumination() {
      // Calculate moon illumination based on phase (0-1)
      const phase = this.getMoonPhase();
      
      // Convert phase to illumination percentage
      // Using cosine function to smoothly transition between phases
      // Phase 0 or 1 = new moon (0% illumination)
      // Phase 0.5 = full moon (100% illumination)
      return Math.cos((phase * 2 - 1) * Math.PI) * 0.5 + 0.5;
  }
  
    async _initialize() {
        console.log("Initializing AtmosphereSystem");
        
        try {
            // Initialize sun first
            await this.sun.initialize();
            
            // Then initialize other subsystems
            await Promise.all([
                this.sky.initialize(),
                this.moon.initialize(),
                this.stars.initialize(),
                this.clouds.initialize()
            ]);
            
            console.log("AtmosphereSystem initialized successfully");
        } catch (error) {
            console.error("Failed to initialize AtmosphereSystem:", error);
            throw error;
        }
    }


    _update(deltaTime) {
        // Update time of day
        this.timeOfDay += (deltaTime * this.timeScale) / this.dayLength;
        
        // Handle day transition
        if (this.timeOfDay >= 1) {
            this.timeOfDay -= 1;
            this.dayCount++;
        }

        // Update sun first
        this.sun.update(deltaTime);
        
        // Get current state after sun update
        const state = {
            timeOfDay: this.timeOfDay,
            nightFactor: this.getNightFactor(),
            moonPhase: this.getMoonPhase(),
            sunPosition: this.sun.getSunPosition()
        };
        
        // Update other subsystems with state
        this.sky.update(deltaTime, state);
        this.moon.update(deltaTime, state);
        this.stars.update(deltaTime, state);
        this.clouds.update(deltaTime, state);
    }

    getTimeOfDay() {
        return this.timeOfDay;
    }

    getDayCount() {
        return this.dayCount;
    }

    setTimeScale(scale) {
        this.timeScale = Math.max(0, Math.min(10, scale));
    }

    handleVisibilityChange(isVisible) {
        this.sun.setSunVisibility(isVisible);
        this.sky.handleVisibilityChange(isVisible);
        this.moon.handleVisibilityChange(isVisible);
        this.stars.handleVisibilityChange(isVisible);
        this.clouds.handleVisibilityChange(isVisible);
    }
}