

import { database, ref, onValue, push, update } from './base.js';

let cart = [];
let products = [];
let promoCode = null;
let promoDiscount = 0;
let accountsData = {};
const DEFAULT_SUBSCRIPTION_DAYS = 30;

document.addEventListener('DOMContentLoaded', () => {

    const waitAuth = () => {

        if (!window.ADDUXSHOP.authReady) {
            setTimeout(waitAuth, 100);
            return;
        }

        const user = window.ADDUXSHOP.currentUser;

        if (!user) {
            showToast('Debes iniciar sesión para acceder al carrito', 'error');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
            return;
        }

        loadCartFromStorage();
        loadProducts();
        loadPromoCodes();
        loadAccounts();
        setupEventListeners();
    };

    waitAuth();
});

function loadCartFromStorage() {
    const savedCart = localStorage.getItem('adduxshop_cart');
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
            window.ADDUXSHOP.cart = cart;
        } catch (error) {
            console.error('Error loading cart:', error);
            cart = [];
            window.ADDUXSHOP.cart = [];
        }
    }
    updateCartUI();
}

function loadProducts() {
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
        }
        console.log('Productos cargados:', products.length);
        updateCartUI();
    }, (error) => {
        console.error('Error loading products:', error);
    });
}

function loadAccounts() {
    const accountsRef = ref(database, 'accounts');
    onValue(accountsRef, (snapshot) => {
        accountsData = {};
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const val = child.val() || {};
                const entriesObj = val.entries || {};
                const entries = Object.entries(entriesObj).map(([id, data]) => ({
                    id,
                    poolId: child.key,
                    email: data.email || '',
                    password: data.password || '',
                    expirationDays: data.expirationDays || 30,
                    maxProfiles: data.maxProfiles || 4,
                    assignedCount: data.assignedCount || 0,
                    status: data.status || 'available'
                }));
                accountsData[child.key] = {
                    id: child.key,
                    name: val.name || child.key,
                    entries
                };
            });
        }
    }, (error) => console.error('Error loading accounts:', error));
}

function setupEventListeners() {

    window.addEventListener('authStateChanged', (event) => {
        const user = event.detail.user;
        if (user) {
            const userRef = ref(database, `users/${user.uid}/coins`);
            onValue(userRef, (snapshot) => {
                const coins = snapshot.val() || 0;
                window.ADDUXSHOP.userCoins = coins;
                updateBalanceCheck();
            });
        }
    });

    if (window.ADDUXSHOP.currentUser !== undefined && window.ADDUXSHOP.currentUser) {
        const userRef = ref(database, `users/${window.ADDUXSHOP.currentUser.uid}/coins`);
        onValue(userRef, (snapshot) => {
            const coins = snapshot.val() || 0;
            window.ADDUXSHOP.userCoins = coins;
            updateBalanceCheck();
        });
    }
}

let promoCodesData = {};
function loadPromoCodes() {
    const promoRef = ref(database, 'promoCodes');
    onValue(promoRef, (snapshot) => {
        promoCodesData = {};
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const data = child.val();
                if (data && data.code) {
                    const parsedDiscount = Math.max(0, Math.min(100, parseFloat(data.discount) || 0));
                    promoCodesData[data.code.toUpperCase()] = { id: child.key, discount: parsedDiscount, createdAt: data.createdAt };
                }
            });
        }
        console.log('Promo codes loaded:', Object.keys(promoCodesData));
    }, (err) => console.error('Error loading promo codes:', err));
}

function updateCartUI() {
    const cartItems = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    
    if (!cartItems || !emptyCart) return;
    
    if (cart.length === 0) {
        cartItems.style.display = 'none';
        emptyCart.style.display = 'block';
        updateCartSummary();
        return;
    }
    
    cartItems.style.display = 'flex';
    emptyCart.style.display = 'none';
    
    cartItems.innerHTML = cart.map(item => {
        const product = products.find(p => p.id === item.id);
        if (!product) return '';
        
        return `
            <div class="cart-item">
                <img src="${product.image || 'https://picsum.photos/seed/' + item.id + '/80/80.jpg'}" 
                     alt="${item.title}" 
                     class="cart-item-image"
                     onerror="this.src='https://picsum.photos/seed/default/80/80.jpg'">
                <div class="cart-item-info">
                    <h3 class="cart-item-title">${item.title}</h3>
                    <p class="cart-item-description">${product.description || ''}</p>
                    <div class="cart-item-price">${item.price} <i class="fas fa-coins"></i></div>
                    <div class="cart-item-quantity">
                        <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                        <span class="quantity-value">${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <button class="remove-btn" onclick="removeFromCart('${item.id}')" title="Eliminar producto del carrito">
                        <i class="fas fa-trash-alt"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    updateCartSummary();
    updateBalanceCheck();
}

function allocateAccountsForCart() {
    const localPools = JSON.parse(JSON.stringify(accountsData || {}));
    const assignments = [];

    for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        const poolId = product && product.accountPool ? product.accountPool : '';
        if (!poolId) continue; // manual delivery

        const pool = localPools[poolId];
        if (!pool || !pool.entries || pool.entries.length === 0) {
            throw new Error(`No hay cuentas configuradas para la base ${poolId}`);
        }

        for (let i = 0; i < item.quantity; i++) {

            pool.entries.sort((a, b) => (a.assignedCount || 0) - (b.assignedCount || 0));
            const candidate = pool.entries.find(e => (e.maxProfiles || 4) - (e.assignedCount || 0) > 0);
            if (!candidate) {
                throw new Error(`No hay cuentas disponibles en ${pool.name || poolId}`);
            }

            candidate.assignedCount = (candidate.assignedCount || 0) + 1;
            const remaining = (candidate.maxProfiles || 4) - candidate.assignedCount;
            assignments.push({
                productId: item.id,
                productTitle: item.title,
                poolId,
                poolName: pool.name || poolId,
                accountId: candidate.id,
                email: candidate.email,
                password: candidate.password,
                expirationDays: candidate.expirationDays || DEFAULT_SUBSCRIPTION_DAYS,
                used: candidate.assignedCount,
                maxProfiles: candidate.maxProfiles || 4,
                remainingSlots: Math.max(0, remaining)
            });
        }
    }

    return { assignments, updatedPools: localPools };
}

function buildAccountUsageUpdates(updatedPools) {
    const updates = [];
    Object.values(updatedPools || {}).forEach(pool => {
        (pool.entries || []).forEach(entry => {
            updates.push({
                poolId: pool.id,
                accountId: entry.id,
                assignedCount: entry.assignedCount || 0,
                maxProfiles: entry.maxProfiles || 4,
                status: (entry.assignedCount || 0) >= (entry.maxProfiles || 4) ? 'full' : 'available'
            });
        });
    });
    return updates;
}

function updateCartSummary() {
    const totals = calculateCartTotals();

    const subtotalEl = document.getElementById('subtotal');
    const discountsEl = document.getElementById('discounts');
    const taxesEl = document.getElementById('taxes');
    const totalEl = document.getElementById('total');

    if (subtotalEl) subtotalEl.innerHTML = `${totals.subtotal} <i class="fas fa-coins"></i>`;
    if (discountsEl) discountsEl.innerHTML = `-${totals.discount} <i class="fas fa-coins"></i>`;
    if (taxesEl) taxesEl.innerHTML = `${totals.taxes} <i class="fas fa-coins"></i>`;
    if (totalEl) totalEl.innerHTML = `${totals.total} <i class="fas fa-coins"></i>`;

    const userBalance = window.ADDUXSHOP.userCoins || 0;
    const balanceEl = document.getElementById('userBalance');
    if (balanceEl) balanceEl.innerHTML = `${userBalance} <i class="fas fa-coins"></i>`;

    const balanceWarning = document.getElementById('balanceWarning');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (balanceWarning && checkoutBtn) {
        if (userBalance < totals.total) {
            balanceWarning.style.display = 'block';
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = '<i class="fas fa-coins"></i> Monedas Insuficientes';
        } else {
            balanceWarning.style.display = 'none';
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = '<i class="fas fa-credit-card"></i> Proceder al Pago';
        }
    }
}

function calculateSubtotal() {
    return cart.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
}

function calculateDiscount(subtotal) {
    if (promoCode && promoDiscount > 0) {
        return Math.round(subtotal * (promoDiscount / 100));
    }
    return 0;
}

function calculateTaxes(amount) {
    return 0;
}

function calculateCartTotals() {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount(subtotal);
    const subtotalAfterDiscount = subtotal - discount;
    const taxes = calculateTaxes(subtotalAfterDiscount);
    const total = subtotalAfterDiscount + taxes;
    
    return {
        subtotal: subtotal,
        discount: discount,
        taxes: taxes,
        total: total
    };
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    const newQuantity = item.quantity + change;
    
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }

    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock) {
        showToast('No hay suficiente stock disponible', 'error');
        return;
    }
    
    item.quantity = newQuantity;
    saveCartToStorage();
    updateCartUI();
}

function removeFromCart(productId) {
    const index = cart.findIndex(item => item.id === productId);
    if (index !== -1) {
        const removedItem = cart[index];
        cart.splice(index, 1);
        saveCartToStorage();
        updateCartUI();
        showToast(`${removedItem.title} eliminado del carrito`, 'success');
    }
}

function clearCart() {
    if (cart.length === 0) {
        showToast('El carrito ya está vacío', 'warning');
        return;
    }
    
    if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
        cart = [];
        window.ADDUXSHOP.cart = [];
        saveCartToStorage();
        updateCartUI();
        showToast('Carrito vaciado correctamente', 'success');
    }
}

function saveCartToStorage() {
    localStorage.setItem('adduxshop_cart', JSON.stringify(cart));
    window.ADDUXSHOP.cart = cart;
}

function updateBalanceCheck() {
    const totals = calculateCartTotals();
    const userBalance = window.ADDUXSHOP.userCoins || 0;

    const balanceEl = document.getElementById('userBalance');
    const warningEl = document.getElementById('balanceWarning');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (balanceEl) {
        balanceEl.innerHTML = `${userBalance} <i class="fas fa-coins"></i>`;
    }

    if (warningEl && checkoutBtn) {
        if (userBalance < totals.total) {
            warningEl.style.display = 'block';
            checkoutBtn.disabled = true;
        } else {
            warningEl.style.display = 'none';
            checkoutBtn.disabled = false;
        }
    }
}

function applyPromoCode() {
    const codeInput = document.getElementById('promoCode');
    const messageElement = document.getElementById('promoMessage');
    const code = codeInput.value.trim().toUpperCase();
    
    if (!code) {
        showPromoMessage('Ingresa un código promocional', 'error');
        return;
    }

    if (promoCodesData[code]) {
        promoCode = code;
        promoDiscount = promoCodesData[code].discount || 0;
        showPromoMessage(`<i class="fas fa-check"></i> ${promoDiscount}% aplicado`, 'success');
        updateCartSummary();
        updateBalanceCheck();
    } else {
        showPromoMessage('<i class="fas fa-times"></i> Código inválido', 'error');
    }
}

function showPromoMessage(message, type) {
    const messageElement = document.getElementById('promoMessage');
    if (messageElement) {

        messageElement.innerHTML = message;
        messageElement.className = `promo-message ${type}`;

        setTimeout(() => {
            messageElement.innerHTML = '';
            messageElement.className = 'promo-message';
        }, 3000);
    }
}

function proceedToCheckout() {
    if (cart.length === 0) {
        showToast('El carrito está vacío', 'error');
        return;
    }
    const totals = calculateCartTotals();
    const total = totals.total;
    const userCoins = window.ADDUXSHOP.userCoins;
    
    if (userCoins < total) {
        showToast('No tienes suficientes monedas', 'error');
        return;
    }
    
    showCheckoutModal();
}

function showCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const checkoutBalance = document.getElementById('checkoutBalance');
    
    if (!modal || !checkoutItems || !checkoutTotal) return;

    checkoutItems.innerHTML = cart.map(item => {
        const product = products.find(p => p.id === item.id);
        return `
            <div class="checkout-item">
                <span>${item.title} x${item.quantity}</span>
                <span>${item.price * item.quantity} <i class="fas fa-coins"></i></span>
            </div>
        `;
    }).join('');

    const totals = calculateCartTotals();
    checkoutTotal.innerHTML = `${totals.total} <i class="fas fa-coins"></i>`;
    if (checkoutBalance) {
        const userBalance = window.ADDUXSHOP.userCoins || 0;
        checkoutBalance.innerHTML = `${userBalance} <i class="fas fa-coins"></i>`;
    }
    
    modal.classList.add('show');
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

async function confirmPurchase() {
    const confirmBtn = document.getElementById('confirmPurchaseBtn');
    if (!confirmBtn) return;

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '⏳ Procesando...';
    
    showLoader();
    
    try {
        const userId = window.ADDUXSHOP.currentUser.uid;
        const totals = calculateCartTotals();
        const subtotal = totals.subtotal;
        const discountAmount = totals.discount;
        const taxes = totals.taxes;
        const total = totals.total;

        const userCoins = window.ADDUXSHOP.userCoins;
        if (userCoins < total) {
            throw new Error('Saldo insuficiente');
        }

        const manualItems = cart.filter(item => {
            const product = products.find(p => p.id === item.id);
            return !(product && product.accountPool);
        });

        let accountAssignments = [];
        let accountUsageUpdates = [];
        try {
            const allocation = allocateAccountsForCart();

            accountAssignments = (allocation.assignments || []).map(a => {
                const duration = a.expirationDays || DEFAULT_SUBSCRIPTION_DAYS;
                const expirationDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();
                return {
                    ...a,
                    expirationDate
                };
            });

            const usageMap = new Map();
            Object.values(allocation.updatedPools || {}).forEach(pool => {
                (pool.entries || []).forEach(entry => {
                    const originalPool = accountsData[pool.id];
                    const originalEntry = originalPool ? (originalPool.entries || []).find(e => e.id === entry.id) : null;
                    const originalCount = originalEntry ? (originalEntry.assignedCount || 0) : 0;
                    if (entry.assignedCount !== originalCount) {
                        const key = `${pool.id}_${entry.id}`;
                        usageMap.set(key, {
                            poolId: pool.id,
                            accountId: entry.id,
                            assignedCount: entry.assignedCount || 0,
                            maxProfiles: entry.maxProfiles || 4,
                            status: (entry.assignedCount || 0) >= (entry.maxProfiles || 4) ? 'full' : 'available'
                        });
                    }
                });
            });
            accountUsageUpdates = Array.from(usageMap.values());
        } catch (allocErr) {
            throw new Error(allocErr.message || 'No fue posible asignar cuentas');
        }

        const purchaseData = {
            items: cart.map(item => ({
                id: item.id,
                title: item.title,
                price: item.price,
                quantity: item.quantity
            })),
            subtotal: subtotal,
            discount: discountAmount,
            taxes: taxes,
            total: total,
            promoCode: promoCode,
            fecha: new Date().toISOString(),
            status: manualItems.length > 0 ? 'Pendiente entrega manual' : 'Completado',
            paymentMethod: 'coins'
        };

        if (manualItems.length > 0) {
            purchaseData.manualItems = manualItems.map(item => ({
                id: item.id,
                title: item.title,
                price: item.price,
                quantity: item.quantity
            }));
        }

        if (accountAssignments.length > 0) {
            purchaseData.accountAssignments = accountAssignments;
        }


        for (const usage of accountUsageUpdates) {
            const entryRef = ref(database, `accounts/${usage.poolId}/entries/${usage.accountId}`);
            await update(entryRef, {
                assignedCount: usage.assignedCount,
                maxProfiles: usage.maxProfiles,
                status: usage.status,
                updatedAt: new Date().toISOString()
            });
        }

        for (const item of cart) {
            const product = products.find(p => p.id === item.id);
            if (product) {
                const productRef = ref(database, `products/${item.id}`);
                await update(productRef, {
                    stock: product.stock - item.quantity
                });
            }
        }

        const userRef = ref(database, `users/${userId}`);
        await update(userRef, {
            coins: userCoins - total,
            lastPurchase: new Date().toISOString()
        });

        const purchasesRef = ref(database, `purchases/${userId}`);
        await push(purchasesRef, purchaseData);

        cart = [];
        window.ADDUXSHOP.cart = [];
        saveCartToStorage();

        promoCode = null;
        promoDiscount = 0;
        document.getElementById('promoCode').value = '';

        showToast('¡Compra realizada exitosamente! <i class="fas fa-check-circle"></i>', 'success');

        closeCheckoutModal();

        if (manualItems.length > 0) {
            const user = window.ADDUXSHOP.currentUser;
            const username = window.ADDUXSHOP.userData?.username || (user?.email ? user.email.split('@')[0] : 'usuario');
            const email = user?.email || '';
            const lines = manualItems.map(i => `- ${i.title} x${i.quantity}`);
            const text = `Hola, soy ${username} (${email}).\nAcabo de comprar:\n${lines.join('\n')}\nTotal: ${total} monedas.\nPor favor entregar manualmente.`;
            const supportNumber = '51971541408';
            window.open(`https://wa.me/${supportNumber}?text=${encodeURIComponent(text)}`, '_blank');
        }

        setTimeout(() => {
            window.location.href = '/perfil';
        }, 2000);
        
    } catch (error) {
        console.error('Purchase error:', error);
        showToast('Error al procesar la compra: ' + error.message, 'error');
    } finally {
        hideLoader();
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar Compra';
    }
}

window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.applyPromoCode = applyPromoCode;
window.proceedToCheckout = proceedToCheckout;
window.closeCheckoutModal = closeCheckoutModal;
window.confirmPurchase = confirmPurchase;

window.addEventListener('click', (event) => {
    const modal = document.getElementById('checkoutModal');
    if (modal && event.target === modal) {
        closeCheckoutModal();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeCheckoutModal();
    }
});




