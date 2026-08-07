const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { JSDOM } = require("jsdom");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs" },
});
const {
  applyWordDecorationsBatched,
  clearWordDecorations,
  refreshWordDecorations,
} = require("../src/utils/wordDecorationUtil.ts");

const fixture = path.resolve(
  __dirname,
  "..",
  "..",
  "reader-app",
  "test",
  "fixtures",
  "learning",
  "large-chapter.html"
);
const html = fs.readFileSync(fixture, "utf8");
const dom = new JSDOM(html, { pretendToBeVisual: true });
global.NodeFilter = dom.window.NodeFilter;
global.DOMException = dom.window.DOMException;
const doc = dom.window.document;
const originalText = doc.body.textContent;
const controller = new AbortController();
let firstBatchMs = null;
let firstBatchDecorated = 0;
let firstBatchNodes = 0;
const startedAt = performance.now();

applyWordDecorationsBatched(new Map(), doc, {
  language: "en",
  batchSize: 750,
  signal: controller.signal,
  defaultDecoration: {
    key: "en:{term}",
    lemma: "",
    levelId: 0,
    backgroundColor: "#ffd54f",
    decorationType: "background",
    opacity: 0.35,
  },
  onFirstBatch(decoratedCount, processedNodeCount) {
    firstBatchMs = performance.now() - startedAt;
    firstBatchDecorated = decoratedCount;
    firstBatchNodes = processedNodeCount;
  },
}).then((decoratedCount) => {
  const totalMs = performance.now() - startedAt;
  assert.equal(firstBatchNodes, 750);
  assert.ok(firstBatchDecorated > 0);
  assert.ok(decoratedCount > firstBatchDecorated);
  assert.equal(doc.body.textContent, originalText);
  assert.equal(
    doc.querySelectorAll(".kookit-vocab-word").length,
    decoratedCount
  );
  const sample = doc.querySelector(".kookit-vocab-word");
  assert.ok(sample);
  const refreshStartedAt = performance.now();
  const refreshedCount = refreshWordDecorations(
    [
      {
        key: sample.dataset.vocabKey,
        surface: sample.dataset.vocabSurface,
        lemma: sample.dataset.vocabLemma,
        levelId: 2,
        backgroundColor: "#ff9800",
        decorationType: "background",
        opacity: 0.35,
      },
    ],
    doc
  );
  const refreshMs = performance.now() - refreshStartedAt;
  assert.ok(refreshedCount > 0);
  clearWordDecorations(doc);
  assert.equal(doc.body.textContent, originalText);
  const result = {
    fixtureParagraphs: 2500,
    batchSize: 750,
    decoratedCount,
    firstBatchMs: Number(firstBatchMs.toFixed(1)),
    totalMs: Number(totalMs.toFixed(1)),
    firstBatchTargetMs: 500,
    firstBatchTargetMet: firstBatchMs <= 500,
    refreshedCount,
    refreshMs: Number(refreshMs.toFixed(1)),
    refreshTargetMs: 100,
    refreshTargetMet: refreshMs <= 100,
    textPreserved: true,
  };
  console.log(JSON.stringify(result, null, 2));
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});