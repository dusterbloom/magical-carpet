export class UISystem {
  constructor(engine) {
    this.engine = engine;
    this.container = document.getElementById('ui-container');
    this.elements = {};
  }
  
  async initialize() {
    this.createBaseUI();
    this.createManaDisplay();
    // this.createHealthDisplay();
    // this.createSpellsUI();
    this.createMinimapUI();
    this.createTimeControls();
    
    console.log("UI system initialized");
  }
  
  createBaseUI() {
    // Apply global UI styles
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.fontFamily = 'Arial, sans-serif';
    this.container.style.color = 'white';
  }
  
  createManaDisplay() {
    // Create mana display in top-right corner
    const manaContainer = document.createElement('div');
    manaContainer.style.position = 'absolute';
    manaContainer.style.top = '20px';
    manaContainer.style.right = '20px';
    manaContainer.style.padding = '10px';
    manaContainer.style.background = 'rgba(0, 0, 30, 0.7)';
    manaContainer.style.borderRadius = '5px';
    manaContainer.style.display = 'flex';
    manaContainer.style.alignItems = 'center';
    manaContainer.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
    
    const manaIcon = document.createElement('div');
    manaIcon.style.width = '20px';
    manaIcon.style.height = '20px';
    manaIcon.style.borderRadius = '50%';
    manaIcon.style.background = 'linear-gradient(135deg, #00ffff, #0066ff)';
    manaIcon.style.marginRight = '10px';
    manaIcon.style.boxShadow = '0 0 5px rgba(0, 255, 255, 0.8)';
    
    const manaText = document.createElement('div');
    manaText.textContent = '0';
    manaText.style.fontSize = '18px';
    manaText.style.fontWeight = 'bold';
    manaText.style.textShadow = '0 0 5px rgba(0, 255, 255, 0.8)';
    
    manaContainer.appendChild(manaIcon);
    manaContainer.appendChild(manaText);
    this.container.appendChild(manaContainer);
    
    this.elements.manaText = manaText;
  }
  
  createHealthDisplay() {
    // Create health bar at bottom center
    const healthContainer = document.createElement('div');
    healthContainer.style.position = 'absolute';
    healthContainer.style.bottom = '20px';
    healthContainer.style.left = '50%';
    healthContainer.style.transform = 'translateX(-50%)';
    healthContainer.style.width = '200px';
    healthContainer.style.padding = '5px';
    healthContainer.style.background = 'rgba(0, 0, 30, 0.7)';
    healthContainer.style.borderRadius = '5px';
    healthContainer.style.boxShadow = '0 0 10px rgba(255, 0, 100, 0.5)';
    
    const healthBar = document.createElement('div');
    healthBar.style.height = '10px';
    healthBar.style.width = '100%';
    healthBar.style.background = 'linear-gradient(90deg, #ff0066, #ff6699)';
    healthBar.style.borderRadius = '3px';
    healthBar.style.boxShadow = 'inset 0 0 5px rgba(0, 0, 0, 0.5)';
    
    healthContainer.appendChild(healthBar);
    this.container.appendChild(healthContainer);
    
    this.elements.healthBar = healthBar;
  }
  
  createSpellsUI() {
    // Create spell selection UI at bottom right
    const spellsContainer = document.createElement('div');
    spellsContainer.style.position = 'absolute';
    spellsContainer.style.bottom = '20px';
    spellsContainer.style.right = '20px';
    spellsContainer.style.display = 'flex';
    spellsContainer.style.gap = '10px';
    spellsContainer.style.pointerEvents = 'auto';
    
    // Create spell slots
    const spells = [
      { name: 'Fireball', color: '#ff3300', key: '1' },
      { name: 'Lightning', color: '#33ccff', key: '2' },
      { name: 'Shield', color: '#ffcc00', key: '3' }
    ];
    
    this.elements.spellSlots = [];
    
    spells.forEach((spell, index) => {
      const spellSlot = document.createElement('div');
      spellSlot.style.width = '50px';
      spellSlot.style.height = '50px';
      spellSlot.style.borderRadius = '5px';
      spellSlot.style.background = 'rgba(0, 0, 30, 0.7)';
      spellSlot.style.display = 'flex';
      spellSlot.style.flexDirection = 'column';
      spellSlot.style.justifyContent = 'center';
      spellSlot.style.alignItems = 'center';
      spellSlot.style.cursor = 'pointer';
      spellSlot.style.transition = 'all 0.2s';
      spellSlot.style.boxShadow = `0 0 10px ${spell.color}80`;
      
      const spellIndicator = document.createElement('div');
      spellIndicator.style.width = '30px';
      spellIndicator.style.height = '30px';
      spellIndicator.style.borderRadius = '50%';
      spellIndicator.style.background = spell.color;
      spellIndicator.style.boxShadow = `0 0 5px ${spell.color}`;
      
      const spellKey = document.createElement('div');
      spellKey.textContent = spell.key;
      spellKey.style.fontSize = '12px';
      spellKey.style.marginTop = '5px';
      
      spellSlot.appendChild(spellIndicator);
      spellSlot.appendChild(spellKey);
      spellsContainer.appendChild(spellSlot);
      
      // Add hover effect
      spellSlot.addEventListener('mouseover', () => {
        spellSlot.style.transform = 'scale(1.1)';
      });
      
      spellSlot.addEventListener('mouseout', () => {
        spellSlot.style.transform = 'scale(1)';
      });
      
      // Add click handler
      spellSlot.addEventListener('click', () => {
        this.selectSpell(index);
      });
      
      this.elements.spellSlots.push({
        element: spellSlot,
        indicator: spellIndicator,
        data: spell
      });
    });
    
    this.container.appendChild(spellsContainer);
    
    // Listen for key presses to select spells
    window.addEventListener('keydown', (event) => {
      if (event.key >= '1' && event.key <= '3') {
        const index = parseInt(event.key) - 1;
        this.selectSpell(index);
      }
    });
  }
  
  createMinimapUI() {
    // We're now using MinimapSystem for the actual minimap implementation
    // This method is kept for backwards compatibility, but doesn't create a visible minimap
    
    // Create empty references to ensure no errors
    const dummyCanvas = document.createElement('canvas');
    this.elements.minimapCanvas = dummyCanvas;
    this.elements.minimapContext = dummyCanvas.getContext('2d');
    
    console.log("Minimap functionality moved to MinimapSystem");
  }
  
  selectSpell(index) {
    // Highlight selected spell and reset others
    this.elements.spellSlots.forEach((slot, i) => {
      if (i === index) {
        slot.element.style.transform = 'scale(1.1)';
        slot.indicator.style.boxShadow = `0 0 10px ${slot.data.color}`;
      } else {
        slot.element.style.transform = 'scale(1)';
        slot.indicator.style.boxShadow = `0 0 5px ${slot.data.color}`;
      }
    });
    
    // Notify game about spell selection
    if (this.engine.systems.player && this.engine.systems.player.localPlayer) {
      this.engine.systems.player.localPlayer.currentSpell = index;
    }
  }
  
  updateManaDisplay(mana) {
    if (this.elements.manaText) {
      this.elements.manaText.textContent = mana.toString();
      
      // Add pulse animation when mana changes
      this.elements.manaText.style.transform = 'scale(1.2)';
      setTimeout(() => {
        this.elements.manaText.style.transform = 'scale(1)';
      }, 200);
    }
  }
  
  updateHealthDisplay(health, maxHealth) {
    if (this.elements.healthBar) {
      const percentage = (health / maxHealth) * 100;
      this.elements.healthBar.style.width = `${percentage}%`;
      
      // Change color based on health
      if (percentage > 60) {
        this.elements.healthBar.style.background = 'linear-gradient(90deg, #ff0066, #ff6699)';
      } else if (percentage > 30) {
        this.elements.healthBar.style.background = 'linear-gradient(90deg, #ffcc00, #ff9900)';
      } else {
        this.elements.healthBar.style.background = 'linear-gradient(90deg, #ff3300, #ff6600)';
      }
    }
  }
  
  updateMinimap() {
    // Minimap functionality is now handled by MinimapSystem
    // This method is kept for backwards compatibility
    return;
  }
  
  update(delta) {
    // Update UI elements that need continuous updates
    
    // Update health display if local player exists
    if (this.engine.systems.player && this.engine.systems.player.localPlayer) {
      const player = this.engine.systems.player.localPlayer;
      this.updateHealthDisplay(player.health, player.maxHealth);
    }
    
    // Update time display if atmosphere system exists
    this.updateTimeDisplay();
    
    // Minimap is now updated by MinimapSystem
  }
  
  /**
   * Update time display showing current time of day
   */
  updateTimeDisplay() {
    const atmosphereSystem = this.engine.systems.atmosphere;
    if (!atmosphereSystem) return;
    
    // Update current time display
    if (this.elements.timeDisplay) {
      const timeOfDay = atmosphereSystem.getTimeOfDay();
      const hours24 = Math.floor(timeOfDay * 24);
      const minutes = Math.floor((timeOfDay * 24 * 60) % 60);
      
      this.elements.timeDisplay.textContent = 
        `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * Create time control UI elements
   */
  createTimeControls() {
    // Create toggle button for time controls
    const toggleButton = document.createElement('div');
    toggleButton.style.position = 'absolute';
    toggleButton.style.top = '70px';
    toggleButton.style.right = '20px';
    toggleButton.style.width = '40px';
    toggleButton.style.height = '40px';
    toggleButton.style.backgroundColor = 'rgba(45, 48, 52, 0.9)';
    toggleButton.style.borderRadius = '50%';
    toggleButton.style.display = 'flex';
    toggleButton.style.justifyContent = 'center';
    toggleButton.style.alignItems = 'center';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.zIndex = '1001';
    toggleButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    toggleButton.style.pointerEvents = 'auto';
    toggleButton.innerHTML = '⏱️';
    toggleButton.style.fontSize = '20px';
    
    // Create container for time controls using modern UI style based on mockup
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '120px'; // Positioned below the toggle button
    container.style.right = '20px';
    container.style.backgroundColor = 'rgba(45, 48, 52, 0.9)';
    container.style.padding = '15px';
    container.style.borderRadius = '10px';
    container.style.color = 'white';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.zIndex = '1000';
    container.style.pointerEvents = 'auto';
    container.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    container.style.width = '240px';
    container.style.display = 'none'; // Initially hidden
    
    // Toggle visibility
    toggleButton.addEventListener('click', () => {
      if (container.style.display === 'none') {
        container.style.display = 'block';
        toggleButton.style.backgroundColor = 'rgba(65, 68, 72, 0.9)';
      } else {
        container.style.display = 'none';
        toggleButton.style.backgroundColor = 'rgba(45, 48, 52, 0.9)';
      }
    });
    
    // Time display
    const timeDisplay = document.createElement('div');
    timeDisplay.style.fontSize = '24px';
    timeDisplay.style.textAlign = 'center';
    timeDisplay.style.marginBottom = '15px';
    timeDisplay.textContent = '00:00';
    container.appendChild(timeDisplay);
    this.elements.timeDisplay = timeDisplay;
    
    // Create a section title for Presets
    const presetTitle = document.createElement('div');
    presetTitle.textContent = 'Presets';
    presetTitle.style.fontSize = '18px';
    presetTitle.style.textAlign = 'center';
    presetTitle.style.marginBottom = '10px';
    presetTitle.style.fontWeight = 'bold';
    container.appendChild(presetTitle);
    
    // Time presets with icons
    const presets = [
      { label: 'Midnight', hour: 0, minute: 0, icon: '🌙' },
      { label: 'Sunrise', hour: 6, minute: 0, icon: '🌅' },
      { label: 'Noon', hour: 12, minute: 0, icon: '☀️' },
      { label: 'Sunset', hour: 18, minute: 0, icon: '🌇' }
    ];
    
    const presetContainer = document.createElement('div');
    presetContainer.style.display = 'grid';
    presetContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
    presetContainer.style.gap = '8px';
    presetContainer.style.marginBottom = '15px';
    
    presets.forEach(preset => {
      const button = document.createElement('div');
      button.style.display = 'flex';
      button.style.flexDirection = 'column';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      button.style.backgroundColor = '#1c1e21';
      button.style.borderRadius = '8px';
      button.style.padding = '8px';
      button.style.cursor = 'pointer';
      button.style.transition = 'all 0.2s';
      
      // Icon
      const icon = document.createElement('div');
      icon.textContent = preset.icon;
      icon.style.fontSize = '24px';
      icon.style.marginBottom = '4px';
      button.appendChild(icon);
      
      // Label below icon
      if (preset.label !== 'Sunrise' && preset.label !== 'Sunset') {
        const label = document.createElement('div');
        label.textContent = preset.label;
        label.style.fontSize = '10px';
        button.appendChild(label);
      }
      
      // Hover effect
      button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#2c2e31';
        button.style.transform = 'translateY(-2px)';
      });
      
      button.addEventListener('mouseout', () => {
        button.style.backgroundColor = '#1c1e21';
        button.style.transform = 'translateY(0)';
      });
      
      // Click handler
      button.addEventListener('click', () => {
        const atmosphereSystem = this.engine.systems.atmosphere;
        if (atmosphereSystem) {
          atmosphereSystem.setTime(preset.hour, preset.minute);
        }
      });
      
      presetContainer.appendChild(button);
    });
    
    container.appendChild(presetContainer);
    
    // Time scale title
    const timeScaleTitle = document.createElement('div');
    timeScaleTitle.textContent = 'Time Scale';
    timeScaleTitle.style.fontSize = '18px';
    timeScaleTitle.style.textAlign = 'center';
    timeScaleTitle.style.marginBottom = '10px';
    timeScaleTitle.style.fontWeight = 'bold';
    container.appendChild(timeScaleTitle);
    
    // Time scale buttons with updated values
    const timeScaleContainer = document.createElement('div');
    timeScaleContainer.style.display = 'grid';
    timeScaleContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
    timeScaleContainer.style.gap = '8px';
    timeScaleContainer.style.marginBottom = '15px';
    
    // Updated scales according to mockup (replaced 720x with 120x)
    const scales = [
      { label: 'Real', value: 1 },
      { label: '2x', value: 2 },
      { label: '60x', value: 60 },
      { label: '120x', value: 120 }
    ];
    
    scales.forEach(scale => {
      const button = document.createElement('div');
      button.textContent = scale.label;
      button.style.backgroundColor = '#1c1e21';
      button.style.borderRadius = '8px';
      button.style.padding = '8px';
      button.style.textAlign = 'center';
      button.style.cursor = 'pointer';
      button.style.transition = 'all 0.2s';
      
      // Hover effect
      button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#2c2e31';
        button.style.transform = 'translateY(-2px)';
      });
      
      button.addEventListener('mouseout', () => {
        button.style.backgroundColor = '#1c1e21';
        button.style.transform = 'translateY(0)';
      });
      
      // Click handler
      button.addEventListener('click', () => {
        const atmosphereSystem = this.engine.systems.atmosphere;
        if (atmosphereSystem) {
          atmosphereSystem.timeScale = scale.value;
          console.log(`Time scale set to ${scale.value}x`);
        }
      });
      
      timeScaleContainer.appendChild(button);
    });
    
    container.appendChild(timeScaleContainer);
    
    // Custom time title
    const customTimeTitle = document.createElement('div');
    customTimeTitle.textContent = 'Custom Time';
    customTimeTitle.style.fontSize = '18px';
    customTimeTitle.style.textAlign = 'center';
    customTimeTitle.style.marginBottom = '10px';
    customTimeTitle.style.fontWeight = 'bold';
    container.appendChild(customTimeTitle);
    
    // Custom time slider
    const sliderContainer = document.createElement('div');
    sliderContainer.style.position = 'relative';
    sliderContainer.style.width = '100%';
    sliderContainer.style.height = '30px';
    sliderContainer.style.backgroundColor = '#1c1e21';
    sliderContainer.style.borderRadius = '15px';
    sliderContainer.style.marginBottom = '15px';
    
    const sliderTrack = document.createElement('div');
    sliderTrack.style.position = 'absolute';
    sliderTrack.style.top = '50%';
    sliderTrack.style.left = '10px';
    sliderTrack.style.right = '10px';
    sliderTrack.style.height = '4px';
    sliderTrack.style.transform = 'translateY(-50%)';
    sliderTrack.style.backgroundColor = '#3c3e41';
    sliderTrack.style.borderRadius = '2px';
    sliderContainer.appendChild(sliderTrack);
    
    const sliderThumb = document.createElement('div');
    sliderThumb.style.position = 'absolute';
    sliderThumb.style.top = '50%';
    sliderThumb.style.left = '10px';
    sliderThumb.style.width = '20px';
    sliderThumb.style.height = '20px';
    sliderThumb.style.transform = 'translate(0, -50%)';
    sliderThumb.style.backgroundColor = 'white';
    sliderThumb.style.borderRadius = '50%';
    sliderThumb.style.cursor = 'pointer';
    sliderThumb.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    sliderContainer.appendChild(sliderThumb);
    
    // Make slider interactive
    let isDragging = false;
    const trackWidth = sliderTrack.clientWidth;
    
    sliderThumb.addEventListener('mousedown', (e) => {
      isDragging = true;
      e.preventDefault(); // Prevent text selection
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const rect = sliderTrack.getBoundingClientRect();
      const trackStart = rect.left + 10; // 10px padding
      const trackEnd = rect.right - 10; // 10px padding
      const trackLength = trackEnd - trackStart;
      
      let position = e.clientX - trackStart;
      position = Math.max(0, Math.min(position, trackLength));
      
      const percentage = position / trackLength;
      sliderThumb.style.left = `${percentage * 100}%`;
      
      // Calculate time based on position
      const hour = Math.floor(percentage * 24);
      const minute = Math.floor((percentage * 24 * 60) % 60);
      
      const atmosphereSystem = this.engine.systems.atmosphere;
      if (atmosphereSystem) {
        atmosphereSystem.setTime(hour, minute);
      }
    });
    
    container.appendChild(sliderContainer);
    
    // Close button
    const closeButton = document.createElement('div');
    closeButton.textContent = '✕';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '8px';
    closeButton.style.right = '12px';
    closeButton.style.fontSize = '14px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.opacity = '0.7';
    closeButton.addEventListener('mouseover', () => {
      closeButton.style.opacity = '1';
    });
    closeButton.addEventListener('mouseout', () => {
      closeButton.style.opacity = '0.7';
    });
    closeButton.addEventListener('click', () => {
      container.style.display = 'none';
      toggleButton.style.backgroundColor = 'rgba(45, 48, 52, 0.9)';
    });
    container.appendChild(closeButton);
    
    // Add to document
    this.container.appendChild(toggleButton);
    this.container.appendChild(container);
    
    // Show current time in toggle button
    // Continuously update the time in the toggle button tooltip
    toggleButton.title = "Time Controls";
  }
}

