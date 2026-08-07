const test = require("node:test");
const assert = require("node:assert/strict");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs" },
});

const {
  applyPdfScaleMultiplier,
  normalizePdfScaleMultiplier,
} = require("../src/utils/pdfScaleUtil.ts");

test("normalizes PDF page scale to the shared 50%-300% range", () => {
  assert.equal(normalizePdfScaleMultiplier(0.1), 0.5);
  assert.equal(normalizePdfScaleMultiplier(4), 3);
  assert.equal(normalizePdfScaleMultiplier("bad"), 1);
});

test("applies page zoom after calculating fit-to-container scale", () => {
  assert.ok(
    Math.abs(applyPdfScaleMultiplier(0.8, 1.5) - 1.2) < Number.EPSILON * 2
  );
  assert.ok(
    Math.abs(applyPdfScaleMultiplier(0.8, 9) - 2.4) < Number.EPSILON * 3
  );
});
