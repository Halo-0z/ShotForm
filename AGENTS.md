# Agent Guide

Use this file as the entry guide for AI work in this worktree.

## Core UI References

For any UI, UX, layout, theming, or visual polish work:

1. Read [DESIGN.md](D:\智能投篮分析\.worktrees\cinematic-home-ui\DESIGN.md) first.
2. Read [2026-04-07-cinematic-ui-system-renewal-design.md](D:\智能投篮分析\.worktrees\cinematic-home-ui\docs\superpowers\specs\2026-04-07-cinematic-ui-system-renewal-design.md) before planning implementation.
3. Preserve the existing route structure:
   - `/` is the cinematic home cover
   - `/upload` is the upload workbench
   - `/analysis` is the primary analysis workbench
   - `/history` is the archive page
   - `/compare` is the comparison page

## Ownership Boundaries

- Route views own page-level composition and atmospheric cover layers.
- `src/components/home/HomeWorkspace.vue` is a legacy component surface, not an active route shell.
- Do not reintroduce `HomeWorkspace.vue` into `src/views/Home.vue` or `src/views/Upload.vue`.
- New workbench polish should land in the active route views or their dedicated route-level components.

## Design Context

### Users
Primary users are basketball players and trainers reviewing shooting form on desktop. They usually arrive with a concrete task: upload an image or short clip, inspect the motion, compare the form against known patterns, and leave with actionable next steps. They are not browsing for inspiration. They are entering a focused training workflow.

### Brand Personality
Focused, cinematic, credible.

The product should feel like a premium basketball analysis tool, not a generic AI dashboard and not a marketing landing page pretending to be software. It should evoke confidence, concentration, and momentum. The product can open with emotion, but it must settle quickly into a disciplined workbench.

### Aesthetic Direction
Use a dual-mode visual system:

- Home is a cinematic sports cover.
- Upload, Analysis, History, and Compare are premium training workbenches.

The home route can borrow from film-poster and editorial sports art direction: dramatic cover imagery, sparse copy, a single dominant call to action, and strong atmospheric contrast. Inner pages should borrow from the clarity and restraint of high-end product workbenches: calmer structure, fewer decorative materials, cleaner hierarchy, and faster reading.

Cover art should stay in the product, but its job changes by page:

- On Home, cover art is the main event.
- On inner pages, cover art becomes background atmosphere only.

Motion should be purposeful and signature-driven: one memorable fog transition between cover and workbench states, then short, precise interactions inside the work pages.

Anti-references:

- generic AI SaaS dashboards
- purple-heavy AI styling
- evenly weighted card grids that make every module feel equally important
- glass-on-glass clutter
- overexplained workspaces with too many labels and repeated helper text
- single-page scrolling that fakes navigation
- decorative chrome that competes with evidence and analysis output

### Design Principles
1. One page, one job.
2. Home opens the story; inner pages do the work.
3. Cover art may lead emotion, but never outrank task-critical information.
4. Inner pages should feel like one coherent product family, not separate themed mockups.
5. Color must separate structure, interaction, and evidence instead of treating them as the same thing.
6. Motion should clarify state changes, not compete with them.
7. The fastest path to upload, inspect, compare, and review history must stay obvious in the default desktop window.
