/* ============================================================================
 * clickjacking-guard.js — detect clickjacking on page load.
 *
 * WHAT IT DOES
 *   1. Checks whether the page is inside a frame (window.self !== window.top).
 *   2. If framed: tries to break out, and shows a warning overlay.
 *   3. Calls an optional callback with the result.
 *
 * USE IT ON ANY SITE — put this in the <head>:
 *
 *   <script>
 *     window.ClickjackGuardConfig = {
 *       bustOut: true,          // try to leave the frame
 *       showWarning: true,      // render the warning overlay
 *       warning: 'Custom text',
 *       onCheck: function (isFramed) { console.log('framed:', isFramed); }
 *     };
 *   </script>
 *   <script src="/clickjacking-guard.js" defer></script>
 *
 * API:  ClickjackGuard.run()  -> re-check, returns true/false
 *       ClickjackGuard.isFramed()
 *
 * NOTE: this is client-side and best-effort. The reliable fix is the server
 * sending:  Content-Security-Policy: frame-ancestors 'none'
 *            X-Frame-Options: DENY
 * ========================================================================== */
(function () {
  'use strict';

  /* 1. Config — merge user config over defaults. */
  var CONFIG = Object.assign({
    bustOut: true,
    showWarning: true,
    warning: 'This page is being displayed inside another site. Do not enter credentials here.',
    onCheck: null
  }, window.ClickjackGuardConfig || {});

  /* 2. Am I framed?
   *    window.self and window.top are always readable, even cross-origin,
   *    so this comparison works no matter who framed us. */
  function isFramed() {
    return window.self !== window.top;
  }

  /* 3. Try to escape the frame.
   *    Blocked by browsers when the parent is cross-origin or sandboxed —
   *    that's what the overlay fallback is for. */
  function bustOut() {
    try {
      if (window.top.location.href !== window.self.location.href) {
        window.top.location = window.self.location;
      }
    } catch (e) { /* cross-origin parent: cannot navigate it */ }
  }

  /* 4. Paint a full-screen warning we control, inside the frame. */
  function showWarningOverlay() {
    var paint = function () {
      if (!document.body || document.getElementById('__clickjack_warning__')) return;
      var el = document.createElement('div');
      el.id = '__clickjack_warning__';
      el.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;background:#7f1d1d;color:#fff;' +
        'display:flex;align-items:center;justify-content:center;text-align:center;' +
        'padding:2rem;font:700 18px/1.4 -apple-system,BlinkMacSystemFont,sans-serif';
      el.textContent = CONFIG.warning;
      document.body.appendChild(el);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', paint, { once: true });
    } else {
      paint();
    }
  }

  /* 5. Run the check. */
  function run() {
    var framed = isFramed();
    if (framed) {
      if (CONFIG.bustOut) bustOut();
      if (CONFIG.showWarning) showWarningOverlay();
    }
    if (typeof CONFIG.onCheck === 'function') CONFIG.onCheck(framed);
    return framed;
  }

  /* 6. Boot on page load. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  /* 7. Public API. */
  window.ClickjackGuard = { run: run, isFramed: isFramed };
})();
