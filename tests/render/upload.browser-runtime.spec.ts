import { expect, test } from '@playwright/test'
import path from 'node:path'

test('video preview and trim work while analysis is visibly desktop-only', async ({ page }) => {
  await page.goto('/upload')
  await expect(page.locator('[data-browser-preview-note]')).toContainText('桌面端')
  await page.locator('input[type="file"]').setInputFiles(path.resolve('tests/fixtures/upload-sample.mp4'))
  await expect(page.locator('video').first()).toBeVisible()
  await expect(page.getByLabel('开始时间')).toBeVisible()
  await expect(page.getByLabel('结束时间')).toBeVisible()
  await page.getByLabel('开始时间').fill('300')
  await expect(page.locator('[data-analysis-cta="video"]')).toBeDisabled()
  await expect(page.locator('[data-analysis-cta="video"]')).toContainText('桌面端')
})

test('image mode exposes preview and switching modes clears the previous media', async ({ page }) => {
  await page.goto('/upload')
  await page.getByRole('button', { name: '图片分析', exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles(path.resolve('public/hero/kobe-shot.png'))
  await expect(page.getByAltText('预览图')).toBeVisible()
  await expect(page.locator('[data-analysis-cta="image"]')).toBeDisabled()
  await expect(page.getByLabel('开始时间')).toHaveCount(0)
  await page.getByRole('button', { name: '视频分析', exact: true }).click()
  await expect(page.getByAltText('预览图')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '选择视频', exact: true })).toBeVisible()
})

test('unsupported and empty files produce readable errors without starting analysis', async ({ page }) => {
  await page.goto('/upload')
  await page.locator('input[type="file"]').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not video') })
  await expect(page.getByText('不支持此文件格式')).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles({ name: 'empty.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(0) })
  await expect(page.getByText('文件为空，请重新选择')).toBeVisible()
  await expect(page.locator('[data-analysis-cta]')).toHaveCount(0)
})
