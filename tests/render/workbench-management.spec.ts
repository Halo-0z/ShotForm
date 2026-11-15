import { test, expect, type Page } from "@playwright/test"
test.use({ reducedMotion: "reduce" })
async function installTemplates(page: Page) {
    await page.evaluate(async () => {
        const { useAnalysisStore } = await import("/src/stores/analysis.ts")
        const w = window as any,
            store = useAnalysisStore()
        w.__managementStore = store
        const analysis = {
            timestamp: 1,
            shotType: "one_motion",
            shotTypeConfidence: 0.7,
            shotTypeReasons: [],
            poseData: { width: 498, height: 1541, keypoints: [] },
            angles: [],
        }
        store.setCurrentAnalysis(analysis)
        store.currentImage = "/hero/kobe-shot.png"
        store.currentVideoAnalysis = {
            videoPath: "fixture.mp4",
            bestFrameIndex: 0,
            frames: [{ timestampMs: 0, analysis, imageData: "/hero/kobe-shot.png" }],
            templateProfile: {
                version: 1,
                sourceKind: "video",
                overallShotType: "one_motion",
                samplesUsed: 3,
                coverage: 0.8,
                phaseProfiles: {},
            },
        }
        w.__TAURI_INTERNALS__ = {
            invoke: async (command: string, args: any) => {
                const rows = JSON.parse(localStorage.getItem("management-templates") || "[]")
                if (command === "get_player_templates_db") return rows
                if (command === "get_correction_suggestions") return []
                if (command === "add_player_template") {
                    if (w.__failTemplate) throw new Error("模板写入失败")
                    rows.push({ ...args.template, id: rows.length + 1 })
                    localStorage.setItem("management-templates", JSON.stringify(rows))
                    return rows.length
                }
                if (command === "update_player_template_metadata") {
                    Object.assign(
                        rows.find((r: any) => r.id === args.template.id),
                        args.template,
                    )
                    localStorage.setItem("management-templates", JSON.stringify(rows))
                    return null
                }
                if (command === "delete_player_template") {
                    localStorage.setItem(
                        "management-templates",
                        JSON.stringify(rows.filter((r: any) => r.id !== args.id)),
                    )
                    return null
                }
                throw new Error(`Unexpected command: ${command}`)
            },
        }
    })
    await expect(page.getByRole("heading", { name: "投篮动作分析", exact: true })).toBeVisible()
}

test("template failure preserves fields; create edit reload and confirmed deletion retain the workflow", async ({
    page,
}) => {
    await page.goto("/analysis")
    await expect(page.locator("h1")).toBeVisible()
    await installTemplates(page)
    await page
        .getByRole("navigation")
        .getByRole("button", { name: "模板管理", exact: true })
        .click()
    await page.getByLabel("球星名称", { exact: true }).fill("参考训练者")
    await page.getByLabel("球队 / 标签", { exact: true }).fill("定点训练")
    await page.getByLabel("模板说明", { exact: true }).fill("已授权素材，侧面视角，00:00–00:03")
    await page.evaluate(() => {
        ;(window as any).__failTemplate = true
    })
    await page.getByRole("button", { name: "保存为球星模板" }).click()
    await expect(page.getByText("模板写入失败")).toBeVisible()
    await expect(page.getByLabel("球星名称", { exact: true })).toHaveValue("参考训练者")
    await page.evaluate(() => {
        ;(window as any).__failTemplate = false
    })
    await page.getByRole("button", { name: "保存为球星模板" }).click()
    await expect(page.locator(".templates-library__name")).toHaveText("参考训练者")
    await page.getByRole("button", { name: "编辑", exact: true }).click()
    await page.locator("#template-edit-name-1").fill("参考训练者第二版")
    await page.getByRole("button", { name: "保存修改", exact: true }).click()
    await page.goto("/analysis")
    await expect(page.locator("h1")).toBeVisible()
    await installTemplates(page)
    await page
        .getByRole("navigation")
        .getByRole("button", { name: "模板管理", exact: true })
        .click()
    await expect(page.locator(".templates-library__name")).toHaveText("参考训练者第二版")
    await page.getByRole("button", { name: "删除", exact: true }).click()
    await page.getByRole("button", { name: "取消", exact: true }).click()
    await expect(page.locator(".templates-library__name")).toHaveCount(1)
    await page.getByRole("button", { name: "删除", exact: true }).click()
    await page.getByRole("button", { name: "确认删除", exact: true }).click()
    await expect(page.getByText("模板库仍为空")).toBeVisible()
    await page.goto("/analysis")
    await expect(page.locator("h1")).toBeVisible()
    await installTemplates(page)
    await page
        .getByRole("navigation")
        .getByRole("button", { name: "模板管理", exact: true })
        .click()
    await expect(page.getByText("模板库仍为空")).toBeVisible()
})

test("analysis displays backend progress, prevents duplicate work and retains media on failure", async ({
    page,
}) => {
    await page.goto("/analysis")
    await expect(page.locator("h1")).toBeVisible()
    await installTemplates(page)
    await page
        .getByRole("navigation")
        .getByRole("button", { name: "上传素材", exact: true })
        .click()
    await page.getByRole("button", { name: "图片分析", exact: true }).click()
    await page.locator("input[type=file]").setInputFiles("public/hero/kobe-shot.png")
    await page.evaluate(() => {
        const w = window as any,
            store = w.__managementStore
        store.analyzeImage = async () => {
            store.isLoading = true
            store.progress = { progress: 60, stage: "pose", message: "正在识别姿态关键点" }
            try {
                await new Promise((_resolve, reject) => {
                    w.__rejectAnalysis = reject
                })
            } finally {
                store.isLoading = false
                store.progress = null
            }
        }
    })
    await page.getByRole("button", { name: "开始分析", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("正在识别姿态关键点")
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "60")
    await expect(page.getByRole("button", { name: "清空", exact: true })).toBeDisabled()
    await expect(page.getByRole("button", { name: "视频分析", exact: true })).toBeDisabled()
    await page.evaluate(() => {
        ;(window as any).__rejectAnalysis(new Error("识别服务暂不可用"))
    })
    await expect(page.getByRole("alert")).toContainText("识别服务暂不可用")
    await expect(page.getByAltText("预览图")).toBeVisible()
    await expect(page.getByRole("button", { name: "开始分析", exact: true })).toBeEnabled()
})
