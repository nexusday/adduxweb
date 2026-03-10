require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = path.resolve(__dirname);


const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || ADMIN_PASS || 'change_this_secret';
if (!ADMIN_USER || !ADMIN_PASS) {
  console.warn('Admin auth deshabilitada: define ADMIN_USER y ADMIN_PASS en el entorno o .env');
}

app.use(express.json());


const denyList = [
  /^\/\.env$/i,
  /^\/serviceAccountKey\.json$/i,
  /^\/package(?:-lock)?\.json$/i,
  /^\/index\.js$/i,
  /^\/app\.js$/i,
  /^\/server\.js$/i
];
app.use((req, res, next) => {
  const p = req.path || '';
  if (denyList.some(rx => rx.test(p))) return res.status(404).send('Not found');
  next();
});


app.post('/api/admin/verify', (req, res) => {
  const { user, pass } = req.body || {};
  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(500).json({ ok: false, message: 'Server admin not configured' });
  }
  if (String(user) === String(ADMIN_USER) && String(pass) === String(ADMIN_PASS)) {
    // create simple signed token with expiry (7 days)
    const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const payload = JSON.stringify({ user: ADMIN_USER, exp: expires });
    const payloadB = Buffer.from(payload).toString('base64');
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB).digest('hex');
    const token = `${payloadB}.${sig}`;
    // set httpOnly cookie
    res.cookie('admin_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, message: 'Invalid credentials' });
});

// endpoint to check admin session cookie
app.get('/api/admin/session', (req, res) => {
  try {
    const cookie = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('admin_session='));
    if (!cookie) return res.json({ ok: false });
    const token = cookie.split('=')[1];
    if (!token) return res.json({ ok: false });
    const parts = token.split('.');
    if (parts.length !== 2) return res.json({ ok: false });
    const payloadB = parts[0];
    const sig = parts[1];
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.json({ ok: false });
    const payload = JSON.parse(Buffer.from(payloadB, 'base64').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return res.json({ ok: false });
    return res.json({ ok: true, user: payload.user });
  } catch (err) {
    return res.json({ ok: false });
  }
});

// logout clears cookie
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_session', { httpOnly: true, sameSite: 'lax' });
  return res.json({ ok: true });
});


const friendlyMap = {
  '/index.html': '/',
  '/perfil.html': '/perfil',
  '/register.html': '/registrar',
  '/register_old.html': '/registrar',
  '/register%20.html': '/registrar',
  '/login.html': '/login',
  '/carrito.html': '/carrito-compra',
  '/admin.html': '/panel',
  '/comunidades.html': '/comunidades'
};
app.use((req, res, next) => {
  const p = req.path || '';
  if (p.endsWith('.html')) {
    const target = friendlyMap[p];
    if (target) return res.redirect(301, target);
  }
  next();
});


app.use(express.static(BASE));


app.get('/', (req, res) => res.sendFile(path.join(BASE, 'index.html')));
app.get('/perfil', (req, res) => res.sendFile(path.join(BASE, 'perfil.html')));
app.get('/registrar', (req, res) => res.sendFile(path.join(BASE, 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(BASE, 'login.html')));
app.get('/carrito-compra', (req, res) => res.sendFile(path.join(BASE, 'carrito.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(BASE, 'admin.html')));
app.get('/comunidades', (req, res) => res.sendFile(path.join(BASE, 'comunidades.html')));


app.use((req, res) => res.sendFile(path.join(BASE, 'index.html')));

app.listen(PORT, () => console.log(`Servidor Express escuchando en http://localhost:${PORT}`));

module.exports = app;
