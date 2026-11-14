import type { AnalysisHistory } from "@/types"
import { getAngleDisplayName, getShotTypeName, getRecordShotType } from "@/types"
import { escapeHtml as e, reportDocument, reportImage, reportTable } from "./report-html.js"
import { compareTrainingAngles, recordFrame } from "./training-comparison.js"
import { hasTauriRuntime } from "./tauri-runtime"

export async function saveReportFile(
    content: string,
    extension: "html" | "json",
    name = "投篮分析报告",
): Promise<boolean> {
    const filename = `${name}_${Date.now()}.${extension}`
    if (hasTauriRuntime()) {
        const { save } = await import("@tauri-apps/plugin-dialog")
        const path = await save({
            defaultPath: filename,
            filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
        })
        if (!path) return false
        const { writeTextFile } = await import("@tauri-apps/plugin-fs")
        await writeTextFile(path, content)
        return true
    }
    const url = URL.createObjectURL(
        new Blob([content], {
            type: extension === "html" ? "text/html;charset=utf-8" : "application/json",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
}

export function buildAnalysisReport(record: AnalysisHistory): string {
    const model = record.analysis.poseData.modelInfo
    const suggestions = (record.suggestions ?? [])
        .map((s) => `${s.bodyPart}：${s.issue}\n建议：${s.suggestion}`)
        .join("\n\n")
    const ai =
        record.aiCoachingSummary || record.aiCoachingSuggestions?.length
            ? `${record.aiCoachingSummary ?? ""}\n${(record.aiCoachingSuggestions ?? []).map((s) => `${s.bodyPart}：${s.suggestion}`).join("\n")}`
            : "未生成"
    return reportDocument(
        "投篮姿态分析报告",
        `<p>分析时间：${e(new Date(record.analysis.timestamp).toLocaleString("zh-CN"))}\n训练日期：${e(record.trainingDate || "未填写")}\n标签：${e(record.tags?.join("、") || "无")}\n备注：${e(record.notes || "无")}</p>
    ${reportImage(record.annotatedImagePath || record.imagePath)}
    <p>投篮类型：${e(getShotTypeName(getRecordShotType(record)))}</p>
    <p>实际姿态模型：${e(model?.name || "旧记录未记录")}<br>SHA-256：${e(model?.sha256 || "未记录")}<br>回退原因：${e(model ? model.fallback_reasons.join("；") || "无" : "未记录")}</p>
    <h2>所选帧角度</h2>${reportTable(
        ["指标", "角度（°）", "参考范围（°）", "状态"],
        record.analysis.angles.map((a) => [
            getAngleDisplayName(a.name),
            a.value.toFixed(1),
            a.normalRange.join("～"),
            a.status,
        ]),
    )}
    <h2>本地规则建议</h2><p>${e(suggestions || "没有已保存的规则建议；不代表动作一定正确。")}</p>
    <h2>AI 辅助建议</h2><p>${e(ai)}</p>`,
    )
}

export function buildTrainingReport(
    before: AnalysisHistory,
    after: AnalysisHistory,
    beforeIndex: number,
    afterIndex: number,
): string {
    const a = recordFrame(before, beforeIndex),
        b = recordFrame(after, afterIndex)
    const rows = compareTrainingAngles(a.analysis.angles, b.analysis.angles)
    const show = (n: number | null) => (n == null || !Number.isFinite(n) ? "—" : n.toFixed(1))
    return reportDocument(
        "两次训练对比报告",
        `<p>请对齐同一动作阶段，并尽量使用相同拍摄角度。变化值＝后一次－前一次，不自动判定进步。</p>
    <div class="pair">${[
        [before, a],
        [after, b],
    ]
        .map(([r, f]) => {
            const record = r as AnalysisHistory,
                frame = f as ReturnType<typeof recordFrame>
            return `<section><h2>${e(record.trainingDate)} · #${record.id}</h2>${reportImage(frame.image)}<p>时间点：${frame.timestampMs == null ? "图片" : `${frame.timestampMs} ms`}\n备注：${e(record.notes || "无")}</p></section>`
        })
        .join("")}</div>
    ${reportTable(
        ["指标", "前一次（°）", "后一次（°）", "变化（°）", "说明"],
        rows.map((r) => [
            getAngleDisplayName(r.name),
            show(r.before),
            show(r.after),
            show(r.delta),
            r.reason,
        ]),
    )}`,
    )
}
