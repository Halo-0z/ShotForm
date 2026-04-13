# Cinematic UI System Renewal Implementation Plan

> Status: completed
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the `codex/cinematic-home-ui` worktree into one coherent product family while preserving the current route structure and page responsibilities.

**Architecture:** Keep the existing cover-to-workbench route model, then renew the product in layers. First lock shared tokens and UI primitives to the approved design system, then rebuild the workbench pages route-by-route, and finally trim residual mixed-responsibility UI so Home remains a cover and inner pages remain tools. Follow @test-driven-development discipline and finish each task with verification before the next task begins.

**Tech Stack:** Vue 3 SFCs, Vue Router 4, Pinia, Vite, scoped CSS, class-variance-authority, Node built-in test runner, Playwright render checks, Tauri desktop shell

---

## File Map

### Existing Files To Modify

- `AGENTS.md`
  - Persist project-specific design context for future agents.
- `.impeccable.md`
  - Keep design context aligned with `DESIGN.md` if future edits refine the system.
- `src/assets/index.css`
  - Replace remaining mixed visual language with the approved dual-system token set.
- `src/components/ui/button/index.ts`
  - Align button variants with workbench-first hierarchy and evidence accent rules.
- `src/components/ui/badge/index.ts`
  - Tighten badge roles so semantic and evidence states stay distinct.
- `src/components/ui/progress/Progress.vue`
  - Make progress bars read as measured output instead of decorative fill.
- `src/components/TitleBar.vue`
  - Normalize chrome so immersive and workbench routes feel like one product family.
- `src/views/Home.vue`
  - Preserve the cover-only route and strengthen its role as the opening shot.
- `src/components/home/CinematicHeroStage.vue`
  - Reduce any remaining interface noise inside the cover stage.
- `src/components/home/HeroCopyBlock.vue`
  - Tighten cover typography, CTA hierarchy, and copy staging.
- `src/views/Upload.vue`
  - Rebuild page shell materials and spacing under the workbench system.
- `src/components/upload/UploadWorkbenchPage.vue`
  - Clarify workbench structure, hierarchy, and status regions.
- `src/components/VideoUpload/index.vue`
  - Align the embedded upload surface with the new matte workbench language.
- `src/views/Analysis.vue`
  - Reorder emphasis around conclusion first, evidence second, detail third.
- `src/components/VideoPosePlayback.vue`
  - Match playback chrome and frame emphasis to the renewed analysis workbench.
- `src/views/History.vue`
  - Turn history from banner-led page styling into an archive-first workbench.
- `src/views/Compare.vue`
  - Turn compare from a themed page into an analysis-adjacent workbench.
- `src/lib/page-cover-art.ts`
  - Keep only the page-atmosphere mapping that still serves the renewed system.
- `src/components/home/HomeWorkspace.vue`
  - Remove or reduce stale responsibilities if this file still carries dormant mixed-purpose UI.

### Existing Tests To Modify

- `src/components/ui/button/button-variants.test.js`
- `src/components/VideoUpload/VideoUpload.theming.test.js`
- `src/views/Home.hero-workspace.test.js`
- `src/views/Upload.workbench.test.js`
- `src/components/upload/UploadWorkbenchPage.test.js`
- `src/components/upload/UploadWorkbenchPage.materials.test.js`
- `src/views/Analysis.page-layout.test.js`
- `src/views/Analysis.visual-priority.test.js`
- `src/views/Analysis.video-workbench.test.js`
- `src/views/History.banner.test.js`
- `src/views/History.archive-layout.test.js`
- `src/views/Compare.banner.test.js`

### New Tests To Create

- `src/assets/design-tokens-renewal.test.js`
  - Lock the approved design token roles and anti-purple constraints.
- `src/views/Compare.workbench-layout.test.js`
  - Guard compare as a workbench page instead of a banner page.
- `src/components/TitleBar.workbench-theme.test.js`
  - Guard chrome behavior across immersive and workbench routes.

### Responsibility Boundaries

- `Home.vue` stays a cover route and must not regain upload-workbench responsibilities.
- `Upload.vue` remains the only media-entry route.
- `Analysis.vue`, `History.vue`, and `Compare.vue` must share the workbench family but keep distinct jobs.
- Shared UI primitives should carry the design system so pages stop hardcoding one-off visual decisions.
- If `HomeWorkspace.vue` is no longer a primary route component, do not keep adding visual rules there.

## Task 1: Lock The Shared Token System And Primitive Variants

**Files:**
- Create: `src/assets/design-tokens-renewal.test.js`
- Modify: `src/assets/index.css`
- Modify: `src/components/ui/button/index.ts`
- Modify: `src/components/ui/badge/index.ts`
- Modify: `src/components/ui/progress/Progress.vue`
- Modify: `src/components/ui/button/button-variants.test.js`

- [x] **Step 1: Write the failing tests**

Create `src/assets/design-tokens-renewal.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

test('design token renewal defines the approved interaction and evidence colors', () => {
  assert.match(source, /--primary-color:\s*#5D7396/i)
  assert.match(source, /--accent-color:\s*#C9823D/i)
  assert.match(source, /--bg-solid:\s*#F3EEE6/i)
})

test('design token renewal removes purple-dominant structure colors', () => {
  assert.doesNotMatch(source, /#6366F1/i)
  assert.doesNotMatch(source, /#8B5CF6/i)
})
```

Extend `src/components/ui/button/button-variants.test.js` to assert:

- `default` and `secondary` remain neutral/workbench variants
- `segmented-active` uses interaction color
- evidence-oriented variants do not become the default button language

- [x] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test "src/assets/design-tokens-renewal.test.js" "src/components/ui/button/button-variants.test.js"
```

Expected:

- FAIL because the current token file and primitive variants still reflect the older mixed aesthetic

- [x] **Step 3: Implement the minimal shared-system renewal**

Update `src/assets/index.css` so the root theme explicitly encodes:

- workbench neutrals built around warm bone, soft sand, paper mist, charcoal steel
- interaction blue separated from evidence copper
- calmer shadows and lower glass intensity
- shared typography roles that reserve display fonts mainly for Home

Update `src/components/ui/button/index.ts` so:

- `default` becomes the main workbench CTA
- `secondary` and `outline` become quieter structural controls
- `segmented-active` reads as selected tool state
- `upload-cta` can remain stronger than ordinary controls without becoming a generic glowing hero button

Update `src/components/ui/badge/index.ts` so:

- semantic colors stay semantic
- evidence and quality badges no longer inherit generic accent usage

Update `src/components/ui/progress/Progress.vue` so:

- the track reads as a measured surface
- the fill is clean and role-driven
- the component does not look ornamental

- [x] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test "src/assets/design-tokens-renewal.test.js" "src/components/ui/button/button-variants.test.js"
```

Then run:

```powershell
npm test
```

Expected:

- the new token and primitive tests PASS
- no existing source-inspection tests regress

- [x] **Step 5: Commit**

```powershell
git add src/assets/index.css src/assets/design-tokens-renewal.test.js src/components/ui/button/index.ts src/components/ui/badge/index.ts src/components/ui/progress/Progress.vue src/components/ui/button/button-variants.test.js
git commit -m "feat: renew shared design tokens and primitive variants"
```

## Task 2: Normalize Shared Chrome And The Home Cover

**Files:**
- Modify: `src/App.vue`
- Create: `src/components/TitleBar.workbench-theme.test.js`
- Modify: `src/components/TitleBar.vue`
- Modify: `src/views/Home.vue`
- Modify: `src/components/home/CinematicHeroStage.vue`
- Modify: `src/components/home/CinematicHeroStage.test.js`
- Modify: `src/components/home/HeroCopyBlock.vue`
- Modify: `src/components/home/HeroCopyBlock.test.js`
- Modify: `src/lib/home-hero-state.js`
- Modify: `src/lib/home-hero-state.d.ts`
- Modify: `src/lib/home-hero-state.test.js`
- Modify: `src/views/Home.hero-workspace.test.js`

- [x] **Step 1: Write the failing tests**

Create `src/components/TitleBar.workbench-theme.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./TitleBar.vue', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../../App.vue', import.meta.url), 'utf8')

test('title bar keeps immersive and workbench chrome visually distinct but related', () => {
  assert.match(appSource, /workbenchPage/)
  assert.match(appSource, /<TitleBar[\s\S]*:workbench=/)
  assert.match(source, /workbench\?: boolean/)
  assert.match(source, /immersive-light/)
  assert.match(source, /\.titlebar\.workbench/)
  assert.match(source, /props\.workbench/)
})
```

Update `src/views/Home.hero-workspace.test.js` to assert:

- Home still routes users toward `/upload`
- Home does not render upload-workbench-specific structure
- cover copy and CTA remain dominant

Update `src/components/home/CinematicHeroStage.test.js` and `src/lib/home-hero-state.test.js` so they stop locking multi-slide rotation, figure-swap, and workspace-handoff plumbing if those are removed during the single-cover cleanup.

- [x] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test "src/components/TitleBar.workbench-theme.test.js" "src/views/Home.hero-workspace.test.js"
```

Expected:

- FAIL because the tests will ask for renewed chrome and stricter cover-only hierarchy

- [x] **Step 3: Implement the cover-and-chrome cleanup**

Adjust `src/components/TitleBar.vue` so:

- immersive chrome and workbench chrome clearly belong to one system
- workbench intent is passed explicitly from route metadata instead of being inferred from `!immersive`
- workbench states become calmer and less decorative
- utility controls read like desktop instrumentation, not hero embellishments

Adjust `src/App.vue`, `src/views/Home.vue`, `src/components/home/CinematicHeroStage.vue`, and `src/components/home/HeroCopyBlock.vue` so:

- Home becomes an even cleaner opening shot
- hero typography is tighter and more intentional
- supporting copy stays sparse
- the primary CTA is visually dominant
- no residual workbench cues dilute the cover moment
- remove stale multi-slide or workspace-handoff plumbing from the home-cover path if it is no longer needed for the approved single-cover experience
- trim dead cover-motion API such as unused `return` state if the current Home flow no longer drives it

- [x] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test "src/components/TitleBar.workbench-theme.test.js" "src/views/Home.hero-workspace.test.js"
```

Then run:

```powershell
npm test
```

Expected:

- chrome and home-cover tests PASS
- prior homepage route expectations remain stable

- [x] **Step 5: Commit**

```powershell
git add src/App.vue src/components/TitleBar.vue src/components/TitleBar.workbench-theme.test.js src/views/Home.vue src/components/home/CinematicHeroStage.vue src/components/home/CinematicHeroStage.test.js src/components/home/HeroCopyBlock.vue src/components/home/HeroCopyBlock.test.js src/lib/home-hero-state.js src/lib/home-hero-state.d.ts src/lib/home-hero-state.test.js src/views/Home.hero-workspace.test.js
git commit -m "feat: refine home cover and shared chrome"
```

## Task 3: Rebuild Upload As A Clear Premium Workbench

**Files:**
- Modify: `src/views/Upload.vue`
- Modify: `src/components/upload/UploadWorkbenchPage.vue`
- Modify: `src/components/ImageUpload/index.vue`
- Create: `src/components/ImageUpload/ImageUpload.browser-runtime.test.js`
- Modify: `src/components/VideoUpload/index.vue`
- Create: `src/components/ImageUpload/ImageUpload.theming.test.js`
- Modify: `src/components/VideoUpload/VideoUpload.theming.test.js`
- Modify: `src/components/VideoUpload/VideoUpload.trim-ui.test.js`
- Create: `src/components/VideoUpload/VideoUpload.browser-runtime.test.js`
- Modify: `src/views/Upload.workbench.test.js`
- Modify: `src/components/upload/UploadWorkbenchPage.test.js`
- Modify: `src/components/upload/UploadWorkbenchPage.materials.test.js`

- [x] **Step 1: Write the failing tests**

Extend `src/views/Upload.workbench.test.js` to assert:

- Upload presents one obvious primary task region
- route-level atmosphere does not overpower the content surface
- Home and History actions remain visible but secondary

Create or extend `src/components/ImageUpload/ImageUpload.theming.test.js` to assert:

- image-mode drop zone, preview surface, helper pill, and crop dialog use neutral workbench surfaces
- image-mode UI no longer depends on bright glass or `backdrop-blur-sm`

Create `src/components/ImageUpload/ImageUpload.browser-runtime.test.js` to assert:

- browser mode has a non-Tauri crop path or explicit browser-safe crop fallback
- image preview mode does not promise browser crop while still hard-depending on `invoke(...)`

Extend `src/components/VideoUpload/VideoUpload.theming.test.js` to assert:

- empty state surfaces use neutral tokens
- upload panels no longer depend on bright glass treatment
- loaded video workspace does not rely on a stacked glass `Card` shell inside the neutral workbench surface

Update `src/components/VideoUpload/VideoUpload.trim-ui.test.js` and create `src/components/VideoUpload/VideoUpload.browser-runtime.test.js` to assert:

- browser-selected files can enter the loaded video workspace without a native desktop file path
- browser preview mode still allows trim and preview interactions before desktop-only analysis handoff
- legacy glass-shell assertions are removed rather than satisfied by sentinel comments

Extend `src/components/upload/UploadWorkbenchPage.test.js` and `src/components/upload/UploadWorkbenchPage.materials.test.js` to assert:

- mode switch, main surface, and status rail form one coherent workbench
- ordinary layout regions use neutral structural surfaces
- the page avoids stacked decorative glass shells

- [x] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test "src/views/Upload.workbench.test.js" "src/components/VideoUpload/VideoUpload.theming.test.js" "src/components/upload/UploadWorkbenchPage.test.js" "src/components/upload/UploadWorkbenchPage.materials.test.js"
```

Expected:

- FAIL because the current upload shell still carries too much decorative framing

- [x] **Step 3: Implement the upload workbench renewal**

Adjust `src/views/Upload.vue` so:

- the background atmosphere is quieter
- cover art remains atmospheric only
- content reveal stays smooth without feeling theatrical after the first impression

Adjust `src/components/upload/UploadWorkbenchPage.vue` so:

- the main upload region becomes the strongest surface
- rail actions read as utility controls
- explanatory text becomes shorter and more operational
- mode switching reads as a precise tool choice

Adjust `src/components/ImageUpload/index.vue` so:

- image-mode surfaces adopt the same matte workbench language
- helper pills and crop dialog stay subordinate to the main task surface
- image-mode does not remain as a glass-heavy exception inside the upload page
- browser mode either supports crop safely or explicitly falls back without depending on Tauri `invoke(...)`

Adjust `src/components/VideoUpload/index.vue` so:

- the embedded upload surface adopts the same matte workbench language
- empty states and trim controls stay visually subordinate to the main action
- loaded video workspace does not nest a decorative glass shell inside `upload-workbench__surface`
- browser-selected files can still enter the loaded workspace even when no desktop-native `filePath` exists

- [x] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test "src/views/Upload.workbench.test.js" "src/components/VideoUpload/VideoUpload.theming.test.js" "src/components/upload/UploadWorkbenchPage.test.js" "src/components/upload/UploadWorkbenchPage.materials.test.js"
```

Then run:

```powershell
npm test
```

Expected:

- the upload page reads more clearly as a workbench
- all upload source-inspection tests PASS

- [x] **Step 5: Commit**

```powershell
git add src/views/Upload.vue src/components/upload/UploadWorkbenchPage.vue src/components/ImageUpload/index.vue src/components/ImageUpload/ImageUpload.theming.test.js src/components/ImageUpload/ImageUpload.browser-runtime.test.js src/components/VideoUpload/index.vue src/components/VideoUpload/VideoUpload.theming.test.js src/components/VideoUpload/VideoUpload.trim-ui.test.js src/components/VideoUpload/VideoUpload.browser-runtime.test.js src/views/Upload.workbench.test.js src/components/upload/UploadWorkbenchPage.test.js src/components/upload/UploadWorkbenchPage.materials.test.js
git commit -m "feat: rebuild upload as a premium workbench"
```

## Task 4: Renew Analysis Into A Conclusion-First Instrument Panel

**Files:**
- Modify: `src/views/Analysis.vue`
- Modify: `src/components/VideoPosePlayback.vue`
- Modify: `src/views/Analysis.page-layout.test.js`
- Modify: `src/views/Analysis.visual-priority.test.js`
- Modify: `src/views/Analysis.video-workbench.test.js`

- [x] **Step 1: Write the failing tests**

Extend `src/views/Analysis.page-layout.test.js` to assert:

- the primary judgment region appears before lower-priority modules
- evidence and explanation are grouped intentionally
- the page avoids equal-weight card soup

Extend `src/views/Analysis.visual-priority.test.js` to assert:

- conclusion-first hierarchy is explicit in the template
- cover art remains atmospheric and not a competing hero

Extend `src/views/Analysis.video-workbench.test.js` to assert:

- playback, frame review, and evidence sequencing still remain intact under the renewed layout

- [x] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test "src/views/Analysis.page-layout.test.js" "src/views/Analysis.visual-priority.test.js" "src/views/Analysis.video-workbench.test.js"
```

Expected:

- FAIL because the current analysis page still gives too much equal emphasis to multiple regions

- [x] **Step 3: Implement the analysis workbench renewal**

Adjust `src/views/Analysis.vue` so:

- the strongest judgment, confidence, and summary form the page anchor
- evidence surfaces follow as the next reading step
- deeper modules move lower in priority
- page surfaces become calmer and more tool-like

Adjust `src/components/VideoPosePlayback.vue` so:

- frame evidence and playback controls visually align with the renewed workbench language
- selected frames and active evidence use the evidence accent sparingly

- [x] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test "src/views/Analysis.page-layout.test.js" "src/views/Analysis.visual-priority.test.js" "src/views/Analysis.video-workbench.test.js"
```

Then run:

```powershell
npm test
```

Expected:

- analysis layout tests PASS
- the page reads more clearly without breaking core analysis functionality

- [x] **Step 5: Commit**

```powershell
git add src/views/Analysis.vue src/components/VideoPosePlayback.vue src/views/Analysis.page-layout.test.js src/views/Analysis.visual-priority.test.js src/views/Analysis.video-workbench.test.js
git commit -m "feat: renew analysis workbench hierarchy"
```

## Task 5: Turn History And Compare Into Real Workbench Pages

**Files:**
- Create: `src/views/Compare.workbench-layout.test.js`
- Modify: `src/views/History.vue`
- Modify: `src/views/Compare.vue`
- Modify: `src/views/History.banner.test.js`
- Modify: `src/views/History.archive-layout.test.js`
- Modify: `src/views/Compare.banner.test.js`
- Modify: `src/lib/page-cover-art.ts`

- [x] **Step 1: Write the failing tests**

Create `src/views/Compare.workbench-layout.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Compare.vue', import.meta.url), 'utf8')

test('compare page is structured as a workbench rather than a hero banner page', () => {
  assert.match(source, /compare-page/)
  assert.match(source, /ComparisonView/)
  assert.doesNotMatch(source, /compare-hero-banner/)
})
```

Extend history and compare tests to assert:

- archive and comparison regions are primary
- decorative banners no longer dominate page identity
- page cover art remains subdued atmosphere only

- [x] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test "src/views/History.banner.test.js" "src/views/History.archive-layout.test.js" "src/views/Compare.banner.test.js" "src/views/Compare.workbench-layout.test.js"
```

Expected:

- FAIL because both pages still lean too heavily on banner-first composition

- [x] **Step 3: Implement the archive-and-compare renewal**

Adjust `src/views/History.vue` so:

- the page leads with archive utility rather than decorative banner treatment
- scanability improves through tighter row hierarchy
- primary actions remain obvious and calm

Adjust `src/views/Compare.vue` so:

- the page becomes an analysis-adjacent workbench
- top-level structure supports comparison reading instead of decorative framing

Adjust `src/lib/page-cover-art.ts` only if necessary so:

- cover art selection still supports each page
- the assets are not used as dominant hero content on workbench routes

- [x] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test "src/views/History.banner.test.js" "src/views/History.archive-layout.test.js" "src/views/Compare.banner.test.js" "src/views/Compare.workbench-layout.test.js"
```

Then run:

```powershell
npm test
```

Expected:

- history and compare tests PASS
- archive and comparison pages read as part of the same workbench family

- [x] **Step 5: Commit**

```powershell
git add src/views/History.vue src/views/Compare.vue src/views/Compare.workbench-layout.test.js src/views/History.banner.test.js src/views/History.archive-layout.test.js src/views/Compare.banner.test.js src/lib/page-cover-art.ts
git commit -m "feat: align history and compare with workbench system"
```

## Task 6: Trim Residual Mixed Responsibilities And Finalize The System

**Files:**
- Modify: `src/components/home/HomeWorkspace.vue`
- Create: `src/components/home/HomeWorkspace.ownership.test.js`
- Modify: `src/views/Home.hero-workspace.test.js`
- Modify: `src/views/Home.analysis-workspace.test.js`
- Modify: `src/views/Home.theming.test.js`
- Modify: `src/views/Upload.workbench.test.js`
- Modify: `DESIGN.md`
- Modify: `AGENTS.md`
- Modify: `.impeccable.md`

- [x] **Step 1: Write the failing ownership guard**

Create `src/components/home/HomeWorkspace.ownership.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homeSource = readFileSync(new URL('../../views/Home.vue', import.meta.url), 'utf8')
const uploadSource = readFileSync(new URL('../../views/Upload.vue', import.meta.url), 'utf8')

test('active route views do not directly import HomeWorkspace', () => {
  assert.doesNotMatch(homeSource, /HomeWorkspace/)
  assert.doesNotMatch(uploadSource, /HomeWorkspace/)
})
```

If runtime work in this task proves `HomeWorkspace.vue` is still intentionally active, update this test to encode the exact allowed ownership instead of deleting it.

- [x] **Step 2: Run the audit**

Run:

```powershell
Get-ChildItem src -Recurse -Include *.vue,*.ts,*.js | Select-String -Pattern 'HomeWorkspace' | ForEach-Object { '{0}:{1}:{2}' -f $_.Path, $_.LineNumber, $_.Line.Trim() }
```

Expected:

- a short source-scoped reference list that makes runtime ownership actionable without mixing in plan docs and unrelated repo text

- [x] **Step 3: Implement the cleanup**

If `HomeWorkspace.vue` is still active in runtime code:

- remove stale homepage/workbench styling responsibilities that now belong to route-level pages
- split clearly if a single file still mixes unrelated visual responsibilities

If `HomeWorkspace.vue` is effectively legacy:

- stop routing new visual work through it
- keep `src/components/home/HomeWorkspace.ownership.test.js` asserting that active route views do not directly import it
- align `src/views/Home.hero-workspace.test.js`, `src/views/Home.analysis-workspace.test.js`, `src/views/Home.theming.test.js`, and `src/views/Upload.workbench.test.js` with that ownership boundary

In either branch:

- do not delete `HomeWorkspace.vue` unless its remaining responsibilities are fully removed and no tests depend on it
- document the intended ownership in `AGENTS.md`

Then finalize `DESIGN.md`, `AGENTS.md`, and `.impeccable.md` so they match what shipped rather than the earlier intent language.

- [x] **Step 4: Run the full verification set**

Run:

```powershell
npm test
```

Then run:

```powershell
npm run build
```

Then run:

```powershell
npm run test:render
```

Expected:

- all source-inspection tests PASS
- the build succeeds
- render checks pass for the renewed visual surfaces

- [x] **Step 5: Commit**

```powershell
git add src/components/home/HomeWorkspace.vue src/components/home/HomeWorkspace.ownership.test.js src/views/Home.hero-workspace.test.js src/views/Home.analysis-workspace.test.js src/views/Home.theming.test.js src/views/Upload.workbench.test.js DESIGN.md AGENTS.md .impeccable.md
git commit -m "chore: finalize cinematic ui system renewal"
```

## Notes For Execution

- Do not collapse Home back into a mixed home/workspace route.
- Do not let Upload, Analysis, History, or Compare turn into hero-banner clones.
- Whenever a page decision is ambiguous, prefer stronger task clarity over stronger decoration.
- Reuse existing test style: source-inspection tests first, then targeted verification commands.
- Before claiming success on any task, run the task-local tests and then the broader suite.
