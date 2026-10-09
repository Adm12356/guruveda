// Slide the abacus beads when a bead is clicked: that bead and all beads after it move right,
// beads before it move back left.
document.querySelectorAll('.rod').forEach(function (rod) {
  var beads = Array.from(rod.querySelectorAll('.bead'));

  rod.addEventListener('click', function (e) {
    var bead = e.target.closest('.bead');
    if (!bead) return;
    var index = beads.indexOf(bead);
    var free = rod.clientWidth - beads.length * beads[0].offsetWidth;
    var alreadyRight = beads[index].dataset.right === '1';

    beads.forEach(function (b, i) {
      var goRight = alreadyRight ? i > index : i >= index;
      b.dataset.right = goRight ? '1' : '0';
      b.style.transform = goRight ? 'translateX(' + free + 'px)' : 'translateX(0)';
    });
  });
});
