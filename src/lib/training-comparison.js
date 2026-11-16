export function localDate(timestamp = Date.now()) {
    const date = new Date(timestamp)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function recordFrame(record, index) {
    const frames = record.videoAnalysis?.frames ?? []
    const frame =
        frames[
            Math.min(
                Math.max(index ?? record.videoAnalysis?.bestFrameIndex ?? 0, 0),
                frames.length - 1,
            )
        ]
    return {
        analysis: frame?.analysis ?? record.analysis,
        image:
            frame?.annotatedImageData ||
            frame?.imageData ||
            record.annotatedImagePath ||
            record.imagePath,
        timestampMs: frame?.timestampMs ?? null,
    }
}

export function compareTrainingAngles(before, after) {
    const names = [...new Set([...before.map((a) => a.name), ...after.map((a) => a.name)])]
    return names.map((name) => {
        const a = before.find((angle) => angle.name === name)
        const b = after.find((angle) => angle.name === name)
        const reason =
            !a || !b
                ? "缺少对应角度"
                : a.status === "low_confidence" || b.status === "low_confidence"
                  ? "关键点置信度不足"
                  : !Number.isFinite(a.value) || !Number.isFinite(b.value)
                    ? "角度数据无效"
                    : ""
        return {
            name,
            before: a?.value ?? null,
            after: b?.value ?? null,
            delta: reason ? null : b.value - a.value,
            reason,
        }
    })
}

// Shared with the rendered trend so regression tests exercise its actual data selection.
export function trainingTrendPoints(records, angleName) {
    return records.flatMap((record) => {
        const angle = record.analysis.angles.find((a) => a.name === angleName)
        if (!angle || angle.status === "low_confidence" || !Number.isFinite(angle.value)) return []
        return [
            {
                recordId: record.id,
                createdAt: record.createdAt,
                time: record.trainingDate
                    ? new Date(record.trainingDate + "T12:00:00").getTime()
                    : record.createdAt,
                value: angle.value,
            },
        ]
    })
}
