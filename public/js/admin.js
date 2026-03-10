

import { database, ref, onValue, auth, update, push, remove, set, get } from './base.js';

let currentEditingProduct = null;
let currentEditingUser = null;
let currentEditingUserCoins = 0;
let products = [];
let users = [];
let ads = [];
let communities = [];
let categories = [];
let accountPools = [];
let currentAccountPoolId = null;
let currentEditingAccountId = null;
let currentEditingAd = null;




async function initializeAdminPanel() {

    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Admin panel initializing...');
    loadAdminData();
    setupEventListeners();
}

function loadAdminData() {
    loadProducts();
    loadCategories();
    loadAccounts();
    loadUsers();
    loadAds();
    loadPromoCodes();
    loadCommunities();
    loadPendingRecharges();
    // setup notification form handler
    const notifForm = document.getElementById('notificationForm');
    if (notifForm) notifForm.addEventListener('submit', handleNotificationSubmit);
    loadStats();
    loadThemeSetting();
}

async function handleNotificationSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('notifTitle')?.value?.trim();
    const message = document.getElementById('notifMessage')?.value?.trim();
    const type = document.getElementById('notifType')?.value || 'info';
    const pushOpt = document.getElementById('optPush')?.checked;
    const headerOpt = document.getElementById('optHeader')?.checked;
    if (!title || !message) return showToast('Completa título y mensaje', 'error');
    showLoader();
    try {
        const payload = { title, message, type, push: !!pushOpt, header: !!headerOpt, createdAt: new Date().toISOString(), author: window.ADDUXSHOP.userData?.username || 'admin' };
        // push to broadcast notifications
        await push(ref(database, 'notifications/broadcast'), payload);
        showToast('Notificación enviada', 'success');
        document.getElementById('notificationForm')?.reset();
    } catch (err) {
        console.error('Error sending notification:', err);
        showToast('Error al enviar notificación', 'error');
    } finally { hideLoader(); }
}

function setupEventListeners() {

    const productForm = document.getElementById('productForm');
    if (productForm) productForm.addEventListener('submit', handleProductSubmit);

    const categoryForm = document.getElementById('categoryForm');
    if (categoryForm) categoryForm.addEventListener('submit', handleCategorySubmit);

    const adForm = document.getElementById('adForm');
    if (adForm) adForm.addEventListener('submit', handleAdSubmit);

    const userForm = document.getElementById('userForm');
    if (userForm) userForm.addEventListener('submit', handleUserSubmit);

    const coinSettingsForm = document.getElementById('coinSettingsForm');
    if (coinSettingsForm) coinSettingsForm.addEventListener('submit', handleCoinSettings);
    
    const generalSettingsForm = document.getElementById('generalSettingsForm');
    if (generalSettingsForm) generalSettingsForm.addEventListener('submit', handleGeneralSettings);

    const promoForm = document.getElementById('promoForm');
    if (promoForm) promoForm.addEventListener('submit', handlePromoSubmit);
    const promoCancelBtn = document.getElementById('promoCancelEditBtn');
    if (promoCancelBtn) promoCancelBtn.addEventListener('click', cancelPromoEdit);

    const communityForm = document.getElementById('communityForm');
    if (communityForm) communityForm.addEventListener('submit', handleCommunitySubmit);

    const accountPoolForm = document.getElementById('accountPoolForm');
    if (accountPoolForm) accountPoolForm.addEventListener('submit', handleAccountPoolSubmit);

    const accountAddForm = document.getElementById('accountAddForm');
    if (accountAddForm) accountAddForm.addEventListener('submit', handleAccountAddSubmit);

    const accountEditForm = document.getElementById('accountEditForm');
    if (accountEditForm) accountEditForm.addEventListener('submit', handleAccountEditSubmit);
}

function loadCategories() {
    console.log('Loading categories from Firebase...');
    const categoriesRef = ref(database, 'categories');
    onValue(categoriesRef, (snapshot) => {
        categories = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                categories.push({ id: child.key, ...child.val() });
            });
        }
        updateCategoriesList();
        populateCategorySelect();
    }, (err) => console.error('Error loading categories:', err));
}

function updateCategoriesList() {
    const el = document.getElementById('categoriesList');
    if (!el) return;
    if (!categories || categories.length === 0) {
        el.innerHTML = '<p>No hay categorías registradas</p>';
        return;
    }
    el.innerHTML = categories.map(c => `
        <div class="category-item">
            <strong>${escapeHtml(c.name)}</strong>
            <div class="category-actions">
                <button class="btn btn-sm btn-outline" onclick="editCategoryWrapper('${c.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategoryWrapper('${c.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function populateCategorySelect() {
    const select = document.getElementById('productCategory');
    if (!select) return;
    select.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'general';
    defaultOpt.textContent = 'General';
    select.appendChild(defaultOpt);
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id || c.slug || c.name;
        opt.textContent = c.name;
        opt.dataset.slug = c.slug || '';
        select.appendChild(opt);
    });
}

async function handleCategorySubmit(e) {
    e.preventDefault();
    const input = document.getElementById('categoryName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return showToast('Nombre de categoría vacío', 'error');
    showLoader();
    try {
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        await push(ref(database, 'categories'), { name, slug, createdAt: new Date().toISOString() });
        showToast('Categoría creada', 'success');
        input.value = '';
    } catch (err) {
        console.error('Error creating category:', err);
        showToast('Error al crear categoría', 'error');
    } finally {
        hideLoader();
    }
}

async function deleteCategory(id) {
    if (!confirm('¿Eliminar esta categoría? Esto no eliminará productos asociados.')) return;
    showLoader();
    try {
        await remove(ref(database, `categories/${id}`));
        showToast('Categoría eliminada', 'success');
    } catch (err) {
        console.error('Error deleting category:', err);
        showToast('Error al eliminar categoría', 'error');
    } finally { hideLoader(); }
}

window.deleteCategoryWrapper = function(id) { deleteCategory(id); };
window.editCategoryWrapper = function(id) { const c = categories.find(x=>x.id===id); if(!c) return; const newName = prompt('Nuevo nombre de categoría', c.name); if(!newName) return; const updates = { name: newName, slug: newName.toLowerCase().replace(/\s+/g,'-'), updatedAt: new Date().toISOString() }; showLoader(); update(ref(database, `categories/${id}`), updates).then(()=>{ showToast('Categoría actualizada','success') }).catch(e=>{console.error(e); showToast('Error al actualizar','error')}).finally(()=>hideLoader()); };

function escapeHtml(str){ return String(str).replace(/[&<>\"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[s]); }

let promoCodes = [];
let currentEditingPromoId = null;

function clampDiscount(val) {
    return Math.min(100, Math.max(1, val));
}

function setPromoFormMode(mode) {
    const heading = document.getElementById('promoFormHeading');
    const submitBtn = document.querySelector('#promoForm button[type="submit"]');
    const cancelBtn = document.getElementById('promoCancelEditBtn');
    const indicator = document.getElementById('promoEditIndicator');
    const isEdit = mode === 'edit';
    if (heading) heading.textContent = isEdit ? 'Editar Código' : 'Crear Código';
    if (submitBtn) submitBtn.textContent = isEdit ? 'Actualizar Código' : 'Guardar Código';
    if (cancelBtn) cancelBtn.style.display = isEdit ? 'inline-flex' : 'none';
    if (indicator) indicator.style.display = isEdit ? 'block' : 'none';
}

function resetPromoForm() {
    const form = document.getElementById('promoForm');
    if (form) form.reset();
    const discountInput = document.getElementById('promoDiscountInput');
    if (discountInput) discountInput.value = '10';
    currentEditingPromoId = null;
    setPromoFormMode('create');
}

function loadPromoCodes() {
    console.log('Loading promo codes from Firebase...');
    const promoRef = ref(database, 'promoCodes');
    onValue(promoRef, (snapshot) => {
        promoCodes = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                promoCodes.push({ id: child.key, ...child.val() });
            });
        }
        updatePromoTable();
    }, (err) => console.error('Error loading promo codes:', err));
}

function updatePromoTable() {
    const tbody = document.getElementById('promoTableBody');
    if (!tbody) return;
    if (!promoCodes || promoCodes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-row">No hay códigos registrados</td></tr>';
        return;
    }

    tbody.innerHTML = promoCodes.map(p => `
        <tr>
            <td>${p.code}</td>
            <td>${p.discount}%</td>
            <td>${formatDate(p.createdAt || '')}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="startPromoEditWrapper('${p.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deletePromoWrapper('${p.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function handlePromoSubmit(e) {
    e.preventDefault();
    const codeInput = document.getElementById('promoCodeInput');
    const discountInput = document.getElementById('promoDiscountInput');
    if (!codeInput || !discountInput) return;

    const code = codeInput.value.trim().toUpperCase();
    const discount = clampDiscount(parseInt(discountInput.value, 10) || 0);
    if (!code || discount <= 0) return showToast('Código o descuento inválido', 'error');

    showLoader();
    try {
        if (currentEditingPromoId) {
            await update(ref(database, `promoCodes/${currentEditingPromoId}`), {
                code,
                discount,
                updatedAt: new Date().toISOString()
            });
            showToast('Código promocional actualizado', 'success');
        } else {
            const promoData = { code, discount, createdAt: new Date().toISOString() };
            await push(ref(database, 'promoCodes'), promoData);
            showToast('Código promocional creado', 'success');
        }
        resetPromoForm();
    } catch (err) {
        console.error('Error saving promo code:', err);
        showToast('Error al guardar código', 'error');
    } finally {
        hideLoader();
    }
}

function startPromoEdit(promoId) {
    const promo = promoCodes.find(p => p.id === promoId);
    if (!promo) return;
    currentEditingPromoId = promoId;
    const codeInput = document.getElementById('promoCodeInput');
    const discountInput = document.getElementById('promoDiscountInput');
    if (codeInput) codeInput.value = promo.code || '';
    if (discountInput) discountInput.value = promo.discount || 0;
    setPromoFormMode('edit');
    const form = document.getElementById('promoForm');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelPromoEdit() {
    resetPromoForm();
}

async function deletePromo(id) {
    if (!confirm('Eliminar este código promocional?')) return;
    showLoader();
    try {
        await remove(ref(database, `promoCodes/${id}`));
        showToast('Código eliminado', 'success');
    } catch (err) {
        console.error('Error deleting promo:', err);
        showToast('Error al eliminar código', 'error');
    } finally {
        hideLoader();
    }
}

window.showPromoForm = function() {
    const el = document.getElementById('promos-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
};
window.startPromoEditWrapper = function(id) { startPromoEdit(id); };
window.deletePromoWrapper = function(id) { deletePromo(id); };

async function handleCommunitySubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('communityName');
    const typeSelect = document.getElementById('communityType');
    const linkInput = document.getElementById('communityLink');
    if (!nameInput || !typeSelect || !linkInput) return;

    const name = nameInput.value.trim();
    const type = typeSelect.value;
    const link = linkInput.value.trim();
    if (!name || !type || !link) return showToast('Completa todos los campos', 'error');

    showLoader();
    try {
        await push(ref(database, 'communities'), {
            name,
            type,
            link,
            createdAt: new Date().toISOString()
        });
        showToast('Comunidad guardada', 'success');
        e.target.reset();
    } catch (err) {
        console.error('Error saving community:', err);
        showToast('Error al guardar la comunidad', 'error');
    } finally {
        hideLoader();
    }
}

function loadCommunities() {
    const commRef = ref(database, 'communities');
    onValue(commRef, (snapshot) => {
        communities = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                communities.push({ id: child.key, ...child.val() });
            });
        }
        updateCommunitiesList();
    }, (err) => console.error('Error loading communities:', err));
}

function updateCommunitiesList() {
    const list = document.getElementById('communitiesList');
    if (!list) return;
    if (!communities || communities.length === 0) {
        list.innerHTML = 'Aún no hay comunidades';
        return;
    }

    const typeLabel = { whatsapp: 'WhatsApp', discord: 'Discord', telegram: 'Telegram' };
    list.innerHTML = communities.map(c => {
        const type = (c.type || 'whatsapp').toLowerCase();
        const badge = typeLabel[type] || 'Comunidad';
        const safeName = escapeHtml(c.name || 'Comunidad');
        const safeLink = escapeHtml(c.link || '#');
        return `
            <div class="community-card">
                <div class="community-header">
                    <span class="community-name">${safeName}</span>
                    <span class="community-type ${type}">${badge}</span>
                </div>
                <div class="community-actions">
                    <a class="btn btn-sm btn-primary" href="${safeLink}" target="_blank" rel="noopener">Entrar</a>
                    <button class="btn btn-sm btn-danger" onclick="deleteCommunity('${c.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

async function deleteCommunity(id) {
    if (!confirm('¿Eliminar esta comunidad?')) return;
    showLoader();
    try {
        await remove(ref(database, `communities/${id}`));
        showToast('Comunidad eliminada', 'success');
    } catch (err) {
        console.error('Error deleting community:', err);
        showToast('Error al eliminar la comunidad', 'error');
    } finally {
        hideLoader();
    }
}

// Pending recharges
let pendingRecharges = [];

function loadPendingRecharges() {
    const pendingRef = ref(database, 'pendingRecharges');
    console.log('Listening to pendingRecharges...');
    onValue(pendingRef, (snapshot) => {
        pendingRecharges = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                pendingRecharges.push({ id: child.key, ...child.val() });
            });
        }
        console.log('pendingRecharges snapshot, count=', pendingRecharges.length, snapshot.exists());
        updatePendingRechargesTable();
    }, (err) => console.error('Error loading pending recharges:', err));
}

function updatePendingRechargesTable() {
    const tbody = document.getElementById('pendingRechargesBody');
    if (!tbody) return;
    if (!pendingRecharges || pendingRecharges.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No hay recargas pendientes</td></tr>';
        return;
    }

        tbody.innerHTML = pendingRecharges.map(p => {
        const imgHtml = p.imageBase64 ? `<button class="btn btn-sm btn-outline" onclick="openImageModalById('${p.id}')">Ver imagen</button>` : '—';
        return `
        <tr>
            <td>${escapeHtml(p.username || p.userId || '')}</td>
            <td>${escapeHtml(p.email || '')}</td>
            <td>${Number(p.amount) || 0}</td>
            <td>${formatDate(p.createdAt || '')}</td>
            <td>${imgHtml}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="acceptPendingWrapper('${p.id}')"><i class="fas fa-check"></i></button>
                <button class="btn btn-sm btn-danger" onclick="rejectPendingWrapper('${p.id}')"><i class="fas fa-times"></i></button>
            </td>
        </tr>
        `;
    }).join('');
}

async function acceptPending(id) {
    const p = pendingRecharges.find(x => x.id === id);
    if (!p) return showToast('Registro no encontrado', 'error');
    if (!confirm('Aceptar esta recarga y acreditar monedas al usuario?')) return;
    showLoader();
    try {
        const userId = p.userId;
        const amount = Number(p.amount) || 0;
        // update user coins
        const userRef = ref(database, `users/${userId}`);
        // read current coins once
        let currentCoins = 0;
        try {
            const userSnap = await get(userRef);
            const data = userSnap.val() || {};
            currentCoins = data.coins || 0;
        } catch (err) {
            console.warn('Could not read user coins:', err);
        }
        const newCoins = currentCoins + amount;
        await update(userRef, { coins: newCoins, lastRecharge: new Date().toISOString() });

        // push to recharges log
        await push(ref(database, `recharges/${userId}`), { amount, method: 'Manual', status: 'Completado', fecha: new Date().toISOString(), adminReviewed: true });

        // remove pending
        await remove(ref(database, `pendingRecharges/${id}`));

        showToast('Recarga aceptada y monedas acreditadas', 'success');
    } catch (err) {
        console.error('Error accepting pending recharge:', err);
        showToast('Error al aceptar recarga', 'error');
    } finally { hideLoader(); }
}

async function rejectPending(id) {
    if (!confirm('Rechazar esta recarga?')) return;
    showLoader();
    try {
        await remove(ref(database, `pendingRecharges/${id}`));
        showToast('Recarga rechazada y eliminada', 'success');
    } catch (err) {
        console.error('Error rejecting pending recharge:', err);
        showToast('Error al rechazar recarga', 'error');
    } finally { hideLoader(); }
}

window.acceptPendingWrapper = function(id) { acceptPending(id); };
window.rejectPendingWrapper = function(id) { rejectPending(id); };
window.openImageModalById = function(id) {
    console.log('openImageModalById called with id=', id);
    const p = pendingRecharges.find(x=>x.id===id);
    if (!p) { console.warn('openImageModalById: pending record not found', id); return; }
    if (!p.imageBase64) { console.warn('openImageModalById: no imageBase64 in record', id); return; }
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('imagePreviewImg');
    if (!modal || !img) {
        console.warn('openImageModalById: modal or image element not found, opening in new window as fallback');
        const w = window.open();
        if (w) {
            w.document.write(`<title>Comprobante</title><img src="${p.imageBase64}" style="max-width:100%;height:auto;display:block;margin:12px auto;">`);
        }
        return;
    }
    img.src = p.imageBase64;
    // ensure modal is visible
    modal.classList.add('show');
};
window.closeImagePreviewModal = function() {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('imagePreviewImg');
    if (img) img.src = '';
    if (modal) modal.classList.remove('show');
};
// backward compatibility
window.openImagePreview = window.openImageModalById;

function loadProducts() {
    console.log('Loading products from Firebase...');
    const productsRef = ref(database, 'products');
    
    onValue(productsRef, (snapshot) => {
        products = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const product = {
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                };
                products.push(product);
            });
            console.log('Loaded products:', products);
        } else {
            console.log('No products data in Firebase');
        }
        
        updateProductsTable();
        updateStats();
    }, (error) => {
        console.error('Error loading products:', error);
    });
}

function loadAccounts() {
    console.log('Loading account pools from Firebase...');
    const accountsRef = ref(database, 'accounts');

    onValue(accountsRef, (snapshot) => {
        accountPools = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const val = child.val() || {};
                const entriesObj = val.entries || {};
                const entries = Object.entries(entriesObj || {}).map(([id, data]) => ({ id, ...(data || {}) }));
                const normalizedEntries = entries.map(e => ({
                    ...e,
                    maxProfiles: e.maxProfiles || 4,
                    assignedCount: e.assignedCount || 0,
                    expirationDays: e.expirationDays || 30
                }));
                const available = normalizedEntries.filter(a => (a.maxProfiles || 4) - (a.assignedCount || 0) > 0).length;
                const assigned = normalizedEntries.reduce((sum, a) => sum + (a.assignedCount || 0), 0);
                accountPools.push({
                    id: child.key,
                    name: val.name || child.key,
                    available,
                    assigned,
                    total: normalizedEntries.length,
                    entries: normalizedEntries
                });
            });
        }
        updateAccountsTable();
        populateAccountSelects();
    }, (err) => console.error('Error loading account pools:', err));
}

function slugifyPoolName(name) {
    return String(name || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-');
}

async function handleAccountPoolSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('accountPoolName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return showToast('Nombre de base vacío', 'error');

    const poolId = slugifyPoolName(name);
    if (!poolId) return showToast('Nombre de base inválido', 'error');

    if (accountPools.some(p => p.id === poolId)) {
        return showToast('Ya existe una base con ese nombre', 'warning');
    }

    showLoader();
    try {
        await set(ref(database, `accounts/${poolId}`), {
            name,
            createdAt: new Date().toISOString()
        });
        showToast('Base creada', 'success');
        input.value = '';
    } catch (err) {
        console.error('Error creating pool:', err);
        showToast('Error al crear pool', 'error');
    } finally {
        hideLoader();
    }
}

async function handleAccountAddSubmit(e) {
    e.preventDefault();

    const poolSelect = document.getElementById('accountPoolSelect');
    const emailInput = document.getElementById('accountEmail');
    const passInput = document.getElementById('accountPassword');
    const expirationInput = document.getElementById('accountExpirationDays');
    const maxProfilesInput = document.getElementById('accountMaxProfiles');

    if (!poolSelect || !emailInput || !passInput || !maxProfilesInput || !expirationInput) return;

    const poolId = poolSelect.value;
    const email = emailInput.value.trim();
    const password = passInput.value.trim();
    const expirationDays = parseInt(expirationInput.value, 10) || 30;
    const maxProfiles = parseInt(maxProfilesInput.value, 10) || 4;

    if (!poolId) return showToast('Selecciona una base', 'error');
    if (!email || !password) return showToast('Completa correo y contraseña', 'error');
    if (expirationDays <= 0) return showToast('Duración inválida', 'error');
    if (maxProfiles <= 0) return showToast('Perfiles máximos inválido', 'error');

    const accountData = {
        email,
        password,
        expirationDays,
        maxProfiles,
        assignedCount: 0,
        status: 'available',
        createdAt: new Date().toISOString()
    };

    showLoader();
    try {
        await push(ref(database, `accounts/${poolId}/entries`), accountData);
        showToast('Cuenta guardada en la base', 'success');
        emailInput.value = '';
        passInput.value = '';
        expirationInput.value = '30';
        maxProfilesInput.value = '4';
    } catch (err) {
        console.error('Error adding account:', err);
        showToast('Error al guardar cuenta', 'error');
    } finally {
        hideLoader();
    }
}

function renderAccountEntriesList() {
    const list = document.getElementById('accountEntriesList');
    if (!list) return;

    const pool = accountPools.find(p => p.id === currentAccountPoolId);
    if (!pool) {
        list.innerHTML = '<div class="loading-placeholder">Base no encontrada</div>';
        return;
    }

    if (!pool.entries || pool.entries.length === 0) {
        list.innerHTML = '<div class="loading-placeholder">No hay cuentas en esta base</div>';
        return;
    }

    list.innerHTML = pool.entries.map(entry => {
        const used = entry.assignedCount || 0;
        const max = entry.maxProfiles || 4;
        const statusLabel = used >= max ? 'Lleno' : 'Disponible';
        const durationLabel = entry.expirationDays ? `${entry.expirationDays} días` : 'Sin duración';
        return `
        <div class="account-entry-row">
            <div>
                <strong>${escapeHtml(entry.email || '')}</strong><br>
                <small>${escapeHtml(entry.password || '')}</small><br>
                <small>${used}/${max} perfiles - ${statusLabel} - ${durationLabel}</small>
            </div>
            <div class="entry-actions">
                <button class="btn btn-sm btn-outline" onclick="selectAccountForEditWrapper('${entry.id}')"><i class="fas fa-edit"></i></button>
            </div>
        </div>
    `;
    }).join('');
}

function showAccountModal(poolId) {
    currentAccountPoolId = poolId;
    currentEditingAccountId = null;
    const pool = accountPools.find(p => p.id === poolId);
    const modal = document.getElementById('accountModal');
    const poolNameEl = document.getElementById('accountModalPoolName');
    if (poolNameEl) poolNameEl.textContent = pool ? pool.name : poolId;
    renderAccountEntriesList();

    const form = document.getElementById('accountEditForm');
    if (form) form.reset();
    const hiddenId = document.getElementById('accountEditId');
    if (hiddenId) hiddenId.value = '';
    const expirationInput = document.getElementById('accountEditExpirationDays');
    if (expirationInput) expirationInput.value = '30';
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeAccountModal() {
    const modal = document.getElementById('accountModal');
    if (modal) { modal.classList.remove('show'); modal.style.display = 'none'; }
    currentAccountPoolId = null;
    currentEditingAccountId = null;
}

function selectAccountForEdit(accountId) {
    const pool = accountPools.find(p => p.id === currentAccountPoolId);
    if (!pool) return;
    const entry = (pool.entries || []).find(e => e.id === accountId);
    if (!entry) return;
    currentEditingAccountId = accountId;
    const hiddenId = document.getElementById('accountEditId');
    const emailInput = document.getElementById('accountEditEmail');
    const passInput = document.getElementById('accountEditPassword');
    const expirationInput = document.getElementById('accountEditExpirationDays');
    const maxInput = document.getElementById('accountEditMaxProfiles');
    if (hiddenId) hiddenId.value = accountId;
    if (emailInput) emailInput.value = entry.email || '';
    if (passInput) passInput.value = entry.password || '';
    if (expirationInput) expirationInput.value = entry.expirationDays || 30;
    if (maxInput) maxInput.value = entry.maxProfiles || 4;
}

async function handleAccountEditSubmit(e) {
    e.preventDefault();
    if (!currentAccountPoolId || !currentEditingAccountId) {
        return showToast('Selecciona una cuenta para editar', 'error');
    }
    const emailInput = document.getElementById('accountEditEmail');
    const passInput = document.getElementById('accountEditPassword');
    const expirationInput = document.getElementById('accountEditExpirationDays');
    const maxInput = document.getElementById('accountEditMaxProfiles');
    if (!emailInput || !passInput || !expirationInput) return;
    const email = emailInput.value.trim();
    const password = passInput.value.trim();
    const expirationDays = parseInt(expirationInput.value, 10) || 30;
    const maxProfiles = maxInput ? parseInt(maxInput.value, 10) || 4 : 4;
    if (!email || !password) return showToast('Completa correo y contraseña', 'error');
    if (expirationDays <= 0) return showToast('Duración inválida', 'error');
    if (maxProfiles <= 0) return showToast('Perfiles máximos inválido', 'error');

    showLoader();
    try {
        await update(ref(database, `accounts/${currentAccountPoolId}/entries/${currentEditingAccountId}`), {
            email,
            password,
            expirationDays,
            maxProfiles,
            updatedAt: new Date().toISOString()
        });
        showToast('Cuenta actualizada', 'success');
        renderAccountEntriesList();
        selectAccountForEdit(currentEditingAccountId);
    } catch (err) {
        console.error('Error updating account:', err);
        showToast('Error al actualizar cuenta', 'error');
    } finally {
        hideLoader();
    }
}

function populateAccountSelects() {
    const poolSelect = document.getElementById('accountPoolSelect');
    if (poolSelect) {
        poolSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecciona una base';
        poolSelect.appendChild(placeholder);
        accountPools.forEach(pool => {
            const opt = document.createElement('option');
            opt.value = pool.id;
            opt.textContent = pool.name;
            poolSelect.appendChild(opt);
        });
    }

    const productPoolSelect = document.getElementById('productAccountPool');
    if (productPoolSelect) {
        productPoolSelect.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Sin base (entrega manual)';
        productPoolSelect.appendChild(defaultOpt);
        accountPools.forEach(pool => {
            const opt = document.createElement('option');
            opt.value = pool.id;
            opt.textContent = pool.name;
            productPoolSelect.appendChild(opt);
        });
    }
}

function updateAccountsTable() {
    const tbody = document.getElementById('accountsTableBody');
    if (!tbody) return;

    if (!accountPools || accountPools.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No hay bases registradas</td></tr>';
        return;
    }

    tbody.innerHTML = accountPools.map(pool => `
        <tr>
            <td>${escapeHtml(pool.name)}</td>
            <td>${pool.available}</td>
            <td>${pool.assigned}</td>
            <td>${pool.total}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="showAccountModalWrapper('${pool.id}')"><i class="fas fa-edit"></i> Ver/Editar</button>
            </td>
        </tr>
    `).join('');
}

function getPoolName(poolId) {
    if (!poolId) return 'Sin pool';
    const pool = accountPools.find(p => p.id === poolId);
    return pool ? pool.name : poolId;
}

function loadUsers() {
    console.log('Loading users from Firebase...');
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
        users = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const user = {
                    uid: childSnapshot.key,
                    ...childSnapshot.val()
                };
                users.push(user);
            });
            console.log('Loaded users:', users);
        } else {
            console.log('No users data in Firebase');
        }
        
        updateUsersTable();
        updateStats();
    }, (error) => {
        console.error('Error loading users:', error);
    });
}

function loadAds() {
    console.log('Loading ads from Firebase...');
    const adsRef = ref(database, 'ads');
    
    onValue(adsRef, (snapshot) => {
        ads = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const ad = {
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                };
                ads.push(ad);
            });
            console.log('Loaded ads:', ads);
        } else {
            console.log('No ads data in Firebase');
        }
        
        updateAdsGrid();
    }, (error) => {
        console.error('Error loading ads:', error);
    });
}

function loadStats() {

}

function updateStats() {
    document.getElementById('totalUsers').textContent = users.length;
    document.getElementById('totalProducts').textContent = products.length;

    let totalRevenue = 0;
    let totalOrders = 0;
    
    users.forEach(user => {

        if (user.coins) {
            totalRevenue += user.coins;
        }
    });

    document.getElementById('totalRevenue').innerHTML = `${totalRevenue} <i class="fas fa-coins"></i>`;
    document.getElementById('totalOrders').textContent = totalOrders;
}

function updateProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-row">No hay productos registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>
                <img src="${product.image || 'https://picsum.photos/seed/' + product.id + '/50/50.jpg'}" 
                     alt="${product.title}" 
                     class="product-thumb"
                     onerror="this.src='https://picsum.photos/seed/default/50/50.jpg'">
            </td>
            <td>${product.title}</td>
            <td>${product.price} <i class="fas fa-coins"></i></td>
            <td>${product.discount || 0} <i class="fas fa-coins"></i></td>
            <td>${product.stock || 0}</td>
            <td>${(function(){
                    try{
                        if (!product.category) return 'N/A';

                        const c = categories.find(cat => cat.id === product.category || (cat.slug && cat.slug === product.category) || (cat.name && cat.name.toLowerCase() === (product.category||'').toLowerCase()));
                        return c ? c.name : product.category;
                    }catch(e){ return product.category || 'N/A'; }
                })()}</td>
            <td>${getPoolName(product.accountPool)}</td>
            <td>
                <span class="status-badge ${(product.stock || 0) > 0 ? 'active' : 'inactive'}">
                    ${(product.stock || 0) > 0 ? 'Activo' : 'Agotado'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editProduct('${product.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');

    if (!tbody) {
        console.warn('usersTableBody element not found');
        return;
    }
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-row">No hay usuarios registrados</td></tr>';
        return;
    }
    
    console.log('Rendering users table with', users.length, 'users');
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.phone || 'N/A'}</td>
            <td>${user.coins || 0} <i class="fas fa-coins"></i></td>
            <td>
                <span class="role-badge ${user.role === 'admin' ? 'admin' : 'user'}">
                    ${user.role || 'user'}
                </span>
            </td>
            <td>
                <span class="status-badge ${user.status === 'banned' ? 'banned' : 'active'}">
                    ${user.status === 'banned' ? 'Baneado' : 'Activo'}
                </span>
            </td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editUserWrapper('${user.uid}')">
                    <i class="fas fa-edit"></i>
                </button>
                ${user.status !== 'banned' ? 
                    `<button class="btn btn-sm btn-warning" onclick="banUserWrapper('${user.uid}')">
                        <i class="fas fa-ban"></i>
                    </button>` :
                    `<button class="btn btn-sm btn-success" onclick="unbanUserWrapper('${user.uid}')">
                        <i class="fas fa-check"></i>
                    </button>`
                }
            </td>
        </tr>
    `).join('');
}

function updateAdsGrid() {
    const grid = document.getElementById('adsGrid');
    
    if (ads.length === 0) {
        grid.innerHTML = '<div class="loading-placeholder">No hay anuncios registrados</div>';
        return;
    }
    
    grid.innerHTML = ads.map(ad => {
        const src = escapeHtml(ad.image || ad.imageUrl || 'https://picsum.photos/seed/ad/800/450');
        const title = escapeHtml(ad.title || 'Sin título');
        return `
        <div class="ad-card">
            <div class="ad-thumb" style="background-image: url('${src}');"></div>
            <div class="ad-meta">${title}</div>
            <div class="ad-actions">
                <button class="btn btn-sm btn-outline" onclick="editAd('${ad.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteAd('${ad.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    }).join('');
}

function showAdminSection(section) {

    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.querySelector(`.menu-btn[data-section="${section}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    document.querySelectorAll('.admin-section-content').forEach(sec => {
        sec.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

function showProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const title = document.getElementById('productModalTitle');
    
    if (productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            currentEditingProduct = productId;
            title.innerHTML = '<i class="fas fa-pen"></i> <span id="productModalTitleText">Editar Producto</span>';
            
            document.getElementById('productTitle').value = product.title || '';

                const catVal = product.category || '';
                const select = document.getElementById('productCategory');
                if (select) {
                    let matched = '';

                    const byId = categories.find(c => c.id === catVal);
                    if (byId) matched = byId.id;
                    else {

                        const bySlug = categories.find(c => (c.slug && c.slug === catVal));
                        if (bySlug) matched = bySlug.id;
                        else {
                            const byName = categories.find(c => (c.name && c.name.toLowerCase() === (catVal||'').toLowerCase()));
                            if (byName) matched = byName.id;
                        }
                    }

                    if (!matched) {
                        const opt = Array.from(select.options).find(o => o.value === catVal || (o.text && o.text.toLowerCase() === (catVal||'').toLowerCase()));
                        if (opt) matched = opt.value;
                    }
                    select.value = matched || '';
                }
            document.getElementById('productDescription').value = product.description || '';
            document.getElementById('productPrice').value = product.price || 0;
            document.getElementById('productDiscount').value = product.discount || '';
            document.getElementById('productStock').value = product.stock || 0;
            document.getElementById('productImage').value = product.image || '';
            const poolSelect = document.getElementById('productAccountPool');
            if (poolSelect) poolSelect.value = product.accountPool || '';
        }
    } else {
        currentEditingProduct = null;
        title.innerHTML = '<i class="fas fa-plus"></i> <span id="productModalTitleText">Añadir Producto</span>';
        form.reset();
        const poolSelect = document.getElementById('productAccountPool');
        if (poolSelect) poolSelect.value = '';
    }
    
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) { modal.classList.remove('show'); modal.style.display = 'none'; }
    currentEditingProduct = null;
}

async function handleProductSubmit(event) {
    event.preventDefault();
    
    const productData = {
        title: document.getElementById('productTitle').value,
        category: document.getElementById('productCategory').value || 'general',
        description: document.getElementById('productDescription').value,
        price: parseInt(document.getElementById('productPrice').value),
        discount: parseInt(document.getElementById('productDiscount').value) || 0,
        stock: parseInt(document.getElementById('productStock').value),
        image: document.getElementById('productImage').value || '',
        accountPool: document.getElementById('productAccountPool') ? document.getElementById('productAccountPool').value : '',
        updatedAt: new Date().toISOString()
    };
    
    showLoader();
    
    try {
        if (currentEditingProduct) {

            await update(ref(database, `products/${currentEditingProduct}`), productData);
            showToast('Producto actualizado correctamente', 'success');
        } else {

            productData.createdAt = new Date().toISOString();
            await push(ref(database, 'products'), productData);
            showToast('Producto creado correctamente', 'success');
        }
        
        closeProductModal();
    } catch (error) {
        console.error('Product save error:', error);
        showToast('Error al guardar producto', 'error');
    } finally {
        hideLoader();
    }
}

function editProduct(productId) {
    showProductModal(productId);
}

async function deleteProduct(productId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) {
        return;
    }
    
    showLoader();
    
    try {
        await remove(ref(database, `products/${productId}`));
        showToast('Producto eliminado correctamente', 'success');
    } catch (error) {
        console.error('Product delete error:', error);
        showToast('Error al eliminar producto', 'error');
    } finally {
        hideLoader();
    }
}

function editUser(userId) {
    const user = users.find(u => u.uid === userId);
    if (!user) return;
    
    currentEditingUser = userId;
    currentEditingUserCoins = user.coins || 0;
    
    document.getElementById('editUsername').value = user.username || '';
    document.getElementById('editCoins').value = user.coins || 0;
    document.getElementById('editRole').value = user.role || 'user';
    document.getElementById('editStatus').value = user.status || 'active';
    
    const modal = document.getElementById('userModal');
    if (modal) { modal.classList.add('show'); modal.style.display = 'flex'; }
}

function closeUserModal() {
    const modal = document.getElementById('userModal');
    if (modal) { modal.classList.remove('show'); modal.style.display = 'none'; }
    currentEditingUser = null;
    currentEditingUserCoins = 0;
}

async function handleUserSubmit(event) {
    event.preventDefault();
    if (!currentEditingUser) return;

    const newCoins = parseInt(document.getElementById('editCoins').value) || 0;
    const deltaCoins = newCoins - (currentEditingUserCoins || 0);

    const userData = {
        coins: newCoins,
        role: document.getElementById('editRole').value,
        status: document.getElementById('editStatus').value,
        updatedAt: new Date().toISOString()
    };
    
    showLoader();
    
    try {
        await update(ref(database, `users/${currentEditingUser}`), userData);

        if (deltaCoins > 0) {
            const rechargeData = {
                amount: deltaCoins,
                method: 'Yape/Plin',
                status: 'Completado',
                fecha: new Date().toISOString(),
                source: 'admin-adjustment'
            };
            await push(ref(database, `recharges/${currentEditingUser}`), rechargeData);
        }

        showToast('Usuario actualizado correctamente', 'success');
        closeUserModal();
    } catch (error) {
        console.error('User update error:', error);
        showToast('Error al actualizar usuario', 'error');
    } finally {
        hideLoader();
    }
}

async function banUser(userId) {
    if (!confirm('¿Estás seguro de que quieres banear a este usuario?')) {
        return;
    }
    showLoader();
    
    try {
        await update(ref(database, `users/${userId}`), {
            status: 'banned',
            bannedAt: new Date().toISOString()
        });
        showToast('Usuario baneado correctamente', 'success');
    } catch (error) {
        console.error('Ban user error:', error);
        showToast('Error al banear usuario', 'error');
    } finally {
        hideLoader();
    }
}

async function unbanUser(userId) {
    if (!confirm('¿Estás seguro de que quieres desbanear a este usuario?')) {
        return;
    }
    showLoader();
    
    try {
        await update(ref(database, `users/${userId}`), {
            status: 'active',
            unbannedAt: new Date().toISOString()
        });
        showToast('Usuario desbaneado correctamente', 'success');
    } catch (error) {
        console.error('Unban user error:', error);
        showToast('Error al desbanear usuario', 'error');
    } finally {
        hideLoader();
    }
}

function showAdModal(adId = null) {
    const modal = document.getElementById('adModal');
    const form = document.getElementById('adForm');
    const imageInput = document.getElementById('adImageUrl');
    const titleInput = document.getElementById('adTitle');
    if (!modal || !form || !imageInput || !titleInput) {
        console.error('Ad modal or form missing');
        return;
    }
    
    if (adId) {
        const ad = ads.find(a => a.id === adId);
        if (ad) {
            currentEditingAd = adId;
            imageInput.value = ad.image || ad.imageUrl || '';
            titleInput.value = ad.title || '';
        }
    } else {
        currentEditingAd = null;
        form.reset();
    }
    
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function closeAdModal() {
    const modal = document.getElementById('adModal');
    if (modal) { modal.classList.remove('show'); modal.style.display = 'none'; }
    currentEditingAd = null;
}

async function handleAdSubmit(event) {
    event.preventDefault();
    const imageInput = document.getElementById('adImageUrl');
    const titleInput = document.getElementById('adTitle');
    if (!imageInput || !titleInput) return;
    const image = (imageInput.value || '').trim();
    const title = (titleInput.value || '').trim();
    if (!image) return showToast('Ingresa la URL de la imagen', 'error');
    if (!title) return showToast('Ingresa un nombre para el anuncio', 'error');

    const adData = {
        title,
        image,
        updatedAt: new Date().toISOString()
    };
    
    showLoader();
    
    try {
        if (currentEditingAd) {

            await update(ref(database, `ads/${currentEditingAd}`), adData);
            showToast('Anuncio actualizado correctamente', 'success');
        } else {

            adData.createdAt = new Date().toISOString();
            await push(ref(database, 'ads'), adData);
            showToast('Anuncio creado correctamente', 'success');
        }
        
        closeAdModal();
    } catch (error) {
        console.error('Ad save error:', error);
        showToast('Error al guardar anuncio', 'error');
    } finally {
        hideLoader();
    }
}

function editAd(adId) {
    currentEditingAd = adId;
    const ad = ads.find(a => a.id === adId);
    if (ad) {
        const imageInput = document.getElementById('adImageUrl');
        const titleInput = document.getElementById('adTitle');
        if (imageInput) imageInput.value = ad.image || ad.imageUrl || '';
        if (titleInput) titleInput.value = ad.title || '';
        const modal = document.getElementById('adModal');
        if (modal) { modal.classList.add('show'); modal.style.display = 'flex'; }
    }
}

async function deleteAd(adId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este anuncio?')) {
        return;
    }
    showLoader();
    
    try {
        await remove(ref(database, `ads/${adId}`));
        showToast('Anuncio eliminado correctamente', 'success');
    } catch (error) {
        console.error('Ad delete error:', error);
        showToast('Error al eliminar anuncio', 'error');
    } finally {
        hideLoader();
    }
}

async function handleCoinSettings(event) {
    event.preventDefault();
    
    const settings = {
        welcomeBonus: parseInt(document.getElementById('welcomeBonus').value),
        exchangeRate: parseFloat(document.getElementById('exchangeRate').value)
    };
    
    showLoader();
    
    try {
        await set(ref(database, 'settings/coins'), settings);
        showToast('Configuración de monedas actualizada', 'success');
    } catch (error) {
        console.error('Settings save error:', error);
        showToast('Error al guardar configuración', 'error');
    } finally {
        hideLoader();
    }
}

async function handleGeneralSettings(event) {
    event.preventDefault();
    
    const settings = {
        siteName: document.getElementById('siteName').value,
        supportEmail: document.getElementById('supportEmail').value
    };
    const themeSelect = document.getElementById('themeSelect');
    const themeName = themeSelect ? themeSelect.value : 'orchid';
    
    showLoader();
    
    try {
        await Promise.all([
            set(ref(database, 'settings/general'), settings),
            set(ref(database, 'settings/theme'), { name: themeName })
        ]);
        showToast('Configuración general actualizada', 'success');
    } catch (error) {
        console.error('Settings save error:', error);
        showToast('Error al guardar configuración', 'error');
    } finally {
        hideLoader();
    }
}

function loadThemeSetting() {
    const select = document.getElementById('themeSelect');
    if (!select) return;

    const themeRef = ref(database, 'settings/theme');
    onValue(themeRef, (snapshot) => {
        const value = snapshot.val();
        const themeName = typeof value === 'string' ? value : value?.name;
        if (themeName) select.value = themeName;
    }, (error) => {
        console.error('Theme load error:', error);
    });
}

function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    
    if (!searchTerm) {
        updateUsersTable();
        return;
    }
    
    const filteredUsers = users.filter(user => 
        (user.username && user.username.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm)) ||
        (user.phone && user.phone.includes(searchTerm))
    );
    
    const tbody = document.getElementById('usersTableBody');
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-row">No se encontraron usuarios</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredUsers.map(user => `
        <tr>
            <td>${user.username || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.phone || 'N/A'}</td>
            <td>${user.coins || 0} <i class="fas fa-coins"></i></td>
            <td>
                <span class="role-badge ${user.role === 'admin' ? 'admin' : 'user'}">
                    ${user.role || 'user'}
                </span>
            </td>
            <td>
                <span class="status-badge ${user.status === 'banned' ? 'banned' : 'active'}">
                    ${user.status === 'banned' ? 'Baneado' : 'Activo'}
                </span>
            </td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editUser('${user.uid}')">
                    <i class="fas fa-edit"></i>
                </button>
                ${user.status !== 'banned' ? 
                    `<button class="btn btn-sm btn-warning" onclick="banUser('${user.uid}')">
                        <i class="fas fa-ban"></i>
                    </button>` :
                    `<button class="btn btn-sm btn-success" onclick="unbanUser('${user.uid}')">
                        <i class="fas fa-check"></i>
                    </button>`
                }
            </td>
        </tr>
    `).join('');
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES');
}

window.showAdminSection = showAdminSection;
window.showProductModal = showProductModal;
window.showProductModalWrapper = function() { showProductModal(); };
window.closeProductModal = closeProductModal;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.editUser = editUser;
window.closeUserModal = closeUserModal;
window.banUser = banUser;
window.unbanUser = unbanUser;
window.showAdModal = showAdModal;
window.closeAdModal = closeAdModal;
window.editAd = editAd;
window.deleteAd = deleteAd;
window.deleteCommunity = deleteCommunity;
window.searchUsers = searchUsers;
window.showAccountModalWrapper = function(poolId) { showAccountModal(poolId); };
window.closeAccountModalWrapper = closeAccountModal;
window.selectAccountForEditWrapper = function(accountId) { selectAccountForEdit(accountId); };

window.adminJSReady = true;
if (window.adminLoadedPromise && typeof window.adminLoadedPromise.resolve === 'function') {
    window.adminLoadedPromise.resolve();
}

console.log('Admin.js loaded successfully! All functions exported to window:', {
    showAdminSection: typeof window.showAdminSection,
    showProductModal: typeof window.showProductModal,
    showAdModal: typeof window.showAdModal,
    editUser: typeof window.editUser,
    banUser: typeof window.banUser
});

initializeAdminPanel().catch(err => console.error('Admin panel init error:', err));

window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
    }
});




