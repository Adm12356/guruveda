const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

const EVENT_DIR = path.join(__dirname, '..', 'public', 'images', 'events');
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

/* ---------- helpers ---------- */
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const tooMany = ip => { const a = attempts.get(ip); return a && a.count >= 5 && Date.now() - a.first < WINDOW; };
const recordFail = ip => {
  const now = Date.now(); const a = attempts.get(ip);
  if (!a || now - a.first > WINDOW) attempts.set(ip, { count: 1, first: now }); else a.count++;
};

const pad = n => String(n).padStart(2, '0');
const toInput = d => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };

const firstFile = f => (Array.isArray(f) ? f[0] : f);
async function saveImage(file) {
  const ext = path.extname(file.name).toLowerCase();
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  await file.mv(path.join(EVENT_DIR, name));
  return name;
}
function removeImage(name) {
  if (name) fs.unlink(path.join(EVENT_DIR, path.basename(name)), () => {});
}

/* ---------- session, csrf ---------- */
router.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  res.locals.admin = req.session.admin || null;
  res.set('Cache-Control', 'no-store');
  next();
});
router.use((req, res, next) => {
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).render('error', { title: 'Session expired', heading: 'Session expired', message: 'Please go back, refresh the page and try again.' });
  }
  next();
});
const requireAuth = (req, res, next) => (req.session.admin ? next() : res.redirect('/admin/login'));

/* ---------- login / logout ---------- */
router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin login', error: null });
});

router.post('/login', async (req, res, next) => {
  const ip = req.ip;
  if (tooMany(ip)) return res.status(429).render('admin/login', { title: 'Admin login', error: 'Too many attempts. Please wait 15 minutes and try again.' });
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    const ok = rows.length && await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) {
      recordFail(ip);
      return res.status(401).render('admin/login', { title: 'Admin login', error: 'Incorrect username or password.' });
    }
    attempts.delete(ip);
    const user = { id: rows[0].id, username: rows[0].username };
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.admin = user;
      req.session.csrf = crypto.randomBytes(24).toString('hex');
      res.redirect('/admin');
    });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.use(requireAuth);

/* ---------- dashboard ---------- */
router.get('/', async (req, res, next) => {
  try {
    const [[ev]] = await db.query('SELECT COUNT(*) AS n FROM events WHERE event_date >= NOW()');
    const [[ba]] = await db.query('SELECT COUNT(*) AS n FROM batches WHERE is_active = 1');
    const [[me]] = await db.query('SELECT COUNT(*) AS n FROM contact_messages');
    const [recent] = await db.query('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 5');
    res.render('admin/dashboard', { title: 'Dashboard', counts: { events: ev.n, batches: ba.n, messages: me.n }, recent });
  } catch (err) { next(err); }
});

/* ---------- events ---------- */
const parseEvent = b => ({
  title: (b.title || '').trim(),
  description: (b.description || '').trim(),
  event_date: (b.event_date || '').trim(),
  location: (b.location || '').trim()
});
function eventErrors(ev, file) {
  const errors = [];
  if (ev.title.length < 3) errors.push('Please enter an event title.');
  if (!ev.event_date || isNaN(new Date(ev.event_date))) errors.push('Please choose a valid date and time.');
  if (file && !ALLOWED_EXT.includes(path.extname(file.name).toLowerCase())) errors.push('The photo must be a JPG, PNG or WEBP file.');
  return errors;
}

router.get('/events', async (req, res, next) => {
  try {
    const [events] = await db.query('SELECT * FROM events ORDER BY event_date DESC');
    res.render('admin/events', { title: 'Events', events });
  } catch (err) { next(err); }
});

router.get('/events/new', (req, res) => {
  res.render('admin/event-form', { title: 'Add event', ev: { title: '', description: '', event_date: '', location: '', image: null }, errors: [], action: '/admin/events', isEdit: false });
});

router.post('/events', async (req, res, next) => {
  const ev = parseEvent(req.body);
  const file = firstFile(req.files && req.files.image);
  const errors = eventErrors(ev, file);
  if (errors.length) return res.status(400).render('admin/event-form', { title: 'Add event', ev: { ...ev, image: null }, errors, action: '/admin/events', isEdit: false });
  try {
    const image = file ? await saveImage(file) : null;
    await db.query('INSERT INTO events (title, description, event_date, location, image) VALUES (?, ?, ?, ?, ?)',
      [ev.title, ev.description || null, ev.event_date.replace('T', ' '), ev.location || null, image]);
    req.session.flash = { type: 'success', text: 'Event added.' };
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

router.get('/events/:id/edit', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/events');
    const ev = { ...rows[0], event_date: toInput(rows[0].event_date) };
    res.render('admin/event-form', { title: 'Edit event', ev, errors: [], action: `/admin/events/${ev.id}`, isEdit: true });
  } catch (err) { next(err); }
});

router.post('/events/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/events');
    const old = rows[0];
    const ev = parseEvent(req.body);
    const file = firstFile(req.files && req.files.image);
    const removePhoto = req.body.remove_image === '1';
    const errors = eventErrors(ev, file);
    if (errors.length) return res.status(400).render('admin/event-form', { title: 'Edit event', ev: { ...ev, id: old.id, image: old.image }, errors, action: `/admin/events/${old.id}`, isEdit: true });

    let image = old.image;
    if (file) { image = await saveImage(file); removeImage(old.image); }
    else if (removePhoto) { removeImage(old.image); image = null; }

    await db.query('UPDATE events SET title=?, description=?, event_date=?, location=?, image=? WHERE id=?',
      [ev.title, ev.description || null, ev.event_date.replace('T', ' '), ev.location || null, image, old.id]);
    req.session.flash = { type: 'success', text: 'Event updated.' };
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

router.post('/events/:id/delete', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT image FROM events WHERE id = ?', [req.params.id]);
    if (rows.length) { removeImage(rows[0].image); await db.query('DELETE FROM events WHERE id = ?', [req.params.id]); }
    req.session.flash = { type: 'success', text: 'Event deleted.' };
    res.redirect('/admin/events');
  } catch (err) { next(err); }
});

/* ---------- batches ---------- */
const MODES = ['Offline', 'Online', 'Hybrid'];
const parseBatch = b => ({
  name: (b.name || '').trim(),
  level: (b.level || '').trim(),
  age_group: (b.age_group || '').trim(),
  days: (b.days || '').trim(),
  timing: (b.timing || '').trim(),
  mode: MODES.includes(b.mode) ? b.mode : 'Offline',
  seats_left: parseInt(b.seats_left, 10),
  fee: (b.fee || '').trim(),
  is_active: b.is_active ? 1 : 0
});
function batchErrors(b) {
  const errors = [];
  if (!b.name) errors.push('Please enter the batch name.');
  if (!b.level) errors.push('Please enter the level.');
  if (!b.age_group) errors.push('Please enter the age group.');
  if (!b.days) errors.push('Please enter the days.');
  if (!b.timing) errors.push('Please enter the timing.');
  if (isNaN(b.seats_left) || b.seats_left < 0) errors.push('Seats left must be 0 or more.');
  return errors;
}
const blankBatch = { name: '', level: '', age_group: '', days: '', timing: '', mode: 'Offline', seats_left: 10, fee: '', is_active: 1 };

router.get('/batches', async (req, res, next) => {
  try {
    const [batches] = await db.query('SELECT * FROM batches ORDER BY id ASC');
    res.render('admin/batches', { title: 'Batches', batches });
  } catch (err) { next(err); }
});

router.get('/batches/new', (req, res) => {
  res.render('admin/batch-form', { title: 'Add batch', b: blankBatch, errors: [], action: '/admin/batches', isEdit: false, modes: MODES });
});

router.post('/batches', async (req, res, next) => {
  const b = parseBatch(req.body);
  const errors = batchErrors(b);
  if (errors.length) return res.status(400).render('admin/batch-form', { title: 'Add batch', b, errors, action: '/admin/batches', isEdit: false, modes: MODES });
  try {
    await db.query('INSERT INTO batches (name, level, age_group, days, timing, mode, seats_left, fee, is_active) VALUES (?,?,?,?,?,?,?,?,?)',
      [b.name, b.level, b.age_group, b.days, b.timing, b.mode, b.seats_left, b.fee || null, b.is_active]);
    req.session.flash = { type: 'success', text: 'Batch added.' };
    res.redirect('/admin/batches');
  } catch (err) { next(err); }
});

router.get('/batches/:id/edit', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/batches');
    res.render('admin/batch-form', { title: 'Edit batch', b: { ...rows[0], fee: rows[0].fee || '' }, errors: [], action: `/admin/batches/${rows[0].id}`, isEdit: true, modes: MODES });
  } catch (err) { next(err); }
});

router.post('/batches/:id', async (req, res, next) => {
  const b = parseBatch(req.body);
  const errors = batchErrors(b);
  if (errors.length) return res.status(400).render('admin/batch-form', { title: 'Edit batch', b, errors, action: `/admin/batches/${req.params.id}`, isEdit: true, modes: MODES });
  try {
    await db.query('UPDATE batches SET name=?, level=?, age_group=?, days=?, timing=?, mode=?, seats_left=?, fee=?, is_active=? WHERE id=?',
      [b.name, b.level, b.age_group, b.days, b.timing, b.mode, b.seats_left, b.fee || null, b.is_active, req.params.id]);
    req.session.flash = { type: 'success', text: 'Batch updated.' };
    res.redirect('/admin/batches');
  } catch (err) { next(err); }
});

router.post('/batches/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM batches WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', text: 'Batch deleted. Its students are now unassigned.' };
    res.redirect('/admin/batches');
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      req.session.flash = { type: 'danger', text: 'This batch still has exams. Delete or move those exams first, or untick "Show on website" to hide the batch.' };
      return res.redirect('/admin/batches');
    }
    next(err);
  }
});

/* ---------- messages ---------- */
router.get('/messages', async (req, res, next) => {
  try {
    const [messages] = await db.query('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 300');
    res.render('admin/messages', { title: 'Messages', messages });
  } catch (err) { next(err); }
});

router.post('/messages/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', text: 'Message deleted.' };
    res.redirect('/admin/messages');
  } catch (err) { next(err); }
});

router.use(require('./admin-exams'));

module.exports = router;
