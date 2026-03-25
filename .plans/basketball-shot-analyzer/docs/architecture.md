# Basketball Shot Analyzer - Architecture

## System Overview

The application is a desktop basketball shooting analysis tool built with a Vue frontend and a Tauri backend. The frontend owns interaction flow and presentation. Tauri commands bridge the UI to Rust analysis, image handling, and persistence. Python scripts and local model assets support pose detection and video-derived keypoint extraction.

## Main Layers

### Frontend

- Entry and routing live in `src/main.ts`, `src/App.vue`, and `src/router/index.ts`.
- View-level screens live in `src/views/`:
  - `Home.vue`
  - `Analysis.vue`
  - `Compare.vue`
  - `History.vue`
- Shared UI and feature components live in `src/components/`.
- Frontend state for analysis flow lives in `src/stores/analysis.ts`.

### Tauri / Rust

- Command surface lives in `src-tauri/src/commands/`.
- Analysis domain logic lives in `src-tauri/src/analysis/`.
- Image processing and visualization live in `src-tauri/src/image/`.
- Database models and repository logic live in `src-tauri/src/database/`.
- AI-related integration lives in `src-tauri/src/ai/`.
- Shared DTOs live in `src-tauri/src/models/`.

### Vision Pipeline

- Python pose detection scripts live in `scripts/`.
- Local model assets live in `models/`.
- Rust pose integration lives in `src-tauri/src/pose/`.

## Data Flow

1. User selects an image or video in the frontend.
2. `src/stores/analysis.ts` invokes a Tauri command.
3. Rust command code runs pose detection, analysis, image annotation, and optional AI review assembly.
4. Result payload returns to the frontend and is normalized into TS-friendly state.
5. AI review and AI coaching are now separate follow-up flows on the frontend:
   - local analysis completes first
   - AI review is optional and user-triggered by default
   - AI coaching is cache-first and user-triggered
6. History and templates are persisted through Rust database commands.

## Key Integration Points

- Frontend and Rust must stay aligned on payload field names and enum normalization.
- Rust and Python must stay aligned on pose input/output format and model lookup behavior.
- Long-running analysis should emit progress events that the frontend can render.
- Cached AI coaching data is stored with history records so reopening prior analyses does not force new AI requests.

## Current Team Boundaries

- `frontend-dev`: route/view workflow, chart components, upload UX, state normalization.
- `tauri-backend`: command APIs, analysis heuristics, persistence, event emission.
- `vision-pipeline`: detection scripts, model loading, fallback strategy, detection robustness.
- `reviewer`: cross-layer contract and regression review.
