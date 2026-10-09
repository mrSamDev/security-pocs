/* ============================================================================
 * clickjacking-guard.js
 * ----------------------------------------------------------------------------
 * Drop-in anti-clickjacking guard for ANY site. Runs on page load, detects
 * whether the page is being framed, and reacts (overlay / frame-bust / report).
 *
 * USAGE — put this in the <head> of the site you want to protect:
 *
 *     <script>
 *       window.ClickjackGuardConfig = {
 *         bustOut:    true,       // try to break out of the frame
 *         showOverlay:true,       // paint a warning when framed
 *         overlayText:'This page cannot be displayed inside another site.',
 *         checkOwnHeaders: true,  // report X-Frame-Options / CSP of THIS page
 *         onDetect: function (r) { console.warn('clickjacked', r); },
 *         onClean:  function (r) { /* top-level * / }
 *       };
 *     </script>
 *     <script src="/clickjacking-guard.js" defer></script>
 *
 * OR configure per-script-tag with data attributes:
 *
 *     <script src="/clickjacking-guard.js"
 *             data-bust-out="false"
 *             data-overlay="true"
 *             data-overlay-text="Nope."></script>
 *
 * API exposed on window:
 *     ClickjackGuard.run()     -> re-run all checks, returns the report object
 *     ClickjackGuard.report()  -> last report (array of findings)
 *
 * NOTE: this is client-side and therefore best-effort. The ONLY reliable
 * defence is the server sending one of:
 *     Content-Security-Policy: frame-ancestors 'none'
 *     X-Frame-Options: DENY
 * See the README / detect page for per-server header recipes.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* -------------------------------------------------------------------------
   * 1. CONFIG — merge <script data-*> then window.ClickjackGuardConfig.
   * ----------------------------------------------------------------------- */
  var scriptEl = document.currentScript;
  var dataCfg = {};
  if (scriptEl && scriptEl.dataset) {
    if (scriptEl.dataset.bustOut !== undefined)
      dataCfg.bustOut = scriptEl.dataset.bustOut !== 'false';
    if (scriptEl.dataset.overlay !== undefined)
      dataCfg.showOverlay = scriptEl.dataset.overlay !== 'false';
    if (scriptEl.dataset.overlayText) dataCfg.overlayText = scriptEl.dataset.overlayText;
    if (scriptEl.dataset.checkHeaders !== undefined)
      dataCfg.checkOwnHeaders = scriptEl.dataset.checkHeaders !== 'false';
  }

  var defaults = {
    bustOut: true,
    showOverlay: true,
    overlayText: 'This page refused to be displayed inside another site.',
    checkOwnHeaders: true,
    logToConsole: true,
    onDetect: null,
    onClean: null
  };

  var CONFIG = Object.assign({}, defaults, dataCfg, global.ClickjackGuardConfig || {});

  /* -------------------------------------------------------------------------
   * 2. RESULT STORE
   * ----------------------------------------------------------------------- */
  var findings = [];
  function record(status, label, detail) {
    findings.push({ status: status, label: label, detail: detail || '' });
  }

  /* -------------------------------------------------------------------------
   * 3. FRAME CHECK — the core signal.
   * `window`, `window.top` and `window.self` are on the cross-origin allowlist
   * and are always readable, so `window.self !== window.top` reliably detects
   * framing even cross-origin. The try/catch is defensive only.
   * ----------------------------------------------------------------------- */
  function checkFramed() {
    var framed, how;
    try {
      if (global.self === global.top) {
        framed = false; how = 'window.self === window.top';
      } else {
        framed = true;  how = 'window.self !== window.top';
      }
    } catch (e) {
      // Defensive: assume framed if the environment threw.
      framed = true;
      how = 'window.top threw ' + (e && e.name) + ' (treated as framed)';
    }
    record(framed ? 'fail' : 'pass', 'Framed', (framed ? 'YES — ' : 'No — ') + how);
    return framed;
  }

  /* -------------------------------------------------------------------------
   * 4. ANCESTOR CHECK — is the frame hidden/off-screen? (same-origin only)
   * ----------------------------------------------------------------------- */
  function checkAncestors() {
    var fe = null;
    try { fe = global.frameElement; } catch (e) { fe = null; }

    if (!fe) {
      record('info', 'Frame visibility',
        global.self === global.top
          ? 'Not applicable (top-level document).'
          : 'Cross-origin parent — CSS not inspectable.');
      return;
    }

    var suspects = [], node = fe;
    while (node && node.nodeType === 1) {
      var cs;
      try { cs = global.getComputedStyle(node); } catch (e) { break; }

      var op = parseFloat(cs.opacity);
      if (!isNaN(op) && op < 0.1) suspects.push(tag(node) + ' opacity=' + op);
      if (cs.visibility === 'hidden' || cs.visibility === 'collapse')
        suspects.push(tag(node) + ' visibility=' + cs.visibility);
      if (cs.display === 'none') suspects.push(tag(node) + ' display=none');
      if (cs.pointerEvents === 'none') suspects.push(tag(node) + ' pointer-events=none');

      var w = parseFloat(cs.width), h = parseFloat(cs.height);
      if ((!isNaN(w) && w <= 1) || (!isNaN(h) && h <= 1))
        suspects.push(tag(node) + ' size=' + cs.width + 'x' + cs.height);

      var l = parseFloat(cs.left), t = parseFloat(cs.top);
      if ((!isNaN(l) && l < -1000) || (!isNaN(t) && t < -1000))
        suspects.push(tag(node) + ' off-screen');

      if (cs.clip && cs.clip.indexOf('rect(0px, 0px, 0px, 0px)') === 0)
        suspects.push(tag(node) + ' clip');
      if (cs.transform && /matrix\(0,\s*0,\s*0,\s*0/.test(cs.transform))
        suspects.push(tag(node) + ' transform');

      node = node.parentElement;
    }

    if (suspects.length)
      record('fail', 'Frame visibility',
        'Frame appears concealed — ' + suspects.slice(0, 6).join('; '));
    else
      record('pass', 'Frame visibility', 'No concealment CSS found on the frame or its ancestors.');
  }

  function tag(el) { return el.tagName.toLowerCase(); }

  /* -------------------------------------------------------------------------
   * 5. SANDBOX CHECK — flags the parent gave the embedding iframe.
   * ----------------------------------------------------------------------- */
  function checkSandbox() {
    var fe = null;
    try { fe = global.frameElement; } catch (e) { fe = null; }
    if (!fe) { record('info', 'Sandbox', 'No reachable <iframe> element.'); return; }

    var flags = [];
    if (fe.sandbox) for (var i = 0; i < fe.sandbox.length; i++) flags.push(fe.sandbox[i]);

    if (!flags.length) record('info', 'Sandbox', 'No sandbox attribute.');
    else if (flags.indexOf('allow-scripts') !== -1 && flags.indexOf('allow-same-origin') !== -1)
      record('warn', 'Sandbox', 'allow-scripts + allow-same-origin -> weak isolation: [' + flags.join(', ') + ']');
    else record('warn', 'Sandbox', 'flags: [' + flags.join(', ') + ']');
  }

  /* -------------------------------------------------------------------------
   * 6. HEADER CHECK — does THIS site's server send anti-framing headers?
   * ----------------------------------------------------------------------- */
  function checkHeaders(done) {
    if (!CONFIG.checkOwnHeaders || !/^https?:$/.test(global.location.protocol)) {
      record('info', 'Anti-framing headers', 'Skipped (protocol "' + global.location.protocol + '").');
      return done();
    }
    fetch(global.location.href, { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
      .then(function (res) {
        var xfo = res.headers.get('x-frame-options');
        var csp = res.headers.get('content-security-policy');
        var fa = csp ? frameAncestors(csp) : null;
        var bits = [];
        if (xfo) bits.push('X-Frame-Options: ' + xfo);
        if (fa)  bits.push('CSP frame-ancestors: ' + fa);
        if (xfo || fa) record('pass', 'Anti-framing headers', 'Present — ' + bits.join(' | '));
        else record('fail', 'Anti-framing headers', 'NONE — server sent no X-Frame-Options or CSP frame-ancestors.');
        done();
      })
      .catch(function (err) {
        record('warn', 'Anti-framing headers', 'Could not read headers: ' + err.message);
        done();
      });
  }

  function frameAncestors(csp) {
    var parts = csp.split(';');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.toLowerCase().indexOf('frame-ancestors') === 0)
        return p.replace(/^frame-ancestors\s*/i, '');
    }
    return null;
  }

  /* -------------------------------------------------------------------------
   * 7. REACT — frame-bust + overlay.
   * ----------------------------------------------------------------------- */
  function react(framed) {
    if (!framed) return;

    if (CONFIG.bustOut) {
      try {
        if (global.top.location.href !== global.self.location.href)
          global.top.location = global.self.location;
      } catch (e) {
        record('warn', 'Frame-buster', 'Blocked (' + e.name + '); overlay fallback used.');
      }
    }
    if (CONFIG.showOverlay) installOverlay();
  }

  function installOverlay() {
    var paint = function () {
      if (document.getElementById('__clickjack_warning__')) return;
      if (!document.body) return;
      var o = document.createElement('div');
      o.id = '__clickjack_warning__';
      o.setAttribute('style', [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'background:#7f1d1d', 'color:#fff',
        'display:flex', 'align-items:center', 'justify-content:center',
        'text-align:center', 'padding:2rem',
        'font:700 18px/1.4 -apple-system,BlinkMacSystemFont,sans-serif'
      ].join(';'));
      o.textContent = CONFIG.overlayText;
      document.body.appendChild(o);
    };
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', paint, { once: true });
    else paint();
  }

  /* -------------------------------------------------------------------------
   * 8. RUN
   * ----------------------------------------------------------------------- */
  function run() {
    findings = [];
    var framed = checkFramed();
    checkAncestors();
    checkSandbox();
    react(framed);

    var finish = function () {
      var report = { framed: framed, findings: findings };
      if (CONFIG.logToConsole && global.console) {
        console.group('%c[clickjacking-guard]', 'color:#f85149;font-weight:bold');
        console.log('framed:', framed);
        console.table(findings);
        console.groupEnd();
      }
      if (framed && typeof CONFIG.onDetect === 'function') CONFIG.onDetect(report);
      if (!framed && typeof CONFIG.onClean === 'function') CONFIG.onClean(report);
    };

    checkHeaders(finish);
    return findings;
  }

  // Boot on page load.
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();

  /* -------------------------------------------------------------------------
   * 9. PUBLIC API
   * ----------------------------------------------------------------------- */
  global.ClickjackGuard = {
    run: run,
    report: function () { return findings.slice(); },
    config: CONFIG
  };

})(typeof window !== 'undefined' ? window : this);
