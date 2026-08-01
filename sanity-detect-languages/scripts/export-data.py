#!/usr/bin/env python3
# Regenerates ../src/data/orthographies.json from the Hyperglot Python package.
#
#   python3 -m venv /tmp/hgvenv && /tmp/hgvenv/bin/pip install hyperglot
#   /tmp/hgvenv/bin/python scripts/export-data.py
#
# Output: one record per orthography with the codepoints (base + marks) a font must contain.
import json
import os

import hyperglot
from hyperglot.languages import Languages


def codepoints(s):
    """Every codepoint in a space-separated Hyperglot character string (excludes spaces)."""
    out = []
    for chunk in (s or "").split(" "):
        chunk = chunk.strip()
        for c in chunk:
            out.append(ord(c))
    return sorted(set(out))


def main():
    langs_db = Languages()
    records = []
    for iso, lang in langs_db.items():
        name = lang.get("name")
        for o in (lang.get("orthographies", []) or []):
            base = codepoints(o.get("base"))
            if not base:
                continue
            records.append({
                "iso": iso,
                "name": name,
                "autonym": o.get("autonym") or None,
                "script": o.get("script"),
                "status": o.get("status"),
                "base": base,
                "marks": codepoints(o.get("marks")),
            })

    records.sort(key=lambda x: (0 if x["status"] == "primary" else 1, x["name"] or "", x["script"] or ""))
    out = {
        "_meta": {"hyperglotVersion": hyperglot.__version__, "orthographyCount": len(records)},
        "orthographies": records,
    }

    dest = os.path.join(os.path.dirname(__file__), "..", "src", "data", "orthographies.json")
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(records)} orthographies (Hyperglot {hyperglot.__version__}) -> {os.path.normpath(dest)}")


if __name__ == "__main__":
    main()
