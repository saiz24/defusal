/* boot once the document is parsed; no modules, no fetch, file:// safe */
function defusalStart() {
  DEFUSAL.fx.init();
  DEFUSAL.backdrop.init();
  DEFUSAL.boot();
  if (DEFUSAL.room3d) DEFUSAL.room3d.init();
  DEFUSAL.cutscene.init();
  if (DEFUSAL.shell) DEFUSAL.shell.init();
  /* a plain address opens through the shell; anything specific goes
     straight where it asks */
  if (DEFUSAL.shell && DEFUSAL.shell.wanted()) DEFUSAL.shell.start();
  else DEFUSAL.cutscene.maybePlay();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', defusalStart);
} else {
  defusalStart();
}
