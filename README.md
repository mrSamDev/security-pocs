# security-pocs

## Clickjacking

Client-side clickjacking detector / guard plus a target harness. Framing needs
`http(s)` (most browsers block `file://` framing), so serve the folder first:

```bash
python3 -m http.server 8080
# detector demo
open http://localhost:8080/clickjacking-detect.html
# harness — frame any site, e.g.
open "http://localhost:8080/clickjacking-attacker-demo.html?target=https://example.com"
```

| file | what it is |
|------|------------|
| `clickjacking-guard.js` | Drop-in guard for **any** site. Configure via `window.ClickjackGuardConfig` or `data-*` attrs; API `ClickjackGuard.run()` / `.report()`. Detects framing, inspects hidden/off-screen ancestors, reports `X-Frame-Options` / `frame-ancestors`, busts out and/or paints an overlay. |
| `clickjacking-detect.html` | Self-contained demo of the detector with a report table + self-embed test to see it fire. |
| `clickjacking-attacker-demo.html` | Attacker/target harness: frames any `?target=` URL with a transparent decoy overlay, plus per-server header recipes. |

Defence is still **server-side**:

```
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
```

## PDF attack tests

`generate_poc.py`, `generate_poc_full.py`, `generate_big_pdf.py`,
`inspect_poc.py`, `input.pdf`, `big-15mb.pdf`, `test-js.pdf`, `test-js-full.pdf`.
