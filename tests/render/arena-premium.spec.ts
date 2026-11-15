import { test, expect } from "@playwright/test"

test("generated upload artwork loads and stays separate from controls in both themes", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    for (const theme of ["light", "dark"]) {
        await page.addInitScript((t) => localStorage.setItem("theme-preference", t), theme)
        await page.goto("/upload")
        const art = page.locator(".court-artwork img")
        await expect(art).toBeVisible()
        await art.evaluate((img: HTMLImageElement) => img.decode())
        const artBox = await art.boundingBox()
        const action = page.getByRole("button", { name: "选择视频", exact: true })
        const actionBox = await action.boundingBox()
        expect(artBox!.x + artBox!.width).toBeLessThan(actionBox!.x)
        expect(artBox!.height).toBeLessThanOrEqual(300)
        await action.focus()
        await expect(action).toBeFocused()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        )
    }
    await page.setViewportSize({ width: 720, height: 450 })
    await expect(page.locator(".court-artwork")).not.toBeVisible()
    await expect(page.getByRole("button", { name: "选择视频", exact: true })).toBeVisible()
})

test("home quick links navigate to the real analysis, history and comparison routes", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    for (const [name, path] of [
        ["动作回放", "/analysis"],
        ["训练档案", "/history"],
        ["动作对比", "/compare"],
    ]) {
        await page.goto("/")
        const link = page
            .getByRole("navigation", { name: "训练快捷入口" })
            .getByRole("link", { name: new RegExp(name) })
        await link.focus()
        await page.keyboard.press("Enter")
        await expect(page).toHaveURL(new RegExp(`${path}$`))
        await expect(page.locator("h1").first()).toBeVisible()
    }
})
