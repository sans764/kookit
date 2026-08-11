# Kookit Learning Engine Fork

Public upstream-tracking fork of [Kookit](https://github.com/koodo-reader/kookit), the rendering engine used by [Koodo Reader](https://github.com/koodo-reader/koodo-reader).

> [!IMPORTANT]
> The default `dev` branch remains the upstream-oriented engine baseline. Learning-edition changes are maintained on [`feature/word-decorations`](https://github.com/sans764/kookit/tree/feature/word-decorations) and consumed by the private `sans764/koodo-reader-learning` application. This is not a standalone reader application.

## Repository relationship

| Repository | Role |
| --- | --- |
| [`koodo-reader/kookit`](https://github.com/koodo-reader/kookit) | Official upstream rendering engine |
| [`sans764/kookit`](https://github.com/sans764/kookit) | Public engine fork and learning-renderer source |
| [`sans764/koodo-reader`](https://github.com/sans764/koodo-reader) | Public upstream-tracking application baseline |
| `sans764/koodo-reader-learning` | Private active learning-edition application and desktop releases |

The engine is built here. The generated `kookit.min.js` is synchronized into `reader-app/src/assets/lib/`; generated application assets must not be edited by hand.

## Learning-edition changes

The active `feature/word-decorations` branch adds three groups of changes on top of `dev`.

### Word decorations

- Runtime-only word wrapping that does not modify the source ebook.
- Text-color, background, underline, border, and hidden decoration styles.
- Batched application, complete cleanup, and targeted refresh for changed terms.
- Delegated `word-click` events with word keys and DOM-range helpers.
- Skips scripts, styles, ruby content, note wrappers, hidden content, and other unsafe nodes.
- Preserves visible text, character counts, selections, saved ranges, and Koodo highlights.

The public rendition surface includes:

```ts
rendition.applyWordDecorations(decorationMap, options);
rendition.clearWordDecorations();
rendition.refreshWordDecorations(changedTerms);
rendition.on("word-click", handler);
```

### Reader typography

- Resolves numeric font weights from 100 to 900 in 100-step increments.
- Preserves legacy `isBold=yes` as weight 700 and treats `isBold=no` as no override.
- Explicit numeric weight overrides font-family name inference; Light, Medium, Bold, and similar inference remains active when no explicit value is stored.
- Uses the existing style key so global and per-book independent styles remain compatible without changing compressed Koodo configuration dependencies.

### Reader layout and pagination

- Responsive pagination uses the actual container size without the previous fixed-width correction.
- Reflowable content can switch between fixed-width centered and independent-margin layouts.
- Pagination tests cover narrow viewports and changing container dimensions.

### PDF scaling

- Native PDF scaling is separated from reflowable content width.
- Effective PDF scale is calculated as fit-to-container scale multiplied by the user scale.
- Removes application-specific iframe width multipliers and special truncation behavior.

See [CHANGELOG.md](./CHANGELOG.md) for commit-level compatibility notes.

## Architecture

Kookit is written in TypeScript and built with Rollup. Major dependencies include:

| Package | Purpose |
| --- | --- |
| `foliate-js` | EPUB, MOBI, AZW3, and FB2 rendering |
| `pdf-js` | PDF rendering |
| `rangy` | Selection and Range utilities |
| `mammoth` | DOCX to HTML conversion |
| `marked` | Markdown conversion |
| `jszip`, `@zip.js/zip.js`, `fflate` | Archive handling |
| `7z-wasm`, `js-untar` | Comic/archive formats |

## Development

Requirements: Node.js, npm or Yarn, and Git.

```shell
git clone https://github.com/sans764/kookit.git
cd kookit
git switch feature/word-decorations
npm install
```

Development watch and production build:

```shell
npm run dev
npm run build
```

Tests and benchmark:

```shell
npm test
npm run benchmark:word-decorations
```

Generate types and API documentation when public interfaces change:

```shell
npm run build:types
npm run docs
```

## Application integration

With `reader-app` and `reader-engine` as sibling directories:

```shell
cd ../reader-app
npm run build:engine
npm run sync:engine
```

The synchronization script verifies source and destination paths before replacing the generated application asset. Commit engine source and tests in this repository; commit only the required built runtime file in the application repository.

## Compatibility

- Engine package version: `1.0.5`.
- Current learning application compatibility: Koodo Reader Learning Edition `2.4.10`.
- Active engine branch head before this documentation update: `cee5744`.

## License

This fork remains licensed under [GNU AGPL v3](./LICENSE), matching the official Kookit project. Distributed modified applications and network-hosted derivatives must provide access to the corresponding source and retain upstream notices.
