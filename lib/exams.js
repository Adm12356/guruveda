const db = require('../db');

const GRACE_MS = 10 * 1000; // allowance for network delay when the timer hits zero
const deadlineMs = (startedAt, minutes) => new Date(startedAt).getTime() + minutes * 60 * 1000;
const nowSeconds = () => new Date(Math.floor(Date.now() / 1000) * 1000);

// Scores the saved answers and closes the attempt (does nothing if already closed).
async function finalizeAttempt(attemptId, examId, status, whenMs) {
  const [[s]] = await db.query(
    `SELECT COALESCE(SUM(q.marks), 0) AS score
       FROM attempt_answers aa JOIN questions q ON q.id = aa.question_id
      WHERE aa.attempt_id = ? AND aa.selected_option = q.correct_option`, [attemptId]);
  const [[t]] = await db.query('SELECT COALESCE(SUM(marks), 0) AS total FROM questions WHERE exam_id = ?', [examId]);
  await db.query(
    "UPDATE exam_attempts SET status = ?, submitted_at = ?, score = ?, total_marks = ? WHERE id = ? AND status = 'in_progress'",
    [status, new Date(Math.floor(whenMs / 1000) * 1000), Number(s.score), Number(t.total), attemptId]);
}

// Closes every in-progress attempt whose timer has run out (e.g. the student closed the browser).
async function finalizeExpired({ studentId, examId } = {}) {
  let sql = `SELECT a.id, a.exam_id, a.started_at, e.duration_minutes
               FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
              WHERE a.status = 'in_progress'`;
  const params = [];
  if (studentId) { sql += ' AND a.student_id = ?'; params.push(studentId); }
  if (examId) { sql += ' AND a.exam_id = ?'; params.push(examId); }
  const [rows] = await db.query(sql, params);
  const now = Date.now();
  for (const r of rows) {
    const dl = deadlineMs(r.started_at, r.duration_minutes);
    if (now > dl) await finalizeAttempt(r.id, r.exam_id, 'auto_submitted', dl);
  }
}

module.exports = { GRACE_MS, deadlineMs, nowSeconds, finalizeAttempt, finalizeExpired };
