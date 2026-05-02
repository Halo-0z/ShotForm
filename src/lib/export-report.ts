import type { ShotAnalysis, VideoShotAnalysis, ComparisonWorkbenchSnapshot } from '@/types'
import { getShotTypeName, getAngleDisplayName } from '@/types'
import { hasTauriRuntime } from '@/lib/tauri-runtime'

interface ExportData {
  exportedAt: number
  shotType: string
  shotTypeConfidence: number
  angles: Array<{
    name: string
    displayName: string
    value: number
    normalRange: [number, number]
    status: string
    confidence: number
  }>
  comparison?: {
    topMatches: Array<{
      playerName: string
      similarity: number
      topDifferences: Array<{
        name: string
        displayName: string
        userValue: number
        playerValue: number
        difference: number
      }>
    }>
  }
  videoAnalysis?: {
    totalFrames: number
    framesAnalyzed: number
    durationMs: number
    trimStartMs: number
    trimEndMs: number
  }
}

const buildExportData = (
  analysis: ShotAnalysis,
  comparison?: ComparisonWorkbenchSnapshot | null,
  videoAnalysis?: VideoShotAnalysis | null,
): ExportData => {
  const data: ExportData = {
    exportedAt: Date.now(),
    shotType: getShotTypeName(analysis.shotType),
    shotTypeConfidence: analysis.shotTypeConfidence,
    angles: analysis.angles.map(a => ({
      name: a.name,
      displayName: getAngleDisplayName(a.name),
      value: a.value,
      normalRange: a.normalRange,
      status: a.status,
      confidence: a.confidence,
    })),
  }

  if (comparison?.summaries?.length) {
    data.comparison = {
      topMatches: comparison.summaries.slice(0, 5).map(s => ({
        playerName: s.player.name,
        similarity: s.similarity,
        topDifferences: s.topDifferences.slice(0, 5).map(d => ({
          name: d.name,
          displayName: getAngleDisplayName(d.name),
          userValue: d.userValue,
          playerValue: d.playerValue,
          difference: d.difference,
        })),
      })),
    }
  }

  if (videoAnalysis) {
    data.videoAnalysis = {
      totalFrames: videoAnalysis.totalFrames,
      framesAnalyzed: videoAnalysis.framesAnalyzed,
      durationMs: videoAnalysis.durationMs,
      trimStartMs: videoAnalysis.trimStartMs,
      trimEndMs: videoAnalysis.trimEndMs,
    }
  }

  return data
}

export async function exportAnalysisJSON(
  analysis: ShotAnalysis,
  comparison?: ComparisonWorkbenchSnapshot | null,
  videoAnalysis?: VideoShotAnalysis | null,
): Promise<boolean> {
  const data = buildExportData(analysis, comparison, videoAnalysis)
  const json = JSON.stringify(data, null, 2)
  const defaultName = getReportFileName() + '.json'

  if (hasTauriRuntime()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: defaultName,
      })
      if (!filePath) return false

      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(filePath, json)
      return true
    } catch {
      return false
    }
  }

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

export async function exportAnalysisReportImage(): Promise<string | null> {
  return null
}

export function getReportFileName(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `投篮分析报告_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
}
