/**
 * Admin Dashboard Controller - Sleek Clean Theme & Dedicated Module Pages
 * Manages Clean 5-Button Home Dashboard, Dedicated Sub-Pages, Orders ACC, QR Payment, Frame Geometry, Photo Styles, and Archives
 */

const DEFAULT_BRIDGE_URL = 'https://frankfurt-commerce-project-charles.trycloudflare.com';

function resolveApiBase() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return window.location.port === '5000' ? '' : (window.location.port === '3000' ? '' : 'http://localhost:5000');
  }
  const custom = localStorage.getItem('kiosk_api_base_url');
  return custom ? custom.trim().replace(/\/+$/, '') : DEFAULT_BRIDGE_URL;
}

const API_BASE = resolveApiBase();

// Auto inject bypass-tunnel-reminder header only when using localtunnel
const _origFetch = window.fetch;
window.fetch = function(url, options = {}) {
  options = options || {};
  if (typeof url === 'string' && url.includes('loca.lt')) {
    options.headers = {
      'bypass-tunnel-reminder': 'true',
      ...(options.headers || {})
    };
  }
  return _origFetch.call(this, url, options);
};

class AdminApp {
  constructor() {
    this.currentTab = null;
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
    this.initSystemConfig();

    // Initial data load
    await this.fetchConfig();
    await this.fetchOrders();

    // Check URL routing on start (e.g. /admin vs /admin#orders)
    this.handleRouting();

    // Listen to hash changes for browser forward/backward buttons
    window.addEventListener('hashchange', () => {
      this.handleRouting();
    });

    // Start polling orders in background every 3 seconds
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
      toast.classList.remove('border-blue-500/40');
      toast.classList.add('border-red-500/60');
      if (toastIcon) {
        toastIcon.textContent = 'error';
        toastIcon.className = 'material-symbols-outlined text-red-400 text-[22px]';
      }
    } else {
      toast.classList.remove('border-red-500/60');
      toast.classList.add('border-blue-500/40');
      if (toastIcon) {
        toastIcon.textContent = 'check_circle';
        toastIcon.className = 'material-symbols-outlined text-blue-400 text-[22px]';
      }
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
    // Top 5 Squircle Cards on Main Dashboard
    const navCards = document.querySelectorAll('.dashboard-nav-card');
    navCards.forEach(card => {
      card.addEventListener('click', () => {
        const tabId = card.getAttribute('data-tab');
        this.openModulePage(tabId, true);
      });
    });

    // Back to Dashboard Button
    const backBtn = document.getElementById('btn-back-to-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.showDashboard(true);
      });
    }
  }

  handleRouting() {
    const rawHash = window.location.hash.replace('#', '').trim();
    if (['orders', 'qr', 'frames', 'styles', 'photos'].includes(rawHash)) {
      this.openModulePage(`tab-${rawHash}`, false);
    } else {
      this.showDashboard(false);
    }
  }

  showDashboard(updateHash = true) {
    this.currentTab = null;
    if (updateHash) {
      history.pushState(null, '', window.location.pathname);
    }

    const viewDash = document.getElementById('view-dashboard');
    const viewModule = document.getElementById('view-module-page');

    if (viewDash) {
      viewDash.classList.remove('hidden');
      viewDash.classList.add('flex');
    }
    if (viewModule) {
      viewModule.classList.add('hidden');
      viewModule.classList.remove('flex');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openModulePage(tabId, updateHash = true) {
    this.currentTab = tabId;
    const moduleId = tabId.replace('tab-', '');

    if (updateHash) {
      window.location.hash = moduleId;
    }

    const viewDash = document.getElementById('view-dashboard');
    const viewModule = document.getElementById('view-module-page');

    // Switch view visibility
    if (viewDash) {
      viewDash.classList.add('hidden');
      viewDash.classList.remove('flex');
    }
    if (viewModule) {
      viewModule.classList.remove('hidden');
      viewModule.classList.add('flex');
    }

    // Show only active section inside view-module-page
    document.querySelectorAll('.admin-tab-content').forEach(section => {
      if (section.id === tabId) {
        section.classList.remove('hidden');
        section.classList.add('block');
      } else {
        section.classList.add('hidden');
        section.classList.remove('block');
      }
    });

    // Update Header Icon, Title & Subtitle for this dedicated page
    this.updateModuleHeader(moduleId);

    if (moduleId === 'photos') {
      this.fetchPhotos();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateModuleHeader(moduleId) {
    const meta = {
      orders: {
        title: 'Persetujuan Order & Payment',
        desc: 'Validasi & ACC sesi bayar QRIS/Cash secara real-time untuk membuka kamera kiosk',
        icon: 'payments',
        bg: 'bg-[#ffb703]'
      },
      qr: {
        title: 'QRIS Gateway & Pengaturan Tarif',
        desc: 'Konfigurasi foto QRIS toko, NMID merchant, dan tarif harga per sesi booth',
        icon: 'qr_code_2',
        bg: 'bg-[#38bdf8]'
      },
      frames: {
        title: 'Geometri Frame & Template Struk',
        desc: 'Kelola layout frame foto, jumlah pose jepretan, aspect ratio, dan harga spesifik frame',
        icon: 'grid_view',
        bg: 'bg-[#c084fc]'
      },
      styles: {
        title: 'Photo Styles & Algoritma Dithering',
        desc: 'Preset dithering 1-bit thermal, filter default di kiosk, dan kurva kontras printer',
        icon: 'auto_fix_high',
        bg: 'bg-[#4ade80]'
      },
      photos: {
        title: 'Data Foto & Galeri Arsip Struk',
        desc: 'Riwayat cetak struk 80mm tiap sesi, unduh master file PNG, dan perintah reprint docket',
        icon: 'photo_library',
        bg: 'bg-[#2dd4bf]'
      }
    };

    const cur = meta[moduleId] || meta.orders;
    const titleEl = document.getElementById('module-page-title');
    const descEl = document.getElementById('module-page-desc');
    const iconContainer = document.getElementById('module-page-icon');

    if (titleEl) titleEl.textContent = cur.title;
    if (descEl) descEl.textContent = cur.desc;
    if (iconContainer) {
      iconContainer.className = `w-10 h-10 rounded-xl ${cur.bg} border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black`;
      iconContainer.innerHTML = `<span class="material-symbols-outlined text-[20px]">${cur.icon}</span>`;
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

      // Play alert chime if a new pending order arrives
      if (isBackground && pendingCount > this.lastPendingCount && this.soundEnabled && window.kioskAudio) {
        window.kioskAudio.playChime();
        this.showToast(`PESANAN BARU MENUNGGU ACC! (${pendingOrders[0].sessionId})`);
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
          <td colspan="8" class="p-8 text-center text-slate-400 font-mono text-xs">
            Tidak ada transaksi dengan filter: <strong>${this.activeFilter}</strong>
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
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ffb703] text-black border border-black font-bold text-xs shadow-[1px_1px_0px_#000]"><span class="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span> MENUNGGU ACC</span>`;
      } else if (isApproved) {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4ade80] text-black border border-black font-bold text-xs shadow-[1px_1px_0px_#000]">✓ APPROVED</span>`;
      } else if (isCompleted) {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#38bdf8] text-black border border-black font-bold text-xs shadow-[1px_1px_0px_#000]">DICETAK</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-200 text-black border border-black font-bold text-xs">${order.status || 'UNKNOWN'}</span>`;
      }

      const orderTime = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('id-ID') : '--:--';

      return `
        <tr class="hover:bg-gray-50 transition-colors border-b border-black/10 ${isPending ? 'bg-amber-100/40' : ''}">
          <td class="p-4 font-bold text-black">${order.txId || order.id}</td>
          <td class="p-4 font-bold text-blue-700">${order.sessionId}</td>
          <td class="p-4 text-black font-medium">${order.frame || 'Standard 3-Cut'}</td>
          <td class="p-4 font-bold text-[#059669]">${order.amountFormatted || 'Rp ' + Number(order.amount || 35000).toLocaleString('id-ID')}</td>
          <td class="p-4"><span class="px-2 py-0.5 rounded-md bg-[#ebeae5] border border-black text-[11px] text-black font-bold uppercase">${order.method || 'QRIS'}</span></td>
          <td class="p-4 text-gray-700">${orderTime}</td>
          <td class="p-4">${statusBadge}</td>
          <td class="p-4 text-right">
            <div class="flex items-center justify-end gap-2">
              ${isPending ? `
                <button class="btn-acc-order px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold border-2 border-black shadow-[2px_2px_0px_#000] text-xs flex items-center gap-1.5 transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none" data-id="${order.id}">
                  <span class="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>ACC</span>
                </button>
                <button class="btn-reject-order px-2.5 py-1.5 rounded-lg bg-white hover:bg-red-50 text-red-600 border-2 border-black text-xs font-bold transition-all cursor-pointer shadow-[2px_2px_0px_#000]" data-id="${order.id}" title="Tolak Pesanan">
                  ✕
                </button>
              ` : `
                <span class="text-xs text-gray-500 font-bold uppercase">${order.status}</span>
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
        this.showToast(`ORDER #${id} BERHASIL DI-ACC! KIOSK TERBUKA.`);
        await this.fetchOrders();
      }
    } catch (err) {
      this.showToast('Gagal menyetujui order', true);
    }
  }

  async rejectOrder(id) {
    if (!confirm(`Batalkan transaksi #${id}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/reject/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast(`Order #${id} dibatalkan`);
        await this.fetchOrders();
      }
    } catch (err) {
      this.showToast('Gagal membatalkan order', true);
    }
  }

  // --- MODULE 2: QR PAYMENT & TARIFF ---

  initQrSection() {
    const filterButtons = document.querySelectorAll('.order-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => {
          b.classList.remove('active', 'bg-[#ffb703]', 'text-black', 'border-black');
          b.classList.add('bg-white', 'text-black', 'border-black');
        });
        btn.classList.add('active', 'bg-[#ffb703]', 'text-black', 'border-black');
        btn.classList.remove('bg-white', 'text-black', 'border-black');
        this.activeFilter = btn.getAttribute('data-filter');
        this.renderOrdersTable();
      });
    });

    const refreshOrdersBtn = document.getElementById('btn-refresh-orders');
    if (refreshOrdersBtn) {
      refreshOrdersBtn.addEventListener('click', () => {
        this.fetchOrders();
        this.showToast('Antrean pesanan diperbarui');
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
            this.showToast('Foto QRIS berhasil dipilih! Klik Simpan untuk menerapkan.');
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
        this.showToast('Di-reset ke template QRIS default');
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
            this.showToast('Pengaturan QRIS & Tarif tersimpan ke Kiosk!');
          }
        } catch (err) {
          this.showToast('Gagal menyimpan pengaturan QR', true);
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
        <svg class="w-full h-full text-slate-900" fill="currentColor" viewBox="0 0 100 100">
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
          <rect height="12" width="12" x="45" y="45" fill="#0284c7"></rect>
          <rect height="8" width="8" x="69" y="61"></rect>
          <rect height="8" width="8" x="77" y="81"></rect>
        </svg>
      `;
    }
  }

  // --- MODULE 3: FRAME MANAGEMENT ---

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
            this.showToast('Template frame berhasil disimpan!');
          }
        } catch (err) {
          this.showToast('Gagal menyimpan frame', true);
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
      modalTitle.textContent = 'TAMBAH FRAME BARU';
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
        <div class="bg-white rounded-2xl p-5 border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#ffb703] transition-all flex flex-col justify-between relative ${frame.active ? '' : 'opacity-50'}">
          ${frame.badge ? `
            <div class="absolute top-4 right-4 bg-[#ffb703] text-black border border-black font-mono text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shadow-[1px_1px_0px_#000]">
              ${frame.badge}
            </div>
          ` : ''}

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full ${frame.active ? 'bg-emerald-500' : 'bg-gray-400'} border border-black inline-block"></span>
              <h3 class="text-base font-bold text-black uppercase font-display">${frame.title}</h3>
            </div>
            <p class="text-xs text-gray-600 line-clamp-2">${frame.description || 'Standard thermal continuous layout'}</p>
          </div>

          <!-- Mini Layout Representation -->
          <div class="my-4 p-3 rounded-xl bg-[#ebeae5] border-2 border-black flex justify-center items-center">
            <div class="w-20 bg-white border-2 border-black rounded-lg p-1.5 flex flex-col gap-1 shadow-sm">
              <div class="h-1 bg-black/30 w-3/4 mx-auto rounded-full"></div>
              ${Array.from({ length: Math.min(frame.poses || 3, 4) }).map(() => `
                <div class="aspect-square rounded bg-[#ebeae5] border border-black flex items-center justify-center text-[10px]">📷</div>
              `).join('')}
            </div>
          </div>

          <div class="pt-3 border-t-2 border-black/10 flex flex-col gap-3 font-mono text-xs">
            <div class="flex items-center justify-between text-black font-bold">
              <span>${frame.poses} POSES (${frame.aspect || '1:1'})</span>
              <strong class="text-sm font-bold text-[#059669]">${frame.priceFormatted || 'Rp ' + Number(frame.price).toLocaleString('id-ID')}</strong>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1">
              <button class="btn-toggle-frame flex-1 h-8 rounded-lg bg-[#ebeae5] hover:bg-[#dadad6] border-2 border-black text-[11px] font-bold text-black transition-colors cursor-pointer shadow-[1px_1px_0px_#000]" data-id="${frame.id}">
                ${frame.active ? 'NONAKTIFKAN' : 'AKTIFKAN'}
              </button>
              <button class="btn-edit-frame h-8 px-3 rounded-lg bg-white hover:bg-[#ebeae5] border-2 border-black text-xs text-black font-bold transition-colors cursor-pointer shadow-[1px_1px_0px_#000]" data-id="${frame.id}" title="Edit Frame">
                ✎
              </button>
              <button class="btn-delete-frame h-8 px-3 rounded-lg bg-white hover:bg-red-50 border-2 border-black text-xs text-red-600 font-bold transition-colors cursor-pointer shadow-[1px_1px_0px_#000]" data-id="${frame.id}" title="Hapus Frame">
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
        if (confirm(`Hapus frame template #${id}?`)) {
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
        this.showToast('Frame berhasil diperbarui');
      }
    } catch (err) {
      this.showToast('Gagal update frame', true);
    }
  }

  async deleteFrame(id) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/frames/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.frames = data.frames;
        this.renderFrames();
        this.showToast('Frame dihapus');
      }
    } catch (err) {
      this.showToast('Gagal menghapus frame', true);
    }
  }

  // --- MODULE 4: PHOTO STYLES ---

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
            this.showToast('Konfigurasi photo styles tersimpan!');
          }
        } catch (err) {
          this.showToast('Gagal menyimpan styles', true);
        }
      });
    }
  }

  renderStyles() {
    const container = document.getElementById('styles-list-container');
    if (!container) return;

    container.innerHTML = this.styles.map((style, idx) => {
      return `
        <div class="bg-white rounded-2xl p-6 border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#ffb703] transition-all flex flex-col justify-between gap-4">
          <div class="flex items-start justify-between">
            <div>
              <span class="text-[10px] font-mono text-black font-bold uppercase">PRESET #${idx + 1}</span>
              <h3 class="text-base font-bold text-black font-display">${style.name}</h3>
              <span class="text-xs text-gray-600">${style.subtitle || ''}</span>
            </div>
            ${style.isDefault ? `
              <span class="px-2.5 py-0.5 rounded-full bg-[#ffb703] text-black border border-black text-[10px] font-mono font-bold uppercase shadow-[1px_1px_0px_#000]">DEFAULT</span>
            ` : ''}
          </div>

          <p class="text-xs text-gray-600 leading-relaxed font-sans">${style.description}</p>

          <div class="p-3.5 rounded-xl bg-[#ebeae5] border-2 border-black flex flex-col gap-2 font-mono text-xs">
            <div class="flex justify-between items-center text-black font-bold">
              <span>KONTRAS THERMAL:</span>
              <strong id="val-contrast-${style.id}" class="text-black font-black">${style.contrast || 150}%</strong>
            </div>
            <input type="range" min="100" max="250" value="${style.contrast || 150}" class="style-contrast-slider accent-[#ffb703] w-full cursor-pointer" data-id="${style.id}">
          </div>

          <div class="flex items-center justify-between pt-2 border-t-2 border-black/10 text-xs font-mono">
            <label class="flex items-center gap-2 cursor-pointer text-black font-bold">
              <input type="checkbox" class="style-active-toggle w-4 h-4 rounded accent-[#ffb703]" data-id="${style.id}" ${style.active ? 'checked' : ''}>
              <span>TAMPIL DI KIOSK</span>
            </label>

            <button class="btn-make-default text-[11px] font-bold px-3 py-1 rounded-lg bg-[#ebeae5] hover:bg-[#dadad6] border-2 border-black text-black transition-colors cursor-pointer shadow-[1px_1px_0px_#000]" data-id="${style.id}">
              ${style.isDefault ? '✓ AKTIF DEFAULT' : 'JADIKAN DEFAULT'}
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
        this.showToast(`Filter default diubah ke ${id.toUpperCase()}`);
      });
    });
  }

  // --- MODULE 5: DATA FOTO & ARCHIVES ---

  initPhotosSection() {
    const refreshBtn = document.getElementById('btn-refresh-photos');
    const searchInput = document.getElementById('photo-search-input');
    const closePhotoModal = document.getElementById('btn-close-photo-modal');
    const photoModal = document.getElementById('photo-modal');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.fetchPhotos();
        this.showToast('Arsip foto diperbarui');
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

      const countInd = document.getElementById('photo-count-indicator');
      if (countInd) countInd.textContent = `ARSIP: ${this.photos.length} STRUK`;

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
        <div class="col-span-full p-12 glass-panel rounded-2xl border border-white/5 text-center">
          <span class="material-symbols-outlined text-[48px] text-slate-500 block mb-2">image_not_supported</span>
          <span class="text-base font-bold text-white uppercase">Belum Ada Struk Tercatat</span>
          <p class="text-xs text-slate-400 mt-1">Sesi photobooth yang telah selesai dicetak akan otomatis masuk ke arsip ini.</p>
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
        <div class="bg-white rounded-2xl p-3.5 border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#ffb703] transition-all flex flex-col justify-between">
          <div class="flex items-center justify-between pb-2 border-b border-black/10 mb-2 font-mono text-xs">
            <span class="font-bold text-blue-700">${item.sessionId}</span>
            <span class="text-gray-500 text-[10px]">${item.printId}</span>
          </div>

          <!-- Thermal Receipt Thumbnail Preview -->
          <div class="w-full bg-[#ebeae5] border-2 border-black rounded-xl p-2 flex justify-center items-center overflow-hidden h-64 cursor-pointer btn-open-lightbox shadow-inner hover:bg-[#dadad6] transition-colors" data-url="${imgUrl}" data-session="${item.sessionId}" data-date="${dateStr}" data-id="${item.printId}">
            ${imgUrl ? `
              <img src="${imgUrl}" alt="Strip" class="max-h-full object-contain rounded shadow-md hover:scale-105 transition-transform duration-200">
            ` : `
              <div class="font-mono text-xs text-gray-500">No Image</div>
            `}
          </div>

          <div class="flex flex-col gap-1 my-2.5 font-mono text-xs">
            <span class="font-bold truncate text-black uppercase">${frameName}</span>
            <div class="flex justify-between text-[11px] text-gray-600 font-bold">
              <span>${filterName}</span>
              <span>${dateStr.split(' ')[1] || ''}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-2 border-t-2 border-black/10 font-mono text-xs">
            <button class="btn-open-lightbox h-8 rounded-lg bg-white hover:bg-[#ebeae5] border-2 border-black text-[11px] font-bold text-black flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-[1px_1px_0px_#000]" data-url="${imgUrl}" data-session="${item.sessionId}" data-date="${dateStr}" data-id="${item.printId}">
              <span class="material-symbols-outlined text-[15px]">visibility</span>
              <span>LIHAT</span>
            </button>
            <a href="${imgUrl}" download="${item.printId || 'thermal-print'}.png" class="h-8 rounded-lg bg-[#ffb703] hover:bg-[#ffc83b] border-2 border-black text-[11px] font-bold text-black flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-[1px_1px_0px_#000]">
              <span class="material-symbols-outlined text-[15px]">download</span>
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
            this.showToast(`Reprint struk dikirim untuk sesi ${session}`);
          }
        } catch (e) {
          this.showToast('Gagal mengirim perintah reprint', true);
        }
      };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  // --- SYSTEM & ENVIRONMENT (.ENV) CONFIGURATION ---

  initSystemConfig() {
    const btnOpen = document.getElementById('btn-open-config');
    const btnClose = document.getElementById('btn-close-config');
    const btnCancel = document.getElementById('btn-cancel-config');
    const modal = document.getElementById('modal-config');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        this.openConfigModal();
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.closeConfigModal();
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.closeConfigModal();
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeConfigModal();
        }
      });
    }

    // Subtabs inside Config Modal
    const subtabs = document.querySelectorAll('.cfg-subtab');
    subtabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-cfg-tab');

        subtabs.forEach(t => {
          t.classList.remove('border-2', 'border-black', 'border-b-0', 'bg-[#faf9f5]', 'text-black', '-mb-[2px]');
          t.classList.add('border-2', 'border-transparent', 'text-gray-700');
        });
        tab.classList.add('border-2', 'border-black', 'border-b-0', 'bg-[#faf9f5]', 'text-black', '-mb-[2px]');
        tab.classList.remove('border-transparent', 'text-gray-700');

        document.querySelectorAll('.cfg-tab-content').forEach(content => {
          if (content.id === targetId) {
            content.classList.remove('hidden');
          } else {
            content.classList.add('hidden');
          }
        });

        if (targetId === 'cfg-tab-raw') {
          this.syncFormToRawEnv();
        }
      });
    });

    // Printer density slider label
    const densitySlider = document.getElementById('cfg-printer-density');
    const densityVal = document.getElementById('cfg-density-val');
    if (densitySlider && densityVal) {
      densitySlider.addEventListener('input', (e) => {
        densityVal.textContent = `LEVEL ${e.target.value}`;
      });
    }

    // Toggle Secret Key Visibility
    const toggleSecretBtn = document.getElementById('btn-toggle-secret-key');
    const secretInput = document.getElementById('cfg-r2-secret-key');
    if (toggleSecretBtn && secretInput) {
      toggleSecretBtn.addEventListener('click', () => {
        const isPassword = secretInput.type === 'password';
        secretInput.type = isPassword ? 'text' : 'password';
        const icon = toggleSecretBtn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = isPassword ? 'visibility_off' : 'visibility';
      });
    }

    // Test R2
    const btnTestR2 = document.getElementById('btn-test-r2');
    if (btnTestR2) {
      btnTestR2.addEventListener('click', () => {
        this.testR2Connection();
      });
    }

    // Test Printer
    const btnTestPrinter = document.getElementById('btn-test-printer');
    if (btnTestPrinter) {
      btnTestPrinter.addEventListener('click', () => {
        this.testPrinterFeed();
      });
    }

    // Auto-adjust settings for Bluetooth printer
    const prnSelect = document.getElementById('cfg-printer-name');
    const prnIfaceSelect = document.getElementById('cfg-printer-interface');
    const prnWidthSelect = document.getElementById('cfg-paper-width');
    const prnAutoCutBox = document.getElementById('cfg-auto-cut');
    const prnIpInput = document.getElementById('cfg-printer-ip');

    const handlePrinterChange = () => {
      const name = prnSelect ? prnSelect.value : '';
      const iface = prnIfaceSelect ? prnIfaceSelect.value : '';
      if (iface === 'bluetooth_com' || name.includes('RPP') || name.includes('COM') || name.includes('Bluetooth')) {
        if (prnWidthSelect) prnWidthSelect.value = '58mm';
        if (prnAutoCutBox) prnAutoCutBox.checked = false;
        if (prnIpInput && (!prnIpInput.value || prnIpInput.value.includes('192.168'))) {
          prnIpInput.value = 'COM6';
        }
        if (prnIfaceSelect && iface !== 'bluetooth_com') {
          prnIfaceSelect.value = 'bluetooth_com';
        }
      }
    };

    if (prnSelect) prnSelect.addEventListener('change', handlePrinterChange);
    if (prnIfaceSelect) prnIfaceSelect.addEventListener('change', handlePrinterChange);

    // Copy Raw .env
    const btnCopyEnv = document.getElementById('btn-copy-raw-env');
    if (btnCopyEnv) {
      btnCopyEnv.addEventListener('click', () => {
        const textarea = document.getElementById('raw-env-textarea');
        if (textarea) {
          navigator.clipboard.writeText(textarea.value);
          this.showToast('Isi file .env berhasil disalin ke clipboard');
        }
      });
    }

    // Reset Default Template
    const btnResetEnv = document.getElementById('btn-reset-default-env');
    if (btnResetEnv) {
      btnResetEnv.addEventListener('click', () => {
        if (confirm('Muat template default .env? Perubahan yang belum disimpan akan tertimpa.')) {
          if (this.defaultEnvContent) {
            const textarea = document.getElementById('raw-env-textarea');
            if (textarea) {
              textarea.value = this.defaultEnvContent;
              this.syncRawEnvToForm(this.defaultEnvContent);
              this.showToast('Template default .env dimuat');
            }
          }
        }
      });
    }

    // Save Config
    const btnSave = document.getElementById('btn-save-config');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.saveEnvConfig();
      });
    }
  }

  async openConfigModal() {
    const modal = document.getElementById('modal-config');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const isCloudHost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const cloudWarningEl = document.getElementById('printer-cloud-warning');
    if (cloudWarningEl) {
      if (isCloudHost) {
        cloudWarningEl.classList.remove('hidden');
        const displayEl = document.getElementById('bridge-url-display');
        if (displayEl) displayEl.textContent = API_BASE;
      } else {
        cloudWarningEl.classList.add('hidden');
      }
    }

    await this.fetchAvailablePrinters();
    await this.loadEnvConfig();
  }

  async fetchAvailablePrinters() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/printers`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.printers)) {
        const select = document.getElementById('cfg-printer-name');
        if (select) {
          const current = data.currentPrinter || (this.envObj ? this.envObj.PRINTER_NAME : '') || (this.settings ? this.settings.printerName : '');
          select.innerHTML = '<option value="">-- Gunakan Default Windows Printer --</option>';
          data.printers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = `${p.name} ${p.isDefault ? '(Default Windows)' : ''}`;
            if (p.name === current) {
              opt.selected = true;
            }
            select.appendChild(opt);
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch printers:', e);
    }
  }

  closeConfigModal() {
    const modal = document.getElementById('modal-config');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async loadEnvConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/env`);
      const data = await res.json();
      if (data.success) {
        this.rawEnvContent = data.rawEnv || '';
        this.defaultEnvContent = data.defaultEnv || '';
        this.envObj = data.env || {};

        const textarea = document.getElementById('raw-env-textarea');
        if (textarea) textarea.value = this.rawEnvContent;

        this.populateConfigForm(this.envObj);
      }
    } catch (err) {
      console.error('Error loading env config:', err);
      this.showToast('Gagal memuat file .env dari server', true);
    }
  }

  populateConfigForm(env) {
    const r2Enabled = document.getElementById('cfg-r2-enabled');
    const r2AccountId = document.getElementById('cfg-r2-account-id');
    const r2BucketName = document.getElementById('cfg-r2-bucket-name');
    const r2AccessKey = document.getElementById('cfg-r2-access-key');
    const r2SecretKey = document.getElementById('cfg-r2-secret-key');
    const r2WorkerUrl = document.getElementById('cfg-r2-worker-url');
    const r2PublicDomain = document.getElementById('cfg-r2-public-domain');

    if (r2Enabled) r2Enabled.checked = env.R2_ENABLED === 'true' || env.R2_ENABLED === true;
    if (r2AccountId) r2AccountId.value = env.R2_ACCOUNT_ID || '';
    if (r2BucketName) r2BucketName.value = env.R2_BUCKET_NAME || 'photobooth-prints';
    if (r2AccessKey) r2AccessKey.value = env.R2_ACCESS_KEY_ID || '';
    if (r2SecretKey) r2SecretKey.value = env.R2_SECRET_ACCESS_KEY || '';
    if (r2WorkerUrl) r2WorkerUrl.value = env.R2_WORKER_URL || '';
    if (r2PublicDomain) r2PublicDomain.value = env.R2_PUBLIC_DOMAIN || '';

    const srvPort = document.getElementById('cfg-server-port');
    const apiBase = document.getElementById('cfg-api-base-url');
    const kioskName = document.getElementById('cfg-kiosk-name');
    const hardwareId = document.getElementById('cfg-hardware-id');
    const paymentMode = document.getElementById('cfg-payment-mode');
    const autoTimeout = document.getElementById('cfg-auto-acc-timeout');

    if (srvPort) srvPort.value = env.PORT || 5000;
    if (apiBase) apiBase.value = env.API_BASE_URL || 'http://localhost:5000';
    if (kioskName) kioskName.value = env.KIOSK_NAME || this.settings.kioskName || 'KIOSK #04';
    if (hardwareId) hardwareId.value = env.HARDWARE_ID || this.settings.hardwareId || 'TB-80MM-STATION-A9';
    if (paymentMode) paymentMode.value = env.PAYMENT_MODE || this.settings.paymentMode || 'manual_acc';
    if (autoTimeout) autoTimeout.value = env.AUTO_ACC_TIMEOUT || this.settings.autoAccTimeout || 30;

    const prnName = document.getElementById('cfg-printer-name');
    const prnInterface = document.getElementById('cfg-printer-interface');
    const prnIp = document.getElementById('cfg-printer-ip');
    const prnWidth = document.getElementById('cfg-paper-width');
    const prnDensity = document.getElementById('cfg-printer-density');
    const prnDensityVal = document.getElementById('cfg-density-val');
    const prnAutoCut = document.getElementById('cfg-auto-cut');

    if (prnName && (env.PRINTER_NAME || this.settings.printerName)) {
      prnName.value = env.PRINTER_NAME || this.settings.printerName;
    }
    if (prnInterface) prnInterface.value = env.PRINTER_INTERFACE || 'bluetooth_com';
    if (prnIp) prnIp.value = env.PRINTER_IP || 'COM6';
    if (prnWidth) prnWidth.value = env.PAPER_WIDTH || '58mm';
    if (prnDensity) {
      prnDensity.value = env.PRINT_DENSITY || 8;
      if (prnDensityVal) prnDensityVal.textContent = `LEVEL ${prnDensity.value}`;
    }
    if (prnAutoCut) prnAutoCut.checked = env.AUTO_CUT === 'true';
  }

  collectConfigForm() {
    const env = { ...this.envObj };

    const r2Enabled = document.getElementById('cfg-r2-enabled');
    const r2AccountId = document.getElementById('cfg-r2-account-id');
    const r2BucketName = document.getElementById('cfg-r2-bucket-name');
    const r2AccessKey = document.getElementById('cfg-r2-access-key');
    const r2SecretKey = document.getElementById('cfg-r2-secret-key');
    const r2WorkerUrl = document.getElementById('cfg-r2-worker-url');
    const r2PublicDomain = document.getElementById('cfg-r2-public-domain');

    if (r2Enabled) env.R2_ENABLED = r2Enabled.checked ? 'true' : 'false';
    if (r2AccountId) env.R2_ACCOUNT_ID = r2AccountId.value.trim();
    if (r2BucketName) env.R2_BUCKET_NAME = r2BucketName.value.trim();
    if (r2AccessKey) env.R2_ACCESS_KEY_ID = r2AccessKey.value.trim();
    if (r2SecretKey) env.R2_SECRET_ACCESS_KEY = r2SecretKey.value.trim();
    if (r2WorkerUrl) env.R2_WORKER_URL = r2WorkerUrl.value.trim();
    if (r2PublicDomain) env.R2_PUBLIC_DOMAIN = r2PublicDomain.value.trim();

    const srvPort = document.getElementById('cfg-server-port');
    const apiBase = document.getElementById('cfg-api-base-url');
    const kioskName = document.getElementById('cfg-kiosk-name');
    const hardwareId = document.getElementById('cfg-hardware-id');
    const paymentMode = document.getElementById('cfg-payment-mode');
    const autoTimeout = document.getElementById('cfg-auto-acc-timeout');

    if (srvPort) env.PORT = srvPort.value.trim() || '5000';
    if (apiBase) env.API_BASE_URL = apiBase.value.trim() || 'http://localhost:5000';
    if (kioskName) env.KIOSK_NAME = kioskName.value.trim() || 'KIOSK #04';
    if (hardwareId) env.HARDWARE_ID = hardwareId.value.trim() || 'TB-80MM-STATION-A9';
    if (paymentMode) env.PAYMENT_MODE = paymentMode.value;
    if (autoTimeout) env.AUTO_ACC_TIMEOUT = autoTimeout.value.trim() || '30';

    const prnName = document.getElementById('cfg-printer-name');
    const prnInterface = document.getElementById('cfg-printer-interface');
    const prnIp = document.getElementById('cfg-printer-ip');
    const prnWidth = document.getElementById('cfg-paper-width');
    const prnDensity = document.getElementById('cfg-printer-density');
    const prnAutoCut = document.getElementById('cfg-auto-cut');

    if (prnName) env.PRINTER_NAME = prnName.value;
    if (prnInterface) env.PRINTER_INTERFACE = prnInterface.value;
    if (prnIp) env.PRINTER_IP = prnIp.value.trim();
    if (prnWidth) env.PAPER_WIDTH = prnWidth.value;
    if (prnDensity) env.PRINT_DENSITY = prnDensity.value;
    if (prnAutoCut) env.AUTO_CUT = prnAutoCut.checked ? 'true' : 'false';

    return env;
  }

  syncFormToRawEnv() {
    const env = this.collectConfigForm();
    const textarea = document.getElementById('raw-env-textarea');
    if (!textarea) return;

    let text = textarea.value;
    const lines = text.split(/\r?\n/);
    const updated = [];
    const touched = new Set();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        updated.push(line);
        continue;
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        if (key in env) {
          let val = env[key];
          if (typeof val === 'string' && (val.includes(' ') || val.includes('#'))) {
            val = `"${val}"`;
          }
          updated.push(`${key}=${val}`);
          touched.add(key);
        } else {
          updated.push(line);
        }
      } else {
        updated.push(line);
      }
    }

    for (const [k, v] of Object.entries(env)) {
      if (!touched.has(k)) {
        let val = v;
        if (typeof val === 'string' && (val.includes(' ') || val.includes('#'))) {
          val = `"${val}"`;
        }
        updated.push(`${k}=${val}`);
      }
    }

    textarea.value = updated.join('\n');
  }

  syncRawEnvToForm(rawText) {
    const env = {};
    const lines = rawText.split(/\r?\n/);
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
    this.populateConfigForm(env);
  }

  async saveEnvConfig() {
    try {
      const saveBtn = document.getElementById('btn-save-config');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('opacity-50');
      }

      const activeTab = document.querySelector('.cfg-subtab.active');
      const isRawTab = activeTab && activeTab.getAttribute('data-cfg-tab') === 'cfg-tab-raw';

      let payload = {};
      if (isRawTab) {
        const textarea = document.getElementById('raw-env-textarea');
        payload.rawEnv = textarea ? textarea.value : '';
      } else {
        payload.env = this.collectConfigForm();
      }

      const res = await fetch(`${API_BASE}/api/admin/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (payload.env && payload.env.API_BASE_URL) {
          localStorage.setItem('kiosk_api_base_url', payload.env.API_BASE_URL);
        }
        this.showToast('Konfigurasi .env berhasil disimpan & disinkronkan!');
        if (data.rawEnv) {
          const textarea = document.getElementById('raw-env-textarea');
          if (textarea) textarea.value = data.rawEnv;
        }
        if (data.env) {
          this.populateConfigForm(data.env);
        }
        await this.fetchConfig();
        this.closeConfigModal();
      } else {
        this.showToast(data.error || 'Gagal menyimpan konfigurasi', true);
      }
    } catch (err) {
      console.error('Error saving config:', err);
      this.showToast('Gagal menghubungi server', true);
    } finally {
      const saveBtn = document.getElementById('btn-save-config');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-50');
      }
    }
  }

  async testR2Connection() {
    const statusEl = document.getElementById('test-r2-status');
    const env = this.collectConfigForm();
    if (statusEl) {
      statusEl.textContent = 'Memeriksa kredensial R2...';
      statusEl.className = 'text-xs font-mono text-cyan-400 animate-pulse';
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/env/test-r2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: env.R2_ACCOUNT_ID,
          accessKey: env.R2_ACCESS_KEY_ID,
          secretKey: env.R2_SECRET_ACCESS_KEY,
          bucketName: env.R2_BUCKET_NAME,
          publicDomain: env.R2_PUBLIC_DOMAIN,
          workerUrl: env.R2_WORKER_URL
        })
      });
      const data = await res.json();
      if (statusEl) {
        statusEl.textContent = data.message;
        statusEl.className = `text-xs font-mono ${data.success ? 'text-emerald-400' : 'text-red-400'}`;
      }
      this.showToast(data.message, !data.success);
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = 'Gagal menghubungi server untuk test R2';
        statusEl.className = 'text-xs font-mono text-red-400';
      }
    }
  }

  async testPrinterFeed() {
    const statusEl = document.getElementById('test-printer-status');
    const env = this.collectConfigForm();
    if (statusEl) {
      statusEl.textContent = 'Mengirim perintah feed test ke printer via bridge...';
      statusEl.className = 'text-xs font-mono text-emerald-500 animate-pulse font-bold';
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/env/test-printer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: env.PRINTER_NAME || '',
          printerType: env.PRINTER_INTERFACE,
          printerIp: env.PRINTER_IP,
          paperWidth: env.PAPER_WIDTH,
          density: env.PRINT_DENSITY,
          autoCut: env.AUTO_CUT
        })
      });

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Server response tidak valid (${res.status}): ${text.slice(0, 80) || 'Koneksi terputus saat request'}`);
      }

      if (statusEl) {
        statusEl.textContent = data.message || (data.success ? 'Berhasil dikirim' : 'Gagal mencetak');
        statusEl.className = `text-xs font-mono ${data.success ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'}`;
      }
      try {
        if (window.kioskAudio && typeof window.kioskAudio.playShutter === 'function') {
          window.kioskAudio.playShutter();
        }
      } catch (audioErr) {}
      this.showToast(data.message || (data.success ? 'Test feed berhasil' : 'Gagal test feed'), !data.success);
    } catch (err) {
      console.error('Test printer error:', err);
      if (statusEl) {
        statusEl.textContent = `Gagal mengirim perintah: ${err.message || 'Koneksi error'}`;
        statusEl.className = 'text-xs font-mono text-red-500 font-bold';
      }
      this.showToast(`Gagal: ${err.message || 'Server backend tidak merespon'}`, true);
    }
  }
}

// Instantiate Admin App
window.addEventListener('DOMContentLoaded', () => {
  window.kioskAdmin = new AdminApp();
  window.kioskAdmin.init();
});
