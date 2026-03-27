# Multi-Page Cover Art Design

**Topic:** Page-specific cover art for the cinematic home workspace and inner pages

**Decision:** Keep `luka2` as the homepage hero, upgrade the home analysis workspace with the approved `A / Echo Hero` Jordan silhouette treatment, and add lighter banner-style cover art to compare and history.

## Intent

The app already has a strong cinematic homepage shell, but the inner experience still feels visually flat once the user enters the working UI.

This design extends the cinematic system into the app's most important working screens without turning every page into a full poster. The goal is:

- Each major page should carry its own basketball identity.
- The analysis workspace should become the visual centerpiece.
- The cover art should support the product story instead of overpowering upload and analysis tasks.

## Scope

This spec covers:

- The home route hero assignment.
- The cover treatment at the top of the home analysis workspace in [HomeWorkspace.vue](/D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/home/HomeWorkspace.vue).
- A lightweight top banner for [Compare.vue](/D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Compare.vue).
- A lightweight top banner for [History.vue](/D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/History.vue).
- Asset import into the worktree-local `public/hero/` directory.

This spec does not cover:

- Reworking the standalone [Analysis.vue](/D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Analysis.vue) as the main target for this effort.
- Changing upload, analysis, compare, or history business logic.
- Replacing existing analysis result layouts.
- Introducing new routes or changing the scroll-snap model of the homepage.

## Page Assignment

### Homepage

- Keep `luka2.png` as the homepage hero subject in [CinematicHeroStage.vue](/D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/home/CinematicHeroStage.vue).
- Do not change the current homepage cover composition or its route-level role.

Why:

- It already anchors the cinematic entry experience successfully.
- The pose reads as "ready to shoot", which matches product entry and initiation.

### Home Analysis Workspace

- Use `jordan logo原图.png` as the foreground hero subject.
- Use `jordan logo.png` as the oversized silhouette-shadow behind it.

Why:

- This pairing turns the analysis workspace into the most iconic screen in the product.
- The visual relationship communicates "form", "recognizable mechanics", and "signature silhouette".
- It fits the analysis narrative better than a generic dunk or rear-view shot.

### Compare Page

- Use `jordan dunk.png` as the compare page banner subject.

Why:

- The wide arm extension and visible rim create stronger comparative energy than the other assets.
- The image feels dynamic without requiring a full poster layout.

### History Page

- Use `the shot.png` as the history page banner subject.

Why:

- The back-facing view feels archival and retrospective.
- It supports a "classic moments / past records" emotional tone.

### Deferred Asset

- Do not use `jordan shot.png` in this pass.

Why:

- The other three Jordan images already cover analysis, compare, and history clearly.
- Forcing an extra assignment would dilute the page identities.

## Home Analysis Workspace: Approved Direction

### Chosen Direction

The approved concept is `A / Echo Hero`.

This is not a literal ground shadow. The "shadow" should behave as an echo silhouette or iconic afterimage behind the subject.

The visual message is:

- front layer: the athlete in motion
- back layer: the motion reduced into a recognizable Jumpman-like identity mark

That relationship is the core of the page.

### Primary Target Area

The target is the existing top block in [HomeWorkspace.vue](/D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/home/HomeWorkspace.vue), specifically:

- `.home-header`
- `.module-nav`
- the top area above `.upload-section`

This is the screen the user already treats as the main "投篮姿势分析" page, so the design should be applied there first rather than shifting emphasis to the standalone `/analysis` route.

### Composition

The analysis hero should be built as a new wrapper around the existing header content:

1. A dedicated hero surface sits behind the current badge, title, subtitle, and auto-AI toggle.
2. The text block remains readable and function-first.
3. `jordan logo原图.png` appears as the crisp foreground figure on the right side.
4. `jordan logo.png` appears behind it as a larger, softer, lower-opacity silhouette.
5. The existing upload and module UI continues below as the operational layer.

### Layer Rules

Required layers:

- Background atmosphere:
  - deep blue-black gradient
  - restrained cool glow
  - optional subtle amber highlight to reflect the basketball
- Shadow silhouette:
  - source: `jordan logo.png`
  - scale: roughly `1.15x - 1.3x` the foreground figure
  - opacity: roughly `0.10 - 0.18`
  - light blur and slight positional offset
- Foreground figure:
  - source: `jordan logo原图.png`
  - crisp and visually dominant
  - anchored to the right side so it does not block the title

### Layout Rules

- Keep the badge, title, subtitle, and toggle in the upper central zone.
- Allow the text group to shift slightly left from perfect center to make room for the figure.
- Do not let the figure overlap the main title or the toggle.
- Do not push the upload cards so far down that the first working action disappears from the initial laptop viewport.

### State Behavior

The hero should adapt to existing workspace states instead of fighting them.

#### Default Upload State

When the workspace is showing the upload-oriented view:

- show the full Echo Hero treatment
- keep the silhouette clearly readable
- allow the heading block to feel cinematic and spacious

#### Compact Analysis State

When `isAnalysisWorkspace` is true and the header enters compact mode:

- keep the hero visible, but compress it vertically
- reduce the figure prominence slightly
- reduce the silhouette opacity slightly
- preserve title readability over spectacle

#### Focused Upload State

When `showUpload` is true:

- keep the hero system present while the header still exists
- tighten spacing so the upload cards remain near the fold

#### Loaded Upload Workspace State

When the page uses the existing `loaded-upload-workspace` mode and hides `.home-header` and `.module-nav`:

- the new hero must disappear with the header
- no empty decorative shell should remain above the upload area

This keeps the focused upload workspace clean and avoids decorative dead space.

### Motion

Motion should stay subtle:

- foreground figure: little or no independent movement
- silhouette layer: static, with depth created through blur and offset rather than animation
- hero surface: no flashy particle system required

The page already has a cinematic outer shell. This feature should add identity, not another separate animation system.

### Responsive Rules

On narrower windows:

- scale the foreground figure down
- pull the figure slightly farther right
- shrink the silhouette proportionally
- allow the text block to widen before increasing overlap risk

The design must remain clean on laptop-height viewports and should not hide the module cards or upload entry actions.

## Compare Page Banner

### Intent

The compare page should feel sharper and more athletic, but still remain primarily a functional comparison screen.

### Treatment

- Add a lightweight banner at the top of [Compare.vue](/D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Compare.vue).
- Use `jordan dunk.png` on the right side of the banner.
- Use a darker glass or gradient banner base that matches the cinematic palette.
- Keep the existing page title and back button, but integrate them into the banner instead of leaving them on a plain background.

### Constraints

- The banner must stay shallower than the analysis hero.
- The comparison content below remains the main page payload.

## History Page Banner

### Intent

The history page should feel reflective and archival rather than explosive.

### Treatment

- Add a lightweight banner at the top of [History.vue](/D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/History.vue).
- Use `the shot.png` on the right side or rear of the banner.
- Favor darker and calmer gradients than the compare page.
- Let the page title and back button sit inside the same top composition.

### Constraints

- The history list must remain the visual priority below the banner.
- The banner should not dominate the page once records are present.

## Asset Handling

To keep the worktree self-contained, copy the selected assets into `public/hero/` inside this worktree:

- `public/hero/jordan-logo-original.png`
- `public/hero/jordan-logo-shadow.png`
- `public/hero/jordan-dunk.png`
- `public/hero/the-shot.png`

Keep the existing:

- `public/hero/luka2.png`

Do not leave the implementation dependent on the external `D:\智能投篮分析\封面` directory at runtime.

## Implementation Boundaries

Recommended implementation shape:

- Add a small, dedicated hero sub-structure inside [HomeWorkspace.vue](/D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/home/HomeWorkspace.vue) rather than scattering figure markup across unrelated blocks.
- Keep compare/history banners self-contained within their page files unless they obviously want a shared banner component after the first pass.
- Avoid touching analysis store logic, route logic, or upload behavior.

This feature is primarily a visual composition task.

## Verification Scope

The implementation should be considered complete only after verifying:

1. Homepage still renders the current Luka hero correctly.
2. The home analysis workspace shows the new Jordan Echo Hero in the upload-oriented state.
3. The header remains readable over the new art.
4. Compact analysis mode still fits within the viewport cleanly.
5. `loaded-upload-workspace` still hides the entire header/hero zone cleanly.
6. Compare page banner renders with `jordan dunk.png`.
7. History page banner renders with `the shot.png`.
8. Mobile-width and laptop-height windows do not create figure/text overlap.
9. Asset paths resolve from `public/hero/` in build output.

## Test Strategy

Keep testing lightweight and focused:

- Preserve existing cinematic home tests.
- Add static assertions that the new figure and shadow assets are referenced from the expected files.
- Add static assertions that compare and history reference their assigned hero assets.
- Run `npm run build` to validate asset resolution and styles.

## Risks And Mitigations

- Risk: The analysis hero overwhelms the upload workflow.
  Mitigation: keep the hero in the header zone and let the upload cards remain the functional center below it.

- Risk: The silhouette effect reads like a broken duplicate instead of intentional design.
  Mitigation: keep clear scale, opacity, and offset separation between foreground and shadow.

- Risk: Compare and history become overdesigned.
  Mitigation: keep those two pages on a shallow banner treatment, not a full poster conversion.

## Implementation Order

1. Import the approved assets into `public/hero/`.
2. Build the Echo Hero structure in `HomeWorkspace.vue`.
3. Tune compact and focused state behavior in the existing home workspace CSS.
4. Add the compare page banner.
5. Add the history page banner.
6. Add lightweight static tests for the asset assignments.
7. Run build verification.
