import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('router defines the template management route for admin pre-import', () => {
  assert.match(
    source,
    /\{\s*path:\s*'\/templates',[\s\S]*name:\s*'Templates',[\s\S]*component:\s*\(\)\s*=>\s*import\('\@\/views\/Templates\.vue'\),[\s\S]*meta:\s*\{[\s\S]*title:\s*'[^']+'[\s\S]*\}\s*\}/
  )
})
