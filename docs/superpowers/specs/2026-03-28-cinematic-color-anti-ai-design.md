# Cinematic Color And Anti-AI Cleanup Design

## Goal

Tighten the cinematic worktree so both light and dark mode feel like the same basketball analysis product, while removing the remaining AI dashboard cues from the upload flow, workbench pages, and shared UI chrome.

This round is a focused cleanup of color language, surface materials, and page emphasis. It is not a full redesign.

## Product Intent

- Users are basketball players and trainers working on desktop.
- Home can stay dramatic and cinematic.
- Inner pages should feel disciplined, readable, and work-first.
- Color must guide hierarchy and state, not decorate every surface.

## Current Problems

### 1. Light and dark themes are not one system

Global tokens in `src/assets/index.css` currently describe two different aesthetics:

- Light mode still leans into purple-pink glass gradients.
- Dark mode is closer to the cinematic workbench direction.

Theme switching works technically, but not aesthetically.

### 2. Purple-blue is doing too many jobs

The current primary palette is reused for:

- borders
- active states
- hover states
- focus rings
- glow treatments
- emphasis surfaces

That collapses hierarchy and creates a familiar AI-product look.

### 3. Core workbench pages still hardcode dark surfaces

`src/components/upload/UploadWorkbenchPage.vue`, `src/components/VideoUpload/index.vue`, `src/views/Analysis.vue`, `src/views/History.vue`, and `src/views/Compare.vue` all contain page-level color decisions that bypass theme tokens.

### 4. AI-style material language still leaks through

The strongest remaining anti-patterns are:

- layered glass-on-glass surfaces
- purple glow on neutral structure
- repeated frosted panels for ordinary layout grouping
- active states that look decorative rather than purposeful

## Target Visual Direction

### Shared identity across themes

Both themes should feel like one product:

- focused
- cinematic
- credible
- premium without being ornamental

### Light mode

Light mode should become a calm workstation:

- warm gray or bone-tinted background
- matte light surfaces
- restrained cold accent for controls and selection
- warm orange reserved for proof, key evidence, and selected highlights

### Dark mode

Dark mode should keep the cinematic base but become quieter:

- charcoal and ink-blue neutrals
- fewer purple borders and halos
- stronger separation between neutral structure and active emphasis
- warm orange used selectively for key evidence and high-importance moments

## Color System

### Role split

- Neutral structure: backgrounds, panels, dividers, standard borders
- Interaction color: focused controls, active tabs, selected states, focus rings
- Evidence accent: key frame emphasis, compare hero warmth, major proof surfaces
- Semantic states: success, warning, danger stay independent from brand emphasis

### Token priorities

First-pass token cleanup should focus on:

- `--bg-color`
- `--bg-solid`
- `--surface-color`
- `--card-bg`
- `--glass-xs`
- `--glass-sm`
- `--glass-md`
- `--glass-lg`
- `--surface-border`
- `--border-color`
- `--divider-color`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`
- `--shadow-xl`
- `--primary`
- `--primary-color`
- `--primary-hover`
- `--ring`
- `--quality-good`

Direct hardcoded purple and blue rgba values in buttons, badges, progress bars, and page-level panels should be reduced or tokenized.

## Anti-AI Cleanup Rules

### Keep

- dramatic home atmosphere
- strong hero art where it supports tone
- one signature fog transition
- bold proof surfaces where they help interpretation

### Remove or reduce

- decorative glass layers
- purple borders on ordinary panels
- indigo glow as default emphasis
- nested cards for content that can share one parent surface
- bright frosted upload shells that feel more like a concept mockup than software

## Scope Of First Implementation Round

### Global foundation

- `src/assets/index.css`
- `src/components/ui/button/index.ts`
- `src/components/ui/badge/index.ts`
- `src/components/ui/progress/Progress.vue`

### Upload flow

- `src/components/upload/UploadWorkbenchPage.vue`
- `src/components/VideoUpload/index.vue`
- `src/views/Upload.vue`

### Main workbench pages

- `src/views/Analysis.vue`
- `src/views/History.vue`
- `src/views/Compare.vue`

### Shared chrome and carry-over surfaces

- `src/components/TitleBar.vue`
- `src/components/home/HomeWorkspace.vue`

## Out Of Scope For This Round

- route architecture changes
- store or backend analysis logic
- a brand-new home page concept
- full information architecture rewrite

## Acceptance Criteria

- Light and dark mode read as one product family.
- Upload, analysis, history, and compare no longer depend on hardcoded dark surfaces for their identity.
- Default workbench pages feel calmer and less glassy.
- Purple-blue no longer dominates neutral structure.
- Warm accent is used with intention, not everywhere.
- The UI no longer looks immediately AI-generated because of generic glass, glow, or over-accented surfaces.
