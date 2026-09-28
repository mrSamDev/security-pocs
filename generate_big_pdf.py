#!/usr/bin/env python3
"""Generate a valid PDF padded to a target size.

The padding is random (incompressible) bytes stored as real PDF attachments
under /Names /EmbeddedFiles, so the document stays valid and the file size
tracks the requested size almost exactly.

Usage:
    python3 generate_big_pdf.py                       # ~15 MiB -> big-15mb.pdf
    python3 generate_big_pdf.py --mb 25 --output big.pdf

Note: GitHub hard-rejects blobs >100 MiB and warns >50 MiB; keep below that.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from pypdf import PdfWriter

# Leave room for PDF scaffolding, xref, and per-object overhead.
SCAFFOLD_BYTES = 8 * 1024
CHUNKS = 3  # spread the pad over a few attachments


def build(target_bytes: int, dst: Path) -> int:
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)

    payload_size = max(target_bytes - SCAFFOLD_BYTES, 1024)
    per_chunk = payload_size // CHUNKS
    remainder = payload_size - per_chunk * CHUNKS

    for i in range(CHUNKS):
        size = per_chunk + (remainder if i == CHUNKS - 1 else 0)
        writer.add_attachment(f"pad-{i}.bin", os.urandom(size))

    with dst.open("wb") as fh:
        writer.write(fh)
    return dst.stat().st_size


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mb", type=float, default=15.0, help="target size in MiB")
    parser.add_argument("--output", default="big-15mb.pdf", type=Path)
    args = parser.parse_args()

    target = int(args.mb * 1024 * 1024)
    actual = build(target, args.output)
    print(
        f"wrote {args.output}  {actual} bytes  "
        f"({actual / 1024 / 1024:.2f} MiB, {actual / target * 100:.1f}% of target)"
    )


if __name__ == "__main__":
    main()
