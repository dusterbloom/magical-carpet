// Implementation for Task 048: Fix Mobile Water Rendering Root Cause

// Step 1: Update Engine.js renderer settings
// Add to Engine constructor after creating renderer
this.renderer.outputColorSpace = THREE.SRGBColorSpace;
// Ensure color management is properly set
THREE.ColorManagement.enabled = true;

// Step 2: Update WaterSystem.js createWater method
createWater() {
  const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
  
  // Get quality setting from engine if available
  let waterQuality = 'high';
  if (this.engine.settings && this.engine.settings.quality) {
    waterQuality = this.engine.settings.quality.water;
    console.log(`Creating water with ${waterQuality} quality`);
  }
  
  // If MobileLODManager is available, check if water reflections should be enabled
  if (this.engine.systems.mobileLOD && 
      this.engine.settings && 
      this.engine.settings.isMobile) {
    if (!this.engine.systems.mobileLOD.currentWaterReflectionEnabled) {
      waterQuality = 'low';
      console.log(`Mobile LOD Manager disabled water reflections for performance`);
    }
  }
  
  // Configure water based on quality setting - applies to all devices now
  let textureSize = 1024;  // Default high quality
  let distortionScale = 0.8;
  let alpha = 0.95;
  
  // Apply quality settings based on device capability and quality setting
  switch (waterQuality) {
    case 'low':
      textureSize = 64;  // Very small texture for reflections
      distortionScale = 0.1;  // Minimal distortion
      alpha = 0.8;  // More transparent
      break;
    case 'medium':
      textureSize = 256;  // Medium texture size
      distortionScale = 0.3;  // Moderate distortion
      alpha = 0.85;
      break;
    case 'high':
      textureSize = this.engine.settings && this.engine.settings.isMobile ? 512 : 1024;  // Scaled based on device
      distortionScale = 0.6;  // Significant distortion but not full
      alpha = 0.9;
      break;
  }
  
  console.log(`Water quality: ${waterQuality}, texture size: ${textureSize}, distortion: ${distortionScale}`);
  
  // Use a color that works correctly on all devices - fix for the brown water issue
  // The key issue was using a very dark blue (0x001e0f) that mobile devices rendered as brown
  // We'll use a more standard medium blue that renders consistently
  const waterColor = 0x0066aa; // Medium blue that looks correct on all devices
  
  const water = new Water(waterGeometry, {
    textureWidth: textureSize,
    textureHeight: textureSize,
    waterNormals: new TextureLoader().load('textures/2waternormals.jpg', function (texture) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(32, 32);
    }),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: waterColor,
    distortionScale: distortionScale,
    clipBias: 0.001,
    fog: this.scene.fog !== undefined,
    alpha: alpha
  });
  
  water.rotation.x = -Math.PI / 2;
  water.position.y = this.waterLevel;
  
  // Store references to handle the reflection camera setup
  this._reflectionCameraInitialized = false;
  this._waterQuality = waterQuality;
  
  // Apply quality-specific reflection settings instead of completely disabling
  if (this.engine.settings && this.engine.settings.isMobile) {
    // Apply appropriately scaled reflection matrix instead of zero matrix
    let reflectionMatrix;
    
    switch (waterQuality) {
      case 'low':
        // Very minimal reflection - almost zero but not completely disabled
        // This prevents the brown water issue while maintaining performance
        reflectionMatrix = new THREE.Matrix4().makeScale(0.05, 0.05, 0.05);
        console.log('Mobile: Using minimal reflections for low quality water');
        break;
        
      case 'medium':
        // Reduced reflection
        reflectionMatrix = new THREE.Matrix4().makeScale(0.3, 0.3, 0.3);
        console.log('Mobile: Using reduced reflections for medium quality water');
        break;
        
      case 'high':
        // Still slightly reduced from full reflection for mobile performance
        reflectionMatrix = new THREE.Matrix4().makeScale(0.7, 0.7, 0.7);
        console.log('Mobile: Using moderate reflections for high quality water');
        break;
    }
    
    // Apply the appropriate reflection matrix
    water.material.uniforms['textureMatrix'].value = reflectionMatrix;
    
    // Simplify shader for mobile if needed
    if (water.material && waterQuality === 'low') {
      water.material.defines = water.material.defines || {};
      water.material.defines.DEPTH_EFFECT = 0;
      water.material.defines.SKY_EFFECT = 0;
      water.material.needsUpdate = true;
    }
  }

  this.water = water;
  this.scene.add(water);
}

// Step 3: Update the update method to maintain consistent reflections
update(deltaTime) {
  if (this.water) {
    // No more hard-coded color overrides in the update method
    // Instead, just ensure the water shader parameters are maintained
    
    // Use default animation speed for desktop, adjust for mobile only
    let animationSpeed = 0.8;
    
    // Only adjust animation speed on mobile
    if (this.engine.settings && this.engine.settings.isMobile && this._waterQuality) {
      animationSpeed = this._waterQuality === 'low' ? 0.3 : 
                        this._waterQuality === 'medium' ? 0.5 : 0.8;
    }
    
    this.water.material.uniforms['time'].value += deltaTime * animationSpeed;
    
    // Update sun direction using SunSystem reference
    if (this.engine.systems.atmosphere && 
        this.engine.systems.atmosphere.sunSystem) {
      const sunPosition = this.engine.systems.atmosphere.sunSystem.getSunPosition();
      const sunDirection = sunPosition.clone().normalize();
      this.water.material.uniforms['sunDirection'].value.copy(sunDirection);
    }

    // Update position without rounding to avoid reflection jumps
    if (this.engine.camera) {
      this.water.position.x = this.engine.camera.position.x;
      this.water.position.z = this.engine.camera.position.z;
    }
    
    // Apply quality-appropriate reflection settings instead of completely disabling
    if (this.engine.settings && this.engine.settings.isMobile) {
      // Apply reflection matrix based on current quality
      let reflectionMatrix;
      
      switch (this._waterQuality) {
        case 'low':
          // Very minimal reflection
          reflectionMatrix = new THREE.Matrix4().makeScale(0.05, 0.05, 0.05);
          break;
          
        case 'medium':
          // Reduced reflection
          reflectionMatrix = new THREE.Matrix4().makeScale(0.3, 0.3, 0.3);
          break;
          
        case 'high':
          // Moderate reflection for mobile
          reflectionMatrix = new THREE.Matrix4().makeScale(0.7, 0.7, 0.7);
          break;
      }
      
      // Apply the appropriate reflection matrix
      if (this.water && this.water.material && this.water.material.uniforms['textureMatrix']) {
        this.water.material.uniforms['textureMatrix'].value.copy(reflectionMatrix);
      }
      
      // Skip the rest of desktop-specific reflection processing
      return;
    }
    
    // Rest of the update method remains unchanged for desktop...
  }
}

// Step 4: Update onBeforeRender to maintain consistent water appearance
this.water.onBeforeRender = (renderer, scene, camera) => {
  // NO hardcoded color override here as we've fixed the root cause
  // Instead, just ensure reflections are properly scaled based on quality
  
  if (this.engine.settings && this.engine.settings.isMobile) {
    // Apply quality-appropriate reflection matrix
    let reflectionMatrix;
    
    switch (this._waterQuality) {
      case 'low':
        reflectionMatrix = new THREE.Matrix4().makeScale(0.05, 0.05, 0.05);
        break;
      case 'medium':
        reflectionMatrix = new THREE.Matrix4().makeScale(0.3, 0.3, 0.3);
        break;
      case 'high':
        reflectionMatrix = new THREE.Matrix4().makeScale(0.7, 0.7, 0.7);
        break;
    }
    
    // Apply the appropriate reflection matrix
    if (this.water.material.uniforms['textureMatrix']) {
      this.water.material.uniforms['textureMatrix'].value.copy(reflectionMatrix);
    }
  }
  
  // Rest of onBeforeRender handling remains unchanged...
}
