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
 * Check if the thermal printer USB hardware is physically connected & powered on
 */
function checkPrinterHardwareStatus() {
  return new Promise((resolve) => {
    const psScript = `
      $dev = Get-PnpDevice | Where-Object {
        $_.Present -eq $true -and (
          $_.InstanceId -like '*0FE6*' -or
          $_.InstanceId -like '*USBPRINT*UNKNOWNPRINTER*' -or
          $_.InstanceId -like '*USB004*' -or
          ($_.Class -eq 'Printer' -and $_.FriendlyName -notlike '*PDF*' -and $_.FriendlyName -notlike '*XPS*' -and $_.FriendlyName -notlike '*Root*')
        )
      } | Select-Object -First 1 FriendlyName, InstanceId, Status
      if ($dev) {
        @{ present = $true; friendlyName = $dev.FriendlyName; instanceId = $dev.InstanceId } | ConvertTo-Json -Compress
      } else {
        @{ present = $false } | ConvertTo-Json -Compress
      }
    `;

    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 6000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        return resolve({ present: false });
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (e) {
        resolve({ present: false });
      }
    });
  });
}

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
          { name: 'Thermal Printer', isDefault: true }
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
        resolve([{ name: 'Thermal Printer', isDefault: true }]);
      }
    });
  });
}

/**
 * Print an image file silently using Windows PrintDocument spooler & raw ESC/POS
 * @param {string} imagePath - Absolute path to the receipt image (.png)
 * @param {object} options - Options: printerName, paperWidth, autoCut
 */
async function printImageSilent(imagePath, options = {}) {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Receipt image file not found: ${imagePath}`);
  }

  const printerName = options.printerName || 'Thermal Printer';

  // Check hardware connection if targeting Thermal Printer
  if (printerName.toLowerCase().includes('thermal') || !options.printerName) {
    const hw = await checkPrinterHardwareStatus();
    if (!hw.present) {
      console.warn(`[PRINTER] Thermal Printer is NOT physically present on USB! (Power OFF or USB unplugged)`);
      return {
        success: false,
        hardwareOffline: true,
        error: 'Printer Thermal belum terdeteksi aktif di USB! Pastikan kabel USB terpasang kuat ke PC dan tombol power printer dinyalakan (ON).',
        printerName
      };
    }
  }

  return new Promise((resolve) => {
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

    console.log(`[PRINTER] Dispatching silent thermal print job for: ${path.basename(imagePath)} (Target Printer: ${printerName})`);

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
 * Print a test strip receipt to verify USB thermal printer feed and cut
 * @param {object} options - Options: printerName
 */
async function printTestReceipt(options = {}) {
  const printerName = options.printerName || 'Thermal Printer';

  // Check hardware connection if targeting thermal printer
  if (printerName.toLowerCase().includes('thermal') || !options.printerName) {
    const hw = await checkPrinterHardwareStatus();
    if (!hw.present) {
      console.warn(`[PRINTER] Thermal Printer is NOT physically present on USB! (Power OFF or USB unplugged)`);
      return {
        success: false,
        hardwareOffline: true,
        error: 'Printer Thermal belum terdeteksi aktif di USB! Pastikan kabel USB terpasang kuat ke PC dan tombol power printer dinyalakan (ON).',
        printerName
      };
    }
  }

  return new Promise((resolve) => {
    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      PS_HELPER_PATH,
      '-PrinterName',
      printerName,
      '-TestFeed'
    ];

    console.log(`[PRINTER] Sending test receipt to: ${printerName}`);

    execFile('powershell.exe', args, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[PRINTER] Test receipt error:`, error.message, stderr);
        return resolve({
          success: false,
          error: stderr || error.message,
          stdout
        });
      }

      console.log(`[PRINTER] Test receipt sent successfully:`, stdout.trim());
      resolve({
        success: true,
        message: stdout.trim(),
        printerName
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
  checkPrinterHardwareStatus,
  getInstalledPrinters,
  printImageSilent,
  printTestReceipt,
  printNetworkEscPos
};
