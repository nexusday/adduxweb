

const CURRENCY_CONFIG = {
    name: 'Monedas ADDUXSHOP',
    symbol: '<i class="fas fa-coins"></i>',

    exchangeRate: {
        10: 10.00,
        25: 25.00,
        50: 50.00,
        100: 100.00
    }
};

const TRANSACTION_TYPES = {
    RECHARGE: 'recharge',
    PURCHASE: 'purchase',
    REFUND: 'refund',
    BONUS: 'bonus',
    ADMIN_ADJUSTMENT: 'admin_adjustment'
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.ADDUXSHOP.currentUser) {
        initializeCurrencySystem();
    }
});

function initializeCurrencySystem() {

    const userId = window.ADDUXSHOP.currentUser.uid;
    const coinsRef = window.firebaseDatabase.ref(`users/${userId}/coins`);
    
    coinsRef.on('value', (snapshot) => {
        const coins = snapshot.val() || 0;
        window.ADDUXSHOP.userCoins = coins;
        updateCoinDisplay();
    });

    loadTransactionHistory();
}

function updateCoinDisplay() {

    const coinElements = document.querySelectorAll('#userCoins, #userCoinsDesktop, #navCoins, #profileCoins, .coins-amount');
    coinElements.forEach(element => {

        element.textContent = window.ADDUXSHOP.userCoins;
    });
}

async function loadTransactionHistory() {
    const userId = window.ADDUXSHOP.currentUser.uid;
    const transactionsRef = window.firebaseDatabase.ref(`transactions/${userId}`);
    
    transactionsRef.on('value', (snapshot) => {
        const transactions = snapshot.val() || {};
        updateTransactionHistory(transactions);
    });
}

function updateTransactionHistory(transactions) {
    const historyContainer = document.getElementById('transactionHistory');
    if (!historyContainer) return;
    
    const transactionsArray = Object.entries(transactions).reverse();
    
    if (transactionsArray.length === 0) {
        historyContainer.innerHTML = '<p class="no-transactions">No tienes transacciones aún</p>';
        return;
    }
    
    historyContainer.innerHTML = transactionsArray.map(([id, transaction]) => {
        const typeClass = getTransactionTypeClass(transaction.type);
        const typeIcon = getTransactionTypeIcon(transaction.type);
        const amountClass = transaction.amount > 0 ? 'positive' : 'negative';
        
        return `
            <div class="transaction-item ${typeClass}">
                <div class="transaction-icon">${typeIcon}</div>
                <div class="transaction-details">
                    <div class="transaction-title">${transaction.description}</div>
                    <div class="transaction-date">${formatDate(transaction.timestamp)}</div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${transaction.amount > 0 ? '+' : ''}${transaction.amount} <i class="fas fa-coins"></i>
                </div>
            </div>
        `;
    }).join('');
}

function getTransactionTypeClass(type) {
    const classes = {
        [TRANSACTION_TYPES.RECHARGE]: 'transaction-recharge',
        [TRANSACTION_TYPES.PURCHASE]: 'transaction-purchase',
        [TRANSACTION_TYPES.REFUND]: 'transaction-refund',
        [TRANSACTION_TYPES.BONUS]: 'transaction-bonus',
        [TRANSACTION_TYPES.ADMIN_ADJUSTMENT]: 'transaction-admin'
    };
    return classes[type] || 'transaction-default';
}

function getTransactionTypeIcon(type) {
    const icons = {
        [TRANSACTION_TYPES.RECHARGE]: '<i class="fas fa-credit-card"></i>',
        [TRANSACTION_TYPES.PURCHASE]: '<i class="fas fa-shopping-cart"></i>',
        [TRANSACTION_TYPES.REFUND]: '<i class="fas fa-undo"></i>',
        [TRANSACTION_TYPES.BONUS]: '<i class="fas fa-gift"></i>',
        [TRANSACTION_TYPES.ADMIN_ADJUSTMENT]: '<i class="fas fa-cog"></i>'
    };
    return icons[type] || '<i class="fas fa-coins"></i>';
}

async function rechargeCoins(amount, paymentMethod = 'card') {
    if (!window.ADDUXSHOP.currentUser) {
        showToast('Debes iniciar sesión para recargar monedas', 'error');
        return false;
    }
    
    const validAmounts = Object.keys(CURRENCY_CONFIG.exchangeRate).map(Number);
    if (!validAmounts.includes(amount)) {
        showToast('Cantidad de recarga inválida', 'error');
        return false;
    }
    
    showLoader();
    
    try {
        const userId = window.ADDUXSHOP.currentUser.uid;
        const currentCoins = window.ADDUXSHOP.userCoins;
        const price = CURRENCY_CONFIG.exchangeRate[amount];

        const transactionData = {
            type: TRANSACTION_TYPES.RECHARGE,
            amount: amount,
            description: `Recarga de ${amount} monedas`,
            paymentMethod: paymentMethod,
            price: price,
            currency: 'PEN',
            timestamp: new Date().toISOString(),
            status: 'completed'
        };

        const transactionsRef = window.firebaseDatabase.ref(`transactions/${userId}`);
        await push(transactionsRef, transactionData);

        const userRef = window.firebaseDatabase.ref(`users/${userId}`);
        await userRef.update({
            coins: currentCoins + amount,
            lastRecharge: new Date().toISOString()
        });

        const rechargeData = {
            amount: amount,
            method: paymentMethod,
            status: 'Completado',
            fecha: new Date().toISOString(),
            price: price
        };
        
        const rechargesRef = window.firebaseDatabase.ref(`recharges/${userId}`);
        await push(rechargesRef, rechargeData);
        
        showToast(`¡Recargaste ${amount} monedas exitosamente!`, 'success');
        return true;
        
    } catch (error) {
        console.error('Recharge error:', error);
        showToast('Error al procesar la recarga', 'error');
        return false;
    } finally {
        hideLoader();
    }
}

async function processPurchase(amount, description, items = []) {
    if (!window.ADDUXSHOP.currentUser) {
        throw new Error('Usuario no autenticado');
    }
    
    const userId = window.ADDUXSHOP.currentUser.uid;
    const currentCoins = window.ADDUXSHOP.userCoins;
    
    if (currentCoins < amount) {
        throw new Error('Saldo insuficiente');
    }
    
    try {

        const transactionData = {
            type: TRANSACTION_TYPES.PURCHASE,
            amount: -amount,
            description: description,
            items: items,
            timestamp: new Date().toISOString(),
            status: 'completed'
        };

        const transactionsRef = window.firebaseDatabase.ref(`transactions/${userId}`);
        await push(transactionsRef, transactionData);

        const userRef = window.firebaseDatabase.ref(`users/${userId}`);
        await userRef.update({
            coins: currentCoins - amount,
            lastPurchase: new Date().toISOString()
        });
        
        return true;
        
    } catch (error) {
        console.error('Purchase error:', error);
        throw error;
    }
}

async function addBonusCoins(userId, amount, reason) {
    try {
        const userRef = window.firebaseDatabase.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const currentCoins = snapshot.val().coins || 0;

        const transactionData = {
            type: TRANSACTION_TYPES.BONUS,
            amount: amount,
            description: reason || 'Bono de bienvenida',
            timestamp: new Date().toISOString(),
            status: 'completed'
        };

        const transactionsRef = window.firebaseDatabase.ref(`transactions/${userId}`);
        await push(transactionsRef, transactionData);

        await userRef.update({
            coins: currentCoins + amount
        });
        
        return true;
        
    } catch (error) {
        console.error('Bonus error:', error);
        throw error;
    }
}

async function adminCoinAdjustment(userId, amount, reason) {
    try {
        const userRef = window.firebaseDatabase.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const currentCoins = snapshot.val().coins || 0;

        const transactionData = {
            type: TRANSACTION_TYPES.ADMIN_ADJUSTMENT,
            amount: amount,
            description: reason || 'Ajuste de administrador',
            timestamp: new Date().toISOString(),
            status: 'completed',
            adminId: window.ADDUXSHOP.currentUser.uid
        };

        const transactionsRef = window.firebaseDatabase.ref(`transactions/${userId}`);
        await push(transactionsRef, transactionData);

        await userRef.update({
            coins: currentCoins + amount
        });
        
        return true;
        
    } catch (error) {
        console.error('Admin adjustment error:', error);
        throw error;
    }
}

async function getCoinBalance(userId) {
    try {
        const userRef = window.firebaseDatabase.ref(`users/${userId}/coins`);
        const snapshot = await userRef.once('value');
        return snapshot.val() || 0;
    } catch (error) {
        console.error('Error getting balance:', error);
        return 0;
    }
}

async function getTransactionHistory(userId, limit = 50) {
    try {
        const transactionsRef = window.firebaseDatabase.ref(`transactions/${userId}`)
            .orderByChild('timestamp')
            .limitToLast(limit);
        
        const snapshot = await transactionsRef.once('value');
        const transactions = snapshot.val() || {};

        return Object.entries(transactions)
            .map(([id, transaction]) => ({ id, ...transaction }))
            .reverse();
    } catch (error) {
        console.error('Error getting transaction history:', error);
        return [];
    }
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function validateCoinAmount(amount) {
    const validAmounts = Object.keys(CURRENCY_CONFIG.exchangeRate).map(Number);
    return validAmounts.includes(amount);
}

function getRechargePrice(amount) {
    return CURRENCY_CONFIG.exchangeRate[amount] || 0;
}

function getRechargeBonus(amount) {

    return 0;
}

function calculateTotalCoins(amount) {

    return amount;
}

function showRechargeModal() {
    const modal = document.getElementById('rechargeModal');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeRechargeModal() {
    const modal = document.getElementById('rechargeModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

if (!window.rechargeCoins) window.rechargeCoins = rechargeCoins;
if (!window.processPurchase) window.processPurchase = processPurchase;
if (!window.addBonusCoins) window.addBonusCoins = addBonusCoins;
if (!window.adminCoinAdjustment) window.adminCoinAdjustment = adminCoinAdjustment;
if (!window.getCoinBalance) window.getCoinBalance = getCoinBalance;
if (!window.getTransactionHistory) window.getTransactionHistory = getTransactionHistory;
if (!window.validateCoinAmount) window.validateCoinAmount = validateCoinAmount;
if (!window.getRechargePrice) window.getRechargePrice = getRechargePrice;
if (!window.getRechargeBonus) window.getRechargeBonus = getRechargeBonus;
if (!window.calculateTotalCoins) window.calculateTotalCoins = calculateTotalCoins;

if (!window.openRechargeModal) window.openRechargeModal = showRechargeModal;
if (!window.closeRechargeModal) window.closeRechargeModal = closeRechargeModal;

if (!window.showRechargeModal) window.showRechargeModal = function() { if (window.openRechargeModal) return window.openRechargeModal(); return showRechargeModal(); };

window.TRANSACTION_TYPES = TRANSACTION_TYPES;
window.CURRENCY_CONFIG = CURRENCY_CONFIG;

setInterval(() => {
    if (window.ADDUXSHOP.currentUser) {
        updateCoinDisplay();
    }
}, 30000);




