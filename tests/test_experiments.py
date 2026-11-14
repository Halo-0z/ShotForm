import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from evaluate_annotations import angle, evaluate


class AnnotationTests(unittest.TestCase):
    def test_known_right_angle(self):
        self.assertAlmostEqual(angle({"x": 0, "y": 1}, {"x": 0, "y": 0}, {"x": 1, "y": 0}), 90)

    def test_empty_labels_are_not_zero_error(self):
        self.assertIsNone(evaluate([{"image": "unlabeled.jpg"}])["mae_degrees"])

    def test_degenerate_points_are_rejected(self):
        with self.assertRaises(ValueError):
            angle(*[{"x": 0, "y": 0}] * 3)


if __name__ == "__main__":
    unittest.main()
