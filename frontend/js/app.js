/**
 * Main Application Controller for Thermal Brutalism Photobooth Kiosk
 * Connects all screens, user flows, buttons, and API communication.
 */

// Backend API Base URL
// Local dev (port 3000) -> connects to backend (http://localhost:5000).
// Production / Vercel -> uses relative path '' so all /api/* requests route seamlessly.
const isLocalDev = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000';
const API_BASE = isLocalDev ? 'http://localhost:5000' : '';

class KioskApp {
  constructor() {
    this.state = {
      currentScreen: 'welcome',
      frame: {
        id: 'classic-3',
        title: 'CLASSIC 3-CUT STRIP',
        poses: 3,
        price: 35000,
        priceFormatted: 'Rp 35.000',
        aspect: '1:1',
        tag: '3 Photo Poses'
      },
      borderStyle: 'minimal',
      paymentMethod: 'qris',
      capturedPhotos: [],
      currentPoseIndex: 0,
      currentFilter: 'dithered',
      filterIntensity: 100,
      headline: 'COFFEE & FRIENDS',
      geoEnabled: true,
      session: {
        id: 'SESS-4082',
        txId: 'TX-4082-ALPHA',
        timestamp: new Date().toLocaleTimeString()
      },
      copiesPrinted: 1,
      finalReceiptImage: null,
      paymentSeconds: 298,
      paymentTimerId: null,
      autoResetSeconds: 20,
      autoResetTimerId: null
    };

    this.samplePhotos = [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCYj7_pqGNUPn8XRL1xG2wNc_Ukz6XJ6X-T1RQHdYAOb9g_sY4u7UNEdUz8g_HKXk2KpOebjWnFm_aP6oPJ3XwPU7nvkr_mJsRdK7iN_YeAyMD9C-htjOWVcU49SjEZBJ-eBDcBhUw81j2CNS0GzIV5vAR_WKmY9l64q0gW_TzLHXV_7hSPBfqCLNilYmnaWKBuZ5IbCL8zcQQztlah-hwSOO1FM5m0kZwKaqKoUDHSB571z9iHwq7dhA',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDWUQvSUjmA9h331bxB90g4v3inlBUShAND9j9Zy4t0daCMtxZCkXoG5FgaBmK3UL5Xlf09Bp4cXi9vzicBtDmQtlQfb02svvtdFS1MjM69vmwVTz5bbAypmJsGefvsPj6KVopVU4cJaQP08FIUmEtbgAzBYU5w4-ZWPgedWdzO1REffYfmlphcFMpvdG65u06IM3osB22knKyzQ47zASsywDyOlTMZ9tpi4qcM7tqQJuXEEbSN5PBxKg',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDHTW5BVFnZGRbbs5FrqL4kJNG498zB19WI61K-r2GuHYp6L7BBJ43XOJW6sN01OUDMfoSMS9CbUtiVemz07Vrls02ywWCMlAlvQeX0S0O017Urqw8Tfi3QXWYkQFm0iBvDemOy-pwfA96Hhg-cNB_CiydEkNi6ghigbB6TLMlePpQcgaIEkR5BweNA0lb43T3cf7GdKRWXLRozteFF5LnAgry4RXzatykSOQH_fmBdjKRaM9kGP3FSHg',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBGLPstmzxVPZYp3b4OYCMqDAg2VaFsunP4M0XH0QYXkR0zco1kE57eF5B8QGUi34pZoZQQcD14I9C_44U0m_6WOGSzQgWdU41NXgrSY6gAQD-q7vXx2-EhHtbFJTE-CK6FzGIgDA133ctdC_w0K3dCCMO0GO_J6ooLx91Nmxervs27wbxDeGPVpBS4IfIa4j5SlkWpy0QK6i54PFReolKXajJ2B1zwlnOvO78eG47rDz3ZE4wXpptqTw'
    ];
  }

  init() {
    this.startClock();
    this.bindEvents();
    this.goToScreen('welcome');
    this.fetchSystemStatus();
  }

  startClock() {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      document.querySelectorAll('.live-clock-time').forEach(el => {
        el.textContent = timeStr;
      });
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  async fetchSystemStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (res.ok) {
        const data = await res.json();
        document.querySelectorAll('.kiosk-paper-pct').forEach(el => {
          el.textContent = `${data.paperRoll}%`;
        });
        document.querySelectorAll('.kiosk-paper-bar').forEach(el => {
          el.style.width = `${data.paperRoll}%`;
        });
      }
    } catch (e) {
      console.warn('Backend status offline, running locally:', e);
    }
  }

  bindEvents() {
    // 1. Audio Mute Toggle
    const audioBtn = document.getElementById('btn-toggle-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const unmuted = window.kioskAudio.toggleMute();
        audioBtn.innerHTML = unmuted 
          ? '<span class="material-symbols-outlined text-[14px]">volume_up</span> AUDIO: ON'
          : '<span class="material-symbols-outlined text-[14px] text-outline">volume_off</span> AUDIO: MUTED';
      });
    }

    // 2. Navigation Steps in Header
    document.querySelectorAll('.header-step-nav').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-screen');
        if (target) {
          window.kioskAudio.playTap();
          this.goToScreen(target);
        }
      });
    });

    // 3. Abort / Reset Session Modal
    const abortBtn = document.getElementById('btn-abort-session');
    const modalAbort = document.getElementById('modal-abort-confirm');
    const abortCancel = document.getElementById('btn-abort-cancel');
    const abortConfirm = document.getElementById('btn-abort-confirm');

    if (abortBtn && modalAbort) {
      abortBtn.addEventListener('click', () => {
        window.kioskAudio.playAlert();
        modalAbort.classList.remove('hidden');
        modalAbort.classList.add('flex');
      });
    }

    if (abortCancel && modalAbort) {
      abortCancel.addEventListener('click', () => {
        window.kioskAudio.playTap();
        modalAbort.classList.add('hidden');
        modalAbort.classList.remove('flex');
      });
    }

    if (abortConfirm && modalAbort) {
      abortConfirm.addEventListener('click', () => {
        window.kioskAudio.playTap();
        modalAbort.classList.add('hidden');
        modalAbort.classList.remove('flex');
        this.resetSession();
      });
    }

    // 4. Screen 1: Welcome / Idle
    const startBtn = document.getElementById('btn-start-session');
    const welcomeSurface = document.getElementById('kiosk-welcome-surface');

    const triggerStart = async () => {
      window.kioskAudio.playSelect();
      // Visual tap flash
      const flash = document.createElement('div');
      flash.className = 'fixed inset-0 bg-secondary-container opacity-50 z-50 pointer-events-none transition-opacity duration-300';
      document.body.appendChild(flash);
      setTimeout(() => {
        flash.classList.add('opacity-0');
        setTimeout(() => flash.remove(), 300);
      }, 100);

      try {
        const res = await fetch(`${API_BASE}/api/session/start`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          this.state.session.id = data.sessionId;
          this.state.session.txId = data.txId;
        }
      } catch (err) {
        this.state.session.id = 'SESS-' + Math.floor(1000 + Math.random() * 9000);
        this.state.session.txId = 'TX-' + Math.floor(1000 + Math.random() * 9000) + '-ALPHA';
      }

      this.updateSessionDetails();
      this.goToScreen('frame');
    };

    if (startBtn) startBtn.addEventListener('click', triggerStart);
    if (welcomeSurface) {
      welcomeSurface.addEventListener('click', (e) => {
        if (!e.target.closest('#btn-start-session')) {
          triggerStart();
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (this.state.currentScreen === 'welcome') {
        if (e.key === ' ' || e.key === 'Enter') {
          triggerStart();
        }
      } else if (this.state.currentScreen === 'camera') {
        if (e.key === ' ' || e.key === 'Enter') {
          const shutterBtn = document.getElementById('btn-shutter');
          if (shutterBtn && !window.kioskCamera.isCapturing) {
            shutterBtn.click();
          }
        } else if (e.key === 'm' || e.key === 'M') {
          const mirrorBtn = document.getElementById('btn-mirror');
          if (mirrorBtn) {
            mirrorBtn.click();
          }
        }
      }
    });

    // 5. Screen 2: Frame Selection
    const frameCards = document.querySelectorAll('.frame-card');
    frameCards.forEach(card => {
      card.addEventListener('click', () => {
        window.kioskAudio.playTap();
        frameCards.forEach(c => {
          c.classList.remove('ring-2', 'ring-primary', 'bg-surface-container');
          const ind = c.querySelector('.active-indicator');
          if (ind) {
            ind.textContent = '[ ]';
            ind.classList.remove('text-primary');
            ind.classList.add('text-on-surface-variant');
          }
        });

        card.classList.add('ring-2', 'ring-primary', 'bg-surface-container');
        const ind = card.querySelector('.active-indicator');
        if (ind) {
          ind.textContent = '[●]';
          ind.classList.add('text-primary');
          ind.classList.remove('text-on-surface-variant');
        }

        const id = card.getAttribute('data-frame-id');
        const title = card.getAttribute('data-frame-title');
        const poses = parseInt(card.getAttribute('data-poses'), 10) || 3;
        const price = parseInt(card.getAttribute('data-raw-price'), 10) || 35000;
        const priceFormatted = card.getAttribute('data-price') || 'Rp 35.000';

        this.state.frame = { id, title, poses, price, priceFormatted };
        this.updateFrameSummary();
      });
    });

    // Border Style Chips
    const borderChips = document.querySelectorAll('.border-style-chip');
    borderChips.forEach(chip => {
      chip.addEventListener('click', () => {
        window.kioskAudio.playTap();
        borderChips.forEach(c => {
          c.classList.remove('bg-primary', 'text-on-primary');
          c.classList.add('bg-surface-container-low', 'text-on-surface');
          const icon = c.querySelector('span');
          if (icon) icon.textContent = '[ ]';
        });

        chip.classList.remove('bg-surface-container-low', 'text-on-surface');
        chip.classList.add('bg-primary', 'text-on-primary');
        const activeIcon = chip.querySelector('span');
        if (activeIcon) activeIcon.textContent = '[●]';

        this.state.borderStyle = chip.getAttribute('data-border-id');
      });
    });

    // Frame Screen Buttons
    const frameBackBtn = document.getElementById('btn-frame-back');
    if (frameBackBtn) {
      frameBackBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        this.goToScreen('welcome');
      });
    }

    const frameProceedBtn = document.getElementById('btn-proceed-pay');
    if (frameProceedBtn) {
      frameProceedBtn.addEventListener('click', () => {
        window.kioskAudio.playSelect();
        this.goToScreen('payment');
      });
    }

    // 6. Screen 3: Payment
    const payBackBtn = document.getElementById('btn-payment-back');
    if (payBackBtn) {
      payBackBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        this.goToScreen('frame');
      });
    }

    const nfcBtn = document.getElementById('btn-pay-nfc');
    if (nfcBtn) {
      nfcBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        nfcBtn.classList.add('bg-secondary-container');
        setTimeout(() => nfcBtn.classList.remove('bg-secondary-container'), 300);
        this.triggerPaymentConfirm('NFC / TAP');
      });
    }

    const cashBtn = document.getElementById('btn-pay-cash');
    if (cashBtn) {
      cashBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        cashBtn.classList.add('bg-secondary-container');
        setTimeout(() => cashBtn.classList.remove('bg-secondary-container'), 300);
        this.triggerPaymentConfirm('CASH / BILL');
      });
    }

    const payConfirmBtn = document.getElementById('pay-confirm-btn');
    if (payConfirmBtn) {
      payConfirmBtn.addEventListener('click', () => {
        this.triggerPaymentConfirm('QRIS');
      });
    }

    // 7. Screen 4: Live Camera Capture
    const flashBtn = document.getElementById('btn-flash');
    if (flashBtn) {
      flashBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        const active = window.kioskCamera.toggleFlash();
        const icon = document.getElementById('flash-icon');
        const stateText = document.getElementById('flash-state');
        if (active) {
          icon.textContent = 'flash_on';
          icon.className = 'material-symbols-outlined text-[20px] text-secondary-container';
          stateText.textContent = 'FLASH ON';
        } else {
          icon.textContent = 'flash_off';
          icon.className = 'material-symbols-outlined text-[20px] text-outline';
          stateText.textContent = 'FLASH DISABLED';
        }
      });
    }

    const mirrorBtn = document.getElementById('btn-mirror');
    if (mirrorBtn) {
      mirrorBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        window.kioskCamera.toggleFlip();
      });
    }

    const shutterBtn = document.getElementById('btn-shutter');
    if (shutterBtn) {
      shutterBtn.addEventListener('click', async () => {
        if (window.kioskCamera.isCapturing) return;

        try {
          shutterBtn.disabled = true;
          const photoDataUrl = await window.kioskCamera.captureSequence((tick) => {
            const cue = document.getElementById('camera-pose-cue');
            if (cue) {
              const cues = ['HOLD STILL!', 'SMILE BIG!', '3... 2... 1...'];
              cue.textContent = cues[3 - tick] || 'POSE!';
            }
          });

          this.state.capturedPhotos.push(photoDataUrl);
          this.state.currentPoseIndex++;

          // Update pose progress telemetry
          this.updateCameraPoseUI();

          // Check if all poses for the selected frame are completed
          if (this.state.currentPoseIndex >= this.state.frame.poses) {
            const banner = document.getElementById('camera-status-banner');
            if (banner) banner.textContent = 'ALL POSES COMPLETE! PROCESSING DOCKET...';

            setTimeout(() => {
              window.kioskCamera.stopCamera();
              this.goToScreen('customize');
            }, 1200);
          } else {
            shutterBtn.disabled = false;
          }
        } catch (err) {
          console.error('Shutter error:', err);
          shutterBtn.disabled = false;
        }
      });
    }

    // 8. Screen 5: Customize Filter Receipt
    const filterCards = document.querySelectorAll('.filter-card');
    filterCards.forEach(card => {
      card.addEventListener('click', () => {
        window.kioskAudio.playTap();
        filterCards.forEach(c => {
          c.classList.remove('ring-4', 'ring-secondary-container', 'active');
          const badge = c.querySelector('.active-badge');
          if (badge) badge.classList.add('hidden');
        });

        card.classList.add('ring-4', 'ring-secondary-container', 'active');
        const badge = card.querySelector('.active-badge');
        if (badge) badge.classList.remove('hidden');

        const filter = card.getAttribute('data-filter');
        this.state.currentFilter = filter;
        this.applyReceiptFilter();
      });
    });

    // Preset Headline Chips
    const headlineChips = document.querySelectorAll('.headline-chip');
    headlineChips.forEach(chip => {
      chip.addEventListener('click', () => {
        window.kioskAudio.playTap();
        const text = chip.getAttribute('data-headline');
        this.setReceiptHeadline(text, chip);
      });
    });

    // Custom Headline Input
    const headlineInput = document.getElementById('custom-headline-input');
    if (headlineInput) {
      headlineInput.addEventListener('input', (e) => {
        this.setReceiptHeadline(e.target.value, null);
      });
    }

    const clearHeadlineBtn = document.getElementById('btn-clear-headline');
    if (clearHeadlineBtn) {
      clearHeadlineBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        if (headlineInput) headlineInput.value = '';
        this.setReceiptHeadline('UNTITLED', null);
      });
    }

    // Intensity Slider
    const slider = document.getElementById('intensity-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.state.filterIntensity = parseInt(e.target.value, 10) || 100;
        const valLabel = document.getElementById('slider-val-label');
        if (valLabel) valLabel.textContent = `${this.state.filterIntensity}%`;
        this.applyReceiptFilter();
      });
    }

    // Geo Stamp Toggle
    const geoBtn = document.getElementById('geo-toggle-btn');
    if (geoBtn) {
      geoBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        this.state.geoEnabled = !this.state.geoEnabled;
        const timestampEl = document.getElementById('receipt-timestamp-display');
        if (this.state.geoEnabled) {
          geoBtn.textContent = 'ENABLED';
          geoBtn.className = 'h-10 px-space-md bg-primary text-on-primary font-code-terminal text-label-md rounded font-bold shadow-sm transition-all';
          if (timestampEl) timestampEl.textContent = 'OCT 24, 2024 • 12:42:19 PM • JAKARTA, ID';
        } else {
          geoBtn.textContent = 'HIDDEN';
          geoBtn.className = 'h-10 px-space-md bg-surface-container-high text-on-surface-variant font-code-terminal text-label-md rounded font-bold shadow-sm transition-all';
          if (timestampEl) timestampEl.textContent = 'OCT 24, 2024 • 12:42:19 PM';
        }
      });
    }

    // Retake Confirmation
    const retakeBtn = document.getElementById('btn-retake');
    if (retakeBtn) {
      retakeBtn.addEventListener('click', () => {
        window.kioskAudio.playAlert();
        const ok = confirm('RETAKE CONFIRMATION:\n\nPurge all captured poses and return to camera viewfinder?');
        if (ok) {
          this.state.capturedPhotos = [];
          this.state.currentPoseIndex = 0;
          this.goToScreen('camera');
        }
      });
    }

    // Proceed to Print
    const proceedPrintBtn = document.getElementById('btn-proceed-print');
    if (proceedPrintBtn) {
      proceedPrintBtn.addEventListener('click', async () => {
        window.kioskAudio.playSelect();
        proceedPrintBtn.disabled = true;
        proceedPrintBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[24px]">progress_activity</span> RENDERING RECEIPT...';

        await this.generateCompositeReceipt();
        this.goToScreen('finish');
        proceedPrintBtn.disabled = false;
        proceedPrintBtn.innerHTML = '<span>Print Receipt</span><span class="material-symbols-outlined text-[32px]">print</span>';
      });
    }

    // 9. Screen 6: Dispatch / Finish
    const reprintBtn = document.getElementById('btn-reprint');
    if (reprintBtn) {
      reprintBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        window.kioskAudio.playDispenseSound();
        this.state.copiesPrinted++;
        const copiesEl = document.getElementById('copies-printed-counter');
        if (copiesEl) copiesEl.textContent = `COPIES PRINTED: ${this.state.copiesPrinted} OF 4`;
        reprintBtn.innerHTML = '<span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-secondary-container animate-ping"></span> DISPENSING COPY...</span><span class="font-code-terminal text-label-md bg-secondary-container text-on-secondary-container px-2 py-1 font-bold">+1 COPY</span>';
        setTimeout(() => {
          reprintBtn.innerHTML = '<span class="flex items-center gap-space-sm"><span class="material-symbols-outlined text-secondary-container">print</span> PRINT ANOTHER COPY</span><span class="font-code-terminal text-label-md bg-secondary-container text-on-secondary-container px-space-sm py-1 font-bold">+1 COPY</span>';
        }, 3000);
        this.resetAutoResetTimer();
      });
    }

    const downloadBtn = document.getElementById('btn-download-receipt');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        this.downloadDigitalStrip();
      });
    }

    const finishBtn = document.getElementById('btn-finish');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        window.kioskAudio.playTap();
        finishBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">refresh</span> CLEARING HARDWARE SESSION...';
        setTimeout(() => {
          this.resetSession();
        }, 500);
      });
    }

    // Tap anywhere to extend auto reset
    window.addEventListener('click', (e) => {
      if (this.state.currentScreen === 'finish') {
        this.resetAutoResetTimer();
      }
    });
  }

  goToScreen(screenId) {
    this.state.currentScreen = screenId;

    // Toggle screen visibility
    document.querySelectorAll('.kiosk-screen').forEach(scr => {
      scr.classList.remove('active');
    });

    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }

    // Update Header Navigation Active State
    const screenIndexMap = {
      welcome: 1,
      frame: 2,
      payment: 3,
      camera: 4,
      customize: 5,
      finish: 6
    };

    const currentIdx = screenIndexMap[screenId] || 1;

    document.querySelectorAll('.header-step-nav').forEach(link => {
      const stepIdx = parseInt(link.getAttribute('data-step-idx'), 10);
      link.classList.remove('bg-primary', 'text-on-primary', 'font-bold', 'border-2', 'border-primary', 'shadow-[2px_2px_0_0_#1c1b1b]');
      link.classList.add('text-on-surface-variant', 'border-transparent');

      if (stepIdx === currentIdx) {
        link.classList.add('bg-primary', 'text-on-primary', 'font-bold', 'border-2', 'border-primary', 'shadow-[2px_2px_0_0_#1c1b1b]');
        link.classList.remove('text-on-surface-variant', 'border-transparent');
      }
    });

    // Handle screen-specific init
    if (screenId === 'camera') {
      this.state.capturedPhotos = [];
      this.state.currentPoseIndex = 0;
      this.updateCameraPoseUI();
      window.kioskCamera.startCamera();
    } else {
      window.kioskCamera.stopCamera();
    }

    if (screenId === 'payment') {
      this.startPaymentCountdown();
      this.updatePaymentSummary();
    } else {
      this.stopPaymentCountdown();
    }

    if (screenId === 'customize') {
      this.renderCustomizePreview();
    }

    if (screenId === 'finish') {
      this.startFinishSequence();
    } else {
      this.stopAutoResetTimer();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateSessionDetails() {
    document.querySelectorAll('.session-id-display').forEach(el => {
      el.textContent = this.state.session.id;
    });
    document.querySelectorAll('.tx-id-display').forEach(el => {
      el.textContent = this.state.session.txId;
    });
  }

  updateFrameSummary() {
    const { title, poses, priceFormatted } = this.state.frame;
    const summaryLayout = document.getElementById('summary-layout-name');
    const summaryPoses = document.getElementById('summary-poses');
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryTotal = document.getElementById('summary-total-price');
    const ctaBadge = document.getElementById('cta-price-badge');

    if (summaryLayout) summaryLayout.textContent = title;
    if (summaryPoses) summaryPoses.textContent = `${poses} PHOTO POSES`;
    if (summarySubtotal) summarySubtotal.textContent = priceFormatted;
    if (summaryTotal) summaryTotal.textContent = priceFormatted;
    if (ctaBadge) ctaBadge.textContent = `${priceFormatted} →`;
  }

  updatePaymentSummary() {
    const { priceFormatted, poses, title } = this.state.frame;
    const totalDueEl = document.getElementById('payment-total-due');
    const ticketSummaryEl = document.getElementById('payment-ticket-summary');
    const ticketPosesEl = document.getElementById('payment-ticket-poses');

    if (totalDueEl) totalDueEl.textContent = priceFormatted;
    if (ticketSummaryEl) ticketSummaryEl.textContent = `${poses}x HIGH-RES THERMAL SNAPS + 1x STRIP PRINT`;
    if (ticketPosesEl) ticketPosesEl.textContent = `01. ${poses}x POSE CAPTURES (${title})`;
  }

  startPaymentCountdown() {
    this.stopPaymentCountdown();
    this.state.paymentSeconds = 298; // 04:58
    const timerEl = document.getElementById('payment-countdown-timer');

    this.state.paymentTimerId = setInterval(() => {
      if (this.state.paymentSeconds > 0) {
        this.state.paymentSeconds--;
        const mins = String(Math.floor(this.state.paymentSeconds / 60)).padStart(2, '0');
        const secs = String(this.state.paymentSeconds % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `EXPIRES IN ${mins}:${secs}`;
      } else {
        if (timerEl) timerEl.textContent = 'EXPIRED - REFRESHING';
        this.stopPaymentCountdown();
      }
    }, 1000);
  }

  stopPaymentCountdown() {
    if (this.state.paymentTimerId) {
      clearInterval(this.state.paymentTimerId);
      this.state.paymentTimerId = null;
    }
  }

  triggerPaymentConfirm(method = 'QRIS') {
    window.kioskAudio.playSelect();
    const confirmBtn = document.getElementById('pay-confirm-btn');
    if (confirmBtn) {
      confirmBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[24px]">progress_activity</span> AUTHORIZING TICKET...';
      confirmBtn.classList.remove('bg-primary');
      confirmBtn.classList.add('bg-secondary-container', 'text-on-secondary-container');
    }

    fetch(`${API_BASE}/api/session/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.state.session.id,
        method: method,
        amount: this.state.frame.priceFormatted
      })
    }).catch(() => {});

    setTimeout(() => {
      if (confirmBtn) {
        confirmBtn.innerHTML = '<span class="material-symbols-outlined text-[24px]">check_circle</span> PAID! OPENING BOOTH SHUTTER...';
      }
      setTimeout(() => {
        this.goToScreen('camera');
      }, 800);
    }, 1000);
  }

  updateCameraPoseUI() {
    const current = Math.min(this.state.currentPoseIndex + 1, this.state.frame.poses);
    const total = this.state.frame.poses;

    const shotText = document.getElementById('camera-shot-indicator');
    if (shotText) shotText.textContent = `SHOT ${current} OF ${total}`;

    const bottomIndicator = document.getElementById('camera-bottom-shot');
    if (bottomIndicator) bottomIndicator.textContent = `PHOTO ${current} OF ${total}`;

    // Update progress dots
    const dotsContainer = document.getElementById('camera-dots-container');
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('span');
        dot.className = i < current 
          ? 'w-2.5 h-2.5 rounded-full bg-primary inline-block'
          : 'w-2.5 h-2.5 rounded-full bg-outline-variant inline-block';
        dotsContainer.appendChild(dot);
      }
    }

    const cue = document.getElementById('camera-pose-cue');
    if (cue) {
      const cues = [
        'GET READY TO POSE',
        'SHOW YOUR BEST SMILE',
        'SILLY OR COOL FACE!',
        'VICTORY PEACE SIGN!'
      ];
      cue.textContent = cues[(current - 1) % cues.length];
    }
  }

  // Customize Filter & Headline
  setReceiptHeadline(text, btnElement) {
    const cleanText = text.trim() === '' ? 'UNTITLED' : text.toUpperCase();
    this.state.headline = cleanText;

    const displayEl = document.getElementById('receipt-headline-display');
    if (displayEl) displayEl.textContent = cleanText;

    const inputEl = document.getElementById('custom-headline-input');
    if (inputEl && inputEl.value !== text) inputEl.value = text;

    const chips = document.querySelectorAll('.headline-chip');
    chips.forEach(c => {
      c.classList.remove('bg-primary', 'text-on-primary', 'active');
      c.classList.add('bg-surface-container', 'text-on-surface');
      const dot = c.querySelector('span');
      if (dot) dot.remove();
    });

    if (btnElement) {
      btnElement.classList.remove('bg-surface-container', 'text-on-surface');
      btnElement.classList.add('bg-primary', 'text-on-primary', 'active');
      const dot = document.createElement('span');
      dot.className = 'text-secondary-container';
      dot.textContent = '● ';
      btnElement.prepend(dot);
    }
  }

  renderCustomizePreview() {
    const container = document.getElementById('photo-stack-container');
    if (!container) return;

    container.innerHTML = '';
    const photos = this.state.capturedPhotos.length > 0 ? this.state.capturedPhotos : this.samplePhotos.slice(0, this.state.frame.poses);

    photos.forEach((src, idx) => {
      const card = document.createElement('div');
      card.className = 'relative bg-surface-container-low p-1.5 rounded shadow-sm border border-primary/20';

      const aspectClass = this.state.frame.aspect === '16:9' ? 'aspect-video' : 'aspect-square';

      card.innerHTML = `
        <div class="relative ${aspectClass} w-full overflow-hidden bg-surface-container-highest">
          <img src="${src}" alt="Thermal Frame #${idx + 1}" class="photo-preview-img w-full h-full object-cover transition-all duration-300">
          <div class="absolute bottom-1 right-1 bg-primary text-on-primary font-code-terminal text-label-sm px-1.5 py-0.5 font-bold">
            #0${idx + 1}
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    this.applyReceiptFilter();
  }

  applyReceiptFilter() {
    const filter = this.state.currentFilter;
    const intensity = this.state.filterIntensity;
    const lineLabel = {
      dithered: 'BAYER DITHER-8',
      halftone: 'BOLD CONTRAST',
      grayscale: 'SMOOTH GRAY',
      inverted: 'INVERTED NEGATIVE'
    }[filter] || 'BAYER DITHER-8';

    const filterLine = document.getElementById('receipt-filter-line');
    if (filterLine) filterLine.textContent = `FILTER: ${lineLabel}`;

    const imgs = document.querySelectorAll('.photo-preview-img');
    const factor = (intensity / 100);

    imgs.forEach(img => {
      if (filter === 'dithered') {
        img.style.filter = `grayscale(1) contrast(${1.8 * factor})`;
      } else if (filter === 'halftone') {
        img.style.filter = `grayscale(1) contrast(${2.8 * factor}) brightness(0.9)`;
      } else if (filter === 'grayscale') {
        img.style.filter = `grayscale(1) contrast(${1.2 * factor})`;
      } else if (filter === 'inverted') {
        img.style.filter = `invert(1) grayscale(1) contrast(${1.6 * factor})`;
      }
    });
  }

  // Composite HTML Canvas Receipt Generation
  async generateCompositeReceipt() {
    const canvas = document.createElement('canvas');
    const width = 480;
    const photos = this.state.capturedPhotos.length > 0 ? this.state.capturedPhotos : this.samplePhotos.slice(0, this.state.frame.poses);

    // Calculate height dynamically
    const photoHeight = 360;
    const headerHeight = 220;
    const footerHeight = 280;
    const totalHeight = headerHeight + (photos.length * (photoHeight + 20)) + footerHeight;

    canvas.width = width;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    // 1. Off-white thermal paper canvas
    ctx.fillStyle = '#faf9f5';
    ctx.fillRect(0, 0, width, totalHeight);

    // 2. Header
    ctx.fillStyle = '#121212';
    ctx.textAlign = 'center';

    ctx.font = 'bold 20px "Space Grotesk", sans-serif';
    ctx.fillText('*** THERMAL BOOTH CORP. ***', width / 2, 45);

    ctx.font = '13px "Space Mono", monospace';
    ctx.fillText(`ORDER #${this.state.session.id} • KIOSK #04`, width / 2, 70);

    if (this.state.geoEnabled) {
      ctx.fillText(new Date().toLocaleDateString() + ' // ' + new Date().toLocaleTimeString() + ' // JAKARTA, ID', width / 2, 92);
    } else {
      ctx.fillText(new Date().toLocaleDateString() + ' // ' + new Date().toLocaleTimeString(), width / 2, 92);
    }

    // Divider
    ctx.font = '12px "Space Mono", monospace';
    ctx.fillText('========================================', width / 2, 115);

    // Headline
    ctx.font = 'bold 26px "Space Grotesk", sans-serif';
    ctx.fillText(this.state.headline, width / 2, 150);

    ctx.font = '12px "Space Mono", monospace';
    ctx.fillText('----------------------------------------', width / 2, 175);

    // 3. Render Captured Photos
    let currentY = 195;
    for (let i = 0; i < photos.length; i++) {
      const img = new Image();
      if (!photos[i].startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = photos[i];
      });

      // Photo frame background
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 3;
      const margin = 30;
      const imgW = width - (margin * 2);
      const imgH = photoHeight;

      ctx.strokeRect(margin, currentY, imgW, imgH);
      ctx.drawImage(img, margin + 4, currentY + 4, imgW - 8, imgH - 8);

      // Frame Index Tag
      ctx.fillStyle = '#121212';
      ctx.fillRect(width - margin - 40, currentY + imgH - 24, 36, 20);
      ctx.fillStyle = '#faf9f5';
      ctx.font = 'bold 11px "Space Mono", monospace';
      ctx.fillText(`#0${i + 1}`, width - margin - 22, currentY + imgH - 10);

      currentY += imgH + 20;
    }

    // 4. Line items
    ctx.fillStyle = '#121212';
    ctx.font = '12px "Space Mono", monospace';
    ctx.fillText('========================================', width / 2, currentY + 20);

    ctx.textAlign = 'left';
    ctx.fillText(`${photos.length}X EXPOSURE CAPTURE ........ INCL.`, 30, currentY + 45);
    ctx.fillText(`1X 80MM DIRECT ROLL DISPENSE .. INCL.`, 30, currentY + 68);
    ctx.fillText(`FILTER: ${this.state.currentFilter.toUpperCase()} ......... INCL.`, 30, currentY + 91);

    ctx.textAlign = 'center';
    ctx.fillText('========================================', width / 2, currentY + 115);

    ctx.font = 'bold 22px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL:', 30, currentY + 145);
    ctx.textAlign = 'right';
    ctx.fillText(this.state.frame.priceFormatted, width - 30, currentY + 145);

    // Simulated Barcode
    ctx.textAlign = 'center';
    const barcodeY = currentY + 165;
    for (let bx = 40; bx < width - 40; bx += 6) {
      const bw = (bx % 12 === 0) ? 3 : (bx % 8 === 0 ? 1 : 2);
      ctx.fillStyle = '#121212';
      ctx.fillRect(bx, barcodeY, bw, 32);
    }

    ctx.font = '11px "Space Mono", monospace';
    ctx.fillText(`* T B - ${this.state.session.id} - 2 0 2 5 *`, width / 2, barcodeY + 48);
    ctx.fillText('THANK YOU FOR PRINTING WITH US', width / 2, barcodeY + 68);

    // Apply Bayer Dithering directly to whole composite canvas
    window.ThermalDither.applyFilter(ctx, width, totalHeight, this.state.currentFilter, this.state.filterIntensity);

    const dataUrl = canvas.toDataURL('image/png');
    this.state.finalReceiptImage = dataUrl;

    // Send to backend API
    fetch(`${API_BASE}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.state.session.id,
        stripImageBase64: dataUrl,
        metadata: {
          frame: this.state.frame,
          filter: this.state.currentFilter,
          headline: this.state.headline
        }
      })
    }).catch(e => console.warn('Backend print record skipped:', e));

    return dataUrl;
  }

  startFinishSequence() {
    window.kioskAudio.playDispenseSound();

    const dispenserReceipt = document.getElementById('finish-dispensed-receipt');
    if (dispenserReceipt && this.state.finalReceiptImage) {
      dispenserReceipt.src = this.state.finalReceiptImage;
      dispenserReceipt.classList.remove('dispensing-animation');
      void dispenserReceipt.offsetWidth; // Trigger reflow
      dispenserReceipt.classList.add('dispensing-animation');
    }

    // Print progress meter
    const printMeter = document.getElementById('print-progress-meter');
    let pct = 0;
    const progressInterval = setInterval(() => {
      pct += 10;
      if (pct <= 100) {
        if (printMeter) printMeter.textContent = `PRINTING: ${pct}% COMPLETE`;
      } else {
        clearInterval(progressInterval);
        if (printMeter) printMeter.textContent = 'PRINTING: 100% DISPENSED [COLLECT BELOW]';
      }
    }, 300);

    this.resetAutoResetTimer();
  }

  resetAutoResetTimer() {
    this.stopAutoResetTimer();
    this.state.autoResetSeconds = 20;

    const countEl = document.getElementById('finish-countdown-val');
    const barEl = document.getElementById('finish-reset-bar');

    if (countEl) countEl.textContent = this.state.autoResetSeconds;
    if (barEl) barEl.style.width = '100%';

    this.state.autoResetTimerId = setInterval(() => {
      if (this.state.autoResetSeconds > 0) {
        this.state.autoResetSeconds--;
        if (countEl) countEl.textContent = this.state.autoResetSeconds;
        if (barEl) {
          const pct = Math.max(0, (this.state.autoResetSeconds / 20) * 100);
          barEl.style.width = `${pct}%`;
        }
      } else {
        this.stopAutoResetTimer();
        this.resetSession();
      }
    }, 1000);
  }

  stopAutoResetTimer() {
    if (this.state.autoResetTimerId) {
      clearInterval(this.state.autoResetTimerId);
      this.state.autoResetTimerId = null;
    }
  }

  downloadDigitalStrip() {
    if (!this.state.finalReceiptImage) return;
    const link = document.createElement('a');
    link.download = `thermal-receipt-${this.state.session.id}.png`;
    link.href = this.state.finalReceiptImage;
    link.click();
  }

  resetSession() {
    this.stopAutoResetTimer();
    this.stopPaymentCountdown();
    window.kioskCamera.stopCamera();

    this.state.capturedPhotos = [];
    this.state.currentPoseIndex = 0;
    this.state.finalReceiptImage = null;
    this.state.copiesPrinted = 1;
    this.state.headline = 'COFFEE & FRIENDS';
    this.goToScreen('welcome');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.kioskApp = new KioskApp();
  window.kioskApp.init();
});
