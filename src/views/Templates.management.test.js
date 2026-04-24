import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Templates.vue', import.meta.url), 'utf8')

test('template management page loads existing templates from the database commands', () => {
  assert.match(source, /invoke<PlayerTemplate\[]>\('get_player_templates_db'\)/)
  assert.match(source, /templates\.value = \[\.\.\.response\]\.sort/)
})

test('template management page only saves video analysis as a reusable player template', () => {
  assert.match(source, /const currentAnalysis = computed\(\(\) => analysisStore\.currentAnalysis\)/)
  assert.match(source, /const currentVideoAnalysis = computed\(\(\) => analysisStore\.currentVideoAnalysis\)/)
  assert.match(source, /const currentVideoTemplateProfile = computed\(\(\) => currentVideoAnalysis\.value\?\.templateProfile \?\? null\)/)
  assert.match(source, /currentVideoTemplateProfile\.value/)
  assert.match(source, /请先上传并分析一段球星投篮视频/)
  assert.match(source, /poseData: currentAnalysis\.value\.poseData/)
  assert.match(source, /angles: currentAnalysis\.value\.angles/)
  assert.match(source, /const templateProfile = currentVideoTemplateProfile\.value/)
  assert.match(source, /templateProfile: templateProfile/)
  assert.doesNotMatch(source, /templateProfile: currentVideoAnalysis\.value\?\.templateProfile \?\? null/)
  assert.match(source, /invoke<number>\('add_player_template', \{ template \}\)/)
})

test('template management page edits template metadata without replacing pose data', () => {
  assert.match(source, /const editingTemplateId = ref<number \| null>\(null\)/)
  assert.match(source, /const editForm = reactive\(/)
  assert.match(source, /startEditingTemplate\(template\)/)
  assert.match(source, /const payload = \{/)
  assert.match(source, /await invoke<void>\('update_player_template_metadata', \{ template: payload \}\)/)
  assert.match(source, /id: currentTemplate\.id|id: editingTemplateId\.value/)
  assert.match(source, /name: editForm\.name\.trim\(\)/)
  assert.match(source, /team: editForm\.team\.trim\(\)/)
  assert.match(source, /description: editForm\.description\.trim\(\)/)
  assert.doesNotMatch(source, /const payload = \{[\s\S]*poseData:/)
  assert.doesNotMatch(source, /const payload = \{[\s\S]*angles:/)
  assert.match(source, /@submit\.prevent="void saveTemplateEdits\(\)"/)
})

test('template management page uses inline confirmation before deleting templates', () => {
  assert.match(source, /const deletingTemplateId = ref<number \| null>\(null\)/)
  assert.match(source, /const pendingDeleteTemplateId = ref<number \| null>\(null\)/)
  assert.match(source, /const deleteError = ref\(''\)/)
  assert.match(source, /const requestDeleteTemplate = \(template: PlayerTemplate\) =>/)
  assert.match(source, /pendingDeleteTemplateId\.value = template\.id/)
  assert.match(source, /const confirmDeleteTemplate = async \(template: PlayerTemplate\) =>/)
  assert.match(source, /await invoke<void>\('delete_player_template', \{ id: template\.id \}\)/)
  assert.match(source, /templates\.value = templates\.value\.filter\(entry => entry\.id !== template\.id\)/)
  assert.match(source, /class="templates-delete-confirm"/)
  assert.match(source, /确认删除这个模板/)
  assert.match(source, /\.templates-delete-confirm__submit \{[\s\S]*background:[\s\S]*var\(--color-danger\)/)
  assert.match(source, /\.templates-delete-confirm__submit \{[\s\S]*color: #fff !important/)
  assert.match(source, /<Trash2 v-else class="h-4 w-4" \/>/)
  assert.match(source, />\s*确认删除\s*</)
  assert.doesNotMatch(source, /confirm\(/)
})

test('template management page blocks template creation until there is a video profile', () => {
  assert.match(source, /v-if="currentAnalysisSnapshot"/)
  assert.match(source, /v-else class="templates-empty"/)
  assert.match(source, /当前分析不是视频模板/)
  assert.match(source, /完整投篮视频/)
  assert.match(source, /goToUpload/)
})
