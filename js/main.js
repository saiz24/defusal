/* boot once the document is parsed; no modules, no fetch, file:// safe */
function defusalStart() {
  DEFUSAL.fx.init();
  DEFUSAL.backdrop.init();
  DEFUSAL.boot();
  if (DEFUSAL.room3d) DEFUSAL.room3d.init();
  DEFUSAL.cutscene.init();
  DEFUSAL.cutscene.maybePlay();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', defusalStart);
} else {
  defusalStart();
}
