import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const componentPath = resolve('D:/智能投篮分析/src/components/SuggestionPanel/index.vue')
const source = readFileSync(componentPath, 'utf8')

test('SuggestionPanel resolves AI image inputs before invoking coaching generation', () => {
  assert.match(source, /resolveAiImageSource/)
  assert.match(source, /const imageData = await resolveAiImageSource\(/)
  assert.match(source, /const annotatedImageData = await resolveAiImageSource\(/)
})

test('SuggestionPanel persists regenerated AI coaching for history records', () => {
  assert.match(source, /analysisStore\.currentHistoryId/)
  assert.match(source, /await analysisStore\.updateHistoryAiCoaching\(/)
})

test('SuggestionPanel exposes a visible regeneration success hint', () => {
  assert.match(source, /successMessage/)
  assert.match(source, /v-if="successMessage"/)
})

test('SuggestionPanel uses the shared Button component for AI actions', () => {
  assert.match(source, /import \{ Button \} from '@\/components\/ui\/button'/)
  assert.match(source, /class="ai-action-button"/)
  assert.doesNotMatch(source, /<el-button size="small" plain :loading="loading"/)
})
