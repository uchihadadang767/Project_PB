const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const http = require('http');

// Proxy /api requests to backend server (so localhost, 127.0.0.1, and network IP all work seamlessly)
app.use('/api', (req, res) => {
  const backendParsed = new URL(BACKEND_URL);
  const options = {
    hostname: backendParsed.hostname || '127.0.0.1',
    port: backendParsed.port || 5000,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${backendParsed.hostname || '127.0.0.1'}:${backendParsed.port || 5000}`
    }
  };

  const proxyReq = http.request(options, (backRes) => {
    res.writeHead(backRes.statusCode, backRes.headers);
    backRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[PROXY ERROR]', err.message);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: `Gagal menghubungkan ke backend di ${BACKEND_URL}: ${err.message}`
      });
    }
  });

  req.pipe(proxyReq);
});

// Serve static frontend files directly from current directory
app.use(express.static(__dirname));

// Route /admin and /admin/* to admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Fallback to index.html for Kiosk SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  [FRONTEND] THERMAL PHOTOBOOTH KIOSK UI & ADMIN`);
  console.log(`  Kiosk Running on: http://localhost:${PORT}`);
  console.log(`  Admin Panel on:   http://localhost:${PORT}/admin`);
  console.log(`  Connecting to Backend at: ${BACKEND_URL}`);
  console.log(`===================================================`);
});
