#!/usr/bin/env python3
"""Print block-coordinate corners covering all existing Overworld region files."""

import re
import sys
from pathlib import Path


def region_corners(region_dir: Path) -> tuple[int, int, int, int] | None:
    coordinates = []
    for path in region_dir.glob("r.*.*.mca"):
        match = re.fullmatch(r"r\.(-?\d+)\.(-?\d+)\.mca", path.name)
        if match:
            coordinates.append((int(match[1]), int(match[2])))
    if not coordinates:
        return None
    return (
        min(x for x, _ in coordinates) * 512,
        min(z for _, z in coordinates) * 512,
        (max(x for x, _ in coordinates) + 1) * 512 - 1,
        (max(z for _, z in coordinates) + 1) * 512 - 1,
    )


if __name__ == "__main__":
    corners = region_corners(Path(sys.argv[1]))
    if corners is None:
        sys.exit("No Java region files found; cannot relight BlueMap world.")
    print(*corners)
