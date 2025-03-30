# AtmosphereSystem Rebuild Architecture

## Overview

The AtmosphereSystem is responsible for managing all sky-related visual elements including the sky backdrop, sun, moon, stars, and clouds. It also controls the day/night cycle timing and coordinates the visual changes across subsystems.

## Core Components

### 1. AtmosphereSystem (Main Controller)
- **Purpose**: Central coordinator for all atmospheric elements
- **Responsibilities**:
  - Time tracking and day/night cycle management
  - Subsystem initialization and coordination
  - Global state management (time of day, night factor)
  - Update lifecycle management

### 2. SkySystem
- **Purpose**: Manages the sky background and fog
- **Responsibilities**:
  - Sky color management based on time of day
  - Fog settings and updates
  - Integration with Three.js Sky object
  - Ensuring sky follows camera position

### 3. SunSystem
- **Purpose**: Controls sun appearance and lighting
- **Responsibilities**:
  - Directional light management (intensity and color)
  - Shadow mapping and quality settings
  - Sun sphere visual representation
  - Multi-layered glow effects
  - Position updates based on time of day

### 4. MoonSystem
- **Purpose**: Controls moon appearance and night lighting
- **Responsibilities**:
  - Moon mesh with texture
  - Moonlight for night scenes
  - Moon position based on time of day (opposite to sun)
  - Visibility based on night factor

### 5. StarSystem
- **Purpose**: Manages star fields
- **Responsibilities**:
  - Regular star field across the sky dome
  - Horizon star field concentration
  - Star visibility based on night factor
  - Star color and size variations
  - Ensuring stars follow camera position

### 6. CloudSystem
- **Purpose**: Creates and manages cloud formations
- **Responsibilities**:
  - Volumetric cloud generation
  - Cloud movement and animation
  - Ensuring appropriate distribution around player
  - Repositioning clouds that drift too far away

## Interfaces

### AtmosphereSystem Public Interface
```javascript
class AtmosphereSystem {
  constructor(engine)
  async initialize()
  update(delta, elapsed)
  
  // Public accessors
  getTimeOfDay()
  getNightFactor()
  getSunPosition()
  getMoonPosition()
}
```

### Subsystem Interface Pattern
```javascript
class SubSystem {
  constructor(atmosphereSystem)
  async initialize()
  update(delta)
}
```

## Data Flow

1. **AtmosphereSystem** updates the time of day and calculates night factor
2. Each subsystem uses these values to update their components:
   - **SkySystem** adjusts colors based on time of day
   - **SunSystem** updates sun position and light properties
   - **MoonSystem** updates moon position and visibility
   - **StarSystem** adjusts star visibility based on night factor
   - **CloudSystem** moves clouds and ensures proper distribution

## Initialization Sequence

1. **AtmosphereSystem** constructor creates empty subsystem references
2. `initialize()` creates and initializes each subsystem in order:
   - SkySystem
   - SunSystem
   - MoonSystem
   - StarSystem
   - CloudSystem
3. Each subsystem's `initialize()` creates necessary Three.js objects

## Update Cycle

During each frame:
1. **AtmosphereSystem** updates time of day and night factor
2. Each subsystem's `update(delta)` is called with current time delta
3. Subsystems update their visual representation based on current time values

## Implementation Notes

- Each subsystem should be in its own file for maintainability
- Subsystems should only access parent AtmosphereSystem for time/state information
- No direct subsystem-to-subsystem dependencies
- Only AtmosphereSystem should be exported publicly
