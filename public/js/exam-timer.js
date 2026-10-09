// Countdown timer, answer autosave and automatic submit for the exam page.
(function () {
  var form = document.getElementById('examForm');
  if (!form) return;

  var remaining = parseInt(form.dataset.remaining, 10);
  var saveUrl = form.dataset.saveUrl;
  var csrf = form.dataset.csrf;
  var timerEl = document.getElementById('timer');
  var barEl = document.getElementById('timerBar');
  var countEl = document.getElementById('answeredCount');
  var blocks = form.querySelectorAll('.q-block');
  var endAt = Date.now() + remaining * 1000; // remaining time comes from the server, not the device clock
  var submitting = false;

  function pad(n) { return String(n).padStart(2, '0'); }

  function updateAnswered() {
    var done = 0;
    blocks.forEach(function (b) { if (b.querySelector('input:checked')) done++; });
    countEl.textContent = 'Answered ' + done + ' of ' + blocks.length;
    return done;
  }

  function leaveWarning(e) { e.preventDefault(); e.returnValue = ''; }
  window.addEventListener('beforeunload', leaveWarning);

  function send(auto) {
    if (submitting) return;
    submitting = true;
    window.removeEventListener('beforeunload', leaveWarning);
    form.elements.auto.value = auto ? '1' : '0';
    form.submit(); // form.submit() does not trigger the submit handler below
  }

  function tick() {
    var left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    timerEl.textContent = pad(Math.floor(left / 60)) + ':' + pad(left % 60);
    if (left <= 60) barEl.classList.add('timer-low');
    if (left <= 0 && !submitting) {
      document.getElementById('timeUp').classList.remove('d-none');
      send(true);
    }
  }
  setInterval(tick, 250);
  tick();

  // Save each answer as soon as it is chosen
  form.addEventListener('change', function (e) {
    if (e.target.type !== 'radio') return;
    updateAnswered();
    fetch(saveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: csrf, question_id: e.target.dataset.qid, option: e.target.value })
    }).catch(function () {}); // the final submit sends every answer again
  });

  // Manual submit: warn about unanswered questions
  form.addEventListener('submit', function (e) {
    if (submitting) return;
    var left = blocks.length - updateAnswered();
    var msg = left > 0 ? 'You have ' + left + ' unanswered question(s). Submit anyway?' : 'Submit your exam now?';
    if (!confirm(msg)) { e.preventDefault(); return; }
    submitting = true;
    window.removeEventListener('beforeunload', leaveWarning);
  });

  updateAnswered();
})();
