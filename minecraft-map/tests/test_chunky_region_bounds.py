import importlib.util
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "generator" / "chunky-region-bounds.py"
spec = importlib.util.spec_from_file_location("chunky_region_bounds", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RegionBoundsTest(unittest.TestCase):
    def test_existing_regions_cover_negative_and_positive_coordinates(self):
        with tempfile.TemporaryDirectory() as directory:
            region_dir = Path(directory)
            for name in ("r.-2.3.mca", "r.1.-1.mca", "r.invalid.0.mca"):
                (region_dir / name).touch()
            self.assertEqual(module.region_corners(region_dir), (-1024, -512, 1023, 2047))

    def test_empty_region_directory_has_no_bounds(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertIsNone(module.region_corners(Path(directory)))


if __name__ == "__main__":
    unittest.main()
