# Task: Fix Mountain Peak Glitches Using Improved Normal Smoothing

## Task & Context
**What**: Fix visual glitches occurring on mountain tops by implementing a more sophisticated normal calculation algorithm.
**Where**: In `WorldSystem.js`, focusing specifically on the `computeSmoothedNormals` method.

## Complexity & Uncertainty 
- **Complexity**: 2/3 - Requires understanding of 3D geometry and normal vector calculations
- **Uncertainty**: 1/3 - The approach is clear from the screenshots showing sharp edges on mountain peaks

## Quick Plan
1. Identify why the current normal calculation is causing sharp edges on mountain peaks
2. Implement a two-pass approach to normal calculation:
   - First pass: calculate standard face normals
   - Second pass: identify problematic vertices based on height and normal direction
   - Apply special smoothing to these areas
3. Use neighborhood information to create smoother transitions
4. Add height-based blending with upward-facing normals

## Implementation

The issue is visible in the screenshots where mountain peaks have sharp edges and unnatural lighting. This happens because:

1. The current implementation only does a simple weighted normal calculation
2. It applies a fixed upward-bias for all steep surfaces regardless of context
3. It doesn't consider vertex height or position within the terrain

The improved approach:

```javascript
computeSmoothedNormals(geometry, startX, startZ) {
  // First pass: standard normal calculation
  // Calculate face normals and accumulate to vertices
  
  // Second pass: identify problematic vertices (mountain peaks & sharp edges)
  // - Store world coordinates
  // - Find vertices with nearly horizontal normals at high elevations
  // - Find extremely sharp edges regardless of height
  
  // Apply targeted smoothing
  // - For each problematic vertex, find neighboring vertices
  // - Calculate smoothed normal from neighbors
  // - Blend with upward normal proportional to height
  // - Higher elevations get more upward bias to soften peaks
  
  // Apply final normalized normals to the geometry
}
```

The key improvements:
- Two-pass approach separates identification and smoothing
- Height-aware normal smoothing targets only problem areas
- Neighborhood-based smoothing considers surrounding terrain
- Progressive upward bias based on elevation creates naturally rounded peaks

## Check & Commit

The changes to `computeSmoothedNormals` now:
- Properly detect mountain peaks based on height + normal direction
- Apply more aggressive smoothing only where needed
- Use neighbor information to create smoother transitions
- Apply height-dependent upward bias for more natural rounding

This approach should eliminate the sharp lighting artifacts visible in the screenshots while preserving terrain detail elsewhere. The mountain peaks should now appear more naturally rounded with smooth lighting transitions.

**Time to Test**: Run the game and verify that mountain peaks now have smooth lighting without sharp edges.
