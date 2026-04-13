import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const edgeExecutablePath = [
  process.env.PLAYWRIGHT_EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find((candidate) => Boolean(candidate) && existsSync(candidate!))

const launchOptions = edgeExecutablePath
  ? {
      executablePath: edgeExecutablePath
    }
  : undefined

export default defineConfig({
  testDir: './tests/render',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    ...devices['Desktop Edge'],
    baseURL: 'http://127.0.0.1:1420',
    browserName: 'chromium',
    channel: edgeExecutablePath ? undefined : 'msedge',
    launchOptions
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 1420',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60_000
  }
})
