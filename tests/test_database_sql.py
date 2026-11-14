"""Execute production SQL with SQLite. Complements, does not replace Rust integration tests."""
import json
import re
import sqlite3
import unittest
from pathlib import Path

SOURCE = (Path(__file__).resolve().parents[1] / 'src-tauri/src/database/repository.rs').read_text(encoding='utf-8')
QUERY = re.search(r'let query = "(SELECT \* FROM analysis_history\s+WHERE.*?)";', SOURCE, re.S).group(1)
INSERT = re.search(r'r#"\s*(INSERT INTO analysis_history\s.*?VALUES.*?)"#', SOURCE, re.S).group(1)
UPDATE = re.search(r'sqlx::query\(\s*"(UPDATE analysis_history SET training_date = \?, notes = \?, tags_json = \? WHERE id = \?)"\s*,?\s*\)', SOURCE).group(1)


class DatabaseSQLTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        # Recreate the pre-migration production schema, then run the real migration SQL.
        self.db.execute(re.search(r'r#"\s*(CREATE TABLE IF NOT EXISTS analysis_history.*?)"#', SOURCE, re.S).group(1))
        self.migrate()

    def tearDown(self):
        self.db.close()

    def migrate(self):
        for sql in re.findall(r'"(ALTER TABLE analysis_history ADD COLUMN [^"]+)"', SOURCE):
            try:
                self.db.execute(sql)
            except sqlite3.OperationalError as error:
                if 'duplicate column name' not in str(error):
                    raise
        backfill = re.search(r'"(UPDATE analysis_history SET training_date = date\(created_at[^\"]+)"', SOURCE).group(1)
        self.db.execute(backfill)

    def insert(self, timestamp):
        return self.db.execute(INSERT, ('embedded', 'annotated', json.dumps({'shotType': 'oneMotion'}), None, '[]', None, None, 'video:source', None, timestamp)).lastrowid

    def query(self, tag=None, offset=0):
        return self.db.execute(QUERY, (None, None, None, None, tag, tag, 'onemotion', 'onemotion', 20, offset)).fetchall()

    def test_filters_apply_before_pagination_and_tags_are_exact(self):
        first = self.insert(1000)
        self.db.execute(UPDATE, ('2026-11-15', 'note', '["target"]', first))
        for i in range(25):
            self.insert(2000 + i)
        self.assertEqual(len(self.query()), 20)
        self.assertEqual(len(self.query(offset=20)), 6)
        self.assertEqual([row['id'] for row in self.query('target')], [first])
        self.assertEqual(self.query('tar'), [])
        self.assertEqual(self.query("' OR 1=1 --"), [])

    def test_old_dates_backfill_and_metadata_survives_repeat_migration(self):
        row_id = self.insert(1700000000000)
        self.db.execute("UPDATE analysis_history SET training_date = '' WHERE id = ?", (row_id,))
        self.migrate()
        row = self.db.execute('SELECT * FROM analysis_history WHERE id = ?', (row_id,)).fetchone()
        self.assertTrue(row['training_date'])
        self.assertEqual(json.loads(row['tags_json']), [])
        self.db.execute(UPDATE, ('2026-11-15', '<script>text</script>', '["练习"]', row_id))
        self.migrate()
        row = self.db.execute('SELECT * FROM analysis_history WHERE id = ?', (row_id,)).fetchone()
        self.assertEqual(row['notes'], '<script>text</script>')
        self.assertEqual(row['training_date'], '2026-11-15')

    def filter_type(self, shot_type, limit=20, offset=0):
        normalized = shot_type.replace('_', '').lower()
        return self.db.execute(QUERY, (None, None, None, None, None, None,
                                      normalized, normalized, limit, offset)).fetchall()

    def test_video_overall_type_wins_before_pagination_and_images_are_unchanged(self):
        video_ids = []
        for i in range(23):
            row_id = self.insert(1000 + i)
            video_ids.append(row_id)
            overall = ['two_motion', 'twoMotion', 'TwoMotion'][i % 3]
            self.db.execute('UPDATE analysis_history SET video_analysis_json = ? WHERE id = ?',
                            (json.dumps({'overallShotType': overall}), row_id))
        image_ids = [self.insert(2000 + i) for i in range(25)]
        first_page = self.filter_type('two_motion')
        second_page = self.filter_type('two_motion', offset=20)
        self.assertEqual([row['id'] for row in first_page + second_page], list(reversed(video_ids)))
        self.assertEqual(len(first_page), 20)
        self.assertEqual(len(second_page), 3)
        self.assertEqual([row['id'] for row in self.filter_type('one_motion', limit=50)], list(reversed(image_ids)))

    def test_missing_video_type_falls_back_but_explicit_unknown_does_not(self):
        fallback_ids = []
        unknown_ids = []
        for payload in [None, {}, {'overallShotType': None}, {'overallShotType': ''}]:
            row_id = self.insert(1000)
            fallback_ids.append(row_id)
            self.db.execute('UPDATE analysis_history SET video_analysis_json = ? WHERE id = ?',
                            (json.dumps(payload) if payload is not None else None, row_id))
        for overall in ['unknown', 'Unknown', 'unsupported']:
            row_id = self.insert(1000)
            unknown_ids.append(row_id)
            self.db.execute('UPDATE analysis_history SET video_analysis_json = ? WHERE id = ?',
                            (json.dumps({'overallShotType': overall}), row_id))
        self.assertEqual({row['id'] for row in self.filter_type('one_motion')}, set(fallback_ids))
        self.assertEqual({row['id'] for row in self.filter_type('unknown')}, set(unknown_ids))


if __name__ == '__main__':
    unittest.main()
