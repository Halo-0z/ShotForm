import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'experiments/model_lab'))
from timing import instrument


class TimingTests(unittest.TestCase):
    def test_standard_instrumentation_keeps_input_layout_and_outputs_and_accumulates_crops(self):
        class Session:
            def get_inputs(self): return [SimpleNamespace(name='input')]
            def get_outputs(self): return [SimpleNamespace(name='out')]
            def run(self, names, feeds):
                self.last = feeds['input']
                return [self.last + 2]
        model = SimpleNamespace(session=Session(), preprocess=lambda a: a + 1, postprocess=lambda a: a * 2)
        values = {}
        instrument(model, 'pose', values)
        image = np.arange(24).reshape(2, 4, 3)
        for _ in range(3):
            output = model.inference(model.preprocess(image))[0]
            np.testing.assert_array_equal(output, (image + 3).transpose(2, 0, 1)[None])
            model.postprocess(output)
        self.assertEqual(values['pose.calls'], 3)
        self.assertEqual(model.session.last.dtype, np.float32)
        self.assertTrue(model.session.last.flags.c_contiguous)
        self.assertNotIn('pose.d2h_copy_ms', values)  # Never invent separate transfer timing.
        self.assertGreater(values['pose.run_including_transfer_ms'], 0)
        values.clear()
        model.inference(image)
        self.assertEqual(values['pose.calls'], 1)


if __name__ == '__main__':
    unittest.main()
