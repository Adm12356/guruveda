// Date + calendar helpers for attendance. Dates are handled as 'YYYY-MM-DD' strings
// in the school's timezone (set APP_TZ in .env, default India) so "today" never
// depends on the server's own clock setting.
const TZ = process.env.APP_TZ || 'Asia/Kolkata';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const thisMonth = () => today().slice(0, 7);

const isDate = s => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};
const isMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');

const fmtDate = s => new Date(s + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthLabel = m => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function shiftMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthRange(m) {
  const [y, mo] = m.split('-').map(Number);
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { start: `${m}-01`, end: `${m}-${String(days).padStart(2, '0')}`, days };
}
const percent = (p, a) => (p + a ? Math.round((p * 100) / (p + a)) : null);

// Everything the calendar view needs for one student and one month.
async function buildMonth(db, studentId, month) {
  const { start, end, days } = monthRange(month);
  const t = today();
  const [marks] = await db.query(
    "SELECT DATE_FORMAT(att_date, '%Y-%m-%d') AS d, status FROM attendance WHERE student_id = ? AND att_date BETWEEN ? AND ?",
    [studentId, start, end]);
  const [hols] = await db.query(
    `SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS d, reason FROM holidays
      WHERE admin_id = (SELECT admin_id FROM students WHERE id = ?) AND holiday_date BETWEEN ? AND ?`,
    [studentId, start, end]);
  const markMap = {}; marks.forEach(m => { markMap[m.d] = m.status; });
  const holMap = {}; hols.forEach(h => { holMap[h.d] = h.reason || 'Holiday'; });

  const counts = { present: 0, absent: 0, holiday: hols.length };
  const cells = [];
  for (let i = 1; i <= days; i++) {
    const date = `${month}-${String(i).padStart(2, '0')}`;
    let status;
    if (holMap[date]) status = 'holiday';
    else if (markMap[date]) { status = markMap[date]; counts[status]++; }
    else status = date > t ? 'future' : 'none';
    cells.push({ day: i, date, status, note: holMap[date] || null, isToday: date === t });
  }
  return {
    month, label: monthLabel(month), cells, counts,
    lead: new Date(Date.UTC(...month.split('-').map((v, i) => (i === 1 ? v - 1 : +v)), 1)).getUTCDay(),
    percent: percent(counts.present, counts.absent),
    prev: shiftMonth(month, -1),
    next: month < thisMonth() ? shiftMonth(month, 1) : null
  };
}

// All-time totals (holiday dates never count, even if marks exist underneath).
async function overall(db, studentId) {
  const [[r]] = await db.query(
    `SELECT COALESCE(SUM(a.status = 'present'), 0) AS p, COALESCE(SUM(a.status = 'absent'), 0) AS a
       FROM attendance a JOIN students s ON s.id = a.student_id
      WHERE a.student_id = ? AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.admin_id = s.admin_id AND h.holiday_date = a.att_date)`,
    [studentId]);
  const present = Number(r.p), absent = Number(r.a);
  return { present, absent, percent: percent(present, absent) };
}

// What is today for this student: 'holiday' | 'present' | 'absent' | 'none'
async function todayStatus(db, studentId) {
  const t = today();
  const [h] = await db.query('SELECT reason FROM holidays WHERE admin_id = (SELECT admin_id FROM students WHERE id = ?) AND holiday_date = ?', [studentId, t]);
  if (h.length) return { status: 'holiday', note: h[0].reason || 'Holiday' };
  const [a] = await db.query('SELECT status FROM attendance WHERE student_id = ? AND att_date = ?', [studentId, t]);
  return { status: a.length ? a[0].status : 'none', note: null };
}

module.exports = { today, thisMonth, isDate, isMonth, fmtDate, monthLabel, shiftMonth, monthRange, percent, buildMonth, overall, todayStatus };
