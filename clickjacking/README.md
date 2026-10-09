# Clickjacking guard

A tiny script that checks on page load whether the page is being framed
(clickjacked), and reacts.

## Use it

Put `clickjacking-guard.js` in your site and load it in the `<head>`:

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

| Option | Default | Meaning |
|--------|---------|---------|
| `bustOut` | `true` | Try to navigate the top window to this page. |
| `showWarning` | `true` | Render a full-screen warning overlay when framed. |
| `warning` | *(default text)* | Overlay text. |
| `onCheck` | `null` | Called with `true`/`false` after the check. |

API: `ClickjackGuard.run()`, `ClickjackGuard.isFramed()`.

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
