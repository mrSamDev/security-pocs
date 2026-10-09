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

## Demo lab (framable vs protected)

A second deployed site for testing against: **https://cj-lab-sand.vercel.app/**

- `/victim.html` — intentionally **framable** (no anti-framing headers).
- `/protected.html` — sends `X-Frame-Options: DENY` + `CSP frame-ancestors 'none'`
  (set in `demo/vercel.json`), so it **stays blank** in a frame.

The index embeds both side by side and links to the checker with `?url=`
pre-filled. Point the checker at each to see the difference — the framable page
renders, the protected one does not. (Cross-origin, the checker cannot confirm
this programmatically; a blank frame vs a rendered one is the signal.)

Source: `demo/` (`index.html`, `victim.html`, `protected.html`, `vercel.json`).

## Deployment

Both sites are Vercel projects under `mrsamdevs-projects`:

| Site | Stable URL | Vercel project → alias | Source |
|------|-----------|------------------------|--------|
| Checker | https://cj-deploy.vercel.app/clickjacking/clickjacking-test.html | `cj-deploy` → `cj-deploy.vercel.app` | `clickjacking-test.html` |
| Lab | https://cj-lab-sand.vercel.app/ | `cj-lab` → `cj-lab-sand.vercel.app` | `demo/` |

Redeploy after edits (staged in `/tmp` to keep the repo clean):

```bash
# checker
rm -rf /tmp/cj-deploy && mkdir -p /tmp/cj-deploy/clickjacking
cp clickjacking/clickjacking-test.html /tmp/cj-deploy/clickjacking/
cd /tmp/cj-deploy && vercel deploy --prod --yes

# lab
rm -rf /tmp/cj-lab && cp -R clickjacking/demo /tmp/cj-lab
cd /tmp/cj-lab && vercel deploy --prod --yes
```

Notes:

- `cj-lab.vercel.app` was already taken, so the lab uses `cj-lab-sand.vercel.app`.
- Raw `*-mrsamdevs-projects.vercel.app` deployment URLs sit behind Vercel SSO
  protection — use the stable aliases above.
- The lab's `/protected.html` headers come from `demo/vercel.json`; the checker
  is self-contained (no external JS / no headers required).

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
