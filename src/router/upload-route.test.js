import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('router defines the dedicated upload workbench route', () => {
  assert.match(
    source,
    /\{\s*path:\s*'\/upload',[\s\S]*name:\s*'Upload',[\s\S]*component:\s*\(\)\s*=>\s*import\('\@\/views\/Upload\.vue'\),[\s\S]*meta:\s*\{[\s\S]*immersiveChrome:\s*true,[\s\S]*workbenchPage:\s*true[\s\S]*\}\s*\}/
  )
})
