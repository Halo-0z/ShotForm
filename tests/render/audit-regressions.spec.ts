import { test, expect } from "@playwright/test"

for (const outcome of ["resolve", "reject"] as const) {
    test(`frame suggestions: HTML/JSON and saves stay current during delay and ${outcome}`, async ({
        page,
    }) => {
        await page.goto("/analysis")
        await expect(page.getByText("尚无分析结果")).toBeVisible()
        await page.evaluate(async () => {
            const { useAnalysisStore } = await import("/src/stores/analysis.ts")
            const w = window as any
            w.__auditWrites = []
            w.__auditSaves = []
            w.__auditPending = []
            w.__auditDelay = false
            const suggestion = (text: string) => ({
                bodyPart: "膝部",
                suggestion: text,
                priority: "medium",
            })
            w.__TAURI_INTERNALS__ = {
                invoke: async (command: string, args: any) => {
                    if (command === "get_correction_suggestions") {
                        if (w.__auditDelay)
                            return new Promise((resolve, reject) =>
                                w.__auditPending.push({ resolve, reject }),
                            )
                        return [suggestion("OLD_FRAME_A_RULE")]
                    }
                    if (command === "save_analysis_history") {
                        w.__auditSaves.push(args)
                        return 42
                    }
                    if (command === "plugin:dialog|save") return "C:\\test\\audit-report.html"
                    if (command === "plugin:fs|write_text_file") {
                        w.__auditWrites.push(new TextDecoder().decode(args))
                        return null
                    }
                    if (/ai|hunyuan/i.test(command))
                        throw new Error("AI is prohibited in this test")
                    return null
                },
            }
            const store = useAnalysisStore()
            w.__auditStore = store
            const frames = [100, 150].map((value, index) => ({
                index,
                timestampMs: index * 200,
                imageData: "",
                annotatedImageData: "",
                analysis: {
                    timestamp: 42,
                    poseData: { keypoints: [], width: 1, height: 1 },
                    angles: [
                        {
                            name: "left_knee_angle",
                            value,
                            normalRange: [140, 170],
                            status: "normal",
                            confidence: 1,
                        },
                    ],
                    shotType: "unknown",
                    shotTypeConfidence: 0,
                    shotTypeReasons: [],
                    aiReview: null,
                },
            }))
            store.setCurrentAnalysis(frames[0].analysis)
            store.currentVideoAnalysis = {
                videoPath: "fixture.mp4",
                bestFrameIndex: 0,
                overallShotType: "unknown",
                frames,
            } as any
            await store.selectVideoFrame(0)
        })
        await expect(page.getByText("OLD_FRAME_A_RULE")).toBeVisible()
        await page.evaluate(() => {
            const w = window as any
            w.__auditDelay = true
            w.__auditRequest = w.__auditStore.selectVideoFrame(1)
        })
        await expect(page.getByText("OLD_FRAME_A_RULE")).toHaveCount(0)
        for (const button of ["导出 HTML 报告", "导出 JSON"]) {
            await page.getByRole("button", { name: button, exact: true }).click()
            await expect(page.getByRole("status")).toContainText("报告已导出")
        }
        const pending = await page.evaluate(() => (window as any).__auditWrites)
        expect(pending).toHaveLength(2)
        expect(pending[0]).not.toContain("OLD_FRAME_A_RULE")
        expect(JSON.parse(pending[1]).suggestions).toEqual([])
        expect(JSON.parse(pending[1]).analysis.angles[0].value).toBe(150)
        expect(JSON.parse(pending[1]).videoAnalysis.bestFrameIndex).toBe(1)
        await page.evaluate(async (outcome) => {
            const w = window as any
            w.__auditPending[0][outcome](
                outcome === "resolve"
                    ? [{ bodyPart: "膝部", suggestion: "CURRENT_FRAME_B_RULE", priority: "medium" }]
                    : new Error("规则请求失败"),
            )
            await w.__auditRequest
        }, outcome)
        for (const button of ["导出 HTML 报告", "导出 JSON"]) {
            await page.getByRole("button", { name: button, exact: true }).click()
            await expect(page.getByRole("status")).toContainText("报告已导出")
        }
        await page.getByRole("button", { name: "保存历史记录", exact: true }).click()
        await expect(page.getByRole("button", { name: "已保存历史记录" })).toBeDisabled()
        const result = await page.evaluate(() => ({
            writes: (window as any).__auditWrites,
            saved: (window as any).__auditSaves[0],
        }))
        expect(result.writes).toHaveLength(4)
        expect(result.writes.join("")).not.toContain("OLD_FRAME_A_RULE")
        const exported = JSON.parse(result.writes[3])
        expect(exported.analysis.angles[0].value).toBe(150)
        expect(result.saved.suggestions).toEqual(exported.suggestions)
        if (outcome === "resolve") {
            expect(result.writes[2]).toContain("CURRENT_FRAME_B_RULE")
            expect(exported.suggestions[0].suggestion).toBe("CURRENT_FRAME_B_RULE")
        } else {
            expect(result.writes[2]).not.toContain("CURRENT_FRAME_B_RULE")
            expect(exported.suggestions).toEqual([])
        }
    })
}

test("rendered trend removes low-confidence knees and hips, including previously plotted points", async ({
    page,
}) => {
    await page.goto("/analysis")
    await page.evaluate(async () => {
        const { createApp, h, reactive } = await import("/node_modules/.vite/deps/vue.js")
        const { default: ProgressChart } = await import("/src/components/ProgressChart.vue")
        const w = window as any
        const names = ["left_knee_angle", "right_knee_angle", "left_hip_angle", "right_hip_angle"]
        const records = reactive(
            [0.1, 1].map((confidence, index) => ({
                id: index,
                createdAt: 1000 + index,
                analysis: {
                    angles: names.map((name) => ({
                        name,
                        value: confidence === 1 ? 150 : 180,
                        confidence,
                        status: confidence < 0.55 ? "low_confidence" : "normal",
                    })),
                },
            })),
        )
        w.__auditTrendRecords = records
        const host = document.createElement("div")
        host.id = "audit-trend"
        document.body.append(host)
        createApp({ render: () => h(ProgressChart, { records }) }).mount(host)
    })
    const values = () =>
        page.evaluate(async () => {
            const { getInstanceByDom } = await import("/node_modules/.vite/deps/echarts_core.js")
            const element = document.querySelector(
                "#audit-trend .progress-chart__canvas",
            ) as HTMLElement
            return (getInstanceByDom(element)?.getOption() as any)?.series?.[0]?.data
        })
    for (const name of [
        "left_knee_angle",
        "right_knee_angle",
        "left_hip_angle",
        "right_hip_angle",
    ]) {
        await page.locator("#audit-trend select").selectOption(name)
        await expect.poll(values).toEqual([150])
    }
    await page.evaluate(() => {
        for (const angle of (window as any).__auditTrendRecords[1].analysis.angles) {
            angle.confidence = 0.1
            angle.status = "low_confidence"
        }
    })
    await expect.poll(values).toEqual([])
})
