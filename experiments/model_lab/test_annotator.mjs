// Synthetic clicks test tooling, never human ground truth. Run after generating the local pilot page.
import { chromium } from "@playwright/test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
const input = path.resolve(process.argv[2])
const browser = await chromium.launch({ channel: "msedge", headless: true })
try {
    const page = await browser.newPage({
        viewport: { width: 1300, height: 1000 },
        acceptDownloads: true,
    })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto(pathToFileURL(input).href)
    const payload = JSON.parse(await page.locator("#payload").textContent())
    const { width, height } = payload.dataset.frames[0]
    if (payload.target_description) {
        assert.ok(
            (await page.locator("#targetDescription").textContent()).includes(
                payload.target_description,
            ),
        )
    }
    assert.ok(
        payload.dataset.frames.every(
            (f) => !f.reviewed_at && Object.keys(f.manual_keypoints).length === 0,
        ),
    )
    await page.waitForFunction((w) => document.querySelector("canvas").width === w, width)
    await page.locator("#annotator").fill("SYNTHETIC BROWSER TEST")
    await page.locator("#present").selectOption("true")
    await page.locator("#occlusion").selectOption("other")
    await page.locator("#notes").fill("<script>测试中文 & 引号</script>")
    const box = await page.locator("canvas").boundingBox()
    const click = async (x, y) => {
        const current = await page.locator("canvas").boundingBox()
        await page.mouse.click(
            current.x + (x / width) * current.width,
            current.y + (y / height) * current.height,
        )
    }
    await page.mouse.move(box.x + (50 / width) * box.width, box.y + (100 / height) * box.height)
    await page.mouse.down()
    await page.mouse.move(box.x + (400 / width) * box.width, box.y + (1000 / height) * box.height)
    await page.mouse.up()
    await page.locator("#review").click()
    assert.equal(
        await page.locator("#review").isChecked(),
        false,
        "Incomplete review must be rejected",
    )
    for (const id of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
        await page.locator("#point-" + id).click()
        if (id === 11) {
            await page.locator("#pointState").selectOption("visible")
            await click(200, 400)
        } else await page.locator("#unknown").click()
    }
    await page.locator("#review").check()
    assert.equal(await page.locator("#review").isChecked(), true)
    await page.locator("#next").click()
    await page.locator("#prev").click()
    assert.equal(await page.locator("#review").isChecked(), true, "Navigation retains labels")
    const waiting = page.waitForEvent("download")
    await page.locator("#export").click()
    const download = await waiting
    assert.equal(
        download.suggestedFilename(),
        payload.dataset.frames[0].sample_id + "-annotations.json",
    )
    const saved = JSON.parse(await readFile(await download.path(), "utf8"))
    assert.equal(saved.frames[0].annotator, "SYNTHETIC BROWSER TEST")
    assert.ok(Math.abs(saved.frames[0].manual_keypoints["11"].x - 200) < 1)
    assert.ok(
        Math.abs(saved.frames[0].manual_keypoints["11"].y - 400) < 1,
        "Scaled canvas converts to original pixels",
    )
    assert.deepEqual(saved.frames[0].manual_keypoints["12"], { state: "unknown" })
    assert.ok(saved.frames[0].reviewed_at)
    assert.equal(saved.frames[0].notes, "<script>测试中文 & 引号</script>")
    await page.locator("#notes").fill("changed")
    assert.equal(await page.locator("#review").isChecked(), false, "Edit invalidates review")
    await page.locator("#import").setInputFiles({
        name: "resume.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(saved)),
    })
    await page.getByText("已导入；原图片及帧元数据保持一致").waitFor()
    assert.equal(await page.locator("#review").isChecked(), true)
    saved.frames[0].sha256 = "tampered"
    await page.locator("#import").setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(saved)),
    })
    await page.getByText("导入失败：帧身份、哈希或来源已改变").waitFor()
    assert.equal(
        await page.locator("#review").isChecked(),
        true,
        "Failed import must not lose prior work",
    )
    assert.deepEqual(errors, [])
    // Restore an untouched page for the inspection screenshot (no test labels in user artifact).
    await page.reload()
    await page.waitForFunction((w) => document.querySelector("canvas").width === w, width)
    await page.screenshot({
        path: path.join(path.dirname(input), "annotator-preview.png"),
        fullPage: true,
    })
    console.log(
        "PASS: original-pixel coordinates, box, unknown points, incomplete review, edit invalidation, navigation, Chinese export/import, tampered import, no browser errors",
    )
} finally {
    await browser.close()
}
