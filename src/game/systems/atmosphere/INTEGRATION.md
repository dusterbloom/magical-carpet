# Integration Guide for the New AtmosphereSystem

This document provides instructions for integrating the new modular AtmosphereSystem into the game.

## Step 1: Update Imports

Replace the old AtmosphereSystem import with the new one:

```javascript
// Old import
import { AtmosphereSystem } from "./systems/AtmosphereSystem";

// New import
import { AtmosphereSystem } from "./systems/atmosphere";
```

## Step 2: Keep Initialization and Update Calls the Same

The good news is that the public API of AtmosphereSystem has been preserved, so you don't need to change how you initialize or update it:

```javascript
// Initialization - remains the same
this.systems.atmosphere = new AtmosphereSystem(this);
await this.systems.atmosphere.initialize();

// Update - remains the same
this.systems.atmosphere.update(delta, elapsed);
```

## Step 3: Additional Public Methods

The new AtmosphereSystem provides some additional public methods that can be useful:

```javascript
// Get the current time of day (0.0-1.0)
const timeOfDay = atmosphereSystem.getTimeOfDay();

// Get how "night-like" it is (0.0 = day, 1.0 = middle of night)
const nightFactor = atmosphereSystem.getNightFactor();

// Get current sun position
const sunPosition = atmosphereSystem.getSunPosition();

// Get current moon position
const moonPosition = atmosphereSystem.getMoonPosition();
```

## Step 4: Testing

After integration, test the following:

1. Day/night cycle progression
2. Sun and moon appearance and movement
3. Star visibility during night
4. Cloud generation and movement
5. Proper lighting changes throughout the day

## Optional: Customization

If you want to customize the atmosphere behavior:

```javascript
// In the constructor or after initialization:

// Change day duration (minutes per full day)
atmosphereSystem.dayDuration = 20; // 20 minutes per day

// Force a specific time of day for testing
atmosphereSystem.timeOfDay = 0.5; // Noon
// atmosphereSystem.timeOfDay = 0.0; // Midnight
// atmosphereSystem.timeOfDay = 0.25; // Sunrise
// atmosphereSystem.timeOfDay = 0.75; // Sunset
```

## Troubleshooting

If you encounter issues:

1. Check the console for specific error messages
2. Verify that all texture paths are correct
3. Ensure the scene and camera references are valid
4. Check if any Three.js version compatibility issues exist
