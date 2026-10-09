// On phones, tables with class "table-stack" become stacked cards.
// This copies each column heading onto its cells so the card can show the label.
document.querySelectorAll('table.table-stack').forEach(function (table) {
  var heads = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
  table.querySelectorAll('tbody tr').forEach(function (tr) {
    var col = 0;
    Array.prototype.forEach.call(tr.children, function (td) {
      var span = parseInt(td.getAttribute('colspan') || '1', 10);
      td.setAttribute('data-label', span > 1 ? '' : (heads[col] || ''));
      col += span;
    });
  });
  table.classList.add('is-stacked');
});
