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
 * Check if the thermal printer (Bluetooth or USB) hardware is physically connected & powered on
 */
function checkPrinterHardwareStatus() {
  return new Promise((resolve) => {
    const psScript = `
      $dev = Get-PnpDevice | Where-Object {
        $_.Present -eq $true -and (
          $_.FriendlyName -like '*RPP*' -or
          $_.FriendlyName -like '*POS*' -or
          $_.InstanceId -like '*060384D4AE44*' -or
          $_.InstanceId -like '*COM6*' -or
          $_.InstanceId -like '*0FE6*' -or
          $_.InstanceId -like '*USBPRINT*UNKNOWNPRINTER*' -or
          $_.InstanceId -like '*USB004*' -or
          ($_.Class -eq 'Printer' -and $_.FriendlyName -notlike '*PDF*' -and $_.FriendlyName -notlike '*XPS*' -and $_.FriendlyName -notlike '*Root*' -and $_.FriendlyName -notlike '*Canon*')
        )
      } | Select-Object -First 1 FriendlyName, InstanceId, Status
      if ($dev) {
        @{ present = $true; friendlyName = $dev.FriendlyName; instanceId = $dev.InstanceId; isBluetooth = ($dev.FriendlyName -like '*RPP*' -or $dev.InstanceId -like '*060384D4AE44*' -or $dev.InstanceId -like '*COM6*') } | ConvertTo-Json -Compress
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
    const psScript = `
      $list = @()
      $bt = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.Present -eq $true -and ($_.FriendlyName -like '*RPP*' -or $_.InstanceId -like '*060384D4AE44*' -or $_.InstanceId -like '*COM6*') } | Select-Object -First 1
      if ($bt) {
        $list += @{ Name = "RPP02N (Bluetooth COM6)"; Default = $true; PortName = "COM6"; IsBluetooth = $true }
      }
      $printers = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Select-Object Name, Default, PortName
      if ($printers) {
        foreach ($p in $printers) {
          $list += @{ Name = $p.Name; Default = [bool]$p.Default; PortName = $p.PortName; IsBluetooth = ($p.PortName -like '*COM*') }
        }
      }
      if ($list.Count -eq 0) {
        $list += @{ Name = "RPP02N (Bluetooth COM6)"; Default = $true; PortName = "COM6"; IsBluetooth = $true }
      }
      $list | ConvertTo-Json -Compress
    `;

    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 8000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        console.warn('[PRINTER] Failed to query printers via CIM, using fallback.');
        return resolve([
          { name: 'RPP02N (Bluetooth COM6)', isDefault: true, port: 'COM6', isBluetooth: true },
          { name: 'Thermal Printer', isDefault: false, port: 'COM6:' }
        ]);
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const result = list.map(p => ({
          name: p.Name,
          isDefault: Boolean(p.Default),
          port: p.PortName,
          isBluetooth: Boolean(p.IsBluetooth)
        }));
        resolve(result);
      } catch (parseErr) {
        console.warn('[PRINTER] Error parsing printer list JSON:', parseErr.message);
        resolve([
          { name: 'RPP02N (Bluetooth COM6)', isDefault: true, port: 'COM6', isBluetooth: true },
          { name: 'Thermal Printer', isDefault: false, port: 'COM6:' }
        ]);
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

  const printerName = options.printerName || 'RPP02N (Bluetooth COM6)';

  // Check hardware connection if targeting Thermal / Bluetooth Printer
  const hw = await checkPrinterHardwareStatus();
  if (!hw.present && (printerName.toLowerCase().includes('thermal') || printerName.includes('RPP') || !options.printerName)) {
    console.warn(`[PRINTER] Thermal / Bluetooth Printer is NOT physically present or paired!`);
    return {
      success: false,
      hardwareOffline: true,
      error: 'Printer Thermal belum terdeteksi aktif (Bluetooth / USB)! Pastikan printer Bluetooth RPP02N dinyalakan (ON) dan terhubung via Bluetooth (COM6).',
      printerName
    };
  }

  return new Promise((resolve) => {
    const isBluetooth = hw.isBluetooth || printerName.includes('RPP') || printerName.includes('COM') || printerName.includes('Bluetooth');
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

    if (options.paperWidth) {
      args.push('-PaperWidth', options.paperWidth);
    } else if (isBluetooth) {
      args.push('-PaperWidth', '58mm');
    }

    if (options.autoCut === false || isBluetooth) {
      args.push('-NoCut');
    }

    console.log(`[PRINTER] Dispatching silent print job for: ${path.basename(imagePath)} (Target: ${printerName}, BT: ${isBluetooth})`);

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
 * Print a test strip receipt to verify Bluetooth/USB thermal printer feed
 * @param {object} options - Options: printerName, paperWidth, autoCut
 */
async function printTestReceipt(options = {}) {
  const printerName = options.printerName || 'RPP02N (Bluetooth COM6)';

  // Check hardware connection if targeting thermal / bluetooth printer
  const hw = await checkPrinterHardwareStatus();
  if (!hw.present && (printerName.toLowerCase().includes('thermal') || printerName.includes('RPP') || !options.printerName)) {
    console.warn(`[PRINTER] Thermal / Bluetooth Printer is NOT detected!`);
    return {
      success: false,
      hardwareOffline: true,
      error: 'Printer Thermal belum terdeteksi aktif (Bluetooth / USB)! Pastikan printer Bluetooth RPP02N dinyalakan (ON) dan terhubung via Bluetooth (COM6).',
      printerName
    };
  }

  return new Promise((resolve) => {
    const isBluetooth = hw.isBluetooth || printerName.includes('RPP') || printerName.includes('COM') || printerName.includes('Bluetooth');
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

    if (options.paperWidth) {
      args.push('-PaperWidth', options.paperWidth);
    } else if (isBluetooth) {
      args.push('-PaperWidth', '58mm');
    }

    if (options.autoCut === false || isBluetooth) {
      args.push('-NoCut');
    }

    console.log(`[PRINTER] Sending test receipt to: ${printerName} (BT: ${isBluetooth})`);

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
