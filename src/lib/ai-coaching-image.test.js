import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAiImageSource } from './ai-coaching-image.js'

test('resolveAiImageSource returns data urls unchanged', async () => {
  const dataUrl = 'data:image/png;base64,abc123'
  const result = await resolveAiImageSource(dataUrl, async () => {
    throw new Error('reader should not run for data urls')
  })

  assert.equal(result, dataUrl)
})

test('resolveAiImageSource converts file paths into image data urls', async () => {
  const bytes = Uint8Array.from([72, 73])
  const result = await resolveAiImageSource('C:/tmp/frame.png', async path => {
    assert.equal(path, 'C:/tmp/frame.png')
    return bytes
  })

  assert.match(result, /^data:image\/png;base64,/)
})
