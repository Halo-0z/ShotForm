import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./Analysis.vue", import.meta.url), "utf8")

test("analysis conclusion prioritizes verdict, type, confidence, and reasons over abstract score", () => {
    assert.match(source, /class="analysis-workbench__judgment"/)
    assert.match(source, /class="analysis-workbench__card analysis-workbench__card--shot-type"/)
    assert.match(source, /class="analysis-workbench__card analysis-workbench__card--confidence"/)
    assert.match(source, /class="analysis-workbench__reasons"/)
    assert.doesNotMatch(source, /综合得分/)
    assert.doesNotMatch(source, /analysis-workbench__card--score/)
    assert.doesNotMatch(source, /const score = computed/)
})

test("analysis conclusion metric cards settle into a two-column evidence layout", () => {
    assert.match(
        source,
        /\.analysis-workbench__conclusion-cards\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    )
    assert.match(
        source,
        /@media \(max-width: 768px\)[\s\S]*\.analysis-workbench__conclusion-cards\s*\{[\s\S]*grid-template-columns:\s*1fr/,
    )
})
