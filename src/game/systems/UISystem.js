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
    // Create minimap in top-left corner
    const minimapContainer = document.createElement('div');
    minimapContainer.style.position = 'absolute';
    minimapContainer.style.top = '20px';
    minimapContainer.style.left = '20px';
    minimapContainer.style.width = '150px';
    minimapContainer.style.height = '150px';
    minimapContainer.style.background = 'rgba(0, 0, 30, 0.7)';
    minimapContainer.style.borderRadius = '5px';
    minimapContainer.style.overflow = 'hidden';
    minimapContainer.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
    
    // Create canvas for minimap rendering
    const minimapCanvas = document.createElement('canvas');
    minimapCanvas.width = 150;
    minimapCanvas.height = 150;
    minimapCanvas.style.width = '100%';
    minimapCanvas.style.height = '100%';
    
    minimapContainer.appendChild(minimapCanvas);
    this.container.appendChild(minimapContainer);
    
    this.elements.minimapCanvas = minimapCanvas;
    this.elements.minimapContext = minimapCanvas.getContext('2d');
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
    if (!this.elements.minimapContext || !this.engine.systems.player.localPlayer) return;
    
    const ctx = this.elements.minimapContext;
    const canvas = this.elements.minimapCanvas;
    const worldSize = this.engine.systems.world.worldSize;
    
    // Clear minimap
    ctx.fillStyle = 'rgba(0, 10, 40, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Draw terrain (simplified)
    const terrainGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    terrainGradient.addColorStop(0, 'rgba(0, 50, 100, 0.5)');
    terrainGradient.addColorStop(1, 'rgba(0, 100, 200, 0.7)');
    ctx.fillStyle = terrainGradient;
    
    // Draw random terrain pattern (would be based on actual terrain in full implementation)
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 10 + Math.random() * 20;
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
    ctx.fill();
    
    // Draw mana nodes
    const manaNodes = this.engine.systems.world.manaNodes;
    ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
    
    manaNodes.forEach(node => {
      if (!node.userData.collected) {
        // Convert world position to minimap position
        const x = ((node.position.x + worldSize / 2) / worldSize) * canvas.width;
        const z = ((node.position.z + worldSize / 2) / worldSize) * canvas.height;
        
        ctx.beginPath();
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Draw players
    this.engine.systems.player.players.forEach(player => {
      // Convert world position to minimap position
      const x = ((player.position.x + worldSize / 2) / worldSize) * canvas.width;
      const z = ((player.position.z + worldSize / 2) / worldSize) * canvas.height;
      
      // Draw player dot
      ctx.beginPath();
      if (player.isLocal) {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.arc(x, z, 4, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = 'rgba(255, 100, 100, 1)';
        ctx.arc(x, z, 3, 0, Math.PI * 2);
      }
      ctx.fill();
      
      // Draw direction indicator for local player
      if (player.isLocal) {
        const dirX = Math.sin(player.rotation.y) * 8;
        const dirZ = Math.cos(player.rotation.y) * 8;
        
        ctx.beginPath();
        ctx.moveTo(x, z);
        ctx.lineTo(x + dirX, z + dirZ);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }
  
  update(delta) {
    // Update UI elements that need continuous updates
    
    // Update health display if local player exists
    if (this.engine.systems.player && this.engine.systems.player.localPlayer) {
      const player = this.engine.systems.player.localPlayer;
      this.updateHealthDisplay(player.health, player.maxHealth);
    }
    
    // Update minimap
    this.updateMinimap();
  }
}
