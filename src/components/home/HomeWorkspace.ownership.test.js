import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homeSource = readFileSync(new URL('../../views/Home.vue', import.meta.url), 'utf8')
const uploadSource = readFileSync(new URL('../../views/Upload.vue', import.meta.url), 'utf8')

test('active route views do not directly import HomeWorkspace', () => {
  assert.doesNotMatch(homeSource, /HomeWorkspace/)
  assert.doesNotMatch(uploadSource, /HomeWorkspace/)
})
