import json
import sys
import tempfile
import unittest
from pathlib import Path


GENERATOR = Path(__file__).resolve().parents[1] / "generator"
sys.path.insert(0, str(GENERATOR))

from snapshot_catalog import contains_snapshot  # noqa: E402


class SnapshotCatalogTest(unittest.TestCase):
    def test_missing_catalog_is_not_existing(self):
        with tempfile.TemporaryDirectory() as temporary:
            self.assertFalse(contains_snapshot(Path(temporary) / "catalog.json", "pmc1", "sep1"))

    def test_only_matching_world_snapshot_is_existing(self):
        with tempfile.TemporaryDirectory() as temporary:
            catalog_path = Path(temporary) / "catalog.json"
            catalog_path.write_text(json.dumps({
                "worlds": [{"id": "pmc1", "snapshots": [{"id": "sep1"}]}],
            }), encoding="utf-8")
            self.assertTrue(contains_snapshot(catalog_path, "pmc1", "sep1"))
            self.assertFalse(contains_snapshot(catalog_path, "pmc1", "aug30"))
            self.assertFalse(contains_snapshot(catalog_path, "pmc2", "sep1"))

    def test_invalid_catalog_is_not_silently_treated_as_missing(self):
        with tempfile.TemporaryDirectory() as temporary:
            catalog_path = Path(temporary) / "catalog.json"
            catalog_path.write_text("{", encoding="utf-8")
            with self.assertRaises(json.JSONDecodeError):
                contains_snapshot(catalog_path, "pmc1", "sep1")


if __name__ == "__main__":
    unittest.main()
