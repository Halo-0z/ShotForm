# Global Interaction Polish

## Intent

Make the application feel simpler, more elegant, and more premium by strengthening global interaction feedback without adding decorative noise.

The workbench pages should feel like a serious basketball training tool: quiet at rest, clear on hover, decisive on press, and unmistakable during keyboard focus.

## Scope

- Global button reset and shared interaction CSS in `src/assets/index.css`
- Shared `Button` variants in `src/components/ui/button`
- Tauri title bar controls in `src/components/TitleBar.vue`
- Video trim filmstrip focus states in `src/components/VideoUpload/VideoTrimFilmstrip.vue`

## Design Rules

- Keep hover states restrained: matte surface shift, border clarity, and a small transform only where it helps.
- Keep active states tactile: short press feedback, no bounce or playful easing.
- Use Steel Blue for interaction emphasis.
- Use Shot Copper only for evidence or selected proof states, not generic hover.
- Focus must be visible in light and dark themes without feeling loud.
- Avoid `transition: all`; animate explicit color, background, border, box-shadow, transform, and opacity only.
- Respect reduced motion by disabling transform-based feedback under `prefers-reduced-motion`.

## Acceptance Criteria

- `outline`, `secondary`, and `ghost` Button variants render real background and border styles instead of being reset to transparent.
- Shared Button classes do not depend on `transition-all`.
- Keyboard focus is visible on shared buttons, TitleBar controls, and video trim controls.
- Hover and active states are perceptible in both light and dark modes.
- No route structure changes.
- No reintroduction of `HomeWorkspace.vue` into active route shells.

## Verification

- Run targeted node tests for button variants, TitleBar, and VideoUpload trim UI.
- Run a Playwright probe on `/upload`, `/analysis`, `/history`, and `/compare` in light and dark themes.
- Confirm computed styles for outline/secondary buttons include non-zero border width and non-transparent background.
