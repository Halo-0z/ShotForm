import test from 'node:test'
import assert from 'node:assert/strict'
import { compareTrainingAngles, recordFrame, localDate } from './training-comparison.js'
import { escapeHtml, reportImage, reportTable, reportDocument } from './report-html.js'

test('training comparison retains zero and negative differences, excludes missing/uncertain angles', () => {
  const angle = (name, value, status = 'normal') => ({ name, value, status })
  const rows = compareTrainingAngles([angle('a', 90), angle('b', 0), angle('c', 100, 'low_confidence'), angle('d', 50)], [angle('a', 80), angle('b', 0), angle('c', 95)])
  assert.equal(rows[0].delta, -10)
  assert.equal(rows[1].delta, 0)
  assert.equal(rows[2].delta, null)
  assert.match(rows[2].reason, /置信度/)
  assert.equal(rows[3].after, null)
  assert.match(rows[3].reason, /缺少/)
})
test('frame selection uses embedded frames without accessing original video', () => {
  const r = { analysis: { angles: [] }, imagePath: 'single', videoAnalysis: { bestFrameIndex: 1, videoPath: 'deleted.mp4', frames: [{ imageData: 'frame0', analysis: { angles: [1] } }, { imageData: 'frame1', analysis: { angles: [2] } }] } }
  assert.equal(recordFrame(r).image, 'frame1')
  assert.equal(recordFrame(r, 0).image, 'frame0')
  assert.deepEqual(recordFrame(r, 0).analysis.angles, [1])
  assert.equal(recordFrame({ ...r, videoAnalysis: null }).image, 'single')
})
test('HTML reports escape user text, reject external/active images, and include print styling', () => {
  const payload = '<script>alert("x")</script>&'
  assert.equal(escapeHtml(payload), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;')
  assert.doesNotMatch(reportImage('https://example.com/tracker.png'), /<img/)
  assert.doesNotMatch(reportImage('data:image/svg+xml;base64,PHN2Zz4='), /<img/)
  assert.match(reportImage('data:image/png;base64,AAAA'), /<img/)
  const html = reportDocument('中文报告', reportTable(['备注'], [[payload]]))
  assert.match(html, /@media print/)
  assert.match(html, /charset="utf-8"/)
  assert.doesNotMatch(html, /<script>/)
})
test('training dates use local calendar values', () => {
  assert.equal(localDate(new Date(2026, 0, 2, 23).getTime()), '2026-01-02')
})

test('visibility 0.1 knee and hip results never contribute comparison deltas or trend points', async () => {
  const { trainingTrendPoints } = await import('./training-comparison.js')
  const names = ['left_knee_angle', 'right_knee_angle', 'left_hip_angle', 'right_hip_angle']
  const low = names.map(name => ({ name, value: 180, confidence: 0.1, status: 'low_confidence' }))
  const high = names.map(name => ({ name, value: 150, confidence: 1, status: 'normal' }))
  for (const [before, after] of [[low, high], [high, low]]) {
    const differences = compareTrainingAngles(before, after)
    assert.equal(differences.length, 4)
    for (const row of differences) {
      assert.equal(row.delta, null)
      assert.match(row.reason, /置信度/)
    }
  }
  const record = (angles, createdAt) => ({ analysis: { angles }, createdAt })
  for (const name of names) {
    assert.deepEqual(trainingTrendPoints([record(low, 1), record(high, 2)], name), [{ time: 2, value: 150 }])
    assert.deepEqual(trainingTrendPoints([record(low, 1)], name), [])
  }
  // Zero is a valid observation, not a missing value.
  assert.deepEqual(trainingTrendPoints([record([{ name: 'zero', value: 0, status: 'normal' }], 3)], 'zero'), [{ time: 3, value: 0 }])
})
