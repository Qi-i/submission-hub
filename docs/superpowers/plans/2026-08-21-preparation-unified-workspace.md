# Preparation Unified Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild 投稿准备 and the universal Figure Composer around one React state model, one visual system, and two layout adapters while preserving existing data contracts and scientific figure functions.

**Architecture:** Keep Supabase/IndexedDB contracts unchanged, lift preparation route state so Luminous and Luminous X consume the same state, remove DOM proxy navigation and dynamic DOM injection, and introduce shared Preparation primitives/tokens. Figure Composer remains a professional three-column workbench but consumes the same Submission Hub visual tokens and starts as a neutral unbound project.

**Tech Stack:** React 18, TypeScript 5.6, Vite 6, lucide-react, IndexedDB, Supabase, Playwright-based visual contracts.

**Spec:** `docs/superpowers/specs/2026-08-21-preparation-unified-workspace-design.md`

## Global Constraints

- New Figure Composer projects MUST start with `draftId = null` and MUST NOT read `drafts[0]`.
- New project name MUST be `未命名组图`; publication numbering is optional metadata and MUST NOT default the project identity to `Figure 1`.
- Real manuscript titles MUST NOT appear in the Figure Composer workbench header/breadcrumb/default identity.
- When `section === 'figures'`, the five business navigation items MUST NOT render.
- Business navigation order is fixed: 总览 / 论文准备 / 投稿材料 / 期刊匹配 / 投稿前检查.
- Each business navigation item uses the same icon/label/meta slot geometry and has a low-saturation non-active background.
- Luminous and Luminous X share the same preparation route state and functionality; no querySelector/MutationObserver/simulated-click navigation proxy is allowed.
- Preparation overview modules remain reorderable/collapsible without appendChild/createElement/MutationObserver DOM injection.
- Existing Supabase preparation CRUD, promote-to-submission flow, IndexedDB assets, figure export formats, layout, snapping, labels, preflight and `figure_count` synchronization remain functional.
- Central figure canvas stays neutral gray/white for scientific editing; surrounding chrome uses Submission Hub tokens.

---

### Task 1: Add unified architecture regression contract

**Files:**
- Create: `tests/preparation-unified-contract.mjs`
- Modify: `package.json`

**Produces:** `npm run check:preparation-unified` and a RED contract covering every P0 rule.

- [ ] Write source-level assertions for neutral Figure Composer initialization, neutral project naming, publication metadata separation, figures-mode nav hiding, slot-based five-item nav, absence of DOM proxy navigation, absence of dynamic DOM injection, and unified style imports.
- [ ] Add `check:preparation-unified` to `verify` before build.
- [ ] Run CI and confirm the contract fails on the current architecture for the expected reasons.

### Task 2: Neutralize Figure Composer project identity

**Files:**
- Modify: `src/lib/figure-composer/types.ts`
- Modify: `src/components/figure-composer/FigureComposer.tsx`
- Modify: `src/components/figure-composer/FigureSidebar.tsx`
- Modify: `src/lib/figure-composer/project.ts` if migration normalization is required
- Test: `tests/preparation-unified-contract.mjs`

**Interfaces:**
- `FigureProject.publicationLabel: string | null`
- `createEmptyFigureProject(draftId = null)` returns name `未命名组图`, publicationLabel `null`.

- [ ] Add optional publication label to project v2-compatible runtime normalization without breaking v1 IndexedDB projects.
- [ ] Remove implicit `drafts[0]` selection; new projects stay unbound unless `initialDraftId` is explicitly provided.
- [ ] Keep manuscript titles only inside the explicit association select; remove them from workbench header/subtitle identity.
- [ ] Separate project name from publication numbering controls.
- [ ] Run contract, typecheck and figure-studio contract.

### Task 3: Make preparation route state explicit and shared

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/OnlinePreparationWorkspace.tsx`
- Modify: `src/components/PreparationWorkspaceSuite.tsx`
- Modify: `src/components/PreparationWorkspace.tsx`
- Modify: `src/components/LuminousXStatusBar.tsx`
- Create: `src/components/preparation/PreparationNavigation.tsx`

**Interfaces:**
- `type PreparationSection = 'overview' | 'paper' | 'materials' | 'match' | 'check' | 'figures'`
- controlled props: `section`, `onSectionChange`

- [ ] Lift section state to Dashboard and pass it to both Luminous X status controls and the real preparation workspace.
- [ ] Replace Luminous X DOM lookup/MutationObserver click proxy with direct controlled buttons.
- [ ] Hide business navigation in figures mode and remember the previous business section for return.
- [ ] Convert legacy topic/draft/journal/compare navigations to local content actions inside their owning business page rather than primary route state.
- [ ] Run typecheck and navigation visual contracts.

### Task 4: Remove dynamic overview DOM injection

**Files:**
- Modify: `src/components/PreparationWorkspaceSuite.tsx`
- Modify: `src/components/PreparationWorkspace.tsx`
- Modify: `src/components/PreparationProductivityPanel.tsx` only if control props require adjustment
- Create: `src/components/preparation/PreparationOverviewModules.tsx`

**Interfaces:**
- React-rendered reorder/collapse state backed by existing localStorage keys.

- [ ] Replace appendChild/createElement/MutationObserver/createPortal overview injection with normal React children.
- [ ] Preserve module reorder, swap and topic collapse behavior.
- [ ] Keep localStorage compatibility keys.
- [ ] Add browser interaction assertions for reorder/collapse.

### Task 5: Introduce one Preparation visual system

**Files:**
- Create: `src/styles/preparation/tokens.css`
- Create: `src/styles/preparation/shell.css`
- Create: `src/styles/preparation/components.css`
- Create: `src/styles/preparation/workbench.css`
- Create: `src/styles/preparation/luminous.css`
- Create: `src/styles/preparation/luminous-x.css`
- Create: `src/styles/preparation/responsive.css`
- Modify: `src/app-styles.ts`
- Retire preparation-specific legacy imports that are fully replaced.

**Produces:** one Preparation token set mapped to Luminous/Luminous X.

- [ ] Define common surfaces, borders, text, accent palette, radii, shadows, control heights and spacing.
- [ ] Implement five equal navigation items with icon/label/meta slots and distinct low-saturation default backgrounds.
- [ ] Restyle overview, paper, materials, match and preflight page headers/panels/cards to common geometry.
- [ ] Map Figure Composer chrome to preparation tokens; remove independent brand palette while preserving neutral scientific canvas.
- [ ] Add Luminous and Luminous X adapters without changing component semantics.
- [ ] Run light/dark responsive visual contracts.

### Task 6: Figure Composer workbench integration

**Files:**
- Modify: `src/components/figure-composer/FigureComposer.tsx`
- Modify: `src/components/figure-composer/FigureSidebar.tsx`
- Modify: `src/components/figure-composer/FigureToolbar.tsx`
- Modify: `src/components/figure-composer/FigurePanelInspector.tsx`
- Modify: `src/components/figure-composer/FigurePreflightPanel.tsx`
- Modify: `src/components/figure-composer/FigureExportPanel.tsx`
- Modify: `src/figure-composer.css` or retire it after moving rules to `src/styles/preparation/workbench.css`

- [ ] Render unified breadcrumb `投稿准备 / 科研组图`, neutral project identity and return action.
- [ ] Keep full three-column professional layout, canvas, inspector, preflight and export behavior.
- [ ] Ensure figures mode contains no business navigation strip.
- [ ] Exercise import, auto grid, manual geometry, multi-select align/distribute, snapping, label settings, PNG and SVG export in browser smoke coverage.

### Task 7: Full dual-view regression and cleanup

**Files:**
- Modify visual tests under `tests/visual/`
- Modify `tests/figure-studio-contract.mjs` as needed
- Modify release docs only where architecture wording changes

- [ ] Verify Luminous and Luminous X at 1280, 1440, 1707, 1920 and 2560 CSS viewports.
- [ ] Verify light/dark, five business pages, Figure Composer entry/return, no horizontal overflow, consistent header/nav/card geometry.
- [ ] Verify real manuscript title never appears in a fresh workbench and `Figure 1` is absent until publication metadata is explicitly set.
- [ ] Run `npm run verify` and all seven existing browser workflows.
- [ ] Inspect generated screenshots manually.
- [ ] Remove temporary scripts/workflows/build caches and obsolete preparation style imports.
- [ ] Merge only after every current-head gate is green and Pages live SHA matches the merge SHA.
