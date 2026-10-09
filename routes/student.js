const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const ex = require('../lib/exams');
const router = express.Router();

const OPTIONS = ['A', 'B', 'C', 'D'];

/* ---------- login throttle ---------- */
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const tooMany = ip => { const a = attempts.get(ip); return a && a.count >= 8 && Date.now() - a.first < WINDOW; };
const recordFail = ip => {
  const now = Date.now(); const a = attempts.get(ip);
  if (!a || now - a.first > WINDOW) attempts.set(ip, { count: 1, first: now }); else a.count++;
};

/* ---------- csrf + locals ---------- */
router.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  res.locals.student = req.session.student || null;
  res.set('Cache-Control', 'no-store');
  next();
});
router.use((req, res, next) => {
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).render('error', { title: 'Session expired', heading: 'Session expired', message: 'Please go back, refresh the page and try again.' });
  }
  next();
});

/* ---------- login / logout ---------- */
router.get('/login', (req, res) => {
  if (req.session.student) return res.redirect('/student');
  res.render('student/login', { title: 'Student login', error: null });
});

router.post('/login', async (req, res, next) => {
  const ip = req.ip;
  if (tooMany(ip)) return res.status(429).render('student/login', { title: 'Student login', error: 'Too many attempts. Please wait 15 minutes and try again.' });
  try {
    const username = (req.body.username || '').trim().toLowerCase();
    const password = req.body.password || '';
    const [rows] = await db.query('SELECT * FROM students WHERE username = ? AND is_active = 1', [username]);
    const ok = rows.length && await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) {
      recordFail(ip);
      return res.status(401).render('student/login', { title: 'Student login', error: 'Incorrect username or password.' });
    }
    attempts.delete(ip);
    const user = { id: rows[0].id, name: rows[0].name };
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.student = user;
      req.session.csrf = crypto.randomBytes(24).toString('hex');
      res.redirect('/student');
    });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/student/login'));
});

/* ---------- everything below needs a logged-in student ---------- */
router.use(async (req, res, next) => {
  try {
    if (!req.session.student) return res.redirect('/student/login');
    const [rows] = await db.query(
      'SELECT s.id, s.name, s.username, s.batch_id, b.name AS batch_name FROM students s LEFT JOIN batches b ON b.id = s.batch_id WHERE s.id = ? AND s.is_active = 1',
      [req.session.student.id]);
    if (!rows.length) return req.session.destroy(() => res.redirect('/student/login'));
    req.student = rows[0];
    res.locals.student = rows[0];
    await ex.finalizeExpired({ studentId: rows[0].id });
    next();
  } catch (err) { next(err); }
});

// An exam is only reachable if it is published and belongs to the student's batch.
async function examForStudent(req, id) {
  if (!req.student.batch_id) return null;
  const [rows] = await db.query(
    `SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
            (SELECT COALESCE(SUM(marks), 0) FROM questions q WHERE q.exam_id = e.id) AS total_marks
       FROM exams e WHERE e.id = ? AND e.batch_id = ? AND e.is_published = 1`,
    [id, req.student.batch_id]);
  return rows[0] && rows[0].question_count > 0 ? rows[0] : null;
}
const getAttempt = async (examId, studentId) => {
  const [rows] = await db.query('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?', [examId, studentId]);
  return rows[0] || null;
};
const notFound = res => res.status(404).render('error', { title: 'Not found', heading: 'Exam not found', message: 'This exam is not available for your account.' });

/* ---------- dashboard ---------- */
router.get('/', async (req, res, next) => {
  try {
    const sid = req.student.id;
    let pending = 0, done = 0;
    if (req.student.batch_id) {
      const [exams] = await db.query(
        `SELECT a.status FROM exams e LEFT JOIN exam_attempts a ON a.exam_id = e.id AND a.student_id = ?
          WHERE e.batch_id = ? AND e.is_published = 1 AND EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id)`,
        [sid, req.student.batch_id]);
      exams.forEach(e => { if (e.status === 'submitted' || e.status === 'auto_submitted') done++; else pending++; });
    }
    const [recent] = await db.query(
      `SELECT a.*, e.title, e.pass_percent FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
        WHERE a.student_id = ? AND a.status <> 'in_progress' ORDER BY a.submitted_at DESC LIMIT 5`, [sid]);
    const avg = recent.length ? Math.round(recent.reduce((t, r) => t + (r.total_marks ? r.score * 100 / r.total_marks : 0), 0) / recent.length) : null;
    res.render('student/dashboard', { title: 'Dashboard', pending, done, recent, avg });
  } catch (err) { next(err); }
});

/* ---------- exams ---------- */
router.get('/exams', async (req, res, next) => {
  try {
    let exams = [];
    if (req.student.batch_id) {
      [exams] = await db.query(
        `SELECT e.*, a.status AS attempt_status, a.score, a.total_marks AS got_total,
                (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
                (SELECT COALESCE(SUM(marks), 0) FROM questions q WHERE q.exam_id = e.id) AS total_marks
           FROM exams e LEFT JOIN exam_attempts a ON a.exam_id = e.id AND a.student_id = ?
          WHERE e.batch_id = ? AND e.is_published = 1 AND EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id)
          ORDER BY e.created_at DESC`, [req.student.id, req.student.batch_id]);
    }
    res.render('student/exams', { title: 'Exams', exams });
  } catch (err) { next(err); }
});

router.get('/exams/:id', async (req, res, next) => {
  try {
    const exam = await examForStudent(req, req.params.id);
    if (!exam) return notFound(res);
    const attempt = await getAttempt(exam.id, req.student.id);
    res.render('student/exam-intro', { title: exam.title, exam, attempt });
  } catch (err) { next(err); }
});

router.post('/exams/:id/start', async (req, res, next) => {
  try {
    const exam = await examForStudent(req, req.params.id);
    if (!exam) return notFound(res);
    const existing = await getAttempt(exam.id, req.student.id);
    if (existing) return res.redirect(existing.status === 'in_progress' ? `/student/exams/${exam.id}/take` : `/student/results/${exam.id}`);
    try {
      await db.query("INSERT INTO exam_attempts (exam_id, student_id, started_at, status) VALUES (?, ?, ?, 'in_progress')",
        [exam.id, req.student.id, ex.nowSeconds()]);
    } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; } // double-click
    res.redirect(`/student/exams/${exam.id}/take`);
  } catch (err) { next(err); }
});

router.get('/exams/:id/take', async (req, res, next) => {
  try {
    const exam = await examForStudent(req, req.params.id);
    if (!exam) return notFound(res);
    const attempt = await getAttempt(exam.id, req.student.id);
    if (!attempt) return res.redirect(`/student/exams/${exam.id}`);
    if (attempt.status !== 'in_progress') return res.redirect(`/student/results/${exam.id}`);

    const remaining = Math.floor((ex.deadlineMs(attempt.started_at, exam.duration_minutes) - Date.now()) / 1000);
    if (remaining <= 0) {
      await ex.finalizeExpired({ studentId: req.student.id, examId: exam.id });
      req.session.flash = { type: 'warning', text: 'Time was up, so your exam was submitted automatically.' };
      return res.redirect(`/student/results/${exam.id}`);
    }
    const [questions] = await db.query('SELECT id, question_text, option_a, option_b, option_c, option_d, marks FROM questions WHERE exam_id = ? ORDER BY id', [exam.id]);
    const [saved] = await db.query('SELECT question_id, selected_option FROM attempt_answers WHERE attempt_id = ?', [attempt.id]);
    const answers = {};
    saved.forEach(r => { answers[r.question_id] = r.selected_option; });
    res.render('student/take', { title: exam.title, exam, questions, answers, remaining });
  } catch (err) { next(err); }
});

// Saves one answer as soon as it is chosen, so nothing is lost if the browser closes.
router.post('/exams/:id/save-answer', async (req, res, next) => {
  try {
    const exam = await examForStudent(req, req.params.id);
    const attempt = exam && await getAttempt(exam.id, req.student.id);
    if (!attempt || attempt.status !== 'in_progress') return res.status(409).json({ ok: false });
    if (Date.now() > ex.deadlineMs(attempt.started_at, exam.duration_minutes) + ex.GRACE_MS) return res.status(409).json({ ok: false });
    const option = String(req.body.option || '').toUpperCase();
    if (!OPTIONS.includes(option)) return res.status(400).json({ ok: false });
    const [q] = await db.query('SELECT id FROM questions WHERE id = ? AND exam_id = ?', [req.body.question_id, exam.id]);
    if (!q.length) return res.status(400).json({ ok: false });
    await db.query('INSERT INTO attempt_answers (attempt_id, question_id, selected_option) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option)',
      [attempt.id, q[0].id, option]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/exams/:id/submit', async (req, res, next) => {
  try {
    const exam = await examForStudent(req, req.params.id);
    if (!exam) return notFound(res);
    const attempt = await getAttempt(exam.id, req.student.id);
    if (!attempt) return res.redirect(`/student/exams/${exam.id}`);
    if (attempt.status !== 'in_progress') return res.redirect(`/student/results/${exam.id}`);

    const deadline = ex.deadlineMs(attempt.started_at, exam.duration_minutes);
    const now = Date.now();
    const late = now > deadline + ex.GRACE_MS;

    if (!late) { // use the final answers from the form
      const [questions] = await db.query('SELECT id FROM questions WHERE exam_id = ?', [exam.id]);
      const rows = [];
      questions.forEach(q => {
        const v = String(req.body['q_' + q.id] || '').toUpperCase();
        if (OPTIONS.includes(v)) rows.push([attempt.id, q.id, v]);
      });
      if (rows.length) await db.query('INSERT INTO attempt_answers (attempt_id, question_id, selected_option) VALUES ? ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option)', [rows]);
    }
    const auto = late || req.body.auto === '1' || now >= deadline;
    await ex.finalizeAttempt(attempt.id, exam.id, auto ? 'auto_submitted' : 'submitted', late ? deadline : now);
    req.session.flash = auto
      ? { type: 'warning', text: 'Time was up, so your exam was submitted automatically.' }
      : { type: 'success', text: 'Your exam has been submitted.' };
    res.redirect(`/student/results/${exam.id}`);
  } catch (err) { next(err); }
});

/* ---------- results ---------- */
router.get('/results', async (req, res, next) => {
  try {
    const [results] = await db.query(
      `SELECT a.*, e.title, e.pass_percent FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
        WHERE a.student_id = ? AND a.status <> 'in_progress' ORDER BY a.submitted_at DESC`, [req.student.id]);
    res.render('student/results', { title: 'My results', results });
  } catch (err) { next(err); }
});

router.get('/results/:examId', async (req, res, next) => {
  try {
    const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [req.params.examId]);
    const attempt = exams.length && await getAttempt(exams[0].id, req.student.id);
    if (!attempt) return notFound(res);
    if (attempt.status === 'in_progress') return res.redirect(`/student/exams/${exams[0].id}/take`);
    let review = [];
    if (exams[0].show_answers) {
      [review] = await db.query(
        `SELECT q.*, aa.selected_option FROM questions q
           LEFT JOIN attempt_answers aa ON aa.question_id = q.id AND aa.attempt_id = ?
          WHERE q.exam_id = ? ORDER BY q.id`, [attempt.id, exams[0].id]);
    }
    res.render('student/result', { title: 'Result', exam: exams[0], attempt, review });
  } catch (err) { next(err); }
});

module.exports = router;
