# Changelog

This file documents learning-edition changes maintained in `sans764/kookit`. The engine package version remains `1.0.4`; entries below identify the application release that consumes the changes.

## Koodo Reader Learning Edition 2.4.9 — 2026-08-08

Active branch: `feature/word-decorations`

### Word decoration rendering — `e429374`

- Added `WordDecoration` models and public rendition methods for apply, clear, refresh, and click handling.
- Added runtime DOM wrapping without visible-text mutations.
- Added foreground-color preference for `text-color` decorations and retained background/underline/border styles.
- Added regression tests for nested markup, ruby, repeated apply/clear, selection behavior, text integrity, and saved ranges.
- Added a benchmark for large chapter decoration workloads.

### PDF layout scaling — `cc15449`

- Separated native PDF user scaling from reflowable content width.
- Added fit-to-container scale multiplication and scale-range tests.
- Removed application-specific PDF iframe width multiplication and special scale truncation.

### Responsive reader pagination — `cee5744`

- Removed the legacy width correction that conflicted with application-computed content width.
- Made pagination follow actual rendition container dimensions.
- Added responsive pagination tests for narrow windows and layout changes.

## Maintenance rules

- Make renderer changes in source files under `src/`; do not hand-edit generated `kookit.min.js` in the application repository.
- Every decoration change must preserve visible text and Range compatibility.
- Run `npm test` before synchronizing engine output.
- Run `npm run benchmark:word-decorations` for traversal or batching changes.
- Keep official upstream merges separate from learning-edition feature commits whenever possible.
