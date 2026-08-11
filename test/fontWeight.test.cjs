const test = require("node:test");
const assert = require("node:assert/strict");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs" },
});

const {
  normalizeFontWeight,
  resolveReaderFontWeight,
} = require("../src/utils/fontWeightUtil.ts");
const StyleHelper = require("../src/helpers/styleHelper.ts").default;

const config = (values = {}) => ({
  getReaderConfig(key) {
    return values[key] ?? "";
  },
});

test("normalizes font weights to the supported 100-900 range", () => {
  assert.equal(normalizeFontWeight(50), "100");
  assert.equal(normalizeFontWeight(575), "600");
  assert.equal(normalizeFontWeight(950), "900");
  assert.equal(normalizeFontWeight("bad"), null);
  assert.equal(normalizeFontWeight(""), null);
});

test("explicit numeric weight wins over the legacy bold switch", () => {
  assert.equal(resolveReaderFontWeight("500"), "500");
  assert.equal(resolveReaderFontWeight("yes"), "700");
  assert.equal(resolveReaderFontWeight("no"), null);
  assert.equal(resolveReaderFontWeight("bad"), null);
});

test("custom reader CSS emits numeric weight and preserves legacy compatibility", () => {
  const explicitCss = StyleHelper.getCustomCss(
    config({ isBold: "600" })
  );
  assert.match(explicitCss, /font-weight: 600 !important/);
  assert.doesNotMatch(explicitCss, /font-weight: bold !important/);

  const legacyCss = StyleHelper.getCustomCss(config({ isBold: "yes" }));
  assert.match(legacyCss, /font-weight: 700 !important/);
});

test("font-family inference remains active when no explicit weight is configured", () => {
  const css = StyleHelper.getCustomCss(config({ fontFamily: "Example Medium" }));
  assert.match(css, /font-weight: 500 !important/);
});
