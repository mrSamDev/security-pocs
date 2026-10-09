# Clickjacking Detector & Guard

A small, dependency-free toolkit that detects whether a page is being framed
(clickjacked), reacts to it, and provides an attacker/target harness for testing
any site.

Two things it does:

1. **Defends** a site you own — `clickjacking-guard.js` runs on page load,
   detects framing, and warns / breaks out.
2. **Tests** any site — `clickjacking-attacker-demo.html` frames a target URL
   with a transparent decoy overlay so you can see whether it is framable.

> **Reality check:** client-side detection is *best-effort*. An attacker can
> strip the script, sandbox the frame, or hide the overlay. The only reliable
> defence is a **server-side** header (`Content-Security-Policy:
> frame-ancestors` / `X-Frame-Options`). This kit reports whether those headers
> are missing — it does not replace them.

---

## Contents

| File | Role |
|------|------|
| `clickjacking-guard.js` | Drop-in guard for **any** site. Detects framing, inspects hidden/off-screen ancestors, reports anti-framing headers, busts out and/or paints a warning overlay. |
| `clickjacking-detect.html` | Self-contained demo of the detector: a results table, console report, and a self-embed button so you can watch it fire. Also documents the zero-dependency inline variant and the "use on another site" setup. |
| `clickjacking-attacker-demo.html` | Attacker / target harness. Frames any URL (via input or `?target=`), overlays a transparent decoy, and includes per-server header recipes. |

---

## Quick start

Framing must be served over `http(s)` — most browsers refuse to frame `file://`
pages — so start a static server from the **repository root**:

```bash
python3 -m http.server 8080
```

Then open:

```bash
# 1. Watch the detector report on a clean, top-level page
open http://localhost:8080/clickjacking/clickjacking-detect.html

# 2. Embed the detector in itself and watch it flag the frame
#    (press "Run self-embed test" on the page)

# 3. Point the harness at any site
open "http://localhost:8080/clickjacking/clickjacking-attacker-demo.html?target=https://example.com"

# 4. Or run the harness against the local detector (full report)
open "http://localhost:8080/clickjacking/clickjacking-attacker-demo.html"
```

Open the browser DevTools console to see the structured `[clickjacking-guard]`
report.

---

## Protect a site you own

Add the guard to the `<head>` of the site:

```html
<script>
  window.ClickjackGuardConfig = {
    bustOut: true,          // try to navigate the top window away from the frame
    showOverlay: true,      // paint a warning overlay when framed
    overlayText: 'This page cannot be displayed inside another site.',
    checkOwnHeaders: true,  // fetch this URL and report its anti-framing headers
    onDetect: function (report) { console.warn('clickjacked', report); },
    onClean:  function (report) { /* top-level */ }
  };
</script>
<script src="/clickjacking-guard.js" defer></script>
```

Or configure with data attributes on the script tag:

```html
<script src="/clickjacking-guard.js" data-bust-out="false" data-overlay="true"></script>
```

### Config options

| Option | Default | Meaning |
|--------|---------|---------|
| `bustOut` | `true` | Try to set `window.top.location` to this page when framed. Blocked by browsers for cross-origin parents and sandboxed frames — hence the overlay fallback. |
| `showOverlay` | `true` | Inject a full-screen `#__clickjack_warning__` element when framed. |
| `overlayText` | *(default string)* | Text for the overlay. |
| `checkOwnHeaders` | `true` | `fetch()` this page and report `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`. Requires `http(s)`. |
| `logToConsole` | `true` | Log the findings via `console.table`. |
| `onDetect(report)` | `null` | Called when framed. `report = { framed, findings }`. |
| `onClean(report)` | `null` | Called when **not** framed. |

### API

```js
ClickjackGuard.run();      // re-run all checks
ClickjackGuard.report();   // array of { status, label, detail }
ClickjackGuard.config;     // resolved configuration
```

---

## What it checks

Each check records a `pass` / `fail` / `warn` / `info` finding:

1. **Framed** — `window.self !== window.top`. This comparison is allowed
   cross-origin (`window`, `window.top`, `window.self` are on the cross-origin
   allowlist and always readable), so it reliably detects framing even when the
   parent is another origin.
2. **Frame visibility** — walks the embedding `<iframe>` and its ancestors
   (same-origin only) looking for concealment CSS: `opacity ≈ 0`, `visibility:
   hidden`, `display: none`, size ≤ 1px, `pointer-events: none`, off-screen
   position, zero `clip` / `clip-path`, collapsed `transform`.
3. **Sandbox** — reads the `sandbox` flags the parent gave the frame. Warns on
   the weak `allow-scripts` + `allow-same-origin` combination.
4. **Anti-framing headers** — fetches this page and reports whether the server
   sent `X-Frame-Options` or `Content-Security-Policy: frame-ancestors`.

---

## Fix it on the server

`Content-Security-Policy: frame-ancestors` is the modern control and supersedes
`X-Frame-Options`; send both for legacy browsers.

```nginx
# nginx
add_header X-Frame-Options "DENY" always;
add_header Content-Security-Policy "frame-ancestors 'none'" always;
```

```apache
# Apache (.htaccess)
Header always set X-Frame-Options "DENY"
Header always set Content-Security-Policy "frame-ancestors 'none'"
```

```js
// Express / Node
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  next();
});
```

```js
// Next.js (next.config.js)
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }
  ]
}]
```

Use `frame-ancestors 'self'` / `SAMEORIGIN` instead of `'none'` / `DENY` if you
legitimately embed your own pages.

---

## How it was verified

Tested in a headless browser (agent-browser) against a local `python3 -m
http.server`:

| Scenario | Result |
|----------|--------|
| Detector as top-level page | `CLEAN — this page is the top-level document.` |
| Detector embedded in itself (same-origin) | `CLICKJACKED`, warning overlay injected, checks `FAIL / PASS / INFO / FAIL` |
| `clickjacking-guard.js` as top-level (clean) | `onClean` fired, **Framed** = pass |
| `clickjacking-guard.js` framed, `bustOut:false` | `framed = true`, `onDetect` fired, overlay present |
| `clickjacking-guard.js` framed, `bustOut:true` | Escaped the frame (top window navigated to the page) |
| Anti-framing headers under stock `http.server` | `FAIL` — no headers sent (expected) |

---

## Limitations

- **Client-side only.** A determined attacker who controls the embedding page
  can defeat any in-page guard. Treat this as detection/telemetry, not
  enforcement.
- **Cross-origin CSS is not inspectable.** The "frame visibility" check only
  works when the parent is same-origin; otherwise it reports a `warn`.
- **Frame-busting is often blocked.** Modern browsers block top-level
  navigation from sandboxed frames and cross-origin parents — the overlay is the
  fallback, and the real fix remains the server header.
- **`checkOwnHeaders` needs `http(s)`** and a same-origin `fetch`; it is skipped
  on `file://`.
