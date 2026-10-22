const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
  console.log(`  Connecting to Backend at: http://localhost:5000`);
  console.log(`===================================================`);
});
