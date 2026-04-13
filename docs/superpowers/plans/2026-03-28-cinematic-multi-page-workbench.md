# Cinematic Multi-Page Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current single-page cinematic home/workspace flow into a dedicated cover homepage plus a pure `/upload` workbench, connected by a film-like fog transition.

**Architecture:** Move route-entry motion up into the app shell, keep the homepage focused on brand and CTA only, extract upload functionality into a dedicated `/upload` page, and progressively retire the old scroll-snap workspace behavior. Inner pages should consume page-specific cover art through subdued atmospheric layers rather than hero-style content blocks.

**Tech Stack:** Vue 3 SFCs, Vue Router 4, Pinia, Vite public assets, scoped CSS, Node built-in test runner, Tauri/Vite desktop app build

---

## File Map

### Existing Files To Modify

- `src/App.vue`
  - Host the route-level fog transition shell and route presentation classes.
- `src/router/index.ts`
  - Add the new `/upload` route and route metadata required for page identity.
- `src/views/Home.vue`
  - Strip the page down to a cover-only experience and trigger route navigation instead of in-page workspace scrolling.
- `src/components/home/HeroCopyBlock.vue`
  - Keep the existing CTA event contract stable while allowing the home page to hand off into film navigation.
- `src/components/home/CinematicHeroStage.vue`
  - Tune homepage-only artwork usage if the new cover-only composition needs simplified props or state.
- `src/components/home/HomeWorkspace.vue`
  - Extract or retire upload-specific layout responsibilities that should move to the `/upload` route.
- `src/components/VideoUpload/index.vue`
  - Integrate into the new workbench surface without depending on homepage-specific wrappers.
- `src/views/Analysis.vue`
  - Apply the new atmospheric background system and begin the conclusion-first inner-page layout.
- `src/views/History.vue`
  - Apply the calmer archival background system and keep the history list primary.
- `src/views/Home.hero-workspace.test.js`
  - Replace single-page scroll/workspace assertions with cover-page and route-transition assertions.
- `src/views/Home.analysis-workspace.test.js`
  - Remove assertions that only make sense while the home route owns the upload workbench.
- `src/views/History.banner.test.js`
  - Update history assertions to match the new inner-page atmosphere contract if needed.

### New Files To Create

- `src/composables/useFogRouteTransition.ts`
  - Own the transition state machine and route-handoff timing.
- `src/composables/useFogRouteTransition.test.js`
  - Lock the public shape of the transition composable.
- `src/components/transition/FogRouteTransition.vue`
  - Render the full-screen fog overlay and phase classes.
- `src/components/transition/FogRouteTransition.test.js`
  - Lock the fog shell structure and reduced-motion branch.
- `src/views/Upload.vue`
  - New route-level pure workbench upload page.
- `src/views/Upload.workbench.test.js`
  - Lock the upload page structure, route purpose, and action visibility scaffolding.
- `src/components/upload/UploadWorkbenchPage.vue`
  - Present the upload workbench layout, atmospheric background, and stable action area.
- `src/components/upload/UploadWorkbenchPage.test.js`
  - Lock the workbench section structure and the removal of old homepage chrome.
- `src/lib/page-cover-art.ts`
  - Centralize route-to-cover-art assignments and avoid hard-coded strings drifting across pages.
- `src/lib/page-cover-art.test.js`
  - Lock the approved cover-art mapping.
- `src/views/Analysis.page-layout.test.js`
  - Guard the conclusion-first analysis layout once introduced.

### Assets To Stage

- `public/hero/jordan-logo-home.png`
- `public/hero/luka2-upload.png`
- `public/hero/jordan-shot-analysis.png`
- `public/hero/the-shot-history.png`

If duplicate assets already exist under different names, keep the set minimal and choose one stable naming scheme instead of alias sprawl.

### Responsibility Boundaries

- `Home.vue` should stop owning upload workflow state.
- `Upload.vue` should become the only route responsible for media-entry work.
- `useFogRouteTransition.ts` should own timing/phase orchestration; `App.vue` should only render the shell.
- `page-cover-art.ts` should be the only source of truth for route-specific artwork selection.
- `Analysis.vue` and `History.vue` should share the same background-art rules, but not necessarily the same full component abstraction in the first pass.

## Task 1: Introduce The Route-Level Fog Transition Infrastructure

**Files:**
- Create: `src/composables/useFogRouteTransition.ts`
- Create: `src/composables/useFogRouteTransition.test.js`
- Create: `src/components/transition/FogRouteTransition.vue`
- Create: `src/components/transition/FogRouteTransition.test.js`
- Modify: `src/App.vue`

- [ ] **Step 1: Write the failing tests**

Create `src/composables/useFogRouteTransition.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./useFogRouteTransition.ts', import.meta.url), 'utf8')

test('fog transition composable exposes route-entry phases and a navigate helper', () => {
  assert.match(source, /phase/)
  assert.match(source, /isActive/)
  assert.match(source, /navigateWithFogTransition/)
  assert.match(source, /prefersReducedMotion/)
})
```

Create `src/components/transition/FogRouteTransition.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./FogRouteTransition.vue', import.meta.url), 'utf8')

test('fog route transition renders overlay layers and reduced-motion class handling', () => {
  assert.match(source, /fog-route-transition/)
  assert.match(source, /fog-route-transition__veil/)
  assert.match(source, /fog-route-transition__mist/)
  assert.match(source, /reduced-motion/)
})
```

Also extend `src/App.copy-guard.test.js` or create a dedicated `src/App.route-film-transition.test.js` with:

```js
test('app shell mounts the fog route transition above the router view', () => {
  assert.match(source, /FogRouteTransition/)
  assert.match(source, /<FogRouteTransition/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test src/composables/useFogRouteTransition.test.js src/components/transition/FogRouteTransition.test.js src/App.route-film-transition.test.js
```

Expected:

- FAIL because the composable, overlay component, and app integration do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `useFogRouteTransition.ts` with a small reactive singleton:

```ts
type FogTransitionPhase = 'idle' | 'defocus' | 'veil' | 'reveal'
```

Expose:

- `phase`
- `isActive`
- `prefersReducedMotion`
- `navigateWithFogTransition(router, to)`

Create `FogRouteTransition.vue` with:

- one root overlay
- at least two visual layers
- route-phase classes
- reduced-motion branch classes

Modify `App.vue` to import and render the overlay above `<router-view />`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test src/composables/useFogRouteTransition.test.js src/components/transition/FogRouteTransition.test.js src/App.route-film-transition.test.js
```

Then run:

```powershell
npm test
```

Expected:

- the new transition tests PASS
- no unrelated existing tests regress

- [ ] **Step 5: Commit**

```powershell
git add src/composables/useFogRouteTransition.ts src/composables/useFogRouteTransition.test.js src/components/transition/FogRouteTransition.vue src/components/transition/FogRouteTransition.test.js src/App.vue src/App.route-film-transition.test.js
git commit -m "feat: add fog route transition shell"
```

## Task 2: Add The Dedicated `/upload` Route And The Workbench Page Scaffold

**Files:**
- Modify: `src/router/index.ts`
- Create: `src/views/Upload.vue`
- Create: `src/views/Upload.workbench.test.js`
- Create: `src/components/upload/UploadWorkbenchPage.vue`
- Create: `src/components/upload/UploadWorkbenchPage.test.js`
- Create: `src/lib/page-cover-art.ts`
- Create: `src/lib/page-cover-art.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/page-cover-art.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./page-cover-art.ts', import.meta.url), 'utf8')

test('page cover art maps upload, analysis, and history to the approved assets', () => {
  assert.match(source, /upload: '\/hero\/luka2-upload\.png'/)
  assert.match(source, /analysis: '\/hero\/jordan-shot-analysis\.png'/)
  assert.match(source, /history: '\/hero\/the-shot-history\.png'/)
})
```

Create `src/views/Upload.workbench.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Upload.vue', import.meta.url), 'utf8')

test('upload route renders a dedicated workbench page instead of homepage chrome', () => {
  assert.match(source, /UploadWorkbenchPage/)
  assert.doesNotMatch(source, /HomeWorkspace/)
})
```

Extend `src/router/index.ts` assertions with:

```js
assert.match(source, /path: '\/upload'/)
assert.match(source, /name: 'Upload'/)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test src/lib/page-cover-art.test.js src/views/Upload.workbench.test.js
```

Expected:

- FAIL because the mapping module and upload route/page do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `page-cover-art.ts`:

```ts
export const PAGE_COVER_ART = {
  home: '/hero/jordan-logo-home.png',
  upload: '/hero/luka2-upload.png',
  analysis: '/hero/jordan-shot-analysis.png',
  history: '/hero/the-shot-history.png'
} as const
```

Create `UploadWorkbenchPage.vue` with the first-pass section skeleton:

- top utility bar
- upload mode switch area
- workbench body
- stable action area

Create `Upload.vue` as the route wrapper that uses `UploadWorkbenchPage`.

Modify `src/router/index.ts` to add:

```ts
{
  path: '/upload',
  name: 'Upload',
  component: () => import('@/views/Upload.vue'),
  meta: { title: '上传分析', workbenchPage: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test src/lib/page-cover-art.test.js src/views/Upload.workbench.test.js src/components/upload/UploadWorkbenchPage.test.js
npm test
```

Expected:

- the new route and workbench tests PASS
- the router continues to build cleanly in static tests

- [ ] **Step 5: Commit**

```powershell
git add src/router/index.ts src/views/Upload.vue src/views/Upload.workbench.test.js src/components/upload/UploadWorkbenchPage.vue src/components/upload/UploadWorkbenchPage.test.js src/lib/page-cover-art.ts src/lib/page-cover-art.test.js
git commit -m "feat: scaffold dedicated upload workbench route"
```

## Task 3: Simplify Home Into A Cover-Only Entry Page

**Files:**
- Modify: `src/views/Home.vue`
- Modify: `src/components/home/HeroCopyBlock.vue`
- Modify: `src/components/home/CinematicHeroStage.vue`
- Modify: `src/views/Home.hero-workspace.test.js`

- [ ] **Step 1: Write the failing test**

Replace the old single-page expectations in `src/views/Home.hero-workspace.test.js` with:

```js
test('home route is a cover-only page that no longer mounts the upload workspace', () => {
  assert.doesNotMatch(source, /HomeWorkspace/)
  assert.doesNotMatch(source, /getHomeScrollSnapTarget/)
  assert.doesNotMatch(source, /scrollWorkspaceIntoView/)
})

test('home route sends the CTA through fog navigation into /upload', () => {
  assert.match(source, /useRouter/)
  assert.match(source, /navigateWithFogTransition/)
  assert.match(source, /['"]\/upload['"]/)
  assert.match(source, /@start="handleStartAnalysis"/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test src/views/Home.hero-workspace.test.js
```

Expected:

- FAIL because the home page still owns workspace/scroll logic.

- [ ] **Step 3: Write the minimal implementation**

Refactor `Home.vue` so it only renders:

- `CinematicHeroStage`
- `HeroCopyBlock`

Replace `enterWorkspace()` with:

```ts
const handleStartAnalysis = async () => {
  await navigateWithFogTransition(router, '/upload')
}
```

Delete or stop importing:

- `HomeWorkspace`
- scroll-container listeners
- snap timers
- workspace lock state
- old `home-hero-state` dependencies that only served the single-page mode

Keep the cinematic homepage visuals, but make them static cover behavior instead of a lower-section reveal.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test src/views/Home.hero-workspace.test.js
npm test
```

Expected:

- home route tests PASS with the new cover-only assertions
- no remaining tests depend on the removed workspace behavior

- [ ] **Step 5: Commit**

```powershell
git add src/views/Home.vue src/components/home/HeroCopyBlock.vue src/components/home/CinematicHeroStage.vue src/views/Home.hero-workspace.test.js
git commit -m "refactor: make home a cinematic cover entry page"
```

## Task 4: Move Upload Workflow Ownership Out Of Home And Into The New Workbench

**Files:**
- Modify: `src/components/home/HomeWorkspace.vue`
- Modify: `src/components/VideoUpload/index.vue`
- Modify: `src/components/upload/UploadWorkbenchPage.vue`
- Modify: `src/components/upload/UploadWorkbenchPage.test.js`
- Modify: `src/views/Home.analysis-workspace.test.js`

- [ ] **Step 1: Write the failing tests**

Add assertions to `src/components/upload/UploadWorkbenchPage.test.js`:

```js
test('upload workbench exposes a compact utility bar, media switcher, editor surface, and stable action area', () => {
  assert.match(source, /upload-workbench__topbar/)
  assert.match(source, /upload-workbench__switcher/)
  assert.match(source, /upload-workbench__surface/)
  assert.match(source, /upload-workbench__actions/)
})

test('upload workbench does not render homepage feature-card navigation', () => {
  assert.doesNotMatch(source, /上传素材/)
  assert.doesNotMatch(source, /姿势分析/)
  assert.doesNotMatch(source, /球星对比/)
  assert.doesNotMatch(source, /矫正建议/)
})
```

Replace obsolete expectations in `src/views/Home.analysis-workspace.test.js` with a narrow regression guard:

```js
test('legacy home workspace no longer owns the upload route surface', () => {
  assert.doesNotMatch(source, /loaded-upload-workspace/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test src/components/upload/UploadWorkbenchPage.test.js src/views/Home.analysis-workspace.test.js
```

Expected:

- FAIL because the workbench structure and home cleanup are not complete yet.

- [ ] **Step 3: Write the minimal implementation**

Move upload-specific layout out of `HomeWorkspace.vue` and into `UploadWorkbenchPage.vue`.

At minimum the new upload workbench should include:

- compact page title + one-line helper copy
- image/video switcher
- media upload/editor surface
- loaded-video trim surface
- stable primary actions visible in the default desktop window

Use `VideoUpload/index.vue` as the editor payload instead of rebuilding trim behavior.

If `HomeWorkspace.vue` becomes dead after extraction, remove its usage and keep only the pieces still required elsewhere.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test src/components/upload/UploadWorkbenchPage.test.js src/views/Home.analysis-workspace.test.js
npm test
npm run build
```

Expected:

- upload workbench structure tests PASS
- the app still builds after the ownership move

- [ ] **Step 5: Commit**

```powershell
git add src/components/home/HomeWorkspace.vue src/components/VideoUpload/index.vue src/components/upload/UploadWorkbenchPage.vue src/components/upload/UploadWorkbenchPage.test.js src/views/Home.analysis-workspace.test.js
git commit -m "refactor: move upload workflow into dedicated workbench page"
```

## Task 5: Apply The Atmospheric Inner-Page Cover System

**Files:**
- Modify: `src/views/Upload.vue`
- Modify: `src/views/Analysis.vue`
- Modify: `src/views/History.vue`
- Modify: `src/views/History.banner.test.js`
- Create: `src/views/Analysis.page-layout.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/views/Analysis.page-layout.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Analysis.vue', import.meta.url), 'utf8')

test('analysis page opens with a conclusion-first layout and atmospheric background art', () => {
  assert.match(source, /analysis-page__summary/)
  assert.match(source, /analysis-page__stage/)
  assert.match(source, /analysis-page__diagnosis/)
  assert.match(source, /jordan-shot-analysis\.png/)
})
```

Extend `src/views/History.banner.test.js` so it guards:

- calm header/banner structure
- use of `the-shot-history.png`
- no oversized poster treatment

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test src/views/Analysis.page-layout.test.js src/views/History.banner.test.js
```

Expected:

- FAIL because the new atmosphere contract is not in place yet.

- [ ] **Step 3: Write the minimal implementation**

Update `/upload`, `/analysis`, and `/history` to use the same inner-page background rules:

- route-specific cover image from `PAGE_COVER_ART`
- strong dark overlay
- fog/soft-light treatment
- no hero-sized text block inside the workbench

Reshape `Analysis.vue` so the first visible section is a short conclusion strip rather than a tab-first control cluster.

Keep `History.vue` calmer and more archival; preserve existing list functionality while reducing banner dominance.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test src/views/Analysis.page-layout.test.js src/views/History.banner.test.js src/views/Upload.workbench.test.js
npm test
npm run build
```

Expected:

- all three route-level presentation tests PASS
- the project still builds cleanly

- [ ] **Step 5: Commit**

```powershell
git add src/views/Upload.vue src/views/Analysis.vue src/views/History.vue src/views/History.banner.test.js src/views/Analysis.page-layout.test.js
git commit -m "feat: add atmospheric workbench treatments to inner pages"
```

## Task 6: Remove Obsolete Single-Page Home Workspace Infrastructure

**Files:**
- Modify: `src/lib/home-hero-state.js`
- Modify: `src/lib/home-hero-state.d.ts`
- Modify: `src/lib/home-hero-state.test.js`
- Modify: `src/views/Home.vue`
- Modify: any dead imports exposed by the upload extraction

- [ ] **Step 1: Write the failing test**

Update `src/lib/home-hero-state.test.js` so it only guards behavior that still matters for the cover homepage, for example:

```js
test('home hero state no longer computes workspace snap targets', () => {
  assert.doesNotMatch(source, /getHomeScrollSnapTarget/)
  assert.doesNotMatch(source, /workspaceThreshold/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test src/lib/home-hero-state.test.js
```

Expected:

- FAIL because the old helpers are still present.

- [ ] **Step 3: Write the minimal implementation**

Delete or simplify the old home-workspace scroll helpers that no longer have runtime callers.

Retain only helpers still needed for:

- reduced-motion-aware homepage presentation
- any remaining cinematic hero copy/stage state

Also remove dead CSS, refs, and event handlers left behind in `Home.vue`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test src/lib/home-hero-state.test.js
npm test
npm run build
```

Expected:

- old single-page helper tests PASS in their reduced form
- no dead imports remain
- build still passes

- [ ] **Step 5: Commit**

```powershell
git add src/lib/home-hero-state.js src/lib/home-hero-state.d.ts src/lib/home-hero-state.test.js src/views/Home.vue
git commit -m "refactor: remove obsolete single-page home workspace logic"
```

## Final Verification

- [ ] Run the full automated suite:

```powershell
npm test
npm run build
```

Expected:

- all static tests PASS
- Vite build PASSes

- [ ] Manually verify these user flows in the desktop app:

1. Open app -> homepage is cover-only.
2. Click `开始分析` -> fog transition plays once -> land on `/upload`.
3. Default window height shows upload controls and primary actions without extra scrolling.
4. Select a video -> trim/edit workflow remains stable and no homepage chrome reappears.
5. Enter `/history` -> calmer archival page with subdued background art.
6. Enter `/analysis` -> conclusion-first structure and background atmosphere remain readable.

- [ ] If all checks pass, create the closing commit:

```powershell
git add src/App.vue src/router/index.ts src/views/Home.vue src/views/Upload.vue src/views/Analysis.vue src/views/History.vue src/components/transition/FogRouteTransition.vue src/composables/useFogRouteTransition.ts src/components/upload/UploadWorkbenchPage.vue src/lib/page-cover-art.ts
git commit -m "feat: ship cinematic multi-page workbench flow"
```
