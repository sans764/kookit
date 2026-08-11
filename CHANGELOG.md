# Changelog

This file documents learning-edition changes maintained in `sans764/kookit`. The engine package version is `1.0.5`; entries below identify the application release that consumes the changes.
## Engine 1.0.5 / Koodo Reader Learning Edition 2.4.10 — 2026-08-11

### Adjustable reader font weight

- Added numeric 100–900 font-weight normalization with 100-step snapping and invalid-value rejection.
- Kept legacy `isBold=yes` compatibility at weight 700.
- Applied explicit numeric weight after font-family inference so the user setting wins deterministically.
- Added unit coverage for clamping, snapping, legacy values, CSS generation, and font-name inference.

### Instant word interaction

- Removed the delayed single-click timer from word-decoration delegation.
- Added synchronous event-emitter dispatch for word click and double-click only, leaving legacy asynchronous events unchanged.
- Kept the first click immediate, ignored the second click event, and emitted a dedicated double-click notification so native word selection remains usable.
- Added regression coverage for synchronous dispatch, duplicate-click suppression, and double-click handling.

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
