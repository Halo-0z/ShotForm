import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Templates.vue', import.meta.url), 'utf8')

test('template management page loads existing templates from the database commands', () => {
  assert.match(source, /invoke<PlayerTemplate\[]>\(['"]get_player_templates_db['"]\)/)
  assert.match(source, /templates\.value\s*=\s*\[\.\.\.response\]\.sort/)
})

test('template management page only saves video analysis as a reusable player template', () => {
  assert.match(source, /const\s*currentAnalysis\s*=\s*computed\(\(\)\s*=>\s*analysisStore\.currentAnalysis\)/)
  assert.match(source, /const\s*currentVideoAnalysis\s*=\s*computed\(\(\)\s*=>\s*analysisStore\.currentVideoAnalysis\)/)
  assert.match(source, /const\s*currentVideoTemplateProfile\s*=\s*computed\(\s*\(\)\s*=>\s*currentVideoAnalysis\.value\?\.templateProfile\s*\?\?\s*null,?\s*\)/)
  assert.match(source, /currentVideoTemplateProfile\.value/)
  assert.match(source, /请先上传并分析一段球星投篮视频/)
  assert.match(source, /poseData:\s*currentAnalysis\.value\.poseData/)
  assert.match(source, /angles:\s*currentAnalysis\.value\.angles/)
  assert.match(source, /const\s*templateProfile\s*=\s*currentVideoTemplateProfile\.value/)
  assert.match(source, /templateProfile:\s*templateProfile/)
  assert.doesNotMatch(source, /templateProfile:\s*currentVideoAnalysis\.value\?\.templateProfile\s*\?\?\s*null/)
  assert.match(source, /invoke<number>\(['"]add_player_template['"],\s*\{\s*template\s*\}\)/)
})

test('template management page edits template metadata without replacing pose data', () => {
  assert.match(source, /const\s*editingTemplateId\s*=\s*ref<number\s*\|\s*null>\(null\)/)
  assert.match(source, /const\s*editForm\s*=\s*reactive\(/)
  assert.match(source, /startEditingTemplate\(template\)/)
  assert.match(source, /const\s*payload\s*=\s*\{/)
  assert.match(source, /await\s*invoke<void>\(['"]update_player_template_metadata['"],\s*\{\s*template:\s*payload\s*\}\)/)
  assert.match(source, /id:\s*currentTemplate\.id|id:\s*editingTemplateId\.value/)
  assert.match(source, /name:\s*editForm\.name\.trim\(\)/)
  assert.match(source, /team:\s*editForm\.team\.trim\(\)/)
  assert.match(source, /description:\s*editForm\.description\.trim\(\)/)
  assert.doesNotMatch(source, /const\s*payload\s*=\s*\{[\s\S]*poseData:/)
  assert.doesNotMatch(source, /const\s*payload\s*=\s*\{[\s\S]*angles:/)
  assert.match(source, /@submit\.prevent="void\s*saveTemplateEdits\(\)"/)
})

test('template management page uses inline confirmation before deleting templates', () => {
  assert.match(source, /const\s*deletingTemplateId\s*=\s*ref<number\s*\|\s*null>\(null\)/)
  assert.match(source, /const\s*pendingDeleteTemplateId\s*=\s*ref<number\s*\|\s*null>\(null\)/)
  assert.match(source, /const\s*deleteError\s*=\s*ref\(['"]['"]\)/)
  assert.match(source, /const\s*requestDeleteTemplate\s*=\s*\(template:\s*PlayerTemplate\)\s*=>/)
  assert.match(source, /pendingDeleteTemplateId\.value\s*=\s*template\.id/)
  assert.match(source, /const\s*confirmDeleteTemplate\s*=\s*async\s*\(template:\s*PlayerTemplate\)\s*=>/)
  assert.match(source, /await\s*invoke<void>\(['"]delete_player_template['"],\s*\{\s*id:\s*template\.id\s*\}\)/)
  assert.match(source, /templates\.value\s*=\s*templates\.value\.filter\(\(?entry\)?\s*=>\s*entry\.id\s*!==\s*template\.id\)/)
  assert.match(source, /class="templates-delete-confirm"/)
  assert.match(source, /确认删除这个模板/)
  assert.match(source, /\.templates-delete-confirm__submit\s*\{[\s\S]*background:[\s\S]*var\(--color-danger\)/)
  assert.match(source, /\.templates-delete-confirm__submit\s*\{[\s\S]*color:\s*#fff\s*!important/)
  assert.match(source, /<Trash2\s*v-else\s*class="h-4\s*w-4"\s*\/>/)
  assert.match(source, />\s*确认删除\s*</)
  assert.doesNotMatch(source, /confirm\(/)
})

test('template management page blocks template creation until there is a video profile', () => {
  assert.match(source, /v-if="currentAnalysisSnapshot"/)
  assert.match(source, /v-else\s*class="templates-empty"/)
  assert.match(source, /当前分析不是视频模板/)
  assert.match(source, /完整投篮视频/)
  assert.match(source, /goToUpload/)
})
