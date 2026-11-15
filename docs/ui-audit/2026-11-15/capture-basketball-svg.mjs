// Rebuild verification only: synthetic data never reaches the native database or AI services.
// Run from repository root: node docs/ui-audit/2026-11-15/capture-basketball-svg.mjs
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const { chromium, expect } = require('@playwright/test')
const out = fileURLToPath(new URL('./basketball-svg/after/', import.meta.url))
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const page = await context.newPage()
const observations = []
const shot = async (name) => {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    await Promise.allSettled([...document.images].filter(img => img.getBoundingClientRect().width > 0).map(img => img.decode()))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await page.screenshot({ path: `${out}/${name}.png` })
  observations.push({ name, viewport: page.viewportSize(), ...await page.evaluate(() => ({
    theme: document.documentElement.className,
    text: document.body.innerText,
    overflow: [...document.querySelectorAll('main,section,header,aside,[class*=workbench],[class*=page]')].filter(e => e.clientWidth && e.scrollWidth > e.clientWidth + 4).map(e => ({ className: e.className, client: e.clientWidth, scroll: e.scrollWidth })),
  })) })
}
const goto = async (path, target) => {
  await page.goto(`http://127.0.0.1:1420${path}`)
  await expect(page.locator(target).first()).toBeVisible()
}
for (const theme of ['light', 'dark']) {
  await context.addInitScript(t => localStorage.setItem('theme-preference', t), theme)
  for (const [name, path, target] of [
    ['home', '/', 'h1'], ['upload', '/upload', '.upload-page'],
    ['analysis-empty', '/analysis', 'h1'], ['history', '/history', '.history-page'],
    ['compare-ready', '/compare?comparePreview=ready', '[data-compare-detail-player]'],
    ['compare-error', '/compare?comparePreview=error', '[data-compare-error]'],
    ['compare-empty', '/compare?comparePreview=empty', '[data-compare-empty]'],
    ['compare-loading', '/compare?comparePreview=loading', '[data-compare-progress]'],
    ['templates', '/templates', 'h1'],
  ]) {
    await goto(path, target)
    if (name === 'home') await page.locator('.carousel__slide--active img').evaluate(img => img.decode())
    await shot(`${theme}-${name}`)
    if (name === 'compare-ready') {
      await page.getByText('查看角度雷达图', { exact: true }).click()
      await page.locator('.comparison-radar').scrollIntoViewIfNeeded()
      await shot(`${theme}-compare-radar`)
    }
  }
  await goto('/analysis', 'h1')
  await page.evaluate(async () => {
    const { useAnalysisStore } = await import('/src/stores/analysis.ts')
    const store = useAnalysisStore()
    const image = '/hero/kobe-shot.png'
    const analysis = { timestamp: 1794700800000, poseData: { keypoints: [], width: 498, height: 1541 }, angles: [
      { name: 'right_elbow_angle', value: 91, normalRange: [80, 110], confidence: 0.91, status: 'normal' },
      { name: 'left_knee_angle', value: 132, normalRange: [140, 170], confidence: 0.85, status: 'abnormal' },
      { name: 'right_knee_angle', value: 151, normalRange: [140, 170], confidence: 0.2, status: 'low_confidence' },
    ], shotType: 'one_motion', shotTypeConfidence: 0.71, shotTypeReasons: ['UI 审计夹具，不代表实测结果'], aiReview: null }
    window.__uiRows = [1, 2].map(id => ({ id, createdAt: 1794700800000 + id * 1000, trainingDate: '2026-11-15', notes: id === 1 ? '定点投篮，检查肘部与膝部的配合' : '第二组训练', tags: ['定点'], imagePath: image, annotatedImagePath: image, analysis: structuredClone(analysis), comparison: null, suggestions: [] }))
    window.__TAURI_INTERNALS__ = { invoke: async command => {
      if (command === 'query_training_history') return window.__uiRows
      if (command === 'get_correction_suggestions') return []
      throw new Error(`UI audit blocked command: ${command}`)
    } }
    store.setCurrentAnalysis(analysis)
    store.currentImage = image
    store.currentAnnotatedImage = image
    store.coachingSources.rule.state = 'done'
  })
  await expect(page.getByAltText('图片姿态分析')).toBeVisible()
  await shot(`${theme}-analysis-fixture`)
  const images = await Promise.all([1,2,3,4,5].map(async i => `data:image/jpeg;base64,${(await readFile(new URL(`./explore/assets/frame-${i}.jpg`, import.meta.url))).toString('base64')}`))
  await page.evaluate(async images => {
    const { useAnalysisStore } = await import('/src/stores/analysis.ts')
    const store = useAnalysisStore()
    const analysis = JSON.parse(JSON.stringify(store.currentAnalysis))
    analysis.poseData = { width: 592, height: 900, keypoints: [] }
    store.currentVideoAnalysis = { videoPath: 'layout-fixture.mp4', bestFrameIndex: 2, overallShotType: 'one_motion', overallShotTypeConfidence: .71, overallReasons: ['请结合清晰的完整动作片段复核分型。'], frames: images.map((imageData, i) => ({ index: i, timestampMs: 250 + i * 500, imageData, annotatedImageData: imageData, analysis })) }
    await store.selectVideoFrame(2)
  }, images)
  await expect(page.locator('canvas')).toBeVisible()
  await shot(`${theme}-analysis-video`)
  await page.getByRole('button', { name: '数据表', exact: true }).click()
  await shot(`${theme}-analysis-table`)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.evaluate(async () => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))))
  await shot(`${theme}-settings`)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: '训练历史', exact: true }).click()
  await expect(page.getByRole('button', { name: '编辑训练' })).toHaveCount(2)
  await shot(`${theme}-history-fixture`)
  await page.getByRole('button', { name: '编辑训练' }).first().click()
  await expect(page.getByLabel('训练备注', { exact: true })).toBeVisible()
  await page.getByLabel('训练备注', { exact: true }).scrollIntoViewIfNeeded()
  await shot(`${theme}-history-editor`)
  await page.getByLabel('选择记录 1 对比').check()
  await page.getByLabel('选择记录 2 对比').check()
  await page.getByRole('region', { name: '两次训练对比' }).scrollIntoViewIfNeeded()
  await shot(`${theme}-training-comparison`)
  await goto('/upload', '.upload-page')
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/upload-sample.mp4')
  await expect(page.getByLabel('开始时间')).toBeVisible()
  await expect.poll(() => page.locator('.video-trim-filmstrip__canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data
    const colors = new Set(); for (let i=0;i<pixels.length;i+=40) colors.add(pixels.slice(i,i+3).join(','))
    return colors.size
  })).toBeGreaterThan(100)
  await shot(`${theme}-upload-video`)
}
await page.setViewportSize({ width: 960, height: 640 })
for (const [name, route, target] of [['home', '/', 'h1'], ['upload', '/upload', '.upload-page'], ['compare', '/compare?comparePreview=ready', '[data-compare-detail-player]']]) {
  await goto(route, target)
  await shot(`narrow-${name}`)
}
// CSS zoom reflow at the desktop viewport; not merely a high-DPI screenshot.
await page.setViewportSize({ width: 1440, height: 900 })
await goto('/upload', '.upload-page')
await page.evaluate(() => { document.documentElement.style.zoom = '2' })
await shot('zoom200-upload')
await page.evaluate(() => { document.documentElement.style.zoom = '' })
await page.setViewportSize({ width: 720, height: 450 })
await goto('/upload', '.upload-page')
await shot('reflow200-upload')
await page.setViewportSize({ width: 1440, height: 900 })
await page.locator('input[type=file]').setInputFiles('tests/fixtures/upload-sample.mp4')
await expect(page.getByLabel('开始时间')).toBeVisible()
await shot('dark-upload-video-initial')
await page.locator('input[type=file]').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') })
await expect(page.getByText('不支持此文件格式')).toBeVisible()
await shot('dark-upload-error')
await page.setViewportSize({ width: 376, height: 380 })
for (const theme of ['light', 'dark']) {
  await context.addInitScript(t => localStorage.setItem('theme-preference', t), theme)
  await goto('/tray-menu', '.tray-menu-panel')
  await shot(`${theme}-tray`)
}
await writeFile(`${out}/observations.json`, JSON.stringify(observations, null, 2))
await browser.close()
console.log(`Captured ${observations.length} states.`)
