# Magical Carpet

An immersive 3D flying carpet adventure game where players soar through procedurally generated worlds, collect mana, and explore with friends.

![Magical Carpet Game](docs/images/screenshot.png)

## 🌟 Overview

Magical Carpet is a web-based 3D game built with Three.js that allows players to fly on magic carpets through beautiful, never-ending procedurally generated landscapes. Collect floating mana orbs, discover hidden locations, and enjoy the serene experience of flight.

## 🚀 Key Features

- **Infinite Procedural World**: Endless unique terrains to explore, from mountains to oceans
- **Dynamic Weather & Day/Night Cycle**: Experience changing skies, cloud patterns, and time of day
- **Flying Physics**: Intuitive and satisfying carpet controls for a magical flying experience
- **Mana Collection**: Gather magical energy throughout the world
- **Multiplayer Support**: Fly and explore with friends
- **Atmospheric Environment**: Clouds, birds, trees, and natural elements bring the world to life

## 🎮 How to Play

1. Use WASD or arrow keys to control your carpet's direction
2. Press Space to ascend and Shift to descend
3. Fly near glowing blue orbs to collect mana
4. Press E to interact with special locations
5. Press Tab to see player stats and collected mana

## 🛠️ Setup & Installation

1. Clone this repository
```bash
git clone https://github.com/yourusername/magical-carpet.git
cd magical-carpet
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## 🔧 Controls

- **W/↑**: Move forward
- **S/↓**: Move backward
- **A/←**: Turn left
- **D/→**: Turn right
- **Space**: Ascend
- **Shift**: Descend
- **E**: Interact
- **Tab**: Open/close stats display
- **M**: Toggle map
- **Esc**: Pause game

## 🧰 Technologies Used

- **Three.js**: 3D rendering engine
- **JavaScript/ES6+**: Core programming language
- **Simplex Noise**: Procedural terrain generation
- **Vite**: Development environment and bundler
- **WebGL**: GPU-accelerated graphics

## 🎮 Game Architecture

The game is built using a component-based architecture with the following systems:

- **Engine**: Core game loop and systems management
- **WorldSystem**: Procedural terrain generation and chunk management
- **PlayerSystem**: Player controls, physics, and interactions
- **AtmosphereSystem**: Sky, clouds, weather, and day/night cycle
- **VegetationSystem**: Trees and plant life generation
- **WaterSystem**: Oceans, rivers, and water effects
- **UISystem**: HUD and user interface elements
- **NetworkManager**: Multiplayer synchronization

## 🙌 Credits

Created with ❤️ by Your Name

Special thanks to:
- [Three.js](https://threejs.org/) community
- [Simplex Noise](https://github.com/jwagner/simplex-noise) library
- All contributors and testers

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
