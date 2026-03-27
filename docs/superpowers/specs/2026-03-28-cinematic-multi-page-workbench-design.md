# Cinematic Multi-Page Workbench Design

**Topic:** Replace the single-page home/workspace flow with a cinematic home page and focused multi-page workbench experience.

**Decision:** Split the product into a dedicated cover homepage and independent workbench pages, with a signature fog transition from home into upload. Inner pages use cover art from `D:\智能投篮分析\封面` only as subdued atmosphere and no longer depend on scroll-based scene changes.

## Intent

The current product has strong visual ambition, but its homepage still behaves like a long, mixed-purpose single page. That creates several problems:

- the homepage and work area compete for ownership
- navigation still feels like scrolling between moods instead of entering distinct tools
- important upload actions can be pushed out of view
- some of the "AI-made" feeling comes from page organization rather than raw visual style

This redesign turns the product into a clearer desktop software experience:

- homepage for brand, mood, and entry
- upload page for immediate work
- analysis page for reading results
- history page for review and continuation

The visual system remains cinematic, but the information architecture becomes stricter and more product-like.

## Goals

- Remove the current single-page home-to-workspace interaction model.
- Make `开始分析` open a true new page instead of scrolling the user into a lower section.
- Introduce one signature route transition: a film-like fog reveal from home into upload.
- Make `/upload` a pure workbench page whose first screen prioritizes action over spectacle.
- Reduce the product's remaining "AI slop" signals by clarifying page roles, reducing equal-weight modules, and simplifying workbench reading order.

## Non-Goals

- Redesign the deferred compare experience in this pass.
- Rework core analysis algorithms, stores, or backend logic.
- Add a second dramatic transition between every route.
- Build a poster-style hero section inside workbench pages.

## Product Structure

### Routes

The app should be organized into these primary pages:

- `/`
  cinematic cover homepage
- `/upload`
  pure workbench upload page
- `/analysis`
  results and diagnosis page
- `/history`
  archival and resume page

`/compare` stays out of scope for this pass. The route can remain in the app, but it should not drive current design decisions.

### Page Roles

#### Homepage `/`

Purpose:

- establish brand and visual identity
- communicate value quickly
- provide one clear entry into analysis

The homepage should no longer carry upload tools, crop tools, or working state. It is a cover page, not a workspace.

#### Upload `/upload`

Purpose:

- get the user from intent to uploaded media as quickly as possible
- surface image/video mode switching
- keep upload, trim, and primary actions visible and calm

This page should feel like a premium basketball workbench, not a second landing page.

#### Analysis `/analysis`

Purpose:

- help the user understand the result quickly
- surface the most important diagnosis first
- show evidence, then deeper metrics

This page should prioritize conclusion, visual proof, and corrective direction.

#### History `/history`

Purpose:

- help the user find and resume prior analyses
- present past sessions in an ordered, trustworthy way

This page should feel quieter and more archival than the upload or analysis pages.

## Cover Art Strategy

All page-specific cover imagery should come from `D:\智能投篮分析\封面`, but runtime usage should remain worktree-local. The implementation should copy the chosen assets into the worktree's `public/hero/` directory rather than referencing the external folder directly at runtime.

### Assignment

- Homepage:
  `jordan logo.png`
- Upload page:
  `luka2.png`
- Analysis page:
  `jordan shot.png`
- History page:
  `the shot.png`

### Usage Rules

Inner pages do not get full hero posters. Their images should be:

- blurred or softened
- darkened heavily
- partially masked by fog and gradient layers
- subordinate to the workbench surface

The image should read as emotional context, not content.

## Motion System

### Signature Transition

The only large dramatic motion in this redesign is:

`Homepage CTA -> Fog transition -> Upload page`

The transition should feel like moving through a cool arena haze into a focused training booth.

### Sequence

1. CTA press acknowledgement:
   slight button compression, short brightness dip
2. Home defocus:
   title, figure, and background lose sharpness and intensity
3. Fog sweep:
   layered fog enters from the lower edge and sides
4. Route swap under cover:
   route changes while fog is densest
5. Upload reveal:
   workbench title and upload controls appear first, background atmosphere settles last

### Motion Rules

- No scroll-based fake page entry.
- No second corrective nudge after the route settles.
- The title bar remains stable.
- Inner page micro-interactions should be quick and restrained.
- Respect `prefers-reduced-motion` with a simplified fade transition.

## Upload Page Design

### Core Principle

The upload page serves one job:

`start analysis quickly`

Everything on the page should support that goal.

### Layout

#### Top Utility Bar

Contains:

- page title
- one-line helper text
- return-home affordance
- history access

This area stays compact and should never resemble a second hero section.

#### Main Workbench

Contains:

- image/video switcher
- upload card or loaded media view
- trim tools when video is selected
- concise file summary

The layout should optimize for the default desktop window first, not a tall browser fantasy viewport.

#### Stable Action Area

Contains:

- `开始分析`
- `重新选择`
- `清空`

These actions must remain visible in the loaded-video state without requiring extra scrolling in the default window.

### Explicit Removals

Do not carry these homepage elements into `/upload`:

- four large equal-weight feature cards
- oversized hero title block
- showcase-style module navigation
- decorative section transitions meant for storytelling

## Analysis Page Design

### Core Principle

The analysis page serves one job:

`understand the result and know what to fix`

### Information Order

1. one-line conclusion
2. key visual evidence
3. major diagnosis buckets
4. deeper detail

This page should not begin with charts or tables competing for attention. It should open with a confident conclusion and the most useful supporting visuals.

### Recommended Structure

- top conclusion strip
- main visual stage with video / skeleton / key frame evidence
- diagnosis rail with short actionable findings
- lower details area for deeper metrics and expanded evidence

## History Page Design

### Core Principle

The history page serves one job:

`find, review, and resume prior work`

### Recommended Structure

- compact top control area for search and filtering
- ordered history list or grid with restrained summaries
- detail reveal only when requested

This page should feel calm and archival, not flashy. It should not compete with the homepage for drama.

## Anti-AI-Slop Guardrails

This redesign should explicitly avoid these patterns:

- one long page pretending to be multiple product states
- equally weighted feature cards on work pages
- repeated explanatory text blocks saying the same thing
- decorative glass containers nested inside larger decorative glass containers
- background art competing with buttons and data
- dramatic animation on routine inner-page interactions

Instead, the redesign should emphasize:

- page role clarity
- one strong action per page
- simpler reading order
- stronger distinction between atmosphere and interface

## Scope for the First Implementation Pass

### In Scope

- convert homepage into a true cover page
- create a dedicated `/upload` route and page
- wire the homepage CTA to the fog transition into `/upload`
- move upload functionality fully out of the homepage
- establish per-page background art handling for home, upload, analysis, and history

### Optional If Capacity Allows

- restructure `/analysis` to follow the new conclusion-first reading order
- soften `/history` into a calmer archive layout

### Out of Scope

- compare redesign
- deeper chart system redesign
- backend analysis changes

## Success Criteria

The redesign is successful when:

- users no longer scroll from homepage into the work area
- `开始分析` feels like entering a new place, not sliding to a lower block
- `/upload` behaves like a focused desktop workbench
- default window height keeps primary upload actions visible
- inner pages feel more like software and less like AI-generated landing compositions

## Notes for Planning

The implementation plan should treat this as a routing and page-responsibility redesign, not just a visual polish task. It should likely break into:

- route and shell architecture
- homepage simplification
- upload page extraction
- transition system
- page background asset pipeline
- optional analysis/history restructuring
