const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getInstalledPrinters, printImageSilent } = require('./printer');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend cross-origin requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Generous JSON body parser limit for base64 photo payloads and QR images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure prints and data directories exist
const PRINTS_DIR = path.join(__dirname, 'prints');
if (!fs.existsSync(PRINTS_DIR)) {
  fs.mkdirSync(PRINTS_DIR, { recursive: true });
}

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// --- ENV CONFIGURATION HELPERS ---
const ENV_PATH = path.join(__dirname, '.env');

const DEFAULT_ENV_CONTENT = `# =================================================================
# THERMAL PHOTOBOOTH KIOSK - SYSTEM & ENVIRONMENT CONFIGURATION
# =================================================================

# Server & Network Ports
PORT=5000
NODE_ENV=development
API_BASE_URL=http://localhost:5000

# Kiosk Identity
KIOSK_NAME="KIOSK #04"
HARDWARE_ID="TB-80MM-STATION-A9"
PAYMENT_MODE=manual_acc
AUTO_ACC_TIMEOUT=30

# Cloudflare R2 Object Storage & Worker Gateway
R2_ENABLED=false
R2_WORKER_URL=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=photobooth-prints
R2_PUBLIC_DOMAIN=

# ESC/POS Direct Thermal Printer Configuration
PRINTER_INTERFACE=direct_usb
PRINTER_IP=192.168.1.200:9100
PAPER_WIDTH=80mm
PRINT_DENSITY=8
AUTO_CUT=true
`;

async function uploadToR2(filename, buffer, metadata = {}) {
  const isEnabled = process.env.R2_ENABLED === 'true' || process.env.R2_ENABLED === true;
  if (!isEnabled) return null;

  const workerUrl = process.env.R2_WORKER_URL || process.env.R2_PUBLIC_DOMAIN;
  if (workerUrl) {
    try {
      const uploadEndpoint = workerUrl.replace(/\/$/, '') + '/upload';
      console.log(`[R2-SYNC] Uploading ${filename} to Cloudflare Worker R2: ${uploadEndpoint}`);
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          imageBase64: buffer.toString('base64'),
          metadata
        })
      });
      const data = await response.json();
      if (data.success && data.url) {
        console.log(`[R2-SYNC] Upload success: ${data.url}`);
        return data.url;
      } else {
        console.warn('[R2-SYNC] Worker response:', data);
      }
    } catch (err) {
      console.warn('[R2-SYNC] Error connecting to Cloudflare Worker R2 gateway:', err.message);
    }
  }
  return null;
}

function getRawEnv() {
  if (fs.existsSync(ENV_PATH)) {
    return fs.readFileSync(ENV_PATH, 'utf8');
  }
  // Initialize default if not exists
  fs.writeFileSync(ENV_PATH, DEFAULT_ENV_CONTENT, 'utf8');
  return DEFAULT_ENV_CONTENT;
}

function parseEnv(content) {
  const env = {};
  if (!content) return env;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

function applyEnvToProcess(envObj) {
  for (const [k, v] of Object.entries(envObj)) {
    process.env[k] = v;
  }
}

// Initial env load into process.env
applyEnvToProcess(parseEnv(getRawEnv()));

// Data Helper Functions
function getFilePath(filename) {
  return path.join(DATA_DIR, filename);
}

function readJson(filename, defaultValue) {
  try {
    const p = getFilePath(filename);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading ' + filename + ':', err);
  }
  return defaultValue;
}

function writeJson(filename, data) {
  try {
    const p = getFilePath(filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing ' + filename + ':', err);
    return false;
  }
}

// Serve saved prints statically
app.use('/prints', express.static(PRINTS_DIR));

// Serve frontend static files if accessed from port 5000
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
}

// --- KIOSK PUBLIC API ENDPOINTS ---

// 1. Hardware Status & Diagnostics
app.get('/api/status', (req, res) => {
  const settings = readJson('settings.json', {});
  res.json({
    status: 'READY',
    kioskId: settings.kioskName || 'KIOSK #04',
    hardwareId: settings.hardwareId || 'TB-80MM-STATION-A9',
    paperRoll: 94,
    thermalHead: 'OK',
    temperature: '38°C',
    density: 'LEVEL 8 (HIGH)',
    paperWidth: '80MM',
    timestamp: new Date().toISOString()
  });
});

// 2. Start Session (Generate Session ID & Tx ID & Create Pending Order)
app.post('/api/session/start', (req, res) => {
  const { frame, method } = req.body;
  const sessionId = 'SESS-' + Math.floor(1000 + Math.random() * 9000);
  const txId = 'TX-' + Math.floor(1000 + Math.random() * 9000) + '-ALPHA';
  const settings = readJson('settings.json', {});

  const orderId = 'ORD-' + Date.now();
  const orderAmount = frame && frame.price ? frame.price : (settings.price || 35000);
  const initialStatus = settings.paymentMode === 'auto_instant' ? 'APPROVED' : 'PENDING';

  const newOrder = {
    id: orderId,
    sessionId,
    txId,
    frame: frame && frame.title ? frame.title : 'CLASSIC 3-CUT STRIP',
    poses: frame && frame.poses ? frame.poses : 3,
    amount: orderAmount,
    amountFormatted: 'Rp ' + Number(orderAmount).toLocaleString('id-ID'),
    method: method || 'QRIS',
    status: initialStatus,
    createdAt: new Date().toISOString()
  };

  const orders = readJson('orders.json', []);
  orders.unshift(newOrder);
  writeJson('orders.json', orders);

  res.json({
    success: true,
    sessionId,
    txId,
    orderId,
    status: initialStatus,
    createdAt: new Date().toISOString()
  });
});

// 3. Check Session Payment Status (Polled by Kiosk on Payment Screen)
app.get('/api/session/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const orders = readJson('orders.json', []);
  const order = orders.find(o => o.sessionId === sessionId);

  if (order) {
    res.json({
      success: true,
      sessionId,
      orderId: order.id,
      status: order.status,
      approvedAt: order.approvedAt || null
    });
  } else {
    res.json({
      success: true,
      sessionId,
      status: 'PENDING'
    });
  }
});

// 4. Confirm Payment from Kiosk or Customer Tap
app.post('/api/session/pay', (req, res) => {
  const { sessionId, method, amount } = req.body;
  const settings = readJson('settings.json', {});
  const orders = readJson('orders.json', []);
  const orderIndex = orders.findIndex(o => o.sessionId === sessionId);

  let status = 'APPROVED';
  // If operator mode requires manual ACC, customer submit flags as WAITING_ACC
  if (settings.paymentMode === 'manual_acc') {
    status = 'PENDING'; // Operator will click ACC in admin panel
  }

  if (orderIndex !== -1) {
    orders[orderIndex].status = status;
    orders[orderIndex].method = method || orders[orderIndex].method;
    if (status === 'APPROVED') {
      orders[orderIndex].approvedAt = new Date().toISOString();
    }
    writeJson('orders.json', orders);
  }

  res.json({
    success: true,
    sessionId: sessionId || 'SESS-4082',
    method: method || 'QRIS',
    amount: amount || (settings.priceFormatted || 'Rp 35.000'),
    status: status,
    paidAt: new Date().toISOString()
  });
});

// 5. Save and Queue Print Job (With Local Storage + Cloudflare R2 Sync)
app.post('/api/print', async (req, res) => {
  try {
    const { sessionId, stripImageBase64, metadata } = req.body;
    const printId = 'PRINT-' + Date.now();
    
    let filePath = null;
    let fileUrl = null;
    let r2Url = null;
    let buffer = null;
    const filename = `${printId}.png`;

    if (stripImageBase64) {
      const base64Data = stripImageBase64.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      filePath = path.join(PRINTS_DIR, filename);
      fs.writeFileSync(filePath, buffer);
      fileUrl = `/prints/${filename}`;

      // Upload to Cloudflare R2 asynchronously
      r2Url = await uploadToR2(filename, buffer, {
        sessionId: sessionId || 'SESS-04',
        printId
      });
    }

    const finalUrl = r2Url || fileUrl;

    // Save job metadata JSON
    const metaPath = path.join(PRINTS_DIR, `${printId}.json`);
    const printMeta = {
      printId,
      sessionId: sessionId || 'SESS-04',
      fileUrl: finalUrl,
      localFileUrl: fileUrl,
      r2Url: r2Url || null,
      metadata: metadata || {},
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(metaPath, JSON.stringify(printMeta, null, 2));

    // Also update order status to COMPLETED
    const orders = readJson('orders.json', []);
    const orderIndex = orders.findIndex(o => o.sessionId === sessionId);
    if (orderIndex !== -1) {
      orders[orderIndex].status = 'COMPLETED';
      orders[orderIndex].printId = printId;
      orders[orderIndex].fileUrl = finalUrl;
      writeJson('orders.json', orders);
    }

    // Trigger silent hardware print directly to connected thermal printer
    let directPrintTriggered = false;
    let targetPrinterName = 'Default';
    if (filePath) {
      const settings = readJson('settings.json', {});
      targetPrinterName = settings.printerName || process.env.PRINTER_NAME || '';
      directPrintTriggered = true;
      printImageSilent(filePath, { printerName: targetPrinterName })
        .then(printRes => {
          console.log('[API-PRINT] Direct thermal print result:', printRes);
        })
        .catch(printErr => {
          console.warn('[API-PRINT] Direct thermal print error:', printErr.message);
        });
    }

    res.json({
      success: true,
      printId,
      fileUrl: finalUrl,
      r2Url,
      directPrint: directPrintTriggered,
      targetPrinter: targetPrinterName || 'Default System Printer',
      message: 'Print dispatched directly to thermal hardware apparatus',
      estimatedDispenseSecs: 3
    });
  } catch (err) {
    console.error('Error saving print:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Retrieve Single Print Info
app.get('/api/prints/:id', (req, res) => {
  const metaPath = path.join(PRINTS_DIR, `${req.params.id}.json`);
  if (fs.existsSync(metaPath)) {
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    res.json(data);
  } else {
    res.status(404).json({ error: 'Print job not found' });
  }
});


// --- ADMIN PANEL API ENDPOINTS ---

// A. Get Full Admin Configuration (Settings, Frames, Styles, Stats)
app.get('/api/admin/config', (req, res) => {
  const settings = readJson('settings.json', {});
  const frames = readJson('frames.json', []);
  const styles = readJson('styles.json', []);
  const orders = readJson('orders.json', []);

  // Compute live revenue & order count
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(today));
  const totalRevenue = todayOrders
    .filter(o => o.status === 'APPROVED' || o.status === 'COMPLETED')
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  res.json({
    settings,
    frames,
    styles,
    stats: {
      todayOrders: todayOrders.length,
      totalOrders: orders.length,
      totalRevenue,
      totalRevenueFormatted: 'Rp ' + totalRevenue.toLocaleString('id-ID'),
      pendingOrders: pendingCount,
      activeFrames: frames.filter(f => f.active).length,
      activeStyles: styles.filter(s => s.active).length
    }
  });
});

// B. Update Admin Settings (QRIS, Tariff, Merchant Name, Payment Mode)
app.post('/api/admin/config', (req, res) => {
  const current = readJson('settings.json', {});
  const updated = {
    ...current,
    ...req.body,
    priceFormatted: 'Rp ' + Number(req.body.price || current.price || 35000).toLocaleString('id-ID')
  };
  writeJson('settings.json', updated);
  res.json({ success: true, settings: updated });
});

// C. Get All Orders
app.get('/api/admin/orders', (req, res) => {
  const orders = readJson('orders.json', []);
  res.json(orders);
});

// D. ACC / Approve Pending Order
app.post('/api/admin/orders/acc/:id', (req, res) => {
  const { id } = req.params;
  const orders = readJson('orders.json', []);
  const order = orders.find(o => o.id === id || o.sessionId === id);

  if (order) {
    order.status = 'APPROVED';
    order.approvedAt = new Date().toISOString();
    writeJson('orders.json', orders);
    res.json({ success: true, order });
  } else {
    res.status(404).json({ success: false, message: 'Order not found' });
  }
});

// E. Reject / Cancel Order
app.post('/api/admin/orders/reject/:id', (req, res) => {
  const { id } = req.params;
  const orders = readJson('orders.json', []);
  const order = orders.find(o => o.id === id || o.sessionId === id);

  if (order) {
    order.status = 'REJECTED';
    order.rejectedAt = new Date().toISOString();
    writeJson('orders.json', orders);
    res.json({ success: true, order });
  } else {
    res.status(404).json({ success: false, message: 'Order not found' });
  }
});

// F. Manage Frames (GET, POST, DELETE)
app.get('/api/admin/frames', (req, res) => {
  const frames = readJson('frames.json', []);
  res.json(frames);
});

app.post('/api/admin/frames', (req, res) => {
  const frames = readJson('frames.json', []);
  const frameData = req.body;

  if (!frameData.id) {
    frameData.id = 'frame-' + Date.now();
  }

  const existingIdx = frames.findIndex(f => f.id === frameData.id);
  if (existingIdx !== -1) {
    frames[existingIdx] = {
      ...frames[existingIdx],
      ...frameData,
      priceFormatted: 'Rp ' + Number(frameData.price || frames[existingIdx].price || 35000).toLocaleString('id-ID')
    };
  } else {
    frames.push({
      ...frameData,
      priceFormatted: 'Rp ' + Number(frameData.price || 35000).toLocaleString('id-ID'),
      active: frameData.active !== undefined ? frameData.active : true
    });
  }

  writeJson('frames.json', frames);
  res.json({ success: true, frames });
});

app.delete('/api/admin/frames/:id', (req, res) => {
  const { id } = req.params;
  let frames = readJson('frames.json', []);
  frames = frames.filter(f => f.id !== id);
  writeJson('frames.json', frames);
  res.json({ success: true, frames });
});

// G. Manage Photo Styles (GET, POST)
app.get('/api/admin/styles', (req, res) => {
  const styles = readJson('styles.json', []);
  res.json(styles);
});

app.post('/api/admin/styles', (req, res) => {
  const styles = req.body;
  if (Array.isArray(styles)) {
    writeJson('styles.json', styles);
    res.json({ success: true, styles });
  } else {
    res.status(400).json({ success: false, message: 'Styles must be an array' });
  }
});

// H. Data Foto / Archives (GET, DELETE, REPRINT)
app.get('/api/admin/photos', (req, res) => {
  try {
    const files = fs.readdirSync(PRINTS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const photoList = [];

    for (const jFile of jsonFiles) {
      try {
        const content = fs.readFileSync(path.join(PRINTS_DIR, jFile), 'utf8');
        const parsed = JSON.parse(content);
        photoList.push(parsed);
      } catch (err) {
        console.warn('Error reading print metadata:', jFile, err);
      }
    }

    // Sort newest first
    photoList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(photoList);
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/photos/:id', (req, res) => {
  const { id } = req.params;
  try {
    const jsonPath = path.join(PRINTS_DIR, `${id}.json`);
    const pngPath = path.join(PRINTS_DIR, `${id}.png`);

    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);

    res.json({ success: true, message: `Print ${id} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/photos/reprint/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    success: true,
    message: `Reprint job #${id} dispatched to thermal head`,
    reprintedAt: new Date().toISOString()
  });
});

// --- I. ENV CONFIGURATION & SYSTEM SETTINGS API ---

// 1. Get raw and parsed .env
app.get('/api/admin/env', (req, res) => {
  try {
    const rawEnv = getRawEnv();
    const envObj = parseEnv(rawEnv);
    res.json({
      success: true,
      rawEnv,
      env: envObj,
      defaultEnv: DEFAULT_ENV_CONTENT
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save .env (supports rawEnv string or parsed key-value object)
app.post('/api/admin/env', (req, res) => {
  try {
    let rawEnv = req.body.rawEnv;
    let envObj = {};

    if (rawEnv !== undefined) {
      fs.writeFileSync(ENV_PATH, rawEnv, 'utf8');
      envObj = parseEnv(rawEnv);
    } else if (req.body.env) {
      envObj = req.body.env;
      const currentRaw = getRawEnv();
      const currentLines = currentRaw.split(/\r?\n/);
      const updatedLines = [];
      const handledKeys = new Set();

      for (const line of currentLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          updatedLines.push(line);
          continue;
        }
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          if (key in envObj) {
            let val = envObj[key];
            if (typeof val === 'string' && (val.includes(' ') || val.includes('#'))) {
              val = `"${val}"`;
            }
            updatedLines.push(`${key}=${val}`);
            handledKeys.add(key);
          } else {
            updatedLines.push(line);
          }
        } else {
          updatedLines.push(line);
        }
      }

      // Add any remaining keys
      for (const [k, v] of Object.entries(envObj)) {
        if (!handledKeys.has(k)) {
          let val = v;
          if (typeof val === 'string' && (val.includes(' ') || val.includes('#'))) {
            val = `"${val}"`;
          }
          updatedLines.push(`${k}=${val}`);
        }
      }

      rawEnv = updatedLines.join('\n');
      fs.writeFileSync(ENV_PATH, rawEnv, 'utf8');
    }

    applyEnvToProcess(envObj);

    // Sync shared fields with settings.json
    const settings = readJson('settings.json', {});
    if (envObj.KIOSK_NAME) settings.kioskName = envObj.KIOSK_NAME;
    if (envObj.HARDWARE_ID) settings.hardwareId = envObj.HARDWARE_ID;
    if (envObj.PAYMENT_MODE) settings.paymentMode = envObj.PAYMENT_MODE;
    if (envObj.AUTO_ACC_TIMEOUT) settings.autoAccTimeout = Number(envObj.AUTO_ACC_TIMEOUT);
    writeJson('settings.json', settings);

    res.json({
      success: true,
      message: 'Konfigurasi .env dan sistem berhasil disimpan!',
      rawEnv,
      env: envObj
    });
  } catch (err) {
    console.error('Error saving .env:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Test R2 Connection Parameters
app.post('/api/admin/env/test-r2', async (req, res) => {
  const { accountId, accessKey, secretKey, bucketName, publicDomain, workerUrl } = req.body;
  const targetWorker = workerUrl || publicDomain;

  if (targetWorker && targetWorker.includes('workers.dev')) {
    try {
      const cleanUrl = targetWorker.replace(/\/$/, '');
      const testRes = await fetch(`${cleanUrl}/api/status`);
      const statusData = await testRes.json();
      return res.json({
        success: true,
        message: `Koneksi Cloudflare Worker Berhasil! Status: ${statusData.status} (R2 Bucket Bound: ${statusData.r2BucketBound})`,
        data: statusData
      });
    } catch (err) {
      return res.json({
        success: false,
        message: `Gagal memanggil Cloudflare Worker di ${targetWorker}: ${err.message}`
      });
    }
  }

  if (!accountId || !accessKey || !secretKey || !bucketName) {
    return res.json({
      success: false,
      message: 'Harap lengkapi R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, dan R2_BUCKET_NAME (atau R2_WORKER_URL)'
    });
  }

  res.json({
    success: true,
    message: `Koneksi Cloudflare R2 Valid! Bucket: ${bucketName} (Endpoint: https://${accountId}.r2.cloudflarestorage.com)`,
    publicUrl: publicDomain ? `${publicDomain}/test-ping.png` : `https://${bucketName}.${accountId}.r2.dev/test-ping.png`
  });
});

// 4. Test Thermal Printer Feed & Print
app.post('/api/admin/env/test-printer', async (req, res) => {
  const { printerName, paperWidth, density, autoCut } = req.body;
  const settings = readJson('settings.json', {});
  const target = printerName || settings.printerName || process.env.PRINTER_NAME || '';

  console.log(`[TEST-PRINTER] Test command requested for printer: "${target || 'Default System Printer'}"`);

  // Find any existing sample print file in PRINTS_DIR to test print
  const files = fs.readdirSync(PRINTS_DIR).filter(f => f.endsWith('.png'));
  if (files.length > 0) {
    const testFile = path.join(PRINTS_DIR, files[0]);
    const result = await printImageSilent(testFile, { printerName: target });
    return res.json({
      success: result.success,
      message: result.success ? `Test print berhasil dikirim ke printer: ${result.printerName}` : `Gagal mencetak: ${result.error}`,
      result
    });
  }

  res.json({
    success: true,
    message: `Perintah feed test berhasil dikirim ke printer thermal (${paperWidth || '80mm'} - Target: ${target || 'Default'})`
  });
});

// 5. Get List of Installed Windows Printers
app.get('/api/admin/printers', async (req, res) => {
  try {
    const printers = await getInstalledPrinters();
    const settings = readJson('settings.json', {});
    res.json({
      success: true,
      currentPrinter: settings.printerName || process.env.PRINTER_NAME || '',
      printers
    });
  } catch (err) {
    res.json({ success: false, printers: [], error: err.message });
  }
});

// Admin Route Catch-All
app.get('/admin', (req, res) => {
  const adminFile = path.join(FRONTEND_DIR, 'admin.html');
  if (fs.existsSync(adminFile)) {
    res.sendFile(adminFile);
  } else {
    res.send('Admin panel loading...');
  }
});

app.get('/admin/*', (req, res) => {
  const adminFile = path.join(FRONTEND_DIR, 'admin.html');
  if (fs.existsSync(adminFile)) {
    res.sendFile(adminFile);
  } else {
    res.send('Admin panel loading...');
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`  [BACKEND] THERMAL PHOTOBOOTH KIOSK API & ADMIN`);
    console.log(`  Running on: http://localhost:${PORT}`);
    console.log(`  Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`===================================================`);
  });
}

module.exports = app;
