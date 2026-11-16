"""Synthetic visualizer fixtures are not experimental human ground truth."""
import copy
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'experiments/model_lab'))
from common import angles, write, sha, read
from review import point_status, index_prediction, observations, skeleton_panel, render


class ReviewTests(unittest.TestCase):
    def fixture(self):
        person = {'11': {'x': 50, 'y': 60, 'score': .9}, '13': {'x': 70, 'y': 70, 'score': .1},
                  '15': {'x': -3, 'y': 75, 'score': .99}}
        row = {'frame_id': 'f', 'sha256': 'png-hash', 'repeat': 0, 'person_count': 2,
               'selection_reason': 'ambiguous_multiple_people', 'selected_person_index': None,
               'people': [person, copy.deepcopy(person)], 'points': {}, 'angles': angles({}),
               'pipeline_ms': 2, 'stages': {}}
        data = {'frames': [{'id': 'f', 'sample_id': 's', 'width': 100, 'height': 120,
                            'sha256': 'png-hash', 'image': 'f.png', 'frame_index': 1, 'timestamp_ms': 33,
                            'manual_keypoints': {}, 'annotator': '', 'subject_present': None}]}
        return data, {'dataset_sha256': 'dataset-hash', 'rows': [row], 'load_ms': 1, 'model': {'test': True}}

    def test_missing_low_nonfinite_and_outside_stay_distinct(self):
        self.assertEqual(point_status(None,100,120), 'missing')
        self.assertEqual(point_status({'x':0,'y':0,'score':.1},100,120), 'low_score')
        self.assertEqual(point_status({'x':0,'y':0,'score':.55},100,120), 'score_ge_055')
        self.assertEqual(point_status({'x':-1,'y':0,'score':.99},100,120), 'outside_image')
        self.assertEqual(point_status({'x':0,'y':0,'score':float('nan')},100,120), 'nonfinite')

    def test_ambiguous_people_are_retained_not_mislabeled_as_no_detection(self):
        data, prediction = self.fixture()
        row = index_prediction(data,prediction,'dataset-hash')['f']
        note = observations(data['frames'][0],row)
        self.assertEqual(note['people'],2)
        self.assertEqual(note['selection_reason'],'ambiguous_multiple_people')
        self.assertEqual(note['body_point_status_all_people']['outside_image'],2)
        self.assertEqual(note['body_point_status_all_people']['low_score'],2)
        self.assertIsNone(note['selected_person_index'])

    def test_tampered_dataset_frame_and_selected_identity_rejected(self):
        for change in ('dataset','frame','count','selection','missing_people'):
            data, p = self.fixture()
            if change=='dataset': p['dataset_sha256']='other'
            if change=='frame': p['rows'][0]['sha256']='other'
            if change=='count': p['rows'][0]['person_count']=1
            if change=='selection': p['rows'][0]['selected_person_index']=0
            if change=='missing_people': del p['rows'][0]['people']
            with self.assertRaises(ValueError):index_prediction(data,p,'dataset-hash')

    def test_draw_does_not_change_raw_predictions_or_clamp_outside_points(self):
        _, p = self.fixture()
        row=p['rows'][0]
        before=copy.deepcopy(row)
        original=Image.new('RGB',(100,120),'black')
        rendered=skeleton_panel(original,row)
        self.assertEqual(row,before)
        self.assertEqual(original.getbbox(),None)
        self.assertIsNotNone(rendered.getbbox())
        self.assertEqual(rendered.getpixel((0,75)),(0,0,0))

    def test_offline_render_records_failure_and_keeps_labels_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);run=root/'run';run.mkdir();(run/'heavy-cpu').mkdir()
            data,p=self.fixture()
            Image.new('RGB',(100,120),'black').save(root/'f.png')
            data['frames'][0]['sha256']=sha(root/'f.png')
            write(root/'dataset.json',data)
            (run/'dataset.json').write_bytes((root/'dataset.json').read_bytes())
            p['dataset_sha256']=sha(root/'dataset.json');p['rows'][0]['sha256']=sha(root/'f.png')
            write(run/'heavy-cpu/predictions.json',p)
            write(run/'run.json',{'dataset_sha256':p['dataset_sha256'],'runs':{
                'heavy-cpu':{'exit_code':0,'error':None},'rtmpose-cuda':{'exit_code':1,'error':'fixture failure'}}})
            result=render(root/'dataset.json',run,root/'review')
            self.assertEqual(result['human_reviewed_frames'],0)
            self.assertIn('rtmpose-cuda',result['failed_runs'])
            self.assertEqual(read(root/'dataset.json')['frames'][0]['manual_keypoints'],{})
            self.assertTrue((root/'review/frames/000.jpg').exists())
            self.assertIn('没有人工标注', (root/'review/index.html').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
