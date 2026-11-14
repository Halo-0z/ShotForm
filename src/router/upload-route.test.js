import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
test('upload remains a lazy-loaded workbench route', () => {
  const block = source.split('path: "/upload"')[1]?.split('path:')[0]
  assert.ok(block)
  assert.match(block, /name: "Upload"/)
  assert.ok(block.includes('import("@/views/Upload.vue")'))
  assert.match(block, /workbenchPage:\s*true/)
})
