import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'

async function installComparisonFixture(page: Page) {
  await page.evaluate(async () => {
    const { configureComparisonStoreService } = await import('/src/stores/comparison.ts')
    const { buildComparisonPreviewSnapshot } = await import('/src/lib/comparison-preview.ts')
    const { invoke } = await import('/node_modules/.vite/deps/@tauri-apps_api_core.js')
    const w = window as any
    w.__p2Builds = 0
    w.__TAURI_INTERNALS__ = { invoke: async (command: string, args: any) => {
      if (command === 'build_compare_workbench') {
        w.__p2Builds++
        const snapshot = buildComparisonPreviewSnapshot(args.identity.analysisKey)
        if (localStorage.getItem('p2-deleted')) {
          snapshot.summaries = snapshot.summaries.filter(s => s.player.id !== 34)
          delete snapshot.detailsByPlayerId[34]
        }
        return snapshot
      }
      if (command === 'save_analysis_history') {
        localStorage.setItem('p2-history', JSON.stringify({ ...args, id: 72, createdAt: Date.now(), trainingDate: '2026-11-15' }))
        return 72
      }
      if (command === 'update_analysis_history_comparison') {
        const row = JSON.parse(localStorage.getItem('p2-history')!)
        row.comparison = args.comparison
        localStorage.setItem('p2-history', JSON.stringify(row))
      }
      if (command === 'delete_player_template') localStorage.setItem('p2-deleted', String(args.id))
      if (command === 'get_correction_suggestions') return []
      if (command === 'query_training_history') return [JSON.parse(localStorage.getItem('p2-history')!)]
      if (/hunyuan|ai_correction/i.test(command)) throw new Error('Paid API prohibited')
      return null
    } }
    configureComparisonStoreService(() => ({
      listenToProgress: async () => () => {},
      buildWorkbench: args => invoke('build_compare_workbench', args),
    }))
  })
}

test('compare, select, save, reopen and retain deleted template until explicit refresh', async ({ page }) => {
  await page.goto('/analysis')
  await installComparisonFixture(page)
  await page.evaluate(async () => {
    const { useAnalysisStore } = await import('/src/stores/analysis.ts')
    const { default: router } = await import('/src/router/index.ts')
    useAnalysisStore().setCurrentAnalysis({ timestamp: 123, poseData: { keypoints: [], width: 1, height: 1 }, angles: [], shotType: 'one_motion', shotTypeConfidence: 1, shotTypeReasons: [], aiReview: null })
    await router.push('/compare')
  })
  await expect(page.locator('[data-compare-detail-player]')).toContainText('Curry')
  await page.getByRole('button', { name: /Thompson/ }).click()
  await expect(page.locator('[data-compare-detail-player]')).toContainText('Thompson')
  await page.getByRole('button', { name: '返回分析结果' }).click()
  await page.getByRole('button', { name: '保存历史记录', exact: true }).click()
  await expect(page.getByRole('button', { name: '已保存历史记录' })).toBeDisabled()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('p2-history')!).comparison)
  expect(saved.selectedPlayerId).toBe(34)
  expect(saved.selectedDetail.result.player.name).toBe('Thompson')
  expect(saved.summaries).toHaveLength(2)
  expect(Object.keys(saved.detailsByPlayerId)).toHaveLength(2)

  await page.reload() // New Pinia stores: no in-memory ready cache survives.
  await installComparisonFixture(page)
  await page.evaluate(async () => {
    const { invoke } = await import('/node_modules/.vite/deps/@tauri-apps_api_core.js')
    const { default: router } = await import('/src/router/index.ts')
    await invoke('delete_player_template', { id: 34 }) // Simulated backend template deletion.
    await router.push('/history')
  })
  await page.getByRole('button', { name: '查看分析' }).click()
  await page.evaluate(async () => {
    const { default: router } = await import('/src/router/index.ts')
    await router.push('/compare')
  })
  await expect(page.locator('[data-compare-detail-player]')).toContainText('Thompson')
  expect(await page.evaluate(() => (window as any).__p2Builds)).toBe(0)
  await page.getByRole('button', { name: /刷新对比，重新读取最新模板/ }).click()
  await expect(page.locator('[data-compare-detail-player]')).toContainText('Curry')
  await expect(page.getByRole('button', { name: /Thompson/ })).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__p2Builds)).toBe(1)
})

test('history labels and database filtering use overall video type, preserve images and pages', async ({ page }) => {
  await page.goto('/analysis')
  const rows = Array.from({ length: 24 }, (_, index) => {
    const analysis = { timestamp: 1000 + index, poseData: { keypoints: [], width: 1, height: 1 }, angles: [], shotType: 'one_motion', shotTypeConfidence: 1, shotTypeReasons: [] }
    return { id: index + 1, analysis, imagePath: '', annotatedImagePath: '', suggestions: [], comparison: null,
      sourceIdentifier: `fixture:${index}`, createdAt: 1000 + index, trainingDate: '2026-11-15', notes: index === 23 ? 'IMAGE_FIXTURE' : 'VIDEO_FIXTURE', tags: [],
      videoAnalysis: index === 23 ? null : { overallShotType: 'two_motion', videoPath: 'fixture.mp4', frames: [{ analysis, imageData: '', annotatedImageData: '' }], bestFrameIndex: 0 },
    }
  })
  await page.exposeFunction('__p2QuerySQL', (args: any) => {
    // Execute SQL extracted from the production repository, not a JS filter imitation.
    const python = `import json,runpy,sys\nm=runpy.run_path('tests/test_database_sql.py')\nt=m['DatabaseSQLTests'](); t.setUp()\np=json.loads(sys.argv[1])\nfor r in p['rows']:\n t.db.execute(m['INSERT'], ('','',json.dumps(r['analysis']),None,'[]',None,None,r['sourceIdentifier'],json.dumps(r['videoAnalysis']) if r['videoAnalysis'] else None,r['createdAt']))\na=p['args']; s=a.get('shotType'); s=s.replace('_','').lower() if s else None\nq=t.db.execute(m['QUERY'],(None,None,None,None,None,None,s,s,a['limit'],a['offset'])).fetchall()\nprint(json.dumps([r['id'] for r in q]))`
    const ids: number[] = JSON.parse(execFileSync('.venv/Scripts/python.exe', ['-c', python, JSON.stringify({ rows, args })], { encoding: 'utf8' }))
    return ids.map(id => rows[id - 1])
  })
  await page.evaluate(async () => {
    const w = window as any
    w.__TAURI_INTERNALS__ = { invoke: async (command: string, args: any) => command === 'query_training_history' ? w.__p2QuerySQL(args) : null }
    const { default: router } = await import('/src/router/index.ts')
    await router.push('/history')
  })
  await expect(page.locator('.history-session-row')).toHaveCount(20)
  await expect(page.locator('.history-session-row').filter({ hasText: 'IMAGE_FIXTURE' })).toContainText('一段式投篮')
  await expect(page.locator('.history-session-row').filter({ hasText: 'VIDEO_FIXTURE' }).first()).toContainText('二段式投篮')
  await page.getByRole('combobox', { name: '分型', exact: true }).selectOption('two_motion')
  await page.getByRole('button', { name: '筛选', exact: true }).click()
  await expect(page.locator('.history-session-row')).toHaveCount(20)
  await expect(page.locator('.history-session-row').filter({ hasText: 'IMAGE_FIXTURE' })).toHaveCount(0)
  await page.getByRole('button', { name: '加载更多记录' }).click()
  await expect(page.locator('.history-session-row')).toHaveCount(23)
  await page.getByRole('combobox', { name: '分型', exact: true }).selectOption('one_motion')
  await page.getByRole('button', { name: '筛选', exact: true }).click()
  await expect(page.locator('.history-session-row')).toHaveCount(1)
  await expect(page.locator('.history-session-row')).toContainText('IMAGE_FIXTURE')
  const report = await page.evaluate(async row => {
    const { buildAnalysisReport } = await import('/src/lib/training-report.ts')
    return buildAnalysisReport(row as any)
  }, rows[0])
  expect(report).toContain('投篮类型：二段式投篮')
})
