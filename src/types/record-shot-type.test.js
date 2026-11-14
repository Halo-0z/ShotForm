import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText
const { getRecordShotType } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('record classification prefers the entire video and normalizes historical spellings', () => {
  for (const overallShotType of ['two_motion', 'twoMotion', 'TwoMotion']) {
    assert.equal(getRecordShotType({ analysis: { shotType: 'one_motion' }, videoAnalysis: { overallShotType } }), 'two_motion')
  }
})

test('images and missing legacy video classifications fall back, explicit unknown does not', () => {
  for (const videoAnalysis of [undefined, null, {}, { overallShotType: null }, { overallShotType: '' }]) {
    assert.equal(getRecordShotType({ analysis: { shotType: 'oneMotion' }, videoAnalysis }), 'one_motion')
  }
  for (const overallShotType of ['unknown', 'Unknown', 'unsupported']) {
    assert.equal(getRecordShotType({ analysis: { shotType: 'one_motion' }, videoAnalysis: { overallShotType } }), 'unknown')
  }
  assert.equal(getRecordShotType({}), 'unknown')
})
