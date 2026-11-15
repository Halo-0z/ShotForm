import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"

const image = `data:image/png;base64,${readFileSync("public/hero/kobe-shot.png").toString("base64")}`

test("training workflow saves once, edits metadata, compares frames and exports self-contained reports", async ({
    page,
}) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/analysis")
    await expect(page.getByText("尚无分析结果")).toBeVisible()
    await page.evaluate(async (image) => {
        const { useAnalysisStore } = await import("/src/stores/analysis.ts")
        const store = useAnalysisStore()
        const w = window as any
        w.__testRows = []
        w.__testCalls = []
        w.__testWrites = []
        w.__TAURI_INTERNALS__ = {
            invoke: async (command: string, args: any) => {
                w.__testCalls.push({ command, args })
                if (command === "get_correction_suggestions") return []
                if (command === "save_analysis_history") {
                    const id = w.__testRows.length + 1
                    w.__testRows.push({
                        ...args,
                        id,
                        createdAt: Date.now() + id,
                        trainingDate: "2026-11-15",
                        notes: "",
                        tags: [],
                    })
                    return id
                }
                if (command === "query_training_history")
                    return w.__testRows
                        .filter((r: any) => !args.tag || r.tags.includes(args.tag))
                        .slice(args.offset, args.offset + args.limit)
                if (command === "update_training_metadata") {
                    Object.assign(
                        w.__testRows.find((r: any) => r.id === args.id),
                        args,
                    )
                    return null
                }
                if (command === "delete_analysis_history") {
                    w.__testRows = w.__testRows.filter((r: any) => r.id !== args.id)
                    return null
                }
                if (command === "plugin:dialog|save")
                    return w.__cancelExport ? null : "C:\\test\\report.html"
                if (command.startsWith("plugin:fs|write")) {
                    w.__testWrites.push(args)
                    return null
                }
                return null
            },
        }
        w.__testStore = store
        w.__makeAnalysis = (timestamp: number, value: number) => ({
            timestamp,
            poseData: { keypoints: [], width: 498, height: 1541 },
            angles: [
                {
                    name: "right_elbow_angle",
                    value,
                    normalRange: [80, 110],
                    confidence: 0.9,
                    status: "normal",
                },
            ],
            shotType: "one_motion",
            shotTypeConfidence: 0.7,
            shotTypeReasons: ["测试夹具：不是实测结果"],
            aiReview: null,
        })
        store.setCurrentAnalysis(w.__makeAnalysis(1000, 90))
        store.currentImage = image
        store.currentAnnotatedImage = image
        store.coachingSources.rule.state = "done"
    }, image)
    await expect(page.getByAltText("图片姿态分析")).toBeVisible()
    await page.getByRole("button", { name: "保存历史记录", exact: true }).click()
    await expect(page.getByRole("button", { name: "已保存历史记录" })).toBeDisabled()
    expect(await page.evaluate(() => (window as any).__testRows.length)).toBe(1)
    await page.getByRole("button", { name: "导出 HTML 报告" }).click()
    await expect(page.getByRole("status")).toContainText("报告已导出")
    expect(await page.evaluate(() => (window as any).__testWrites.length)).toBe(1)
    await page.evaluate(() => {
        ;(window as any).__cancelExport = true
    })
    await page.getByRole("button", { name: "导出 HTML 报告" }).click()
    await expect(page.getByRole("status")).toContainText("已取消导出")
    expect(await page.evaluate(() => (window as any).__testWrites.length)).toBe(1)
    await page.evaluate(async (image) => {
        const w = window as any,
            store = w.__testStore
        const frames = [80, 70].map((value, i) => ({
            index: i,
            timestampMs: i * 200,
            imageData: image,
            annotatedImageData: image,
            analysis: w.__makeAnalysis(2000 + i, value),
        }))
        store.setCurrentAnalysis(frames[0].analysis)
        store.currentImage = image
        store.currentAnnotatedImage = image
        store.currentVideoAnalysis = {
            videoPath: "missing.mp4",
            bestFrameIndex: 0,
            frames,
            overallShotType: "one_motion",
            overallShotTypeConfidence: 0.7,
        }
        await store.saveToHistory()
    }, image)
    await page
        .getByRole("navigation")
        .getByRole("button", { name: "训练历史", exact: true })
        .click()
    await expect(page.getByRole("button", { name: "编辑训练" })).toHaveCount(2)
    await page.getByRole("button", { name: "编辑训练" }).first().click()
    await page
        .getByLabel("训练备注", { exact: true })
        .fill('<script>alert("test")</script> 肘部练习')
    await page.getByLabel("训练标签", { exact: true }).fill("定点，练习")
    await page.getByRole("button", { name: "保存训练信息" }).click()
    await expect(page.getByLabel("训练备注", { exact: true })).toHaveCount(0)
    await page.getByLabel("选择记录 1 对比").check()
    await page.getByLabel("选择记录 2 对比").check()
    const comparison = page.getByRole("region", { name: "两次训练对比" })
    await expect(comparison).toBeVisible()
    await expect(comparison.locator("tbody")).toContainText("-10.0")
    await page.getByLabel("后一次动作帧").selectOption("1")
    await expect(comparison.locator("tbody")).toContainText("-20.0")
    await page.screenshot({ path: "test-results/training-comparison.png", fullPage: true })
    await page.evaluate(() => {
        ;(window as any).__cancelExport = false
    })
    await page.getByRole("button", { name: "导出对比报告" }).click()
    await expect(comparison.getByRole("status")).toContainText("报告已导出")
    const report = await page.evaluate(async () => {
        const { buildAnalysisReport } = await import("/src/lib/training-report.ts")
        return buildAnalysisReport((window as any).__testRows[0])
    })
    expect(report).toContain("data:image/png;base64,")
    expect(report).toContain("&lt;script&gt;")
    expect(report).not.toContain("<script>")
    expect(report).toContain("未生成")
    await page.getByLabel("筛选标签").fill("不存在")
    await page.getByRole("button", { name: "筛选", exact: true }).click()
    await expect(page.getByRole("button", { name: "编辑训练" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "重置" })).toBeVisible()
    expect(errors).toEqual([])
})

test("HTML report opens offline with image and escaped notes", async ({ page }) => {
    await page.goto("/analysis")
    const html = await page.evaluate(async (image) => {
        const { buildAnalysisReport } = await import("/src/lib/training-report.ts")
        return buildAnalysisReport({
            id: 1,
            createdAt: Date.now(),
            trainingDate: "2026-11-15",
            notes: "<b>备注</b>",
            tags: ["练习"],
            imagePath: image,
            annotatedImagePath: image,
            analysis: {
                timestamp: Date.now(),
                shotType: "unknown",
                angles: [],
                poseData: { keypoints: [] },
            },
            comparison: null,
            suggestions: [],
        } as any)
    }, image)
    await page.context().setOffline(true)
    await page.setContent(html)
    await expect(page.getByAltText("姿态分析图")).toBeVisible()
    expect(
        await page.getByAltText("姿态分析图").evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0)
    await expect(page.getByText(/<b>备注<\/b>/)).toBeVisible()
    await page.emulateMedia({ media: "print" })
    await page.screenshot({ path: "test-results/report-print.png", fullPage: true })
})
