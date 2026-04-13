# Home Scroll Snap Design

**Topic:** Homepage interaction model for the cinematic cover and analysis workspace

**Decision:** Use a two-state homepage with button-led entry and scroll-assisted snapping.

## Intent

The homepage should feel like a deliberate opening scene, not a long freely scrollable landing page. Users should either be in the cinematic cover state or in the functional analysis workspace state, with no awkward resting position between them.

## Interaction Model

1. The default state is the full-screen cover.
2. Clicking `开始分析` smoothly transitions the viewport into the workspace.
3. Mouse wheel and touchpad scroll can assist this transition.
4. If the viewport stops between the cover and the workspace header, the app automatically snaps to the nearest valid state.
5. Once the user is fully inside the workspace content, normal workspace scrolling is preserved.
6. Scrolling back toward the top snaps the user cleanly back to the cover instead of leaving the page half-open.

## UX Rationale

- The CTA remains the primary path for first-time users.
- Power users can still use the wheel naturally.
- The UI keeps a premium, composed feel because it never settles in an unfinished midpoint.
- Returning from history or analysis still lands on a clean cover state.

## Technical Shape

- Keep the existing `cover/workspace` state model.
- Add a pure snap-target helper to `src/lib/home-hero-state.js`.
- In `src/views/Home.vue`, debounce scroll-end behavior and snap only inside the transition corridor between cover and workspace.
- Reuse the existing workspace header offset so the snapped workspace position still feels intentional.
