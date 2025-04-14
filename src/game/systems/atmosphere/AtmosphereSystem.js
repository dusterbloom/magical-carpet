import * as THREE from "three";
import { SkySystem } from "./SkySystem";
import { SunSystem } from "./SunSystem";
import { MoonSystem } from "./MoonSystem";
import { StarSystem } from "./StarSystem";
import { CloudSystem } from "./CloudSystem";

/**
 * AtmosphereSystem - Manages all atmospheric elements in the scene
 * This includes sky, sun, moon, stars, and clouds, as well as the day/night cycle
 */
export class AtmosphereSystem {
  /**
   * Create a new AtmosphereSystem
   * @param {Engine} engine - The game engine instance
   */
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    
    // Time tracking
    this.elapsed = 0;
    this.dayDuration = 1440;   // 1440 minutes = 24 hours = 86400 seconds
    this.timeScale = 0.00277777;    // Match real time exactly (1 day in real life = 1 day in game)
    
    // Calendar tracking
    this.currentDay = 0;
    this.daysPerMonth = 30;
    this.currentMonth = 0;
    this.monthsPerYear = 12;
    this.yearProgress = 0; // 0.0-1.0 for seasonal changes
    this.moonPhase = 1; // 0.0-1.0 (0 = new moon, 0.5 = full moon, 1.0 = new moon)
    
    // Initialize time of day from system clock
    const now = new Date();
    const secondsInDay = 86400;
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    // this.timeOfDay = currentSeconds / secondsInDay; // 0.0-1.0 representing full day
    
    // Optional override for testing specific times
    this.timeOfDay = 0.5; // Noon
    // this.timeOfDay = 0.0; // Midnight
    // this.timeOfDay = 0.25; // Sunrise
    // this.timeOfDay = 0.65;  // Sunset
    
    console.log("Synced Time of Day:", this.timeOfDay);
    
    // System components (initialized in initialize())
    this.skySystem = null;
    this.sunSystem = null;
    this.moonSystem = null;
    this.starSystem = null;
    this.cloudSystem = null;
  }
  
  /**
   * Initialize the atmosphere system and all subsystems
   */
  async initialize() {
    console.log("Initializing AtmosphereSystem...");
    
    // Create subsystems
    this.skySystem = new SkySystem(this);
    this.sunSystem = new SunSystem(this);
    this.moonSystem = new MoonSystem(this);
    this.starSystem = new StarSystem(this);
    this.cloudSystem = new CloudSystem(this);
    
    // Initialize subsystems
    await Promise.all([
      this.skySystem.initialize(),
      this.sunSystem.initialize(),
      this.moonSystem.initialize(),
      this.starSystem.initialize(),
      this.cloudSystem.initialize()
    ]);
    
    console.log("AtmosphereSystem initialized");
    // LOG: CloudSystem initialized
    console.info("[CloudDebug] CloudSystem initialized");
  }
  
  /**
   * Update calendar and time tracking
   * @param {number} delta - Time delta in minutes
   */
  updateCalendar(delta) {
    // Update day tracking
    const previousDay = this.currentDay;
    
    // Advance days
    const dayProgress = delta / this.dayDuration;
    this.currentDay += dayProgress;
    
    // Handle month transitions
    if (this.currentDay >= this.daysPerMonth) {
      this.currentDay -= this.daysPerMonth;
      this.currentMonth++;
      
      // Handle year transitions
      if (this.currentMonth >= this.monthsPerYear) {
        this.currentMonth = 0;
      }
    }
    
    // Update year progress (for seasonal changes - future feature)
    this.yearProgress = (this.currentMonth + (this.currentDay / this.daysPerMonth)) / this.monthsPerYear;
    
    // Update moon phase (complete cycle over a month)
    this.moonPhase = (this.currentDay / this.daysPerMonth);
  }
  
  /**
   * Set the time of day manually
   * @param {number} hour - Hour (0-23)
   * @param {number} minute - Minute (0-59)
   */
  setTime(hour, minute) {
    // Convert to time of day (0.0-1.0)
    this.timeOfDay = (hour + (minute / 60)) / 24;
    console.log(`Time set to ${hour}:${minute.toString().padStart(2, '0')} (${this.timeOfDay.toFixed(4)})`); 
  }
  
  /**
   * Update the atmospheric systems
   * @param {number} delta - Time delta in minutes
   * @param {number} elapsed - Total elapsed time
   */
  update(delta, elapsed) {
    // Update elapsed time
    this.elapsed = elapsed;
    
    // Apply time scale to delta for time acceleration/deceleration
    const scaledDelta = delta * this.timeScale;
    
    // Update time of day (0.0-1.0)
    const previousTimeOfDay = this.timeOfDay;
    this.timeOfDay += scaledDelta / this.dayDuration;
    
    // Detect day transitions
    if (this.timeOfDay >= 1.0) {
      this.timeOfDay -= 1.0;
      // When we have a day transition, update the calendar
      this.updateCalendar(delta);
    }
    
    // Update all subsystems - ensure SunSystem updates before systems that might use it
    this.sunSystem.update(delta);  // Update SunSystem first
    this.skySystem.update(delta);  // Sky system now relies on sun system
    this.moonSystem.update(delta);
    this.starSystem.update(delta);
    this.cloudSystem.update(delta);
  }
  
  /**
   * Get the current time of day (0.0-1.0)
   * @returns {number} Time of day, where:
   *   0.0 = Midnight
   *   0.25 = Sunrise
   *   0.5 = Noon
   *   0.75 = Sunset
   */
  getTimeOfDay() {
    return this.timeOfDay;
  }
  
  /**
   * Calculate how much of night time we're in
   * @returns {number} Night factor (0.0-1.0), where:
   *   0.0 = Daytime
   *   1.0 = Middle of night
   */
  getNightFactor() {
    // Night is roughly between 0.75-0.25 timeOfDay (sunset to sunrise)
    if (this.timeOfDay > 0.75 || this.timeOfDay < 0.25) {
      // Calculate how deep into night we are
      if (this.timeOfDay > 0.75) {
        // After sunset, approaching midnight
        return (this.timeOfDay - 0.75) / 0.25;
      } else {
        // After midnight, approaching sunrise
        return 1.0 - this.timeOfDay / 0.25;
      }
    }
    return 0; // Daytime
  }
  
  /**
   * Get the position of the sun
   * @returns {THREE.Vector3} Sun position
   */
  getSunPosition() {
    return this.sunSystem ? this.sunSystem.getSunPosition() : new THREE.Vector3();
  }
  
  /**
   * Get the position of the moon
   * @returns {THREE.Vector3} Moon position
   */
  getMoonPosition() {
    return this.moonSystem ? this.moonSystem.getMoonPosition() : new THREE.Vector3();
  }
  
  /**
   * Get the current moon phase (0.0-1.0)
   * 0.0 = New Moon (not visible)
   * 0.25 = Waxing Half Moon
   * 0.5 = Full Moon
   * 0.75 = Waning Half Moon
   * @returns {number} Moon phase value
   */
  getMoonPhase() {
    return this.moonPhase;
  }

  /**
   * Get the illuminated portion of the moon (0.0-1.0)
   * @returns {number} Illumination factor
   */
  getMoonIllumination() {
    // Simplified model: illumination follows a sine wave
    // Full illumination at full moon (0.5 phase)
    // No illumination at new moon (0.0 or 1.0 phase)
    return Math.sin(this.moonPhase * Math.PI);
  }
}
