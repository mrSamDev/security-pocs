# Clickjacking guard

A tiny script that checks on page load whether the page is being framed
(clickjacked), and reacts.

## Use it

Configure the guard first, then load it in the `<head>` — either from your own
site (recommended) or from the jsDelivr CDN. The config block is identical for
both.

**Self-hosted** (copy `clickjacking-guard.js` into your site):

```html
<script>
  window.ClickjackGuardConfig = {
    bustOut: true,     // try to break out of the frame
    showWarning: true, // show a warning overlay when framed
    onCheck: function (isFramed) { console.log('framed:', isFramed); }
  };
</script>
<script src="/clickjacking-guard.js" defer></script>
```

**From the jsDelivr CDN:**

```html
<script>
  window.ClickjackGuardConfig = {
    bustOut: true,     // try to break out of the frame
    showWarning: true, // show a warning overlay when framed
    onCheck: function (isFramed) { console.log('framed:', isFramed); }
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/mrSamDev/security-pocs@main/clickjacking/clickjacking-guard.js" defer></script>
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

## Test it

```bash
python3 -m http.server 8080
```

Open the guard page directly (reports `framed: false`), or drop it into an
`<iframe>` (reports `framed: true`).
