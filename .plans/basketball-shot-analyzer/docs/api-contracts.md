# Basketball Shot Analyzer - API Contracts

## Frontend <-> Tauri Commands

### `analyze_shot`

- Rust entry: `src-tauri/src/commands/analysis.rs`
- Frontend caller: `src/stores/analysis.ts`
- Input:
  - `imageData: string`
- Output:
  - `ShotAnalysis`
- Notes:
  - Emits `analysis-progress` events during execution.
  - Frontend may follow with `draw_pose_on_image` and `get_ai_shot_review`.

### `analyze_video`

- Rust entry: `src-tauri/src/commands/analysis.rs`
- Frontend caller: `src/stores/analysis.ts`
- Input:
  - `filePath: string`
  - `trimStartMs: number`
  - `trimEndMs: number`
- Output:
  - `VideoShotAnalysis`
- Notes:
  - Returns per-frame analyses plus an aggregate result and `bestFrameIndex`.

### `draw_pose_on_image`

- Rust entry: `src-tauri/src/commands/image.rs`
- Input:
  - `imageData: string`
  - `poseData: PoseData`
- Output:
  - annotated image as `string`

### `get_ai_shot_review`

- Rust entry: `src-tauri/src/commands/analysis.rs`
- Input:
  - `analysis: ShotAnalysis`
  - `imageData?: string | null`
  - `annotatedImageData?: string | null`
- Output:
  - `AiShotReview`
- Notes:
  - No longer called automatically by default after image or video analysis.
  - Frontend now calls it only from explicit user action or when `autoAiAnalysisEnabled` is set.

### `build_ai_analysis_payload`

- Rust entry: `src-tauri/src/commands/analysis.rs`
- Input:
  - `analysis: ShotAnalysis`
- Output:
  - `AiAnalysisPayload`

### History Commands

- `save_analysis_history`
- `get_analysis_history`
- `delete_analysis_history`

These commands must stay aligned with `AnalysisHistory` in `src/types/index.ts`.

### `save_analysis_history`

- Rust entry: `src-tauri/src/commands/database.rs`
- Frontend caller: `src/stores/analysis.ts`
- Input:
  - `imagePath: string`
  - `annotatedImagePath: string`
  - `analysis: ShotAnalysis`
  - `comparison?: ComparisonResult | null`
  - `suggestions?: CorrectionSuggestion[]`
  - `aiCoachingSummary?: string | null`
  - `aiCoachingSuggestions?: CorrectionSuggestion[] | null`
- Output:
  - inserted history row id as `number`
- Notes:
  - Supports persisted AI coaching cache for history reopen flows.

## Shared Payload Rules

- TS `ShotType` values are snake_case:
  - `one_motion`
  - `one_point_five_motion`
  - `two_motion`
  - `unknown`
- Rust may internally use enum-style variants, but data crossing the boundary must remain normalized or be normalized immediately by the frontend.
- `analysis-progress` event payload shape:
  - `stage: string`
  - `progress: number`
  - `message: string`
- `AnalysisHistory` includes optional AI coaching cache fields:
  - `aiCoachingSummary?: string | null`
  - `aiCoachingSuggestions?: CorrectionSuggestion[] | null`

## Update Rule

If a Tauri command signature, event payload, or shared DTO changes, update this file in the same task.
