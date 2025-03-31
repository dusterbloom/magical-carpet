# Task 043: Improve Sky & Light Colors

## 1. Task & Context
**Task:**  
Improve the color transitions of the sky and lighting throughout the day/night cycle. Specifically:
- **Dusk and Dawn:** Ensure these times have smooth, warm transitional hues.
- **Night:** Ensure the overall scene becomes noticeably darker with cooler tones.

**Files Affected:**
- `src/game/systems/atmosphere/SkySystem.js` – (method: `updateSkyColors()`)
- `src/game/systems/atmosphere/SunSystem.js` – (method: `updateSunLight()` newly created, `updateSunAppearance()` modified)

**Branch:** slow-mode  
**Project Path:** `C:\Users\PC\Desktop\magical-carpet`

---

## 2. Quick Plan
**Approach:**  
- In **SkySystem.js**, improve sky colors interpolation (top, bottom, and fog) based on the time-of-day using `THREE.Color.lerp()`.
- In **SunSystem.js**, split lighting functionality into a dedicated method and update the sun and ambient light properties to have warm hues during sunrise/sunset and a darker, cooler tone at night.

**Complexity:** 2/3  
**Uncertainty:** 1/3  

---

## 3. Implementation

### Update Sky Colors in `SkySystem.js`
Enhanced the sky material's uniforms and fog colors based on the current time of day:

1. **Critical Fix**: Set the sky shader's `sunPosition` uniform to properly drive sky coloration
2. **Added renderer background color changes** for night time to ensure sky appears properly dark
3. Modified the sky atmosphere parameters for more dramatic day/night transitions:
   - `turbidity`: Reduced to 0.5 at night (from 2.0) for darker sky
   - `rayleigh`: Reduced to 0.05 at night (from 0.2) for much less blue scattering
   - Tone mapping exposure reduced at night for overall darkness
4. Improved fog color transitions for all time segments
5. Used `getNightFactor()` to smoothly blend background color between day and night

### Update Star System in `StarSystem.js`
Reduced star brightness to avoid overpowering the night sky:

1. Decreased the opacity of stars during nighttime
2. Applied a multiplier of 0.8 to regular stars and 0.7 to horizon stars
3. This ensures stars are visible but don't make the sky appear artificially bright

### Update Lighting in `SunSystem.js`
1. Split the lighting functionality from `updateSunAppearance()` into a new dedicated method `updateSunLight()`
2. Added explicit time-of-day-based lighting changes for:
   - Sunrise (0.25-0.35): Warm orange light with gradually increasing brightness
   - Daytime (0.35-0.65): Bright white-yellow light
   - Sunset (0.65-0.75): Warm orange-red light with gradually decreasing brightness
   - Night (0.75-0.25): Very dark blue-tinted light with minimal intensity (0.05)
3. Added ambient light color transitions to match the directional light
4. Improved night lighting to be much darker (0.05 intensity) and deeper blue-toned

---

## 4. Check & Commit
- **Verification:**  
  - Sky now shows smooth and natural color transitions during dawn and dusk
  - Night-time settings produce a darker, cooler ambiance
  - Sunrise and sunset have warm, orange tones
  - Daytime has bright, clear lighting
  - Changes have been tested on branch _slow-mode_ in the `magical-carpet` project

- **Commit Message:**  
  `feat: Improved day-night cycle with enhanced sky and lighting color transitions`
