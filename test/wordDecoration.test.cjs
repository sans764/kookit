const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs" },
});

const {
  applyWordDecorations,
  applyWordDecorationsBatched,
  clearWordDecorations,
  refreshWordDecorations,
  normalizeVocabularyToken,
  selectWordDecoration,
} = require("../src/utils/wordDecorationUtil.ts");
const EventEmitter = require("../src/utils/EventEmitter.ts").default;

const installDomGlobals = (window) => {
  global.NodeFilter = window.NodeFilter;
  global.CSS = {
    escape(value) {
      return String(value).replace(/(["\\])/g, "\\$1");
    },
  };
  if (typeof window.document.createRange !== "function") {
    const doc = window.document;
    let activeRange = null;
    const textNodes = () => {
      const walker = doc.createTreeWalker(
        doc.body,
        window.NodeFilter.SHOW_TEXT
      );
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      return nodes;
    };
    const absoluteOffset = (target, offset) => {
      let consumed = 0;
      for (const node of textNodes()) {
        if (node === target) return consumed + offset;
        consumed += node.textContent.length;
      }
      return consumed;
    };
    doc.createRange = () => ({
      selectedNode: null,
      startNode: null,
      startOffset: 0,
      endNode: null,
      endOffset: 0,
      selectNodeContents(node) {
        this.selectedNode = node;
      },
      setStart(node, offset) {
        this.startNode = node;
        this.startOffset = offset;
      },
      setEnd(node, offset) {
        this.endNode = node;
        this.endOffset = offset;
      },
      toString() {
        if (this.selectedNode) return this.selectedNode.textContent;
        const text = doc.body.textContent;
        return text.slice(
          absoluteOffset(this.startNode, this.startOffset),
          absoluteOffset(this.endNode, this.endOffset)
        );
      },
    });
    doc.getSelection = () => ({
      removeAllRanges() {
        activeRange = null;
      },
      addRange(range) {
        activeRange = range;
      },
      toString() {
        return activeRange ? activeRange.toString() : "";
      },
    });
  }
};

const decoration = (key, levelId, color) => ({
  key,
  lemma: key.split(":")[1],
  levelId,
  backgroundColor: color,
  decorationType: "background",
  opacity: 0.35,
  userAdded: true,
});

test("normalizes Unicode quotes, dashes and case", () => {
  assert.equal(normalizeVocabularyToken("Don’t", "en"), "don't");
  assert.equal(normalizeVocabularyToken("RE–READING", "en"), "re-reading");
});
test("triggerNow dispatches interactive events synchronously", () => {
  const emitter = new EventEmitter();
  let payload = null;
  emitter.on("word-click", (value) => {
    payload = value;
    return "handled";
  });

  const result = emitter.triggerNow("word-click", [{ surface: "went" }]);
  assert.deepEqual(payload, { surface: "went" });
  assert.equal(result, "handled");
});
test("text-color decorations prefer foreground color and refresh in place", () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body><p>Books, books.</p></body></html>");
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  const initial = {
    ...decoration("en:book", 1, "#ef5350"),
    foregroundColor: "#b71c1c",
    decorationType: "text-color",
  };
  const before = doc.body.textContent;
  applyWordDecorations(new Map([["books", initial]]), doc, { language: "en" });

  const words = Array.from(doc.querySelectorAll(".kookit-vocab-word"));
  assert.equal(words.length, 2);
  assert.equal(doc.body.textContent, before);
  words.forEach((word) => {
    assert.equal(word.dataset.decoration, "text-color");
    assert.equal(word.style.getPropertyValue("--kookit-vocab-color"), "#b71c1c");
    assert.equal(word.style.backgroundColor, "");
  });

  const refreshed = refreshWordDecorations(
    [{ ...initial, levelId: 4, foregroundColor: "#1b5e20" }],
    doc
  );
  assert.equal(refreshed, 2);
  words.forEach((word) => {
    assert.equal(word.dataset.vocabLevel, "4");
    assert.equal(word.style.getPropertyValue("--kookit-vocab-color"), "#1b5e20");
  });
});

test("decorating and clearing preserves the exact visible text", () => {
  const dom = new JSDOM(
    "<!doctype html><html><head></head><body><p>Went to the library. Books remain.</p><ruby>漢<rt>かん</rt></ruby><script>const Books = 1;</script></body></html>"
  );
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  const before = doc.body.textContent;
  const count = applyWordDecorations(
    new Map([
      ["went", decoration("en:go", 2, "#ff9800")],
      ["books", decoration("en:book", 1, "#ef5350")],
    ]),
    doc,
    { language: "en" }
  );

  assert.equal(count, 2);
  assert.equal(doc.body.textContent, before);
  assert.equal(doc.querySelectorAll(".kookit-vocab-word").length, 2);
  assert.equal(doc.querySelectorAll("ruby .kookit-vocab-word").length, 0);
  assert.equal(doc.querySelectorAll("script .kookit-vocab-word").length, 0);

  clearWordDecorations(doc);
  assert.equal(doc.body.textContent, before);
  assert.equal(doc.querySelectorAll(".kookit-vocab-word").length, 0);
});

test("repeated apply and clear leaves no residual wrappers", () => {
  const dom = new JSDOM("<!doctype html><body><p>Books and books.</p></body>");
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  const map = new Map([["books", decoration("en:book", 1, "#ef5350")]]);
  for (let index = 0; index < 5; index++) {
    clearWordDecorations(doc);
    applyWordDecorations(map, doc, { language: "en" });
    assert.equal(doc.querySelectorAll(".kookit-vocab-word").length, 2);
  }
  clearWordDecorations(doc);
  assert.equal(doc.body.innerHTML, "<p>Books and books.</p>");
});

test("refresh updates every occurrence without replacing text", () => {
  const dom = new JSDOM("<!doctype html><body><p>Books, books.</p></body>");
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  applyWordDecorations(
    new Map([["books", decoration("en:book", 1, "#ef5350")]]),
    doc,
    { language: "en" }
  );
  const before = doc.body.textContent;
  const refreshed = refreshWordDecorations(
    [decoration("en:book", 4, "#81c784")],
    doc
  );
  assert.equal(refreshed, 2);
  assert.equal(doc.body.textContent, before);
  doc.querySelectorAll(".kookit-vocab-word").forEach((node) => {
    assert.equal(node.dataset.vocabLevel, "4");
  });
});

test("selects the clicked word, complete sentence and paragraph", () => {
  const dom = new JSDOM(
    "<!doctype html><body><p>First sentence. Books are <em>here</em>! Last.</p></body>"
  );
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  applyWordDecorations(
    new Map([["books", decoration("en:book", 1, "#ef5350")]]),
    doc,
    { language: "en" }
  );
  const word = doc.querySelector(".kookit-vocab-word");
  const instanceId = word.dataset.vocabInstance;
  assert.equal(
    selectWordDecoration(doc, instanceId, "word").text,
    "Books"
  );
  assert.equal(
    selectWordDecoration(doc, instanceId, "sentence").text,
    "Books are here!"
  );
  assert.equal(
    selectWordDecoration(doc, instanceId, "paragraph").text,
    "First sentence. Books are here! Last."
  );
});

test("refresh resolves inflected forms without replacing word instances", () => {
  const dom = new JSDOM("<!doctype html><body><p>Went and goes.</p></body>");
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  const unknown = decoration("en:{term}", 0, "#ffd54f");
  applyWordDecorations(new Map(), doc, {
    language: "en",
    defaultDecoration: unknown,
  });
  const beforeInstances = Array.from(
    doc.querySelectorAll(".kookit-vocab-word")
  ).map((node) => node.dataset.vocabInstance);
  const changed = {
    ...decoration("en:go", 2, "#ff9800"),
    lemma: "go",
    surface: "Went",
  };
  const refreshed = refreshWordDecorations(
    [changed],
    doc,
    {
      resolveDecoration: (_surface, normalized) =>
        normalized === "went" || normalized === "goes" ? changed : undefined,
    }
  );
  assert.equal(refreshed, 2);
  assert.deepEqual(
    Array.from(doc.querySelectorAll(".kookit-vocab-word")).map(
      (node) => node.dataset.vocabInstance
    ),
    beforeInstances
  );
});
test("keeps filtered words clickable without showing their familiarity style", () => {
  const dom = new JSDOM(
    "<!doctype html><body><p>Unknown Learning</p></body>"
  );
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  const count = applyWordDecorations(
    new Map([
      ["unknown", decoration("en:unknown", 0, "#ffd54f")],
      ["learning", decoration("en:learning", 2, "#ff9800")],
    ]),
    doc,
    { mode: "learning", wrapHiddenWords: true }
  );
  assert.equal(count, 2);
  const words = Array.from(doc.querySelectorAll(".kookit-vocab-word"));
  assert.equal(words[0].dataset.decoration, "none");
  assert.equal(words[1].dataset.decoration, "background");

  const refreshed = refreshWordDecorations(
    [{ ...decoration("en:learning", 4, "#81c784"), lemma: "learning" }],
    doc,
    { mode: "learning", wrapHiddenWords: true }
  );
  assert.equal(refreshed, 1);
  assert.equal(words[1].dataset.decoration, "none");
});

test("opens decorated words immediately and handles double-click separately", () => {
  const dom = new JSDOM("<!doctype html><body><p>Books.</p></body>");
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  const clicks = [];
  let doubleClicks = 0;

  applyWordDecorations(
    new Map([["books", decoration("en:book", 1, "#ef5350")]]),
    doc,
    {
      language: "en",
      onWordClick: (payload) => clicks.push(payload),
      onWordDoubleClick: () => {
        doubleClicks += 1;
      },
    }
  );

  const word = doc.querySelector(".kookit-vocab-word");
  word.dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, detail: 1 })
  );
  assert.equal(clicks.length, 1);
  assert.equal(clicks[0].surface, "Books");

  word.dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, detail: 2 })
  );
  assert.equal(clicks.length, 1);

  word.dispatchEvent(
    new dom.window.MouseEvent("dblclick", { bubbles: true, detail: 2 })
  );
  assert.equal(doubleClicks, 1);
});

test("batched decoration reports the first visible batch and preserves text", async () => {
  const dom = new JSDOM(
    "<!doctype html><body><p>Books one.</p><p>Books two.</p><p>Books three.</p></body>"
  );
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  const before = doc.body.textContent;
  const firstBatches = [];
  const count = await applyWordDecorationsBatched(
    new Map([["books", decoration("en:book", 1, "#ef5350")]]),
    doc,
    {
      language: "en",
      batchSize: 1,
      onFirstBatch: (decoratedCount, processedNodeCount) => {
        firstBatches.push([decoratedCount, processedNodeCount]);
      },
    }
  );

  assert.equal(count, 3);
  assert.deepEqual(firstBatches, [[1, 1]]);
  assert.equal(doc.body.textContent, before);
  assert.equal(doc.querySelectorAll(".kookit-vocab-word").length, 3);
});

test("batched decoration can be aborted between batches", async () => {
  const dom = new JSDOM(
    "<!doctype html><body><p>Books one.</p><p>Books two.</p><p>Books three.</p></body>"
  );
  installDomGlobals(dom.window);
  const doc = dom.window.document;
  const controller = new AbortController();
  await assert.rejects(
    applyWordDecorationsBatched(
      new Map([["books", decoration("en:book", 1, "#ef5350")]]),
      doc,
      {
        language: "en",
        batchSize: 1,
        signal: controller.signal,
        onFirstBatch: () => controller.abort(),
      }
    ),
    (error) => error?.name === "AbortError"
  );
  assert.equal(doc.querySelectorAll(".kookit-vocab-word").length, 1);
});
