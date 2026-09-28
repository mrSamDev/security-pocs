#!/usr/bin/env python3
"""Verify that /OpenAction, /JavaScript, /JS and /AA survive a rewrite.

Two independent checks, because an alert is not evidence:

  1. Object-level  -- walk the parsed object tree with pypdf and locate
                      every vector, printing the payload it carries.
  2. Byte-level    -- scan the raw (decompressed) object streams for the
                      literal keys, so nothing is inferred from the parser.

Exit code is non-zero if any vector is missing.

Usage:
    python3 inspect_poc.py test-js-full.pdf
"""

from __future__ import annotations

import re
import sys
import zlib
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import IndirectObject

RAW_KEYS = ("/OpenAction", "/JavaScript", "/JS", "/AA")


def deref(obj):
    return obj.get_object() if isinstance(obj, IndirectObject) else obj


def walk_name_tree(node) -> list[tuple[str, str]]:
    """Return (name, js) pairs from a /JavaScript name tree."""
    out: list[tuple[str, str]] = []
    node = deref(node)
    names = node.get("/Names")
    if names:
        names = deref(names)
        for i in range(0, len(names), 2):
            action = deref(names[i + 1])
            out.append((str(names[i]), str(deref(action.get("/JS")))))
    kids = node.get("/Kids")
    if kids:
        kids = deref(kids)
        for kid in kids:
            out.extend(walk_name_tree(kid))
    return out


def object_level(path: Path) -> dict[str, list[str]]:
    """Locate each vector in the parsed tree and return its payloads."""
    reader = PdfReader(str(path))
    root = reader.trailer["/Root"]
    found: dict[str, list[str]] = {k: [] for k in RAW_KEYS}

    # /OpenAction
    oa = root.get("/OpenAction")
    if oa is not None:
        oa = deref(oa)
        if hasattr(oa, "get") and oa.get("/S") == "/JavaScript":
            found["/OpenAction"].append(str(deref(oa.get("/JS"))))
        else:
            found["/OpenAction"].append(f"(non-JS action/destination: {oa})")

    # /JavaScript name tree -> /JS
    js_tree = deref(root.get("/Names", {})).get("/JavaScript")
    if js_tree is not None:
        found["/JavaScript"].append("name tree present")
        for name, payload in walk_name_tree(js_tree):
            found["/JS"].append(f"[names:{name}] {payload}")

    # /AA additional actions (catalog and every page)
    containers = [("catalog", root)]
    for idx, page in enumerate(reader.pages):
        containers.append((f"page{idx}", deref(page)))
    for label, container in containers:
        aa = container.get("/AA")
        if aa is None:
            continue
        aa = deref(aa)
        found["/AA"].append(f"[{label}] keys={list(aa.keys())}")
        for key, action in aa.items():
            action = deref(action)
            if hasattr(action, "get") and action.get("/S") == "/JavaScript":
                found["/JS"].append(f"[{label}{key}] {deref(action.get('/JS'))}")

    return found


def decompress_all(raw: bytes) -> bytes:
    """Inflate every FlateDecode stream so byte-level scan sees real keys."""
    out = bytearray(raw)
    for m in re.finditer(rb"stream\r?\n", raw):
        start = m.end()
        end = raw.find(b"endstream", start)
        if end == -1:
            continue
        try:
            out += zlib.decompress(raw[start:end])
        except zlib.error:
            continue
    return bytes(out)


def byte_level(path: Path) -> dict[str, int]:
    blob = decompress_all(path.read_bytes())
    return {k: blob.count(k.encode()) for k in RAW_KEYS}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    path = Path(sys.argv[1])
    if not path.exists():
        print(f"missing: {path}")
        return 2

    print(f"file: {path}  ({path.stat().st_size} bytes)\n")

    found = object_level(path)
    print("== object level (parsed tree) ==")
    for key in RAW_KEYS:
        hits = found[key]
        print(f"{key:12} {'PRESENT' if hits else 'MISSING':7} x{len(hits)}")
        for h in hits:
            print(f"             - {h}")

    counts = byte_level(path)
    print("\n== byte level (raw + inflated streams) ==")
    for key in RAW_KEYS:
        print(f"{key:12} {'PRESENT' if counts[key] else 'MISSING':7} x{counts[key]}")

    missing = [k for k in RAW_KEYS if not found[k] or not counts[k]]
    print()
    if missing:
        print(f"FAIL: vectors missing -> {', '.join(missing)}")
        return 1
    print("PASS: all four vectors present in parsed tree and raw bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
