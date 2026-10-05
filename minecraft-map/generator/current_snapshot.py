import json
import os
import stat
import tempfile
from pathlib import Path


def write_current_snapshot(path: Path, snapshot_id: str, updated_at: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o644
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as destination:
            json.dump({"snapshotId": snapshot_id, "updatedAt": updated_at}, destination, ensure_ascii=False, indent=2)
            destination.write("\n")
        os.chmod(temporary_name, mode)
        os.replace(temporary_name, path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)
