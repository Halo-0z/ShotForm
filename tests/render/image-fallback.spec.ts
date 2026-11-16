import { test, expect, type Page } from "@playwright/test"

async function record(page: Page, original: string, overlay: string, id = 1) {
    await page.evaluate(
        async ({ original, overlay, id }) => {
            const { useAnalysisStore } = await import("/src/stores/analysis.ts")
            const store = useAnalysisStore()
            store.setCurrentHistoryRecord({
                id,
                createdAt: 1794700800000,
                imagePath: original,
                annotatedImagePath: overlay,
                suggestions: [],
                analysis: {
                    timestamp: id,
                    shotType: "one_motion",
                    shotTypeConfidence: 0.7,
                    shotTypeReasons: [],
                    poseData: { width: 498, height: 1541, keypoints: [] },
                    angles: [],
                },
            })
        },
        { original, overlay, id },
    )
}
const good = "/hero/kobe-shot.png"
test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.route("**/broken-*.png", (route) => route.fulfill({ status: 404, body: "missing" }))
    await page.goto("/analysis")
})

test("missing overlay selects original and explains unavailable overlay", async ({ page }) => {
    await record(page, good, "")
    await expect(page.getByRole("button", { name: "原始画面", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await expect(page.getByRole("button", { name: "姿态叠加", exact: true })).toBeDisabled()
    await expect(page.getByRole("status")).toContainText("没有可用的姿态叠加图")
    await expect(page.locator(".analysis-image")).toHaveAttribute("src", good)
})

test("failed overlay falls back, both failures stop and switching records clears errors", async ({
    page,
}) => {
    await record(page, good, "/broken-overlay.png")
    await expect(page.getByRole("status")).toContainText("姿态叠加图加载失败")
    await expect(page.getByRole("button", { name: "原始画面", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await expect(page.locator(".analysis-image")).toHaveAttribute("src", good)
    await record(page, "/broken-original.png", "/broken-overlay.png", 2)
    await expect(page.getByRole("status")).toContainText("原图加载失败")
    await expect(page.locator(".analysis-image")).toHaveCount(0)
    await expect(page.getByText("此记录没有可显示的图像，仍可查看已保存的分析数据。")).toBeVisible()
    for (const name of ["原始画面", "姿态叠加"]) {
        await expect(page.getByRole("button", { name, exact: true })).toBeDisabled()
        await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute(
            "aria-pressed",
            "false",
        )
    }
    await record(page, good, good, 3)
    await expect(page.locator(".analysis-image")).toHaveAttribute("src", good)
    await expect(page.getByRole("status")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "姿态叠加", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
})

test("original load failure falls back to available overlay with mode synchronized", async ({
    page,
}) => {
    await record(page, "/broken-original.png", good)
    await page.getByRole("button", { name: "原始画面", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("原图加载失败。当前显示姿态叠加图")
    await expect(page.getByRole("button", { name: "姿态叠加", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await expect(page.getByRole("button", { name: "原始画面", exact: true })).toBeDisabled()
})

test("same-day trend tooltip identifies the filtered record", async ({ page }) => {
    await page.evaluate(async () => {
        const { createApp, h } = await import("/node_modules/.vite/deps/vue.js")
        const { default: ProgressChart } = await import("/src/components/ProgressChart.vue")
        const host = document.createElement("div")
        host.id = "trend-test"
        document.body.append(host)
        createApp({
            render: () =>
                h(ProgressChart, {
                    records: [11, 12, 13].map((id) => ({
                        id,
                        trainingDate: "2026-11-16",
                        createdAt: 1794787200000 + id * 1000,
                        analysis: {
                            angles: [
                                {
                                    name: "right_elbow_angle",
                                    value: id + 80,
                                    status: id === 12 ? "low_confidence" : "normal",
                                },
                            ],
                        },
                    })),
                }),
        }).mount(host)
    })
    await expect
        .poll(() =>
            page.evaluate(async () => {
                const { getInstanceByDom } =
                    await import("/node_modules/.vite/deps/echarts_core.js")
                const chart = getInstanceByDom(
                    document.querySelector("#trend-test .progress-chart__canvas") as HTMLElement,
                )
                if (!chart) return []
                chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: 1 })
                return document.querySelector("#trend-test")?.textContent
            }),
        )
        .toContain("记录 #13")
    await expect(page.locator("#trend-test")).toContainText("93.0°")
})
