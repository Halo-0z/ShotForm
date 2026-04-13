# Cinematic UI System Renewal

## Summary

This design formalizes the next UI/UX renewal phase for the `codex/cinematic-home-ui` worktree.

The route structure and page responsibilities stay intact:

- `/` remains the cinematic home cover
- `/upload` remains the media-entry workbench
- `/analysis` remains the primary result workbench
- `/history` remains the archive page
- `/compare` remains the comparison page

The renewal focuses on visual system unification, interaction clarity, page hierarchy, and material cleanup.

## Problem Statement

The worktree already moved in the right direction by separating home from the upload and analysis workflow, but the overall product still behaves like a partially unified concept rather than one complete UI system.

Current issues:

1. The product has a strong home-page point of view but weaker inner-page identities.
2. Several workbench pages still depend on banner-first composition instead of tool-first hierarchy.
3. The visual language is not fully consistent across Home, Upload, Analysis, History, and Compare.
4. Page-level surfaces still rely too often on glass, glow, and decorative emphasis.
5. Some layout boundaries remain too large and too entangled for clean iterative design refinement.

## Goals

- Keep the existing route architecture and page responsibilities.
- Turn the current branch into one coherent product family.
- Preserve a cinematic sports-cover home page.
- Make inner pages read as premium training workbenches.
- Reduce remaining AI-dashboard cues and decorative material noise.
- Improve hierarchy so users can identify the next action and the most important evidence immediately.

## Non-Goals

- Rewriting route architecture
- Changing the underlying analysis data flow
- Replacing the current fog transition pattern
- Turning all pages into a single visual mode
- Converting the product into a marketing website

## Core Design Strategy

Use a dual-system model:

- **Cover mode** for Home
- **Workbench mode** for Upload, Analysis, History, and Compare

The product should feel like one family, but not one repeated page template.

### Cover Mode

Home should continue to borrow from cinematic editorial references:

- strong player imagery
- near-black atmosphere
- sparse interface chrome
- one dominant CTA
- slower, mood-setting motion

Home is allowed to be emotionally charged because its job is to frame the product and hand users into action.

### Workbench Mode

Upload, Analysis, History, and Compare should be rebuilt under a calmer and more disciplined system:

- neutral-first surfaces
- restrained interaction color
- clear reading order
- fewer nested containers
- lower reliance on glass and glow

These pages should feel closer to refined desktop instrumentation than to hero banners.

## Reference Mapping

The renewal should not copy one reference system wholesale.

Instead, it should use a controlled split:

- Home: primarily inspired by Runway-style cinematic restraint
- Inner pages: primarily inspired by Apple-style page discipline
- Analysis and Compare details: may borrow a small amount of performance-tech clarity from NVIDIA-like tool interfaces

Ferrari-like intensity is useful only as an emotional reference for restraint and drama, not as a full-system source.

## Visual System Rules

### Color

- Neutral structure should carry most page surfaces.
- Interaction color should be separate from evidence color.
- Evidence color should be rare and meaningful.
- Purple-heavy styling should be removed from the workbench family.

### Typography

- Display typography belongs mainly to Home.
- Workbench pages should use functional sans typography for almost all content.
- Large titles should be clean and compressed, but explanation text must remain comfortable to read.

### Materials

- Home can use atmosphere and depth.
- Workbench pages should prefer matte surfaces and restrained borders.
- Frosted surfaces should only survive where they still add actual hierarchy value.

### Motion

- The fog route transition remains the product-level signature.
- Home can move slowly.
- Inner pages must move quickly and economically.

## Page-by-Page Direction

## Home

- Keep it as a cover-first route.
- Do not re-expand it into an all-in-one workspace.
- Strengthen the feeling of one opening shot and one decisive action.
- Reduce any residual interface weight that competes with the hero composition.

## Upload

- Make the entry task immediately legible.
- Clarify the relationship between upload mode, current status, and next route.
- Reduce decorative framing around the true upload surface.
- Make the page feel like the clean intake desk for a serious training session.

## Analysis

- Treat Analysis as the main workbench, not just a themed page.
- Ensure the strongest conclusion is visible first.
- Stage the rest of the page as evidence, playback, and deeper interpretation.
- Reduce equal-weight module treatment and card soup.

## History

- Move away from banner-led novelty.
- Make it read like a premium session archive.
- Optimize for scan, resume, and discard actions.
- Keep atmosphere, but make archive clarity primary.

## Compare

- Stop treating Compare like a sibling banner page.
- Reposition it as an extension of analysis logic.
- Increase emphasis on difference reading, benchmark understanding, and confidence cues.

## Structural Cleanup Implications

The visual renewal should also support better edit boundaries.

Important implication:

- `src/components/home/HomeWorkspace.vue` should not become the place where every visual decision accumulates.

Future implementation should continue shrinking old mixed-responsibility files rather than adding more styling branches to them.

## Acceptance Criteria

- The branch reads as one product family from Home through Compare.
- Home still feels cinematic and sports-driven.
- Inner pages feel more like premium workbenches than like themed banners.
- Color roles are more disciplined and less AI-generic.
- Cover art supports atmosphere without competing with task-critical information.
- Analysis and Compare communicate priority more clearly than they do now.
- History is easier to scan and resume from at a glance.
- Upload feels more immediate and less wrapped in decorative material.

## Deliverables

This design round should produce:

1. A project-specific `DESIGN.md` in the worktree root
2. An updated `.impeccable.md` with the approved design context
3. Follow-up implementation planning based on the design system rather than isolated page tweaks
