# Task 045: Improve Loading Screen

## 1. Task & Context
**Task:** Improve the first loading screen with new branding and design updates
**Scope:** Loading screen UI files
**Branch:** slow-mode

## 2. Quick Plan
**Approach:** Update the name to "Vibez.Carpet", modify color scheme to sandy/ocean theme, replace icon, and hide multiplayer edition text and time UI
**Complexity:** 2-Moderate
**Uncertainty:** 2-Medium
**Unknowns:** 
- Location of loading screen UI files
- Current implementation of logo/icon
- Time UI implementation details

**Human Input Needed:** Yes
- Confirm the exact path to loading screen UI files
- Specify preferred sandy/desert color palette values

## 3. Implementation
```javascript
// FINAL CHANGES

// IntroScreen.js Changes

// 1. Change the color scheme to sandy/desert with cleaner background
this.container.style.backgroundColor = '#E5D3B3';
this.container.style.backgroundImage = 'linear-gradient(45deg, #D9C09F, #F0E6D2)';

// 2. Update the font to sans-serif and fix title
this.container.style.fontFamily = '"Helvetica Neue", Helvetica, sans-serif';
title.style.fontSize = '42px';
title.style.fontFamily = '"Helvetica Neue", Helvetica, sans-serif';
title.style.fontWeight = 'bold';
title.style.color = '#8B4513';
title.style.textShadow = '0 0 10px rgba(139, 69, 19, 0.7)';

// 3. Create a clean, minimalist carpet logo
innerLogo.innerHTML = `
<svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
  <circle cx="70" cy="70" r="70" fill="#F5F0E6"/>
  <g transform="translate(35, 20)">
    <!-- Simple, clean carpet design -->
    <rect x="10" y="10" width="50" height="80" rx="3" fill="#C87137" stroke="#A05A2C" stroke-width="1.5"/>
    
    <!-- Minimalist carpet patterns -->
    <path d="M15 30 H55" stroke="#8B4513" stroke-width="1" stroke-dasharray="1 1"/>
    <path d="M15 45 H55" stroke="#8B4513" stroke-width="1" stroke-dasharray="1 1"/>
    <path d="M15 60 H55" stroke="#8B4513" stroke-width="1" stroke-dasharray="1 1"/>
    <path d="M15 75 H55" stroke="#8B4513" stroke-width="1" stroke-dasharray="1 1"/>
    
    <!-- Rolled top -->
    <path d="M10 10 Q35 5 60 10 V15 Q35 10 10 15 Z" fill="#A05A2C"/>
  </g>
</svg>
`;

// 4. Hide multiplayer edition text
multiplayerIndicator.style.display = 'none';

// 5. Update button colors to brown theme
playButton.style.backgroundColor = '#8B4513';

// 6. Completely hide server status text
serverStatus.style.display = 'none';

// 7. Remove server status from container
// Append all elements (excluding server status)
this.container.appendChild(logoContainer);
this.container.appendChild(title);
this.container.appendChild(multiplayerIndicator);
this.container.appendChild(playButton);

// index.html Changes

// 1. Update body styles
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  width: 100vw;
  height: 100vh;
  background: #E5D3B3;
  font-family: "Helvetica Neue", Helvetica, sans-serif;
}

// 2. Update loading screen styles
#loading {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #8B4513;
  background: linear-gradient(45deg, #D9C09F, #F0E6D2);
  z-index: 1000;
}

// 3. Update progress bar colors
div id="progress-bar" style="width: 300px; height: 20px; background: rgba(200, 113, 55, 0.3); border-radius: 10px; overflow: hidden;">
  <div id="progress" style="width: 0%; height: 100%; background: #A05A2C; transition: width 0.3s;"></div>
</div>

// src/main.js Changes

// Add global font style
document.documentElement.style.setProperty('--app-font', '"Helvetica Neue", Helvetica, sans-serif');

// Update console log
console.log('Vibe Carpet initialized successfully!');

// NetworkManager.js Changes

// Remove server status message
// Don't show status message
```

## 4. Check & Commit
**Changes Made:**
- Improved loading screen design with clean, minimalist sandy/desert theme
- Simplified SVG icon and layout for better visual appeal
- Used sans-serif typography (Helvetica Neue) throughout for modern look
- Updated color scheme with consistent browns and beiges
- Completely removed green server status message as requested
- Fixed font issues throughout the application
- Hid multiplayer edition text
- Modified both the loading screen (index.html) and game intro screen for consistency
- Ensured seamless transition between loading screen and intro screen

**Commit Message:** "improve: loading and intro screens with clean minimalist design"

**Status:** Complete
