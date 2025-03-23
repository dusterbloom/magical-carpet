const fs = require('fs');
const path = require('path');

console.log('Applying fixes to Magical Carpet...');

// Backup original files
const backupFolder = path.join(__dirname, 'backups');
if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder);
}

// Backup and replace WorldSystem.js
const worldSystemPath = path.join(__dirname, 'src', 'game', 'systems', 'WorldSystem.js');
const worldSystemBackupPath = path.join(backupFolder, 'WorldSystem.original.js');
const worldSystemFixedPath = path.join(__dirname, 'src', 'game', 'systems', 'WorldSystem.fixed.js');

if (fs.existsSync(worldSystemPath)) {
    console.log('Backing up WorldSystem.js...');
    fs.copyFileSync(worldSystemPath, worldSystemBackupPath);
    
    console.log('Applying WorldSystem fixes...');
    fs.copyFileSync(worldSystemFixedPath, worldSystemPath);
} else {
    console.error('Error: WorldSystem.js not found!');
}

// Backup and replace AtmosphereSystem.js
const atmosphereSystemPath = path.join(__dirname, 'src', 'game', 'systems', 'AtmosphereSystem.js');
const atmosphereSystemBackupPath = path.join(backupFolder, 'AtmosphereSystem.original.js');
const atmosphereSystemFixedPath = path.join(__dirname, 'src', 'game', 'systems', 'AtmosphereSystem.fixed.js');

if (fs.existsSync(atmosphereSystemPath)) {
    console.log('Backing up AtmosphereSystem.js...');
    fs.copyFileSync(atmosphereSystemPath, atmosphereSystemBackupPath);
    
    console.log('Applying AtmosphereSystem fixes...');
    fs.copyFileSync(atmosphereSystemFixedPath, atmosphereSystemPath);
} else {
    console.error('Error: AtmosphereSystem.js not found!');
}

console.log('Fixes applied successfully! Original files backed up in the "backups" folder.');
console.log('Restart your development server to see the changes.');
