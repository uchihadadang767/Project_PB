const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend cross-origin requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Generous JSON body parser limit for base64 photo payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure prints directory exists
const PRINTS_DIR = path.join(__dirname, 'prints');
if (!fs.existsSync(PRINTS_DIR)) {
  fs.mkdirSync(PRINTS_DIR, { recursive: true });
}

// Serve saved prints statically
app.use('/prints', express.static(PRINTS_DIR));

// --- API Endpoints ---

// 1. Hardware Status & Diagnostics
app.get('/api/status', (req, res) => {
  res.json({
    status: 'READY',
    kioskId: 'KIOSK #04',
    hardwareId: 'TB-80MM-STATION-A9',
    paperRoll: 94,
    thermalHead: 'OK',
    temperature: '38°C',
    density: 'LEVEL 8 (HIGH)',
    paperWidth: '80MM',
    timestamp: new Date().toISOString()
  });
});

// 2. Start Session (Generate Session ID & Tx ID)
app.post('/api/session/start', (req, res) => {
  const sessionId = 'SESS-' + Math.floor(1000 + Math.random() * 9000);
  const txId = 'TX-' + Math.floor(1000 + Math.random() * 9000) + '-ALPHA';
  res.json({
    success: true,
    sessionId,
    txId,
    createdAt: new Date().toISOString()
  });
});

// 3. Confirm Payment
app.post('/api/session/pay', (req, res) => {
  const { sessionId, method, amount } = req.body;
  res.json({
    success: true,
    sessionId: sessionId || 'SESS-4082',
    method: method || 'QRIS',
    amount: amount || 'Rp 35.000',
    status: 'AUTHORIZED',
    paidAt: new Date().toISOString()
  });
});

// 4. Save and Queue Print Job
app.post('/api/print', (req, res) => {
  try {
    const { sessionId, stripImageBase64, metadata } = req.body;
    const printId = 'PRINT-' + Date.now();
    
    let filePath = null;
    let fileUrl = null;

    if (stripImageBase64) {
      const base64Data = stripImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${printId}.png`;
      filePath = path.join(PRINTS_DIR, filename);
      fs.writeFileSync(filePath, buffer);
      fileUrl = `/prints/${filename}`;
    }

    // Save job metadata JSON
    const metaPath = path.join(PRINTS_DIR, `${printId}.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      printId,
      sessionId: sessionId || 'SESS-04',
      fileUrl,
      metadata: metadata || {},
      createdAt: new Date().toISOString()
    }, null, 2));

    res.json({
      success: true,
      printId,
      fileUrl,
      message: 'Print dispatched to direct thermal feed apparatus',
      estimatedDispenseSecs: 3
    });
  } catch (err) {
    console.error('Error saving print:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Retrieve Print Info
app.get('/api/prints/:id', (req, res) => {
  const metaPath = path.join(PRINTS_DIR, `${req.params.id}.json`);
  if (fs.existsSync(metaPath)) {
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    res.json(data);
  } else {
    res.status(404).json({ error: 'Print job not found' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`  [BACKEND] THERMAL PHOTOBOOTH KIOSK API`);
    console.log(`  Running on: http://localhost:${PORT}`);
    console.log(`===================================================`);
  });
}

module.exports = app;
