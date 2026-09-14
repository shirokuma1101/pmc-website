#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path


def contains_snapshot(catalog_path: Path, world_id: str, snapshot_id: str) -> bool:
    if not catalog_path.is_file():
        return False
    with catalog_path.open(encoding="utf-8") as source:
        catalog = json.load(source)
    return any(
        snapshot.get("id") == snapshot_id
        for world in catalog.get("worlds", [])
        if world.get("id") == world_id
        for snapshot in world.get("snapshots", [])
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--world-id", required=True)
    parser.add_argument("--snapshot-id", required=True)
    args = parser.parse_args()
    try:
        exists = contains_snapshot(args.catalog, args.world_id, args.snapshot_id)
    except (OSError, json.JSONDecodeError, TypeError) as error:
        print(f"Unable to read catalog: {error}", file=sys.stderr)
        raise SystemExit(2) from error
    raise SystemExit(0 if exists else 1)
