// Animations using GSAP for higher-end effects. Falls back gracefully if GSAP missing.
document.addEventListener('DOMContentLoaded', () => {
  const gsapAvailable = !!(window.gsap && typeof window.gsap.to === 'function');
  if (!gsapAvailable) return;

  const { gsap } = window;

  // Nav entrance
  gsap.from('.navbar', { y: -30, opacity: 0, duration: 0.9, ease: 'power3.out' });

  // Hero timeline
  const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  heroTl.from('.elite-hero h1', { y: 24, opacity: 0, duration: 0.9 })
    .from('.hero-subtitle', { y: 18, opacity: 0, duration: 0.7 }, '-=0.5')
    .from('.hero-actions .btn', { y: 10, opacity: 0, stagger: 0.12, duration: 0.5 }, '-=0.4')
    .from('.hero-meta .meta-chip', { y: 8, opacity: 0, stagger: 0.06, duration: 0.4 }, '-=0.4');

  // Ambient glow float
  gsap.to('.ambient-glow', { x: -60, y: -40, duration: 18, repeat: -1, yoyo: true, ease: 'sine.inOut' });

  // Reveal product cards with stagger when in viewport
  gsap.utils.toArray('.card').forEach((card, i) => {
    gsap.set(card, { opacity: 0, y: 24 });
    gsap.to(card, { opacity: 1, y: 0, duration: 0.8, delay: i * 0.06, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 85%' } });
  });

  // 3D tilt for cards
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    const inner = card.querySelector('.card-inner') || card;
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotY = (px - 0.5) * 10; // -5..5 deg
      const rotX = (0.5 - py) * 10;
      gsap.to(inner, { rotationY: rotY, rotationX: rotX, transformPerspective: 800, transformOrigin: 'center', duration: 0.4, ease: 'power3.out' });
      card.classList.add('tilt');
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(inner, { rotationY: 0, rotationX: 0, duration: 0.6, ease: 'elastic.out(1, 0.6)' });
      card.classList.remove('tilt');
    });
  });

  // Cursor spotlight follow
  const spotlight = document.createElement('div');
  spotlight.className = 'cursor-spotlight';
  document.body.appendChild(spotlight);
  document.addEventListener('mousemove', (e) => {
    gsap.to(spotlight, { x: e.clientX, y: e.clientY, duration: 0.12, ease: 'power2.out' });
    spotlight.classList.add('active');
  });
  document.addEventListener('mouseleave', () => spotlight.classList.remove('active'));

  // Floating subtle parallax for hero image
  const heroImg = document.querySelector('.hero-title-logo');
  if (heroImg) gsap.to(heroImg, { y: -6, rotation: 2, duration: 6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
});
