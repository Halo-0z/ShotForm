export function getHeroFigureScale(currentMetrics, baselineMetrics, layoutFrame = null) {
  if (!currentMetrics || !baselineMetrics) return 1

  const currentWidth = currentMetrics.width
  const currentHeight = currentMetrics.height
  const baselineWidth = baselineMetrics.width
  const baselineHeight = baselineMetrics.height

  if (currentWidth <= 0 || currentHeight <= 0 || baselineWidth <= 0 || baselineHeight <= 0) {
    return 1
  }

  const currentAspect = currentHeight / currentWidth
  const baselineAspect = baselineHeight / baselineWidth

  if (!Number.isFinite(currentAspect) || !Number.isFinite(baselineAspect) || currentAspect <= 0) {
    return 1
  }

  const shellWidth = layoutFrame?.shellWidth ?? 0
  const availableHeight = layoutFrame?.availableHeight ?? 0

  if (shellWidth > 0 && availableHeight > 0) {
    const baselineRenderedHeight = Math.min(shellWidth * baselineAspect, availableHeight)
    const currentRenderedHeight = Math.min(shellWidth * currentAspect, availableHeight)

    if (baselineRenderedHeight > 0 && currentRenderedHeight > 0) {
      return baselineRenderedHeight / currentRenderedHeight
    }
  }

  return baselineAspect / currentAspect
}
