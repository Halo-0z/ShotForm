import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('../../../assets/index.css', import.meta.url), 'utf8')

function getCssRuleBlock(className) {
  return cssSource.match(new RegExp(`\\.${className}\\s*\\{[\\s\\S]*?\\}`))?.[0] ?? ''
}

test('button variants expose dedicated semantics for segmented selection and upload CTA states', () => {
  assert.match(source, /"segmented-active":/)
  assert.match(source, /"upload-cta":/)
})

test('button default and secondary variants stay in neutral workbench language', () => {
  assert.match(source, /default:\s*"button-variant-default"/)
  assert.match(source, /secondary:\s*"[^"\r\n]*var\(--glass-[a-z]+\)[^"\r\n]*"/)
  assert.doesNotMatch(source, /secondary:\s*"[^"\r\n]*var\(--accent-color\)[^"\r\n]*"/)

  const defaultBlock = getCssRuleBlock('button-variant-default')
  assert.match(defaultBlock, /var\(--primary-color\)/)
  assert.match(defaultBlock, /var\(--primary-hover\)/)
  assert.doesNotMatch(defaultBlock, /var\(--accent-color\)/)
  assert.doesNotMatch(defaultBlock, /var\(--accent-hover\)/)
})

test('segmented active variant is a distinct selected-tool state that uses interaction color', () => {
  assert.match(source, /"segmented-active":\s*"button-variant-segmented-active"/)

  const segmentedActiveBlock = getCssRuleBlock('button-variant-segmented-active')
  assert.match(segmentedActiveBlock, /var\(--primary-color\)/)
  assert.doesNotMatch(segmentedActiveBlock, /var\(--accent-color\)/)
  assert.doesNotMatch(segmentedActiveBlock, /var\(--accent-hover\)/)
})

test('evidence-oriented variants do not replace default button language', () => {
  assert.match(source, /defaultVariants:\s*{[\s\S]*variant:\s*"default"/)
  assert.doesNotMatch(source, /defaultVariants:\s*{[\s\S]*variant:\s*"(accent|destructive|upload-cta)"/)
})
