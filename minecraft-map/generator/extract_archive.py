#!/usr/bin/env python3
import pathlib
import shutil
import sys
import tarfile

archive = pathlib.Path(sys.argv[1]).resolve()
destination = pathlib.Path(sys.argv[2]).resolve()
destination.mkdir(parents=True, exist_ok=True)

with tarfile.open(archive, "r:gz") as source:
    members = source.getmembers()
    for member in members:
        target = (destination / member.name).resolve()
        if destination not in target.parents and target != destination:
            raise SystemExit(f"Unsafe archive path: {member.name}")
        if not (member.isfile() or member.isdir()):
            raise SystemExit(f"Unsupported archive entry: {member.name}")

    selected_properties = None
    selected_world_prefix = None
    for member in members:
        if not member.isfile() or pathlib.PurePosixPath(member.name).name != "server.properties":
            continue
        file_object = source.extractfile(member)
        if file_object is None:
            continue
        properties = file_object.read().decode("utf-8", errors="replace")
        level_name = next(
            (line.split("=", 1)[1].strip() for line in properties.splitlines() if line.startswith("level-name=")),
            "Bedrock level",
        )
        server_root = pathlib.PurePosixPath(member.name).parent
        world_prefix = (server_root / "worlds" / level_name).as_posix().rstrip("/") + "/"
        if any(candidate.name.startswith(world_prefix) for candidate in members):
            selected_properties = member.name
            selected_world_prefix = world_prefix
            break

    if selected_properties is None or selected_world_prefix is None:
        raise SystemExit("No server.properties with a matching Bedrock world was found")

    selected = [
        member for member in members
        if member.name == selected_properties
        or member.name.rstrip("/") == selected_world_prefix.rstrip("/")
        or member.name.startswith(selected_world_prefix)
    ]
    for member in selected:
        target = destination / member.name
        if member.isdir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        file_object = source.extractfile(member)
        if file_object is None:
            raise SystemExit(f"Cannot read archive entry: {member.name}")
        with target.open("wb") as output:
            shutil.copyfileobj(file_object, output)

    print(f"Selected {len(selected)} world entries from {len(members)} archive entries")
