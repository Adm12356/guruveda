const express = require('express');
const db = require('../db');
const router = express.Router();

// Home page slider. Put images in public/images/slider/ and set the file name below.
// Until an image exists, the slide shows a colour background.
const slides = [
  { image: 'slide1.jpeg', tone: 'ink',   title: 'Little fingers. Fast minds.', text: 'Abacus classes that turn maths into a game children love.', cta: { label: 'Book a demo', href: '/contact' } },
  { image: 'slide2.jpeg', tone: 'teal',  title: 'Calculate in your head, in seconds.', text: 'Structured levels from beginner to advanced, with certificates at every step.', cta: { label: 'About our method', href: '/about' } },
  { image: 'slide3.jpeg', tone: 'coral', title: 'Compete. Celebrate. Grow.', text: 'Join our championships, workshops and annual day.', cta: { label: 'View events', href: '/events' } }
];

router.get('/', async (req, res) => {
  let events = [];
  try {
    const [rows] = await db.query('SELECT * FROM events WHERE event_date >= NOW() ORDER BY event_date ASC LIMIT 3');
    events = rows;
  } catch (err) {
    console.warn('[Pages] Could not load events for homepage (database may be connecting):', err.message);
  }
  res.render('home', { title: 'Home', slides, events });
});

router.get('/about', async (req, res) => {
  let mainBranches = [], franchises = [];
  try {
    const [rows] = await db.query('SELECT type, name, note FROM branches ORDER BY sort_order, id');
    mainBranches = rows.filter(r => r.type === 'main');
    franchises = rows.filter(r => r.type === 'franchise');
  } catch (err) {
    console.warn('[Pages] Could not load branches:', err.message);
  }
  res.render('about', { title: 'About us', mainBranches, franchises });
});

router.get('/events', async (req, res) => {
  let upcoming = [], past = [];
  try {
    const [u] = await db.query('SELECT * FROM events WHERE event_date >= NOW() ORDER BY event_date ASC');
    const [p] = await db.query('SELECT * FROM events WHERE event_date < NOW() ORDER BY event_date DESC LIMIT 12');
    upcoming = u;
    past = p;
  } catch (err) {
    console.warn('[Pages] Could not load events list:', err.message);
  }
  res.render('events', { title: 'Events', upcoming, past });
});

router.get('/contact', async (req, res, next) => {
  try {
    // Cookie remembers name/phone from a previous visit
    const saved = req.cookies.visitor ? safeParse(req.cookies.visitor) : {};
    res.render('contact', {
      title: 'Contact',
      form: { name: saved.name || '', phone: saved.phone || '', email: '', message: '' },
      errors: []
    });
  } catch (err) { next(err); }
});

router.post('/contact', async (req, res, next) => {
  const form = {
    name: (req.body.name || '').trim(),
    phone: (req.body.phone || '').trim(),
    email: (req.body.email || '').trim(),
    message: (req.body.message || '').trim()
  };
  const errors = [];
  if (form.name.length < 2) errors.push('Please enter your name.');
  if (!/^[0-9+\s-]{7,15}$/.test(form.phone)) errors.push('Please enter a valid phone number.');
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.push('Please enter a valid email address.');
  if (form.message.length < 5) errors.push('Please write a short message.');

  try {
    if (errors.length) {
      return res.status(400).render('contact', { title: 'Contact', form, errors });
    }
    await db.query(
      'INSERT INTO contact_messages (name, phone, email, message) VALUES (?, ?, ?, ?)',
      [form.name, form.phone, form.email || null, form.message]
    );
    res.cookie('visitor', JSON.stringify({ name: form.name, phone: form.phone }), { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax' });
    req.session.flash = { type: 'success', text: `Thank you, ${form.name}. We have received your message and will call you soon.` };
    res.redirect('/contact');
  } catch (err) { next(err); }
});

function safeParse(str) { try { return JSON.parse(str); } catch { return {}; } }

module.exports = router;
