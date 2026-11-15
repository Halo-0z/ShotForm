import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./Upload.vue", import.meta.url), "utf8")

test("upload route renders a dedicated workbench page instead of homepage chrome", () => {
    assert.match(source, /UploadWorkbenchPage/)
    assert.doesNotMatch(source, /HomeWorkspace/)
})

test("global sidebar supplies Home and History navigation", () => {
    const sidebar = readFileSync(new URL("../components/AppSidebar.vue", import.meta.url), "utf8")
    assert.match(sidebar, /path: ["']\/["']/)
    assert.match(sidebar, /path: ["']\/history["']/)
})
