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
      hmr: { port: 24680 }
    }
  })
})

after(async () => {
  await viteServer?.close()
})

const loadComponentModule = async () => viteServer.ssrLoadModule('/src/components/VideoUpload/index.vue')

test('VideoUpload treats browser blob previews as a loaded selection even without a desktop file path', async () => {
  const {
    hasLoadedVideoSelection,
    canConfirmVideoSelection,
    buildVideoLoadedPayload
  } = await loadComponentModule()

  assert.equal(hasLoadedVideoSelection({ previewUrl: 'blob:browser-preview', filePath: '' }), true)
  assert.equal(canConfirmVideoSelection({ previewUrl: 'blob:browser-preview', durationMs: 2400, isBusy: false }), true)
  assert.equal(canConfirmVideoSelection({ previewUrl: '', durationMs: 2400, isBusy: false }), false)
  assert.equal(canConfirmVideoSelection({ previewUrl: 'blob:browser-preview', durationMs: 0, isBusy: false }), false)
  assert.equal(canConfirmVideoSelection({ previewUrl: 'blob:browser-preview', durationMs: 2400, isBusy: true }), false)

  assert.deepEqual(
    buildVideoLoadedPayload({
      filePath: '',
      previewUrl: 'blob:browser-preview',
      trimStartMs: 120,
      trimEndMs: 2040,
      durationMs: 2400
    }),
    {
      filePath: '',
      previewUrl: 'blob:browser-preview',
      trimStartMs: 120,
      trimEndMs: 2040,
      durationMs: 2400
    }
  )
})
