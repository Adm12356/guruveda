// Owner only: branches and franchises shown on the About page.
// Mounted at /admin/branches behind requireOwner (see routes/admin.js).
const express = require('express');
const db = require('../db');
const router = express.Router();

const flash = (req, type, text) => { req.session.flash = { type, text }; };
const clean = b => ({
  name: (b.name || '').trim().replace(/\s+/g, ' '),
  note: (b.note || '').trim().slice(0, 100)
});

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, type, name, note FROM branches ORDER BY sort_order, id');
    res.render('admin/branches', {
      title: 'Locations',
      mainBranches: rows.filter(r => r.type === 'main'),
      franchises: rows.filter(r => r.type === 'franchise')
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const type = req.body.type === 'main' ? 'main' : 'franchise';
    const b = clean(req.body);
    if (b.name.length < 2 || b.name.length > 80) { flash(req, 'danger', 'Please enter a name (2-80 characters).'); return res.redirect('/admin/branches'); }
    const [[m]] = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS n FROM branches WHERE type = ?', [type]);
    try {
      await db.query('INSERT INTO branches (type, name, note, sort_order) VALUES (?, ?, ?, ?)', [type, b.name, type === 'main' ? (b.note || null) : null, m.n + 1]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') { flash(req, 'danger', 'That name already exists.'); return res.redirect('/admin/branches'); }
      throw e;
    }
    flash(req, 'success', `${b.name} added.`);
    res.redirect('/admin/branches');
  } catch (err) { next(err); }
});

router.post('/:id', async (req, res, next) => {
  try {
    const b = clean(req.body);
    if (b.name.length < 2 || b.name.length > 80) { flash(req, 'danger', 'Please enter a name (2-80 characters).'); return res.redirect('/admin/branches'); }
    try {
      await db.query("UPDATE branches SET name = ?, note = IF(type = 'main', ?, NULL) WHERE id = ?", [b.name, b.note || null, req.params.id]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') { flash(req, 'danger', 'That name already exists.'); return res.redirect('/admin/branches'); }
      throw e;
    }
    flash(req, 'success', 'Saved.');
    res.redirect('/admin/branches');
  } catch (err) { next(err); }
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM branches WHERE id = ?', [req.params.id]);
    flash(req, 'success', 'Removed.');
    res.redirect('/admin/branches');
  } catch (err) { next(err); }
});

module.exports = router;
