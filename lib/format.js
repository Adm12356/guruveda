exports.duration = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};
exports.dateTime = d => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-');
exports.percent = (score, total) => (total ? Math.round((score * 1000) / total) / 10 : 0);
exports.statusLabel = s => ({ in_progress: 'In progress', submitted: 'Submitted', auto_submitted: 'Auto-submitted (time up)' }[s] || '-');
