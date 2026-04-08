import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const videoFixturePath = path.resolve(__dirname, '..', 'fixtures', 'upload-sample.mp4')
const imageFixturePath = path.resolve(__dirname, '..', '..', 'public', 'hero', 'luka2-upload.png')

const gotoUpload = async (page: Page) => {
  await page.goto('/upload')
  await expect(page.locator('.upload-page')).toBeVisible()
}

test.describe('upload browser runtime behavior', () => {
  test('browser video selection enters loaded workspace and exposes trim + preview controls', async ({ page }) => {
    await gotoUpload(page)

    const browserVideoInput = page.locator('input[type="file"][accept*="video/mp4"]')
    await expect(browserVideoInput).toHaveCount(1)

    await browserVideoInput.setInputFiles(videoFixturePath)

    const loadedVideo = page.locator('video[controls]')
    await expect(loadedVideo).toBeVisible()
    await expect(loadedVideo).toHaveAttribute('src', /blob:/)

    await expect(page.locator('.clip-range-shell')).toBeVisible()
    await expect(page.locator('input.clip-range-input-start[type="range"]')).toBeVisible()
    await expect(page.locator('input.clip-range-input-end[type="range"]')).toBeVisible()
    await expect(page.locator('.clip-range-filmstrip')).toBeVisible()
    await expect(page.locator('button:has(svg.lucide-play), button:has(svg.lucide-pause)')).toBeVisible()
    await expect(page.locator('button:has(svg.lucide-upload)')).toBeVisible()
  })

  test('browser image crop works via fallback without Tauri-only failure path', async ({ page }) => {
    const dialogs: string[] = []
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message())
      await dialog.dismiss()
    })

    await gotoUpload(page)

    const imageModeButton = page.locator('.upload-workbench__mode-strip button').first()
    await imageModeButton.click()

    const imageInput = page.locator('input[type="file"][accept*="image/jpeg"]')
    await expect(imageInput).toHaveCount(1)
    await imageInput.setInputFiles(imageFixturePath)

    const previewImage = page.locator('img[alt="Preview"]')
    await expect(previewImage).toBeVisible()
    const beforeCropSrc = await previewImage.getAttribute('src')

    const openCropButton = page.locator('button:has(svg.lucide-crop)')
    await openCropButton.click()

    const cropImage = page.locator('img[alt="Crop preview"]')
    await expect(cropImage).toBeVisible()

    const cropBox = await cropImage.boundingBox()
    expect(cropBox).toBeTruthy()

    const startX = cropBox!.x + cropBox!.width * 0.2
    const startY = cropBox!.y + cropBox!.height * 0.2
    const endX = cropBox!.x + cropBox!.width * 0.75
    const endY = cropBox!.y + cropBox!.height * 0.8

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY)
    await page.mouse.up()

    const applyCropButton = page.locator('[role="dialog"] .flex.gap-3 button').last()
    await applyCropButton.click()

    await expect(cropImage).toBeHidden()
    await expect(previewImage).toBeVisible()

    const afterCropSrc = await previewImage.getAttribute('src')
    expect(afterCropSrc).toBeTruthy()
    expect(afterCropSrc).not.toBe(beforeCropSrc)

    expect(dialogs).toEqual([])
  })
})
