// util de UI: toasts, animaciones y observador de tarjetas
const ANIM_TIME = 900;

export function showToast(message = '', type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
  t.textContent = message;
  document.body.appendChild(t);
  // force reflow
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 2200);
}

export function animateAddToCart(imgEl, targetEl) {
  if (!imgEl || !targetEl) return;
  const imgRect = imgEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  const clone = imgEl.cloneNode(true);
  clone.style.width = imgRect.width + 'px';
  clone.style.height = imgRect.height + 'px';
  clone.style.left = imgRect.left + 'px';
  clone.style.top = imgRect.top + 'px';
  clone.style.position = 'fixed';
  clone.style.zIndex = 3000;
  clone.classList.add('fly-image');
  document.body.appendChild(clone);
  // trigger animation (prefer GSAP when available)
  const translateX = (targetRect.left + targetRect.width / 2) - (imgRect.left + imgRect.width / 2);
  const translateY = (targetRect.top + targetRect.height / 2) - (imgRect.top + imgRect.height / 2);

  if (window.gsap && typeof window.gsap.to === 'function') {
    window.gsap.set(clone, { x: 0, y: 0, opacity: 1 });
    window.gsap.to(clone, { duration: 0.9, x: translateX, y: translateY, scale: 0.16, opacity: 0.16, ease: 'power3.inOut', onComplete() {
      clone.remove();
      showToast('Añadido al carrito', 'success');
      document.dispatchEvent(new CustomEvent('app.itemAddedToCart'));
    }});
  } else {
    requestAnimationFrame(() => {
      clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.16)`;
      clone.style.opacity = '0.9';
    });

    setTimeout(() => {
      clone.remove();
      showToast('Añadido al carrito', 'success');
      document.dispatchEvent(new CustomEvent('app.itemAddedToCart'));
    }, ANIM_TIME);
  }
}

// Observador simple para revelar tarjetas con stagger
export function initCardObserver(root = document) {
  const cards = Array.from(root.querySelectorAll('.card'));
  cards.forEach((c, i) => { c.classList.add('reveal'); c.dataset._revealIndex = i; });

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const idx = Number(el.dataset._revealIndex || 0);
      setTimeout(() => el.classList.add('visible'), idx * 70);
      setTimeout(() => el.classList.add('revealed'), idx * 70 + 600);
      obs.unobserve(el);
    });
  }, { threshold: 0.12 });

  cards.forEach(c => obs.observe(c));
}

// Delegación: capturar clicks en botones .add-btn y ejecutar animación
function delegateAddToCart() {
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.add-btn');
    if (!btn) return;
    const card = btn.closest('.card');
    const img = card ? card.querySelector('.card-img img') : null;
    const cartBtn = document.querySelector('.user-menu-btn') || document.querySelector('#navCart') || document.querySelector('.nav-actions');
    if (img && cartBtn) animateAddToCart(img, cartBtn);
  });
}

// inicializar automaticamente
document.addEventListener('DOMContentLoaded', () => {
  try { initCardObserver(document); } catch (e) {}
  try { delegateAddToCart(); } catch (e) {}
  try { initMobileNav(); } catch (e) {}
});

export default { showToast, animateAddToCart, initCardObserver };

// Mobile nav: toggle mobile drawer
function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  if (!toggle) return;
  // create mobile drawer if not present
  let drawer = document.getElementById('mobileMenu');
    if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'mobileMenu';
    drawer.className = 'mobile-drawer';
    drawer.innerHTML = `
      <div class="mobile-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="logo-box"><img src="imagenes/logo-shop.png" alt="logo" style="width:36px;height:36px;border-radius:8px"></div>
          <strong>ADDUX SHOP</strong>
        </div>
        <button id="mobileClose" class="hamburger-btn" aria-label="Cerrar"><span class="bar"></span><span class="bar"></span><span class="bar"></span></button>
      </div>
      <nav class="mobile-links">
        <a href="#productos">Productos</a>
        <a href="/carrito-compra">Carrito</a>
        <a href="/comunidades">Comunidades</a>
        <a href="https://wa.me/51971541408" target="_blank">Soporte</a>
      </nav>
      <div class="mobile-actions"><!-- auth actions injected by app.js when needed --></div>
    `;
    document.body.appendChild(drawer);
  }

  const closeBtn = document.getElementById('mobileClose');
  function open() { drawer.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function close() { drawer.classList.remove('open'); document.body.style.overflow = ''; }
  toggle.addEventListener('click', (e) => { e.stopPropagation(); if (drawer.classList.contains('open')) close(); else open(); });
  if (closeBtn) closeBtn.addEventListener('click', close);
  // close when clicking outside drawer
  document.addEventListener('click', (ev) => {
    if (!drawer.classList.contains('open')) return;
    if (!drawer.contains(ev.target) && !toggle.contains(ev.target)) close();
  });
  // close on resize > 720
  window.addEventListener('resize', () => { if (window.innerWidth > 720) close(); });
}
