#!/usr/bin/env python3
import argparse
import json
import os
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def timezone_info(name: str):
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        # Windows Python does not always bundle IANA timezone data. Japan has
        # used UTC+09:00 without daylight saving time throughout this project.
        if name == "Asia/Tokyo":
            return timezone(timedelta(hours=9), name)
        raise


def read_catalog(path: Path) -> dict:
    if not path.exists():
        return {"version": 1, "updatedAt": None, "worlds": []}
    with path.open("r", encoding="utf-8") as source:
        return json.load(source)


def parse_created_at(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def retention_plan(
    catalog: dict, world_id: str, timezone_name: str, keep_snapshot_id: str | None = None
) -> tuple[dict | None, list[dict], list[dict]]:
    world = next((item for item in catalog.get("worlds", []) if item.get("id") == world_id), None)
    if not world or not world.get("snapshots"):
        return world, [], []

    snapshots = sorted(world["snapshots"], key=lambda item: item["createdAt"])
    latest_id = keep_snapshot_id or snapshots[-1]["id"]
    zone = timezone_info(timezone_name)
    retained = []
    removed = []
    for snapshot in snapshots:
        created_at = parse_created_at(snapshot["createdAt"]).astimezone(zone)
        if snapshot["id"] == latest_id or created_at.weekday() == 0:
            retained.append(snapshot)
        else:
            removed.append(snapshot)
    return world, retained, removed


def apply_retention(
    output: Path,
    world_id: str,
    timezone_name: str,
    dry_run: bool,
    keep_snapshot_id: str | None = None,
) -> list[str]:
    catalog_path = output / "catalog.json"
    catalog = read_catalog(catalog_path)
    world, retained, removed = retention_plan(catalog, world_id, timezone_name, keep_snapshot_id)
    removed_ids = [snapshot["id"] for snapshot in removed]
    if dry_run or not removed_ids or world is None:
        return removed_ids

    snapshots_root = output / "worlds" / world_id / "snapshots"
    resolved_root = snapshots_root.resolve()
    targets = []
    for snapshot_id in removed_ids:
        target = (snapshots_root / snapshot_id).resolve()
        if target.parent != resolved_root:
            raise ValueError(f"Unsafe snapshot path: {target}")
        targets.append(target)
    for target in targets:
        if target.exists():
            shutil.rmtree(target)

    latest_id = retained[-1]["id"]
    world["snapshots"] = retained
    world["currentSnapshot"] = latest_id
    remaining_dates = [
        snapshot["createdAt"]
        for catalog_world in catalog.get("worlds", [])
        for snapshot in catalog_world.get("snapshots", [])
    ]
    if remaining_dates:
        catalog["updatedAt"] = max(remaining_dates)

    temporary = output / ".catalog.json.tmp"
    with temporary.open("w", encoding="utf-8", newline="\n") as destination:
        json.dump(catalog, destination, ensure_ascii=False, indent=2)
        destination.write("\n")
    os.replace(temporary, catalog_path)

    current_path = output / "worlds" / world_id / "current.json"
    with current_path.open("w", encoding="utf-8", newline="\n") as destination:
        json.dump(
            {"snapshotId": latest_id, "updatedAt": catalog["updatedAt"]},
            destination,
            ensure_ascii=False,
            indent=2,
        )
        destination.write("\n")
    return removed_ids


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--world-id", required=True)
    parser.add_argument("--timezone", default="Asia/Tokyo")
    parser.add_argument("--keep-snapshot-id")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    removed_ids = apply_retention(
        Path(args.output), args.world_id, args.timezone, args.dry_run, args.keep_snapshot_id
    )
    for snapshot_id in removed_ids:
        print(snapshot_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
