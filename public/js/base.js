
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, update, push, remove, set, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6yOigzXV0sydLgzc7u_RwvXq7WR385xs",
  authDomain: "lolifya-app.firebaseapp.com",
  databaseURL: "https://lolifya-app-default-rtdb.firebaseio.com",
  projectId: "lolifya-app",
  storageBucket: "lolifya-app.firebasestorage.app",
  messagingSenderId: "632721091270",
  appId: "1:632721091270:web:1919e005b5c361a45385c7",
  measurementId: "G-TZDZBJZKLG"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
export { ref, onValue, update, push, remove, set };

// expose `get` for one-time reads
export { get };

// Create a helper to upload a payment proof (base64) as a pending recharge
window.uploadPaymentProof = async function(file, amount) {
  if (!file) return false;
  try {
    const user = window.ADDUXSHOP?.currentUser;
    if (!user) { showToast('Debes iniciar sesión', 'error'); return false; }

    // check existing pending for this user
    const pendingRef = ref(database, 'pendingRecharges');
    const snapshot = await get(pendingRef);
    let hasPending = false;
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const val = child.val();
        if (val && val.userId === user.uid && val.status === 'pending') hasPending = true;
      });
    }
    if (hasPending) { showToast('Ya tienes una recarga pendiente. Espera a que sea revisada.', 'warning'); return false; }

    // read file as base64
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsDataURL(file);
    });

    const amountNum = Number(amount) || 0;
    const pendingData = {
      userId: user.uid,
      username: window.ADDUXSHOP.userData?.username || null,
      email: window.ADDUXSHOP.userData?.email || null,
      amount: amountNum,
      imageBase64: dataUrl,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await push(ref(database, 'pendingRecharges'), pendingData);

    showToast('Recarga enviada como pendiente. Espera la validación del admin.', 'success');
    return true;
  } catch (err) {
    console.error('uploadPaymentProof error:', err);
    showToast('Error al subir la comprobante', 'error');
    return false;
  }
};

window.ADDUXSHOP = window.ADDUXSHOP || {
  currentUser: null,
  userCoins: 0,
  cart: [],
  isAdmin: false,
  authReady: false,
  userData: null
};

// Notifications: listen for broadcast and personal notifications
function initNotificationListeners() {
  // broadcast notifications
  try {
    const broadcastRef = ref(database, 'notifications/broadcast');
    onValue(broadcastRef, (snapshot) => {
      if (!snapshot.exists()) return;
      snapshot.forEach(child => {
        const n = child.val();
        handleIncomingNotification(n);
      });
    });
  } catch (err) { console.warn('broadcast notif listener error', err); }

  // per-user notifications (optional)
  window.addEventListener('authStateChanged', (e) => {
    const user = window.ADDUXSHOP.currentUser;
    if (!user) return;
    try {
      const userRef = ref(database, `notifications/user/${user.uid}`);
      onValue(userRef, (snapshot) => {
        if (!snapshot.exists()) return;
        snapshot.forEach(child => {
          const n = child.val();
          handleIncomingNotification(n);
        });
      });
    } catch (err) { console.warn('user notif listener error', err); }
  });
}

function handleIncomingNotification(n) {
  try {
    const title = n.title || 'Notificación';
    const body = n.message || '';
    const type = n.type || 'info';
    const isHeader = !!n.header;
    const isPush = !!n.push;

    // Header/in-app notifications (broadcast) — show toast when header flag is present
    if (isHeader) {
      try { showToast(body, type); } catch(e){}
    }

    // Push notifications (per-user) — show native browser notification only when allowed
    if (isPush) {
      const localAllowed = (window.ADDUXSHOP.userData && window.ADDUXSHOP.userData.notificationsAllowed) || localStorage.getItem('addux_notify_allowed') === 'true';
      if (Notification && Notification.permission === 'granted' && localAllowed) {
        try { new Notification(title, { body, icon: n.icon || '/imagenes/logo-shop.png' }); } catch(e) { console.warn('notification show error', e); }
      }
      // also show in-app toast for push as a fallback
      try { showToast(body, type); } catch(e){}
    }

    // Backwards compatibility: if no flags present, show a simple toast
    if (!isHeader && !isPush) {
      try { showToast(body, type); } catch(e){}
    }
  } catch (err) { console.error('handleIncomingNotification error', err); }
}

// initialize listeners once auth is ready
window.addEventListener('authStateChanged', () => {
  // ensure only initialized once
  if (!window._addux_notif_init) { initNotificationListeners(); window._addux_notif_init = true; }
});

// Expose helper to sign in with custom token (used by admin login flow)
window.signInWithCustomToken = async function(token) {
  try {
    if (!token) return false;
    await signInWithCustomToken(auth, token);
    return true;
  } catch (err) {
    console.error('signInWithCustomToken error:', err);
    return false;
  }
};

// Update user's notifications preference in DB
window.setNotificationsAllowed = async function(allowed) {
  try {
    const user = window.ADDUXSHOP?.currentUser;
    if (!user) return false;
    const userRef = ref(database, `users/${user.uid}`);
    await update(userRef, { notificationsAllowed: !!allowed, updatedAt: new Date().toISOString() });
    // also update local cache
    if (window.ADDUXSHOP.userData) window.ADDUXSHOP.userData.notificationsAllowed = !!allowed;
    return true;
  } catch (err) {
    console.warn('setNotificationsAllowed error', err);
    return false;
  }
};


window.CasparinaShop = window.ADDUXSHOP;

(function migrateLocalStorageKeys(){
  try {
    const oldKey = 'casparina_cart';
    const newKey = 'adduxshop_cart';
    const oldVal = localStorage.getItem(oldKey);
    const newVal = localStorage.getItem(newKey);
    if (!newVal && oldVal) {
      localStorage.setItem(newKey, oldVal);
    }
    const cartData = localStorage.getItem(newKey) || localStorage.getItem(oldKey);
    try { window.ADDUXSHOP.cart = cartData ? JSON.parse(cartData) : []; } catch (e) { window.ADDUXSHOP.cart = []; }

    window.CasparinaShop = window.ADDUXSHOP;
  } catch (err) {
    console.warn('LocalStorage migration error:', err);
  }
})();

initThemeListener();

let authInitialized = false;
let initialAuthComplete = false;

onAuthStateChanged(auth, (user) => {

  if (!authInitialized) {
    authInitialized = true;
    initialAuthComplete = false;

    const protectedPages = ["perfil", "carrito-compra"];
    const currentPage = window.location.pathname.split("/").pop();
    const isProtectedPage = protectedPages.includes(currentPage);

    if (isProtectedPage) showAuthLoader();

    if (user) {
      window.ADDUXSHOP.currentUser = user;
      loadUserData();
    } else {
      window.ADDUXSHOP.currentUser = null;
      window.ADDUXSHOP.userCoins = 0;
      window.ADDUXSHOP.isAdmin = false;
      window.ADDUXSHOP.userData = null;
    }

    updateUI();
    window.ADDUXSHOP.authReady = true;
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: window.ADDUXSHOP.currentUser } }));

    if (isProtectedPage) {
      setTimeout(() => {
        initialAuthComplete = true;
        hideAuthLoader();
        const currentUser = window.ADDUXSHOP.currentUser;
        if (!currentUser) window.location.href = "/login";
      }, 400);
    } else {
      initialAuthComplete = true;
    }

    return;
  }

  if (user) {
    window.ADDUXSHOP.currentUser = user;
    loadUserData();
  } else {
    window.ADDUXSHOP.currentUser = null;
    window.ADDUXSHOP.userCoins = 0;
    window.ADDUXSHOP.isAdmin = false;
    window.ADDUXSHOP.userData = null;
  }

  updateUI();
  window.ADDUXSHOP.authReady = true;
  window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: window.ADDUXSHOP.currentUser } }));

  const protectedPages = ["perfil", "carrito-compra", "panel"];
  const currentPage = window.location.pathname.split("/").pop();
  if (protectedPages.includes(currentPage) && !user) {
    window.location.href = "/login";
  }
});

function loadUserData() {
  if (!window.ADDUXSHOP.currentUser) return;
  const userId = window.ADDUXSHOP.currentUser.uid;
  const userRef = ref(database, `users/${userId}`);
  onValue(userRef, (snapshot) => {
    const userData = snapshot.val();
    if (userData) {
      window.ADDUXSHOP.userData = userData;
      window.ADDUXSHOP.userCoins = userData.coins || 0;
      window.ADDUXSHOP.isAdmin = userData.role === 'admin';
      updateUI();
      window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: { userData: window.ADDUXSHOP.userData } }));
    }
  });
}

function updateUI() {
  const userCoinsElement = document.getElementById('userCoins');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const profileBtn = document.getElementById('profileBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminBtn = document.getElementById('adminBtn');

  if (userCoinsElement) userCoinsElement.textContent = window.ADDUXSHOP.userCoins;

  if (window.ADDUXSHOP.currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (registerBtn) registerBtn.style.display = 'none';
    if (profileBtn) profileBtn.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'block';
    if (adminBtn && window.ADDUXSHOP.isAdmin) adminBtn.style.display = 'block';
    const heroRegisterBtn = document.querySelector('.hero-buttons .btn-outline');
    if (heroRegisterBtn && heroRegisterBtn.textContent.includes('Crear Cuenta')) heroRegisterBtn.style.display = 'none';
  } else {
    if (loginBtn) loginBtn.style.display = 'block';
    if (registerBtn) registerBtn.style.display = 'block';
    if (profileBtn) profileBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
    const heroRegisterBtn = document.querySelector('.hero-buttons .btn-outline');
    if (heroRegisterBtn && heroRegisterBtn.textContent.includes('Crear Cuenta')) heroRegisterBtn.style.display = 'inline-block';
  }
}

window.showToast = function(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { try { document.body.removeChild(toast); } catch(e){} }, 300); }, 3000);
};

window.showLoader = function() {
  const loader = document.createElement('div'); loader.id = 'globalLoader'; loader.className = 'loader-overlay'; loader.innerHTML = '<div class="loader"></div>'; document.body.appendChild(loader);
};
window.hideLoader = function() { const loader = document.getElementById('globalLoader'); if (loader) loader.remove(); };

window.formatCurrency = function(amount) { return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount); };

window.requireAuth = function() { if (!window.ADDUXSHOP.currentUser) { showToast("Debes iniciar sesión primero", "error"); setTimeout(() => { window.location.href = "/login"; }, 1200); return false; } return true; };
window.requireAdmin = function() { if (!window.ADDUXSHOP.currentUser) { showToast("Debes iniciar sesión primero", "error"); setTimeout(() => { window.location.href = "/login"; }, 1200); return false; } if (!window.ADDUXSHOP.isAdmin) { showToast("No tienes permisos de administrador", "error"); setTimeout(() => { window.location.href = "/"; }, 1200); return false; } return true; };

function showAuthLoader() { const loader = document.createElement('div'); loader.id = 'authLoader'; loader.style.cssText = `position: fixed; top: 0; left: 0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; z-index:99999;`; loader.innerHTML = `<div style="width:50px;height:50px;border:3px solid rgba(0,0,0,0.1);border-top-color:#2b6cb0;border-radius:50%;animation:spin 1s linear infinite"></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`; document.body.appendChild(loader); }
function hideAuthLoader() { const loader = document.getElementById('authLoader'); if (loader) { loader.style.opacity='0'; setTimeout(()=>loader.remove(),300); } }

function protectPage(user) { const protectedPages = ["/perfil","/carrito-compra"]; const currentPage = window.location.pathname.split('/').pop(); if (protectedPages.includes(currentPage) && !user) window.location.href = '/login'; }

function toggleUserMenu() { const dropdown = document.getElementById('userDropdown'); const menuBtn = document.getElementById('userMenuBtn'); if (!dropdown || !menuBtn) return; dropdown.classList.toggle('show'); menuBtn.classList.toggle('active'); }
if (typeof document !== 'undefined') {
  document.addEventListener('click',(e)=>{ const dropdown = document.getElementById('userDropdown'); const menuBtn = document.getElementById('userMenuBtn'); if (dropdown && menuBtn && dropdown.classList.contains('show')) { if (!dropdown.contains(e.target) && !menuBtn.contains(e.target)) { dropdown.classList.remove('show'); menuBtn.classList.remove('active'); } } });
  document.addEventListener('click',(e)=>{ const closeBtn = e.target.closest && e.target.closest('.modal-close'); if (closeBtn) { if (typeof window.closeRechargeModal === 'function') { try{ window.closeRechargeModal(); }catch(err){console.error(err);} } else { const modal = document.getElementById('rechargeModal'); if (modal) modal.style.display='none'; } } });
}

function updateDropdownUsername(username) { const dropdownUsername = document.getElementById('dropdownUsername'); if (dropdownUsername) dropdownUsername.textContent = username; }

function updateSupportLink(username) { const supportLink = document.getElementById('supportWhatsapp'); if (!supportLink) return; const safeName = username || 'usuario'; const message = `Hola, soy *${safeName}* en ADDUXSHOP, necesito ayuda.`; supportLink.href = `https://wa.me/51971541408?text=${encodeURIComponent(message)}`; }

const SUPPORTED_THEMES = ['green-dark'];
const DEFAULT_THEME = 'green-dark';
function applyTheme(themeName){ const root = document.documentElement; const finalName = SUPPORTED_THEMES.includes(themeName)?themeName:DEFAULT_THEME; // remove any theme-* classes
  Array.from(document.documentElement.classList).filter(c=>c.startsWith('theme-')).forEach(c=>document.documentElement.classList.remove(c));
  root.classList.add(`theme-${finalName}`); try{ localStorage.setItem('cas_theme', finalName);}catch(e){} }
function initThemeListener(){ try{ const saved = localStorage.getItem('cas_theme'); if (saved) applyTheme(saved); else applyTheme(DEFAULT_THEME); }catch(e){} const themeRef = ref(database,'settings/theme'); onValue(themeRef,(snapshot)=>{ const value = snapshot.val(); const themeName = typeof value === 'string' ? value : value?.name; if (themeName) applyTheme(themeName); },(err)=>{ console.error('Theme load error:',err); }); }

function updateCoinDisplays(coins) { const coinElements = [ document.getElementById('userCoins'), document.getElementById('userCoinsDesktop'), document.getElementById('navCoins'), document.getElementById('profileCoins') ]; coinElements.forEach(el=>{ if (el) el.textContent = coins; }); }

function initializeNavbar(){ const user = window.ADDUXSHOP?.currentUser; const userData = window.ADDUXSHOP?.userData; const loggedInNav = document.getElementById('loggedInNav'); const loggedOutNav = document.getElementById('loggedOutNav'); if (loggedInNav && loggedOutNav) { if (user && userData) { loggedInNav.style.display='flex'; loggedOutNav.style.display='none'; } else { loggedInNav.style.display='none'; loggedOutNav.style.display='flex'; } }
  if (user && userData) { updateDropdownUsername(userData.username || user.email.split('@')[0]); updateSupportLink(userData.username || user.email.split('@')[0]); updateCoinDisplays(userData.coins || 0); if (window.ADDUXSHOP.isAdmin) { const adminBtns = [ document.getElementById('adminBtn'), document.getElementById('adminDropdownBtn') ]; adminBtns.forEach(btn=>{ if (btn) btn.style.display='block'; }); } }
  if (!user || !userData) updateSupportLink('usuario'); }

if (typeof window !== 'undefined') {
  window.addEventListener('authStateChanged', initializeNavbar);
  window.addEventListener('userDataLoaded', initializeNavbar);
}




function setPaymentMethod(method){ const manualBtn = document.getElementById('methodManualBtn'); const manualSection = document.getElementById('manualSection'); const manualInfo = document.getElementById('manualInfo'); if (manualBtn) { manualBtn.classList.toggle('btn-primary', method==='manual'); manualBtn.classList.toggle('btn-outline', method!=='manual'); } if (manualSection) { manualSection.style.display = method==='manual' ? 'block' : 'none'; manualSection.classList.toggle('active', method==='manual'); } if (manualInfo) manualInfo.style.display = method==='manual' ? manualInfo.style.display : 'none'; }

function toggleManualInfo(show){ const el = document.getElementById('manualInfo'); if (el) el.style.display = show ? 'block' : 'none'; }

 function updateManualInfo(amountPen){
  const manualInfo = document.getElementById('manualInfo');
  const manualAmount = document.getElementById('manualAmount');
  const manualPaidBtn = document.getElementById('manualPaidBtn');
  const manualSection = document.getElementById('manualSection');
  const methodIsManual = manualSection?.classList?.contains('active');
  if (!manualInfo || !manualAmount || !manualPaidBtn) return;
  if (!methodIsManual) { toggleManualInfo(false); return; }
  if (!amountPen || amountPen < 5) { toggleManualInfo(false); manualPaidBtn.disabled = true; return; }

  manualAmount.textContent = amountPen.toFixed(2);
  toggleManualInfo(true);
  manualPaidBtn.disabled = false;

  // New behavior: open file picker and upload proof as pending recharge
  manualPaidBtn.onclick = () => {
    const user = window.ADDUXSHOP?.currentUser;
    if (!user) { showToast('Debes iniciar sesión', 'error'); setTimeout(()=>{ window.location.href = '/login'; }, 1200); return; }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) { showToast('No se seleccionó imagen', 'warning'); return; }
      manualPaidBtn.disabled = true;
      const ok = await window.uploadPaymentProof(file, amountPen);
      if (ok) {
        showToast('Comprobante enviado. Espera la validación del admin.', 'success');
      } else {
        manualPaidBtn.disabled = false;
      }
    };
    document.body.appendChild(fileInput);
    fileInput.click();
    setTimeout(() => { try { document.body.removeChild(fileInput); } catch(e){} }, 60000);
  };
 }

window.openRechargeModal = function(){ const modal = document.getElementById('rechargeModal'); if (modal) { modal.style.display = 'flex'; const input = document.getElementById('customAmount'); if (input) input.value=''; const preview = document.getElementById('amountPreview'); if (preview) preview.style.display='none'; const previewPen = document.getElementById('previewPen'); const previewUsd = document.getElementById('previewUsd'); if (previewPen) previewPen.textContent='S/ 0.00'; if (previewUsd) previewUsd.textContent='USD 0.00'; setPaymentMethod('manual'); toggleManualInfo(false); } };
window.closeRechargeModal = function(){ const modal = document.getElementById('rechargeModal'); if (modal) modal.style.display='none'; const input = document.getElementById('customAmount'); if (input) input.value=''; const preview = document.getElementById('amountPreview'); if (preview) preview.style.display='none'; };

function updateAmountPreview(){ const input = document.getElementById('customAmount'); const preview = document.getElementById('amountPreview'); const previewPen = document.getElementById('previewPen'); const previewUsd = document.getElementById('previewUsd'); if (!input || !preview || !previewPen || !previewUsd) return; const amountPen = parseFloat(input.value); if (!amountPen || amountPen < 5) { preview.style.display='none'; toggleManualInfo(false); return; } const amountUsd = convertPENtoUSD(amountPen); previewPen.textContent = amountPen.toLocaleString('es-PE',{ style:'currency', currency:'PEN' }); previewUsd.textContent = amountUsd.toLocaleString('en-US',{ style:'currency', currency:'USD' }); preview.style.display='block'; updateManualInfo(amountPen); }

window.rechargeCoins = async function(amount){ const user = window.ADDUXSHOP?.currentUser; if (!user) { showToast('Debes iniciar sesión','error'); return; } try { const userId = user.uid; const databaseRef = getDatabase(); const userRef = ref(databaseRef, `users/${userId}`); const currentCoins = window.ADDUXSHOP.userData?.coins || 0; const newCoins = currentCoins + amount; await update(userRef, { coins: newCoins, lastRecharge: new Date().toISOString() }); const rechargeData = { amount: amount, method: 'Paquete Predefinido', status: 'Completado', fecha: new Date().toISOString(), price: getRechargePrice(amount) }; const rechargesRef = ref(databaseRef, `recharges/${userId}`); await push(rechargesRef, rechargeData); showToast(`¡Recargaste ${amount} monedas exitosamente!`, 'success'); closeRechargeModal(); if (window.ADDUXSHOP.userData) window.ADDUXSHOP.userData.coins = newCoins; window.ADDUXSHOP.userCoins = newCoins; updateCoinDisplays(newCoins); } catch (err) { console.error('Error recharging coins:', err); showToast('Error al recargar monedas','error'); } };

window.rechargeCustomAmount = function(){ const customInput = document.getElementById('customAmount'); const customAmount = parseInt(customInput?.value); if (!customAmount || customAmount < 5) { showToast('El monto mínimo es S/ 5.00 PEN (USD 1.39)','error'); return; } if (customAmount > 10000) { showToast('El monto máximo es 10,000 PEN','error'); return; } const user = window.ADDUXSHOP?.currentUser; if (!user) { showToast('Debes iniciar sesión','error'); return; } const manualAmountEl = document.getElementById('manualAmount'); if (manualAmountEl) manualAmountEl.textContent = customAmount.toFixed(2); toggleManualInfo(true); showToast('Monto listo. Sigue las instrucciones de transferencia manual.','success'); };

function getRechargePrice(amount){ const prices = {10:5.00,25:10.00,50:20.00,100:35.00}; return prices[amount] || 0; }

const PEN_TO_USD_RATE = 3.60;
function convertPENtoUSD(penAmount){ return Math.round((penAmount / PEN_TO_USD_RATE) * 100) / 100; }

document.addEventListener('DOMContentLoaded', () => {
  const customInput = document.getElementById('customAmount'); if (customInput) customInput.addEventListener('input', updateAmountPreview);
  const manualBtn = document.getElementById('methodManualBtn'); if (manualBtn) manualBtn.addEventListener('click', ()=>{ setPaymentMethod('manual'); updateAmountPreview(); });
});

window.toggleUserMenu = toggleUserMenu;
window.updateDropdownUsername = updateDropdownUsername;
window.updateCoinDisplays = updateCoinDisplays;
window.initializeNavbar = initializeNavbar;




