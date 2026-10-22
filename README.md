# Thermal Brutalism Photobooth Kiosk (Separated Frontend & Backend)

Projek Photobooth Kiosk berbasis tema **Thermal Brutalism** yang telah dipisahkan strukturnya secara modular antara **Backend (Node.js API)** dan **Frontend (Client UI)**.

---

## 📁 Struktur Folder Project

```
Project_PB/
├── backend/
│   ├── server.js          # Express API server dengan CORS (Port 5000)
│   ├── package.json       # Dependencies backend (express, cors)
│   └── prints/            # Direktori penyimpanan digital receipt struk (.png & .json)
├── frontend/
│   ├── index.html         # Antarmuka Kiosk 6-alur alur lengkap
│   ├── server.js          # Express static server client (Port 3000)
│   ├── package.json       # Dependencies frontend
│   ├── css/
│   │   └── style.css      # Styling brutalist, gerigi receipt, dan animasi dispenser
│   └── js/
│       ├── app.js         # State management & controller alur (menghubungkan ke API Port 5000)
│       ├── camera.js      # Kontrol webcam langsung + photobooth simulator
│       ├── dither.js      # 1-bit Bayer matrix ordered dithering engine
│       └── audio.js       # Synthesizer Web Audio API untuk efek suara mekanik
├── package.json           # Root runner (menjalankan backend & frontend bersamaan)
└── .gitignore             # Mengabaikan node_modules, prints, dan temporary files
```

---

## ⚡ Cara Menjalankan Secara Lokal

Kamu punya 2 cara mudah untuk menjalankannya:

### 🌟 Cara 1: Sekaligus (Rekomendasi - 1 Perintah)
Buka terminal di root folder (`d:\jambul\Project_PB`), lalu jalankan:

```bash
npm run dev
```
Perintah ini akan menyalakan **Backend** dan **Frontend** secara bersamaan menggunakan `concurrently`:
- **Backend API**: `http://localhost:5000`
- **Frontend Kiosk**: `http://localhost:3000`

---

### 💻 Cara 2: Menjalankan Terpisah di 2 Terminal

#### Terminal 1: Backend (API Server)
```bash
cd d:\jambul\Project_PB\backend
npm run dev
# Backend berjalan di: http://localhost:5000
```

#### Terminal 2: Frontend (Client UI)
```bash
cd d:\jambul\Project_PB\frontend
npm run dev
# Frontend berjalan di: http://localhost:3000
```

Buka browser kamu dan akses:
👉 **`http://localhost:3000`**

---

## 📸 Fitur & 6 Alur Interaktif

1. **01 // STANDBY**:
   - Klik **"TAP TO START"** atau tekan **Space/Enter** untuk bangunkan kiosk.
   - Sesi terdaftar otomatis ke Backend `/api/session/start`.
2. **02 // FRAME SELECTION**:
   - Pilihan 4 Layout (Classic 3-Cut, 4-Cut Grid, Wide 2-Cut, Solo 1-Cut).
   - Pilihan Border (Minimal, Inverted, Dotted, Datestamp).
   - Tombol **`[ ← BACK ]`** dan **`PAY & PROCEED`**.
3. **03 // PAYMENT**:
   - QRIS settlement countdown timer.
   - Simulasi NFC Tap Card & Cash slot.
   - Tombol **`CONFIRM PAYMENT →`** (validasi via `/api/session/pay`).
4. **04 // CAPTURE (Webcam Live)**:
   - Live Webcam asli dengan fallback ke photobooth simulator animasi jika tidak ada kamera.
   - Tombol **`FLASH ON/DISABLED`**.
   - Tombol **`TAKE PHOTO`** (atau tekan **Space/Enter**): 3-2-1 countdown, audio click, screen flash.
5. **05 // DITHER & STYLE**:
   - Menampilkan foto asli hasil jepretan di preview struk 80mm.
   - 4 Filter Thermal: **Retro Dot (Bayer Dither)**, **Contrast**, **Soft Gray**, **Negative**.
   - Slider intensitas contrast density.
   - Preset caption & custom input teks bebas.
   - Tombol **`Retake Photos`** dan **`Print Receipt`** (merender canvas resolusi tinggi).
6. **06 // DISPATCH & FINISH**:
   - Animasi keluarnya kertas struk dari lubang printer dispenser.
   - Efek suara motor printer thermal.
   - Tombol **`DOWNLOAD DIGITAL STRIP (PNG)`** mengunduh struk gambar asli ke PC.
   - Tombol **`PRINT ANOTHER COPY (+1 COPY)`** dan **`DONE / HOME`**.
   - Auto-reset timer 20 detik.
