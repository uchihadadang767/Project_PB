/**
 * Admin & Operator Terminal Controller
 * Manages Orders ACC, QR Payment, Frame Geometry, Photo Styles, and Archives
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : '';

class AdminApp {
  constructor() {
    this.currentTab = 'tab-orders';
    this.orders = [];
    this.frames = [];
    this.styles = [];
    this.photos = [];
    this.settings = {};
    this.activeFilter = 'ALL';
    this.soundEnabled = true;
    this.lastPendingCount = 0;
    this.pollInterval = null;
  }

  async init() {
    this.initClock();
    this.initTabs();
    this.initSoundToggle();
    this.initQrSection();
    this.initFramesSection();
    this.initStylesSection();
    this.initPhotosSection();

    // Initial data load
    await this.fetchConfig();
    await this.fetchOrders();
    await this.fetchPhotos();

    // Start polling orders every 3 seconds
    this.pollInterval = setInterval(() => {
      this.fetchOrders(true);
    }, 3000);
  }

  showToast(message, isError = false) {
    const toast = document.getElementById('admin-toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    if (isError) {
      toast.classList.remove('bg-primary', 'text-on-primary');
      toast.classList.add('bg-error', 'text-on-error');
      if (toastIcon) toastIcon.textContent = 'error';
    } else {
      toast.classList.remove('bg-error', 'text-on-error');
      toast.classList.add('bg-primary', 'text-on-primary');
      if (toastIcon) toastIcon.textContent = 'check_circle';
    }

    toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    }, 2800);
  }

  initClock() {
    const clock = document.getElementById('admin-clock');
    if (clock) {
      setInterval(() => {
        clock.textContent = new Date().toLocaleTimeString('id-ID');
      }, 1000);
    }
  }

  initTabs() {
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.admin-tab-btn').forEach(b => {
      if (b.getAttribute('data-tab') === tabId) {
        b.classList.add('active', 'border-primary', 'bg-primary', 'text-on-primary');
        b.classList.remove('border-transparent', 'text-on-surface');
      } else {
        b.classList.remove('active', 'border-primary', 'bg-primary', 'text-on-primary');
        b.classList.add('border-transparent', 'text-on-surface');
      }
    });

    document.querySelectorAll('.admin-tab-content').forEach(content => {
      if (content.id === tabId) {
        content.classList.remove('hidden');
        content.classList.add('block');
      } else {
        content.classList.add('hidden');
        content.classList.remove('block');
      }
    });

    if (tabId === 'tab-photos') {
      this.fetchPhotos();
    }
  }

  initSoundToggle() {
    const soundBtn = document.getElementById('btn-sound-toggle');
    const soundIcon = document.getElementById('sound-icon');
    const soundText = document.getElementById('sound-text');

    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        if (this.soundEnabled) {
          if (soundIcon) soundIcon.textContent = 'volume_up';
          if (soundText) soundText.textContent = 'CHIME ON';
          if (window.kioskAudio) window.kioskAudio.playTap();
        } else {
          if (soundIcon) soundIcon.textContent = 'volume_off';
          if (soundText) soundText.textContent = 'MUTED';
        }
      });
    }
  }

  // --- API DATA FETCHING ---

  async fetchConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/config`);
      const data = await res.json();
      this.settings = data.settings || {};
      this.frames = data.frames || [];
      this.styles = data.styles || [];

      this.renderQrSettings();
      this.renderFrames();
      this.renderStyles();
    } catch (err) {
      console.warn('Config fetch error:', err);
    }
  }

  async fetchOrders(isBackground = false) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders`);
      const orders = await res.json();
      this.orders = Array.isArray(orders) ? orders : [];

      const pendingOrders = this.orders.filter(o => o.status === 'PENDING');
      const pendingCount = pendingOrders.length;

      // Play alert chime if a new pending order just arrived
      if (isBackground && pendingCount > this.lastPendingCount && this.soundEnabled && window.kioskAudio) {
        window.kioskAudio.playChime();
        this.showToast(`NEW ORDER AWAITING ACC! (${pendingOrders[0].sessionId})`);
      }
      this.lastPendingCount = pendingCount;

      this.renderOrdersMetrics();
      this.renderOrdersTable();
    } catch (err) {
      if (!isBackground) console.warn('Orders fetch error:', err);
    }
  }

  renderOrdersMetrics() {
    const pendingOrders = this.orders.filter(o => o.status === 'PENDING');
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = this.orders.filter(o => o.createdAt && o.createdAt.startsWith(today));
    const todayRevenue = todayOrders
      .filter(o => o.status === 'APPROVED' || o.status === 'COMPLETED')
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    const pendingEl = document.getElementById('stat-pending-count');
    const revEl = document.getElementById('stat-today-revenue');
    const sessEl = document.getElementById('stat-today-sessions');
    const modeEl = document.getElementById('stat-payment-mode');
    const badgePending = document.getElementById('badge-pending-orders');

    if (pendingEl) pendingEl.textContent = pendingOrders.length;
    if (revEl) revEl.textContent = 'Rp ' + todayRevenue.toLocaleString('id-ID');
    if (sessEl) sessEl.textContent = todayOrders.length;
    if (modeEl) {
      modeEl.textContent = this.settings.paymentMode === 'auto_instant' ? 'AUTO-APPROVE (DEMO)' : 'MANUAL OPERATOR ACC';
    }

    if (badgePending) {
      if (pendingOrders.length > 0) {
        badgePending.textContent = pendingOrders.length;
        badgePending.classList.remove('hidden');
      } else {
        badgePending.classList.add('hidden');
      }
    }
  }

  renderOrdersTable() {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    let filtered = this.orders;
    if (this.activeFilter !== 'ALL') {
      filtered = this.orders.filter(o => o.status === this.activeFilter);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-on-surface-variant font-code-terminal">
            No orders found matching filter: <strong>${this.activeFilter}</strong>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(order => {
      const isPending = order.status === 'PENDING';
      const isApproved = order.status === 'APPROVED';
      const isCompleted = order.status === 'COMPLETED';

      let statusBadge = '';
      if (isPending) {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-error text-on-error font-bold text-xs uppercase animate-pulse border border-primary">● WAITING ACC</span>`;
      } else if (isApproved) {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary-container text-on-secondary-container font-bold text-xs uppercase border border-primary">✓ APPROVED</span>`;
      } else if (isCompleted) {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container-high text-primary font-bold text-xs uppercase border border-primary">PRINTED</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container text-outline font-bold text-xs uppercase border border-primary">${order.status || 'UNKNOWN'}</span>`;
      }

      const orderTime = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('id-ID') : '--:--';

      return `
        <tr class="hover:bg-surface-container-low transition-colors ${isPending ? 'bg-error/5' : ''}">
          <td class="p-3 font-bold text-primary">${order.txId || order.id}</td>
          <td class="p-3 font-bold">${order.sessionId}</td>
          <td class="p-3">${order.frame || 'Standard 3-Cut'}</td>
          <td class="p-3 font-bold text-primary">${order.amountFormatted || 'Rp ' + Number(order.amount || 35000).toLocaleString('id-ID')}</td>
          <td class="p-3 uppercase"><span class="px-1.5 py-0.5 bg-surface-container border border-primary/20 text-xs">${order.method || 'QRIS'}</span></td>
          <td class="p-3 text-on-surface-variant">${orderTime}</td>
          <td class="p-3">${statusBadge}</td>
          <td class="p-3 text-right">
            <div class="flex items-center justify-end gap-2">
              ${isPending ? `
                <button class="btn-acc-order px-3 py-1.5 bg-primary text-on-primary hover:bg-primary-container border border-primary shadow-brutal-sm font-label-md text-xs uppercase font-bold flex items-center gap-1 cursor-pointer" data-id="${order.id}">
                  <span class="material-symbols-outlined text-[16px] text-secondary-container">check_circle</span>
                  <span>ACC / APPROVE</span>
                </button>
                <button class="btn-reject-order px-2 py-1.5 bg-surface-container text-error hover:bg-error hover:text-white border border-primary font-label-md text-xs uppercase font-bold cursor-pointer" data-id="${order.id}" title="Reject Order">
                  ✕
                </button>
              ` : `
                <span class="text-xs text-on-surface-variant font-bold uppercase">${order.status}</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind Action Buttons
    tbody.querySelectorAll('.btn-acc-order').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.accOrder(id);
      });
    });

    tbody.querySelectorAll('.btn-reject-order').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.rejectOrder(id);
      });
    });
  }

  async accOrder(id) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/acc/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (window.kioskAudio) window.kioskAudio.playShutter();
        this.showToast(`ORDER #${id} APPROVED! KIOSK UNLOCKED.`);
        await this.fetchOrders();
      }
    } catch (err) {
      this.showToast('Failed to approve order', true);
    }
  }

  async rejectOrder(id) {
    if (!confirm(`Are you sure you want to cancel order #${id}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/reject/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast(`Order #${id} marked as rejected`);
        await this.fetchOrders();
      }
    } catch (err) {
      this.showToast('Failed to reject order', true);
    }
  }

  // --- TAB 2: QR PAYMENT & TARIFF ---

  initQrSection() {
    const filterButtons = document.querySelectorAll('.order-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => {
          b.classList.remove('bg-primary', 'text-on-primary');
          b.classList.add('bg-surface-container', 'text-on-surface');
        });
        btn.classList.add('bg-primary', 'text-on-primary');
        btn.classList.remove('bg-surface-container', 'text-on-surface');
        this.activeFilter = btn.getAttribute('data-filter');
        this.renderOrdersTable();
      });
    });

    const refreshOrdersBtn = document.getElementById('btn-refresh-orders');
    if (refreshOrdersBtn) {
      refreshOrdersBtn.addEventListener('click', () => {
        this.fetchOrders();
        this.showToast('Orders queue refreshed');
      });
    }

    // QR Image Upload trigger
    const uploadTrigger = document.getElementById('btn-trigger-upload-qr');
    const fileInput = document.getElementById('qr-file-input');
    const urlInput = document.getElementById('qr-image-url-input');
    const resetBtn = document.getElementById('btn-reset-qr');

    if (uploadTrigger && fileInput) {
      uploadTrigger.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target.result;
            this.settings.qrImage = dataUrl;
            if (urlInput) urlInput.value = '';
            this.updateQrPreview();
            this.showToast('QR code photo uploaded! Click Save to apply.');
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (urlInput) {
      urlInput.addEventListener('input', () => {
        this.settings.qrImage = urlInput.value.trim();
        this.updateQrPreview();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.settings.qrImage = '';
        if (urlInput) urlInput.value = '';
        if (fileInput) fileInput.value = '';
        this.updateQrPreview();
        this.showToast('Reset to default vector QRIS code');
      });
    }

    // Inputs live sync with preview
    const merchantInput = document.getElementById('merchant-name-input');
    const nmidInput = document.getElementById('merchant-nmid-input');
    const priceInput = document.getElementById('default-price-input');

    if (merchantInput) {
      merchantInput.addEventListener('input', () => {
        const p = document.getElementById('preview-merchant-name');
        if (p) p.textContent = merchantInput.value || 'KREASI THERMAL PHOTOBOOTH';
      });
    }

    if (nmidInput) {
      nmidInput.addEventListener('input', () => {
        const p = document.getElementById('preview-nmid');
        if (p) p.textContent = 'NMID: ' + (nmidInput.value || 'ID102049281729');
      });
    }

    if (priceInput) {
      priceInput.addEventListener('input', () => {
        const p = document.getElementById('preview-tariff');
        if (p) p.textContent = 'Rp ' + Number(priceInput.value || 35000).toLocaleString('id-ID');
      });
    }

    // QR Form Submit
    const qrForm = document.getElementById('qr-settings-form');
    if (qrForm) {
      qrForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          merchantName: merchantInput ? merchantInput.value : 'KREASI THERMAL PHOTOBOOTH',
          nmid: nmidInput ? nmidInput.value : 'ID102049281729',
          price: priceInput ? Number(priceInput.value) : 35000,
          paymentMode: document.getElementById('payment-mode-select').value,
          qrImage: this.settings.qrImage || ''
        };

        try {
          const res = await fetch(`${API_BASE}/api/admin/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            this.settings = data.settings;
            this.showToast('QR Payment settings and tariff saved to kiosk!');
          }
        } catch (err) {
          this.showToast('Failed to save QR settings', true);
        }
      });
    }
  }

  renderQrSettings() {
    const merchantInput = document.getElementById('merchant-name-input');
    const nmidInput = document.getElementById('merchant-nmid-input');
    const priceInput = document.getElementById('default-price-input');
    const modeSelect = document.getElementById('payment-mode-select');
    const urlInput = document.getElementById('qr-image-url-input');

    if (merchantInput) merchantInput.value = this.settings.merchantName || 'KREASI THERMAL PHOTOBOOTH';
    if (nmidInput) nmidInput.value = this.settings.nmid || 'ID102049281729';
    if (priceInput) priceInput.value = this.settings.price || 35000;
    if (modeSelect) modeSelect.value = this.settings.paymentMode || 'manual_acc';
    if (urlInput && this.settings.qrImage && !this.settings.qrImage.startsWith('data:')) {
      urlInput.value = this.settings.qrImage;
    }

    const pMerchant = document.getElementById('preview-merchant-name');
    const pNmid = document.getElementById('preview-nmid');
    const pTariff = document.getElementById('preview-tariff');

    if (pMerchant) pMerchant.textContent = this.settings.merchantName || 'KREASI THERMAL PHOTOBOOTH';
    if (pNmid) pNmid.textContent = 'NMID: ' + (this.settings.nmid || 'ID102049281729');
    if (pTariff) pTariff.textContent = 'Rp ' + Number(this.settings.price || 35000).toLocaleString('id-ID');

    this.updateQrPreview();
  }

  updateQrPreview() {
    const box = document.getElementById('preview-qr-box');
    if (!box) return;

    if (this.settings.qrImage) {
      box.innerHTML = `<img src="${this.settings.qrImage}" alt="QRIS" class="w-full h-full object-contain">`;
    } else {
      box.innerHTML = `
        <svg class="w-full h-full text-primary" fill="currentColor" viewBox="0 0 100 100">
          <rect height="28" width="28" x="5" y="5"></rect>
          <rect fill="#ffffff" height="20" width="20" x="9" y="9"></rect>
          <rect height="12" width="12" x="13" y="13"></rect>
          <rect height="28" width="28" x="67" y="5"></rect>
          <rect fill="#ffffff" height="20" width="20" x="71" y="9"></rect>
          <rect height="12" width="12" x="75" y="13"></rect>
          <rect height="28" width="28" x="5" y="67"></rect>
          <rect fill="#ffffff" height="20" width="20" x="9" y="71"></rect>
          <rect height="12" width="12" x="13" y="75"></rect>
          <rect height="8" width="8" x="37" y="37"></rect>
          <rect height="8" width="8" x="57" y="37"></rect>
          <rect height="12" width="12" x="45" y="45" fill="#ffb702"></rect>
          <rect height="8" width="8" x="69" y="61"></rect>
          <rect height="8" width="8" x="77" y="81"></rect>
        </svg>
      `;
    }
  }

  // --- TAB 3: FRAME MANAGEMENT ---

  initFramesSection() {
    const openBtn = document.getElementById('btn-open-create-frame');
    const modal = document.getElementById('frame-modal');
    const closeBtn = document.getElementById('btn-close-frame-modal');
    const cancelBtn = document.getElementById('btn-cancel-frame');
    const frameForm = document.getElementById('frame-form');

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this.openFrameModal();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

    if (frameForm) {
      frameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('modal-frame-id').value;
        const title = document.getElementById('modal-frame-name').value;
        const description = document.getElementById('modal-frame-desc').value;
        const poses = Number(document.getElementById('modal-frame-poses').value);
        const price = Number(document.getElementById('modal-frame-price').value);
        const aspect = document.getElementById('modal-frame-aspect').value;
        const badge = document.getElementById('modal-frame-badge').value;
        const active = document.getElementById('modal-frame-active').checked;

        const payload = {
          id: id || undefined,
          title,
          description,
          poses,
          price,
          aspect,
          badge,
          active,
          tag: `${poses} Photo Poses`
        };

        try {
          const res = await fetch(`${API_BASE}/api/admin/frames`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            this.frames = data.frames;
            this.renderFrames();
            modal.classList.add('hidden');
            this.showToast('Frame template saved successfully!');
          }
        } catch (err) {
          this.showToast('Error saving frame', true);
        }
      });
    }
  }

  openFrameModal(frame = null) {
    const modal = document.getElementById('frame-modal');
    const modalTitle = document.getElementById('frame-modal-title');
    if (!modal) return;

    if (frame) {
      modalTitle.textContent = 'EDIT FRAME TEMPLATE';
      document.getElementById('modal-frame-id').value = frame.id;
      document.getElementById('modal-frame-name').value = frame.title || '';
      document.getElementById('modal-frame-desc').value = frame.description || '';
      document.getElementById('modal-frame-poses').value = frame.poses || 3;
      document.getElementById('modal-frame-price').value = frame.price || 35000;
      document.getElementById('modal-frame-aspect').value = frame.aspect || '1:1';
      document.getElementById('modal-frame-badge').value = frame.badge || '';
      document.getElementById('modal-frame-active').checked = frame.active !== false;
    } else {
      modalTitle.textContent = 'CREATE NEW FRAME TEMPLATE';
      document.getElementById('modal-frame-id').value = '';
      document.getElementById('modal-frame-name').value = '';
      document.getElementById('modal-frame-desc').value = '';
      document.getElementById('modal-frame-poses').value = '3';
      document.getElementById('modal-frame-price').value = '35000';
      document.getElementById('modal-frame-aspect').value = '1:1';
      document.getElementById('modal-frame-badge').value = '';
      document.getElementById('modal-frame-active').checked = true;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  renderFrames() {
    const container = document.getElementById('frames-grid-container');
    if (!container) return;

    container.innerHTML = this.frames.map(frame => {
      return `
        <div class="bg-surface-container-low border-2 border-primary p-5 shadow-brutal flex flex-col justify-between relative ${frame.active ? '' : 'opacity-60'}">
          ${frame.badge ? `
            <div class="absolute top-3 right-3 bg-secondary-container text-on-secondary-container font-label-sm text-[10px] font-bold px-1.5 py-0.5 border border-primary uppercase">
              ${frame.badge}
            </div>
          ` : ''}

          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full ${frame.active ? 'bg-tertiary-fixed-dim' : 'bg-outline'} inline-block"></span>
              <h3 class="font-headline-md text-base uppercase font-bold text-primary">${frame.title}</h3>
            </div>
            <p class="font-body-md text-xs text-on-surface-variant line-clamp-2">${frame.description || 'Standard thermal continuous layout'}</p>
          </div>

          <!-- Mini Layout Representation -->
          <div class="my-4 p-3 bg-surface-container border border-dashed border-primary flex justify-center items-center">
            <div class="w-20 bg-surface-container-lowest border border-primary p-1.5 flex flex-col gap-1 shadow-sm">
              <div class="h-1 bg-primary/20 w-3/4 mx-auto"></div>
              ${Array.from({ length: Math.min(frame.poses || 3, 4) }).map(() => `
                <div class="aspect-square bg-surface-container-highest border border-primary/30 flex items-center justify-center text-[9px] font-code-terminal">📷</div>
              `).join('')}
            </div>
          </div>

          <div class="pt-3 border-t border-primary/20 flex flex-col gap-3">
            <div class="flex items-center justify-between font-code-terminal text-xs">
              <span>${frame.poses} POSES (${frame.aspect || '1:1'})</span>
              <strong class="text-sm font-bold">${frame.priceFormatted || 'Rp ' + Number(frame.price).toLocaleString('id-ID')}</strong>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1">
              <button class="btn-toggle-frame flex-1 h-8 bg-surface-container hover:bg-surface-container-high border border-primary font-label-sm text-[10px] uppercase font-bold cursor-pointer" data-id="${frame.id}">
                ${frame.active ? 'SET INACTIVE' : 'ACTIVATE'}
              </button>
              <button class="btn-edit-frame h-8 px-2.5 bg-surface-container hover:bg-surface-container-high border border-primary font-label-sm text-xs cursor-pointer" data-id="${frame.id}" title="Edit Frame">
                ✎
              </button>
              <button class="btn-delete-frame h-8 px-2.5 bg-surface-container text-error hover:bg-error hover:text-white border border-primary font-label-sm text-xs cursor-pointer" data-id="${frame.id}" title="Delete Frame">
                ✕
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind frame actions
    container.querySelectorAll('.btn-toggle-frame').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const frame = this.frames.find(f => f.id === id);
        if (frame) {
          frame.active = !frame.active;
          await this.saveFrameDirect(frame);
        }
      });
    });

    container.querySelectorAll('.btn-edit-frame').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const frame = this.frames.find(f => f.id === id);
        if (frame) this.openFrameModal(frame);
      });
    });

    container.querySelectorAll('.btn-delete-frame').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm(`Delete frame template #${id}?`)) {
          await this.deleteFrame(id);
        }
      });
    });
  }

  async saveFrameDirect(frame) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/frames`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(frame)
      });
      const data = await res.json();
      if (data.success) {
        this.frames = data.frames;
        this.renderFrames();
        this.showToast('Frame updated');
      }
    } catch (err) {
      this.showToast('Error updating frame', true);
    }
  }

  async deleteFrame(id) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/frames/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.frames = data.frames;
        this.renderFrames();
        this.showToast('Frame deleted');
      }
    } catch (err) {
      this.showToast('Error deleting frame', true);
    }
  }

  // --- TAB 4: PHOTO STYLES ---

  initStylesSection() {
    const saveBtn = document.getElementById('btn-save-styles');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const res = await fetch(`${API_BASE}/api/admin/styles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.styles)
          });
          const data = await res.json();
          if (data.success) {
            this.showToast('Photo style dithering configuration saved!');
          }
        } catch (err) {
          this.showToast('Error saving styles', true);
        }
      });
    }
  }

  renderStyles() {
    const container = document.getElementById('styles-list-container');
    if (!container) return;

    container.innerHTML = this.styles.map((style, idx) => {
      return `
        <div class="bg-surface-container-lowest border-2 border-primary p-5 shadow-brutal flex flex-col justify-between gap-4">
          <div class="flex items-start justify-between">
            <div>
              <span class="font-code-terminal text-[10px] text-on-surface-variant uppercase font-bold">ALGORITHM #${idx + 1}</span>
              <h3 class="font-headline-md text-base uppercase font-bold text-primary">${style.name}</h3>
              <span class="font-label-sm text-xs text-secondary-container font-bold">${style.subtitle || ''}</span>
            </div>
            ${style.isDefault ? `
              <span class="px-2 py-0.5 bg-primary text-on-primary text-[10px] font-code-terminal font-bold uppercase">DEFAULT</span>
            ` : ''}
          </div>

          <p class="font-body-md text-xs text-on-surface-variant">${style.description}</p>

          <div class="p-3 bg-surface-container border border-primary flex flex-col gap-2 font-code-terminal text-xs">
            <div class="flex justify-between items-center">
              <span>THERMAL CONTRAST:</span>
              <strong id="val-contrast-${style.id}">${style.contrast || 150}%</strong>
            </div>
            <input type="range" min="100" max="250" value="${style.contrast || 150}" class="style-contrast-slider accent-primary w-full cursor-pointer" data-id="${style.id}">
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-primary/20">
            <label class="flex items-center gap-2 cursor-pointer font-label-sm text-xs font-bold uppercase">
              <input type="checkbox" class="style-active-toggle w-4 h-4" data-id="${style.id}" ${style.active ? 'checked' : ''}>
              <span>VISIBLE IN KIOSK</span>
            </label>

            <button class="btn-make-default font-label-sm text-[10px] uppercase font-bold px-2 py-1 bg-surface-container hover:bg-surface-container-high border border-primary cursor-pointer" data-id="${style.id}">
              ${style.isDefault ? '✓ ACTIVE DEFAULT' : 'SET AS DEFAULT'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind style sliders & toggles
    container.querySelectorAll('.style-contrast-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const id = slider.getAttribute('data-id');
        const style = this.styles.find(s => s.id === id);
        if (style) {
          style.contrast = Number(e.target.value);
          const valEl = document.getElementById(`val-contrast-${id}`);
          if (valEl) valEl.textContent = style.contrast + '%';
        }
      });
    });

    container.querySelectorAll('.style-active-toggle').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = chk.getAttribute('data-id');
        const style = this.styles.find(s => s.id === id);
        if (style) style.active = e.target.checked;
      });
    });

    container.querySelectorAll('.btn-make-default').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.styles.forEach(s => s.isDefault = (s.id === id));
        this.renderStyles();
        this.showToast(`Default kiosk filter set to ${id.toUpperCase()}`);
      });
    });
  }

  // --- TAB 5: DATA FOTO & ARCHIVES ---

  initPhotosSection() {
    const refreshBtn = document.getElementById('btn-refresh-photos');
    const searchInput = document.getElementById('photo-search-input');
    const closePhotoModal = document.getElementById('btn-close-photo-modal');
    const photoModal = document.getElementById('photo-modal');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.fetchPhotos();
        this.showToast('Photo archives refreshed');
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        this.renderPhotos(query);
      });
    }

    if (closePhotoModal && photoModal) {
      closePhotoModal.addEventListener('click', () => {
        photoModal.classList.add('hidden');
      });
    }
  }

  async fetchPhotos() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/photos`);
      const photos = await res.json();
      this.photos = Array.isArray(photos) ? photos : [];

      const badge = document.getElementById('badge-total-photos');
      const countInd = document.getElementById('photo-count-indicator');
      if (badge) badge.textContent = this.photos.length;
      if (countInd) countInd.textContent = `ARCHIVED: ${this.photos.length} PRINTS`;

      this.renderPhotos();
    } catch (err) {
      console.warn('Error fetching photos:', err);
    }
  }

  renderPhotos(query = '') {
    const container = document.getElementById('photos-grid-container');
    if (!container) return;

    let filtered = this.photos;
    if (query) {
      filtered = this.photos.filter(p => {
        const sess = (p.sessionId || '').toLowerCase();
        const date = (p.createdAt || '').toLowerCase();
        const frame = (p.metadata && p.metadata.frame && p.metadata.frame.title || '').toLowerCase();
        return sess.includes(query) || date.includes(query) || frame.includes(query);
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-12 bg-surface-container-low border-2 border-primary text-center">
          <span class="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">image_not_supported</span>
          <span class="font-headline-md text-lg uppercase font-bold text-primary">No Photo Prints Recorded Yet</span>
          <p class="font-body-md text-xs text-on-surface-variant mt-1">Completed photobooth sessions will be stored here automatically.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID') : '--';
      const frameName = item.metadata && item.metadata.frame ? item.metadata.frame.title : '3-Cut Strip';
      const filterName = item.metadata && item.metadata.filter ? item.metadata.filter : '1-Bit Bayer';
      const imgUrl = item.fileUrl ? `${API_BASE}${item.fileUrl}` : '';

      return `
        <div class="bg-surface-container-low border-2 border-primary p-3 shadow-brutal flex flex-col justify-between">
          <div class="flex items-center justify-between pb-2 border-b border-primary/20 mb-2 font-code-terminal text-xs">
            <span class="font-bold bg-primary text-on-primary px-1.5 py-0.5">${item.sessionId}</span>
            <span class="text-on-surface-variant text-[10px]">${item.printId}</span>
          </div>

          <!-- Thermal Receipt Thumbnail Preview -->
          <div class="w-full bg-surface-container-highest border border-primary p-2 flex justify-center items-center overflow-hidden h-64 cursor-pointer btn-open-lightbox" data-url="${imgUrl}" data-session="${item.sessionId}" data-date="${dateStr}" data-id="${item.printId}">
            ${imgUrl ? `
              <img src="${imgUrl}" alt="Strip" class="max-h-full object-contain shadow-brutal-sm hover:scale-105 transition-transform">
            ` : `
              <div class="font-code-terminal text-xs text-on-surface-variant">No Image File</div>
            `}
          </div>

          <div class="flex flex-col gap-1 my-2 font-code-terminal text-xs">
            <span class="font-bold truncate text-primary uppercase">${frameName}</span>
            <div class="flex justify-between text-[11px] text-on-surface-variant">
              <span>${filterName}</span>
              <span>${dateStr.split(' ')[1] || ''}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-1.5 pt-2 border-t border-primary/20">
            <button class="btn-open-lightbox h-8 bg-surface-container hover:bg-surface-container-high border border-primary font-label-sm text-[10px] uppercase font-bold flex items-center justify-center gap-1 cursor-pointer" data-url="${imgUrl}" data-session="${item.sessionId}" data-date="${dateStr}" data-id="${item.printId}">
              <span class="material-symbols-outlined text-[14px]">visibility</span>
              <span>VIEW</span>
            </button>
            <a href="${imgUrl}" download="${item.printId || 'thermal-print'}.png" class="h-8 bg-primary text-on-primary hover:bg-primary-container border border-primary font-label-sm text-[10px] uppercase font-bold flex items-center justify-center gap-1 cursor-pointer">
              <span class="material-symbols-outlined text-[14px]">download</span>
              <span>PNG</span>
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Bind Lightbox clicks
    container.querySelectorAll('.btn-open-lightbox').forEach(el => {
      el.addEventListener('click', () => {
        const url = el.getAttribute('data-url');
        const session = el.getAttribute('data-session');
        const date = el.getAttribute('data-date');
        const id = el.getAttribute('data-id');
        this.openPhotoLightbox(url, session, date, id);
      });
    });
  }

  openPhotoLightbox(url, session, date, id) {
    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('modal-photo-img');
    const modalSession = document.getElementById('modal-photo-session');
    const modalDate = document.getElementById('modal-photo-date');
    const modalDownload = document.getElementById('modal-photo-download');
    const modalReprint = document.getElementById('modal-photo-reprint');

    if (!modal) return;

    if (modalImg) modalImg.src = url || '';
    if (modalSession) modalSession.textContent = session || 'SESS-0000';
    if (modalDate) modalDate.textContent = date || '';
    if (modalDownload) modalDownload.href = url || '#';

    if (modalReprint) {
      modalReprint.onclick = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/admin/photos/reprint/${id}`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            if (window.kioskAudio) window.kioskAudio.playShutter();
            this.showToast(`Reprint triggered for session ${session}`);
          }
        } catch (e) {
          this.showToast('Reprint command failed', true);
        }
      };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

// Instantiate Admin App
window.addEventListener('DOMContentLoaded', () => {
  window.kioskAdmin = new AdminApp();
  window.kioskAdmin.init();
});
