# AtmosphereSystem

This directory contains a complete rewrite of the Atmosphere system for the Magical Carpet game. The system has been rebuilt with a modular, component-based architecture for better maintainability and performance.

## Architecture

The AtmosphereSystem is broken down into five subsystems:

1. **SkySystem** - Manages the sky backdrop and fog
2. **SunSystem** - Controls sun appearance and lighting
3. **MoonSystem** - Controls moon appearance and night lighting
4. **StarSystem** - Manages star fields
5. **CloudSystem** - Creates and manages cloud formations

Each subsystem is responsible for a specific aspect of the atmosphere and only interacts with the main AtmosphereSystem.

## Usage

To use the AtmosphereSystem in the game engine:

```javascript
import { AtmosphereSystem } from './systems/atmosphere';

// In your game engine initialization:
this.systems.atmosphere = new AtmosphereSystem(this);
await this.systems.atmosphere.initialize();

// In your game loop:
this.systems.atmosphere.update(deltaTime, elapsedTime);
```

## Features

- **Day/Night Cycle** - Smooth transitions between day and night states
- **Dynamic Lighting** - Sun and moon lighting that changes based on time of day
- **Sky Coloring** - Sky and fog colors that shift throughout the day
- **Star Field** - Stars that appear at night with subtle twinkling
- **Volumetric Clouds** - Cloud formations that move and follow the player

## Customization

The AtmosphereSystem provides several ways to customize its behavior:

- Adjust `dayDuration` to change the length of a day-night cycle
- Override `timeOfDay` to force a specific time (useful for testing)
- Each subsystem has its own parameters that can be adjusted for different visual effects

## Performance Considerations

- The system uses efficient Three.js techniques to minimize render overhead
- Star visibility is optimized based on time of day
- Clouds are repositioned rather than recreated when they drift too far away
