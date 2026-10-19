// Admin: daily attendance, holidays and attendance reports.
// Mounted inside routes/admin.js, so login, CSRF and req.admin already exist.
// Teachers only see their own batches and students. The owner can additionally
// open any student's calendar and mark a holiday for every teacher at once.
const express = require('express');
const db = require('../db');
const att = require('../lib/attendance');
const router = express.Router();

const flash = (req, type, text) => { req.session.flash = { type, text }; };
const isOwner = req => req.admin.role === 'owner';
const allBatches = async adminId => (await db.query('SELECT id, name FROM batches WHERE admin_id = ? ORDER BY name', [adminId]))[0];
const pickBatch = (batches, id) => {
  const n = parseInt(id, 10);
  return batches.some(b => b.id === n) ? n : (batches[0] ? batches[0].id : null);
};
const back = (batchId, date) => `/admin/attendance?batch=${batchId || ''}&date=${date}`;

/* ---------- mark attendance for one batch and one day ---------- */
router.get('/attendance', async (req, res, next) => {
  try {
    const me = req.admin.id;
    const today = att.today();
    const batches = await allBatches(me);
    const batchId = pickBatch(batches, req.query.batch);
    let date = att.isDate(req.query.date) ? req.query.date : today;
    if (date > today) date = today; // attendance can't be marked in advance (holidays can)

    const [hol] = await db.query('SELECT reason FROM holidays WHERE admin_id = ? AND holiday_date = ?', [me, date]);
    const [students] = batchId ? await db.query(
      `SELECT s.id, s.name, a.status FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id AND a.att_date = ?
        WHERE s.batch_id = ? AND s.admin_id = ? AND s.is_active = 1 ORDER BY s.name`, [date, batchId, me]) : [[]];
    const [holidays] = await db.query(
      "SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS d, reason FROM holidays WHERE admin_id = ? AND holiday_date >= ? ORDER BY holiday_date LIMIT 20", [me, today]);

    res.render('admin/attendance', {
      title: 'Attendance', batches, batchId, date, today,
      holiday: hol.length ? { reason: hol[0].reason } : null,
      students, holidays,
      marked: students.filter(s => s.status).length
    });
  } catch (err) { next(err); }
});

router.post('/attendance', async (req, res, next) => {
  try {
    const me = req.admin.id;
    const today = att.today();
    const date = req.body.date;
    const batchId = parseInt(req.body.batch_id, 10);
    if (!att.isDate(date) || date > today || !batchId) { flash(req, 'danger', 'Please choose a valid date (not in the future).'); return res.redirect('/admin/attendance'); }

    const [hol] = await db.query('SELECT 1 FROM holidays WHERE admin_id = ? AND holiday_date = ?', [me, date]);
    if (hol.length) { flash(req, 'warning', 'That day is a holiday. Remove the holiday first if you want to mark attendance.'); return res.redirect(back(batchId, date)); }

    // only this teacher's own students in this batch can be marked
    const [students] = await db.query('SELECT id FROM students WHERE batch_id = ? AND admin_id = ? AND is_active = 1', [batchId, me]);
    const rows = [];
    students.forEach(s => {
      const v = req.body['s_' + s.id];
      if (v === 'present' || v === 'absent') rows.push([s.id, date, v]);
    });
    if (!rows.length) { flash(req, 'warning', 'Nothing to save. Mark at least one student Present or Absent.'); return res.redirect(back(batchId, date)); }

    await db.query('INSERT INTO attendance (student_id, att_date, status) VALUES ? ON DUPLICATE KEY UPDATE status = VALUES(status)', [rows]);
    flash(req, 'success', `Attendance saved for ${att.fmtDate(date)} (${rows.length} of ${students.length} students marked).`);
    res.redirect(back(batchId, date));
  } catch (err) { next(err); }
});

/* ---------- holidays: apply to all of this teacher's students (owner: optionally every teacher's) ---------- */
router.post('/attendance/holiday', async (req, res, next) => {
  try {
    const date = req.body.date;
    const batchId = parseInt(req.body.batch_id, 10) || '';
    if (!att.isDate(date)) { flash(req, 'danger', 'Please choose a valid holiday date.'); return res.redirect('/admin/attendance'); }
    const reason = (req.body.reason || '').trim().slice(0, 150) || null;
    if (isOwner(req) && req.body.all === '1') {
      await db.query('INSERT INTO holidays (admin_id, holiday_date, reason) SELECT id, ?, ? FROM admins WHERE is_active = 1 ON DUPLICATE KEY UPDATE reason = VALUES(reason)', [date, reason]);
      flash(req, 'success', `${att.fmtDate(date)} is now a holiday for every teacher's students.`);
    } else {
      await db.query('INSERT INTO holidays (admin_id, holiday_date, reason) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason)', [req.admin.id, date, reason]);
      flash(req, 'success', `${att.fmtDate(date)} is now a holiday for all your students.`);
    }
    res.redirect(back(batchId, date > att.today() ? att.today() : date));
  } catch (err) { next(err); }
});

router.post('/attendance/holiday/delete', async (req, res, next) => {
  try {
    const date = req.body.date;
    const batchId = parseInt(req.body.batch_id, 10) || '';
    if (!att.isDate(date)) return res.redirect('/admin/attendance');
    if (isOwner(req) && req.body.all === '1') await db.query('DELETE FROM holidays WHERE holiday_date = ?', [date]);
    else await db.query('DELETE FROM holidays WHERE admin_id = ? AND holiday_date = ?', [req.admin.id, date]);
    flash(req, 'success', `Holiday removed for ${att.fmtDate(date)}.`);
    res.redirect(back(batchId, date > att.today() ? att.today() : date));
  } catch (err) { next(err); }
});

/* ---------- monthly report for a batch ---------- */
router.get('/attendance/report', async (req, res, next) => {
  try {
    const me = req.admin.id;
    const batches = await allBatches(me);
    const batchId = pickBatch(batches, req.query.batch);
    const month = att.isMonth(req.query.month) ? req.query.month : att.thisMonth();
    const { start, end } = att.monthRange(month);

    const [rows] = batchId ? await db.query(
      `SELECT s.id, s.name,
              COALESCE(SUM(a.status = 'present' AND h.holiday_date IS NULL), 0) AS present,
              COALESCE(SUM(a.status = 'absent' AND h.holiday_date IS NULL), 0) AS absent
         FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id AND a.att_date BETWEEN ? AND ?
         LEFT JOIN holidays h ON h.admin_id = s.admin_id AND h.holiday_date = a.att_date
        WHERE s.batch_id = ? AND s.admin_id = ? AND s.is_active = 1 GROUP BY s.id, s.name ORDER BY s.name`, [start, end, batchId, me]) : [[]];
    const students = rows.map(r => ({ ...r, present: Number(r.present), absent: Number(r.absent), percent: att.percent(Number(r.present), Number(r.absent)) }));
    const [[hc]] = await db.query('SELECT COUNT(*) AS n FROM holidays WHERE admin_id = ? AND holiday_date BETWEEN ? AND ?', [me, start, end]);

    res.render('admin/attendance-report', {
      title: 'Attendance report', batches, batchId, month, label: att.monthLabel(month),
      prev: att.shiftMonth(month, -1), next: month < att.thisMonth() ? att.shiftMonth(month, 1) : null,
      students, holidayCount: hc.n
    });
  } catch (err) { next(err); }
});

/* ---------- one student's calendar (own students; the owner can open anyone's) ---------- */
router.get('/attendance/student/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT s.id, s.name, s.batch_id, s.admin_id, b.name AS batch_name FROM students s LEFT JOIN batches b ON b.id = s.batch_id WHERE s.id = ?', [req.params.id]);
    if (!rows.length || (rows[0].admin_id !== req.admin.id && !isOwner(req))) return res.redirect('/admin/attendance/report');
    const month = att.isMonth(req.query.month) ? req.query.month : att.thisMonth();
    const cal = await att.buildMonth(db, rows[0].id, month);
    const total = await att.overall(db, rows[0].id);
    const ownStudent = rows[0].admin_id === req.admin.id;
    res.render('admin/attendance-student', {
      title: rows[0].name + ' - attendance', st: rows[0], cal, total,
      calBase: `/admin/attendance/student/${rows[0].id}`,
      backUrl: ownStudent ? `/admin/attendance/report?batch=${rows[0].batch_id || ''}&month=${cal.month}` : `/admin/teachers/${rows[0].admin_id}`
    });
  } catch (err) { next(err); }
});

module.exports = router;
