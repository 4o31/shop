/*
  misskey.shop demo (v8: Integrated Receipt Check)
  - Konami code unlock (provides discount code)
  - Multi-step checkout with discount code
  - Saves detailed receipt info to localStorage keyed by hash.
  - Receipt check integrated into main page.
*/

(function() {
  'use strict';

  const PRODUCTS = [
    { id: 'a', name: 'ミスキー缶バッジ', desc: '限定デザイン缶バッジ。', price: 1500, emoji: '📛' },
    { id: 'b', name: 'ノート風ステッカー', desc: '貼ってワクワク。', price: 500, emoji: '📒' },
    { id: 'c', name: 'ピクセルTシャツ', desc: 'ピクセルアートT。', price: 3800, emoji: '👕' },
    { id: 'd', name: '限定ピンバッジ', desc: '裏面に秘密の刻印。', price: 1200, emoji: '📍' },
    { id: 's', name: 'シークレットスタンプ', desc: 'Konamiコードで出現する特別品。', price: 0, emoji: '🔒', secret: true }
  ];

  const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  
  const STORAGE_KEY_SECRET = 'ms_secret_unlocked_v6';
  const STORAGE_KEY_RECEIPTS = 'ms_receipts_v6';
  const STORAGE_KEY_COUPON = 'ms_last_coupon_v6';

  const App = {
    // --- State ---
    state: {
      cart: [],
      order: [],
      secretUnlocked: false,
      konamiPos: 0,
      discountCode: null,
      discountApplied: false,
    },

    // --- DOM Elements ---
    elements: {
      body: document.getElementById('app-body'),
      grid: document.getElementById('grid'),
      itemCount: document.getElementById('item-count'),
      cartList: document.getElementById('cart-list'),
      modal: document.getElementById('modal'),
      modalBox: document.getElementById('modal-box'),
      checkoutBtn: document.getElementById('checkout'),
      // ▼▼▼ 照会用DOMを追加 ▼▼▼
      receiptCheckInput: document.getElementById('receipt-check-input'),
      receiptCheckBtn: document.getElementById('receipt-check-btn'),
      receiptCheckResult: document.getElementById('receipt-check-result'),
      receiptDetailsContainer: document.getElementById('receipt-details'),
      // ▲▲▲ ここまで ▲▲▲
    },

    // --- Initialization ---
    init() {
      this.loadState();
      this.renderGrid();
      this.renderCart();
      this.bindEvents();
      this.showDevConsoleHint();
    },

    loadState() {
      this.state.secretUnlocked = localStorage.getItem(STORAGE_KEY_SECRET) === '1';
      this.state.discountCode = localStorage.getItem(STORAGE_KEY_COUPON);
      this.state.order = PRODUCTS.filter(p => !p.secret).map(p => p.id);
    },

    // --- Event Binding ---
    bindEvents() {
      this.elements.grid.addEventListener('click', this.handleGridClick.bind(this));
      this.elements.checkoutBtn.addEventListener('click', this.showPurchaseModal.bind(this));
      this.elements.modal.addEventListener('click', (e) => {
        if (e.target === this.elements.modal) this.closeModal();
      });
      window.addEventListener('keydown', this.handleKeydown.bind(this));
      
      // ▼▼▼ 照会ボタンのイベントを追加 ▼▼▼
      this.elements.receiptCheckBtn.addEventListener('click', this.checkReceipt.bind(this));
      // ▲▲▲ ここまで ▲▲▲
    },

    // --- Render Functions ---
    renderGrid() {
      this.elements.grid.innerHTML = '';
      let list = this.state.order.slice();
      if (this.state.secretUnlocked && !list.includes('s')) {
        list.push('s');
      }
      
      const visibleItems = list.map(id => PRODUCTS.find(x => x.id === id)).filter(p => p && p.price > 0);
      this.elements.itemCount.textContent = `全 ${visibleItems.length} アイテム`;

      for (const id of list) {
        const p = PRODUCTS.find(x => x.id === id);
        if (!p) continue;
        
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = p.id;

        const priceHtml = p.price ? this.formatYen(p.price) : '<span class="secret-badge">FREE</span>';
        
        card.innerHTML = `
          <div class="thumb">${p.emoji}</div>
          <div class="meta"><h3>${this.escapeHtml(p.name)}</h3><p>${this.escapeHtml(p.desc)}</p></div>
          <div class="price">
            <div class="text-muted">${priceHtml}</div>
            <div class="price__controls">
              <button class="btn btn-add-cart" data-id="${p.id}">CART</button>
            </div>
          </div>
        `;
        this.elements.grid.appendChild(card);
      }
    },

    renderCart() {
      const el = this.elements.cartList;
      el.innerHTML = '';
      if (this.state.cart.length === 0) {
        el.innerHTML = '<div class="text-muted text-sm">カートが空です</div>';
        return;
      }
      for (const id of this.state.cart) {
        const p = PRODUCTS.find(x => x.id === id);
        const item = document.createElement('div');
        item.className = 'cart-item';
        item.innerHTML = `
          ${p.emoji} ${this.escapeHtml(p.name)} <span class="cart-item__price">(${this.formatYen(p.price)})</span>
        `;
        el.appendChild(item);
      }
    },

    // --- Event Handlers ---
    handleGridClick(e) {
      const addBtn = e.target.closest('.btn-add-cart');
      if (addBtn) {
        const id = addBtn.dataset.id;
        const p = PRODUCTS.find(x => x.id === id);
        this.state.cart.push(id);
        this.renderCart();
        this.showGenericModal('カート', `"${p.name}" をカートに追加しました。`);
        return;
      }
    },

    handleKeydown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Konami
      if (e.key === KONAMI_CODE[this.state.konamiPos]) {
        this.state.konamiPos++;
        if (this.state.konamiPos === KONAMI_CODE.length) {
          this.state.konamiPos = 0;
          this.unlockKonami();
        }
      } else {
        this.state.konamiPos = (e.key === KONAMI_CODE[0]) ? 1 : 0;
      }
      
      if (e.key === 'Escape') {
        this.closeModal();
      }
    },

    // --- Features / Easter Eggs ---
    unlockKonami() {
      const code = 'MS-SECRET-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      this.state.discountCode = code;
      localStorage.setItem(STORAGE_KEY_COUPON, code);
      
      if (!this.state.secretUnlocked) {
        this.state.secretUnlocked = true;
        localStorage.setItem(STORAGE_KEY_SECRET, '1');
        this.renderGrid();
      }

      this.showGenericModal(
        'シークレットボックスを開けた！',
        `割引コード：<code>${code}</code><div style="margin-top:10px;">購入手続き時に利用できます。シークレットアイテムも出現しました！</div>`
      );
    },

    showDevConsoleHint() {
      console.info(
        `%c[Misskey Shop] 開発者モード%c
このストアにはイースターエッグが実装されています。
開発者の皆様は、以下のヒントをお試しください。

1.  %cKonamiコード%c: ↑ ↑ ↓ ↓ ← → ← → B A (割引コードとシークレットアイテムが出現)
`,
        "font-size: 1.2em; font-weight: bold; color: #8b5cf6;",
        "font-size: 1em; font-weight: normal; color: inherit;",
        "font-weight: bold; color: #06b6d4;",
        "font-weight: normal; color: inherit;"
      );
    },

    // --- Purchase Flow ---
    showPurchaseModal() {
      if (this.state.cart.length === 0) {
        this.showGenericModal('カート', 'カートに商品がありません。');
        return;
      }
      
      this.state.discountApplied = false;
      const total = this.state.cart.reduce((s, id) => s + (PRODUCTS.find(p => p.id === id).price || 0), 0);
      
      const summaryItems = this.state.cart
        .map(id => PRODUCTS.find(p => p.id === id))
        .map(p => `<div><span>${this.escapeHtml(p.name)}</span> <span>${this.formatYen(p.price)}</span></div>`)
        .join('');

      const modalHTML = `
        <h3 class="modal__title" id="modal-title" tabindex="-1">購入手続き</h3>
        <div class="modal__content">
          <div class="checkout-summary">
            ${summaryItems}
            <div class="total" id="modal-total-display">
              <span>合計</span>
              <span>${this.formatYen(total)}</span>
            </div>
          </div>
          <div>割引コード</div>
          <div class="discount-form">
            <input type="text" id="discount-code-input" placeholder="MS-SECRET-XXXXXX">
            <button id="apply-discount-btn">適用</button>
          </div>
          <div class="discount-message" id="discount-message"></div>
        </div>
        <div class="modal__actions">
          <button class="btn btn-close" id="modal-close-btn">キャンセル</button>
          <button class="btn" id="modal-confirm-btn">購入確定</button>
        </div>
      `;
      this.openModal(modalHTML);

      document.getElementById('apply-discount-btn').addEventListener('click', this.handleApplyDiscount.bind(this));
      document.getElementById('modal-confirm-btn').addEventListener('click', this.handleCheckoutConfirm.bind(this));
      document.getElementById('modal-close-btn').addEventListener('click', this.closeModal.bind(this));
    },

    handleApplyDiscount() {
      const input = document.getElementById('discount-code-input');
      const messageEl = document.getElementById('discount-message');
      const code = input.value.trim();

      if (this.state.discountApplied) {
        messageEl.textContent = '割引は適用済みです。';
        messageEl.className = 'discount-message success';
        return;
      }

      if (code === this.state.discountCode && code !== null) {
        this.state.discountApplied = true;
        messageEl.textContent = '10%割引が適用されました！';
        messageEl.className = 'discount-message success';
        input.disabled = true;
        document.getElementById('apply-discount-btn').disabled = true;
        
        const total = this.state.cart.reduce((s, id) => s + (PRODUCTS.find(p => p.id === id).price || 0), 0);
        const discountedTotal = Math.round(total * 0.9);
        const totalDisplay = document.getElementById('modal-total-display');
        totalDisplay.innerHTML = `
          <span>合計</span>
          <span>
            <span class="original-price">${this.formatYen(total)}</span>
            <span class="discounted">${this.formatYen(discountedTotal)}</span>
          </span>
        `;
      } else {
        messageEl.textContent = '無効なコードです。';
        messageEl.className = 'discount-message error';
      }
    },

    async handleCheckoutConfirm() {
      const items = this.state.cart.map(id => PRODUCTS.find(p => p.id === id).name).join(', ');
      const baseTotal = this.state.cart.reduce((s, id) => s + (PRODUCTS.find(p => p.id === id).price || 0), 0);
      const finalTotal = this.state.discountApplied ? Math.round(baseTotal * 0.9) : baseTotal;
      const dateISO = new Date().toISOString();

      const receiptText = `misskey.shop receipt\nitems:${items}\ntotal:${finalTotal}\ndate:${dateISO}`;
      const hash = await this.sha256Hex(receiptText);
      
      const receipts = JSON.parse(localStorage.getItem(STORAGE_KEY_RECEIPTS) || '{}');
      
      const receiptDetails = {
        items: items,
        total: finalTotal,
        date: dateISO
      };
      
      receipts[hash] = receiptDetails;
      
      localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(receipts));

      this.state.cart = [];
      this.state.discountApplied = false;
      this.renderCart();
      
      this.showReceiptModal(hash, finalTotal);
    },

    showReceiptModal(hash, total) {
      const modalHTML = `
        <h3 class="modal__title" id="modal-title" tabindex="-1">購入完了</h3>
        <div class="modal__content">
          <p>ご注文ありがとうございました。<br>合計金額: <strong>${this.formatYen(total)}</strong></p>
          <p>レシートID (大切に保管してください):</p>
          <code>${hash}</code>
          <p class="text-sm" style="margin-top: 10px;">このIDはカート下の照会フォームで確認できます。</p>
        </div>
        <div class="modal__actions">
          <button class="btn" id="modal-close-btn">閉じる</button>
        </div>
      `;
      this.openModal(modalHTML);
      document.getElementById('modal-close-btn').addEventListener('click', this.closeModal.bind(this));
    },

    // --- Receipt Check (Integrated) ---
    // ▼▼▼ check.jsから移植 ▼▼▼
    checkReceipt() {
      const input = this.elements.receiptCheckInput.value.trim();
      const resultEl = this.elements.receiptCheckResult;
      const detailsEl = this.elements.receiptDetailsContainer;
      
      detailsEl.classList.remove('show');
      detailsEl.innerHTML = '';

      if (!input) {
        resultEl.textContent = '';
        resultEl.className = 'text-sm';
        return;
      }
      
      const receipts = JSON.parse(localStorage.getItem(STORAGE_KEY_RECEIPTS) || '{}');
      const details = receipts[input];

      if (details) {
        resultEl.textContent = '有効なレシートです。';
        resultEl.className = 'text-sm success';
        
        this.renderReceiptDetails(details);
        detailsEl.classList.add('show');
        
      } else {
        resultEl.textContent = 'レシートIDが見つかりません。';
        resultEl.className = 'text-sm error';
      }
    },
    
    renderReceiptDetails(details) {
      const detailsEl = this.elements.receiptDetailsContainer;
      
      const itemsList = details.items.split(', ').map(item => {
        return `<li>${this.escapeHtml(item)}</li>`;
      }).join('');
      
      const formattedTotal = this.formatYen(details.total);
      const formattedDate = new Date(details.date).toLocaleString('ja-JP');

      detailsEl.innerHTML = `
        <h4>購入内容</h4>
        <ul>${itemsList}</ul>
        <p>合計金額: ${formattedTotal}</p>
        <p class="date">購入日時: ${formattedDate}</p>
      `;
    },
    // ▲▲▲ ここまで移植 ▲▲▲

    // --- Modal Control ---
    openModal(html) {
      this.elements.modalBox.innerHTML = html;
      this.elements.modal.classList.add('show');
      this.elements.body.classList.add('modal-open');
      const title = this.elements.modalBox.querySelector('#modal-title');
      if (title) title.focus();
    },
    
    closeModal() {
      this.elements.modal.classList.remove('show');
      this.elements.body.classList.remove('modal-open');
    },
    
    showGenericModal(title, htmlContent) {
      const modalHTML = `
        <h3 class="modal__title" id="modal-title" tabindex="-1">${this.escapeHtml(title)}</h3>
        <div class="modal__content" id="modal-desc">${htmlContent}</div>
        <div class="modal__actions">
          <button class="btn" id="modal-close-btn">OK</button>
        </div>
      `;
      this.openModal(modalHTML);
      document.getElementById('modal-close-btn').addEventListener('click', this.closeModal.bind(this));
    },

    // --- Utilities ---
    formatYen(n) { return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n); },
    escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); },
    async sha256Hex(text) {
      const enc = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });

})();
