# Player Comparison Workbench

## Summary

This design upgrades the current "player comparison" feature from a single-template demo into a comparison workbench embedded inside the analysis experience.

The new version should help the user answer three questions in sequence:

- Which player template is closest to this shooting form?
- Which joints and release traits differ the most?
- What should the user adjust next if they want to move toward that template?

The work should stay aligned with the current `codex/cinematic-home-ui` worktree direction, where analysis results, suggestions, and comparison already live inside the same reading surface instead of separate disconnected flows.

## Problem Statement

The current comparison experience is functional but shallow:

- The user must manually pick one player before seeing any value.
- The system returns only one comparison result at a time.
- Similarity uses a generic unweighted score even though the backend already contains a weighted similarity helper.
- Comparison data is not persisted into history even though the database schema supports it.
- Player templates come from hardcoded defaults only, while the repository layer already has a `player_templates` table.

This creates three product issues:

- The feature feels like a side demo rather than a serious analysis tool.
- The user gets numbers and charts, but not a ranked answer or an actionable learning path.
- The system cannot evolve cleanly toward richer template management because command-layer data flow still bypasses the local database.

## Goals

- Turn comparison into a ranked, guided workbench inside the analysis page.
- Show the best matching player templates before asking the user to drill into one.
- Improve similarity scoring so important joints matter more than minor differences.
- Persist comparison output with analysis history.
- Move template reads toward a database-backed flow while keeping default templates as safe local seed data.
- Reuse the current comparison UI pieces where possible instead of rebuilding the screen from scratch.

## Non-Goals

- Building a remote admin backend or cloud template management system.
- Supporting user-authored template editing in this phase.
- Importing raw video libraries of star players in this phase.
- Replacing the existing suggestion system with a completely new coaching engine.
- Redesigning every route that currently references comparison.

## Current State

### Frontend

- [ComparisonView](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView/index.vue) renders a single select, a similarity gauge, a radar chart, and an angle-difference table.
- [Analysis.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Analysis.vue) already treats comparison as one tab inside the analysis insights area.
- [HomeWorkspace.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/home/HomeWorkspace.vue) still exposes comparison as a top-level module in the home work surface.
- [Compare.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Compare.vue) still exists as a dedicated route.

### Backend

- [compare_with_player](D:/智能投篮分析/.worktrees/cinematic-home-ui/src-tauri/src/commands/analysis.rs) compares against one player id and reads only default templates.
- [PoseComparator](D:/智能投篮分析/.worktrees/cinematic-home-ui/src-tauri/src/analysis/comparison.rs) already contains:
  - side-aware angle canonicalization for left-handed shooters
  - base similarity scoring
  - `calculate_weighted_similarity`, which is not yet used in the main path
- [repository.rs](D:/智能投篮分析/.worktrees/cinematic-home-ui/src-tauri/src/database/repository.rs) already supports:
  - `player_templates`
  - `comparison_json` in analysis history

### State

- [analysis.ts](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/stores/analysis.ts) saves history with `comparison: null`, so compare output is currently dropped.

## User Experience Direction

Comparison should feel like "deep reading of the analysis," not a separate utility.

Recommended reading order inside the comparison tab:

1. `Closest Matches`
2. `Detailed Difference`
3. `How To Learn From This`

The user should not begin with a blank selector if the system can already rank templates automatically.

## Proposed Experience

### Section 1: Closest Matches

At the top of the comparison tab, the system should automatically evaluate the current analysis against every available player template and show the top three matches as cards.

Each card should include:

- player name
- team
- short style description
- similarity score
- shot-type compatibility hint
- one short line explaining why the match ranked highly

Recommended behavior:

- The highest-ranked card is preselected by default.
- Clicking another card updates the detailed comparison view below.
- If fewer than three templates exist, show all available templates.

This removes the current empty-state problem and gives the user an immediate answer.

### Section 2: Detailed Difference

The current detailed view should remain, but become the second step after ranking:

- similarity gauge
- radar chart
- sorted angle-difference table

The angle table should sort by instructional relevance rather than raw source order.

Recommended ordering logic:

- highest weighted differences first
- ties broken by absolute difference

Each row should clearly show:

- joint label
- user value
- player value
- signed difference
- severity bar

If useful, add a lightweight label such as `core release`, `power chain`, or `balance` to make the table easier to read without studying raw angle names.

### Section 3: How To Learn From This

The comparison result should connect to coaching instead of ending at the chart.

This section should summarize:

- the two or three largest gaps
- what those gaps usually mean in shooting mechanics
- which existing suggestion items align with those gaps

This is not a new AI feature. It is a deterministic bridge layer that translates comparison output into a clearer reading path.

## Information Architecture

Recommended structure inside the comparison tab of [Analysis.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Analysis.vue):

1. ranked comparison cards
2. selected-player detail panel
3. learning summary / linked suggestion bridge

Recommended structure inside [ComparisonView](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/ComparisonView/index.vue):

- `ComparisonRankingRail`
- `ComparisonSummaryPanel`
- `ComparisonRadarPanel`
- `ComparisonDifferenceTable`
- `ComparisonLearningBridge`

These may stay in one file for the first pass if needed, but the logical boundaries should be explicit in the implementation plan.

## Data Model Direction

### Template Source

This phase should not require manual operator import before the feature becomes useful.

Recommended template source strategy:

1. Keep default player templates in code as local seed data.
2. On read, prefer database-backed templates when available.
3. If the database is empty, seed the defaults into `player_templates`.
4. Continue using local fallback defaults if seeding fails.

This gives the app a path toward maintainable template management without blocking the work on a new import tool.

Recommended seeding rule:

- Seed lazily from the template-read command path instead of adding a separate startup migration flow for this phase.
- If the table is empty, insert defaults once, then read from the database result.
- If insertion fails, log and continue with in-memory defaults for the current session.

### Comparison Result Shape

The current result shape is close, but the workbench needs one higher-level ranked response.

Recommended additions:

- `compare_against_all_players(analysis)` returns a ranked list of summaries
- `ComparisonSummary` should include:
  - `player`
  - `similarity`
  - `topDifferences`
  - `matchReason`
  - optional `shotTypeAlignment`

The existing single-player result can remain for detail views, or the ranked API can return both summary and full detail for the selected default match.

### History Persistence

When the user opens or confirms a comparison result, the chosen comparison should be eligible for persistence through the existing `comparison_json` field in history.

This allows reopened analyses to restore:

- selected template
- similarity score
- angle differences

History persistence should be best-effort and should not block analysis completion.

Recommended persistence rule:

- Cache the currently selected comparison result in frontend state once ranking or detail comparison completes.
- If the user saves the analysis after a comparison has been computed, include that selected comparison in the existing history save payload.
- Reopening history should restore the last saved comparison if present, not force a fresh compare call before the tab is usable.

## Scoring Design

### Base Principle

Not every angle should matter equally.

For shooting comparison, release-related joints should influence similarity more than minor posture variations.

### Recommended Weighting

Use the existing weighted similarity path in [comparison.rs](D:/智能投篮分析/.worktrees/cinematic-home-ui/src-tauri/src/analysis/comparison.rs) and define a simple first-pass weight table such as:

- elbow angle: high
- shoulder angle: high
- trunk tilt: medium
- hip angle: medium
- knee angle: medium

The exact numbers can be modest and easy to tune later. The important decision is to move from flat scoring to intentional scoring.

### Match Explanation

For each top-ranked player, generate a deterministic explanation from the strongest positive signals:

- low weighted difference in release joints
- matching shot type
- similar lower-body loading profile

This explanation should be short and rule-based, not AI-generated.

## Error Handling

- If templates fail to load, show a recoverable empty state with a retry action.
- If ranking fails, do not break the rest of analysis.
- If detail comparison for a selected player fails, preserve the ranking list and show an inline error in the detail panel.
- If history persistence fails, log and continue without surfacing a blocking modal.

## Route and Surface Strategy

### Analysis Page

The analysis page should remain the primary home for comparison.

This matches the current worktree direction and keeps comparison framed as a deeper reading layer after the user has already seen the core diagnosis.

### Standalone Compare Route

[Compare.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Compare.vue) can remain for now as a compatibility route, but it should reuse the same upgraded workbench component rather than diverging into a separate experience.

### Home Workspace

[HomeWorkspace.vue](D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/home/HomeWorkspace.vue) should not become the primary design target for comparison. It may keep a link or module entry, but the richer comparison experience should be authored once and consumed from both surfaces.

## Testing Strategy

### Frontend

- component rendering for ranked results
- default selected match behavior
- changing selected player updates detail state
- empty and error states
- copy-whitelist coverage for newly surfaced result text

### Backend

- ranked comparison returns expected ordering
- weighted similarity changes ranking as intended
- template loading prefers DB rows over hardcoded defaults
- default seeding path works when database starts empty
- history persistence round-trips comparison payload

### Integration

- opening analysis and entering comparison shows top-ranked matches without manual selection
- reopening history restores saved comparison when present

## Rollout Plan

### Phase A

- add ranked comparison API
- switch template source to DB-first with default seeding
- show top-ranked matches in the comparison tab
- keep detailed comparison view mostly intact

### Phase B

- connect comparison gaps to suggestion reading
- persist selected comparison into history
- refine explanatory labels and instructional summaries

### Phase C

- optional template management flow
- optional custom or imported player templates

## Risks

- Over-designing the comparison UX before validating the new ranking flow
- Letting `HomeWorkspace`, `Analysis.vue`, and `Compare.vue` drift into separate compare experiences
- Introducing too many scoring heuristics at once and making results hard to trust

## Recommendation

Ship the comparison workbench in two implementation phases:

1. ranked matching plus DB-backed template flow
2. comparison-to-coaching bridge plus history persistence

This delivers a meaningful upgrade quickly, matches the current worktree architecture, and creates a clean foundation for future template import features without requiring them up front.
