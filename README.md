# Magical Vibe Carpet

A modern, web-based reimagining of the classic Magic Carpet game by Bullfrog, featuring multiplayer gameplay, accessible directly from web browsers without login requirements, and optimized for both mobile and desktop platforms.

## Project Overview

Magical Vibe Carpet is a 3D flying carpet game where players collect mana, cast spells, and compete in short, action-packed sessions. The game features:

- Web-based gameplay (no downloads or installation required)
- No signup or login required
- Mobile and desktop compatibility
- Default multiplayer mode
- Three.js-based rendering
- Short play sessions (3-5 minutes)
- Funky, colorful aesthetic

## Development Setup

### Prerequisites
- Node.js (v16+)
- npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
```bash
npm install
```

### Development
Run the development server:
```bash
npm run dev
```

The game will be available at `http://localhost:5173`

### Building for Production
Build the project:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Implementation Guide

For detailed implementation instructions, see the [LLM Implementation Guide](docs/LLM_IMPLEMENTATION_GUIDE.md).

## Project Structure
```
Vibe2/
├── docs/                 # Documentation
├── index.html            # Main HTML entry
├── package.json          # Project dependencies
├── src/                  # Source code
│   ├── assets/           # Game assets (textures, models, audio)
│   ├── components/       # UI components
│   ├── game/             # Game logic
│   │   ├── core/         # Core game engine
│   │   ├── entities/     # Game entities
│   │   ├── systems/      # Game systems (physics, input, etc.)
│   │   ├── levels/       # Level definitions
│   │   └── ui/           # Game UI elements
│   ├── utils/            # Utility functions
│   └── main.js           # Main entry point
└── vite.config.js        # Build configuration
```

## Credits

Created as a modern tribute to the classic Magic Carpet game by Bullfrog Productions.
