import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
test('templates remains a lazy-loaded workbench route', () => {
  const block = source.split('path: "/templates"')[1]?.split('path:')[0]
  assert.ok(block)
  assert.match(block, /name: "Templates"/)
  assert.ok(block.includes('import("@/views/Templates.vue")'))
  assert.match(block, /workbenchPage:\s*true/)
})
