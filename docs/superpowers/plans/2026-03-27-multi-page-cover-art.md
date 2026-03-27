# Multi-Page Cover Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add page-specific cover art across the cinematic home workspace, compare page, and history page, with the approved Jordan `A / Echo Hero` treatment leading the home analysis workspace.

**Architecture:** Keep the route-level homepage hero unchanged, add a dedicated Jordan hero-art subcomponent for the existing home workspace header area, and add two lighter banner treatments directly inside the compare and history page files. Store all new artwork in worktree-local `public/hero/` assets and verify integration with focused static tests plus a build pass.

**Tech Stack:** Vue 3 SFCs, Vite public assets, scoped CSS, Node built-in test runner, Tauri/Vite desktop app build

---

## File Map

### Existing Files To Modify

- `public/hero/`
  - Add the approved image assets used by the new UI.
- `src/components/home/HomeWorkspace.vue`
  - Wire the new Jordan hero block into the existing header/module area.
  - Preserve `compact`, `focused-workspace`, and `loaded-upload-workspace` behavior.
- `src/views/Home.analysis-workspace.test.js`
  - Extend the static assertions that already guard the home workspace layout.
- `src/views/Compare.vue`
  - Add a shallow compare banner that uses `jordan-dunk.png`.
- `src/views/History.vue`
  - Add a shallow history banner that uses `the-shot.png`.

### New Files To Create

- `src/components/home/HomeWorkspaceHeroArt.vue`
  - Own the Jordan foreground figure, silhouette-shadow layer, and responsive state variants.
- `src/components/home/HomeWorkspaceHeroArt.test.js`
  - Lock the new component’s public asset references, props, and class structure.
- `src/views/Compare.banner.test.js`
  - Lock the compare page banner asset and top-of-page banner structure.
- `src/views/History.banner.test.js`
  - Lock the history page banner asset and top-of-page banner structure.

### Responsibility Boundaries

- `HomeWorkspaceHeroArt.vue` should stay purely presentational.
- `HomeWorkspace.vue` should continue owning workspace state and flow, but delegate figure-layer markup to the new subcomponent.
- `Compare.vue` and `History.vue` should keep their banner markup local for this pass; do not introduce a shared inner-page banner abstraction unless duplication becomes harmful during implementation.

## Task 1: Stage Jordan Hero Assets And Scaffold The Presentational Hero Component

**Files:**
- Create: `public/hero/jordan-logo-original.png`
- Create: `public/hero/jordan-logo-shadow.png`
- Create: `public/hero/jordan-dunk.png`
- Create: `public/hero/the-shot.png`
- Create: `src/components/home/HomeWorkspaceHeroArt.vue`
- Test: `src/components/home/HomeWorkspaceHeroArt.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/components/home/HomeWorkspaceHeroArt.test.js` with static assertions for the component shell:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./HomeWorkspaceHeroArt.vue', import.meta.url), 'utf8')

test('workspace hero art references the approved Jordan figure and silhouette assets', () => {
  assert.match(source, /jordan-logo-original\.png/)
  assert.match(source, /jordan-logo-shadow\.png/)
  assert.match(source, /workspace-hero-figure/)
  assert.match(source, /workspace-hero-shadow/)
})

test('workspace hero art exposes compact and focused variants for layout compression', () => {
  assert.match(source, /compact\?: boolean/)
  assert.match(source, /focused\?: boolean/)
  assert.match(source, /:class="\{ compact: props\.compact, focused: props\.focused \}"/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test src/components/home/HomeWorkspaceHeroArt.test.js
```

Expected:

- FAIL with `ENOENT` or a missing-match assertion because `HomeWorkspaceHeroArt.vue` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Copy all four approved assets into `public/hero/`, then create `src/components/home/HomeWorkspaceHeroArt.vue` with the minimal presentational shell:

```vue
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    compact?: boolean
    focused?: boolean
  }>(),
  {
    compact: false,
    focused: false
  }
)

const figureSrc = '/hero/jordan-logo-original.png'
const shadowSrc = '/hero/jordan-logo-shadow.png'
</script>

<template>
  <div class="workspace-hero-art" :class="{ compact: props.compact, focused: props.focused }" aria-hidden="true">
    <img :src="shadowSrc" alt="" class="workspace-hero-shadow" />
    <img :src="figureSrc" alt="" class="workspace-hero-figure" />
  </div>
</template>
```

Also add the first-pass CSS blocks for:

- `.workspace-hero-art`
- `.workspace-hero-shadow`
- `.workspace-hero-figure`

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --test src/components/home/HomeWorkspaceHeroArt.test.js
```

Expected:

- PASS for both static assertions.

Also verify the assets exist:

```powershell
@(
  'public/hero/jordan-logo-original.png',
  'public/hero/jordan-logo-shadow.png',
  'public/hero/jordan-dunk.png',
  'public/hero/the-shot.png'
) | ForEach-Object { Test-Path $_ }
```

Expected:

- `True`
- `True`
- `True`
- `True`

- [ ] **Step 5: Commit**

```powershell
git add public/hero/jordan-logo-original.png public/hero/jordan-logo-shadow.png public/hero/jordan-dunk.png public/hero/the-shot.png src/components/home/HomeWorkspaceHeroArt.vue src/components/home/HomeWorkspaceHeroArt.test.js
git commit -m "feat: scaffold jordan workspace hero art"
```

## Task 2: Wire The Echo Hero Into The Home Workspace Header Zone

**Files:**
- Modify: `src/components/home/HomeWorkspace.vue`
- Modify: `src/views/Home.analysis-workspace.test.js`
- Test: `src/components/home/HomeWorkspaceHeroArt.test.js`

- [ ] **Step 1: Write the failing test**

Extend `src/views/Home.analysis-workspace.test.js` with assertions that describe the integration shape:

```js
test('home workspace wraps the existing heading and module entry area in a Jordan hero shell', () => {
  assert.match(source, /import HomeWorkspaceHeroArt from '\@\/components\/home\/HomeWorkspaceHeroArt\.vue'/)
  assert.match(source, /class="analysis-hero-shell"/)
  assert.match(source, /class="analysis-hero-copy"/)
  assert.match(source, /<HomeWorkspaceHeroArt[\s\S]*:compact="isAnalysisWorkspace"[\s\S]*:focused="showUpload"/)
})

test('loaded upload workspace hides the hero shell with the rest of the landing chrome', () => {
  const loadedHeroBlock = source.match(/\.home-page\.loaded-upload-workspace \.analysis-hero-shell \{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(loadedHeroBlock, /display: none/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test src/views/Home.analysis-workspace.test.js
```

Expected:

- FAIL because `HomeWorkspace.vue` does not yet import or render the new hero shell.

- [ ] **Step 3: Write minimal implementation**

Modify `src/components/home/HomeWorkspace.vue` so the existing header and module nav live inside a single hero wrapper:

```vue
<section class="analysis-hero-shell" :class="{ compact: isAnalysisWorkspace, focused: showUpload }">
  <HomeWorkspaceHeroArt
    class="analysis-hero-art"
    :compact="isAnalysisWorkspace"
    :focused="showUpload"
  />

  <div class="analysis-hero-copy">
    <header class="home-header" :class="{ compact: isAnalysisWorkspace }">
      ...
    </header>

    <nav class="module-nav" :class="{ compact: isAnalysisWorkspace }" aria-label="home modules">
      ...
    </nav>
  </div>
</section>
```

Add first-pass CSS for:

- `.analysis-hero-shell`
- `.analysis-hero-copy`
- `.analysis-hero-art`
- `.home-page.loaded-upload-workspace .analysis-hero-shell`

Keep the existing `loaded-upload-workspace` rules for `.home-header` and `.module-nav` until the new shell is proven stable.

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --test src/views/Home.analysis-workspace.test.js
```

Expected:

- PASS for the new integration assertions.
- Existing workspace visual assertions still PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/home/HomeWorkspace.vue src/views/Home.analysis-workspace.test.js
git commit -m "feat: integrate jordan echo hero into home workspace"
```

## Task 3: Tune Compact, Focused, And Laptop-Safe Hero Behavior

**Files:**
- Modify: `src/components/home/HomeWorkspaceHeroArt.vue`
- Modify: `src/components/home/HomeWorkspaceHeroArt.test.js`
- Modify: `src/components/home/HomeWorkspace.vue`
- Modify: `src/views/Home.analysis-workspace.test.js`

- [ ] **Step 1: Write the failing test**

Extend the hero component test and the workspace test with the specific state-aware constraints from the spec:

```js
test('workspace hero art enlarges the silhouette beyond the foreground figure and softens it into an echo layer', () => {
  const shadowBlock = source.match(/\.workspace-hero-shadow \{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(shadowBlock, /opacity:\s*0\.(1|12|14|16|18)/)
  assert.match(shadowBlock, /filter:\s*blur/)
  assert.match(shadowBlock, /transform:\s*scale\(1\.(1|15|2|25|3)\)/)
})

test('focused upload mode keeps the hero visible but compresses its spacing', () => {
  const focusedHeroBlock = source.match(/\.home-page\.focused-workspace \.analysis-hero-shell \{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(focusedHeroBlock, /padding:/)
  assert.match(focusedHeroBlock, /min-height:/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test src/components/home/HomeWorkspaceHeroArt.test.js src/views/Home.analysis-workspace.test.js
```

Expected:

- FAIL because the detailed state styling and shadow tuning are not present yet.

- [ ] **Step 3: Write minimal implementation**

Refine the CSS so the hero reads like the approved `A / Echo Hero` direction:

```css
.workspace-hero-shadow {
  opacity: 0.14;
  transform: translate3d(-1.2rem, 0.4rem, 0) scale(1.22);
  filter: blur(2px) drop-shadow(0 24px 40px rgba(0, 0, 0, 0.42));
}

.home-page.focused-workspace .analysis-hero-shell {
  min-height: 220px;
  padding: 18px 20px 10px;
}

.home-page.focused-workspace .workspace-hero-shadow,
.analysis-hero-shell.compact .workspace-hero-shadow {
  opacity: 0.1;
}
```

Also add responsive rules that:

- scale the hero art down on narrow widths
- keep the figure clear of the title/toggle zone
- avoid pushing the upload entry below the fold on laptop-height layouts

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --test src/components/home/HomeWorkspaceHeroArt.test.js src/views/Home.analysis-workspace.test.js
```

Expected:

- PASS for the state/style assertions.
- No regressions in the existing home workspace tests.

- [ ] **Step 5: Commit**

```powershell
git add src/components/home/HomeWorkspaceHeroArt.vue src/components/home/HomeWorkspaceHeroArt.test.js src/components/home/HomeWorkspace.vue src/views/Home.analysis-workspace.test.js
git commit -m "feat: tune jordan hero states for compact workspace"
```

## Task 4: Add The Compare Page Banner

**Files:**
- Modify: `src/views/Compare.vue`
- Create: `src/views/Compare.banner.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/views/Compare.banner.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Compare.vue', import.meta.url), 'utf8')

test('compare page adds a top banner using the approved dunk artwork', () => {
  assert.match(source, /jordan-dunk\.png/)
  assert.match(source, /class="compare-hero-banner"/)
  assert.match(source, /class="compare-hero-art"/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test src/views/Compare.banner.test.js
```

Expected:

- FAIL because the compare page does not yet include the banner markup or asset.

- [ ] **Step 3: Write minimal implementation**

Modify `src/views/Compare.vue` to add a shallow banner above `.compare-content`:

```vue
<section class="compare-hero-banner">
  <div class="compare-hero-copy">
    <p class="compare-hero-kicker">Compare</p>
    <h1 class="page-title">球星姿势对比</h1>
  </div>
  <img src="/hero/jordan-dunk.png" alt="" class="compare-hero-art" />
</section>
```

Add banner styles that:

- keep the banner shallower than the home workspace hero
- integrate the back button and title into the banner zone
- avoid disturbing `ComparisonView`

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --test src/views/Compare.banner.test.js
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/views/Compare.vue src/views/Compare.banner.test.js
git commit -m "feat: add compare page cover banner"
```

## Task 5: Add The History Page Banner

**Files:**
- Modify: `src/views/History.vue`
- Create: `src/views/History.banner.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/views/History.banner.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./History.vue', import.meta.url), 'utf8')

test('history page adds a top banner using the approved archival artwork', () => {
  assert.match(source, /the-shot\.png/)
  assert.match(source, /class="history-hero-banner"/)
  assert.match(source, /class="history-hero-art"/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test src/views/History.banner.test.js
```

Expected:

- FAIL because the history page does not yet include the banner markup or asset.

- [ ] **Step 3: Write minimal implementation**

Modify `src/views/History.vue` to add a calmer banner above `.history-content`:

```vue
<section class="history-hero-banner">
  <div class="history-hero-copy">
    <p class="history-hero-kicker">History</p>
    <h1 class="page-title">历史记录</h1>
  </div>
  <img src="/hero/the-shot.png" alt="" class="history-hero-art" />
</section>
```

Add styles that:

- keep the banner darker and calmer than compare
- preserve the history grid/list as the primary payload below
- avoid excessive vertical height

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --test src/views/History.banner.test.js
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/views/History.vue src/views/History.banner.test.js
git commit -m "feat: add history page cover banner"
```

## Task 6: Run Full Verification And Final Cleanup

**Files:**
- Verify: `src/components/home/HomeWorkspaceHeroArt.test.js`
- Verify: `src/views/Home.analysis-workspace.test.js`
- Verify: `src/views/Compare.banner.test.js`
- Verify: `src/views/History.banner.test.js`
- Verify: `src/components/home/CinematicHeroStage.test.js`
- Verify: `src/views/Home.hero-workspace.test.js`

- [ ] **Step 1: Run the targeted cover-art regression tests**

Run:

```powershell
node --test src/components/home/HomeWorkspaceHeroArt.test.js src/views/Home.analysis-workspace.test.js src/views/Compare.banner.test.js src/views/History.banner.test.js src/components/home/CinematicHeroStage.test.js src/views/Home.hero-workspace.test.js
```

Expected:

- PASS for all targeted cover-art and home-regression tests.

- [ ] **Step 2: Run the full JavaScript test suite**

Run:

```powershell
npm test
```

Expected:

- PASS for the repo’s current `src/**/*.test.js` suite.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected:

- PASS with a successful Vite build and no missing asset-path errors.

- [ ] **Step 4: Fix any verification failures with the smallest responsible change**

If any command fails:

- update only the affected Vue/test file
- rerun only the failing command first
- then rerun the full verification chain above

- [ ] **Step 5: Commit only if Step 4 required follow-up fixes**

```powershell
git add public/hero src/components/home/HomeWorkspace.vue src/components/home/HomeWorkspaceHeroArt.vue src/components/home/HomeWorkspaceHeroArt.test.js src/views/Home.analysis-workspace.test.js src/views/Compare.vue src/views/Compare.banner.test.js src/views/History.vue src/views/History.banner.test.js
git commit -m "fix: resolve cover art verification regressions"
```

If Step 4 made no code changes, skip this commit and leave the task with the earlier feature commits intact.

## Notes For Implementers

- Keep the standalone `/analysis` route untouched in this pass unless verification exposes a shared style regression.
- Do not move business logic out of `HomeWorkspace.vue`; only move the new figure/silhouette presentation into the dedicated subcomponent.
- If the compare/history banner markup starts to duplicate heavily, note it during implementation, but do not invent a shared component unless the duplication becomes materially harmful.
