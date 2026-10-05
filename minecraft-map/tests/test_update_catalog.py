import json
import runpy
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


GENERATOR = Path(__file__).resolve().parents[1] / "generator"
sys.path.insert(0, str(GENERATOR))


class UpdateCatalogTest(unittest.TestCase):
    def test_replaces_current_json_without_opening_existing_file_for_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            world_root = output / "worlds" / "pmc6"
            world_root.mkdir(parents=True)
            current_path = world_root / "current.json"
            current_path.write_text('{"snapshotId":"old"}\n', encoding="utf-8")
            metadata_path = world_root / "snapshots" / "new" / "metadata.json"
            metadata_path.parent.mkdir(parents=True)
            original_open = Path.open

            def deny_direct_write(path, mode="r", *args, **kwargs):
                if path == current_path and "w" in mode:
                    raise PermissionError("existing current.json is not writable")
                return original_open(path, mode, *args, **kwargs)

            arguments = [
                str(GENERATOR / "update_catalog.py"),
                "--output", str(output),
                "--world-id", "pmc6",
                "--world-name", "PMC6.0",
                "--snapshot-id", "new",
                "--snapshot-label", "New",
                "--created-at", "2026-10-05T03:00:00+09:00",
                "--base-url", "/minecraft-map",
                "--metadata", str(metadata_path),
                "--source", "backup.tar.gz",
                "--dynmap-world", "world",
                "--bluemap-url", "/minecraft-map/worlds/pmc6/snapshots/new/bluemap/",
            ]
            with patch.object(sys, "argv", arguments), patch.object(Path, "open", deny_direct_write):
                runpy.run_path(str(GENERATOR / "update_catalog.py"), run_name="__main__")

            current = json.loads(current_path.read_text(encoding="utf-8"))
            catalog = json.loads((output / "catalog.json").read_text(encoding="utf-8"))
            self.assertEqual(current["snapshotId"], "new")
            self.assertEqual(catalog["worlds"][0]["currentSnapshot"], "new")
            self.assertEqual(current["updatedAt"], catalog["updatedAt"])
            self.assertEqual(list(world_root.glob(".current.json.*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
