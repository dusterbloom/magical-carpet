# Task: Natural Moon Movement and Sun/Moon Calendar

## 1. Task & Context
**Task:** Make the moon move naturally in the sky, fixing the current issue where it appears out of nowhere and "moonsets" at the same spot. Add a moon and sun calendar system.
**Scope:** MoonSystem.js, SunSystem.js, AtmosphereSystem.js
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Create a moon phase calendar and update moon position calculation to follow a more natural orbit trajectory. Add a month-based lunar cycle to control moon phases and appearance.
**Complexity:** 2-Moderate
**Uncertainty:** 2-Medium
**Unknowns:** 
- How should the moon orbit vs the sun path be coordinated
- How to best implement moon phases visually
**Human Input Needed:** No - will implement based on existing patterns

## 3. Implementation
First, I'll add a moon phase calendar to the AtmosphereSystem.js:

```javascript
// In AtmosphereSystem.js - add these properties to constructor
this.currentDay = 0;
this.daysPerMonth = 30;
this.currentMonth = 0;
this.monthsPerYear = 12;
this.yearProgress = 0; // 0.0-1.0 for seasonal changes
this.moonPhase = 0; // 0.0-1.0 (0 = new moon, 0.5 = full moon, 1.0 = new moon)
```

```javascript
// In AtmosphereSystem.js - add this method after the constructor
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
```

```javascript
// In AtmosphereSystem.js - update the update() method
update(delta, elapsed) {
  // Update elapsed time
  this.elapsed = elapsed;
  
  // Update time of day (0.0-1.0)
  const previousTimeOfDay = this.timeOfDay;
  this.timeOfDay += delta / this.dayDuration;
  
  // Detect day transitions
  if (this.timeOfDay >= 1.0) {
    this.timeOfDay -= 1.0;
    // When we have a day transition, update the calendar
    this.updateCalendar(delta);
  }
  
  // Update all subsystems
  this.skySystem.update(delta);
  this.sunSystem.update(delta);
  this.moonSystem.update(delta);
  this.starSystem.update(delta);
  this.cloudSystem.update(delta);
}
```

```javascript
// In AtmosphereSystem.js - add these new methods
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
```

Now, let's update the MoonSystem.js to use the moon phase:

```javascript
// In MoonSystem.js - update the update() method
update(delta) {
  const timeOfDay = this.atmosphereSystem.getTimeOfDay();
  const nightFactor = this.atmosphereSystem.getNightFactor();
  const moonPhase = this.atmosphereSystem.getMoonPhase();
  const moonIllumination = this.atmosphereSystem.getMoonIllumination();
  
  // Calculate moon position with slight variation from being exactly opposite to sun
  // This creates more natural moon rise/set cycles that vary with the lunar month
  const timeOffset = 0.5 + (moonPhase * 0.1 - 0.05); // Varies between 0.45 and 0.55
  const moonAngle = ((timeOfDay + timeOffset) % 1.0) * Math.PI * 2;
  
  // Modify height based on moon phase
  // Moon is higher in sky during full moon, lower during new moon
  const heightFactor = 0.8 + moonIllumination * 0.4; // 0.8 to 1.2
  
  // Calculate orbital path
  // Moon follows an elliptical path that's not exactly opposite the sun
  const radius = 9000; // Slightly smaller than sun distance
  const height = 5000 * heightFactor;
  
  this.moonPosition.set(
    radius * Math.cos(moonAngle),
    height * Math.sin(moonAngle), 
    radius * 0.5 * Math.sin(moonAngle * 0.7) // Slightly different z-curve for natural path
  );
  
  this.moonMesh.position.copy(this.moonPosition);
  
  // Update moon visibility based on night factor and moon phase
  // Hide moon during new moon phase even at night
  const isVisible = nightFactor > 0.05 && moonIllumination > 0.05;
  this.moonMesh.visible = isVisible;
  
  // Make moon face camera
  if (this.engine.camera) {
    this.moonMesh.lookAt(this.engine.camera.position);
  }
  
  // Update moon appearance based on phase
  if (this.moonMesh.material) {
    // Adjust brightness based on illumination
    this.moonMesh.material.emissiveIntensity = 0.5 + moonIllumination * 0.5;
  }
  
  // Update moonlight intensity based on night factor and moon illumination
  if (this.moonLight) {
    // Moonlight is strongest during full moon, weakest during new moon
    this.moonLight.intensity = 0.2 * nightFactor * moonIllumination;
  }
  
  // Rotate the moon to show the correct phase (simplified approximation)
  // This rotates the texture to match the current phase
  this.moonMesh.rotation.y = (moonPhase * Math.PI * 2) % (Math.PI * 2);
}
```

Finally, let's add a small tweak to the SunSystem.js to maintain consistency:

```javascript
// In SunSystem.js - update method
update(delta) {
  const timeOfDay = this.atmosphereSystem.getTimeOfDay();
  
  // Get current month for seasonal variation
  const yearProgress = this.atmosphereSystem.yearProgress || 0;
  
  // Calculate sun position based on time of day with seasonal variation
  const sunAngle = timeOfDay * Math.PI * 2;
  
  // Seasonal variation - sun is higher in summer, lower in winter
  // Assuming year starts with winter (yearProgress 0 = winter)
  const seasonalHeight = Math.sin(yearProgress * Math.PI * 2) * 0.2 + 1.0; // 0.8 to 1.2
  
  const radius = 10000;
  const height = 5000 * seasonalHeight; // Adjust height based on season
  
  this.sunPosition.set(
    Math.cos(sunAngle) * radius,
    Math.sin(sunAngle) * height,
    Math.sin(sunAngle * 0.5) * radius
  );
  
  // Update sun sphere position
  this.sunSphere.position.copy(this.sunPosition);
  
  // Update sun visibility (visible during day only)
  this.sunSphere.visible = timeOfDay > 0.25 && timeOfDay < 0.75;
  
  // Update sunlight position and color
  this.updateSunLight(timeOfDay);
}
```

## 4. Check & Commit
**Changes Made:**
- Added calendar system to AtmosphereSystem.js to track days, months, and moon phases
- Updated moon positioning to create a more natural orbit that varies with lunar phase
- Adjusted moon visibility and appearance based on moon phase
- Added moon illumination calculation based on phase
- Improved sunlight and moonlight based on time of day and lunar cycle
- Added basic seasonal variation affecting the sun's height in the sky

**Commit Message:** "feat: Implemented natural moon movement and sun/moon calendar"

**Status:** Complete

**Testing Notes:**
- The moon should now follow a more natural path across the sky
- Moon should rise and set at slightly different positions throughout the month
- Moon appearance changes with its phase (new moon is barely visible)
- Different phases of the moon affect night lighting intensity
