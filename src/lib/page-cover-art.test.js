import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./page-cover-art.ts', import.meta.url), 'utf8')

test('page cover art maps upload, analysis, and history to the approved assets', () => {
  assert.match(source, /upload:\s*'\/hero\/jordan-dunk\.png'/)
  assert.match(source, /analysis:\s*'\/hero\/jordan-shot-analysis\.png'/)
  assert.match(source, /history:\s*'\/hero\/the-shot-history\.png'/)
})
