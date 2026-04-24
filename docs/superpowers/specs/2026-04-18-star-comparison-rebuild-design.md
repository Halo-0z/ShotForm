# Star Comparison Rebuild

## Summary

This design replaces the current `球星对比` implementation with a small comparison subsystem that has one job: build a trustworthy comparison workbench from the current analysis input and a reusable player-template library.

The rebuild is driven by three hard product requirements:

- The feature must never feel like an empty shell.
- The primary loading feedback must be a real progress bar with stage text, not an elapsed-seconds counter.
- The selected player card, detail panel, and loading state must always describe the same comparison session.

The current implementation has already accumulated too much orchestration inside [ComparisonView/index.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView/index.vue). Continuing to patch that file will keep reproducing the same class of bugs: stuck loading, stale detail panes, and frame-switch race conditions.

## Problem Statement

The current comparison flow is unstable because one Vue component owns too many responsibilities at once:

- template loading
- comparison ranking
- selected-player detail loading
- progress UI
- retries
- history persistence
- video-frame coupling
- request cancellation

This creates four user-visible failures:

1. The page can remain in loading with no trustworthy completion signal.
2. The current progress feedback is time-shaped rather than work-shaped.
3. Selecting a new player can temporarily show contradictory state, where the card highlight changes before the detail pane is truly updated.
4. Video-frame switching and tab activation can invalidate in-flight work without a clear terminal state.

The result is a feature that feels unreliable even when parts of the code are technically working.

## Goals

- Rebuild `球星对比` as a dedicated subsystem with explicit boundaries.
- Make loading observable through a real staged progress bar.
- Guarantee that each comparison request reaches one bounded terminal state: `ready`, `empty`, or `error`.
- Eliminate stale-detail mismatches when switching players.
- Isolate compare state from unrelated analysis-page churn.
- Reuse the same comparison system in both the embedded analysis tab and the standalone compare route.

## Non-Goals

- Replacing the current comparison scoring model with AI-generated ranking.
- Building a cloud template backend.
- Supporting full admin editing workflows beyond the current local template persistence.
- Redesigning the rest of the analysis page.
- Replacing the current suggestion system.

## Current State

### Frontend

- [ComparisonView/index.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView/index.vue) currently mixes progress display, workbench loading, request invalidation, ranking selection, detail rendering, retry behavior, and route navigation.
- [Analysis.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Analysis.vue) mounts comparison from the analysis insights tab.
- [Compare.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Compare.vue) mounts the same comparison component as a standalone route.
- [analysis.ts](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/stores/analysis.ts) mutates `currentAnalysis` whenever the selected video frame changes and clears `currentComparison` at the same time.

### Backend

- [database.rs](D:/智能投篮分析/.worktrees/cinematic-home-ui/src-tauri/src/commands/database.rs) exposes template reads and writes through SQLite-backed commands.
- [repository.rs](D:/智能投篮分析/.worktrees/cinematic-home-ui/src-tauri/src/database/repository.rs) manages database initialization, default seeding, and history persistence.
- The current UI still carries legacy assumptions about multiple template-loading paths and split orchestration.

### Comparison Math

- [comparison-workbench.js](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/lib/comparison-workbench.js) already contains deterministic local comparison helpers and should remain the pure computation layer.

## Product Requirements

### Loading Feedback

This is a hard requirement.

The primary loading feedback must be:

- a visible `el-progress` bar
- stage text that describes current work
- optional secondary helper text

The primary loading feedback must **not** be:

- only elapsed seconds
- only skeletons
- only a spinner
- a fake percent based purely on time

### Detail Consistency

This is also a hard requirement.

When the user selects another player:

- the UI may show a pending state
- the old detail panel may remain visible only if it is clearly covered by a loading treatment
- the new card must not look fully committed while the old detail still appears current

The system must commit `selected player + detail result + learning bridge` as one coherent state transition.

### Terminal States

Every compare request must end in exactly one bounded terminal state:

- `ready`
- `empty`
- `error`

The UI must never remain in indefinite loading without either stage advancement or a timeout transition.

### Cancellation Terminal Semantics

`ready`, `empty`, and `error` are the only user-visible terminal states for the active compare session.

A superseded request may enter an internal non-rendering `cancelled` state. `cancelled` must never be shown as a user-facing result and must never mutate `progress`, `rankedSummaries`, `detailsByPlayerId`, `selectedPlayerId`, `selectedResult`, `analysisStore.currentComparison`, or history persistence after a newer request becomes active.

Rules:

- the active request always resolves to exactly one visible terminal state: `ready`, `empty`, or `error`
- superseded requests are invalidated by both `requestId` and `analysisKey`
- late progress, late success, late error, and late persistence callbacks from a cancelled request are ignored
- starting a new request clears the old request's pending UI unless the store explicitly restores a matching cached `ready` state

## Recommended Architecture

### Recommended Option

Use `backend-orchestrated compare workflow + frontend compare store`.

This is the best option because it creates real progress stages from real work rather than guessing from UI timers.

### Why This Option Wins

- Template loading, validation, ranking, and default-detail construction already map cleanly to backend work stages.
- The frontend becomes much simpler and easier to test.
- Progress events become explicit and observable.
- Cancellation and stale-response protection become store-level concerns rather than component-local tricks.

## Proposed System

### 1. Compare Input Identity

Comparison must stop depending directly on a mutable `currentAnalysis` object as its only identity.

Introduce a stable compare input shape:

- `source`: `image` or `video-frame`
- `sessionId`
- `frameIndex` when applicable
- `analysisKey`
- `analysis`

The analysis page may still pass the current analysis object, but the compare subsystem should immediately normalize it into this stable input record.

### Compare Input Identity Rules

`analysisKey` must be deterministic and include enough data to distinguish stale video-frame, history, and restore flows.

Required identity fields:

- `source`
- `sessionId`
- `videoPath` when source is `video-frame`
- `frameIndex` when source is `video-frame`
- `analysis.timestamp`
- normalized `shotType`
- stable angle signature
- history id when restoring a saved record

Two compare inputs are the same only when their full identity matches.

All async store mutations must verify both `requestId` and `analysisKey`.

### History And Rehydration

The compare subsystem must support restored history without treating it as the same identity as live analysis by accident.

Rules:

- include `historyId` in the normalized input when compare state is restored from a saved history record
- reuse a saved comparison only when `historyId` and the full normalized `analysisKey` still match the current restored record
- invalidate restored comparison state when the user switches frames, changes analysis source, or recomputes analysis
- persist `comparison_json` only from the active request after the workbench has reached `ready`
- the persisted comparison snapshot must include at least `analysisKey`, `rankedSummaries`, `selectedPlayerId`, `selectedResult`, and the visible learning bridge content
- after the workbench reaches `ready`, post-ready player switches update the persisted snapshot for the same history record instead of creating a new compare request
- reopening saved history restores the last persisted selected player and comparison snapshot only when the restored `historyId` and `analysisKey` still match; otherwise the saved comparison is discarded and a fresh compare build starts
- stale or superseded requests must never overwrite saved comparison history

### 2. Compare Store

Add a dedicated compare store:

- suggested file: [comparison.ts](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/stores/comparison.ts)


Responsibilities:

- own the compare state machine
- start and cancel compare sessions
- consume backend progress events
- hold ranked summaries
- hold precomputed detail payloads for ranked players
- hold current selected detail result
- expose retry actions
- ignore stale responses from superseded sessions

Recommended state shape:

- `status`
- `progress`
- `requestId`
- `analysisKey`
- `input`
- `rankedSummaries`
- `detailsByPlayerId`
- `selectedPlayerId`
- `selectedResult`
- `error`
- `templateVersion` optional metadata only when backed by a real backend fingerprint

Recommended status machine:

- `idle`
- `preparing`
- `loading_templates`
- `validating_templates`
- `ranking_players`
- `building_default_detail`
- `ready`
- `empty`
- `error`
- `cancelled` internal only

### 3. Compare Service

Add a thin frontend service:

- suggested file: [comparison-service.ts](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/lib/comparison-service.ts)

Responsibilities:

- call the new backend command
- subscribe to `compare-progress` events
- scope progress events to the active request id and input key
- expose a clean API to the store

This layer should contain no Vue refs and no rendering concerns.

### 4. Comparison Engine Ownership

The rebuild should move runtime ownership of comparison math into the backend path used by `build_compare_workbench`.

In this spec, `comparison-workbench.js` is a temporary deterministic reference and parity-test helper only. Runtime scoring, ranking, validation, summary construction, and detail payload construction must move into the backend command used by `build_compare_workbench`.

Keep [comparison-workbench.js](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/lib/comparison-workbench.js) as the deterministic scoring and ranking engine.

The frontend file is not the long-term runtime owner; it exists only to define the deterministic contract that the backend command must match.

Responsibilities:

- validate comparable angles
- compute weighted similarity
- build ranking summaries
- build the full detail payload for each ranked player in the workbench result

Migration and parity rules:

- port the deterministic logic currently represented by the frontend reference module into backend code used by the canonical workbench command
- keep the frontend reference only as a temporary parity-test helper during migration
- add golden fixture parity tests proving backend ranking, similarity score, angle differences, and default selected result match the deterministic reference for representative inputs
- remove duplicate frontend runtime ranking paths once parity passes

Do not maintain two independent runtime comparison implementations after the rebuild.

### 5. Backend Compare Workflow

Add one canonical backend command that represents the full workbench build:

- suggested name: `build_compare_workbench`

It should:

1. normalize the incoming analysis payload
2. load templates from the canonical DB-backed source
3. validate usable templates
4. run deterministic ranking
5. precompute detail payloads for each ranked player shown in the workbench
6. choose the default selected player and result
7. emit stage progress during the workflow
8. return one final payload for the compare store

This replaces the current UI-level orchestration of:

- `get_player_templates_db`
- fallback template getters
- local ranking
- separate default detail construction

as multiple independent front-end steps.

### 6. Progress Events

Add a `compare-progress` event emitted from Tauri.

Progress event payload:

- `requestId`
- `analysisKey`
- `stage`
- `percent`
- `message`

Contract rules:

- `stage` must be one of the compare state-machine stages
- `percent` must be an integer from 0 to 100
- accepted progress for one request must be monotonic
- lower-percent or out-of-order events are ignored
- progress resets only when a new active request starts or when a cached `ready` state is explicitly restored
- `ready` and `empty` render at 100%
- `error` renders the failed stage and last accepted percent and must not falsely show completion
- timer interpolation is not allowed as primary progress
- helper text may show elapsed time, but only as secondary text under the real progress bar
- events whose `requestId` or `analysisKey` do not match the active request are ignored

Suggested staged progress:

- `preparing` 10%
- `loading_templates` 25%
- `validating_templates` 40%
- `ranking_players` 70%
- `building_default_detail` 90%
- `ready` 100%
- `empty` 100%

These percentages are stage landmarks, not timer interpolation.

### 7. Timeout Policy

The compare store owns timeout enforcement so the behavior is deterministic and testable.

Default thresholds:

- first visible progress must appear within 2 seconds of compare entry
- any active stage with no accepted progress event for 8 seconds transitions the active request to `error`
- total workbench build time over 20 seconds transitions the active request to `error`

Timeout rules:

- timeout errors include the failed stage and a retry action
- retry starts a new request id from `preparing`
- a backend command may continue running after a frontend timeout, but its later progress and result must be ignored unless they still match the active `requestId` and `analysisKey`

### 8. UI Split

Break the current comparison UI into a thin shell plus presentational sections.

Suggested files:

- [ComparisonView/index.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView/index.vue)
  - orchestrates store wiring only
- [ComparisonProgress.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView/ComparisonProgress.vue)
  - progress bar and stage text
- [ComparisonRankingList.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView/ComparisonRankingList.vue)
  - ranked cards and pending state
- [ComparisonDetailPane.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView/ComparisonDetailPane.vue)
  - dashboard, radar, differences, learning bridge

The shell should read store state and render one of:

- loading
- empty
- error
- ready

It should not contain long-lived request bookkeeping.

## Interaction Design

### Compare Entry

When the user opens `球星对比`:

- the compare store starts one new session
- the progress section appears immediately
- ranked results appear only after the workbench reaches `ready`

### Player Switching

When the user selects a different ranked player:

- the store reads the selected player's precomputed detail payload from the current workbench result
- the store commits `selectedPlayerId + selectedResult + learning bridge` in one synchronous mutation
- the UI does not start a second backend request for alternate-player detail
- the new card never looks committed while old detail still appears current

This explicitly addresses the stale-data issue currently observed in review.

### Frame Switching

When the user switches key frames:

- the active compare session is canceled or invalidated
- all future progress and result events for the old session are ignored
- the new session starts from `preparing`

No previous frame may overwrite the new frame’s compare state after supersession.

### Route And Hidden Tab Behavior

Embedded analysis tab:

- when the compare tab is not active, the embedded compare surface must not start new compare work
- if a compare request is in flight when the user leaves the tab, the request is invalidated or cancelled
- reopening the tab may restore cached `ready` state only when the cached input identity exactly matches the current analysis identity
- if the identity differs, reopening starts a fresh request from `preparing`

Standalone compare route:

- the standalone route may keep the compare store active while mounted
- navigating away invalidates in-flight work unless another visible compare surface explicitly owns the same active request
- the standalone route and embedded tab must not race to write different results for the same global comparison state

### Compare Store Lifecycle

The compare store is a shared subsystem, but it must still have explicit ownership rules.

Lifecycle rules:

- a visible compare surface claims ownership of the active request when it starts or resumes compare work
- switching to a new frame or new analysis identity invalidates the existing request and clears any stale selection cache
- unmounting the last visible compare surface releases ownership and invalidates in-flight work
- re-entering compare may restore a cached `ready` state only when the owning surface and normalized input identity still match
- `templateVersion` is optional metadata only if the backend later provides a real fingerprint; it is not required for the first rebuild milestone

## Template Source Strategy

Use one canonical template-loading path for the new compare workflow.

Recommended rule:

1. prefer DB-backed templates
2. seed built-in templates if the table is empty
3. treat malformed templates as validation failures
4. return `empty` if no valid templates remain
5. avoid multiple UI-side fallback branches

This removes a major source of silent divergence.

## Error Handling

### Template Load Failure

- transition to `error`
- show stage-aware failure message
- show retry action

### Empty Template Library

- transition to `empty`
- explain that no valid templates are available
- surface `管理模板`

### Invalid Ranked Detail Payload

- if a ranked player cannot produce a valid detail payload during workbench construction, exclude that player from the final ranked workbench
- if no valid ranked players remain after validation, transition to `empty`
- do not allow alternate selection to trigger a second ad hoc detail request

### History Persistence Failure

- log and continue
- never block comparison rendering

### Stale Side-Effect Suppression

Async side effects are subject to the same stale-response guard as UI state.

The store must block stale writes to:

- `analysisStore.currentComparison`
- analysis history comparison persistence
- selected player state
- progress state
- cached workbench state
- detail-pane result state

A stale request may log diagnostics, but it must not mutate visible or persisted comparison state.

## Route Strategy

The embedded analysis compare tab remains the primary product surface.

[Compare.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Compare.vue) should consume the same compare store and UI shell rather than becoming a separate compare implementation.

The system should be authored once and reused from both routes.

## Testing Strategy

### Pure Unit Tests

Add deterministic tests for:

- compare state transitions
- progress stage mapping
- cancellation and stale-response suppression
- template cache behavior
- ranking math
- backend parity fixtures for migrated comparison math

Suggested files:

- [comparison-session.test.js](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/lib/comparison-session.test.js)
- [comparison-progress.test.js](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/lib/comparison-progress.test.js)
- [comparison-cache.test.js](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/lib/comparison-cache.test.js)

### Store / Integration Tests

This is mandatory for the rebuild.

Add tests that mock Tauri calls and drive the compare lifecycle:

- first load succeeds
- slow template load still reaches `ready`
- template load timeout reaches `error`
- frame switch cancels old request
- hidden compare tab cannot later overwrite visible state
- stale progress, success, and error callbacks are ignored after supersession
- player switching swaps committed detail atomically without a second request

Suggested files:

- [comparison-session.test.js](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/stores/comparison-session.test.js)
- [analysis.compare-integration.test.js](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/stores/analysis.compare-integration.test.js)

### Browser Runtime Tests

Use the existing Playwright render harness for real UI behavior checks.

Add runtime coverage for:

- progress bar is visible during load
- stage text updates across progress events
- loading shell disappears at `ready`
- switching players swaps visible detail atomically
- retry and empty states render correctly

Suggested file:

- [ComparisonView.runtime.test.js](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView.runtime.test.js)

Use the browser-runtime harness path for implementation:

- `tests/render/compare.browser-runtime.spec.ts`

### Testability Requirements

The compare store must be testable without mounting Vue components or calling real Tauri commands.

Required seams:

- injectable comparison service
- injectable fake clock for timeout tests
- deterministic request id generation or observable request ids
- mock progress-event emitter
- explicit unsubscribe cleanup verification
- stable component selectors or `data-testid` hooks for progress bar, stage text, selected card, empty state, error state, retry action, and detail pane

Required negative tests:

- stale progress event after frame switch is ignored
- stale success result after frame switch is ignored
- stale error result after frame switch is ignored
- stale history-persistence callback cannot overwrite current comparison
- duplicate and out-of-order progress events do not regress the progress bar
- hidden embedded tab does not start or continue invisible work
- standalone compare route does not conflict with embedded compare tab state

### Manual Desktop QA

Minimum manual checks:

- fresh app launch, open compare immediately
- switch key frames quickly during compare load
- switch suggestion/compare tabs rapidly
- test no templates, built-in templates only, imported templates mixed in
- force template-loading failure
- reopen history with saved comparison

## Acceptance Criteria

- Clicking `球星对比` shows a progress bar and stage text within 2 seconds.
- Progress reflects workflow stages, not only elapsed time.
- Progress percent is monotonic per active request and never advances from elapsed time alone.
- Each compare request reaches `ready`, `empty`, or `error`.
- `ready` and `empty` render at 100%; `error` renders the failed stage without falsely showing completion.
- A request that receives no progress for the configured stage timeout transitions to `error`.
- A request that exceeds the configured total timeout transitions to `error`.
- Switching players commits selected player, detail result, and learning bridge atomically from the current workbench payload.
- Switching key frames cannot let old results overwrite the new session.
- Hidden compare surfaces cannot leave ghost work that later mutates visible state.
- Superseded progress, success, error, and persistence callbacks cannot mutate visible or persisted comparison state.
- Retry actions start a new compare request from `preparing`.
- No valid templates and no comparable angle pairs both produce a bounded `empty` state with a user-actionable message.
- The stuck-loading regression is caught by automated store/integration tests.

## Rollout Plan

### Phase A

- define compare contracts and state machine
- add compare store and compare service
- add backend workbench command and progress events

### Phase B

- rebuild comparison UI shell and sections
- route both analysis tab and compare page through the new store
- remove component-local orchestration from `ComparisonView`

### Phase C

- add integration tests, browser runtime tests, and desktop QA pass
- remove deprecated legacy compare paths from normal UI flow

## Recommendation

Do not continue patching [ComparisonView/index.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView/index.vue) as the primary orchestration layer.

Rebuild `球星对比` as a dedicated subsystem with:

- one compare store
- one compare service
- one canonical backend workbench command
- one real staged progress model
- one coherent result-commit path

That is the smallest complete solution that addresses both the current stuck-loading bug and the stale-detail mismatch reported in review.
