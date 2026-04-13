# Cinematic Workbench Tightening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the cinematic worktree so the home page keeps the drama while upload, analysis, and history feel like disciplined basketball training tools instead of polished component-library screens.

**Architecture:** Keep the existing route split and fog transition system, but rebalance the inner pages through layout hierarchy, quieter materials, and stronger page roles. The work stays mostly inside the existing page components and their regex-style tests, so we can reshape the UI without reworking stores, routing, or backend analysis logic.

**Tech Stack:** Vue 3, Vite, TypeScript, Tailwind CSS v4, custom CSS, node:test string-source tests, Tauri shell

---

## File Structure

### Existing files to modify
- `src/views/Analysis.vue`
  Owns the analysis page layout, first-screen hierarchy, evidence stage, diagnosis rail, and deep-dive affordances.
- `src/views/Analysis.page-layout.test.js`
  Guards the presence and order of the major first-screen structural regions.
- `src/components/upload/UploadWorkbenchPage.vue`
  Owns the upload workbench chrome, material language, top utility area, and action/status framing.
- `src/views/Upload.workbench.test.js`
  Guards upload page shell behavior and can absorb assertions about the focused workbench feel when needed.
- `src/components/TitleBar.vue`
  Owns immersive chrome styling that should visually match the toned-down workbench materials.
- `src/views/History.vue`
  Owns the archive page structure, card/list framing, and empty-state guidance.
- `src/views/History.banner.test.js`
  Already guards the banner shell and should keep doing so after the archive layout changes.

### New tests to create
- `src/views/Analysis.visual-priority.test.js`
  Regex/source test for the new “single dominant conclusion + primary evidence” first-screen structure.
- `src/components/upload/UploadWorkbenchPage.materials.test.js`
  Regex/source test for the reduced-glass, equipment-like workbench shell.
- `src/views/History.archive-layout.test.js`
  Regex/source test for archive-first history structure instead of the current generic grid-card browse state.

### Verification commands
- `npm test`
- `npm run build`

## Task 1: Rebuild Analysis First-Screen Hierarchy

**Files:**
- Modify: `src/views/Analysis.vue`
- Modify: `src/views/Analysis.page-layout.test.js`
- Create: `src/views/Analysis.visual-priority.test.js`

- [ ] **Step 1: Write the failing layout-priority test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Analysis.vue', import.meta.url), 'utf8')

test('analysis page gives the first screen one dominant conclusion zone and one dominant evidence zone', () => {
  assert.match(source, /class="analysis-page__hero"/)
  assert.match(source, /class="analysis-page__hero-summary"/)
  assert.match(source, /class="analysis-page__hero-stage"/)
  assert.doesNotMatch(source, /analysis-page__summary-stats/)
})
```

- [ ] **Step 2: Run the new test to confirm it fails**

Run: `node --test "src/views/Analysis.visual-priority.test.js"`

Expected: FAIL because the `analysis-page__hero*` structure does not exist yet.

- [ ] **Step 3: Tighten the existing layout test around the new structure**

Update `src/views/Analysis.page-layout.test.js` to expect the new dominant regions instead of the current flatter summary/workbench split.

```js
test('analysis page opens with a dominant hero band, evidence stage, and secondary diagnosis rail', () => {
  assert.match(source, /analysis-page__hero/)
  assert.match(source, /analysis-page__hero-stage/)
  assert.match(source, /analysis-page__diagnosis/)
  assert.match(source, /PAGE_COVER_ART\.analysis/)
})
```

- [ ] **Step 4: Implement the new first-screen structure in `src/views/Analysis.vue`**

Make these concrete changes:

```vue
<section class="analysis-page__hero">
  <div class="analysis-page__hero-summary">
    <div class="analysis-page__summary-badge">本次结论</div>
    <h2>{{ summaryTitle }}</h2>
    <p>{{ summaryText }}</p>
    <div class="analysis-page__hero-meta">
      <div class="analysis-page__hero-chip">
        <span class="analysis-page__hero-chip-label">投篮分型</span>
        <strong>{{ currentShotTypeName }}</strong>
      </div>
      <div class="analysis-page__hero-chip">
        <span class="analysis-page__hero-chip-label">确定度</span>
        <strong>{{ confidenceLabel }}</strong>
      </div>
    </div>
  </div>

  <div class="analysis-page__hero-stage">
    <!-- current preview surface and its mode controls live here -->
  </div>
</section>
```

Implementation notes:
- Fold the current summary block and stage card into one hero band.
- Demote the current stat cards into compact inline chips or a slim meta rail.
- Keep the video playback strip and angle chart below the hero band.
- Keep diagnosis, compare, and coaching as secondary content below the first-screen decision zone.

- [ ] **Step 5: Replace overly carded visual treatment with fewer, heavier surfaces**

In `src/views/Analysis.vue`, remove one level of nested container styling:

```css
.analysis-page__hero {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr);
  gap: 20px;
  padding: 24px 26px;
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(13, 17, 27, 0.96), rgba(9, 12, 20, 0.98));
}

.analysis-page__hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.analysis-page__hero-chip {
  min-width: 140px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
}
```

- [ ] **Step 6: Run the analysis tests**

Run: `node --test "src/views/Analysis.page-layout.test.js" "src/views/Analysis.visual-priority.test.js" "src/views/Analysis.video-workbench.test.js"`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/views/Analysis.vue src/views/Analysis.page-layout.test.js src/views/Analysis.visual-priority.test.js
git commit -m "refactor: tighten analysis first-screen hierarchy"
```

## Task 2: Quiet the Upload Workbench Materials

**Files:**
- Modify: `src/components/upload/UploadWorkbenchPage.vue`
- Modify: `src/components/TitleBar.vue`
- Modify: `src/views/Upload.workbench.test.js`
- Create: `src/components/upload/UploadWorkbenchPage.materials.test.js`

- [ ] **Step 1: Write the failing material-language test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./UploadWorkbenchPage.vue', import.meta.url), 'utf8')

test('upload workbench uses a restrained equipment-like shell instead of layered glass chrome', () => {
  assert.match(source, /upload-workbench__deck/)
  assert.match(source, /upload-workbench__rail/)
  assert.doesNotMatch(source, /box-shadow:\s*0 28px 48px/)
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test "src/components/upload/UploadWorkbenchPage.materials.test.js"`

Expected: FAIL because the `deck` and `rail` structure is not present.

- [ ] **Step 3: Add the new shell structure in `src/components/upload/UploadWorkbenchPage.vue`**

Reframe the page into fewer, clearer surfaces:

```vue
<section class="upload-workbench">
  <header class="upload-workbench__rail">
    <!-- eyebrow, title, back/home/history -->
  </header>

  <section class="upload-workbench__deck">
    <div class="upload-workbench__mode-strip">...</div>
    <div class="upload-workbench__surface">...</div>
    <footer class="upload-workbench__status-rail">...</footer>
  </section>
</section>
```

Implementation notes:
- Keep mode switching, upload editor, and actions in one main deck.
- Remove any feeling of stacked frosted panes floating over each other.
- Keep the fastest path to upload visible in the default window.

- [ ] **Step 4: Replace the current glossy treatment with quieter matte surfaces**

Update CSS in `src/components/upload/UploadWorkbenchPage.vue`:

```css
.upload-workbench__deck {
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(14, 17, 25, 0.96), rgba(10, 12, 18, 0.99));
}

.upload-workbench__surface {
  min-height: 420px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(7, 9, 14, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
```

Also tone down `src/components/TitleBar.vue` so immersive chrome feels part of the same system:

```css
.titlebar.immersive {
  background: linear-gradient(180deg, rgba(5, 7, 12, 0.9), rgba(5, 7, 12, 0.18));
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px) saturate(120%);
}
```

- [ ] **Step 5: Expand upload tests around the quieter shell**

Add or update assertions in `src/views/Upload.workbench.test.js` and the new materials test:

```js
assert.match(source, /upload-workbench__deck/)
assert.match(source, /upload-workbench__status-rail/)
assert.doesNotMatch(source, /glass/)
```

- [ ] **Step 6: Run the upload-focused tests**

Run: `node --test "src/views/Upload.workbench.test.js" "src/components/upload/UploadWorkbenchPage.materials.test.js" "src/components/TitleBar.hero.test.js"`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/upload/UploadWorkbenchPage.vue src/components/upload/UploadWorkbenchPage.materials.test.js src/views/Upload.workbench.test.js src/components/TitleBar.vue
git commit -m "style: quiet upload workbench materials"
```

## Task 3: Turn History into an Archive Page

**Files:**
- Modify: `src/views/History.vue`
- Modify: `src/views/History.banner.test.js`
- Create: `src/views/History.archive-layout.test.js`

- [ ] **Step 1: Write the failing archive-layout test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./History.vue', import.meta.url), 'utf8')

test('history page uses an archive list with session metadata and resume actions instead of a generic card grid', () => {
  assert.match(source, /class="history-archive"/)
  assert.match(source, /class="history-session-row"/)
  assert.doesNotMatch(source, /class="history-grid"/)
})
```

- [ ] **Step 2: Run the new test to confirm it fails**

Run: `node --test "src/views/History.archive-layout.test.js"`

Expected: FAIL because the archive structure is not implemented yet.

- [ ] **Step 3: Rework `src/views/History.vue` into an archive-first layout**

Replace the current generic grid with a calmer ordered list:

```vue
<section class="history-archive">
  <header class="history-archive__toolbar">
    <div>
      <p class="history-archive__eyebrow">Session Archive</p>
      <h2>继续查看以往分析</h2>
    </div>
    <p class="history-archive__hint">按时间回看，优先恢复最近一次训练判断。</p>
  </header>

  <div class="history-archive__list">
    <article v-for="record in historyList" :key="record.id" class="history-session-row">
      <!-- time, shot type, preview, resume/delete -->
    </article>
  </div>
</section>
```

Implementation notes:
- Lead with date/time, result label, and “查看详情/继续分析”.
- Keep the artwork banner, but make the content below feel archival and methodical.
- Empty state should teach the user what will show up here after their first analysis.

- [ ] **Step 4: Add archive-oriented styling**

Use quieter list styling in `src/views/History.vue`:

```css
.history-archive__list {
  display: grid;
  gap: 12px;
}

.history-session-row {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 16px 18px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(12, 15, 23, 0.9);
}
```

- [ ] **Step 5: Update the banner test and add the archive test**

Keep the current banner assertions, then add structural assertions:

```js
assert.match(source, /history-archive/)
assert.match(source, /history-session-row/)
assert.doesNotMatch(source, /history-grid/)
```

- [ ] **Step 6: Run the history tests**

Run: `node --test "src/views/History.banner.test.js" "src/views/History.archive-layout.test.js"`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/views/History.vue src/views/History.banner.test.js src/views/History.archive-layout.test.js
git commit -m "refactor: turn history into an archive page"
```

## Task 4: Final Verification and Polish

**Files:**
- Review only: `src/views/Analysis.vue`
- Review only: `src/components/upload/UploadWorkbenchPage.vue`
- Review only: `src/views/History.vue`

- [ ] **Step 1: Run the focused test suite**

Run: `node --test "src/views/Analysis*.test.js" "src/views/Upload.workbench.test.js" "src/components/upload/*.test.js" "src/views/History*.test.js" "src/components/TitleBar.hero.test.js"`

Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: PASS with all existing tests green.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: PASS

- [ ] **Step 4: Sanity-check the visual goals manually**

Open the app and verify:
- Analysis first screen reads as one decision and one proof surface.
- Upload page feels calmer, heavier, and less glassy.
- History page scans like an archive instead of a gallery.

- [ ] **Step 5: Commit**

```bash
git add src/views/Analysis.vue src/components/upload/UploadWorkbenchPage.vue src/components/TitleBar.vue src/views/History.vue
git commit -m "polish: tighten cinematic workbench surfaces"
```
