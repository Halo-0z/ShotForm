import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./UploadWorkbenchPage.vue", import.meta.url), "utf8")

test("upload workbench trim styling is owned by the shared filmstrip component", () => {
    assert.match(source, /VideoTrimFilmstrip/)
    assert.match(source, /\.upload-workbench__trim-section\s*\{[\s\S]*gap:\s*12px/)
    assert.match(source, /\.upload-workbench__trim-label\s*\{[\s\S]*var\(--text-secondary\)/)
    assert.doesNotMatch(source, /\.upload-workbench__trim-rail/)
    assert.doesNotMatch(source, /\.upload-workbench__trim-filmstrip/)
    assert.doesNotMatch(source, /\.upload-workbench__trim-frame/)
    assert.doesNotMatch(source, /toDataURL/)
    assert.doesNotMatch(source, /object-fit:\s*cover/)
})

test("upload workbench avoids stacked decorative glass shells", () => {
    assert.doesNotMatch(source, /var\(--glass-(?:xs|sm|md|lg)\)/)
    assert.doesNotMatch(source, /backdrop-filter:\s*blur/)
    assert.doesNotMatch(source, /0 24px 64px/)
    assert.doesNotMatch(source, /0 18px 42px/)
})
