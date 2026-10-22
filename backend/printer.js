/**
 * Thermal Printer Hardware & Spooler Controller (Windows Direct Silent Print)
 * Prints receipt images directly to connected Thermal Printers without opening
 * any browser print dialogs, tabs, or third-party popups.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const PS_HELPER_PATH = path.join(__dirname, 'print_helper.ps1');

/**
 * Get list of installed Windows printers
 */
function getInstalledPrinters() {
  return new Promise((resolve) => {
    const psScript = `Get-CimInstance Win32_Printer | Select-Object Name, Default, PortName | ConvertTo-Json -Compress`;

    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 8000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        console.warn('[PRINTER] Failed to query printers via CIM, using fallback.');
        return resolve([
          { name: 'Default Printer', isDefault: true }
        ]);
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const result = list.map(p => ({
          name: p.Name,
          isDefault: Boolean(p.Default),
          port: p.PortName
        }));
        resolve(result);
      } catch (parseErr) {
        console.warn('[PRINTER] Error parsing printer list JSON:', parseErr.message);
        resolve([{ name: 'Default Printer', isDefault: true }]);
      }
    });
  });
}

/**
 * Print an image file silently using Windows PrintDocument spooler
 * @param {string} imagePath - Absolute path to the receipt image (.png)
 * @param {object} options - Options: printerName, paperWidth, autoCut
 */
function printImageSilent(imagePath, options = {}) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(imagePath)) {
      return reject(new Error(`Receipt image file not found: ${imagePath}`));
    }

    const printerName = options.printerName || '';
    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      PS_HELPER_PATH,
      '-ImagePath',
      imagePath,
      '-PrinterName',
      printerName
    ];

    console.log(`[PRINTER] Dispatching silent thermal print job for: ${path.basename(imagePath)} (Target Printer: ${printerName || 'Default'})`);

    execFile('powershell.exe', args, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[PRINTER] Print execution error:`, error.message, stderr);
        return resolve({
          success: false,
          error: stderr || error.message,
          stdout
        });
      }

      console.log(`[PRINTER] Print job completed successfully:`, stdout.trim());
      resolve({
        success: true,
        message: stdout.trim(),
        printerName: printerName || 'Default System Printer'
      });
    });
  });
}

/**
 * Send raw ESC/POS feed and cut command via Network TCP (Port 9100) if network printer configured
 */
function printNetworkEscPos(ip, port = 9100, buffer) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(5000);

    client.connect(port, ip, () => {
      client.write(buffer, () => {
        client.end();
        resolve({ success: true, message: `Raw ESC/POS sent to ${ip}:${port}` });
      });
    });

    client.on('error', (err) => {
      client.destroy();
      reject(err);
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error(`Timeout connecting to printer at ${ip}:${port}`));
    });
  });
}

module.exports = {
  getInstalledPrinters,
  printImageSilent,
  printNetworkEscPos
};
