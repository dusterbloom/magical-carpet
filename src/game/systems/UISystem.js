export class UISystem {
  constructor(engine) {
    this.engine = engine;
    this.container = document.getElementById('ui-container');
    this.elements = {};
  }
  
  async initialize() {
    this.createBaseUI();
    this.createManaDisplay();
    this.createHealthDisplay();
    this.createSpellsUI();
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
    // Create container for time controls
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.left = '10px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    container.style.padding = '10px';
    container.style.borderRadius = '5px';
    container.style.color = 'white';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.zIndex = '1000';
    container.style.pointerEvents = 'auto';
    
    // Time display
    const timeLabel = document.createElement('div');
    timeLabel.textContent = 'Current Time:';
    container.appendChild(timeLabel);
    
    const timeDisplay = document.createElement('div');
    timeDisplay.style.fontSize = '24px';
    timeDisplay.style.marginBottom = '10px';
    timeDisplay.textContent = '00:00';
    container.appendChild(timeDisplay);
    this.elements.timeDisplay = timeDisplay;
    
    // Time presets
    const presetLabel = document.createElement('div');
    presetLabel.textContent = 'Presets:';
    container.appendChild(presetLabel);
    
    const presets = [
      { label: 'Midnight', hour: 0, minute: 0 },
      { label: 'Sunrise', hour: 6, minute: 0 },
      { label: 'Noon', hour: 12, minute: 0 },
      { label: 'Sunset', hour: 18, minute: 0 }
    ];
    
    const presetContainer = document.createElement('div');
    presetContainer.style.display = 'flex';
    presetContainer.style.gap = '5px';
    presetContainer.style.marginBottom = '10px';
    
    presets.forEach(preset => {
      const button = document.createElement('button');
      button.textContent = preset.label;
      button.style.flex = '1';
      button.style.padding = '5px';
      button.addEventListener('click', () => {
        const atmosphereSystem = this.engine.systems.atmosphere;
        if (atmosphereSystem) {
          atmosphereSystem.setTime(preset.hour, preset.minute);
        }
      });
      presetContainer.appendChild(button);
    });
    
    container.appendChild(presetContainer);
    
    // Time scale control
    const timeScaleLabel = document.createElement('div');
    timeScaleLabel.textContent = 'Time Scale:';
    container.appendChild(timeScaleLabel);
    
    const timeScaleContainer = document.createElement('div');
    timeScaleContainer.style.display = 'flex';
    timeScaleContainer.style.gap = '5px';
    
    const scales = [
      { label: 'Real', value: 1 },
      { label: '60x', value: 60 },
      { label: '360x', value: 360 },
      { label: '720x', value: 720 }
    ];
    
    scales.forEach(scale => {
      const button = document.createElement('button');
      button.textContent = scale.label;
      button.style.flex = '1';
      button.style.padding = '5px';
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
    
    // Custom time setter
    const customTimeLabel = document.createElement('div');
    customTimeLabel.textContent = 'Set Custom Time:';
    customTimeLabel.style.marginTop = '10px';
    container.appendChild(customTimeLabel);
    
    const customTimeContainer = document.createElement('div');
    customTimeContainer.style.display = 'flex';
    customTimeContainer.style.gap = '5px';
    customTimeContainer.style.marginTop = '5px';
    
    const hourInput = document.createElement('input');
    hourInput.type = 'number';
    hourInput.min = 0;
    hourInput.max = 23;
    hourInput.value = 12;
    hourInput.style.width = '50px';
    customTimeContainer.appendChild(hourInput);
    
    const separator = document.createElement('span');
    separator.textContent = ':';
    separator.style.display = 'flex';
    separator.style.alignItems = 'center';
    customTimeContainer.appendChild(separator);
    
    const minuteInput = document.createElement('input');
    minuteInput.type = 'number';
    minuteInput.min = 0;
    minuteInput.max = 59;
    minuteInput.value = 0;
    minuteInput.style.width = '50px';
    customTimeContainer.appendChild(minuteInput);
    
    const setButton = document.createElement('button');
    setButton.textContent = 'Set';
    setButton.style.marginLeft = '5px';
    setButton.addEventListener('click', () => {
      const hour = parseInt(hourInput.value, 10);
      const minute = parseInt(minuteInput.value, 10);
      
      const atmosphereSystem = this.engine.systems.atmosphere;
      if (atmosphereSystem) {
        atmosphereSystem.setTime(hour, minute);
      }
    });
    customTimeContainer.appendChild(setButton);
    
    container.appendChild(customTimeContainer);
    
    // Add to document
    this.container.appendChild(container);
  }
}
