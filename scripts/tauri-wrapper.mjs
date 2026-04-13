import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function spawnChild(command, args, options = {}) {
  return spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    windowsHide: false,
    shell: process.platform === 'win32',
    ...options
  })
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(false))
    server.listen({ host: '127.0.0.1', port }, () => {
      server.close(() => resolve(true))
    })
  })
}

async function findFreePort(start = 1420, end = 1490) {
  for (let port = start; port <= end; port += 1) {
    if (await isPortFree(port)) {
      return port
    }
  }

  throw new Error(`No free port found in range ${start}-${end}`)
}

function waitForPort(port, child, timeoutMs = 30000) {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (child.exitCode !== null) {
        reject(new Error(`Vite dev server exited before port ${port} became ready.`))
        return
      }

      const free = await isPortFree(port)
      if (!free) {
        resolve()
        return
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for Vite dev server on port ${port}.`))
        return
      }

      setTimeout(poll, 250)
    }

    poll().catch(reject)
  })
}

function killChild(child) {
  if (!child || child.exitCode !== null) {
    return
  }

  if (process.platform === 'win32') {
    spawn(process.env.comspec || 'cmd.exe', ['/c', 'taskkill', '/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true
    })
    return
  }

  child.kill('SIGTERM')
}

async function runAutoDev(extraArgs) {
  const port = await findFreePort()
  console.log(`[tauri-wrapper] Using dev port ${port}`)

  const vite = spawnChild(npmCmd, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'])

  const cleanup = () => killChild(vite)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', cleanup)

  try {
    await waitForPort(port, vite)
  } catch (error) {
    cleanup()
    throw error
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'tauri-dev-'))
  const overrideConfigPath = path.join(tempDir, 'tauri.dev.override.json')
  writeFileSync(overrideConfigPath, JSON.stringify({
    build: {
      beforeDevCommand: '',
      devUrl: `http://127.0.0.1:${port}`
    }
  }))

  const tauri = spawnChild(npxCmd, ['tauri', 'dev', '--config', overrideConfigPath, ...extraArgs])

  const exitCode = await new Promise((resolve, reject) => {
    tauri.on('error', reject)
    tauri.on('exit', (code) => resolve(code ?? 1))
  })

  cleanup()
  rmSync(tempDir, { recursive: true, force: true })
  process.off('SIGINT', cleanup)
  process.off('SIGTERM', cleanup)
  process.off('exit', cleanup)
  process.exit(exitCode)
}

async function main() {
  const args = process.argv.slice(2)

  if (args[0] !== 'dev') {
    const passthrough = spawnChild(npxCmd, ['tauri', ...args])
    passthrough.on('exit', (code) => process.exit(code ?? 1))
    passthrough.on('error', () => process.exit(1))
    return
  }

  await runAutoDev(args.slice(1))
}

main().catch((error) => {
  console.error('[tauri-wrapper]', error instanceof Error ? error.message : error)
  process.exit(1)
})
