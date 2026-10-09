// Admin: students, exams, questions and results.
// Mounted inside routes/admin.js, so login and CSRF checks already apply.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const ex = require('../lib/exams');
const router = express.Router();

const OPTIONS = ['A', 'B', 'C', 'D'];
const fail = (req, text) => { req.session.flash = { type: 'danger', text }; };
const ok = (req, text) => { req.session.flash = { type: 'success', text }; };
const allBatches = async () => (await db.query('SELECT id, name FROM batches ORDER BY name'))[0];

/* =====================  STUDENTS  ===================== */
const parseStudent = b => ({
  name: (b.name || '').trim(),
  username: (b.username || '').trim().toLowerCase(),
  password: b.password || '',
  batch_id: parseInt(b.batch_id, 10) || null,
  is_active: b.is_active ? 1 : 0
});
function studentErrors(s, isNew) {
  const e = [];
  if (s.name.length < 2) e.push('Please enter the student name.');
  if (!/^[a-z0-9._-]{3,30}$/.test(s.username)) e.push('Username must be 3-30 characters: letters, numbers, dot, dash or underscore.');
  if (isNew && s.password.length < 6) e.push('Password must be at least 6 characters.');
  if (!isNew && s.password && s.password.length < 6) e.push('New password must be at least 6 characters.');
  if (!s.batch_id) e.push('Please choose a batch.');
  return e;
}
const studentForm = async (res, status, o) => res.status(status).render('admin/student-form', { batches: await allBatches(), ...o });

router.get('/students', async (req, res, next) => {
  try {
    const [students] = await db.query(
      'SELECT s.*, b.name AS batch_name FROM students s LEFT JOIN batches b ON b.id = s.batch_id ORDER BY s.name');
    res.render('admin/students', { title: 'Students', students });
  } catch (err) { next(err); }
});

router.get('/students/new', async (req, res, next) => {
  try {
    await studentForm(res, 200, { title: 'Add student', s: { name: '', username: '', batch_id: null, is_active: 1 }, errors: [], action: '/admin/students', isEdit: false });
  } catch (err) { next(err); }
});

router.post('/students', async (req, res, next) => {
  try {
    const s = parseStudent(req.body);
    const errors = studentErrors(s, true);
    if (errors.length) return studentForm(res, 400, { title: 'Add student', s, errors, action: '/admin/students', isEdit: false });
    try {
      await db.query('INSERT INTO students (name, username, password_hash, batch_id, is_active) VALUES (?, ?, ?, ?, ?)',
        [s.name, s.username, await bcrypt.hash(s.password, 10), s.batch_id, s.is_active]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return studentForm(res, 400, { title: 'Add student', s, errors: ['That username is already taken.'], action: '/admin/students', isEdit: false });
      throw e;
    }
    ok(req, 'Student added.');
    res.redirect('/admin/students');
  } catch (err) { next(err); }
});

router.get('/students/:id/edit', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/students');
    await studentForm(res, 200, { title: 'Edit student', s: rows[0], errors: [], action: `/admin/students/${rows[0].id}`, isEdit: true });
  } catch (err) { next(err); }
});

router.post('/students/:id', async (req, res, next) => {
  try {
    const s = parseStudent(req.body);
    const action = `/admin/students/${req.params.id}`;
    const errors = studentErrors(s, false);
    if (errors.length) return studentForm(res, 400, { title: 'Edit student', s, errors, action, isEdit: true });
    try {
      if (s.password) {
        await db.query('UPDATE students SET name=?, username=?, batch_id=?, is_active=?, password_hash=? WHERE id=?',
          [s.name, s.username, s.batch_id, s.is_active, await bcrypt.hash(s.password, 10), req.params.id]);
      } else {
        await db.query('UPDATE students SET name=?, username=?, batch_id=?, is_active=? WHERE id=?',
          [s.name, s.username, s.batch_id, s.is_active, req.params.id]);
      }
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return studentForm(res, 400, { title: 'Edit student', s, errors: ['That username is already taken.'], action, isEdit: true });
      throw e;
    }
    ok(req, 'Student updated.');
    res.redirect('/admin/students');
  } catch (err) { next(err); }
});

router.post('/students/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM students WHERE id = ?', [req.params.id]);
    ok(req, 'Student deleted along with their exam results.');
    res.redirect('/admin/students');
  } catch (err) { next(err); }
});

/* =====================  EXAMS  ===================== */
const parseExam = b => ({
  title: (b.title || '').trim(),
  description: (b.description || '').trim(),
  batch_id: parseInt(b.batch_id, 10) || null,
  duration_minutes: parseInt(b.duration_minutes, 10),
  pass_percent: parseInt(b.pass_percent, 10),
  show_answers: b.show_answers ? 1 : 0,
  is_published: b.is_published ? 1 : 0
});
function examErrors(x) {
  const e = [];
  if (x.title.length < 3) e.push('Please enter the exam title.');
  if (!x.batch_id) e.push('Please choose the batch that can take this exam.');
  if (isNaN(x.duration_minutes) || x.duration_minutes < 1 || x.duration_minutes > 300) e.push('Timer must be between 1 and 300 minutes.');
  if (isNaN(x.pass_percent) || x.pass_percent < 0 || x.pass_percent > 100) e.push('Pass percentage must be between 0 and 100.');
  return e;
}
const examForm = async (res, status, o) => res.status(status).render('admin/exam-form', { batches: await allBatches(), ...o });
const attemptCount = async examId => (await db.query('SELECT COUNT(*) AS n FROM exam_attempts WHERE exam_id = ?', [examId]))[0][0].n;

router.get('/exams', async (req, res, next) => {
  try {
    const [exams] = await db.query(
      `SELECT e.*, b.name AS batch_name,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
              (SELECT COALESCE(SUM(marks), 0) FROM questions q WHERE q.exam_id = e.id) AS total_marks,
              (SELECT COUNT(*) FROM exam_attempts a WHERE a.exam_id = e.id AND a.status <> 'in_progress') AS submitted_count
         FROM exams e JOIN batches b ON b.id = e.batch_id ORDER BY e.created_at DESC`);
    res.render('admin/exams', { title: 'Exams', exams });
  } catch (err) { next(err); }
});

router.get('/exams/new', async (req, res, next) => {
  try {
    await examForm(res, 200, { title: 'Add exam', x: { title: '', description: '', batch_id: null, duration_minutes: 30, pass_percent: 40, show_answers: 1, is_published: 0 }, errors: [], action: '/admin/exams', isEdit: false });
  } catch (err) { next(err); }
});

router.post('/exams', async (req, res, next) => {
  try {
    const x = parseExam(req.body);
    const errors = examErrors(x);
    if (errors.length) return examForm(res, 400, { title: 'Add exam', x, errors, action: '/admin/exams', isEdit: false });
    const [r] = await db.query(
      'INSERT INTO exams (title, description, batch_id, duration_minutes, pass_percent, show_answers, is_published) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [x.title, x.description || null, x.batch_id, x.duration_minutes, x.pass_percent, x.show_answers]);
    ok(req, 'Exam created. Now add its questions, then publish it.');
    res.redirect(`/admin/exams/${r.insertId}/questions`);
  } catch (err) { next(err); }
});

router.get('/exams/:id/edit', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM exams WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/exams');
    await examForm(res, 200, { title: 'Edit exam', x: rows[0], errors: [], action: `/admin/exams/${rows[0].id}`, isEdit: true });
  } catch (err) { next(err); }
});

router.post('/exams/:id', async (req, res, next) => {
  try {
    const x = parseExam(req.body);
    const errors = examErrors(x);
    if (errors.length) return examForm(res, 400, { title: 'Edit exam', x, errors, action: `/admin/exams/${req.params.id}`, isEdit: true });
    if (x.is_published) {
      const [[q]] = await db.query('SELECT COUNT(*) AS n FROM questions WHERE exam_id = ?', [req.params.id]);
      if (!q.n) { x.is_published = 0; fail(req, 'The exam was saved but not published, because it has no questions yet.'); }
    }
    await db.query('UPDATE exams SET title=?, description=?, batch_id=?, duration_minutes=?, pass_percent=?, show_answers=?, is_published=? WHERE id=?',
      [x.title, x.description || null, x.batch_id, x.duration_minutes, x.pass_percent, x.show_answers, x.is_published, req.params.id]);
    if (!req.session.flash) ok(req, 'Exam updated.');
    res.redirect('/admin/exams');
  } catch (err) { next(err); }
});

router.post('/exams/:id/publish', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT is_published, (SELECT COUNT(*) FROM questions WHERE exam_id = exams.id) AS n FROM exams WHERE id = ?', [req.params.id]);
    if (rows.length) {
      if (!rows[0].is_published && !rows[0].n) fail(req, 'Add at least one question before publishing.');
      else {
        await db.query('UPDATE exams SET is_published = ? WHERE id = ?', [rows[0].is_published ? 0 : 1, req.params.id]);
        ok(req, rows[0].is_published ? 'Exam hidden from students.' : 'Exam published. Students in the selected batch can now see it.');
      }
    }
    res.redirect('/admin/exams');
  } catch (err) { next(err); }
});

router.post('/exams/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM exams WHERE id = ?', [req.params.id]);
    ok(req, 'Exam deleted along with its questions and results.');
    res.redirect('/admin/exams');
  } catch (err) { next(err); }
});

/* =====================  QUESTIONS  ===================== */
const parseQuestion = b => ({
  question_text: (b.question_text || '').trim(),
  option_a: (b.option_a || '').trim(),
  option_b: (b.option_b || '').trim(),
  option_c: (b.option_c || '').trim(),
  option_d: (b.option_d || '').trim(),
  correct_option: String(b.correct_option || '').toUpperCase(),
  marks: parseInt(b.marks, 10)
});
function questionErrors(q) {
  const e = [];
  if (!q.question_text) e.push('Please enter the question.');
  if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) e.push('Please fill all four options.');
  if (!OPTIONS.includes(q.correct_option)) e.push('Please choose the correct option.');
  if (isNaN(q.marks) || q.marks < 1 || q.marks > 100) e.push('Marks must be between 1 and 100.');
  return e;
}
const blankQ = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: '', marks: 1 };
const getExam = async id => (await db.query('SELECT * FROM exams WHERE id = ?', [id]))[0][0];

async function questionsPage(res, status, examId, q, errors) {
  const exam = await getExam(examId);
  if (!exam) return res.redirect('/admin/exams');
  const [questions] = await db.query('SELECT * FROM questions WHERE exam_id = ? ORDER BY id', [examId]);
  const locked = (await attemptCount(examId)) > 0;
  res.status(status).render('admin/questions', { title: 'Questions', exam, questions, locked, q, errors });
}
async function guardLocked(req, res, examId) {
  if (await attemptCount(examId)) {
    fail(req, 'Students have already started this exam, so its questions are locked. Reset their attempts from the Results page first.');
    res.redirect(`/admin/exams/${examId}/questions`);
    return true;
  }
  return false;
}

router.get('/exams/:id/questions', async (req, res, next) => {
  try { await questionsPage(res, 200, req.params.id, blankQ, []); } catch (err) { next(err); }
});

router.post('/exams/:id/questions', async (req, res, next) => {
  try {
    if (await guardLocked(req, res, req.params.id)) return;
    const q = parseQuestion(req.body);
    const errors = questionErrors(q);
    if (errors.length) return questionsPage(res, 400, req.params.id, q, errors);
    await db.query('INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) VALUES (?,?,?,?,?,?,?,?)',
      [req.params.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks]);
    ok(req, 'Question added.');
    res.redirect(`/admin/exams/${req.params.id}/questions#add`);
  } catch (err) { next(err); }
});

router.get('/exams/:id/questions/:qid/edit', async (req, res, next) => {
  try {
    const exam = await getExam(req.params.id);
    const [rows] = await db.query('SELECT * FROM questions WHERE id = ? AND exam_id = ?', [req.params.qid, req.params.id]);
    if (!exam || !rows.length) return res.redirect('/admin/exams');
    if (await guardLocked(req, res, exam.id)) return;
    res.render('admin/question-edit', { title: 'Edit question', exam, q: rows[0], errors: [] });
  } catch (err) { next(err); }
});

router.post('/exams/:id/questions/:qid', async (req, res, next) => {
  try {
    const exam = await getExam(req.params.id);
    if (!exam) return res.redirect('/admin/exams');
    if (await guardLocked(req, res, exam.id)) return;
    const q = parseQuestion(req.body);
    const errors = questionErrors(q);
    if (errors.length) return res.status(400).render('admin/question-edit', { title: 'Edit question', exam, q: { ...q, id: req.params.qid }, errors });
    await db.query('UPDATE questions SET question_text=?, option_a=?, option_b=?, option_c=?, option_d=?, correct_option=?, marks=? WHERE id=? AND exam_id=?',
      [q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks, req.params.qid, req.params.id]);
    ok(req, 'Question updated.');
    res.redirect(`/admin/exams/${req.params.id}/questions`);
  } catch (err) { next(err); }
});

router.post('/exams/:id/questions/:qid/delete', async (req, res, next) => {
  try {
    if (await guardLocked(req, res, req.params.id)) return;
    await db.query('DELETE FROM questions WHERE id = ? AND exam_id = ?', [req.params.qid, req.params.id]);
    // an exam with no questions cannot stay published
    await db.query('UPDATE exams SET is_published = 0 WHERE id = ? AND NOT EXISTS (SELECT 1 FROM questions WHERE exam_id = ?)', [req.params.id, req.params.id]);
    ok(req, 'Question deleted.');
    res.redirect(`/admin/exams/${req.params.id}/questions`);
  } catch (err) { next(err); }
});

/* =====================  RESULTS  ===================== */
router.get('/exams/:id/results', async (req, res, next) => {
  try {
    const exam = await getExam(req.params.id);
    if (!exam) return res.redirect('/admin/exams');
    await ex.finalizeExpired({ examId: exam.id });
    const [rows] = await db.query(
      `SELECT s.id AS student_id, s.name, s.username, a.id AS attempt_id, a.status, a.score, a.total_marks, a.started_at, a.submitted_at
         FROM students s LEFT JOIN exam_attempts a ON a.student_id = s.id AND a.exam_id = ?
        WHERE s.batch_id = ? OR a.id IS NOT NULL
        ORDER BY (a.id IS NULL), a.score DESC, s.name`, [exam.id, exam.batch_id]);
    const [[b]] = await db.query('SELECT name FROM batches WHERE id = ?', [exam.batch_id]);
    const finished = rows.filter(r => r.status === 'submitted' || r.status === 'auto_submitted');
    const pcts = finished.map(r => (r.total_marks ? r.score * 100 / r.total_marks : 0));
    const stats = {
      total: rows.length,
      finished: finished.length,
      average: pcts.length ? Math.round(pcts.reduce((a, c) => a + c, 0) / pcts.length) : null,
      highest: pcts.length ? Math.round(Math.max(...pcts)) : null,
      passed: pcts.filter(p => p >= exam.pass_percent).length
    };
    res.render('admin/exam-results', { title: 'Results', exam, batchName: b ? b.name : '', rows, stats });
  } catch (err) { next(err); }
});

router.post('/exams/:id/attempts/:attemptId/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM exam_attempts WHERE id = ? AND exam_id = ?', [req.params.attemptId, req.params.id]);
    ok(req, 'Attempt reset. The student can take the exam again.');
    res.redirect(`/admin/exams/${req.params.id}/results`);
  } catch (err) { next(err); }
});

module.exports = router;
