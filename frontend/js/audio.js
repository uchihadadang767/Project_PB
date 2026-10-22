/**
 * Web Audio API Synthesizer for Thermal Brutalism Photobooth Kiosk
 * Generates tactile clicks, camera shutter pulses, countdown beeps, and printer sounds.
 */

class KioskAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.playTap();
    }
    return !this.isMuted;
  }

  playTone(freq, type = 'square', duration = 0.08, gainVal = 0.15) {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Tactile Mechanical Button Tap
  playTap() {
    this.playTone(880, 'triangle', 0.04, 0.12);
  }

  // Positive Step Advance / Selection
  playSelect() {
    if (this.isMuted) return;
    this.playTone(523.25, 'sine', 0.06, 0.15); // C5
    setTimeout(() => {
      this.playTone(659.25, 'sine', 0.08, 0.15); // E5
    }, 50);
  }

  // Countdown Beep (3, 2, 1)
  playCountdown() {
    this.playTone(1046.5, 'square', 0.12, 0.2); // C6
  }

  // Final Shutter Flash / Snap Tone
  playShutter() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      // Noise buffer for mechanical camera shutter click
      const bufferSize = this.ctx.sampleRate * 0.15;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 800;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();

      // Simultaneous high-frequency snap ping
      this.playTone(1760, 'sawtooth', 0.1, 0.2);
    } catch (e) {
      this.playTone(1200, 'square', 0.15, 0.25);
    }
  }

  // Thermal Printer Paper Dispensing Sound (Simulated Stepper Motor)
  playDispenseSound(onComplete) {
    if (this.isMuted) {
      if (typeof onComplete === 'function') setTimeout(onComplete, 3200);
      return;
    }
    this.init();
    if (!this.ctx) {
      if (typeof onComplete === 'function') setTimeout(onComplete, 3200);
      return;
    }

    let steps = 0;
    const interval = setInterval(() => {
      steps++;
      // Subtle stepper tick with varying frequency
      this.playTone(200 + (steps % 3) * 60, 'sawtooth', 0.03, 0.09);
      if (steps >= 25) {
        clearInterval(interval);
        // Play guillotine paper cut & pleasant chime
        this.playPaperCut();
        if (typeof onComplete === 'function') {
          setTimeout(onComplete, 150);
        }
      }
    }, 120);
  }

  // Guillotine Auto-Cutter Mechanical Snip & Chime
  playPaperCut() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      // 1. Mechanical guillotine blade click / snap
      this.playTone(1600, 'sawtooth', 0.03, 0.22);
      setTimeout(() => {
        this.playTone(480, 'square', 0.05, 0.2);
      }, 25);

      // 2. Clear pleasant ready chime (C6 -> E6)
      setTimeout(() => {
        this.playTone(1046.5, 'sine', 0.12, 0.18);
        setTimeout(() => this.playTone(1318.51, 'sine', 0.22, 0.18), 110);
      }, 140);
    } catch (e) {
      this.playTone(880, 'sine', 0.15, 0.2);
    }
  }

  // Error or Alert Buzz
  playAlert() {
    this.playTone(220, 'sawtooth', 0.2, 0.2);
  }
}

window.kioskAudio = new KioskAudioEngine();

