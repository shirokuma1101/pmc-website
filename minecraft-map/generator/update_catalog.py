#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as source:
        return json.load(source)


parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True)
parser.add_argument("--world-id", required=True)
parser.add_argument("--world-name", required=True)
parser.add_argument("--snapshot-id", required=True)
parser.add_argument("--snapshot-label", required=True)
parser.add_argument("--created-at", required=True)
parser.add_argument("--base-url", required=True)
parser.add_argument("--metadata", required=True)
parser.add_argument("--source", required=True)
parser.add_argument("--dynmap-world", required=True)
args = parser.parse_args()

output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
metadata_path = Path(args.metadata)
with metadata_path.open("w", encoding="utf-8", newline="\n") as destination:
    json.dump({
        "snapshotId": args.snapshot_id,
        "source": args.source,
        "worldId": args.world_id,
        "dynmapWorld": args.dynmap_world,
        "createdAt": args.created_at,
    }, destination, ensure_ascii=False, indent=2)
    destination.write("\n")

catalog_path = output / "catalog.json"
catalog = read_json(catalog_path, {"version": 1, "updatedAt": args.created_at, "worlds": []})
world = next((item for item in catalog["worlds"] if item["id"] == args.world_id), None)
if world is None:
    world = {"id": args.world_id, "name": args.world_name, "currentSnapshot": args.snapshot_id, "snapshots": []}
    catalog["worlds"].append(world)

world["name"] = args.world_name
world["snapshots"] = [item for item in world.get("snapshots", []) if item["id"] != args.snapshot_id]
world["snapshots"].append({
    "id": args.snapshot_id,
    "label": args.snapshot_label,
    "createdAt": args.created_at,
    "baseUrl": args.base_url.rstrip("/") + f"/worlds/{args.world_id}/snapshots/{args.snapshot_id}",
})
world["snapshots"].sort(key=lambda item: item["createdAt"])
world["currentSnapshot"] = world["snapshots"][-1]["id"]
catalog["worlds"].sort(key=lambda item: item["name"])
catalog["updatedAt"] = max(
    snapshot["createdAt"]
    for catalog_world in catalog["worlds"]
    for snapshot in catalog_world.get("snapshots", [])
)

temporary = output / ".catalog.json.tmp"
with temporary.open("w", encoding="utf-8", newline="\n") as destination:
    json.dump(catalog, destination, ensure_ascii=False, indent=2)
    destination.write("\n")
os.replace(temporary, catalog_path)

current_path = output / "worlds" / args.world_id / "current.json"
current_path.parent.mkdir(parents=True, exist_ok=True)
with current_path.open("w", encoding="utf-8", newline="\n") as destination:
    json.dump({"snapshotId": world["currentSnapshot"], "updatedAt": catalog["updatedAt"]}, destination, ensure_ascii=False, indent=2)
    destination.write("\n")
