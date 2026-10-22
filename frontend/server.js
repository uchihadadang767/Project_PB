const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files directly from current directory
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  [FRONTEND] THERMAL PHOTOBOOTH KIOSK UI`);
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log(`  Connecting to Backend at: http://localhost:5000`);
  console.log(`===================================================`);
});
