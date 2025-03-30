# Task 020: Fix Vegetation System Performance Issues

## Task & Context
- **Files to modify:** 
  - `src/game/systems/VegetationSystem.js`
  - `src/game/core/PerformanceMonitor.js`
- **Current state:** Despite optimization efforts in Task 19, we're still seeing high draw calls (270K+ triangles) and poor FPS (<10). The system is repeatedly reducing vegetation density to the minimum (0.30), but performance remains poor.
- **Goal:** Fix critical bugs, reduce triangle count, and ensure accurate performance reporting and adjustment

## Quick Plan
**Complexity: 3/3** - Complex bug fixes with multiple systems interaction
**Uncertainty: 2/3** - Need to identify exact causes of performance issues

1. Fix the FPS calculation and reporting in the PerformanceMonitor
2. Fix triangle count issue in instanced rendering
3. Optimize memory management for tree instances
4. Optimize LOD switching and culling
5. Fix potential memory leaks

## Implementation

After analyzing the code and performance logs, I've identified several key issues to fix:

### 1. FPS Calculation Issues
The PerformanceMonitor appears to be calculating FPS incorrectly. The last update timestamp isn't being adjusted correctly leading to unreliable FPS values, which causes the vegetation system to constantly reduce density.

### 2. Tree Instance Matrix Management
There's a critical issue in how tree instance matrices are managed. When removing trees from view, the LOD level tracking isn't being updated correctly, leading to potential memory issues.

### 3. Triangle Count Optimization
We need to reduce the triangle count by further simplifying geometry for distant trees and implementing better culling.

### 4. Memory Leak Prevention
Ensure matrices and instance data are properly cleaned up, particularly when switching LOD levels or removing trees.

### 5. Performance Monitoring Integration
Improve how the vegetation system interacts with the performance monitor to make more accurate density adjustment decisions.

## Changes

I'll implement the following fixes to address these issues:

1. Fix FPS calculation in PerformanceMonitor.js
2. Optimize the triangle count by further reducing geometry complexity
3. Fix the LOD tracking system to properly handle switches
4. Implement more aggressive frustum culling
5. Add better memory management for instances and matrices
6. Fix performance-based adaptation logic

## Check & Commit

I'll verify that:
1. FPS reporting is accurate and stable
2. Triangle count is substantially reduced (<50K)
3. Tree density adaptation works properly
4. No memory leaks occur during LOD switching or culling
5. Performance is improved and stable on lower-end hardware
