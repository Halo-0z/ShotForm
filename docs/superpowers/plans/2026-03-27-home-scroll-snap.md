# Home Scroll Snap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage behave as a two-state experience that snaps cleanly between the cinematic cover and the analysis workspace.

**Architecture:** Extend the existing home hero state helper with a pure snap-target function, then use debounced scroll-end logic in the home view to snap the shared scroll container to either the cover top or the workspace header offset.

**Tech Stack:** Vue 3, Pinia, existing home hero state utilities, Node test runner

---

### Task 1: Lock the expected interaction in tests

**Files:**
- Modify: `src/lib/home-hero-state.test.js`
- Modify: `src/views/Home.hero-workspace.test.js`

- [ ] **Step 1: Write failing tests for snap target decisions**
- [ ] **Step 2: Run the targeted tests and verify they fail for the new behavior**
- [ ] **Step 3: Add source-level assertions for debounced home scroll snapping**
- [ ] **Step 4: Run the targeted tests again and verify the failure is still about missing implementation**

### Task 2: Implement pure snap-state logic

**Files:**
- Modify: `src/lib/home-hero-state.js`
- Modify: `src/lib/home-hero-state.d.ts`

- [ ] **Step 1: Add a pure helper that decides whether scroll should snap to cover, workspace, or neither**
- [ ] **Step 2: Keep the helper corridor narrow enough to preserve normal workspace scrolling**
- [ ] **Step 3: Run the helper tests and verify they pass**

### Task 3: Snap the home view after scroll idle

**Files:**
- Modify: `src/views/Home.vue`

- [ ] **Step 1: Add workspace target calculation as a reusable helper**
- [ ] **Step 2: Add scroll-idle debounce state and cleanup**
- [ ] **Step 3: Snap to the pure helper’s chosen target after scroll idle**
- [ ] **Step 4: Preserve button-led `开始分析` behavior and top-return behavior**
- [ ] **Step 5: Run targeted tests and verify the interaction contract passes**

### Task 4: Verify the full branch still builds

**Files:**
- Modify: `src/views/Home.vue`
- Modify: `src/lib/home-hero-state.js`
- Modify: `src/lib/home-hero-state.d.ts`
- Modify: `src/lib/home-hero-state.test.js`
- Modify: `src/views/Home.hero-workspace.test.js`

- [ ] **Step 1: Run `node --test src/lib/home-hero-state.test.js src/views/Home.hero-workspace.test.js`**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Review the diff and confirm the change only affects the intended homepage interaction**
