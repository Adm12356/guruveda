const express = require('express');
const db = require('../db');
const router = express.Router();

// Home page slider. Put images in public/images/slider/ and set the file name below.
// Until an image exists, the slide shows a colour background.
const slides = [
  { image: 'slide-1.jpg', tone: 'ink',   title: 'Little fingers. Fast minds.', text: 'Abacus classes that turn maths into a game children love.', cta: { label: 'See batches', href: '/batches' } },
  { image: 'slide-2.jpg', tone: 'teal',  title: 'Calculate in your head, in seconds.', text: 'Structured levels from beginner to advanced, with certificates at every step.', cta: { label: 'About our method', href: '/about' } },
  { image: 'slide-3.jpg', tone: 'coral', title: 'Compete. Celebrate. Grow.', text: 'Join our championships, workshops and annual day.', cta: { label: 'View events', href: '/events' } }
];

router.get('/', async (req, res, next) => {
  try {
    const [events] = await db.query('SELECT * FROM events WHERE event_date >= NOW() ORDER BY event_date ASC LIMIT 3');
    const [batches] = await db.query('SELECT * FROM batches WHERE is_active = 1 ORDER BY id ASC LIMIT 3');
    res.render('home', { title: 'Home', slides, events, batches });
  } catch (err) { next(err); }
});

router.get('/about', (req, res) => {
  res.render('about', { title: 'About us' });
});

router.get('/events', async (req, res, next) => {
  try {
    const [upcoming] = await db.query('SELECT * FROM events WHERE event_date >= NOW() ORDER BY event_date ASC');
    const [past] = await db.query('SELECT * FROM events WHERE event_date < NOW() ORDER BY event_date DESC LIMIT 12');
    res.render('events', { title: 'Events', upcoming, past });
  } catch (err) { next(err); }
});

router.get('/batches', async (req, res, next) => {
  try {
    const [batches] = await db.query('SELECT * FROM batches WHERE is_active = 1 ORDER BY id ASC');
    res.render('batches', { title: 'Batches', batches });
  } catch (err) { next(err); }
});

router.get('/contact', async (req, res, next) => {
  try {
    const [batches] = await db.query('SELECT name FROM batches WHERE is_active = 1 ORDER BY id ASC');
    // Cookie remembers name/phone from a previous visit
    const saved = req.cookies.visitor ? safeParse(req.cookies.visitor) : {};
    res.render('contact', {
      title: 'Contact',
      batches,
      form: { name: saved.name || '', phone: saved.phone || '', email: '', batch_interest: req.query.batch || '', message: '' },
      errors: []
    });
  } catch (err) { next(err); }
});

router.post('/contact', async (req, res, next) => {
  const form = {
    name: (req.body.name || '').trim(),
    phone: (req.body.phone || '').trim(),
    email: (req.body.email || '').trim(),
    batch_interest: (req.body.batch_interest || '').trim(),
    message: (req.body.message || '').trim()
  };
  const errors = [];
  if (form.name.length < 2) errors.push('Please enter your name.');
  if (!/^[0-9+\s-]{7,15}$/.test(form.phone)) errors.push('Please enter a valid phone number.');
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.push('Please enter a valid email address.');
  if (form.message.length < 5) errors.push('Please write a short message.');

  try {
    if (errors.length) {
      const [batches] = await db.query('SELECT name FROM batches WHERE is_active = 1 ORDER BY id ASC');
      return res.status(400).render('contact', { title: 'Contact', batches, form, errors });
    }
    await db.query(
      'INSERT INTO contact_messages (name, phone, email, batch_interest, message) VALUES (?, ?, ?, ?, ?)',
      [form.name, form.phone, form.email || null, form.batch_interest || null, form.message]
    );
    res.cookie('visitor', JSON.stringify({ name: form.name, phone: form.phone }), { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax' });
    req.session.flash = { type: 'success', text: `Thank you, ${form.name}. We have received your message and will call you soon.` };
    res.redirect('/contact');
  } catch (err) { next(err); }
});

function safeParse(str) { try { return JSON.parse(str); } catch { return {}; } }

module.exports = router;
