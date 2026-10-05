import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


GENERATOR = Path(__file__).resolve().parents[1] / "generator"
sys.path.insert(0, str(GENERATOR))

from current_snapshot import write_current_snapshot  # noqa: E402


class CurrentSnapshotTest(unittest.TestCase):
    def test_creates_current_json_for_new_world(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "world" / "current.json"
            write_current_snapshot(path, "first", "2026-10-05T03:00:00+09:00")
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["snapshotId"], "first")

    def test_failed_replace_keeps_existing_current_json_and_cleans_temporary_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "current.json"
            path.write_text('{"snapshotId":"old"}\n', encoding="utf-8")
            with patch("current_snapshot.os.replace", side_effect=PermissionError("rename denied")):
                with self.assertRaises(PermissionError):
                    write_current_snapshot(path, "new", "2026-10-05T03:00:00+09:00")
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["snapshotId"], "old")
            self.assertEqual(list(path.parent.glob(".current.json.*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
