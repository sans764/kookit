const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs" },
});

const { handleLayout } = require("../src/utils/layoutUtil.ts");

const renderLayout = (readerMode, width = 960, height = 640) => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
  global.window = dom.window;
  const element = { clientWidth: width, clientHeight: height };
  handleLayout(element, readerMode, dom.window.document);
  return dom.window.document.body.style;
};

test("single-page layout keeps one responsive column", () => {
  const style = renderLayout("single");
  assert.equal(style.width, "100%");
  assert.equal(style.height, "100%");
  assert.equal(style.columnCount, "1");
  assert.equal(style.columnWidth, "auto");
});

test("double-page layout keeps exactly two responsive columns", () => {
  const style = renderLayout("double");
  assert.equal(style.width, "100%");
  assert.equal(style.height, "100%");
  assert.equal(style.columnCount, "2");
  assert.equal(style.columnWidth, "auto");
});

test("column count does not grow when the outer viewport becomes wider", () => {
  const style = renderLayout("double", 960);
  assert.equal(style.columnCount, "2");
  assert.equal(style.width, "100%");
  assert.equal(style.columnWidth, "auto");
  assert.equal(style.columnGap, "80px");
});
