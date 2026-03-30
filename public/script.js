// ===================================================
//   BHAIYA RESTAURANT – script.js (Full-Stack Version)
//   Full Admin + User Logic with API Integration
// ===================================================

const API_URL = '/api';

// ─── STATE ───────────────────────────────────────
let state = {
  foodBookingOpen: true,
  hallBookingOpen: true,
  menuItems: [],
  cart: {},
  kmPrices: [],
  hallPricingMode: 'hour',
  hallPriceAmount: 500,
  cabinBookings: {},
  payment: {
    upi: '',
    name: '',
    other: '',
    adminContact: '',
    address: '',
  },
  foodBookings: [],
  hallBookings: [],
  currentBill: null,
  activeCat: 'All',
};

// ─── ADMIN CREDENTIALS ───────────────────────────
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'bhaiya123';
let adminLoggedIn = false;

// ─── API UTILS ────────────────────────────────────
async function apiRequest(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_URL}${endpoint}`, options);
    
    // Check if response is JSON and handle errors
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.error || `Server Error (${res.status})`;
      console.warn(`API Error (${endpoint}):`, errorMsg);
      showToast(`⚠️ ${errorMsg}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`API Error (${endpoint}):`, err);
    showToast('⚠️ Connection error. Check if server is running.');
    return null;
  }
}

// ─── DATA LOADING ────────────────────────────────
async function loadAllData() {
  const [menu, settings, foodB, hallB] = await Promise.all([
    apiRequest('/menu'),
    apiRequest('/settings'),
    apiRequest('/bookings/food'),
    apiRequest('/bookings/hall')
  ]);

  if (menu && Array.isArray(menu)) state.menuItems = menu;
  else if (!state.menuItems.length) state.menuItems = [];

  if (settings && typeof settings === 'object' && !settings.error) {
    state.foodBookingOpen = settings.foodBookingOpen ?? true;
    state.hallBookingOpen = settings.hallBookingOpen ?? true;
    state.kmPrices = settings.kmPrices || [];
    state.hallPricingMode = settings.hallPricingMode || 'hour';
    state.hallPriceAmount = settings.hallPriceAmount || 500;
    state.payment = {
      upi: settings.upi || '',
      name: settings.name || '',
      other: settings.other || '',
      adminContact: settings.adminContact || '',
      address: settings.address || '',
    };
  }

  if (foodB && Array.isArray(foodB)) state.foodBookings = foodB;
  else if (!state.foodBookings.length) state.foodBookings = [];

  if (hallB && Array.isArray(hallB)) {
    state.hallBookings = hallB;
    // Build cabinBookings from hallB
    state.cabinBookings = {};
    hallB.forEach(b => {
      if (!state.cabinBookings[b.date]) state.cabinBookings[b.date] = [];
      state.cabinBookings[b.date].push(b.cabin);
    });
  } else if (!state.hallBookings.length) {
    state.hallBookings = [];
  }

  updateFooterAddress();
}

// ─── SECTION ROUTING ─────────────────────────────
async function showSection(id) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  // Refresh data on section change
  await loadAllData();

  if (id === 'food-user') initFoodUser();
  if (id === 'hall-user') initHallUser();
  if (id === 'admin-panel' && adminLoggedIn) initAdminPanel();
  if (id === 'admin-login') { document.getElementById('hero').style.display = 'none'; }
  if (id === 'home') { 
    document.getElementById('hero').style.display = ''; 
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden')); 
  }
}

function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('open');
}

// ─── ADMIN LOGIN / LOGOUT ─────────────────────────
function adminLogin() {
  const u = document.getElementById('admin-user').value.trim();
  const p = document.getElementById('admin-pass').value.trim();
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    adminLoggedIn = true;
    showSection('admin-panel');
  } else {
    document.getElementById('login-error').classList.remove('hidden');
  }
}
function adminLogout() {
  adminLoggedIn = false;
  showSection('home');
  document.getElementById('admin-user').value = '';
  document.getElementById('admin-pass').value = '';
}

// ─── ADMIN PANEL INIT ─────────────────────────────
function initAdminPanel() {
  renderAdminMenu();
  renderKmTable();
  renderHallPricing();
  renderCabinAdmin();
  renderBookings();
  loadPaymentForm();
  
  // Sync toggles with state
  const foodToggle = document.getElementById('food-status-toggle');
  const hallToggle = document.getElementById('hall-status-toggle');
  if (foodToggle) foodToggle.checked = state.foodBookingOpen;
  if (hallToggle) hallToggle.checked = state.hallBookingOpen;
  
  document.getElementById('food-status-text').textContent = state.foodBookingOpen ? 'OPEN' : 'CLOSED';
  document.getElementById('hall-status-text').textContent = state.hallBookingOpen ? 'OPEN' : 'CLOSED';

  switchAdminTab('food-mgmt');
}

function switchAdminTab(tabId) {
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.remove('hidden');
  const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
  if (btn) btn.classList.add('active');
}

// ─── SETTINGS SYNC ───────────────────────────────
async function saveSettings() {
  const payload = {
    foodBookingOpen: state.foodBookingOpen,
    hallBookingOpen: state.hallBookingOpen,
    kmPrices: state.kmPrices,
    hallPricingMode: state.hallPricingMode,
    hallPriceAmount: state.hallPriceAmount,
    upi: state.payment.upi,
    name: state.payment.name,
    other: state.payment.other,
    adminContact: state.payment.adminContact,
    address: state.payment.address,
  };
  const res = await apiRequest('/settings', 'PUT', payload);
  return res && !res.error;
}

async function toggleFoodStatus() {
  state.foodBookingOpen = document.getElementById('food-status-toggle').checked;
  const txt = document.getElementById('food-status-text');
  txt.textContent = state.foodBookingOpen ? 'OPEN' : 'CLOSED';
  txt.className = 'status-text ' + (state.foodBookingOpen ? 'open' : 'closed');
  await saveSettings();
  showToast('Food booking ' + (state.foodBookingOpen ? 'opened ✅' : 'closed 🔒'));
}
async function toggleHallStatus() {
  state.hallBookingOpen = document.getElementById('hall-status-toggle').checked;
  const txt = document.getElementById('hall-status-text');
  txt.textContent = state.hallBookingOpen ? 'OPEN' : 'CLOSED';
  txt.className = 'status-text ' + (state.hallBookingOpen ? 'open' : 'closed');
  await saveSettings();
  showToast('Hall booking ' + (state.hallBookingOpen ? 'opened ✅' : 'closed 🔒'));
}

// ─── ADMIN MENU ───────────────────────────────────
async function addMenuItem() {
  if (state.menuItems.length >= 200) { showToast('Maximum 200 items reached!'); return; }
  const name = document.getElementById('new-item-name').value.trim();
  const cat  = document.getElementById('new-item-cat').value.trim();
  const price = parseFloat(document.getElementById('new-item-price').value);
  const emoji = document.getElementById('new-item-emoji').value.trim() || '🍽️';
  const avail = document.getElementById('new-item-available').checked;
  
  if (!name || !cat || isNaN(price) || price <= 0) { showToast('Please fill all item fields'); return; }
  
  const newItem = { name, category: cat, price, emoji, available: avail, discount: 0 };
  const saved = await apiRequest('/menu', 'POST', newItem);
  
  if (saved && saved._id) {
    state.menuItems.push(saved);
    renderAdminMenu();
    document.getElementById('new-item-name').value = '';
    document.getElementById('new-item-cat').value = '';
    document.getElementById('new-item-price').value = '';
    document.getElementById('new-item-emoji').value = '';
    showToast('Item added! ✅');
  } else {
    // Error handling is now in apiRequest toast
    console.error('Failed to add item', saved);
  }
}

function renderAdminMenu(filter = '') {
  const list = document.getElementById('admin-menu-list');
  document.getElementById('menu-item-count').textContent = state.menuItems.length;
  const items = state.menuItems.filter(i =>
    i.name.toLowerCase().includes(filter.toLowerCase()) ||
    i.category.toLowerCase().includes(filter.toLowerCase())
  );
  if (!items.length) { list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem">No items found</p>'; return; }

  let html = `<div class="admin-menu-header">
    <span>Item</span><span>Category</span><span>Price (₹)</span><span>Discount (%)</span><span>Available</span><span></span>
  </div>`;
  items.forEach(item => {
    // Map _id for API calls
    const id = item._id; 
    const discount = item.discount || 0;
    html += `
    <div class="admin-menu-row">
      <span class="item-name">${item.emoji} ${item.name}</span>
      <span style="color:var(--text-muted);font-size:0.8rem">${item.category}</span>
      <input type="number" value="${item.price}" min="1" onchange="updateItemPrice('${id}', this.value)" title="Price"/>
      <input type="number" value="${discount}" min="0" max="100" onchange="updateItemDiscount('${id}', this.value)" placeholder="%" title="Discount %"/>
      <div class="avail-toggle">
        <input type="checkbox" ${item.available ? 'checked' : ''} onchange="toggleItemAvail('${id}', this.checked)" id="avail-${id}"/>
        <label for="avail-${id}" style="cursor:pointer">${item.available ? '✅' : '❌'}</label>
      </div>
      <button class="btn-delete" onclick="deleteMenuItem('${id}')" title="Delete"><i class="fas fa-trash"></i></button>
    </div>`;
  });
  list.innerHTML = html;
}

function filterAdminMenu() {
  renderAdminMenu(document.getElementById('admin-menu-search').value);
}
async function updateItemPrice(id, val) {
  const price = parseFloat(val);
  if (isNaN(price)) return;
  const res = await apiRequest(`/menu/${id}`, 'PUT', { price });
  if (res) {
    const item = state.menuItems.find(i => i._id === id);
    if (item) item.price = price;
    showToast('Price updated');
  }
}
async function updateItemDiscount(id, val) {
  const disc = Math.min(100, Math.max(0, parseFloat(val) || 0));
  const res = await apiRequest(`/menu/${id}`, 'PUT', { discount: disc });
  if (res) {
    const item = state.menuItems.find(i => i._id === id);
    if (item) item.discount = disc;
    showToast('Discount updated ✅');
  }
}
async function toggleItemAvail(id, val) {
  const res = await apiRequest(`/menu/${id}`, 'PUT', { available: val });
  if (res) {
    const item = state.menuItems.find(i => i._id === id);
    if (item) item.available = val;
    renderAdminMenu();
    showToast(`Item ${val ? 'enabled' : 'disabled'}`);
  }
}
async function deleteMenuItem(id) {
  if (!confirm('Delete this item?')) return;
  const res = await apiRequest(`/menu/${id}`, 'DELETE');
  if (res && res.success) {
    state.menuItems = state.menuItems.filter(i => i._id !== id);
    renderAdminMenu();
    showToast('Item deleted');
  }
}

// ─── KM PRICES ────────────────────────────────────
function renderKmTable() {
  const el = document.getElementById('km-price-table');
  let html = '';
  state.kmPrices.forEach((k, i) => {
    html += `<div class="km-row">
      <div><label>Up to KM</label><input type="number" value="${k.upTo}" min="1" max="10" onchange="updateKmRange(${i}, 'upTo', this.value)"/></div>
      <div><label>Price (₹/km)</label><input type="number" value="${k.price}" min="1" onchange="updateKmRange(${i}, 'price', this.value)"/></div>
      <button class="btn-delete" onclick="removeKmRow(${i})" style="margin-top:1.2rem"><i class="fas fa-trash"></i></button>
    </div>`;
  });
  el.innerHTML = html;
}
function updateKmRange(index, field, val) {
  state.kmPrices[index][field] = parseFloat(val);
  saveSettings();
}
function addKmRow() {
  state.kmPrices.push({ upTo: 10, price: 50 });
  renderKmTable();
  saveSettings();
}
function removeKmRow(i) {
  state.kmPrices.splice(i, 1);
  renderKmTable();
  saveSettings();
}
function getDeliveryPrice(km) {
  const sorted = [...state.kmPrices].sort((a, b) => a.upTo - b.upTo);
  for (const k of sorted) {
    if (km <= k.upTo) return k.price * km;
  }
  return null;
}

// ─── HALL PRICING ─────────────────────────────────
function renderHallPricing() {
  const mode = document.getElementById('hall-pricing-mode');
  const amt  = document.getElementById('hall-price-amount');
  if (mode) mode.value = state.hallPricingMode;
  if (amt)  amt.value  = state.hallPriceAmount;
  updateHallPricingDisplay();
}
async function updateHallPricing() {
  const mode = document.getElementById('hall-pricing-mode');
  const amt  = document.getElementById('hall-price-amount');
  if (mode) state.hallPricingMode  = mode.value;
  if (amt)  state.hallPriceAmount  = parseFloat(amt.value) || 500;
  updateHallPricingDisplay();
  await saveSettings();
}
function updateHallPricingDisplay() {
  const el = document.getElementById('hall-price-display');
  if (el) {
    el.innerHTML = state.hallPricingMode === 'hour'
      ? `<p><strong>₹${state.hallPriceAmount}</strong> per hour</p>`
      : `<p><strong>₹${state.hallPriceAmount}</strong> per person</p>`;
  }
}

// ─── CABIN ADMIN ─────────────────────────────────
function renderCabinAdmin() {
  const el = document.getElementById('admin-cabin-list');
  let html = '';
  [1,2,3].forEach(n => {
    const bookedCount = Object.values(state.cabinBookings).reduce((acc, arr) => acc + arr.filter(x => x === n).length, 0);
    html += `<div class="cabin-admin-row">
      <div>
        <div class="cabin-admin-name">Cabin ${n}</div>
        <div class="cabin-bookings-today">${bookedCount} total booking(s)</div>
      </div>
      <span class="cabin-badge ${bookedCount > 0 ? 'booked' : 'available'}">${bookedCount > 0 ? 'Has Bookings' : 'Free'}</span>
    </div>`;
  });
  el.innerHTML = html;
}

// ─── PAYMENT INFO ────────────────────────────────
function loadPaymentForm() {
  document.getElementById('pay-upi').value     = state.payment.upi;
  document.getElementById('pay-name').value    = state.payment.name;
  document.getElementById('pay-address').value = state.payment.address;
  document.getElementById('pay-other').value   = state.payment.other;
  document.getElementById('admin-contact').value = state.payment.adminContact;
}
async function savePaymentInfo() {
  state.payment.upi          = document.getElementById('pay-upi').value;
  state.payment.name         = document.getElementById('pay-name').value;
  state.payment.address      = document.getElementById('pay-address').value;
  state.payment.other        = document.getElementById('pay-other').value;
  state.payment.adminContact = document.getElementById('admin-contact').value;
  
  const success = await saveSettings();
  if (success) {
    updateFooterAddress();
    const msg = document.getElementById('pay-save-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
  }
}

// ─── BOOKINGS VIEW ───────────────────────────────
function renderBookings() {
  const fl = document.getElementById('food-bookings-list');
  const hl = document.getElementById('hall-bookings-list');
  if (!fl || !hl) return;
  
  fl.innerHTML = state.foodBookings.length
    ? state.foodBookings.map(b => `<div class="booking-entry">
        <div class="booking-actions">
          <button class="btn-print booking-print" onclick="adminPrintBill('${b._id}', 'food')" title="Print Bill"><i class="fas fa-print"></i></button>
          <button class="btn-delete booking-delete" onclick="deleteFoodBooking('${b._id}')" title="Delete Booking"><i class="fas fa-trash"></i></button>
        </div>
        <strong>${b.name}</strong> — ${b.phone}<br/>
        <span>${b.address}</span><br/>
        <span>Items: ${b.items.map(i => i.name).join(', ')}</span><br/>
        <span>Total: ₹${b.total}</span>
        <div class="b-date">${new Date(b.date).toLocaleString()}</div>
      </div>`).join('')
    : '<p style="color:var(--text-muted);font-size:0.85rem">No food bookings yet.</p>';

  hl.innerHTML = state.hallBookings.length
    ? state.hallBookings.map(b => `<div class="booking-entry">
        <div class="booking-actions">
          <button class="btn-print booking-print" onclick="adminPrintBill('${b._id}', 'hall')" title="Print Bill"><i class="fas fa-print"></i></button>
          <button class="btn-delete booking-delete" onclick="deleteHallBooking('${b._id}')" title="Delete Booking"><i class="fas fa-trash"></i></button>
        </div>
        <strong>${b.name}</strong> — ${b.phone}<br/>
        <span>Function: ${b.functionType}</span><br/>
        <span>Date: ${b.date} | Time: ${b.time} | Cabin: ${b.cabin}</span><br/>
        <span>Members: ${b.members} | Duration: ${b.hours}h</span><br/>
        <span>Total: ₹${b.total}</span>
        <div class="b-date">${new Date(b.bookedAt).toLocaleString()}</div>
      </div>`).join('')
    : '<p style="color:var(--text-muted);font-size:0.85rem">No hall bookings yet.</p>';
}

async function deleteFoodBooking(id) {
  if (!confirm('Are you sure you want to remove this booking? All customer data for this booking will be cleared.')) return;
  const res = await apiRequest(`/bookings/food/${id}`, 'DELETE');
  if (res && res.success) {
    state.foodBookings = state.foodBookings.filter(b => b._id !== id);
    renderBookings();
    showToast('Food booking removed ✅');
  }
}

async function deleteHallBooking(id) {
  if (!confirm('Are you sure you want to remove this booking? All customer data for this booking will be cleared.')) return;
  const res = await apiRequest(`/bookings/hall/${id}`, 'DELETE');
  if (res && res.success) {
    state.hallBookings = state.hallBookings.filter(b => b._id !== id);
    // Refresh cabin availability by reloading data
    await loadAllData();
    renderBookings();
    showToast('Hall booking removed ✅');
  }
}

function adminPrintBill(id, type) {
  let booking = null;
  if (type === 'food') {
    booking = state.foodBookings.find(b => b._id === id);
    if (booking) {
      state.currentBill = {
        type: 'food',
        ...booking,
        date: new Date(booking.date).toLocaleString()
      };
    }
  } else {
    booking = state.hallBookings.find(b => b._id === id);
    if (booking) {
      state.currentBill = {
        type: 'hall',
        ...booking,
        bookedAt: new Date(booking.bookedAt).toLocaleString()
      };
    }
  }

  if (state.currentBill) {
    showBillModal();
  } else {
    showToast('⚠️ Booking not found!');
  }
}

// ─── FOOD USER ───────────────────────────────────
function initFoodUser() {
  const closed = document.getElementById('food-booking-closed');
  const wrap   = document.getElementById('food-form-wrap');
  if (!state.foodBookingOpen) {
    closed.classList.remove('hidden');
    wrap.style.opacity = '0.4';
    wrap.style.pointerEvents = 'none';
  } else {
    closed.classList.add('hidden');
    wrap.style.opacity = '1';
    wrap.style.pointerEvents = '';
  }
  renderMenuUser();
  renderCart();
}

function checkDistance() {
  const val = parseFloat(document.getElementById('fu-distance').value);
  const err = document.getElementById('distance-error');
  if (val > 10) {
    err.classList.remove('hidden');
  } else {
    err.classList.add('hidden');
  }
  updateCartBill();
}

function renderMenuUser(filter = '', activeCat = state.activeCat) {
  const cats = ['All', ...new Set(state.menuItems.map(i => i.category))];
  const tabsEl = document.getElementById('cat-tabs');
  tabsEl.innerHTML = cats.map(c =>
    `<button class="cat-tab ${c === activeCat ? 'active' : ''}" onclick="setActiveCat('${c}')">${c}</button>`
  ).join('');

  const items = state.menuItems.filter(i => {
    const matchCat  = activeCat === 'All' || i.category === activeCat;
    const matchSrch = i.name.toLowerCase().includes(filter.toLowerCase());
    return matchCat && matchSrch;
  });

  const el = document.getElementById('menu-list');
  if (!items.length) { el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem">No items found</p>'; return; }

  el.innerHTML = items.map(item => {
    const id = item._id;
    const qty = state.cart[id]?.qty || 0;
    const discPrice = item.discount > 0 ? Math.round(item.price * (1 - item.discount / 100)) : item.price;
    return `
    <div class="menu-item ${!item.available ? 'unavailable' : ''}">
      <div class="menu-item-left">
        <span class="menu-emoji">${item.emoji}</span>
        <div>
          <div class="menu-name">${item.name} ${!item.available ? '<span class="menu-unavail-tag">Unavailable</span>' : ''}</div>
          <div class="menu-cat">${item.category}</div>
        </div>
      </div>
      <div class="menu-item-right">
        <div>
          <span class="menu-price">₹${discPrice}</span>
          ${item.discount > 0 ? `<span class="discount-tag">${item.discount}% off</span>` : ''}
          ${item.discount > 0 ? `<div style="font-size:0.72rem;color:var(--text-muted);text-decoration:line-through">₹${item.price}</div>` : ''}
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCart('${id}', -1)">−</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" onclick="updateCart('${id}', 1)">+</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function setActiveCat(cat) {
  state.activeCat = cat;
  renderMenuUser(document.getElementById('menu-search').value, cat);
}
function filterMenu() {
  renderMenuUser(document.getElementById('menu-search').value, state.activeCat);
}

function updateCart(itemId, delta) {
  const item = state.menuItems.find(i => i._id === itemId);
  if (!item || !item.available) return;
  if (!state.cart[itemId]) state.cart[itemId] = { item, qty: 0 };
  state.cart[itemId].qty = Math.max(0, state.cart[itemId].qty + delta);
  if (state.cart[itemId].qty === 0) delete state.cart[itemId];
  renderMenuUser(document.getElementById('menu-search').value, state.activeCat);
  renderCart();
}

function renderCart() {
  const cartItems = Object.values(state.cart);
  const countEl = document.getElementById('cart-count');
  countEl.textContent = cartItems.reduce((a, c) => a + c.qty, 0);

  const listEl = document.getElementById('cart-items-list');
  if (!cartItems.length) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:0.5rem">No items selected yet</p>';
    document.getElementById('bill-totals').style.display = 'none';
    return;
  }

  listEl.innerHTML = cartItems.map(({ item, qty }) => {
    const discPrice = item.discount > 0 ? Math.round(item.price * (1 - item.discount / 100)) : item.price;
    return `<div class="cart-item-row">
      <div>
        <div class="cart-item-name">${item.emoji} ${item.name}</div>
        <div class="cart-item-detail">₹${discPrice} × ${qty}</div>
      </div>
      <span class="cart-item-price">₹${discPrice * qty}</span>
    </div>`;
  }).join('');

  updateCartBill();
}

function updateCartBill() {
  const cartItems = Object.values(state.cart);
  if (!cartItems.length) { document.getElementById('bill-totals').style.display = 'none'; return; }

  const originalSubtotal = cartItems.reduce((a, { item, qty }) => a + item.price * qty, 0);
  const discount = cartItems.reduce((a, { item, qty }) => {
    const saved = item.discount > 0 ? Math.round(item.price * item.discount / 100) * qty : 0;
    return a + saved;
  }, 0);

  const discountedSubtotal = originalSubtotal - discount;
  const km  = parseFloat(document.getElementById('fu-distance')?.value) || 0;
  const del = km > 0 && km <= 10 ? (getDeliveryPrice(km) || 0) : 0;
  const rateUsed = km > 0 ? (del / km || 0).toFixed(0) : 20;
  const total = discountedSubtotal + del;

  document.getElementById('bill-totals').style.display = '';
  document.getElementById('b-subtotal').textContent = `₹${originalSubtotal}`;
  document.getElementById('b-km').textContent        = km || 0;
  document.getElementById('b-rate').textContent      = rateUsed;
  document.getElementById('b-delivery').textContent  = `₹${del}`;
  document.getElementById('b-discount').textContent  = `-₹${discount}`;
  document.getElementById('b-total').textContent     = `₹${total}`;

  const unavailItems = cartItems.filter(({ item }) => !item.available);
  let payHtml = `<strong><i class="fas fa-credit-card"></i> Payment Options</strong><br/>
    UPI: <strong>${state.payment.upi}</strong> (${state.payment.name})<br/>
    ${state.payment.other}`;
  if (unavailItems.length) {
    payHtml += `<br/><br/>⚠️ Some items may be unavailable. Admin will contact you within <strong>30 mins</strong>: <strong>${state.payment.adminContact}</strong>`;
  }
  document.getElementById('payment-info').innerHTML = payHtml;
}

async function confirmFoodBooking() {
  if (!state.foodBookingOpen) { showToast('Food booking is currently closed'); return; }
  const name  = document.getElementById('fu-name').value.trim();
  const phone = document.getElementById('fu-phone').value.trim();
  const addr  = document.getElementById('fu-address').value.trim();
  const km    = parseFloat(document.getElementById('fu-distance').value);
  const mapUrl= document.getElementById('fu-map').value.trim();

  if (!name || !phone || !addr)    { showToast('Please fill all required fields'); return; }
  if (!km || km <= 0)              { showToast('Please enter a valid distance'); return; }
  if (km > 10)                     { showToast('Delivery not available beyond 10 KM'); return; }
  if (!Object.keys(state.cart).length) { showToast('Please select at least one item'); return; }

  const cartItems = Object.values(state.cart);
  const originalSubtotal = cartItems.reduce((a, { item, qty }) => a + item.price * qty, 0);
  const discount = cartItems.reduce((a, { item, qty }) => {
    return a + (item.discount > 0 ? Math.round(item.price * item.discount / 100) * qty : 0);
  }, 0);
  const del   = getDeliveryPrice(km) || 0;
  const total = (originalSubtotal - discount) + del;

  const bookingData = { 
    name, phone, address: addr, km, mapUrl, 
    items: cartItems.map(c => ({ name: c.item.name, qty: c.qty, price: c.item.price })), 
    subtotal: originalSubtotal, discount, delivery: del, total 
  };
  
  const saved = await apiRequest('/bookings/food', 'POST', bookingData);
  if (saved && saved._id) {
    state.currentBill = { type: 'food', ...saved, date: new Date(saved.date).toLocaleString() };
    state.cart = {};
    renderMenuUser();
    renderCart();
    showBillModal();
  } else {
    console.error('Failed to save food booking', saved);
  }
}

// ─── HALL USER ───────────────────────────────────
function initHallUser() {
  const closed = document.getElementById('hall-booking-closed');
  const wrap   = document.getElementById('hall-form-wrap');
  if (!state.hallBookingOpen) {
    closed.classList.remove('hidden');
    wrap.style.opacity = '0.4';
    wrap.style.pointerEvents = 'none';
  } else {
    closed.classList.add('hidden');
    wrap.style.opacity = '1';
    wrap.style.pointerEvents = '';
  }
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('hu-date').min = tomorrow.toISOString().split('T')[0];
  updateHallPricingDisplay();
}

function checkCabinAvailability() {
  const date = document.getElementById('hu-date').value;
  if (!date) return;
  const booked = state.cabinBookings[date] || [];
  const slots = document.querySelectorAll('[id^="cabin-slot-"]');
  slots.forEach((sl, i) => {
    const n = i + 1;
    const badge = sl.querySelector('.cabin-badge');
    if (booked.includes(n)) {
      badge.className = 'cabin-badge booked';
      badge.textContent = 'Booked';
    } else {
      badge.className = 'cabin-badge available';
      badge.textContent = 'Available';
    }
  });

  const msg = document.getElementById('cabin-status-msg');
  if (booked.length >= 3) {
    msg.innerHTML = '<div class="alert-box warning"><i class="fas fa-exclamation-triangle"></i> All 3 cabins are fully booked on this date! Please choose a different date.</div>';
  } else {
    msg.innerHTML = `<div class="alert-box info"><i class="fas fa-check-circle"></i> ${3 - booked.length} cabin(s) available on this date.</div>`;
  }
}

function getNextAvailCabin(date) {
  const booked = state.cabinBookings[date] || [];
  for (let i = 1; i <= 3; i++) {
    if (!booked.includes(i)) return i;
  }
  return null;
}

async function confirmHallBooking() {
  if (!state.hallBookingOpen) { showToast('Hall booking is currently closed'); return; }
  const name     = document.getElementById('hu-name').value.trim();
  const phone    = document.getElementById('hu-phone').value.trim();
  const funcType = document.getElementById('hu-function').value;
  const date     = document.getElementById('hu-date').value;
  const time     = document.getElementById('hu-time').value;
  const hours    = parseInt(document.getElementById('hu-hours').value);
  const members  = parseInt(document.getElementById('hu-members').value);

  if (!name || !phone || !funcType || !date || !time || !hours || !members) {
    showToast('Please fill all required fields'); return;
  }

  const booked = state.cabinBookings[date] || [];
  if (booked.length >= 3) { showToast('All cabins fully booked for this date!'); return; }

  const cabin = getNextAvailCabin(date);
  if (!cabin) { showToast('No cabin available'); return; }

  let total = 0;
  if (state.hallPricingMode === 'hour')   total = state.hallPriceAmount * hours;
  if (state.hallPricingMode === 'person') total = state.hallPriceAmount * members;

  const bookingData = { name, phone, functionType: funcType, date, time, hours, members, cabin, total };
  const saved = await apiRequest('/bookings/hall', 'POST', bookingData);
  
  if (saved && saved._id) {
    if (!state.cabinBookings[date]) state.cabinBookings[date] = [];
    state.cabinBookings[date].push(cabin);
    state.currentBill = { type: 'hall', ...saved, bookedAt: new Date(saved.bookedAt).toLocaleString() };
    checkCabinAvailability();
    showBillModal();
  } else {
    console.error('Failed to save hall booking', saved);
  }
}

// ─── BILL MODAL & PDF & TOASTS ───
// (Keep existing showBillModal, printBill, downloadPDF, showToast logic)
// Just ensure state.payment.address and state.payment.upi are used from state.

function showBillModal() {
  const b = state.currentBill;
  let html = '';

  if (b.type === 'food') {
    const unavail = b.items.filter(i => {
      const it = state.menuItems.find(m => m.name === i.name);
      return it && !it.available;
    });
    html = `
    <div class="bill-header">
      <h2>🍽️ Bhaiya Restaurant</h2>
      <p style="font-size:0.85rem;margin-bottom:0.2rem">${state.payment.address}</p>
      <p>Food Order Bill</p>
      <p style="font-size:0.78rem;margin-top:0.3rem">${b.date}</p>
    </div>
    <div class="bill-section">
      <h4>Customer Details</h4>
      <div class="bill-item-row"><span>Name</span><span><strong>${b.name}</strong></span></div>
      <div class="bill-item-row"><span>Phone</span><span>${b.phone}</span></div>
      <div class="bill-item-row"><span>Address</span><span>${b.address}</span></div>
      <div class="bill-item-row"><span>Distance</span><span>${b.km} KM</span></div>
      ${b.mapUrl ? `<div class="bill-item-row"><span>Map</span><span style="word-break:break-all;font-size:0.75rem">${b.mapUrl}</span></div>` : ''}
    </div>
    <div class="bill-section">
      <h4>Order Items</h4>
      ${b.items.map(i => `<div class="bill-item-row"><span>${i.name} × ${i.qty}</span><span>₹${i.price * i.qty}</span></div>`).join('')}
    </div>
    <div class="bill-total-box">
      <div class="bill-item-row"><span>Original Subtotal</span><span>₹${b.subtotal}</span></div>
      <div class="bill-item-row" style="color:var(--success)"><span>Total Discount</span><span>-₹${b.discount}</span></div>
      <div class="bill-item-row"><span>Delivery (${b.km} KM)</span><span>₹${b.delivery}</span></div>
      <div class="bill-grand-total" style="margin-top:0.5rem;padding-top:0.5rem;border-top:2px solid var(--gold)">
        <span>GRAND TOTAL</span><span>₹${b.total}</span>
      </div>
    </div>
    <div class="bill-pay-info">
      <strong>Payment Details</strong><br/>
      UPI: ${state.payment.upi} (${state.payment.name})<br/>
      ${state.payment.other}
    </div>
    ${unavail.length ? `<div class="bill-pay-info" style="border-color:#c0392b;background:#fff5f5;color:var(--crimson)">
      ⚠️ Some items may not be available. Admin will contact you within <strong>30 minutes</strong>: <strong>${state.payment.adminContact}</strong>
    </div>` : ''}
    <div class="bill-notice">⚠️ Once booking is confirmed, it CANNOT be cancelled. 100% payment is mandatory.</div>`;
  }

  if (b.type === 'hall') {
    html = `
    <div class="bill-header">
      <h2>🎉 Bhaiya Restaurant</h2>
      <p style="font-size:0.85rem;margin-bottom:0.2rem">${state.payment.address}</p>
      <p>Hall / Cabin Booking Bill</p>
      <p style="font-size:0.78rem;margin-top:0.3rem">${b.bookedAt}</p>
    </div>
    <div class="bill-section">
      <h4>Booking Details</h4>
      <div class="bill-item-row"><span>Name</span><span><strong>${b.name}</strong></span></div>
      <div class="bill-item-row"><span>Phone</span><span>${b.phone}</span></div>
      <div class="bill-item-row"><span>Function</span><span>${b.functionType}</span></div>
      <div class="bill-item-row"><span>Date</span><span>${b.date}</span></div>
      <div class="bill-item-row"><span>Time</span><span>${b.time}</span></div>
      <div class="bill-item-row"><span>Duration</span><span>${b.hours} hour(s)</span></div>
      <div class="bill-item-row"><span>Total Members</span><span>${b.members}</span></div>
      <div class="bill-item-row"><span>Cabin Assigned</span><span><strong>Cabin ${b.cabin}</strong></span></div>
    </div>
    <div class="bill-total-box">
      <div class="bill-item-row">
        <span>${state.hallPricingMode === 'hour' ? `₹${state.hallPriceAmount} × ${b.hours} hrs` : `₹${state.hallPriceAmount} × ${b.members} persons`}</span>
        <span>₹${b.total}</span>
      </div>
      <div class="bill-grand-total" style="margin-top:0.5rem;padding-top:0.5rem;border-top:2px solid var(--gold)">
        <span>TOTAL AMOUNT</span><span>₹${b.total}</span>
      </div>
    </div>
    <div class="bill-pay-info" style="margin-top:0.75rem">
      ⚠️ Extra time charges will be applied manually by admin.<br/>
      Payment: ${state.payment.upi} | ${state.payment.other}
    </div>
    <div class="bill-notice">⚠️ Book your cabin at least 24 hours in advance. Booking is non-refundable once confirmed.</div>`;
  }

  document.getElementById('bill-printable').innerHTML = html;
  document.getElementById('bill-modal').classList.remove('hidden');
}

function closeBillModal() {
  document.getElementById('bill-modal').classList.add('hidden');
}

function printBill() {
  window.print();
}

function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const b = state.currentBill;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(139, 26, 26);
  doc.text('Bhaiya Restaurant', 105, 18, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(state.payment.address, 105, 24, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 60, 20);
  doc.text(b.type === 'food' ? 'Food Order Bill' : 'Hall / Cabin Booking Bill', 105, 30, { align: 'center' });

  doc.setDrawColor(201, 150, 43);
  doc.setLineWidth(0.7);
  doc.line(15, 34, 195, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 20, 0);

  let y = 42;

  if (b.type === 'food') {
    doc.setFont('helvetica', 'bold'); doc.text('Customer Details', 15, y); y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${b.name}`, 15, y); y += 6;
    doc.text(`Phone: ${b.phone}`, 15, y); y += 6;
    doc.text(`Address: ${b.address}`, 15, y); y += 6;
    doc.text(`Distance: ${b.km} KM`, 15, y); y += 10;

    doc.setFont('helvetica', 'bold'); doc.text('Order Items', 15, y); y += 7;
    doc.setFont('helvetica', 'normal');
    b.items.forEach(i => {
      doc.text(`${i.name} x${i.qty}`, 15, y);
      doc.text(`Rs.${i.price * i.qty}`, 170, y, { align: 'right' }); y += 6;
    });
    y += 4;
    doc.setDrawColor(201, 150, 43); doc.line(15, y, 195, y); y += 6;
    doc.text(`Original Subtotal:`, 15, y);      doc.text(`Rs.${b.subtotal}`, 170, y, { align: 'right' }); y += 6;
    doc.text(`Total Discount:`, 15, y);      doc.text(`-Rs.${b.discount}`, 170, y, { align: 'right' }); y += 6;
    doc.text(`Delivery Charge:`, 15, y);      doc.text(`Rs.${b.delivery}`, 170, y, { align: 'right' }); y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL AMOUNT:`, 15, y);         doc.text(`Rs.${b.total}`, 170, y, { align: 'right' }); y += 10;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`UPI: ${state.payment.upi} | ${state.payment.other}`, 15, y); y += 8;
    doc.setTextColor(139, 26, 26);
    doc.text('NOTE: Once confirmed, booking CANNOT be cancelled. 100% payment is mandatory.', 15, y);
  }

  if (b.type === 'hall') {
    doc.setFont('helvetica', 'bold'); doc.text('Hall Booking Details', 15, y); y += 7;
    doc.setFont('helvetica', 'normal');
    [['Name', b.name], ['Phone', b.phone], ['Function', b.functionType], ['Date', b.date], ['Time', b.time], ['Duration', `${b.hours} hour(s)`], ['Members', b.members], ['Cabin', `Cabin ${b.cabin}`]].forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 15, y); y += 6;
    });
    y += 4;
    doc.setDrawColor(201, 150, 43); doc.line(15, y, 195, y); y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL AMOUNT:', 15, y); doc.text(`Rs.${b.total}`, 170, y, { align: 'right' }); y += 10;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.setTextColor(139, 26, 26);
    doc.text('NOTE: Extra time charges applied manually. Booking is non-refundable.', 15, y);
  }

  doc.save(`bhaiya-restaurant-bill-${Date.now()}.pdf`);
  showToast('PDF downloaded! 📄');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

function updateFooterAddress() {
  const el = document.getElementById('footer-address');
  if (el) el.textContent = state.payment.address;
}

// ─── INIT ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllData();
});
