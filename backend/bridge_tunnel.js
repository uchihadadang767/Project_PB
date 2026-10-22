const { spawn } = require('child_process');

function runTunnel() {
  console.log('[BRIDGE] Starting localtunnel bridge for Vercel (subdomain: photobooth-kiosk-local)...');
  const child = spawn('npx.cmd', ['localtunnel', '--port', '5000', '--subdomain', 'photobooth-kiosk-local'], {
    shell: true,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    console.warn(`[BRIDGE] Tunnel closed (code ${code}). Reconnecting in 3s...`);
    setTimeout(runTunnel, 3000);
  });

  child.on('error', (err) => {
    console.error('[BRIDGE] Tunnel error:', err.message);
  });
}

runTunnel();
