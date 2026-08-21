# Submission Hub Online Figure Composer Design

## Scope

This design replaces the temporary monolithic `FigureStudio.tsx` implementation in PR #107 with a native React + TypeScript Figure Composer integrated into the online Preparation workflow. The frozen offline release remains at `v2.0.1-offline-final` and is not modified by this design.

## Product boundary

Figure Composer is an online-only Submission Hub module. It does not iframe or copy the standalone FigMergeStudio HTML. Imported image bytes remain browser-local by default. The first production persistence layer is IndexedDB; Supabase stores no figure image bytes in this phase.

The Preparation workspace becomes six workflow sections:

1. 总览
2. 论文准备
3. 科研组图
4. 投稿材料
5. 期刊匹配
6. 投稿前检查

Figure Composer is a full-width professional workspace, not a dashboard card.

## Component architecture

`src/components/figure-composer/`

- `FigureComposer.tsx`: orchestration, project lifecycle, reducer, draft integration, preflight state.
- `FigureCanvas.tsx`: canvas rendering, pointer interaction, selection, drag, snapping guides.
- `FigureToolbar.tsx`: layout mode, alignment/distribution, zoom, auto-wrap and view controls.
- `FigureSidebar.tsx`: project identity, draft association, image import, layer order and labels.
- `FigurePanelInspector.tsx`: selected-panel geometry, aspect locking, grid span, label, border and layout values.
- `FigureExportPanel.tsx`: publication-size preset, unit/DPI/format and export actions.
- `FigurePreflightPanel.tsx`: submission-size and scientific-layout diagnostics.

`src/lib/figure-composer/`

- `types.ts`: serializable project/panel/text/export/preflight types.
- `geometry.ts`: resize, aspect, bounds, overlap, alignment and distribution.
- `layout.ts`: uniform/non-uniform grid, rowSpan/colSpan, A|B/C preset, auto-wrap.
- `snapping.ts`: edge/center/gap snap candidates and visible guide lines.
- `units.ts`: mm/cm/inch ↔ logical px ↔ output px conversions.
- `image-import.ts`: PNG/JPG/WEBP/SVG/TIFF/PDF import and object URL lifecycle.
- `project.ts`: IndexedDB project/asset persistence and draft-linked project queries.
- `validation.ts`: low-resolution, size, label, bounds, overlap, stretch, caption and export-format checks.
- `export.ts`: PNG/JPG/WEBP/TIFF/PDF/SVG generation.

No component owns duplicate copies of project state. `FigureComposer` uses a reducer and passes typed state/actions to children.

## Coordinate and publication model

Logical coordinates are design pixels at `BASE_DPI = 96`. View zoom changes only CSS/render scale and never mutates logical X/Y/W/H.

For a physical target width `w`:

- inches = mm / 25.4, cm / 2.54, or inch directly;
- logical width = inches × 96;
- output pixel width = inches × export DPI.

This keeps editing geometry stable while producing exact publication dimensions at arbitrary DPI.

`autoWrap` computes the union of all panel/text bounds, adds the configured margin, translates content if necessary, and sets the logical canvas to the resulting bounds. It never forces a fixed blank 2400×1800 area.

## Panel model

Each panel stores:

- id / assetId / name / source type;
- natural width and height;
- x / y / width / height;
- original aspect ratio and `lockAspectRatio`;
- grid row / column / rowSpan / colSpan;
- label visibility, text override, font, size, weight, position, color and X/Y offsets;
- border settings.

When aspect lock is active, editing width derives height and editing height derives width. Free W/H is allowed but preflight reports stretching when the rendered ratio materially differs from the source ratio.

## Non-uniform layout

Grid placement supports independent rowSpan/colSpan. The built-in `A | B/C` preset places panel A at row 0, column 0, rowSpan 2 and places B/C at row 0/1, column 1. Generic placement computes row/column occupancy rather than coercing panels to identical dimensions.

## Selection, alignment and snapping

- plain click: replace selection;
- Ctrl/Cmd click: toggle panel;
- Shift click: select the layer-order range;
- align: left/right/top/bottom/horizontal-center/vertical-center;
- distribute: horizontal/vertical equal spacing for 3+ selections;
- snap targets: canvas/panel edges, centers and configured uniform gap;
- active snap candidates render guide lines over the canvas.

## Labels and text

Default labels are `(a), (b), (c)` in Times New Roman. Automatic labels continue through `(z)`. Font, size, weight, position, color and offsets are editable. Free text objects have font/size/color/position and move independently.

## Import and object lifecycle

PNG/JPG/WEBP use browser decoding. SVG preserves source markup for vector export while also producing a renderable object URL. PDF and TIFF are decoded in the browser using the existing lightweight compatibility-loader strategy; failures are surfaced per file without aborting other imports.

Every object URL created for imported/persisted assets is revoked when an asset is removed, a project is closed, or the composer unmounts. Project persistence stores blobs in IndexedDB rather than base64 data in localStorage.

## Draft integration

A figure project stores `draftId`, figure role (`main` or `supplementary`), sequence number, title/caption and export summary. Display names are derived as `Figure 1`, `Figure 2`, or `Supplementary Figure S1`.

Saving/deleting projects recomputes the linked Manuscript Draft `figure_count`. The existing required checklist item `figures` remains user-controlled; the composer surfaces its preflight state beside it rather than silently marking it complete.

## Preflight

Checks include:

- source effective DPI below target;
- canvas dimensions outside target preset;
- inconsistent automatic-label typography;
- panel outside canvas;
- panel overlap;
- unlocked non-proportional stretch;
- missing figure title/caption;
- unsupported export format for the selected journal preset.

Checks are deterministic and return severity (`error`, `warning`, `info`) plus affected panel IDs where applicable.

## Export

Formats: PNG, JPG, WEBP, TIFF, PDF and SVG. Raster export uses physical-size/DPI conversion. SVG uses the logical `viewBox`, preserves image aspect semantics (`meet` unless explicit cover/crop is chosen), emits labels/free text as vector text, and retains source SVG data when available.

## UI

Desktop layout: compact top project bar, left asset/layer sidebar, central dominant canvas, right inspector/preflight/export column. Light/dark use existing Submission Hub tokens and blue-gray dark surfaces; no pure black, glassmorphism, gradients or decorative illustration.

At narrow widths the sidebars stack into sections and the canvas remains horizontally scrollable. Mobile shows project status and basic settings without collapsing or overlapping; complex placement displays a desktop recommendation.

## Online-only cleanup

After the final offline Release is verified, mainline online development removes the active offline runtime/build chain (`offline.html`, offline Vite entry/config, `src/offline.tsx`, `Offline*`, `check-offline-build`, offline npm scripts and `release-offline.yml`). Historical tags/releases preserve the old source and artifact.

## Release gates

1. architecture contract;
2. TypeScript/build;
3. scientific geometry/layout interaction tests;
4. light/dark and width regression;
5. existing Submission Hub regression and privacy checks;
6. PR CI green;
7. squash merge;
8. online v2.1.0 Release;
9. GitHub Pages deployment;
10. live `build-info.json.sha` must equal the merge SHA before the release is called online.
