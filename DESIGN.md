# Basketball Shot Analyzer Design System

## 1. Visual Theme & Atmosphere

This product uses a split visual system with one clear rule:

- Home is the cover.
- Inner pages are the workbench.

The home route should feel like a premium basketball poster brought to life: cinematic, emotionally charged, sparse, and deliberate. It may use dramatic player imagery, deep contrast, editorial typography, and slow atmospheric motion. The interface should nearly disappear behind the cover moment.

Upload, Analysis, History, and Compare should feel like a premium desktop training tool: calm, structured, fast to read, and credible under repeated use. These pages must not look like extended hero sections. They should feel closer to a refined operating surface than a marketing page.

Emotional goals:

- confidence
- focus
- momentum
- professional seriousness

Anti-goals:

- generic AI dashboard aesthetics
- purple-heavy SaaS glow
- excessive glass layering
- visual noise that competes with analysis evidence

## 2. Color Palette & Roles

### Core Neutrals
- **Arena Black** `#0A0D12`: Home background, deepest dark canvas
- **Workbench Ink** `#141922`: Dark workbench background
- **Charcoal Steel** `#222933`: Dark elevated surfaces
- **Warm Bone** `#F3EEE6`: Primary light background
- **Soft Sand** `#E7E0D4`: Secondary light surface
- **Paper Mist** `#FAF7F2`: Light elevated surface

### Text
- **Text Strong Dark** `#1C2128`: Primary text on light surfaces
- **Text Soft Dark** `#677282`: Secondary text on light surfaces
- **Text Muted Dark** `#8A94A3`: Tertiary text on light surfaces
- **Text Strong Light** `#F3F0EA`: Primary text on dark surfaces
- **Text Soft Light** `#C8D0DA`: Secondary text on dark surfaces

### Interaction
- **Steel Blue** `#5D7396`: Primary interaction color for active controls
- **Steel Blue Hover** `#495F80`: Hover and pressed interaction state
- **Focus Blue** `#6E84A8`: Focus ring and keyboard emphasis

### Evidence Accent
- **Shot Copper** `#C9823D`: Key evidence highlight, selected proof surfaces, special emphasis
- **Shot Copper Deep** `#A76730`: Deeper evidence state

### Semantic
- **Success** `#2F9D71`
- **Warning** `#D9A441`
- **Danger** `#D85C57`

### Color Rules
- Neutral colors build layout and hierarchy.
- Steel Blue is for interaction, not atmosphere.
- Shot Copper is for evidence, not for every clickable object.
- Never use saturated purple as a primary structural or brand color.
- Home can be darker and moodier than inner pages, but both modes must feel related.

## 3. Typography Rules

### Font Families
- **Display Latin**: `Instrument Serif`
- **Display Chinese**: `ZCOOL XiaoWei`
- **UI Sans**: `HarmonyOS Sans SC`
- **Mono**: `Cascadia Code`

### Hierarchy
| Role | Font | Size | Weight | Usage |
|------|------|------|--------|-------|
| Cover Headline | Display Latin / Display Chinese | 56-80px | 400-500 | Home hero only |
| Page Title | UI Sans | 28-40px | 600-700 | Upload, Analysis, History, Compare |
| Section Title | UI Sans | 20-28px | 600 | Major modules |
| Card Title | UI Sans | 16-20px | 600 | Module headers |
| Body | UI Sans | 14-16px | 400-500 | Default reading text |
| Label | UI Sans | 11-13px | 600-700 | Eyebrows, badges, metadata |
| Numeric / Code | Mono or UI Sans | 12-14px | 500-600 | Timecodes, measured values when useful |

### Typography Principles
- Only Home should use display typography prominently.
- Inner pages should primarily use UI Sans.
- Use display typography sparingly for one hero moment, never for dense workbench content.
- Keep line-heights tight for titles and relaxed for explanation text.
- Labels should be short and deliberate, not decorative.

## 4. Component Stylings

### Buttons

**Primary**
- Use Steel Blue fill or dark neutral fill depending on theme
- Strong contrast text
- Medium radius, not oversized pills on workbench pages
- Clear hover and pressed states

**Secondary**
- Neutral surface with restrained border
- Used for supportive navigation and utility actions

**Ghost**
- Minimal chrome
- For low-priority page controls only

**Evidence Action**
- Shot Copper can appear on one high-importance evidence-oriented action or selected proof state
- Do not use as the default CTA color everywhere

### Cards & Surfaces
- Workbench pages should use broader, calmer surfaces rather than many nested cards.
- A page may have one dominant feature surface and several supporting panels.
- Standard containers should feel matte and structural.
- Frosted or glass-like treatment should be used lightly and intentionally.
- Avoid stacking multiple translucent shells inside each other.

### Tabs, Segmented Controls, and Filters
- Active state should be obvious through contrast and controlled color.
- Do not rely on glow alone.
- The selected state should feel decisive and tool-like.

### Badges and Status
- Use semantic colors for semantic states.
- Use Shot Copper only when the state represents key evidence or selected interpretation.
- Avoid ornamental badge gradients.

### Progress and Data Display
- Progress components should read as measured output, not decoration.
- Charts and metrics should sit on neutral surfaces with clear labels and disciplined spacing.

## 5. Layout Principles

### Core Rules
- One page, one primary job.
- One dominant visual region per page.
- One reading path should always be obvious.
- Conclusion first, evidence second, detail third.

### Spacing
- Base spacing rhythm: 8px
- Main layout rhythm: 16px, 24px, 32px, 48px
- Inner pages should feel roomy but not sparse

### Density
- Home may feel spacious and dramatic.
- Inner pages should be moderately dense and scan-friendly.
- History and Compare should prioritize quick comprehension over spectacle.

### Grouping
- Group related controls into one stable region instead of many small cards.
- If multiple modules serve the same task, merge them visually before introducing another container.

## 6. Depth & Elevation

### Home
- Deep layered background
- Atmospheric overlays
- Controlled glow
- Slow parallax or fog depth is acceptable

### Inner Pages
- Prefer flat and matte surfaces with subtle edge separation
- Use low-intensity shadows
- Use borders to define structure before using blur

### Depth Rules
- Depth should support navigation and hierarchy.
- Depth must never turn every module into a floating object.
- If a panel is ordinary structure, keep it visually quiet.

## 7. Motion & Transitions

### Signature Motion
- Keep the fog route transition as the main brand-level transition between cover and workbench routes.

### Home Motion
- Slow, atmospheric, editorial
- Suitable for cover art and entrance copy

### Workbench Motion
- Short, precise, utility-first
- Hover, selection, and tab changes should feel immediate

### Motion Rules
- Respect `prefers-reduced-motion`
- Avoid continuous motion inside dense work areas
- Use animation to confirm change, not to decorate idle states

## 8. Page-Specific Rules

### Home
- Treat Home as the opening shot.
- Keep one clear CTA into the workflow.
- Do not reintroduce heavy workbench content into the page body.

### Upload
- Make upload mode, next action, and system status immediately legible.
- Reduce decorative shells around the core upload surface.
- The page should feel like an equipment intake desk.

### Analysis
- Put the primary judgment first.
- Present proof surfaces clearly and make the next reading step obvious.
- Avoid giving equal visual weight to every module.

### History
- Treat history as an archive and recovery surface.
- Optimize for scanning, resuming, and deleting sessions with confidence.
- Reduce banner-like decoration that does not help archive use.

### Compare
- Treat compare as an extension of analysis, not as a separate promotional page.
- The visual hierarchy should privilege differences, reference targets, and conclusions.

## 8.1 Ownership Boundary

- Route pages own the shipped page shells for Home, Upload, Analysis, History, and Compare.
- `HomeWorkspace.vue` may remain as a legacy component for isolated reuse and test coverage, but it should not regain ownership of active route composition.
- New visual cleanup should strengthen route-level clarity rather than reviving mixed home/workbench responsibilities.

## 9. Do's and Don'ts

### Do
- Keep the split system clear: cinematic cover, disciplined workbench
- Use cover art as atmosphere, not as structural clutter
- Let neutral surfaces carry most of the UI
- Reserve color for interaction, evidence, and semantic meaning
- Use fewer, larger, better-structured surfaces

### Don't
- Don't turn every page into a hero banner
- Don't use purple glow as a default design crutch
- Don't stack glass effects for ordinary layout regions
- Don't give equal emphasis to every card, metric, and button
- Don't let decorative background art compete with reading tasks

## 10. Agent Prompt Guide

When extending this product:

- Build Home like a cinematic sports cover with minimal UI chrome.
- Build Upload, Analysis, History, and Compare like premium desktop workbenches.
- Use Apple-like restraint for hierarchy and interaction discipline.
- Use Runway-like cinematic intensity only on Home and high-level transition moments.
- Preserve one product family across all pages through shared neutrals, shared spacing logic, and shared transition language.
- Keep active route ownership in the route views instead of routing new page work back through `HomeWorkspace.vue`.
