import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ComparisonView/index.vue', import.meta.url), 'utf8')

test('comparison view uses the shared comparison store and backend workbench', () => {
  assert.match(source, /useComparisonStore/)
  assert.match(source, /comparisonStore\.ensureWorkbench\(\{/)
  assert.match(source, /ComparisonRankingList/)
  assert.match(source, /ComparisonDetailPane/)
  assert.doesNotMatch(source, /buildLocalWorkbench/)
  assert.doesNotMatch(source, /invoke<ComparisonResult>\('compare_with_player'/)
})

test('comparison view exposes template management inside the embedded workbench', () => {
  assert.match(source, /import \{ useRouter \} from 'vue-router'/)
  assert.match(source, /const openTemplateManager = \(\) => \{\s*router\.push\('\/templates'\)\s*\}/)
  assert.match(source, /class="comparison-toolbar"/)
  assert.match(source, /@click="openTemplateManager"/)
  assert.match(source, />\s*管理模板\s*</)
})

test('comparison view exposes a manual refresh after templates are changed', () => {
  assert.match(source, /const refreshWorkbench = \(\) => \{[\s\S]*?void comparisonStore\.refreshWorkbench\(\)[\s\S]*?\}/)
  assert.match(source, /const canRefreshWorkbench = computed\(\(\) => \{/)
  assert.match(source, /class="comparison-toolbar__action comparison-toolbar__refresh"/)
  assert.match(source, />\s*刷新对比\s*</)
  assert.match(source, /@click="refreshWorkbench"/)
  assert.match(source, /:disabled="!canRefreshWorkbench"/)
})

test('comparison view keeps progress and retry wired to real store state', () => {
  assert.match(source, /<ComparisonProgress/)
  assert.match(source, /:progress="comparisonStore\.progress"/)
  assert.match(source, /:can-retry="comparisonStore\.canRetry"/)
  assert.match(source, /@retry="void comparisonStore\.retry\(\)"/)
  assert.match(source, /class="comparison-loading-shell"/)
})
