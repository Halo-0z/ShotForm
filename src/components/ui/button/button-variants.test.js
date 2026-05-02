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

test('button outline variant remains a quiet structural control', () => {
  assert.match(source, /outline:\s*"[^"\r\n]*var\(--surface-border\)[^"\r\n]*"/)
  assert.match(source, /outline:\s*"[^"\r\n]*var\(--card-bg\)[^"\r\n]*"/)
  assert.match(source, /outline:\s*"[^"\r\n]*var\(--glass-sm\)[^"\r\n]*"/)
  assert.match(source, /outline:\s*"[^"\r\n]*var\(--border-color\)[^"\r\n]*"/)
  assert.doesNotMatch(source, /outline:\s*"[^"\r\n]*var\(--accent-color\)[^"\r\n]*"/)
  assert.doesNotMatch(source, /outline:\s*"[^"\r\n]*var\(--primary-color\)[^"\r\n]*"/)
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

test('global button reset stays in the base layer and does not remove focus outlines', () => {
  assert.match(cssSource, /@layer base\s*\{[\s\S]*button\s*\{[\s\S]*background:\s*transparent/)
  assert.doesNotMatch(cssSource, /button\s*\{[\s\S]*outline:\s*none[\s\S]*\}/)
})

test('shared button surface uses explicit premium interaction states', () => {
  assert.match(source, /button-surface/)
  assert.doesNotMatch(source, /transition-all/)

  const buttonSurfaceBlock = getCssRuleBlock('button-surface')
  assert.match(buttonSurfaceBlock, /transition:\s*color/)
  assert.match(buttonSurfaceBlock, /background-color/)
  assert.match(buttonSurfaceBlock, /box-shadow/)
  assert.match(buttonSurfaceBlock, /transform/)

  assert.match(cssSource, /\.button-surface:hover:not\(:disabled\)/)
  assert.match(cssSource, /\.button-surface:active:not\(:disabled\)/)
  assert.match(cssSource, /\.button-surface:focus-visible/)
})
