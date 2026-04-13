import { expect, test } from '@playwright/test'

const themeStorageKey = 'theme-preference'

type SurfaceSnapshot = {
  backgroundImage: string
  backgroundColor: string
  borderColor: string
  boxShadow: string
  backdropFilter: string
  webkitBackdropFilter: string
}

type ParsedColor = {
  red: number
  green: number
  blue: number
  alpha: number
}

const parseNumericColor = (value: string): ParsedColor => {
  const oklchMatch = value.match(/oklch\(([\d.]+)\s+[\d.]+\s+[\d.]+(?:\s*\/\s*([\d.]+))?\)/)
  if (oklchMatch) {
    const lightness = Math.max(0, Math.min(1, Number.parseFloat(oklchMatch[1])))
    const alpha = oklchMatch[2] ? Number.parseFloat(oklchMatch[2]) : 1
    const channel = lightness * 255
    return { red: channel, green: channel, blue: channel, alpha }
  }

  const colorSrgbMatch = value.match(/color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\)/)
  if (colorSrgbMatch) {
    return {
      red: Number.parseFloat(colorSrgbMatch[1]) * 255,
      green: Number.parseFloat(colorSrgbMatch[2]) * 255,
      blue: Number.parseFloat(colorSrgbMatch[3]) * 255,
      alpha: colorSrgbMatch[4] ? Number.parseFloat(colorSrgbMatch[4]) : 1
    }
  }

  const match = value.match(/rgba?\(([^)]+)\)/)
  if (!match) {
    throw new Error(`Unsupported color: ${value}`)
  }

  const [red, green, blue, alpha = 1] = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
  return { red, green, blue, alpha }
}

const extractGradientColors = (backgroundImage: string): ParsedColor[] => {
  const colors: ParsedColor[] = []

  for (const match of backgroundImage.matchAll(/rgba?\(([^)]+)\)/g)) {
    const [red, green, blue, alpha = '1'] = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
    colors.push({ red, green, blue, alpha })
  }

  for (const match of backgroundImage.matchAll(/color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\)/g)) {
    colors.push({
      red: Number.parseFloat(match[1]) * 255,
      green: Number.parseFloat(match[2]) * 255,
      blue: Number.parseFloat(match[3]) * 255,
      alpha: match[4] ? Number.parseFloat(match[4]) : 1
    })
  }

  return colors
}

const relativeLuminance = (color: ParsedColor) => (0.2126 * color.red) + (0.7152 * color.green) + (0.0722 * color.blue)

const expectGradientToAvoidNearWhiteWash = (
  backgroundImage: string,
  label: string,
  maxAllowedLuminance: number
) => {
  expect(backgroundImage, `${label} should still render with gradients`).toContain('gradient')

  const opaqueStops = extractGradientColors(backgroundImage).filter((color) => color.alpha > 0.05)
  expect(opaqueStops.length, `${label} should expose at least one visible color stop`).toBeGreaterThan(0)

  const darkestStop = opaqueStops.reduce((darkest, color) => {
    return relativeLuminance(color) < relativeLuminance(darkest) ? color : darkest
  })

  expect(relativeLuminance(darkestStop), `${label} should keep at least one non-near-white stop`).toBeLessThan(maxAllowedLuminance)
}

const setLightTheme = async (page: Parameters<typeof test.beforeEach>[0]['page']) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'light')
  }, themeStorageKey)
}

const setDarkTheme = async (page: Parameters<typeof test.beforeEach>[0]['page']) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'dark')
  }, themeStorageKey)
}

const gotoUpload = async (page: Parameters<typeof test.beforeEach>[0]['page']) => {
  await page.goto('/upload')
  await expect(page.locator('.upload-page')).toBeVisible()
}

const readSurface = async (page: Parameters<typeof test.beforeEach>[0]['page'], selector: string): Promise<SurfaceSnapshot> => {
  return page.locator(selector).evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      backgroundImage: style.backgroundImage,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      backdropFilter: style.backdropFilter,
      webkitBackdropFilter: style.getPropertyValue('-webkit-backdrop-filter')
    }
  })
}

type ButtonSnapshot = {
  color: string
  backgroundImage: string
  backgroundColor: string
  borderColor: string
  fontWeight: string
  boxShadow: string
}

const readButton = async (page: Parameters<typeof test.beforeEach>[0]['page'], selector: string): Promise<ButtonSnapshot> => {
  return page.locator(selector).evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      color: style.color,
      backgroundImage: style.backgroundImage,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      fontWeight: style.fontWeight,
      boxShadow: style.boxShadow
    }
  })
}

test.describe('upload light-theme render guards', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await setLightTheme(page)
  })

  test('direct access boots `/upload` into light theme and reveal state without reduced-motion fallback', async ({ page }) => {
    await gotoUpload(page)

    const rootState = await page.locator('html').evaluate((element) => ({
      theme: element.getAttribute('data-theme'),
      darkClass: element.classList.contains('dark')
    }))

    const pageState = await page.locator('.upload-page').evaluate((element) => ({
      directAccess: element.classList.contains('upload-page--direct-access'),
      reveal: element.classList.contains('upload-page--reveal'),
      reducedMotion: element.classList.contains('upload-page--reduced-motion')
    }))

    const contentOpacity = await page.locator('.upload-page__content').evaluate((element) => window.getComputedStyle(element).opacity)

    expect(rootState.theme).toBe('light')
    expect(rootState.darkClass).toBe(false)
    expect(pageState.directAccess).toBe(true)
    expect(pageState.reveal).toBe(true)
    expect(pageState.reducedMotion).toBe(false)
    expect(Number.parseFloat(contentOpacity)).toBeGreaterThan(0.99)
  })

  test('reduced-motion still keeps upload light-themed while switching to the explicit reduced-motion branch', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await gotoUpload(page)

    const pageState = await page.locator('.upload-page').evaluate((element) => ({
      directAccess: element.classList.contains('upload-page--direct-access'),
      reveal: element.classList.contains('upload-page--reveal'),
      reducedMotion: element.classList.contains('upload-page--reduced-motion')
    }))

    expect(pageState.directAccess).toBe(false)
    expect(pageState.reveal).toBe(true)
    expect(pageState.reducedMotion).toBe(true)
  })

  test('light-theme veil stays restrained on the real direct-access state instead of washing the page out', async ({ page }) => {
    await gotoUpload(page)

    const pageState = await page.locator('.upload-page').evaluate((element) => ({
      directAccess: element.classList.contains('upload-page--direct-access'),
      reveal: element.classList.contains('upload-page--reveal')
    }))

    const veilStyle = await page.locator('.upload-page__veil').evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        opacity: Number.parseFloat(style.opacity),
        backgroundImage: style.backgroundImage
      }
    })

    expect(pageState.directAccess).toBe(true)
    expect(pageState.reveal).toBe(true)
    expect(veilStyle.opacity).toBeLessThan(0.75)
    expectGradientToAvoidNearWhiteWash(veilStyle.backgroundImage, 'upload veil', 244)
  })

  test('deck, surface, and status rail remain matte and react to root theme tokens at runtime', async ({ page }) => {
    await gotoUpload(page)

    const before = {
      deck: await readSurface(page, '.upload-workbench__deck'),
      surface: await readSurface(page, '.upload-workbench__surface'),
      rail: await readSurface(page, '.upload-workbench__status-rail')
    }

    await page.evaluate(() => {
      const root = document.documentElement
      root.style.setProperty('--surface-border', 'rgba(12, 140, 120, 0.72)')
      root.style.setProperty('--card-bg', 'rgba(235, 206, 168, 0.96)')
      root.style.setProperty('--surface-color', 'rgba(214, 239, 226, 0.94)')
      root.style.setProperty('--bg-solid', 'rgb(188, 223, 210)')
      root.style.setProperty('--background', 'rgb(244, 252, 247)')
    })

    const after = {
      deck: await readSurface(page, '.upload-workbench__deck'),
      surface: await readSurface(page, '.upload-workbench__surface'),
      rail: await readSurface(page, '.upload-workbench__status-rail')
    }

    for (const material of [after.deck, after.surface, after.rail]) {
      expect(material.backdropFilter).toBe('none')
      expect(material.webkitBackdropFilter || 'none').toBe('none')
      expect(material.backgroundImage).toContain('gradient')
      expect(material.boxShadow).toContain('rgba(24, 29, 38')
    }

    expect(after.deck.backgroundImage).not.toBe(before.deck.backgroundImage)
    expect(after.surface.backgroundImage).not.toBe(before.surface.backgroundImage)
    expect(after.rail.backgroundImage).not.toBe(before.rail.backgroundImage)
    expect(after.deck.borderColor).not.toBe(before.deck.borderColor)
    expect(after.surface.borderColor).not.toBe(before.surface.borderColor)
    expect(after.rail.borderColor).not.toBe(before.rail.borderColor)
  })

  test('video upload empty state keeps both shell layers off pure white while preserving readable hierarchy', async ({ page }) => {
    await gotoUpload(page)

    const uploadRoot = page.locator('.animate-fade-in')
    const emptyShell = uploadRoot.locator(':scope > div').first()
    const emptyPanel = emptyShell.locator(':scope > div.relative').last()
    const primaryCopy = emptyPanel.locator('p').first()

    await expect(emptyShell).toBeVisible()
    await expect(emptyPanel).toBeVisible()
    await expect(primaryCopy).toBeVisible()

    const shellStyles = await emptyShell.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor
      }
    })

    const panelStyles = await emptyPanel.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor
      }
    })

    const copyColor = parseNumericColor(await primaryCopy.evaluate((element) => window.getComputedStyle(element).color))

    expectGradientToAvoidNearWhiteWash(shellStyles.backgroundImage, 'video upload empty shell', 248)
    expectGradientToAvoidNearWhiteWash(panelStyles.backgroundImage, 'video upload empty panel', 248)
    expect(copyColor.red).toBeLessThan(90)
    expect(copyColor.green).toBeLessThan(100)
    expect(copyColor.blue).toBeLessThan(110)
  })

  test('light theme empty-state CTA keeps a readable foreground against its own fill', async ({ page }) => {
    await gotoUpload(page)

    const cta = await readButton(page, '.animate-fade-in button.min-w-44')
    const ctaColor = parseNumericColor(cta.color)
    const ctaBackgroundColor = parseNumericColor(cta.backgroundColor)

    expect(ctaBackgroundColor.alpha).toBeGreaterThan(0.9)
    expect(relativeLuminance(ctaBackgroundColor)).toBeLessThan(150)
    expect(ctaColor.red).toBeGreaterThan(205)
    expect(ctaColor.green).toBeGreaterThan(205)
    expect(ctaColor.blue).toBeGreaterThan(205)
    expect(relativeLuminance(ctaColor) - relativeLuminance(ctaBackgroundColor)).toBeGreaterThan(60)
  })
})

test.describe('upload button visibility semantics', () => {
  test('selected media mode button keeps a stronger visual weight than the unselected sibling', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await setLightTheme(page)
    await gotoUpload(page)

    const imageButton = await readButton(page, '.upload-workbench__mode-strip button:nth-of-type(1)')
    const videoButton = await readButton(page, '.upload-workbench__mode-strip button:nth-of-type(2)')
    const videoBackground = parseNumericColor(videoButton.backgroundColor)

    expect(Number.parseInt(videoButton.fontWeight, 10)).toBeGreaterThan(Number.parseInt(imageButton.fontWeight, 10))
    expect(videoBackground.alpha).toBeGreaterThan(0.75)
    expect(`${videoButton.backgroundColor}|${videoButton.boxShadow}`).not.toBe(`${imageButton.backgroundColor}|${imageButton.boxShadow}`)
  })

  test('empty-state upload CTA keeps a bright readable foreground in dark theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await setDarkTheme(page)
    await gotoUpload(page)

    const cta = await readButton(page, '.animate-fade-in button.min-w-44')
    const ctaColor = parseNumericColor(cta.color)
    expect(ctaColor.red).toBeGreaterThan(205)
    expect(ctaColor.green).toBeGreaterThan(205)
    expect(ctaColor.blue).toBeGreaterThan(205)
    expect(cta.borderColor).not.toBe('rgba(0, 0, 0, 0)')
  })
})
