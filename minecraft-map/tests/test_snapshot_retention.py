import json
import sys
import tempfile
import unittest
from pathlib import Path


GENERATOR = Path(__file__).resolve().parents[1] / "generator"
sys.path.insert(0, str(GENERATOR))

from snapshot_retention import apply_retention  # noqa: E402


class SnapshotRetentionTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.output = Path(self.temporary.name)
        self.snapshots_root = self.output / "worlds" / "pmc6" / "snapshots"
        self.snapshots = [
            ("monday", "2026-09-07T03:00:00+09:00"),
            ("tuesday", "2026-09-08T03:00:00+09:00"),
            ("latest", "2026-09-09T03:00:00+09:00"),
        ]
        for snapshot_id, _ in self.snapshots:
            (self.snapshots_root / snapshot_id).mkdir(parents=True)
        catalog = {
            "version": 1,
            "updatedAt": self.snapshots[-1][1],
            "worlds": [{
                "id": "pmc6",
                "name": "PMC6.0",
                "currentSnapshot": "latest",
                "snapshots": [
                    {"id": snapshot_id, "createdAt": created_at, "label": snapshot_id, "baseUrl": "/map"}
                    for snapshot_id, created_at in self.snapshots
                ],
            }],
        }
        (self.output / "catalog.json").write_text(json.dumps(catalog), encoding="utf-8")
        (self.output / "worlds" / "pmc6" / "current.json").write_text("{}", encoding="utf-8")

    def tearDown(self):
        self.temporary.cleanup()

    def test_dry_run_does_not_change_catalog_or_directories(self):
        original = (self.output / "catalog.json").read_text(encoding="utf-8")
        self.assertEqual(
            apply_retention(self.output, "pmc6", "Asia/Tokyo", True, "future-latest"),
            ["tuesday", "latest"],
        )
        self.assertEqual((self.output / "catalog.json").read_text(encoding="utf-8"), original)
        self.assertTrue((self.snapshots_root / "tuesday").exists())

    def test_apply_retains_mondays_and_latest(self):
        self.assertEqual(apply_retention(self.output, "pmc6", "Asia/Tokyo", False), ["tuesday"])
        self.assertTrue((self.snapshots_root / "monday").exists())
        self.assertFalse((self.snapshots_root / "tuesday").exists())
        self.assertTrue((self.snapshots_root / "latest").exists())
        updated = json.loads((self.output / "catalog.json").read_text(encoding="utf-8"))
        self.assertEqual([item["id"] for item in updated["worlds"][0]["snapshots"]], ["monday", "latest"])

    def test_apply_rejects_snapshot_ids_outside_world_directory(self):
        catalog_path = self.output / "catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        catalog["worlds"][0]["snapshots"].insert(0, {
            "id": "../unsafe",
            "createdAt": "2026-09-01T03:00:00+09:00",
            "label": "unsafe",
            "baseUrl": "/map",
        })
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "Unsafe snapshot path"):
            apply_retention(self.output, "pmc6", "Asia/Tokyo", False)
        self.assertTrue((self.snapshots_root / "tuesday").exists())


if __name__ == "__main__":
    unittest.main()
