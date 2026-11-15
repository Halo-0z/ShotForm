import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        if (!localStorage.getItem("theme-preference"))
            localStorage.setItem("theme-preference", "light")
    })
    await page.emulateMedia({ colorScheme: "light" })
})
test("direct upload access reveals content in light theme", async ({ page }) => {
    await page.goto("/upload")
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    await expect(page.getByRole("button", { name: "选择视频", exact: true })).toBeVisible()
    await expect(page.locator(".upload-page")).toHaveCSS("opacity", "1")
})
test("reduced motion still reveals upload controls", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/upload")
    expect(
        await page
            .locator(".upload-page")
            .evaluate((node) => parseFloat(getComputedStyle(node).animationDuration)),
    ).toBeLessThanOrEqual(0.001)
    await expect(page.getByRole("button", { name: "选择视频", exact: true })).toBeVisible()
})
test("workbench uses theme tokens and keeps the media entry visually clear", async ({ page }) => {
    await page.goto("/upload")
    const surface = page.locator(".upload-workbench__body")
    const before = await surface.evaluate((e) => getComputedStyle(e).backgroundColor)
    await page.evaluate(() =>
        document.documentElement.style.setProperty("--card-bg", "rgb(188, 223, 210)"),
    )
    await expect(surface).toHaveCSS("background-color", "rgb(188, 223, 210)")
    expect(before).not.toBe("rgb(188, 223, 210)")
    await expect(surface).toHaveCSS("backdrop-filter", "none")
})
test("media mode clearly distinguishes selection and dark theme remains usable", async ({
    page,
}) => {
    await page.goto("/upload")
    const image = page.getByRole("button", { name: "图片分析", exact: true })
    const video = page.getByRole("button", { name: "视频分析", exact: true })
    const before = await image.getAttribute("class")
    await image.click()
    expect(await image.getAttribute("class")).not.toBe(before)
    expect(await video.getAttribute("class")).toBe(before)
    await page.evaluate(() => localStorage.setItem("theme-preference", "dark"))
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await expect(page.getByRole("button", { name: "选择视频", exact: true })).toBeVisible()
})
