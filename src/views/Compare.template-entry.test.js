import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Compare.vue', import.meta.url), 'utf8')

test('compare page links to template management from both the header and the empty state', () => {
  assert.match(source, /const goToTemplates = \(\) => \{\s*router\.push\('\/templates'\)\s*\}/)
  assert.match(source, /class="compare-page__templates" @click="goToTemplates"/)
  assert.match(source, /@click="goToTemplates"[\s\S]*先管理球星模板/)
})
