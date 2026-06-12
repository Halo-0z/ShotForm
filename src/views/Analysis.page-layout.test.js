import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./Analysis.vue", import.meta.url), "utf8")

test("analysis workbench keeps conclusion, visualizer, timeline, and details in one result page", () => {
    assert.match(source, /class="analysis-workbench__topbar"/)
    assert.match(source, /class="analysis-workbench__body"/)
    assert.match(source, /class="analysis-workbench__top-row"/)
    assert.match(source, /class="analysis-workbench__conclusion"/)
    assert.match(source, /class="analysis-workbench__visualizer"/)
    assert.match(source, /class="analysis-workbench__timeline-section"/)
    assert.match(source, /class="analysis-workbench__deviation"/)
    assert.match(source, /class="analysis-workbench__suggestions"/)
})

test("analysis page keeps the right evidence column sticky on wide workbench layouts", () => {
    assert.match(source, /\.analysis-workbench__body\s*\{[\s\S]*grid-template-columns:\s*1fr 420px/)
    assert.match(source, /\.analysis-workbench__right\s*\{[\s\S]*position:\s*sticky/)
    assert.match(
        source,
        /@media \(max-width: 1200px\)[\s\S]*\.analysis-workbench__body\s*\{[\s\S]*grid-template-columns:\s*1fr/,
    )
})
