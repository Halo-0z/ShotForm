import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./Compare.vue", import.meta.url), "utf8")

test("compare page is structured as a workbench rather than a hero banner page", () => {
    assert.match(source, /class="compare-page__header"/)
    assert.match(source, /class="compare-page__summary"/)
    assert.match(source, /class="compare-page__workbench"/)
    assert.match(source, /<ComparisonView[\s\S]*v-if="analysis"/)
    assert.match(source, /:analysis-profile="compareAnalysisProfile"/)
    assert.doesNotMatch(source, /compare-hero-banner/)
})

test("compare page keeps back navigation and compare framing secondary to the workbench itself", () => {
    assert.match(source, /import \{ ArrowLeft, GitCompareArrows \} from "lucide-vue-next"/)
    assert.match(
        source,
        /const goBack = \(\) => \{[\s\S]*router\.push\(["']\/analysis["']\)[\s\S]*router\.push\(["']\/upload["']\)/,
    )
    assert.match(
        source,
        /<Button[\s\S]*variant="ghost"[\s\S]*size="icon"[\s\S]*class="compare-page__back"[\s\S]*@click="goBack"[\s\S]*<ArrowLeft/,
    )
    assert.match(source, /球星对比/)
    assert.match(source, /当前对比基于本次分析结果与选中模板的关键角度差异。/)
})
