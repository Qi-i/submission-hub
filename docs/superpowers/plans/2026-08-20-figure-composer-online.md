# Figure Composer Online Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary monolithic Figure Studio with a modular, draft-linked, publication-aware Figure Composer and make Submission Hub online-only after the final offline freeze.

**Architecture:** A reducer-owned Figure Project is rendered by focused React components. Pure geometry/layout/snapping/unit/preflight logic lives under `src/lib/figure-composer`; imported bytes and project configurations persist in IndexedDB. Preparation owns navigation and draft callbacks, while Figure Composer owns browser-local figure project state.

**Tech Stack:** React 18, TypeScript 5.6, Canvas 2D, IndexedDB, existing Vite/Supabase/Playwright infrastructure, lightweight browser-loaded PDF/TIFF/PDF-export compatibility libraries.

**Spec:** `docs/superpowers/specs/2026-08-20-figure-composer-online-design.md`

## Global Constraints

- Canonical source is `Qi-i/submission-hub` remote `main`; the online branch is `feat/online-figure-studio`.
- Never write Submission Hub build artifacts or checkout data into `E:\ZS_WZBLK`.
- Final offline Release is `v2.0.1-offline-final`; online development does not alter its HTML asset.
- Imported figure image bytes remain browser-local by default and are not uploaded to Supabase.
- Default subfigure label is `(a)` and default label font is Times New Roman.
- Initial bundle must lazy-load the Figure Composer workspace.
- No iframe, standalone HTML embedding, new large state dependency, or new CSS hotfix tail.

---

### Task 1: Lock architecture and scientific behavior contracts

**Files:**
- Create: `tests/figure-composer-contract.mjs`
- Modify: `package.json`

**Produces:** automated checks requiring modular components/libs, six Preparation sections, typed panel geometry/span/ratio fields, browser-local persistence, preflight and online-only build chain.

- [ ] Write the contract before production refactoring.
- [ ] Run it in CI and confirm it fails against the current monolithic `FigureStudio.tsx` implementation.
- [ ] Keep the failing contract unchanged while implementing Tasks 2–8.

### Task 2: Build typed geometry, units, layout and snapping core

**Files:**
- Create: `src/lib/figure-composer/types.ts`
- Create: `src/lib/figure-composer/units.ts`
- Create: `src/lib/figure-composer/geometry.ts`
- Create: `src/lib/figure-composer/layout.ts`
- Create: `src/lib/figure-composer/snapping.ts`

**Produces:**
- `physicalToLogicalPx(value, unit): number`
- `physicalToOutputPx(value, unit, dpi): number`
- `resizePanel(panel, change): FigurePanel`
- `alignPanels(panels, ids, mode): FigurePanel[]`
- `distributePanels(panels, ids, axis): FigurePanel[]`
- `applyGridLayout(project, preset?): FigureProject`
- `autoWrapProject(project): FigureProject`
- `snapPanel(panel, others, canvas, gap): SnapResult`

- [ ] Implement 96-DPI logical coordinate conversion and exact export-pixel conversion.
- [ ] Implement ratio-locked/free numeric resize.
- [ ] Implement row/column occupancy and rowSpan/colSpan layout including `hero-right-stack` (A|B/C).
- [ ] Implement multi-panel alignment/distribution.
- [ ] Implement edge/center/uniform-gap snapping and guide-line output.

### Task 3: Browser-local image import and project persistence

**Files:**
- Create: `src/lib/figure-composer/image-import.ts`
- Create: `src/lib/figure-composer/project.ts`

**Produces:** per-file image import results, IndexedDB project/asset CRUD, object URL cleanup.

- [ ] Import PNG/JPG/WEBP/SVG/TIFF/PDF with per-file error isolation.
- [ ] Preserve SVG source text and natural dimensions.
- [ ] Persist project metadata and Blob assets in IndexedDB.
- [ ] Revoke every created object URL on asset removal/project close/unmount.

### Task 4: Preflight and export engine

**Files:**
- Create: `src/lib/figure-composer/validation.ts`
- Create: `src/lib/figure-composer/export.ts`

**Produces:** deterministic preflight issues and six output formats.

- [ ] Detect effective-DPI, bounds, overlap, stretch, caption and format problems.
- [ ] Export PNG/JPG/WEBP/TIFF/PDF at requested DPI.
- [ ] Export SVG with logical viewBox, vector labels/text and correct `preserveAspectRatio` semantics.
- [ ] Guard very large raster allocations and report useful failures.

### Task 5: Split Figure Composer UI

**Files:**
- Create: `src/components/figure-composer/FigureComposer.tsx`
- Create: `src/components/figure-composer/FigureCanvas.tsx`
- Create: `src/components/figure-composer/FigureToolbar.tsx`
- Create: `src/components/figure-composer/FigureSidebar.tsx`
- Create: `src/components/figure-composer/FigurePanelInspector.tsx`
- Create: `src/components/figure-composer/FigureExportPanel.tsx`
- Create: `src/components/figure-composer/FigurePreflightPanel.tsx`
- Replace: `src/figure-studio.css` with `src/figure-composer.css`
- Delete: `src/components/FigureStudio.tsx`

**Produces:** dominant canvas desktop workspace with left assets/layers, central canvas and right geometry/preflight/export inspector.

- [ ] Create reducer actions for project/layer/selection/layout state.
- [ ] Implement plain/Ctrl-or-Cmd/Shift selection.
- [ ] Implement numeric X/Y/W/H, ratio lock, rowSpan/colSpan and label settings.
- [ ] Render snap guides and multi-select state.
- [ ] Keep zoom view-only and separate from logical geometry.
- [ ] Add narrow-screen non-overlapping fallback.

### Task 6: Refactor Preparation into six workflow sections and link drafts

**Files:**
- Modify: `src/components/PreparationWorkspace.tsx`
- Modify: `src/components/OnlinePreparationWorkspace.tsx`
- Modify: `src/components/PreparationWorkspaceSuite.tsx` only where needed to preserve overview productivity behavior.

**Produces:** `overview | paper | figures | materials | match | check`, lazy-loaded Figure Composer, `draftId` project association and `figure_count` synchronization.

- [ ] Replace the old five Preparation subviews without changing the main app navigation.
- [ ] Lazy-load Figure Composer.
- [ ] Pass normalized drafts and draft update callback.
- [ ] Recompute and save `figure_count` from local Figure projects.
- [ ] Surface figure preflight alongside the existing `figures` checklist item without silently marking it complete.

### Task 7: Retire active offline development chain

**Files:**
- Delete: `offline.html`
- Delete: `vite.config.offline.ts`
- Delete: `src/offline.tsx`
- Delete: `src/components/OfflineDashboard.tsx`
- Delete: `src/components/OfflinePreparationWorkspace.tsx`
- Delete: `src/components/OfflinePaperCard.tsx`
- Delete: `src/components/OfflinePaperForm.tsx`
- Delete: `src/components/OfflineFirstRunGuide.tsx`
- Delete: `scripts/check-offline-build.mjs`
- Delete: `.github/workflows/release-offline.yml`
- Delete: any one-shot metadata workflow created only for this branch.
- Modify: `package.json`, `.github/workflows/quality.yml`, `scripts/check-release-consistency.mjs`, README/release docs.

**Produces:** online-only `npm run verify` while preserving historical offline releases/tags and shared backup compatibility utilities.

- [ ] Remove offline scripts and runtime entries.
- [ ] Keep generic backup/import compatibility code that online users still need.
- [ ] Ensure CI no longer builds or validates a new offline HTML.

### Task 8: Interaction, visual and regression tests

**Files:**
- Create: `tests/visual/figure-composer-check.mjs`
- Modify: existing visual fixture/workflow files as required.

**Produces:** real browser interaction evidence.

- [ ] Exercise 4×4 grid and mixed aspect images.
- [ ] Exercise A|B/C rowSpan layout.
- [ ] Exercise ratio lock/free X/Y/W/H edits.
- [ ] Exercise Ctrl/Shift multi-select, alignment, distribution and snap guides.
- [ ] Verify zoom does not mutate logical W/H.
- [ ] Verify PNG and SVG downloads.
- [ ] Run desktop light/dark at 1366/1440/1920 and mobile basic layout.
- [ ] Re-run existing dashboard/journal/login/preparation visual contracts.

### Task 9: Five review gates and release

**Files:**
- Modify: `docs/releases/v2.1.0.md`, `docs/releases/v2.1.0-release-audit.md`, `README.md`, `public/release-info.json` as needed.

- [ ] Architecture review: no iframe, monolith, duplicate state or active offline chain.
- [ ] Scientific review: ratios/spans/alignment/snapping/DPI/SVG/canvas math.
- [ ] UI review: hierarchy/dark/light/density/widths/mobile/no blank canvas waste.
- [ ] Engineering review: TypeScript/object URLs/import failures/bundle/console/accessibility.
- [ ] Release review: existing Submission Hub modules, privacy, Actions, online Release and Pages.
- [ ] Run `npm run typecheck`, `npm run verify`, `npm run build` through CI and read failures directly.
- [ ] Squash merge PR only after all applicable Actions are green.
- [ ] Verify `https://qi-i.github.io/submission-hub/build-info.json` reports exactly the merge SHA.
