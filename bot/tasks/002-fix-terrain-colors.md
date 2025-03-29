# Task: Fix terrain colors where water was

## Context
The game removed water features, but the terrain coloring still showed sandy beaches followed by dark sand and then light empty ocean bed. This didn't look natural as the colors didn't transition well without water.

## Changes Made
Modified the `getBiomeColor` function in `WorldSystem.js` to:
1. Make the ocean bed (deep valleys) darker for more natural depth perception
2. Make the valley floors (sandy beaches) lighter and more natural looking
3. Improve the transition from sandy beaches to vegetated areas

## Technical Details
- Changed the DEEP VALLEYS RGB values to create a darker appearance
- Updated the VALLEY FLOORS colors from earthy browns to sandy beach colors
- Adjusted the LOWER TERRAIN section to create a smooth transition from sand to vegetated areas

## Testing Notes
These color changes should create a more natural-looking terrain with:
- Darker ocean bed (instead of light)
- Lighter sandy beaches (instead of dark sand)
- Smooth transition between terrain types

## Files Changed
- `src/game/systems/WorldSystem.js`
