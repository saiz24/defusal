/* boot once the document is parsed; no modules, no fetch, file:// safe */
function defusalStart() {
  DEFUSAL.backdrop.init();
  DEFUSAL.boot();
  DEFUSAL.cutscene.init();
  DEFUSAL.cutscene.maybePlay();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', defusalStart);
} else {
  defusalStart();
}
