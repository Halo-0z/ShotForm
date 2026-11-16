// Verify generated local inspection artifacts; this does not create human labels.
import { chromium } from "@playwright/test"
import assert from "node:assert/strict"
import path from "node:path"
import { pathToFileURL } from "node:url"

const [reviewPath, annotationPath] = process.argv.slice(2).map((p) => path.resolve(p))
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } })
    const errors = [],
        externalRequests = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("request", (request) => {
        if (/^https?:/.test(request.url())) externalRequests.push(request.url())
    })
    await page.goto(pathToFileURL(reviewPath).href)
    await page.getByRole("heading", { name: "模型预测复核 · 待人工标注" }).waitFor()
    const count = await page.locator("section").count()
    assert.ok(count > 0)
    await page.locator("img").evaluateAll((images) =>
        images.forEach((image) => {
            image.loading = "eager"
        }),
    )
    await page.waitForFunction(() =>
        [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    )
    assert.equal(await page.locator("img").count(), count)
    await page.locator("nav a").last().click()
    assert.equal(new URL(page.url()).hash, "#f" + (count - 1))
    await page.locator("section").last().getByText("本帧预测状态与阶段耗时").click()
    await page.locator("section").last().locator("pre").waitFor({ state: "visible" })
    await page.locator("nav a").first().click()
    await page.screenshot({ path: path.join(path.dirname(reviewPath), "browser-preview.png") })
    await page.goto(pathToFileURL(annotationPath).href)
    const data = await page.locator("#payload").textContent()
    const frames = JSON.parse(data).dataset.frames
    assert.equal(frames.length, 5)
    assert.ok(
        frames.every(
            (f) =>
                f.target_bbox === null &&
                Object.keys(f.manual_keypoints).length === 0 &&
                !f.reviewed_at,
        ),
    )
    await page.waitForFunction(() => document.querySelector("canvas").width === 720)
    assert.equal(await page.locator("#review").isChecked(), false)
    assert.deepEqual(errors, [])
    assert.deepEqual(externalRequests, [])
    console.log(
        `PASS: ${count} offline comparisons load; navigation/details work; five supplemental frames have no labels; no script errors/external requests`,
    )
} finally {
    await browser.close()
}
