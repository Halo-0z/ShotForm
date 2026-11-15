import { test, expect, type Page } from "@playwright/test"

async function seedAnalysis(page: Page, video = false) {
    await page.evaluate(async (video) => {
        const { useAnalysisStore } = await import("/src/stores/analysis.ts")
        const store = useAnalysisStore(),
            w = window as any
        w.__replayStore = store
        w.__TAURI_INTERNALS__ = {
            invoke: async (command: string, args: any) => {
                if (command === "get_correction_suggestions") return []
                if (command === "save_analysis_history") {
                    if (w.__failSave) throw new Error("磁盘写入失败")
                    const rows = JSON.parse(localStorage.getItem("replay-test-records") || "[]")
                    const record = {
                        ...args,
                        id: rows.length + 1,
                        createdAt: Date.now(),
                        trainingDate: "2026-11-15",
                        notes: "",
                        tags: [],
                    }
                    rows.push(record)
                    localStorage.setItem("replay-test-records", JSON.stringify(rows))
                    return record.id
                }
                if (command === "query_training_history") {
                    if (w.__failQuery) throw new Error("数据库暂不可用")
                    const rows = JSON.parse(localStorage.getItem("replay-test-records") || "[]")
                    return rows.filter((r: any) => !args.tag || r.tags.includes(args.tag))
                }
                if (command === "update_training_metadata") {
                    if (w.__failMetadata) throw new Error("训练信息保存失败")
                    const rows = JSON.parse(localStorage.getItem("replay-test-records") || "[]")
                    Object.assign(
                        rows.find((r: any) => r.id === args.id),
                        args,
                    )
                    localStorage.setItem("replay-test-records", JSON.stringify(rows))
                    return null
                }
                throw new Error(`Unexpected command: ${command}`)
            },
        }
        const analysis = (value: number) => ({
            timestamp: Date.now(),
            shotType: "one_motion",
            shotTypeConfidence: 0.71,
            shotTypeReasons: ["测试夹具"],
            poseData: {
                width: 498,
                height: 1541,
                keypoints: [
                    { id: 11, x: 100, y: 400, visibility: 0.9 },
                    { id: 13, x: 220, y: 500, visibility: 0.9 },
                ],
            },
            angles: [
                {
                    name: "right_elbow_angle",
                    value,
                    normalRange: [80, 110],
                    confidence: 0.9,
                    status: "normal",
                },
                {
                    name: "right_knee_angle",
                    value: 151,
                    normalRange: [140, 170],
                    confidence: 0.2,
                    status: "low_confidence",
                },
            ],
        })
        store.setCurrentAnalysis(analysis(91))
        store.currentImage = "/hero/kobe-shot.png"
        store.currentAnnotatedImage = "/hero/kobe-shot.png"
        if (video) {
            store.currentVideoAnalysis = {
                videoPath: "test.mp4",
                bestFrameIndex: 0,
                overallShotType: "one_motion",
                overallShotTypeConfidence: 0.71,
                frames: [91, 102, 113].map((value, i) => ({
                    index: i,
                    timestampMs: i * 500,
                    imageData: "/hero/kobe-shot.png",
                    annotatedImageData: "/hero/kobe-shot.png",
                    analysis: analysis(value),
                })),
            }
        }
        store.coachingSources.rule.state = "done"
    }, video)
}
const history = (page: Page) =>
    page.getByRole("navigation").getByRole("button", { name: "训练历史", exact: true }).click()

test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } })

test("theme settings persist, follow system, trap focus and leave editing shortcuts intact", async ({
    page,
}) => {
    await page.goto("/upload")
    const settings = page.getByRole("button", { name: "设置", exact: true })
    await settings.click()
    const dialog = page.getByRole("dialog")
    const tray = await page.context().newPage()
    await tray.setViewportSize({ width: 376, height: 380 })
    await tray.goto("/tray-menu")
    await expect(tray.getByRole("main", { name: "ShotForm 系统托盘菜单" })).toBeVisible()
    await dialog.getByRole("radio", { name: "深色", exact: true }).check()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await expect(tray.locator("html")).toHaveClass(/dark/)
    const darkTray = await tray
        .locator(".tray-menu-panel")
        .evaluate((node) => getComputedStyle(node).backgroundColor)
    await page.keyboard.press("Control+Shift+H")
    await expect(page).toHaveURL(/\/upload$/)
    for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab")
        expect(
            await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))),
        ).toBe(true)
    }
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
    await expect(settings).toBeFocused()
    await page.reload()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await settings.click()
    await dialog.getByRole("radio", { name: "浅色", exact: true }).check()
    await expect(page.locator("html")).not.toHaveClass(/dark/)
    await expect(tray.locator("html")).not.toHaveClass(/dark/)
    expect(
        await tray
            .locator(".tray-menu-panel")
            .evaluate((node) => getComputedStyle(node).backgroundColor),
    ).not.toBe(darkTray)
    expect(await tray.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
    )
    await tray.getByRole("button", { name: "开始分析", exact: true }).click()
    await expect(tray).toHaveURL(/\/upload$/)
    await tray.close()
    await dialog.getByRole("radio", { name: "跟随系统", exact: true }).check()
    await page.emulateMedia({ colorScheme: "dark" })
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.emulateMedia({ colorScheme: "light" })
    await expect(page.locator("html")).not.toHaveClass(/dark/)
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
    await page.keyboard.press("Control+c")
    await expect(page).toHaveURL(/\/upload$/)
    await page.keyboard.press("Control+Shift+H")
    await expect(page.locator("h1")).toHaveText("历史记录")
    await page.getByLabel("筛选标签").fill("保留文字")
    await page.keyboard.press("Control+Shift+A")
    await expect(page).toHaveURL(/\/history$/)
    await expect(page.getByLabel("筛选标签")).toHaveValue("保留文字")
})

test("replay preserves image aspect, overlays real keypoints and commits selected frame on pause", async ({
    page,
}) => {
    await page.goto("/analysis")
    await seedAnalysis(page, true)
    const canvas = page.locator("canvas")
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(0)
    expect(await canvas.evaluate((c: HTMLCanvasElement) => c.width / c.height)).toBeCloseTo(
        498 / 1541,
        2,
    )
    const pose = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL())
    await page.getByRole("button", { name: "原始画面", exact: true }).click()
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(pose)
    await page.getByRole("button", { name: "选择第 2 帧", exact: true }).click()
    await expect(page.getByRole("button", { name: "选择第 2 帧" })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await page.getByRole("button", { name: "数据表", exact: true }).click()
    await expect(page.locator(".angle-table")).toContainText("102.0°")
    await expect(page.locator(".angle-table")).toContainText("暂不判断")
    await expect(page.locator(".angle-table")).not.toContainText("151.0°")
    await page.getByRole("button", { name: "播放回放", exact: true }).click()
    await expect(page.getByRole("button", { name: "保存历史记录", exact: true })).toBeDisabled()
    await expect.poll(() => canvas.getAttribute("aria-label")).not.toBe("投篮动作第 2 帧")
    await page.getByRole("button", { name: "暂停回放", exact: true }).click()
    const index = await page.evaluate(() => (window as any).__replayStore.currentVideoFrameIndex)
    await expect(
        page.getByRole("button", { name: `选择第 ${index + 1} 帧`, exact: true }),
    ).toHaveAttribute("aria-pressed", "true")
    await expect(page.locator(".angle-table")).toContainText(`${[91, 102, 113][index]}.0°`)
})

test("save failure retains analysis; retry saves once and reload reads history and metadata", async ({
    page,
}) => {
    await page.goto("/analysis")
    await seedAnalysis(page)
    await page.evaluate(() => {
        ;(window as any).__failSave = true
    })
    await page.getByRole("button", { name: "保存历史记录", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("保存失败")
    await expect(page.getByAltText("图片姿态分析")).toBeVisible()
    await expect(page.locator(".analysis-deviation-cards")).toContainText("91.0°")
    await page.evaluate(() => {
        ;(window as any).__failSave = false
    })
    await page.getByRole("button", { name: "保存历史记录", exact: true }).click()
    await expect(page.getByRole("button", { name: "已保存历史记录" })).toBeDisabled()
    await page.reload()
    await seedAnalysis(page)
    await history(page)
    await expect(page.getByRole("button", { name: "编辑训练" })).toHaveCount(1)
    await page.getByRole("button", { name: "编辑训练" }).click()
    await page.getByLabel("训练备注", { exact: true }).fill("重新读回的训练备注")
    await page.evaluate(() => {
        ;(window as any).__failMetadata = true
    })
    await page.getByRole("button", { name: "保存训练信息" }).click()
    await expect(page.getByRole("alert")).toContainText("保存失败")
    await expect(page.getByLabel("训练备注", { exact: true })).toHaveValue("重新读回的训练备注")
    await page.evaluate(() => {
        ;(window as any).__failMetadata = false
    })
    await page.getByRole("button", { name: "保存训练信息" }).click()
    await expect(page.getByLabel("训练备注", { exact: true })).toHaveCount(0)
    await page.goto("/analysis")
    await seedAnalysis(page)
    await history(page)
    await expect(page.locator(".history-session-row__summary")).toContainText("重新读回的训练备注")
})

test("history distinguishes failed query, no records and no matching records", async ({ page }) => {
    await page.goto("/analysis")
    await seedAnalysis(page)
    await page.evaluate(() => {
        ;(window as any).__failQuery = true
    })
    await history(page)
    await expect(page.getByRole("alert")).toContainText("数据库暂不可用")
    await expect(page.getByText("还没有投篮档案记录")).toHaveCount(0)
    await page.evaluate(() => {
        ;(window as any).__failQuery = false
    })
    await page.getByRole("button", { name: "重新加载" }).click()
    await expect(page.getByText("还没有投篮档案记录")).toBeVisible()
    await page.getByLabel("筛选标签").fill("未匹配")
    await page.getByRole("button", { name: "筛选", exact: true }).click()
    await expect(page.getByText("未找到匹配的记录")).toBeVisible()
})

test("narrow workbench and settings fit a 200 percent desktop equivalent", async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 450 })
    for (const route of ["/", "/upload", "/analysis", "/history", "/compare", "/templates"]) {
        await page.goto(route)
        await expect(page.locator("h1")).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        )
    }
    await page.getByRole("button", { name: "设置", exact: true }).click()
    const bounds = await page.getByRole("dialog").boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.height).toBeLessThanOrEqual(450)
    await page.getByRole("button", { name: "关闭", exact: true }).click()
})
