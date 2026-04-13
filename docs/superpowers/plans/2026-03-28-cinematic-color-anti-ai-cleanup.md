# Cinematic Color And Anti-AI Cleanup Implementation Plan

> For implementation: use superpowers:subagent-driven-development when available. If child-agent quota is blocked, execute the same task boundaries inline in this session.

## Goal

Unify light and dark mode, remove the strongest AI-style color and material cues, and keep the current cinematic direction without turning the product into a generic dashboard.

## Batch 1: Global Tokens And Shared UI

### Files

- `src/assets/index.css`
- `src/components/ui/button/index.ts`
- `src/components/ui/badge/index.ts`
- `src/components/ui/progress/Progress.vue`
- `src/components/TitleBar.vue`

### Work

- Replace the current purple-pink light theme with a calmer workstation palette.
- Quiet dark mode neutrals and reduce default purple borders and glow.
- Rebalance primary interaction color vs evidence accent color.
- Remove hardcoded legacy purple and blue rgba values from shared button, badge, and progress primitives where practical.
- Align title bar chrome with the quieter workbench material language.

## Batch 2: Upload Flow Cleanup

### Files

- `src/components/upload/UploadWorkbenchPage.vue`
- `src/components/VideoUpload/index.vue`
- `src/views/Upload.vue`
- upload-related tests

### Work

- Remove the strongest upload glow, bright frosted shells, and generic AI-upload empty-state feel.
- Rebuild the video picker and trim rail around darker matte panels with clearer functional emphasis.
- Ensure upload page colors are theme-driven rather than dark-mode-only.
- Keep the upload path obvious in the default desktop window.

## Batch 3: Analysis, History, And Compare

### Files

- `src/views/Analysis.vue`
- `src/views/History.vue`
- `src/views/Compare.vue`
- page-level tests for those views

### Work

- Tokenize or replace hardcoded deep-dark surfaces and purple active states.
- Preserve current layout hierarchy while making the pages feel less like stylized component compositions.
- Use warm accent selectively in proof-heavy surfaces and compare hero moments.
- Make history and compare visually valid in both themes.

## Batch 4: Home Workspace Carry-Over Cleanup

### Files

- `src/components/home/HomeWorkspace.vue`
- related tests if affected

### Work

- Remove the heaviest remaining glass and purple structural accents inside the home workspace shell.
- Keep the home page dramatic, but reduce leftover AI-dashboard cues in embedded work surfaces.

## Final Verification

- `npm test`
- `npm run build`

## Notes

- Runtime English copy cleanup is important, but it is not the first blocker for this pass. This round prioritizes color/material system coherence and anti-AI visual cleanup.
- If a batch reveals significant visual regressions, stop after that batch, verify, and re-evaluate before widening scope.
