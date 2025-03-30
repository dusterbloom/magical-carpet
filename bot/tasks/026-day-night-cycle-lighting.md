# Task: Day-Night Cycle Lighting Improvements

## 1. Task & Context
**Task:** Improve the day-night cycle to make the sky and lighting change color with time of day, ensuring it actually gets dark at night
**Scope:** Sky and lighting systems in atmosphere components
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Update the SkySystem and SunSystem to properly adjust sky, fog, ambient light, and sun intensity based on time of day
**Complexity:** 2-Moderate
**Uncertainty:** 2-Medium
**Unknowns:** Whether current implementation has any performance implications with constant color changes
**Human Input Needed:** No

## 3. Implementation
First, I'll modify the SkySystem.js to properly update the sky material properties based on time of day:

```javascript
// In SkySystem.js - updateSkyColors method
updateSkyColors() {
  const timeOfDay = this.atmosphereSystem.getTimeOfDay();
  const nightFactor = this.atmosphereSystem.getNightFactor();
  let fogColor;
  
  // Update sky material properties based on time of day
  const uniforms = this.sky.material.uniforms;
  
  // Update fog color based on time of day
  if (timeOfDay < 0.25) {
    // Night to sunrise transition
    const t = timeOfDay / 0.25;
    fogColor = new THREE.Color(0x000010).lerp(new THREE.Color(0xff9933), t);
    
    // Night sky parameters
    const sunriseProgress = timeOfDay / 0.25; // 0 at midnight, 1 at sunrise
    uniforms['turbidity'].value = 8 * sunriseProgress + 0.5;
    uniforms['rayleigh'].value = 1 * sunriseProgress + 0.2;
    uniforms['mieCoefficient'].value = 0.025 * sunriseProgress + 0.001;
  } else if (timeOfDay < 0.5) {
    // Sunrise to noon
    const t = (timeOfDay - 0.25) / 0.25;
    fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x89cff0), t);
    
    // Morning sky parameters
    uniforms['turbidity'].value = 8;
    uniforms['rayleigh'].value = 1 * t + 0.5;
    uniforms['mieCoefficient'].value = 0.025;
  } else if (timeOfDay < 0.75) {
    // Noon to sunset
    const t = (timeOfDay - 0.5) / 0.25;
    fogColor = new THREE.Color(0x89cff0).lerp(new THREE.Color(0xff9933), t);
    
    // Afternoon sky parameters
    uniforms['turbidity'].value = 8;
    uniforms['rayleigh'].value = 1;
    uniforms['mieCoefficient'].value = 0.025;
  } else {
    // Sunset to night
    const t = (timeOfDay - 0.75) / 0.25;
    fogColor = new THREE.Color(0xff9933).lerp(new THREE.Color(0x000010), t);
    
    // Evening sky parameters
    const nightProgress = (timeOfDay - 0.75) / 0.25; // 0 at sunset, 1 at midnight
    uniforms['turbidity'].value = 8 * (1 - nightProgress) + 0.5;
    uniforms['rayleigh'].value = 1 * (1 - nightProgress) + 0.2;
    uniforms['mieCoefficient'].value = 0.025 * (1 - nightProgress) + 0.001;
  }
  
  // Adjust renderer exposure based on time of day
  const baseExposure = 0.6;
  const exposureRange = 0.4;
  this.engine.renderer.toneMappingExposure = baseExposure - nightFactor * exposureRange;
  
  // Update fog
  if (this.scene.fog) {
    this.scene.fog.color = fogColor;
  }
}
```

Then, I'll modify the SunSystem.js to properly adjust ambient light intensity based on time of day:

```javascript
// In SunSystem.js - updateSunLight method
updateSunLight(timeOfDay) {
  // Update sunlight position
  this.sunLight.position.copy(this.sunPosition);
  
  const nightFactor = this.atmosphereSystem.getNightFactor();
  
  // Update sunlight color and intensity based on time of day
  if (timeOfDay > 0.25 && timeOfDay < 0.35) {
    // Sunrise - more orange
    this.sunLight.color.setHex(0xffaa33);
    this.sunLight.intensity = 1.0;
    this.ambientLight.intensity = 0.4 + 0.3 * ((timeOfDay - 0.25) / 0.1);
  } else if (timeOfDay > 0.65 && timeOfDay < 0.75) {
    // Sunset - more orange/red
    this.sunLight.color.setHex(0xff7733);
    this.sunLight.intensity = 1.0;
    this.ambientLight.intensity = 0.4 + 0.3 * (1 - ((timeOfDay - 0.65) / 0.1));
  } else if (timeOfDay > 0.35 && timeOfDay < 0.65) {
    // Day - yellow/white
    this.sunLight.color.setHex(0xffffcc);
    this.sunLight.intensity = 1.2;
    this.ambientLight.intensity = 0.7;
  } else {
    // Night - dim blue
    this.sunLight.color.setHex(0x334455);
    this.sunLight.intensity = 0.1;
    
    // Reduce ambient light at night for darkness
    // Use a minimum value to avoid complete darkness
    this.ambientLight.intensity = 0.1;
    this.ambientLight.color.setHex(0x112233); // Bluish night ambient
  }
}
```

## 4. Check & Commit
**Changes Made:**
- Updated SkySystem.js to modify sky material properties based on time of day
- Added tone mapping exposure adjustments to make nights darker
- Enhanced SunSystem.js to adjust ambient light color and intensity for day/night transitions
- Used nightFactor to properly control darkness levels during night time
- Set night-specific ambient light color to create a blue-tinted moonlight feel

**Commit Message:** "feat: Improved day-night cycle with proper darkness and lighting transitions"

**Status:** Complete

**Testing Notes:**
- The changes should make nights darker with a blue tint
- Day-night transitions should be more pronounced
- The sky color transition should now match the ambient lighting changes
