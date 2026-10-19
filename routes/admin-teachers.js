// Owner only: teacher accounts and a full view of each teacher's work.
// Mounted at /admin/teachers behind requireOwner (see routes/admin.js).
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const att = require('../lib/attendance');
const router = express.Router();

const flash = (req, type, text) => { req.session.flash = { type, text }; };
const parse = b => ({
  name: (b.name || '').trim(),
  username: (b.username || '').trim().toLowerCase(),
  password: b.password || '',
  is_active: b.is_active ? 1 : 0
});
function errorsFor(t, isNew) {
  const e = [];
  if (t.name.length < 2) e.push('Please enter the teacher name.');
  if (!/^[a-z0-9._-]{3,30}$/.test(t.username)) e.push('Username must be 3-30 characters: letters, numbers, dot, dash or underscore.');
  if (isNew && t.password.length < 8) e.push('Password must be at least 8 characters.');
  if (!isNew && t.password && t.password.length < 8) e.push('New password must be at least 8 characters.');
  return e;
}
const form = (res, status, o) => res.status(status).render('admin/teacher-form', o);

/* ---------- list ---------- */
router.get('/', async (req, res, next) => {
  try {
    const [teachers] = await db.query(
      `SELECT a.id, a.name, a.username, a.role, a.is_active,
              (SELECT COUNT(*) FROM batches b WHERE b.admin_id = a.id) AS batches,
              (SELECT COUNT(*) FROM students s WHERE s.admin_id = a.id) AS students,
              (SELECT COUNT(*) FROM exams e WHERE e.admin_id = a.id) AS exams_created,
              (SELECT COUNT(*) FROM exams e WHERE e.admin_id = a.id AND EXISTS (SELECT 1 FROM exam_attempts t WHERE t.exam_id = e.id)) AS exams_conducted
         FROM admins a ORDER BY (a.role = 'owner') DESC, a.name`);
    const totals = teachers.reduce((t, r) => ({
      batches: t.batches + r.batches, students: t.students + r.students, exams: t.exams + r.exams_conducted
    }), { batches: 0, students: 0, exams: 0 });
    res.render('admin/teachers', { title: 'Teachers', teachers, totals });
  } catch (err) { next(err); }
});

/* ---------- add ---------- */
router.get('/new', (req, res) => form(res, 200, { title: 'Add teacher', t: { name: '', username: '', is_active: 1, role: 'teacher' }, errors: [], action: '/admin/teachers', isEdit: false }));

router.post('/', async (req, res, next) => {
  try {
    const t = parse(req.body);
    const errors = errorsFor(t, true);
    if (errors.length) return form(res, 400, { title: 'Add teacher', t: { ...t, role: 'teacher' }, errors, action: '/admin/teachers', isEdit: false });
    try {
      await db.query("INSERT INTO admins (name, username, password_hash, role, is_active) VALUES (?, ?, ?, 'teacher', 1)",
        [t.name, t.username, await bcrypt.hash(t.password, 10)]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return form(res, 400, { title: 'Add teacher', t: { ...t, role: 'teacher' }, errors: ['That username is already taken.'], action: '/admin/teachers', isEdit: false });
      throw e;
    }
    flash(req, 'success', 'Teacher added. Share the username and password with them so they can log in at /admin/login.');
    res.redirect('/admin/teachers');
  } catch (err) { next(err); }
});

/* ---------- full view of one teacher ---------- */
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, name, username, role, is_active, created_at FROM admins WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/teachers');
    const t = rows[0];

    const [batches] = await db.query(
      'SELECT b.*, (SELECT COUNT(*) FROM students s WHERE s.batch_id = b.id) AS student_count FROM batches b WHERE b.admin_id = ? ORDER BY b.name', [t.id]);

    const [studentRows] = await db.query(
      `SELECT s.id, s.name, s.username, s.is_active, b.name AS batch_name,
              COALESCE(SUM(a.status = 'present'), 0) AS present, COALESCE(SUM(a.status = 'absent'), 0) AS absent
         FROM students s
         LEFT JOIN batches b ON b.id = s.batch_id
         LEFT JOIN attendance a ON a.student_id = s.id
              AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.admin_id = s.admin_id AND h.holiday_date = a.att_date)
        WHERE s.admin_id = ? GROUP BY s.id, s.name, s.username, s.is_active, b.name ORDER BY s.name`, [t.id]);
    const students = studentRows.map(r => ({ ...r, present: Number(r.present), absent: Number(r.absent), percent: att.percent(Number(r.present), Number(r.absent)) }));
    const present = students.reduce((n, s) => n + s.present, 0);
    const absent = students.reduce((n, s) => n + s.absent, 0);

    const [exams] = await db.query(
      `SELECT e.id, e.title, e.is_published, e.pass_percent, e.created_at, b.name AS batch_name,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
              (SELECT COUNT(*) FROM exam_attempts x WHERE x.exam_id = e.id) AS attempts,
              (SELECT COUNT(*) FROM exam_attempts x WHERE x.exam_id = e.id AND x.status <> 'in_progress') AS submitted,
              (SELECT ROUND(AVG(x.score * 100 / x.total_marks)) FROM exam_attempts x WHERE x.exam_id = e.id AND x.status <> 'in_progress' AND x.total_marks > 0) AS avg_pct
         FROM exams e JOIN batches b ON b.id = e.batch_id WHERE e.admin_id = ? ORDER BY e.created_at DESC`, [t.id]);

    const [days] = await db.query(
      `SELECT DATE_FORMAT(a.att_date, '%Y-%m-%d') AS d, SUM(a.status = 'present') AS present, SUM(a.status = 'absent') AS absent
         FROM attendance a JOIN students s ON s.id = a.student_id
        WHERE s.admin_id = ? AND a.att_date >= DATE_SUB(?, INTERVAL 30 DAY)
          AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.admin_id = s.admin_id AND h.holiday_date = a.att_date)
        GROUP BY a.att_date ORDER BY a.att_date DESC`, [t.id, att.today()]);

    res.render('admin/teacher-detail', {
      title: t.name || t.username, t, batches, students, exams,
      days: days.map(d => ({ d: d.d, present: Number(d.present), absent: Number(d.absent) })),
      summary: {
        batches: batches.length, students: students.length, examsCreated: exams.length,
        examsConducted: exams.filter(e => e.attempts > 0).length, attendance: att.percent(present, absent)
      }
    });
  } catch (err) { next(err); }
});

/* ---------- edit (name, username, new password, active) ---------- */
router.get('/:id/edit', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, name, username, role, is_active FROM admins WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/teachers');
    form(res, 200, { title: 'Edit teacher', t: rows[0], errors: [], action: `/admin/teachers/${rows[0].id}`, isEdit: true });
  } catch (err) { next(err); }
});

router.post('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, role FROM admins WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/teachers');
    const isOwnerRow = rows[0].role === 'owner';
    const t = parse(req.body);
    if (isOwnerRow) t.is_active = 1; // the owner account can never be switched off
    const action = `/admin/teachers/${rows[0].id}`;
    const view = { ...t, id: rows[0].id, role: rows[0].role };
    const errors = errorsFor(t, false);
    if (errors.length) return form(res, 400, { title: 'Edit teacher', t: view, errors, action, isEdit: true });
    try {
      if (t.password) {
        await db.query('UPDATE admins SET name=?, username=?, is_active=?, password_hash=? WHERE id=?', [t.name, t.username, t.is_active, await bcrypt.hash(t.password, 10), rows[0].id]);
      } else {
        await db.query('UPDATE admins SET name=?, username=?, is_active=? WHERE id=?', [t.name, t.username, t.is_active, rows[0].id]);
      }
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return form(res, 400, { title: 'Edit teacher', t: view, errors: ['That username is already taken.'], action, isEdit: true });
      throw e;
    }
    flash(req, 'success', 'Teacher updated.');
    res.redirect('/admin/teachers');
  } catch (err) { next(err); }
});

module.exports = router;
