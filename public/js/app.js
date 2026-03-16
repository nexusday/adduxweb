
import { database, auth } from "./base.js";
import { initCardObserver, animateAddToCart } from './ui.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let currentSlide = 0;
let products = [];
let ads = [];
let categories = [];
const CAROUSEL_INTERVAL_MS = 4000;

document.addEventListener('DOMContentLoaded', () => {
    try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch (e) { console.warn('Lucide init', e); }
    loadProducts();
    loadCategories();
    loadAds();
    initializeCarousel();
    setupScrollAnimations();
    setupSearch();
    try { updateHeroActionsByAuth(); } catch(e) {}
});


function updateHeroActionsByAuth() {
    const heroActions = document.querySelector('.hero-actions');
    const navLoggedOut = document.getElementById('loggedOutNav');
    const navLoggedIn = document.getElementById('loggedInNav');
    const isLogged = !!(window.ADDUXSHOP && window.ADDUXSHOP.currentUser);

    if (!heroActions) return;

    if (isLogged) {
        heroActions.innerHTML = `
            <a href="#productsGrid" class="btn btn-primary">Ver productos</a>
            <button class="btn btn-ghost" onclick="openRechargeModal()">Recargar monedas</button>
        `;
        if (navLoggedOut) navLoggedOut.style.display = 'none';
        if (navLoggedIn) navLoggedIn.style.display = 'flex';
    } else {
        heroActions.innerHTML = `
            <a href="/login" class="btn btn-ghost">Ingresar</a>
            <a href="/registrar" class="btn btn-primary">Registrarse</a>
        `;
        if (navLoggedOut) navLoggedOut.style.display = 'none';
        if (navLoggedIn) navLoggedIn.style.display = 'none';
    }
}

// Listen for auth state changes (emitted from base.js)
window.addEventListener('authStateChanged', () => {
    try { updateHeroActionsByAuth(); } catch(e) {}
});

function loadProducts() {
    showLoader();
    const productsRef = ref(database, 'products');
    
    onValue(productsRef, (snapshot) => {
        products = [];
        snapshot.forEach((childSnapshot) => {
            const product = {
                id: childSnapshot.key,
                ...childSnapshot.val()
            };
            products.push(product);
        });
        
        renderProducts(products);
        hideLoader();
    }, (error) => {
        console.error('Error loading products:', error);
        showToast('Error al cargar productos', 'error');
        hideLoader();
    });
}

function loadCategories() {
    const categoriesRef = ref(database, 'categories');
    onValue(categoriesRef, (snapshot) => {
        categories = [];
        snapshot.forEach(child => {
            categories.push({ id: child.key, ...child.val() });
        });

        renderProducts(products);
    }, (err) => {
        console.error('Error loading categories:', err);
    });
}

function loadAds() {
    const adsRef = ref(database, 'ads');
    
    onValue(adsRef, (snapshot) => {
        ads = [];
        snapshot.forEach((childSnapshot) => {
            const ad = {
                id: childSnapshot.key,
                ...childSnapshot.val()
            };
            ads.push(ad);
        });
        
        renderCarousel();
    }, (error) => {
        console.error('Error loading ads:', error);
    });
}

function renderProducts(productsToRender) {
    const productsGrid = document.getElementById('productsGrid');
    
    if (!productsGrid) return;
    
    if (productsToRender.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-products">
                <p>No hay productos disponibles en este momento.</p>
            </div>
        `;
        return;
    }

    const groups = {};
    productsToRender.forEach(p => {
        let raw = p.category || '';
        let resolvedKey = 'uncategorized';
        if (raw) {

            const found = categories.find(c => c.id === raw || (c.slug && c.slug === raw) || (c.name && c.name.toLowerCase() === String(raw).toLowerCase()));
            if (found) resolvedKey = found.id;
            else resolvedKey = String(raw).toLowerCase(); 
        }
        if (!groups[resolvedKey]) groups[resolvedKey] = [];
        groups[resolvedKey].push(p);
    });

    const orderedKeys = [];
    categories.forEach(c => { if (groups[c.id]) orderedKeys.push(c.id); });

    Object.keys(groups).forEach(k => { if (!orderedKeys.includes(k)) orderedKeys.push(k); });

    function productCard(product) {
        const cat = categories.find(c => c.id === product.category || c.slug === product.category || (c.name && c.name.toLowerCase() === (product.category || '').toLowerCase()));
        const catLabel = (cat && (cat.name || cat.id)) || product.category || 'General';
        const numericStock = typeof product.stock === 'number' ? product.stock : null;
        const soldOut = product.unlimited ? false : (numericStock !== null ? numericStock <= 0 : false);
        const finalPrice = product.discount || product.price;
        const original = product.discount ? formatCurrency(product.price) : '';
        const stockLabel = product.unlimited ? 'Ilimitado' : (soldOut ? 'Sin stock' : (numericStock !== null ? `${numericStock} en stock` : 'Stock no disponible'));
        const stockClass = soldOut ? 'stock-badge-empty' : 'stock-badge-ok';

        return `
        <div class="card" data-category="${product.category || 'all'}" data-product-id="${product.id}">
          <div class="card-inner">
            <div class="card-img">
                <div class="status-pill">${soldOut ? 'AGOTADO' : 'PREMIUM'}</div>
                <img loading="lazy" src="${product.image || 'https://picsum.photos/seed/' + product.id + '/400/260.jpg'}" 
                     alt="${product.title}"
                     onerror="this.src='https://picsum.photos/seed/default/400/260.jpg'">
            </div>
            <div class="card-cat">${catLabel}</div>
            <h3 class="card-title">${product.title}</h3>
            ${renderCardDescBlock(product)}
            <div class="card-stock"><span class="stock-badge ${stockClass}"><i class="fas fa-box"></i> ${stockLabel}</span></div>
            <div class="card-footer">
                <div class="price-block">
                    ${original ? `<small class="price-original">${original}</small>` : ''}
                    <span class="price">${formatCurrency(finalPrice)}</span>
                </div>
                <button class="add-btn" onclick="addToCart('${product.id}')" ${soldOut ? 'disabled' : ''} aria-label="Agregar al carrito">
                    <i data-lucide="plus"></i>
                </button>
            </div>
          </div>
        </div>
        `;
    }

    productsGrid.innerHTML = orderedKeys.map(key => {

        let display = key === 'uncategorized' ? 'Otros' : key;
        const cat = categories.find(c => c.id === key || c.slug === key || (c.name && c.name.toLowerCase() === (key||'').toLowerCase()));
        if (cat) display = cat.name.toUpperCase();
        else if (typeof key === 'string') display = String(key).toUpperCase();

        return `
            <section class="category-section">
                <h2 class="category-heading">${display}</h2>
                <div class="category-products">
                    ${groups[key].map(p => productCard(p)).join('')}
                </div>
            </section>
        `;
    }).join('');

    
    try {
        attachCardClickHandlers();
    } catch (e) { /* ignore */ }

    try {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    } catch (err) {
        console.warn('Lucide icon init error:', err);
    }
    
    try { initCardObserver(document); } catch (e) { /* ignore */ }
    
    try { attachCardClickHandlers(); } catch (e) { /* ignore */ }
}

function attachCardClickHandlers() {
    document.querySelectorAll('.card').forEach(card => {
        
        card.removeEventListener('click', card._detailClickHandler);
        const handler = (ev) => {
            
            if (ev.target.closest('.add-btn') || ev.target.closest('button')) return;
            const id = card.dataset.productId;
            if (!id) return;
            const product = products.find(p => p.id === id);
            if (!product) return;
            ensureDescriptionModal();
            openDescriptionModal(product.title || 'Descripción', product.description || 'Sin descripción disponible.');
        };
        card._detailClickHandler = handler;
        card.addEventListener('click', handler);
    });
}

function renderCardDescription(product) {
    const full = (product.description || '').trim();
    if (!full) return 'Sin descripción disponible.';
    const limit = 200;
    const text = full.length <= limit ? full : (full.slice(0, limit) + '...');
    return escapeHtml(text);
}

function renderCardDescBlock(product) {
    const descHtml = renderCardDescription(product);
    return `
        <div class="desc-block">
            <p class="card-desc">${descHtml}</p>
        </div>
    `;
}

function handleDescMoreClick(e) {
    e.preventDefault();
    const id = e.currentTarget.dataset.productId;
    if (!id) return;
    const product = products.find(p => p.id === id);
    if (!product) return;
    ensureDescriptionModal();
    openDescriptionModal(product.title || 'Descripción', product.description || 'Sin descripción disponible.');
}

function ensureDescriptionModal() {
    if (document.getElementById('descriptionModal')) return;
    const modal = document.createElement('div');
    modal.id = 'descriptionModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="descriptionModalTitle">Descripción</h3>
                <button class="modal-close" id="descriptionModalClose">×</button>
            </div>
            <div class="modal-body" id="descriptionModalBody"></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('descriptionModalClose').addEventListener('click', () => closeDescriptionModal());
    modal.addEventListener('click', (ev) => { if (ev.target === modal) closeDescriptionModal(); });
}

function openDescriptionModal(title, bodyHtml) {
    const modal = document.getElementById('descriptionModal');
    if (!modal) return;
    const titleEl = document.getElementById('descriptionModalTitle');
    const bodyEl = document.getElementById('descriptionModalBody');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) {
        // preserve line breaks
        bodyEl.innerHTML = escapeHtml(bodyHtml).replace(/\n/g, '<br>');
    }
    modal.classList.add('show');
}

function closeDescriptionModal() {
    const modal = document.getElementById('descriptionModal');
    if (!modal) return;
    modal.classList.remove('show');
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s]);
}

function filterProducts(category) {
    const filteredProducts = category === 'all' 
        ? products 
        : products.filter(product => (product.category || 'all') === category);
    
    renderProducts(filteredProducts);

    const filterButtons = document.querySelectorAll('.products-filter .btn');
    filterButtons.forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    });
    event.target.classList.remove('btn-outline');
    event.target.classList.add('btn-primary');
}

function setupSearch() {
    const input = document.getElementById('productSearch');
    if (!input) return;

    input.addEventListener('input', (event) => {
        const query = (event.target.value || '').toLowerCase();
        if (!query) {
            renderProducts(products);
            return;
        }
        const filtered = products.filter(p => {
            const title = (p.title || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            const cat = (p.category || '').toLowerCase();
            return title.includes(query) || desc.includes(query) || cat.includes(query);
        });
        renderProducts(filtered);
    });
}

function addToCart(productId) {
    if (!window.requireAuth()) return;
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (!product.unlimited && (typeof product.stock === 'number' && product.stock <= 0)) {
        showToast('Producto agotado', 'error');
        return;
    }

    const existingItem = window.ADDUXSHOP.cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        window.ADDUXSHOP.cart.push({
            id: product.id,
            title: product.title,
            price: product.discount || product.price,
            image: product.image,
            quantity: 1
        });
    }

    localStorage.setItem('adduxshop_cart', JSON.stringify(window.ADDUXSHOP.cart));
    
    showToast(`${product.title} agregado al carrito`, 'success');
    updateCartUI();
    // animate image flying to cart
    try {
        const card = document.querySelector(`.card[data-product-id="${productId}"]`);
        const img = card ? card.querySelector('.card-img img') : null;
        const cartBtn = document.querySelector('.user-menu-btn') || document.querySelector('#navCart') || document.querySelector('.nav-actions');
        if (img) animateAddToCart(img, cartBtn);
    } catch (e) { /* ignore animation errors */ }
}

function updateCartUI() {
    const cartCount = window.ADDUXSHOP.cart.reduce((total, item) => total + item.quantity, 0);
    const cartLinks = document.querySelectorAll('a[href="/carrito-compra"]');
    
    cartLinks.forEach(link => {
        if (cartCount > 0) {
            link.innerHTML = `<i class="fas fa-shopping-cart"></i> Carrito (${cartCount})`;
        } else {
            link.innerHTML = '<i class="fas fa-shopping-cart"></i> Carrito';
        }
    });
}

function initializeCarousel() {

    setInterval(() => {
        if (ads.length > 1) {
            changeSlide(1);
        }
    }, CAROUSEL_INTERVAL_MS);
}

function renderCarousel() {
    const carouselInner = document.getElementById('carouselInner');
    
    if (!carouselInner || ads.length === 0) {
        if (carouselInner) {
            carouselInner.innerHTML = `
                <div class="carousel-item" style="background-image: linear-gradient(120deg, #101520, #0c1a2b);">
                </div>
            `;
            carouselInner.style.transform = 'translateX(0)';
        }
        return;
    }
    
    carouselInner.innerHTML = ads.map(ad => {
        const src = ad.image || ad.imageUrl || 'https://picsum.photos/seed/adduxshop-ad/1200/600.jpg';
        return `
        <div class="carousel-item" style="background-image: url('${src}');">
        </div>`;
    }).join('');

    currentSlide = 0;
    carouselInner.style.transform = 'translateX(0)';
}

function changeSlide(direction) {
    const carouselInner = document.getElementById('carouselInner');
    if (!carouselInner || ads.length === 0) return;
    
    currentSlide += direction;
    
    if (currentSlide >= ads.length) {
        currentSlide = 0;
    } else if (currentSlide < 0) {
        currentSlide = ads.length - 1;
    }
    
    carouselInner.style.transform = `translateX(-${currentSlide * 100}%)`;
}

function logout() {
    signOut(auth).then(() => {
        showToast('Sesión cerrada correctamente', 'success');
        window.ADDUXSHOP.cart = [];
        localStorage.removeItem('adduxshop_cart');
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    }).catch((error) => {
        console.error('Logout error:', error);
        showToast('Error al cerrar sesión', 'error');
    });
}

function loadCartFromStorage() {
    const savedCart = localStorage.getItem('adduxshop_cart');
    if (savedCart) {
        try {
            window.ADDUXSHOP.cart = JSON.parse(savedCart);
            updateCartUI();
        } catch (error) {
            console.error('Error loading cart:', error);
            window.ADDUXSHOP.cart = [];
        }
    }
}

function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.card, .product-card, .feature-icon').forEach(el => {
        observer.observe(el);
    });
}

function searchProducts(query) {
    if (!query) {
        renderProducts(products);
        return;
    }
    
    const filteredProducts = products.filter(product => 
        product.title.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase())
    );
    
    renderProducts(filteredProducts);
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadCartFromStorage();
});

window.addToCart = addToCart;
window.filterProducts = filterProducts;
window.changeSlide = changeSlide;
window.logout = logout;
window.searchProducts = searchProducts;
window.scrollToSection = scrollToSection;




