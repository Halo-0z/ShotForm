# Cinematic Home UI Rebrand

## Summary

This design reimagines the current home screen as a cinematic landing experience for end users while preserving the product's existing analysis workflow.

The new version should feel closer to a premium game cover than a utility dashboard:

- Full-screen looping background motion.
- A dark, high-contrast visual system.
- A hero composition built around a featured player cutout.
- Liquid-glass primary actions.
- A staged entrance animation for headline, supporting copy, and CTA.
- A same-page transition from hero cover into the working analysis area.

The goal is not to turn the desktop app into a marketing site. The goal is to create a striking first impression, then hand users into upload and analysis with minimal friction.

## Problem Statement

The current home experience is functionally rich but visually dense from the first frame. Users encounter multiple modules, cards, toggles, and upload affordances immediately.

This creates three product issues:

- The app does not establish a strong emotional first impression.
- The opening screen feels closer to a workflow dashboard than a premium end-user product.
- The first screen exposes too much operational detail before the user understands the product promise.

The redesign should solve those problems without weakening the speed of starting an analysis.

## Goals

- Deliver a premium, poster-like first screen for end users.
- Use a full-screen dark hero with motion and strong visual hierarchy.
- Make the first interaction obvious through one dominant CTA.
- Keep the workflow efficient by revealing the upload workspace on the same page.
- Reuse existing analysis logic and upload flows where possible.
- Build the visual system in a way that can later extend to analysis and history screens.

## Non-Goals

- Rewriting the underlying analysis pipeline.
- Changing AI analysis behavior, data flow, or persistence logic.
- Creating a full website-style navigation model.
- Generating a realistic AI character animation from static PNG assets.
- Replacing every screen in one pass before validating the new home experience.

## User Experience Direction

### First Impression

The app opens into a full-screen cinematic cover. The screen should feel calm, dramatic, and precise rather than flashy.

The user sees:

- A full-screen dark animated background.
- A featured Luka cutout in a hero composition.
- A poster-style headline.
- One professional supporting sentence.
- One dominant liquid-glass button.
- A minimal top bar with brand identity and a small set of utility actions.

### Primary Interaction

The main CTA is the only action that should visually dominate the hero. It should read as the shortest path into the product, not as a marketing conversion button.

Recommended CTA copy:

- `开始分析`

Alternative CTA copy if a slightly more cinematic tone is desired:

- `进入分析`

### Transition Into Work

Clicking the CTA should not route the user to a separate page.

Instead, the home screen should transition within the same route:

1. Hero text and CTA slide upward and fade.
2. The background video remains active but darkens slightly.
3. The upload workspace rises into view below the fold.
4. The page settles into a function-first layout while preserving the same visual language.

This same-page reveal keeps the emotional impact of the hero while avoiding an unnecessary navigation step.

## Recommended Visual System

### Theme

Use a pure dark foundation with white text and subtle blue-gray atmospheric accents.

Visual priorities:

- Near-black background base.
- Bright white or warm-white typography.
- Restrained accent glows, not colorful neon.
- Minimal chrome.
- A sense of depth from fog, bloom, particles, and layered overlays.

### Typography

Recommended pairing:

- Hero heading: `Instrument Serif`
- Chinese display support: `ZCOOL XiaoWei`
- Functional UI text: existing practical Chinese sans stack or HarmonyOS Sans SC

Typography rules:

- The hero title should feel editorial and premium.
- Supporting copy must stay legible and professional.
- Functional workspace text should use a practical sans font for clarity.
- Do not use decorative display fonts in data-heavy workspace sections.

### Liquid-Glass CTA

The primary button should use a restrained liquid-glass treatment.

Required visual ingredients:

- `backdrop-filter` blur.
- Extremely subtle translucent fill.
- A pseudo-element border with brighter highlights at the top and bottom and transparency through the center.
- A white inset highlight line.
- Soft outer glow only on hover or focus.

The button must feel tactile and premium, not glossy or toy-like.

### Motion

The motion system should stay sparse and intentional.

Required entrance sequence:

- Headline enters at `0s`.
- Supporting copy enters at `0.2s`.
- CTA enters at `0.4s`.

Recommended base animation:

```css
@keyframes fade-rise {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Other motion rules:

- Background motion should be slow and ambient.
- Player cutout should have a barely perceptible float or parallax drift.
- Transition into the workspace should feel like the cover is settling downward into an operational mode.
- Respect `prefers-reduced-motion` and provide a reduced-motion version with minimal transforms.

## Asset Strategy

### Featured Subject

Use [luka2.png](/D:/智能投篮分析/封面/luka2.png) as the primary hero subject.

Why this asset is preferred:

- The shooting pose reinforces the product purpose immediately.
- The silhouette reads well at poster scale.
- The raised ball creates a more dynamic composition than a standing pose.

Use [luka1.png](/D:/智能投篮分析/封面/luka1.png) only as an optional secondary decorative asset in later iterations. It should not compete with the hero subject in v1 of the redesign.

### Background Motion Strategy

Recommended implementation:

- Use a real looping background video for atmosphere.
- Keep the player PNG as a separate foreground layer.
- Animate the player layer with subtle transforms rather than fake body motion.

This hybrid method is preferred over trying to create a realistic animated player from still PNGs.

Reasons:

- It preserves realism.
- It avoids uncanny motion artifacts.
- It keeps the hero editable and replaceable.
- It performs more predictably in a desktop app.

If a production-ready video is not yet available, fallback to a pseudo-video hero made from gradients, particles, bloom, and slow transform animation until the final video asset is selected.

## Page Structure

Recommended structure for the home route:

1. `HomeHeroShell`
2. `HeroTopBar`
3. `HeroStage`
4. `HeroContent`
5. `WorkspaceReveal`
6. `HomeWorkspace`

### HeroTopBar

Purpose:

- Keep brand presence visible.
- Preserve lightweight navigation without turning the product into a website.

Contents:

- Product name or mark on the left.
- Optional subtle utility action on the right such as `历史记录`.
- Existing Tauri window controls remain accessible through the title bar treatment.

The top bar should be visually integrated into the hero, not appear as a separate app chrome block.

### HeroStage

Purpose:

- Own the visual spectacle layer.

Contents:

- Full-screen background video.
- Dark gradient overlay.
- Light atmospheric particles or star-like noise if useful.
- Foreground player composition.
- Vignette and focus shaping.

### HeroContent

Purpose:

- Own messaging and CTA hierarchy.

Contents:

- Poster-style title.
- One professional supporting sentence.
- Primary CTA.

Suggested tone:

- Poster-like.
- User-facing.
- Professional.
- Confident without being exaggerated.

### WorkspaceReveal

Purpose:

- Coordinate the shift from cinematic cover to functional analysis mode.

Behavior:

- Starts below the first fold.
- Becomes visible after CTA interaction.
- Uses a smooth transform and opacity transition.
- Keeps some continuity with the hero through shared background, glass surfaces, and typography accents.

### HomeWorkspace

Purpose:

- Reuse existing upload and analysis entry logic.

Scope for the first implementation:

- Upload image and video entry points.
- Existing analysis loading states.
- Existing analysis results modules.

This layer may initially preserve most existing business behavior while receiving a new visual wrapper.

## Copy Direction

The home screen headline should feel cinematic and user-facing, but still grounded in the product's real value.

Recommended headline candidates:

- `看见你的出手节奏`
- `读懂每一次出手`
- `让投篮动作更清晰地被看见`

Recommended subtitle direction:

- Explain that the app analyzes shooting form, key frames, rhythm, and mechanics.
- Keep the sentence concise and credible.
- Avoid sounding like ad copy.

One recommended subtitle:

- `基于姿态识别与关键帧分析，帮助你更清楚地理解投篮动作、出手节奏与发力结构。`

## Component Design Boundaries

The redesign should separate spectacle from workflow so that the app stays maintainable.

Recommended component boundaries:

- `HeroStage` handles only visual layers.
- `CoverFigure` handles only the player foreground and related effects.
- `HeroCopyBlock` handles text and CTA sequencing.
- `WorkspaceReveal` handles transition state.
- `HomeWorkspace` handles upload and analysis UI composition.

The hero components should not contain analysis logic. Business logic should remain in the existing store and reused workflow components.

## Responsive Behavior

Desktop is the primary target, but the layout still needs to degrade gracefully.

Desktop behavior:

- Title centered or slightly offset depending on player composition.
- Large-scale headline.
- Player occupies one side of the hero without obscuring the CTA.

Narrow layouts:

- Reduce title width.
- Scale the player down and anchor lower in frame.
- Keep the CTA visible without overlap.
- Allow the workspace reveal to become more vertical and compact.

The design must avoid hero layouts where the player asset blocks the headline or the CTA at laptop heights.

## Accessibility And Resilience

- Always provide readable contrast over the moving background.
- Use a static poster fallback when video cannot load.
- Use a non-blurred fallback if `backdrop-filter` performs poorly or is unsupported.
- Honor `prefers-reduced-motion`.
- Ensure the CTA remains keyboard reachable and visually obvious.
- Avoid autoplay audio. Background video must be muted and looped.

## Technical Notes

### Suggested Route Strategy

Keep the existing `/` route and redesign [Home.vue](/D:/智能投篮分析/src/views/Home.vue) rather than introducing a separate landing route.

This keeps:

- The home entry point stable.
- The future fallback to the current version simple.
- The new hero and the existing workflow close enough to share state and transitions.

### Suggested State Model

Introduce a lightweight local UI state for the home route:

- `heroMode = cover | workspace`

Expected behavior:

- Default to `cover`.
- Switch to `workspace` when the user activates the CTA.
- Preserve existing analysis-driven state for loading and results.
- Optionally auto-enter `workspace` if an analysis already exists in the current session.

### Suggested Styling Strategy

Move hero-specific styling into a clearer local structure instead of keeping the full redesign embedded as one monolithic style block.

This can be achieved through:

- Local component-level styles for hero layers.
- Shared CSS variables for the dark cinematic theme.
- A small set of reusable effect classes for glass panels and ambient overlays.

## Verification Scope

The redesign should be considered visually complete only after verifying:

1. The hero renders correctly on initial app load.
2. The background video autoplays, loops, and stays muted.
3. The hero title, subtitle, and CTA animate in sequence.
4. The CTA remains readable over all background frames.
5. Clicking `开始分析` reveals the workspace on the same page without layout jumps.
6. The upload workflow still works after the redesign.
7. Existing analysis loading and result states still appear correctly.
8. The hero gracefully falls back when the video asset fails.
9. Reduced-motion mode disables the heavier motion behaviors.
10. Laptop-scale windows do not crop the CTA or headline.

## QA Plan

Use `gstack` during implementation verification for:

- Screenshot capture of the first screen.
- CTA presence and visibility checks.
- Responsive screenshots at multiple viewport sizes.
- Verification that the same-page reveal exposes the workspace correctly.
- Regression testing that the upload and analysis entry points remain interactive.

## Recommended Implementation Order

1. Establish the dark cinematic design tokens and font loading.
2. Build the hero shell with static image fallback.
3. Add background video playback and overlay treatment.
4. Add the player foreground composition and subtle motion.
5. Implement the staged copy and CTA animation.
6. Implement the same-page reveal into the workspace.
7. Restyle the workspace wrapper to match the hero system.
8. Run browser-based visual QA and interaction verification.

## Risks And Mitigations

- Risk: The hero becomes beautiful but slows down task start.
  Mitigation: Keep one dominant CTA and same-page reveal.

- Risk: The player cutout feels pasted onto the scene.
  Mitigation: Add controlled shadow, glow, and depth separation rather than large motion.

- Risk: Video assets are not ready or are too heavy.
  Mitigation: Ship a pseudo-video fallback and load optimized loop assets later.

- Risk: The new styling becomes too coupled to current business markup.
  Mitigation: Separate visual wrapper components from the analysis logic layer.

## Open Follow-Up After Design Approval

Once this spec is approved, the implementation plan should answer:

- Which final hero headline is selected.
- Which video asset is used for v1.
- Whether the history shortcut lives in the hero top bar or inside the workspace.
- Whether the title bar should fully merge into the hero treatment or remain partially distinct.
