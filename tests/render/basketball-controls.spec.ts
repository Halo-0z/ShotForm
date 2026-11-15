import { test, expect } from "@playwright/test"

test("game buttons respond to hover and press without shifting their neighbours", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.goto("/upload")
    await expect
        .poll(() =>
            page
                .locator(".upload-page")
                .evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m42),
        )
        .toBe(0)
    const video = page.getByRole("button", { name: "视频分析", exact: true })
    const image = page.getByRole("button", { name: "图片分析", exact: true })
    const neighbour = await image.boundingBox()
    const offset = () =>
        video.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m42)
    await video.hover()
    await expect.poll(offset).toBe(-2)
    await page.mouse.down()
    await expect.poll(offset).toBe(2)
    await page.mouse.up()
    await expect(video).toHaveAttribute("aria-pressed", "true")
    expect(await image.boundingBox()).toEqual(neighbour)
    await image.focus()
    await page.keyboard.press("Enter")
    await expect(image).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("button", { name: "选择图片", exact: true })).toBeVisible()
})

test("reduced motion removes game movement and SVG decoration does not change accessible button names", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    const start = page.getByRole("button", { name: "开始投篮分析", exact: true })
    await start.hover()
    await expect(start).toHaveCSS("transform", "none")
    await start.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("heading", { name: "上传素材", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "视频分析", exact: true }).hover()
    await expect(page.getByRole("button", { name: "视频分析", exact: true })).toHaveCSS(
        "transform",
        "none",
    )
})
