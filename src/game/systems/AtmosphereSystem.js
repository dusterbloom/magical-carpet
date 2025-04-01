import * as THREE from 'three';
import { System } from "../core/v2/System";
import { SkySystem } from './atmosphere/SkySystem';
import { StarSystem } from './atmosphere/StarSystem';
import { SunSystem } from './atmosphere/SunSystem';
import { MoonSystem } from './atmosphere/MoonSystem';
import { CloudSystem } from './atmosphere/CloudSystem';

export class AtmosphereSystem extends System {
    constructor(engine) {
        // Match the ID that's expected in Engine.js registration
        super(engine, 'atmosphere');  // This ID must match the one in Engine.js
        
        // Declare dependencies
        this.requireDependencies(['world']);
        
        this.scene = engine.scene;
        
        // Initialize subsystems
        this.sky = new SkySystem(this);
        this.stars = new StarSystem(this);
        this.sun = new SunSystem(this);
        this.moon = new MoonSystem(this);
        this.clouds = new CloudSystem(this);
        
        // Time of day settings
        this.timeOfDay = 0;
        this.dayLength = 600;
        this.timeScale = 1.0;
    }

    async _initialize() {
      console.log("Initializing AtmosphereSystem with ID:", this.id);
      
      try {
          // Update initial sun position
          this.sunPosition = this.calculateSunPosition(this.timeOfDay);
          
          // Initialize all subsystems with proper context
          await Promise.all([
              this.sky.initialize(this.getAtmosphereState()),
              this.stars.initialize(this.getAtmosphereState()),
              this.sun.initialize(this.getAtmosphereState()),
              this.moon.initialize(this.getAtmosphereState()),
              this.clouds.initialize(this.getAtmosphereState())
          ]);
          
          // Set up initial atmosphere state
          this.updateAtmosphereState();
          
          console.log("AtmosphereSystem initialized successfully");
      } catch (error) {
          console.error("Failed to initialize AtmosphereSystem:", error);
      }
  }

  calculateSunPosition(timeOfDay) {
    // Calculate sun position based on time of day
    const angle = (timeOfDay * Math.PI * 2) - Math.PI / 2;
    const radius = 1000; // Distance from center
    
    // Calculate position
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = 0;
    
    return new THREE.Vector3(x, y, z);
}

getNightFactor() {
    // Calculate sun position
    const sunPos = this.calculateSunPosition(this.timeOfDay);
    
    // Normalize height to [-1, 1] range
    const normalizedHeight = sunPos.y / 1000;
    
    if (normalizedHeight < -0.1) {
        // Full night
        return 1.0;
    } else if (normalizedHeight > 0.1) {
        // Full day
        return 0.0;
    } else {
        // Transition (dawn/dusk)
        return (0.1 - normalizedHeight) / 0.2;
    }
}

  // Add method to get current atmosphere state
  getAtmosphereState() {
      return {
          timeOfDay: this.timeOfDay,
          nightFactor: this.getNightFactor(),
          sunPosition: this.sun.getPosition(),
          moonPosition: this.moon.getPosition(),
          weather: this.weatherState,
          params: this.atmosphereParams
      };
  }


    _update(deltaTime) {
        // Update time of day
        this.timeOfDay += (deltaTime * this.timeScale) / this.dayLength;
        if (this.timeOfDay >= 1) this.timeOfDay -= 1;
        
        // Update subsystems
        this.updateSubsystems(deltaTime);
        
        // Update atmosphere parameters based on time of day
        this.updateAtmosphereState();
        
        // Update weather conditions
        this.updateWeather(deltaTime);
    }

    updateSubsystems(deltaTime) {
        // Update each subsystem with current state
        const atmosphereState = {
            timeOfDay: this.timeOfDay,
            weather: this.weatherState,
            params: this.atmosphereParams
        };

        this.sky.update(deltaTime, atmosphereState);
        this.stars.update(deltaTime, atmosphereState);
        this.sun.update(deltaTime, atmosphereState);
        this.moon.update(deltaTime, atmosphereState);
        this.clouds.update(deltaTime, atmosphereState);
    }

    updateAtmosphereState() {
        // Calculate sun position
        const sunPosition = this.sun.calculatePosition(this.timeOfDay);
        
        // Adjust atmosphere parameters based on time of day
        const sunHeight = sunPosition.y;
        
        // Update turbidity based on time of day and weather
        this.atmosphereParams.turbidity = this.calculateTurbidity(sunHeight);
        
        // Update rayleigh scattering based on sun height
        this.atmosphereParams.rayleigh = this.calculateRayleigh(sunHeight);
        
        // Update mie scattering based on weather
        this.atmosphereParams.mieCoefficient = this.calculateMieCoefficient();
    }

    updateWeather(deltaTime) {
        // Gradually change weather conditions
        this.weatherState.cloudCover += (Math.random() - 0.5) * 0.01 * deltaTime;
        this.weatherState.cloudCover = Math.max(0, Math.min(1, this.weatherState.cloudCover));
        
        // Update wind
        this.weatherState.windSpeed += (Math.random() - 0.5) * 0.1 * deltaTime;
        this.weatherState.windSpeed = Math.max(0, Math.min(2, this.weatherState.windSpeed));
        
        // Rotate wind direction
        this.weatherState.windDirection += (Math.random() - 0.5) * 10 * deltaTime;
    }

    calculateTurbidity(sunHeight) {
        // Base turbidity
        let turbidity = 10;
        
        // Adjust for time of day
        if (sunHeight < 0) {
            // Night time - clearer sky
            turbidity *= 0.5;
        } else if (sunHeight < 0.2) {
            // Dawn/dusk - hazier
            turbidity *= 1.2;
        }
        
        // Adjust for weather
        turbidity *= (1 + this.weatherState.cloudCover);
        
        return Math.max(1, Math.min(20, turbidity));
    }

    calculateRayleigh(sunHeight) {
        // Base rayleigh scattering
        let rayleigh = 3;
        
        // Adjust for time of day
        if (sunHeight < 0) {
            // Night time - more scattering
            rayleigh *= 1.5;
        } else if (sunHeight < 0.2) {
            // Dawn/dusk - much more scattering
            rayleigh *= 2;
        }
        
        return Math.max(1, Math.min(5, rayleigh));
    }

    calculateMieCoefficient() {
        // Base mie scattering
        let mie = 0.005;
        
        // Adjust for weather
        mie *= (1 + this.weatherState.cloudCover * 2);
        
        return Math.max(0.001, Math.min(0.1, mie));
    }

    // Public methods for other systems to interact with
    getSunPosition() {
      return this.sunPosition.clone();
  }

  getMoonPosition() {
      return this.moon.position?.clone() || new THREE.Vector3();
  }

    getTimeOfDay() {
        return this.timeOfDay;
    }

    setTimeScale(scale) {
        this.timeScale = Math.max(0, Math.min(10, scale));
    }

    setWeather(weatherParams) {
        Object.assign(this.weatherState, weatherParams);
        this.updateAtmosphereState();
    }


    getAtmosphereState() {
      return {
          timeOfDay: this.timeOfDay,
          nightFactor: this.getNightFactor(),
          sunPosition: this.sunPosition,
          moonPosition: this.moon.position,
          weather: this.weatherState,
          params: this.atmosphereParams
      };
  }


    updateSubsystems(deltaTime) {
      const atmosphereState = this.getAtmosphereState();

      // Update each subsystem with current state
      this.sky.update(deltaTime, atmosphereState);
      this.stars.update(deltaTime, atmosphereState);
      this.sun.update(deltaTime, atmosphereState);
      this.moon.update(deltaTime, atmosphereState);
      this.clouds.update(deltaTime, atmosphereState);
  }

    updateAtmosphereState() {
      // Calculate sun position
      const sunHeight = this.sunPosition.y / 1000; // Normalize to [-1, 1]
      
      // Update turbidity based on time of day and weather
      this.atmosphereParams.turbidity = this.calculateTurbidity(sunHeight);
      
      // Update rayleigh scattering based on sun height
      this.atmosphereParams.rayleigh = this.calculateRayleigh(sunHeight);
      
      // Update mie scattering based on weather
      this.atmosphereParams.mieCoefficient = this.calculateMieCoefficient();
  }


    handleVisibilityChange(isVisible) {
        // Pause/resume time progression when tab is hidden/visible
        this.timeScale = isVisible ? 1.0 : 0;
        
        // Propagate to subsystems
        this.sky.handleVisibilityChange(isVisible);
        this.stars.handleVisibilityChange(isVisible);
        this.sun.handleVisibilityChange(isVisible);
        this.moon.handleVisibilityChange(isVisible);
        this.clouds.handleVisibilityChange(isVisible);
    }

}