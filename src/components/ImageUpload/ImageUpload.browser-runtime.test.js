import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let viteServer

before(async () => {
  viteServer = await createServer({
    configFile: fileURLToPath(new URL('../../../vite.config.ts', import.meta.url)),
    server: {
      middlewareMode: true,
      hmr: { port: 24679 }
    }
  })
})

after(async () => {
  await viteServer?.close()
})

const loadComponentModule = async () => viteServer.ssrLoadModule('/src/components/ImageUpload/index.vue')

test('ImageUpload routes crop requests to the browser fallback when Tauri runtime is unavailable', async () => {
  const { applyCropOperation } = await loadComponentModule()
  const crop = { x: 12, y: 18, width: 160, height: 220 }
  const calls = []

  const result = await applyCropOperation({
    imageData: 'data:image/png;base64,original',
    crop,
    hasNativeRuntime: false,
    processNativeCrop: async () => {
      calls.push('native')
      return { image_data: 'data:image/png;base64,native', width: 1, height: 1 }
    },
    processBrowserCrop: async (imageData, nextCrop) => {
      calls.push({ imageData, crop: nextCrop })
      return { image_data: 'data:image/png;base64,browser', width: 160, height: 220 }
    }
  })

  assert.deepEqual(calls, [{
    imageData: 'data:image/png;base64,original',
    crop
  }])
  assert.equal(result.image_data, 'data:image/png;base64,browser')
  assert.equal(result.width, 160)
  assert.equal(result.height, 220)
})

test('ImageUpload browser crop fallback draws the selected source area onto a same-sized canvas', async () => {
  const { cropImageInBrowser } = await loadComponentModule()
  const crop = { x: 24, y: 36, width: 180, height: 120 }
  const drawCalls = []
  const fakeImage = {}
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (...args) => drawCalls.push(args)
    }),
    toDataURL: (type) => `data:${type};base64,cropped`
  }

  Object.defineProperty(fakeImage, 'src', {
    set() {
      queueMicrotask(() => fakeImage.onload?.())
    }
  })

  const result = await cropImageInBrowser('data:image/jpeg;base64,original', crop, {
    createImage: () => fakeImage,
    createCanvas: () => fakeCanvas
  })

  assert.equal(fakeCanvas.width, 180)
  assert.equal(fakeCanvas.height, 120)
  assert.deepEqual(drawCalls, [[fakeImage, 24, 36, 180, 120, 0, 0, 180, 120]])
  assert.equal(result.image_data, 'data:image/jpeg;base64,cropped')
  assert.equal(result.width, 180)
  assert.equal(result.height, 120)
})

test('ImageUpload exposes a desktop-only analysis CTA state when browser preview mode is active', async () => {
  const { getImageAnalysisCtaState } = await loadComponentModule()

  assert.deepEqual(
    getImageAnalysisCtaState({
      hasImageSelection: true,
      isBusy: false,
      desktopAnalysisAvailable: false
    }),
    {
      disabled: true,
      label: '\u8bf7\u5728\u684c\u9762\u7aef\u5f00\u59cb\u5206\u6790'
    }
  )

  assert.deepEqual(
    getImageAnalysisCtaState({
      hasImageSelection: true,
      isBusy: false,
      desktopAnalysisAvailable: true
    }),
    {
      disabled: false,
      label: '开始分析'
    }
  )
})
