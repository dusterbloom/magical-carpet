import os from 'os';

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const ip = getLocalIP();
console.log(`Detected local IP: ${ip}`);

// Write to .env.local
import fs from 'fs';
fs.writeFileSync('.env.local', 
`VITE_SERVER_URL=http://${ip}:4000
VITE_AUTO_IP=true
`);