const { spawn } = require('child_process');
const path = require('path');

const CLOUDFLARED_BIN = path.join(__dirname, 'cloudflared.exe');

function runTunnel() {
  console.log('[BRIDGE] Starting Cloudflare Tunnel bridge on port 5000...');
  const child = spawn(CLOUDFLARED_BIN, ['tunnel', '--url', 'http://localhost:5000'], {
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    console.warn(`[BRIDGE] Cloudflare Tunnel closed (code ${code}). Reconnecting in 3s...`);
    setTimeout(runTunnel, 3000);
  });

  child.on('error', (err) => {
    console.error('[BRIDGE] Tunnel error:', err.message);
  });
}

runTunnel();
