import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Home.vue', import.meta.url), 'utf8')

test('home route is a cover-only page without competing workbench modules', () => {
  assert.doesNotMatch(source, /import\s+HomeWorkspace/)
  assert.doesNotMatch(source, /import\s+UploadWorkbenchPage/)
  assert.doesNotMatch(source, /useAnalysisStore/)
  assert.doesNotMatch(source, /workspace-reveal|workspace-surface|workbench__/)
  assert.doesNotMatch(source, /<HomeWorkspace|<UploadWorkbenchPage/)
})

test('home route sends the CTA through fog navigation into /upload', () => {
  assert.match(source, /useRouter/)
  assert.match(source, /navigateWithFogTransition/)
  assert.match(source, /['"]\/upload['"]/)
  assert.doesNotMatch(source, /['"]\/analysis['"]/)
  assert.match(source, /@click="handleStart"/)
})

test('home route keeps a single cover heading and primary CTA', () => {
  assert.equal((source.match(/<h1\b/g) ?? []).length, 1)
  assert.equal((source.match(/class="home-page__hero-cta"/g) ?? []).length, 1)
  assert.match(source, /<HomePlayerCarousel/)
  assert.match(source, /:disabled="isLoading"/)
  assert.match(source, /@click="handleStart"/)
})
