# security-pocs

## Clickjacking

Detector/guard + attacker harness live in [`clickjacking/`](./clickjacking/).
See that folder's [README](./clickjacking/README.md) for usage, config, the
server-side fix, and how it was verified.

```bash
python3 -m http.server 8080
open http://localhost:8080/clickjacking/clickjacking-detect.html
```

## PDF attack tests

`generate_poc.py`, `generate_poc_full.py`, `generate_big_pdf.py`,
`inspect_poc.py`, `input.pdf`, `big-15mb.pdf`, `test-js.pdf`, `test-js-full.pdf`.
