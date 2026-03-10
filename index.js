require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = path.resolve(__dirname);


const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
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
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, message: 'Invalid credentials' });
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
