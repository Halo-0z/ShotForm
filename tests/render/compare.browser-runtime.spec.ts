import { expect, test } from "@playwright/test"

test("compare loading preview shows a real progress bar and stage text", async ({ page }) => {
    await page.goto("/compare?comparePreview=loading")

    await expect(page.locator("[data-compare-progress]")).toBeVisible()
    await expect(page.locator("[data-compare-stage]")).toContainText(
        /Loading preview templates|正在/,
    )
})

test("compare ready preview switches visible detail atomically when selecting another player", async ({
    page,
}) => {
    await page.goto("/compare?comparePreview=ready")

    await expect(page.locator("[data-compare-detail-player]")).toContainText("Curry")
    await page.getByText("查看角度雷达图", { exact: true }).click()
    await expect(page.locator(".radar-chart canvas")).toBeVisible()
    await expect(page.getByText("可靠角度不足三项", { exact: false })).toHaveCount(0)
    const radar = await page.locator(".radar-chart").evaluate(async (node) => {
        const { getInstanceByDom } = await import("/node_modules/.vite/deps/echarts_core.js")
        return (getInstanceByDom(node)!.getOption() as any).radar[0].indicator.map(
            (item: any) => item.name,
        )
    })
    expect(radar).toEqual(["右肘角", "出手角", "右膝角"])
    await expect(page.getByText("视频级对比").first()).toBeVisible()
    await expect(page.getByText("单帧回退").first()).toBeVisible()
    await expect(page.locator("[data-compare-toolbar-body]")).toContainText(
        "Curry 是当前最接近的模板",
    )
    await page.getByRole("button", { name: /Thompson/ }).click()
    await expect(page.locator("[data-compare-selected-player]")).toContainText("Thompson")
    await expect(page.locator("[data-compare-detail-player]")).toContainText("Thompson")
    await expect(page.locator("[data-compare-toolbar-body]")).toContainText(
        "当前最接近的模板是 Curry",
    )
    await expect(page.locator("[data-compare-toolbar-body]")).toContainText(
        "你正在查看 Thompson 的完整详情",
    )
})

test("compare empty preview exposes the empty state", async ({ page }) => {
    await page.goto("/compare?comparePreview=empty")

    await expect(page.locator("[data-compare-empty]")).toBeVisible()
})

test("compare error preview exposes retryable error state", async ({ page }) => {
    await page.goto("/compare?comparePreview=error")

    await expect(page.locator("[data-compare-error]")).toBeVisible()
    await expect(page.locator("[data-compare-stage]")).toContainText(/failed|失败/i)
})
