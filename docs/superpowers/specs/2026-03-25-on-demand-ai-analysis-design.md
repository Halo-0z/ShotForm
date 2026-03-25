# On-Demand AI Analysis And Cache-First Results

## Summary

The app currently performs local pose analysis and then immediately calls AI review endpoints during normal image and video workflows. The suggestion panel also auto-requests AI coaching when opened. This causes unnecessary token usage during testing and repeated navigation.

This design changes the product to a cache-first, user-controlled AI model:

- Default to local analysis only.
- Show cached AI results when available.
- Require explicit user action to generate AI results unless a user preference enables automatic AI review.
- Keep AI coaching suggestions manual by default even when automatic AI review is enabled.

## Problem Statement

Current behavior creates avoidable token cost in three common cases:

- Uploading an image automatically triggers AI shot review.
- Uploading a video automatically triggers AI review for the best frame.
- Opening the suggestion panel automatically triggers AI coaching suggestions.

This makes iterative testing expensive and creates repeat AI calls when a user already has valid local or historical results.

## Goals

- Reduce token usage during testing and normal navigation.
- Preserve a clear path for users who want AI-enhanced feedback.
- Reuse previously generated AI results from local history whenever possible.
- Make AI generation state explicit in the UI.
- Keep local analysis fully usable when AI is disabled or unavailable.

## Non-Goals

- Removing AI features from the product.
- Replacing current local analysis logic.
- Changing model providers or prompt strategy.
- Introducing cross-device sync for preferences or cached AI results.

## User Experience

### Default Behavior

- Image and video uploads run local analysis only.
- Analysis results are rendered immediately from local computation.
- If AI review or coaching data already exists for the current record, the app shows the cached content instead of requesting AI again.
- If no AI cache exists, the app shows call-to-action controls instead of auto-generating AI output.

### User Controls

- Add a user preference: `autoAiAnalysisEnabled`.
- Default value: `false`.
- Surface the preference in settings or another persistent user-preference entry point.
- Add explicit buttons in the analysis workflow:
  - `生成 AI 点评`
  - `重新生成 AI 点评`
  - `生成 AI 建议`
  - `重新生成 AI 建议`

### Automatic Mode

When `autoAiAnalysisEnabled = true`:

- Uploading an image or video automatically generates the main AI shot review after local analysis completes.
- AI coaching suggestions remain manual by default to avoid a second automatic token hit on every analysis.

This preserves convenience while still materially reducing cost.

### History And Reopen Behavior

- Opening a historical analysis should display locally stored analysis first.
- If the history record includes cached AI review or coaching results, show them immediately.
- Do not re-request AI because the user opened history, switched tabs, or revisited the analysis page.
- Regeneration only happens from explicit user action.

## Functional Design

### Frontend Preference Storage

Use `localStorage` for the user preference:

- Key: `autoAiAnalysisEnabled`
- Type: boolean
- Default on missing value: `false`

This preference is lightweight and does not require a backend schema.

### Analysis Store Changes

Split local analysis actions from AI enrichment actions.

Existing local actions remain responsible for:

- `analyzeImage`
- `analyzeVideo`
- `saveToHistory`
- `getHistory`

Add explicit AI actions:

- `generateAiReview`
- `generateAiSuggestions`

Expected behavior:

- `analyzeImage` and `analyzeVideo` stop calling AI endpoints by default.
- After local analysis completes, the store checks whether the current payload already contains cached AI data.
- If automatic AI review is enabled and cached AI review is absent, the store may call `generateAiReview`.
- `generateAiSuggestions` is called only from explicit user interaction.

### Suggestion Panel Changes

The suggestion panel should no longer request AI on mount.

New behavior:

- First render cached AI coaching results if present.
- Otherwise render local rule-based suggestions.
- Offer a manual AI generation button.
- If AI generation fails, keep local suggestions visible and show the error state without blocking usage.

### Analysis Page Changes

The analysis page should expose AI review state explicitly:

- `未生成`
- `已缓存`
- `生成中`
- `生成失败`

Display rules:

- If cached AI review exists, render it and label it as cached/local history data.
- If no cached review exists, show the manual generation action.
- If a user regenerates AI output, overwrite the cached review for the current record after success.

## Data Model Changes

### Existing Reusable Data

The current `ShotAnalysis` structure already supports:

- `aiReview?: AiShotReview | null`

The current history record already stores:

- `analysis: ShotAnalysis`

This means shot-review caching already has a valid storage path.

### New Cached Coaching Fields

Extend history storage with coaching cache fields so the app can avoid repeated AI coaching calls:

- `aiCoachingSummary?: string | null`
- `aiCoachingSuggestions?: CorrectionSuggestion[] | null`

These fields should be persisted with history records and hydrated when history is reopened.

### Optional Source Metadata

If useful for UI state, the frontend may maintain transient source labels:

- `local`
- `cache`
- `ai`
- `rules`

This metadata does not need database persistence unless later required for analytics.

## Backend And Persistence Impact

### Database

Update the history schema and repository layer to persist AI coaching cache fields.

Required backend work:

- Extend Rust `AnalysisHistory` model.
- Extend database insert and read logic.
- Preserve backward compatibility for existing rows by treating missing coaching cache as null.

### Commands

No provider-level change is required.

Expected command usage after this design:

- `get_ai_shot_review`: only from manual generation or automatic review mode.
- `get_ai_correction_suggestions`: only from manual generation.
- `get_correction_suggestions`: default local fallback for the suggestion panel.

## State Flow

### Image Upload

1. User uploads image.
2. App runs local pose and shot-type analysis.
3. App renders local result immediately.
4. If cached AI review exists, render it.
5. If automatic AI review is enabled and cache is absent, request AI review.
6. AI coaching remains manual.

### Video Upload

1. User uploads and trims video.
2. App runs local video analysis and selects the best frame.
3. App renders local best-frame analysis immediately.
4. If cached AI review exists for the selected analysis, render it.
5. If automatic AI review is enabled and cache is absent, request AI review for the key frame.
6. AI coaching remains manual.

### Suggestion Panel

1. User opens suggestion tab.
2. App checks for cached AI coaching.
3. If cached coaching exists, render it.
4. Otherwise render local rule-based suggestions.
5. User may manually trigger AI coaching generation.

## Error Handling

- AI failures must never block local analysis results.
- If AI review fails, keep local analysis visible and show a non-blocking failure state.
- If AI coaching fails, keep local rule-based suggestions visible.
- Retry controls should remain available where current retry policy allows them.

## Copy Guidance

Suggested user-facing status copy:

- `当前显示本地分析结果`
- `当前显示本地缓存的 AI 结果`
- `AI 暂不可用，不影响本地分析`
- `按需生成 AI 点评，避免额外 token 消耗`

Suggested button copy:

- `生成 AI 点评`
- `重新生成 AI 点评`
- `生成 AI 建议`
- `重新生成 AI 建议`

## Migration Notes

- Existing history rows already storing `analysis.aiReview` should continue to work without migration loss.
- New coaching cache fields should default to null for old records.
- Frontend components must tolerate history records that only contain local analysis data.

## Verification Scope

1. Uploading an image with default settings performs only local analysis.
2. Uploading a video with default settings performs only local analysis.
3. Opening the suggestion panel without cache does not trigger AI automatically.
4. Clicking `生成 AI 点评` triggers AI review exactly once and saves the result.
5. Clicking `生成 AI 建议` triggers AI coaching exactly once and saves the result.
6. Reopening history shows cached AI review and coaching without repeating AI requests.
7. Enabling `autoAiAnalysisEnabled` causes uploads to auto-generate only the main AI review.
8. AI failure leaves local analysis and local rule suggestions intact.

## Recommended Implementation Order

1. Add frontend preference storage and UI controls.
2. Refactor the analysis store to separate local analysis from AI enrichment.
3. Update the suggestion panel to be cache-first and manual-triggered.
4. Extend history models and persistence for cached AI coaching.
5. Add save/load wiring for regenerated AI results.
6. Verify default mode, automatic mode, history reuse, and failure paths.
