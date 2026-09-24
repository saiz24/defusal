/* ==========================================================================
   DEFUSAL — zoom gestures.

   The case and the manual both take a continuous zoom now, instead of the
   case's two fixed steps. Every input a player might reach for lands here and
   comes out as one call: "scale by this factor, about this point".

     mouse wheel          one notch is about 12%; the case zooms on a plain
                          wheel, the manual only with Ctrl/Cmd held, because
                          a plain wheel over a document has to scroll it
     trackpad pinch       Chrome, Edge and Electron report it as a wheel with
                          ctrlKey set; Safari as gesturestart/gesturechange
     two fingers          a touch pinch, from pointer events

   A wheel event's deltaY is pixels, lines or pages depending on the device.
   It is normalised to pixels first, so a mouse that reports lines and a
   trackpad that reports pixels zoom at comparable speeds.
   ========================================================================== */

(function (D) {
  'use strict';

  var LINE = 16, PAGE = 400;

  function wheelPixels(e) {
    var d = e.deltaY || 0;
    if (e.deltaMode === 1) d *= LINE;
    else if (e.deltaMode === 2) d *= PAGE;
    return d;
  }

  /* A pinch reports small, frequent deltas and wants to track the fingers
     closely; a mouse wheel reports large notches and wants each one to be a
     definite step. Capped either way, so one violent flick is not 10x. */
  function wheelFactor(e) {
    var px = wheelPixels(e);
    var k = e.ctrlKey ? 0.011 : 0.0024;
    return Math.exp(-Math.max(-160, Math.min(160, px)) * k);
  }

  /* attach(el, opts)
       opts.zoom(factor, clientX, clientY)   required
       opts.plainWheel   true: a bare wheel zooms (the case)
                         false: only Ctrl/Cmd + wheel or a pinch zooms
       opts.enabled()    optional gate, checked on every event
       opts.end()        optional, called when a pinch lets go
     Returns a function that detaches everything. */
  function attach(el, opts) {
    if (!el || !el.addEventListener) return function () {};
    var on = opts.enabled || function () { return true; };

    function onWheel(e) {
      if (!on()) return;
      var modded = e.ctrlKey || e.metaKey;
      if (!opts.plainWheel && !modded) return;   /* let it scroll */
      /* a sideways two-finger swipe on a trackpad is not a zoom */
      if (!modded && Math.abs(e.deltaX || 0) > Math.abs(e.deltaY || 0)) return;
      e.preventDefault();
      opts.zoom(wheelFactor(e), e.clientX, e.clientY);
    }

    /* Safari's own pinch. The scale it reports is cumulative from the start
       of the gesture, so each change is divided by the last one seen. */
    var gLast = 1;
    function onGestureStart(e) {
      if (!on()) return;
      e.preventDefault(); gLast = 1;
    }
    function onGestureChange(e) {
      if (!on()) return;
      e.preventDefault();
      var s = e.scale || 1;
      opts.zoom(s / gLast, e.clientX, e.clientY);
      gLast = s;
    }
    function onGestureEnd(e) {
      if (!on()) return;
      e.preventDefault();
      if (opts.end) opts.end();
    }

    /* Two fingers. Pointers are tracked by id; with exactly two down, the
       change in the distance between them is the factor and their midpoint
       is the point held still. */
    var pts = {}, pinchDist = 0;
    function touchCount() { return Object.keys(pts).length; }
    function spread() {
      var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]];
      return {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2, y: (a.y + b.y) / 2
      };
    }
    function onDown(e) {
      if (e.pointerType !== 'touch' || !on()) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (touchCount() === 2) pinchDist = spread().d;
    }
    function onMove(e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (touchCount() !== 2 || pinchDist <= 0) return;
      var s = spread();
      if (s.d > 0) {
        opts.zoom(s.d / pinchDist, s.x, s.y);
        pinchDist = s.d;
      }
    }
    function onUp(e) {
      if (!pts[e.pointerId]) return;
      var was = touchCount();
      delete pts[e.pointerId];
      if (was === 2) { pinchDist = 0; if (opts.end) opts.end(); }
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    el.addEventListener('gestureend', onGestureEnd, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    return function detach() {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }

  D.zoomGesture = { attach: attach, wheelFactor: wheelFactor };
})(DEFUSAL);
