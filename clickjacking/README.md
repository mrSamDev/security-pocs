# Clickjacking guard

A tiny script that checks on page load whether the page is being framed
(clickjacked), and reacts.

## Use it

Configure the guard first, then load it in the `<head>`. The **jsDelivr CDN** is
the quickest option; self-host if you prefer no third-party dependency. The
config block is identical for both.

**jsDelivr CDN (recommended):**

```html
<script>
  window.ClickjackGuardConfig = {
    bustOut: true,     // try to break out of the frame
    showWarning: true, // show a warning overlay when framed
    onCheck: function (isFramed) {
      if (isFramed) alert('Clickjacking detected: this page is being framed!');
    }
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/mrSamDev/security-pocs@main/clickjacking/clickjacking-guard.js" defer></script>
```

**Self-hosted** (copy `clickjacking-guard.js` into your site):

```html
<script>
  window.ClickjackGuardConfig = {
    bustOut: true,     // try to break out of the frame
    showWarning: true, // show a warning overlay when framed
    onCheck: function (isFramed) {
      if (isFramed) alert('Clickjacking detected: this page is being framed!');
    }
  };
</script>
<script src="/clickjacking-guard.js" defer></script>
```

| Option | Default | Meaning |
|--------|---------|---------|
| `bustOut` | `true` | Try to navigate the top window to this page. |
| `showWarning` | `true` | Render a full-screen warning overlay when framed. |
| `warning` | *(default text)* | Overlay text. |
| `onCheck` | `null` | Called with `true`/`false` after the check. |

API: `ClickjackGuard.run()`, `ClickjackGuard.isFramed()`.

## Load from a CDN (details)

Self-hosting is recommended (no third-party dependency). If you use jsDelivr,
pin a commit or tag instead of `@main` so the file can't change underneath you:

```html
<script src="https://cdn.jsdelivr.net/gh/mrSamDev/security-pocs@4b54590/clickjacking/clickjacking-guard.js" defer></script>
```

### Why not the GitHub URLs?

Both of these **cannot** be used as `<script src>` — the browser refuses to
execute them because of the wrong MIME type + `X-Content-Type-Options: nosniff`:

| URL | Served as | Result |
|-----|-----------|--------|
| `github.com/mrSamDev/security-pocs/blob/main/clickjacking/clickjacking-guard.js` | `text/html` | ❌ HTML page, not JS |
| `raw.githubusercontent.com/mrSamDev/security-pocs/main/clickjacking/clickjacking-guard.js` | `text/plain` | ❌ "MIME type not executable" |
| `cdn.jsdelivr.net/gh/mrSamDev/security-pocs@main/clickjacking/clickjacking-guard.js` | `application/javascript` | ✅ works |

## How it works

`window.self !== window.top` is true whenever the page is framed. `window.self`
and `window.top` are always readable, even cross-origin, so this works no matter
who did the framing.

## The real fix (server-side)

Client-side detection is best-effort — an attacker can strip the script. Add a
response header:

```
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
```

Use `frame-ancestors 'self'` / `SAMEORIGIN` instead if you embed your own pages.

## Live demo

Deployed on Vercel — no setup needed:

**https://cj-deploy.vercel.app/clickjacking/clickjacking-test.html**

Append `?url=` to test a target directly, e.g.
`…/clickjacking-test.html?url=https://example.com`.

## Test it (locally)

Serve the folder over http(s) (framing `file://` pages is blocked):

```bash
python3 -m http.server 8080
```

- **`clickjacking-test.html`** — stand-alone checker (no external JS): loads any
  URL in a frame and reports whether it can be framed. Open
  `http://localhost:8080/clickjacking/clickjacking-test.html`, or append
  `?url=https://example.com` to test a target directly. Same-origin targets are
  verified; cross-origin ones depend on what the browser exposes (see the
  in-page notes).
- **The guard page** — open it directly to get `framed: false`, or drop it into
  an `<iframe>` to get `framed: true`.
