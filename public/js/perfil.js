import { database, ref, onValue, update, push, auth } from './base.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    const waitAuth = () => {

            if (!window.ADDUXSHOP.authReady) {
            setTimeout(waitAuth, 100);
            return;
        }

            const user = window.ADDUXSHOP.currentUser;

        if (!user) {

            return;
        }

        console.log('User authenticated, loading profile for:', user.email);

        if (window.ADDUXSHOP.isAdmin) {
            const adminDropdownBtn = document.getElementById('adminDropdownBtn');
            if (adminDropdownBtn) {
                adminDropdownBtn.style.display = 'block';
            }
        }
        
        loadProfileData();
    };

    waitAuth();
});

const _baseOpenRechargeModal = window.openRechargeModal;
const _baseCloseRechargeModal = window.closeRechargeModal;
const _baseRechargeCustomAmount = window.rechargeCustomAmount;

function formatDateDMY(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function updateProfileFromCache() {
    const userData = window.ADDUXSHOP.userData;
    const user = window.ADDUXSHOP.currentUser;
    
    if (!userData || !user) return;
    
    console.log('Using cached user data for instant load');
    
    const username = userData.username || user.displayName || user.email.split('@')[0];
    
    document.getElementById('profileUsername').textContent = username;
    document.getElementById('profileEmail').textContent = user.email;
    updateDropdownUsername(username);
    updateCoinDisplays(userData.coins || 0);
        document.getElementById('profileMemberSince').textContent = userData.createdAt ? formatDateDMY(userData.createdAt) : formatDateDMY(new Date());

    const editUsername = document.getElementById('editUsername');
    const editEmail = document.getElementById('editEmail');
    const editPhone = document.getElementById('editPhone');
    const modalUsername = document.getElementById('modalUsername');
    const modalPhone = document.getElementById('modalPhone');
    if (editUsername) editUsername.value = username;
    if (editEmail) editEmail.value = user.email;
    if (editPhone) editPhone.value = userData.phone || '';
    if (modalUsername) modalUsername.value = username;
    if (modalPhone) modalPhone.value = userData.phone || '';

    const initial = userData.username ? userData.username.charAt(0).toUpperCase() : '<i class="fas fa-user"></i>';
    document.getElementById('avatarInitial').innerHTML = initial;
}

function loadProfileData() {
    const user = window.ADDUXSHOP.currentUser;
    if (!user) return;

    console.log('Loading profile for:', user.email);

    document.getElementById('profileUsername').textContent = user.displayName || user.email.split('@')[0];
    document.getElementById('profileEmail').textContent = user.email;
    const editUsername = document.getElementById('editUsername');
    const editEmail = document.getElementById('editEmail');
    const editPhone = document.getElementById('editPhone');
    const modalUsername = document.getElementById('modalUsername');
    const modalPhone = document.getElementById('modalPhone');
    if (editUsername) editUsername.value = user.displayName || user.email.split('@')[0];
    if (editEmail) editEmail.value = user.email;
    if (editPhone) editPhone.value = window.ADDUXSHOP.userData?.phone || '';
    if (modalUsername) modalUsername.value = user.displayName || user.email.split('@')[0];
    if (modalPhone) modalPhone.value = window.ADDUXSHOP.userData?.phone || '';

    if (window.ADDUXSHOP.userData) {
        updateProfileFromCache();
    } else {

        loadUserDataFromDB();
    }
    
    loadPurchaseHistory();
    loadRechargeHistory();
    setupEventListeners();
}

async function loadUserDataFromDB() {
    const user = window.ADDUXSHOP.currentUser;
    if (!user) return;
    
    try {
        const userId = user.uid;
        const userRef = ref(database, `users/${userId}`);
        
        onValue(userRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const username = data.username || user.displayName || user.email.split('@')[0];
                
                document.getElementById('profileUsername').textContent = username;
                document.getElementById('profileEmail').textContent = user.email;
                updateDropdownUsername(username);
                updateCoinDisplays(data.coins || 0);
                    document.getElementById('profileMemberSince').textContent = data.createdAt ? formatDateDMY(data.createdAt) : formatDateDMY(new Date());
                
                const editUsername = document.getElementById('editUsername');
                const editEmail = document.getElementById('editEmail');
                const editPhone = document.getElementById('editPhone');
                const modalUsername = document.getElementById('modalUsername');
                const modalPhone = document.getElementById('modalPhone');
                if (editUsername) editUsername.value = username;
                if (editEmail) editEmail.value = user.email;
                if (editPhone) editPhone.value = data.phone || '';
                if (modalUsername) modalUsername.value = username;
                if (modalPhone) modalPhone.value = data.phone || '';

                const initial = data.username ? data.username.charAt(0).toUpperCase() : '<i class="fas fa-user"></i>';
                document.getElementById('avatarInitial').innerHTML = initial;
            }
        });
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadPurchaseHistory() {
    try {
        const userId = window.ADDUXSHOP.currentUser.uid;
        const purchasesRef = ref(database, `purchases/${userId}`);
        
        onValue(purchasesRef, (snapshot) => {
            const purchases = [];
            const accounts = [];
            snapshot.forEach((childSnapshot) => {
                const data = {
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                };
                purchases.push(data);

                if (data.accountAssignments && Array.isArray(data.accountAssignments)) {
                    data.accountAssignments.forEach(a => {
                        accounts.push({
                            ...a,
                            purchaseId: childSnapshot.key,
                            fecha: data.fecha,
                            status: data.status
                        });
                    });
                }
            });
            
            renderPurchases(purchases.reverse());
            renderAccounts(accounts.reverse());

            const purchasesCountEl = document.getElementById('profilePurchases');
            if (purchasesCountEl) purchasesCountEl.textContent = purchases.length;
        });
    } catch (error) {
        console.error('Error loading purchases:', error);
    }
}

async function loadRechargeHistory() {
    try {
        const userId = window.ADDUXSHOP.currentUser.uid;
        const rechargesRef = ref(database, `recharges/${userId}`);
        
        onValue(rechargesRef, (snapshot) => {
            const recharges = [];
            snapshot.forEach((childSnapshot) => {
                recharges.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            renderRecharges(recharges.reverse());
        });
    } catch (error) {
        console.error('Error loading recharges:', error);
    }
}

function renderPurchases(purchases) {
    const container = document.getElementById('purchasesList');
    
    if (purchases.length === 0) {
        container.innerHTML = '<p class="empty-message">No tienes compras registradas</p>';
        return;
    }
    
    container.innerHTML = purchases.map(purchase => `
        <div class="purchase-item">
            <div class="purchase-info">
                <h4>${formatPurchaseTitle(purchase)}</h4>
                <p class="purchase-date">${new Date(purchase.fecha).toLocaleDateString()}</p>
                ${renderPurchaseExpiration(purchase)}
            </div>
            <div class="purchase-amount">
                <div class="amount">${purchase.total || 0} <i class="fas fa-coins"></i></div>
                <span class="status-badge ${purchase.status === 'Completado' ? 'active' : 'pending'}">
                    ${purchase.status || 'Completado'}
                </span>
            </div>
        </div>
    `).join('');
}

function renderAccounts(assignments) {
    const container = document.getElementById('accountsList');
    if (!container) return;

    if (!assignments || assignments.length === 0) {
        container.innerHTML = '<p class="empty-message">Aún no tienes cuentas entregadas</p>';
        return;
    }

    container.innerHTML = assignments.map(acc => {
        const title = `<h4>${escapeHtml(acc.productTitle || 'Producto')}</h4>`;
        const datePool = `<p class="purchase-date">${new Date(acc.fecha).toLocaleDateString()} - ${escapeHtml(acc.poolName || acc.poolId || 'Pool')}</p>`;
        let credHtml = '';
        if (acc.url) {
            const href = acc.url.startsWith('http') ? acc.url : (acc.url.startsWith('www.') ? 'https://' + acc.url : acc.url);
            credHtml += `<p class="account-cred"><strong>Enlace:</strong> <a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(acc.url)}</a></p>`;
            if (acc.password) credHtml += `<p class="account-cred"><strong>Nota:</strong> ${escapeHtml(acc.password)}</p>`;
        } else {
            credHtml += `<p class="account-cred"><strong>Identificador:</strong> ${escapeHtml(acc.email || acc.raw || '')}</p>`;
            if (acc.password) credHtml += `<p class="account-cred"><strong>Contraseña:</strong> ${escapeHtml(acc.password)}</p>`;
        }
        credHtml += `<p class="account-cred"><small>Perfil ${acc.used || 0}/${acc.maxProfiles || 4}</small></p>`;
        credHtml += `<p class="account-cred"><small>Vence: ${formatExpiration(acc.expirationDate)}</small></p>`;
        const statusHtml = `<span class="status-badge ${acc.status === 'Completado' ? 'active' : 'pending'}">${acc.status || 'Completado'}</span>`;
        return `
        <div class="purchase-item">
            <div class="purchase-info">
                ${title}
                ${datePool}
                ${credHtml}
            </div>
            <div class="purchase-amount">
                ${statusHtml}
            </div>
        </div>
    `;
    }).join('');
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function formatPurchaseTitle(purchase) {
    const items = Array.isArray(purchase.items) ? purchase.items : [];
    if (items.length === 0) return 'Producto';
    if (items.length === 1) {
        const item = items[0];
        const qty = item.quantity ? ` x${item.quantity}` : '';
        return `${escapeHtml(item.title || 'Producto')}${qty}`;
    }
    const formatted = items.map(it => `${escapeHtml(it.title || 'Producto')} x${it.quantity || 1}`);
    return formatted.join(', ');
}

function renderPurchaseExpiration(purchase) {
    const expiration = getPurchaseExpiration(purchase);
    if (!expiration) return '';
    return `<p class="purchase-date">Vence: ${expiration}</p>`;
}

function getPurchaseExpiration(purchase) {
    const assignments = Array.isArray(purchase.accountAssignments) ? purchase.accountAssignments : [];
    const dates = assignments
        .map(a => a.expirationDate)
        .filter(Boolean)
        .map(d => new Date(d));
    if (dates.length === 0) return '';
    const soonest = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
    return soonest.toLocaleDateString();
}

function formatExpiration(dateStr) {
    if (!dateStr) return 'Sin fecha';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleDateString();
}

function renderRecharges(recharges) {
    const container = document.getElementById('rechargesList');
    
    if (recharges.length === 0) {
        container.innerHTML = '<p class="empty-message">No tienes recargas registradas</p>';
        return;
    }
    
    container.innerHTML = recharges.map(recharge => `
        <div class="recharge-item">
            <div class="recharge-info">
                <h4>Recarga de ${recharge.amount || 0} monedas</h4>
                <p class="recharge-date">${new Date(recharge.fecha).toLocaleDateString()}</p>
                <p class="recharge-method">${recharge.method || 'Tarjeta'}</p>
            </div>
            <div class="recharge-amount">
                <div class="amount">+${recharge.amount || 0} <i class="fas fa-coins"></i></div>
                <span class="status-badge ${recharge.status === 'Completado' ? 'active' : 'pending'}">
                    ${recharge.status || 'Completado'}
                </span>
            </div>
        </div>
    `).join('');
}

function setupEventListeners() {

    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            updateProfile();
        });
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            updateProfile();
        });
    }

    const newsletter = document.getElementById('newsletter');
    const emailNotifications = document.getElementById('emailNotifications');
    const purchaseNotifications = document.getElementById('purchaseNotifications');

    if (newsletter) {
        newsletter.addEventListener('change', (e) => {
            updateNotificationSetting('newsletter', e.target.checked);
        });
    }

    if (emailNotifications) {
        emailNotifications.addEventListener('change', (e) => {
            updateNotificationSetting('emailNotifications', e.target.checked);
        });
    }

    if (purchaseNotifications) {
        purchaseNotifications.addEventListener('change', (e) => {
            updateNotificationSetting('purchaseNotifications', e.target.checked);
        });
    }
}

function showSection(section) {

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

    document.getElementById(`${section}-section`).classList.add('active');
    event.target.classList.add('active');
}

function showEditProfile() {
    document.getElementById('editProfileModal').classList.add('show');
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').classList.remove('show');
}

function showRechargeModal() {
    if (_baseOpenRechargeModal && typeof _baseOpenRechargeModal === 'function') {
        return _baseOpenRechargeModal();
    }
    const el = document.getElementById('rechargeModal');
    if (el) el.classList.add('show');
}

function closeRechargeModal() {
    if (_baseCloseRechargeModal && typeof _baseCloseRechargeModal === 'function') {
        return _baseCloseRechargeModal();
    }
    const el = document.getElementById('rechargeModal');
    if (el) el.classList.remove('show');
}

function changeAvatar() {
    showToast('Función de cambio de avatar próximamente', 'info');
}

function showChangePassword() {
    const user = window.ADDUXSHOP.currentUser;
    if (!user || !user.email) {
        showToast('Debes iniciar sesión para cambiar la contraseña', 'error');
        return;
    }

    showLoader();
    sendPasswordResetEmail(auth, user.email)
        .then(() => {
            showToast('Te enviamos un enlace para cambiar la contraseña. Revisa tu correo y la bandeja de spam.', 'success');
        })
        .catch((err) => {
            console.error('Password reset error:', err);
            showToast('No pudimos enviar el enlace. Intenta de nuevo.', 'error');
        })
        .finally(() => hideLoader());
}

function enable2FA() {
    showToast('Autenticación de dos factores próximamente', 'info');
}

async function rechargeCoins(amount) {
    if (window.rechargeCoins && typeof window.rechargeCoins === 'function') {
        return window.rechargeCoins(amount);
    }

    const user = window.ADDUXSHOP.currentUser;
    if (!user) {
        showToast('Debes iniciar sesión', 'error');
        return;
    }
    showLoader();
    try {
        const userId = user.uid;
        const userRef = ref(database, `users/${userId}`);
        const currentCoins = window.ADDUXSHOP.userData?.coins || 0;
        const newCoins = currentCoins + amount;
        await update(userRef, { coins: newCoins, lastRecharge: new Date().toISOString() });
        const rechargeData = { amount, method: 'Tarjeta', status: 'Completado', fecha: new Date().toISOString(), price: getRechargePrice(amount) };
        const rechargesRef = ref(database, `recharges/${userId}`);
        await push(rechargesRef, rechargeData);
        showToast(`¡Recargaste ${amount} monedas exitosamente!`, 'success');
        closeRechargeModal();
        if (window.ADDUXSHOP.userData) window.ADDUXSHOP.userData.coins = newCoins;
        window.ADDUXSHOP.userCoins = newCoins;
        updateCoinDisplays(newCoins);
    } catch (error) {
        console.error('Error recharging coins:', error);
        showToast('Error al recargar monedas', 'error');
    } finally {
        hideLoader();
    }
}

function getRechargePrice(amount) {
    const prices = {
        10: 5.00,
        25: 10.00,
        50: 20.00,
        100: 35.00
    };
    return prices[amount] || 0;
}

async function rechargeCustomAmount() {
    if (_baseRechargeCustomAmount && typeof _baseRechargeCustomAmount === 'function') {
        return _baseRechargeCustomAmount();
    }

    const customInput = document.getElementById('customAmount');
    const customAmount = parseInt(customInput?.value || 0);
    if (!customAmount || customAmount < 5) return showToast('Ingresa un monto válido (mínimo 5 PEN)', 'error');
    if (customAmount > 10000) return showToast('El monto máximo es 10,000 PEN', 'error');
    return rechargeCoins(customAmount);
}

async function updateProfile() {
    const username = document.getElementById('modalUsername').value;
    const phone = document.getElementById('modalPhone').value;

    if (!username || !phone) {
        showToast('Por favor completa todos los campos', 'error');
        return;
    }

    const user = window.ADDUXSHOP.currentUser;
    if (!user) {
        showToast('Debes iniciar sesión', 'error');
        return;
    }

    showLoader();

    try {
        const userId = user.uid;
        const userRef = ref(database, `users/${userId}`);

        await update(userRef, {
            username: username,
            phone: phone,
            updatedAt: new Date().toISOString()
        });

        showToast('Perfil actualizado correctamente', 'success');
        closeEditProfileModal();

            if (window.ADDUXSHOP.userData) {
                window.ADDUXSHOP.userData.username = username;
                window.ADDUXSHOP.userData.phone = phone;
        }

        document.getElementById('profileUsername').textContent = username;
        updateDropdownUsername(username);
        const initial = username.charAt(0).toUpperCase();
        document.getElementById('avatarInitial').innerHTML = initial;
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Error al actualizar perfil', 'error');
    } finally {
        hideLoader();
    }
}

async function updateNotificationSetting(setting, value) {
    const user = window.ADDUXSHOP.currentUser;
    if (!user) return;

    try {
        const userId = user.uid;
        const userRef = ref(database, `users/${userId}`);

        await update(userRef, {
            [setting]: value,
            updatedAt: new Date().toISOString()
        });

        showToast('Configuración actualizada', 'success');
    } catch (error) {
        console.error('Error updating notification settings:', error);
        showToast('Error al actualizar configuración', 'error');
    }
}

async function logout() {
    try {
        await auth.signOut();
        window.location.href = '/';
    } catch (error) {
        console.error('Error signing out:', error);
        showToast('Error al cerrar sesión', 'error');
    }
}

window.showSection = showSection;
window.showEditProfile = showEditProfile;
window.closeEditProfileModal = closeEditProfileModal;
window.showRechargeModal = showRechargeModal;
window.closeRechargeModal = closeRechargeModal;
window.changeAvatar = changeAvatar;
window.showChangePassword = showChangePassword;
window.enable2FA = enable2FA;
window.rechargeCoins = rechargeCoins;
window.rechargeCustomAmount = rechargeCustomAmount;
window.updateProfile = updateProfile;
window.updateNotificationSetting = updateNotificationSetting;
window.logout = logout;




