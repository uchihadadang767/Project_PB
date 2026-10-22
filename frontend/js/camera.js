/**
 * Camera Controller for Thermal Photobooth Kiosk
 * Handles Live Webcam with graceful fallback simulation, countdown ring, and shutter flash.
 */

class KioskCamera {
  constructor() {
    this.stream = null;
    this.videoEl = null;
    this.simCanvasEl = null;
    this.simCtx = null;
    this.isLive = false;
    this.simAnimId = null;
    this.flashOverlayEl = null;
    this.countdownModalEl = null;
    this.countdownValEl = null;
    this.progressCircleEl = null;
    this.flashEnabled = true;
    this.isCapturing = false;
  }

  initElements() {
    this.videoEl = document.getElementById('camera-video');
    this.simCanvasEl = document.getElementById('camera-sim-canvas');
    if (this.simCanvasEl) {
      this.simCtx = this.simCanvasEl.getContext('2d');
    }
    this.flashOverlayEl = document.getElementById('camera-flash-overlay');
    this.countdownModalEl = document.getElementById('countdown-modal');
    this.countdownValEl = document.getElementById('countdown-val');
    this.progressCircleEl = document.getElementById('svg-progress-circle');
  }

  async startCamera() {
    this.initElements();
    this.stopCamera();

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 960 },
            facingMode: 'user'
          },
          audio: false
        });

        this.stream = stream;
        if (this.videoEl) {
          this.videoEl.srcObject = stream;
          this.videoEl.style.display = 'block';
          this.videoEl.classList.remove('hidden');
          if (this.simCanvasEl) {
            this.simCanvasEl.style.display = 'none';
            this.simCanvasEl.classList.add('hidden');
          }
          await this.videoEl.play();
          this.isLive = true;
          return { live: true };
        }
      }
    } catch (err) {
      console.warn('Real webcam unavailable or permission denied, using photobooth simulator:', err);
    }

    // Fallback: Start simulated dynamic video canvas
    this.isLive = false;
    if (this.videoEl) {
      this.videoEl.style.display = 'none';
      this.videoEl.classList.add('hidden');
    }
    if (this.simCanvasEl) {
      this.simCanvasEl.style.display = 'block';
      this.simCanvasEl.classList.remove('hidden');
      this.startSimulation();
    }
    return { live: false };
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    if (this.simAnimId) {
      cancelAnimationFrame(this.simAnimId);
      this.simAnimId = null;
    }
    this.isLive = false;
  }

  // Fallback simulator for kiosks without physical webcam
  startSimulation() {
    if (!this.simCanvasEl || !this.simCtx) return;
    this.simCanvasEl.width = 640;
    this.simCanvasEl.height = 480;

    let tick = 0;
    const renderSim = () => {
      tick++;
      const ctx = this.simCtx;
      const w = this.simCanvasEl.width;
      const h = this.simCanvasEl.height;

      // Dark brutalist photobooth background
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, w, h);

      // Gradient studio lighting vignette
      const grad = ctx.createRadialGradient(w / 2, h / 2 - 20, 40, w / 2, h / 2, w * 0.55);
      grad.addColorStop(0, '#555');
      grad.addColorStop(0.7, '#222');
      grad.addColorStop(1, '#111');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stylized silhouette portrait with subtle breathing animation
      const breath = Math.sin(tick * 0.05) * 4;
      
      // Head
      ctx.fillStyle = '#eee';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2 - 30 + breath, 75, 95, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sunglasses / Cool Photobooth Shades
      ctx.fillStyle = '#111';
      ctx.fillRect(w / 2 - 60, h / 2 - 50 + breath, 50, 24);
      ctx.fillRect(w / 2 + 10, h / 2 - 50 + breath, 50, 24);
      ctx.fillRect(w / 2 - 10, h / 2 - 42 + breath, 20, 8);

      // Smile
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 + 5 + breath, 30, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();

      // Shoulders / Torso
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2 + 190 + breath, 180, 110, 0, 0, Math.PI * 2);
      ctx.fill();

      // Overlay text badge
      ctx.fillStyle = '#ffb702';
      ctx.fillRect(16, 16, 210, 26);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px "Space Mono", monospace';
      ctx.fillText('SIMULATED OPTICAL FEED', 24, 34);

      // Live Timestamp
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '11px "Space Mono", monospace';
      const timeStr = new Date().toTimeString().split(' ')[0] + '.' + (tick % 100);
      ctx.fillText(`REC: ${timeStr} // 30 FPS`, 24, h - 20);

      this.simAnimId = requestAnimationFrame(renderSim);
    };

    this.simAnimId = requestAnimationFrame(renderSim);
  }

  toggleFlash() {
    this.flashEnabled = !this.flashEnabled;
    return this.flashEnabled;
  }

  triggerFlash() {
    if (!this.flashEnabled || !this.flashOverlayEl) return;
    this.flashOverlayEl.classList.add('flashing');
    setTimeout(() => {
      this.flashOverlayEl.classList.remove('flashing');
    }, 140);
  }

  // Trigger 3..2..1..Snap sequence
  captureSequence(onTick) {
    if (this.isCapturing) return Promise.reject('Already capturing');
    this.isCapturing = true;

    return new Promise((resolve) => {
      let count = 3;

      if (this.countdownModalEl) {
        this.countdownModalEl.classList.remove('hidden');
        this.countdownModalEl.classList.add('flex');
      }

      const updateUI = () => {
        if (this.countdownValEl) this.countdownValEl.textContent = count;
        if (this.progressCircleEl) {
          // Dash offsets for 3, 2, 1 (276 total)
          const offsets = { 3: '69', 2: '138', 1: '207', 0: '276' };
          this.progressCircleEl.style.strokeDashoffset = offsets[count] || '0';
        }
        if (onTick) onTick(count);
      };

      updateUI();
      if (window.kioskAudio) window.kioskAudio.playCountdown();

      const timer = setInterval(() => {
        count--;
        if (count > 0) {
          updateUI();
          if (window.kioskAudio) window.kioskAudio.playCountdown();
        } else if (count === 0) {
          updateUI();
          if (this.countdownValEl) this.countdownValEl.textContent = '★';
          this.triggerFlash();
          if (window.kioskAudio) window.kioskAudio.playShutter();

          // Snap snapshot immediately at flash peak
          const photoDataUrl = this.snapFrame();

          setTimeout(() => {
            clearInterval(timer);
            if (this.countdownModalEl) {
              this.countdownModalEl.classList.add('hidden');
              this.countdownModalEl.classList.remove('flex');
            }
            this.isCapturing = false;
            resolve(photoDataUrl);
          }, 400);
        }
      }, 1000);
    });
  }

  // Extract current frame to PNG data URL
  snapFrame() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (this.isLive && this.videoEl && this.videoEl.videoWidth) {
      canvas.width = this.videoEl.videoWidth;
      canvas.height = this.videoEl.videoHeight;
      // Mirror image horizontally for photobooth selfie feel
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoEl, 0, 0, canvas.width, canvas.height);
    } else if (this.simCanvasEl) {
      canvas.width = this.simCanvasEl.width;
      canvas.height = this.simCanvasEl.height;
      ctx.drawImage(this.simCanvasEl, 0, 0, canvas.width, canvas.height);
    } else {
      canvas.width = 640;
      canvas.height = 480;
      ctx.fillStyle = '#dadad6';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#121212';
      ctx.font = 'bold 24px "Space Mono", monospace';
      ctx.fillText('THERMAL CAPTURE', 200, 240);
    }

    return canvas.toDataURL('image/png');
  }
}

window.kioskCamera = new KioskCamera();
