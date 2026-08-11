import {
  WordClickPayload,
  WordDecoration,
  WordDecorationMap,
  WordDecorationOptions,
  WordSelectionResult,
  WordSelectionScope,
} from "../model/wordDecoration";

const WORD_CLASS = "kookit-vocab-word";
const STYLE_ID = "kookit-vocab-word-style";
const DELEGATION_KEY = "__kookitWordDecorationDelegated";
const CLICK_HANDLER_KEY = "__kookitWordDecorationClickHandler";
const DOUBLE_CLICK_HANDLER_KEY = "__kookitWordDecorationDoubleClickHandler";
const INSTANCE_COUNTER_KEY = "__kookitWordDecorationInstanceCounter";
const WORD_INDEX = new WeakMap<
  Document,
  Map<string, Set<HTMLElement>>
>();

const removeFromWordIndex = (span: HTMLElement, key?: string) => {
  const indexedKey = key || span.dataset.vocabKey;
  if (!indexedKey) return;
  const index = WORD_INDEX.get(span.ownerDocument);
  const entries = index?.get(indexedKey);
  entries?.delete(span);
  if (entries?.size === 0) index?.delete(indexedKey);
};

const addToWordIndex = (span: HTMLElement, key: string) => {
  let index = WORD_INDEX.get(span.ownerDocument);
  if (!index) {
    index = new Map();
    WORD_INDEX.set(span.ownerDocument, index);
  }
  let entries = index.get(key);
  if (!entries) {
    entries = new Set();
    index.set(key, entries);
  }
  entries.add(span);
};

const ENGLISH_WORD_PATTERN =
  /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*(?:-[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*)*/gu;

const SKIPPED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "RUBY",
  "RT",
  "RP",
  "TEXTAREA",
  "NOSCRIPT",
  "CODE",
  "PRE",
]);

const SKIPPED_CLASSES = [
  "kookit-vocab-word",
  "kookit-word-def",
  "kookit-text-rule-replace",
  "kookit-text-rule-delete",
  "kookit-note-tooltip",
  "kookit-word-tooltip",
];

export const normalizeVocabularyToken = (
  value: string,
  language: string = "en"
) => {
  const normalized = value
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑‒–—]/g, "-");
  return language.toLowerCase().startsWith("en")
    ? normalized.toLocaleLowerCase("en")
    : normalized.toLocaleLowerCase();
};

const getDecoration = (
  decorationMap: WordDecorationMap,
  normalized: string
) => {
  if (decorationMap instanceof Map) {
    return decorationMap.get(normalized);
  }
  return decorationMap[normalized];
};

const shouldDisplay = (
  decoration: WordDecoration,
  options: WordDecorationOptions
) => {
  const mode = options.mode || "all";
  if (decoration.decorationType === "none") return false;
  if (mode === "user-added") return decoration.userAdded === true;
  if (mode === "learning") {
    const visibleLevels = options.learningLevelIds || [1, 2];
    return visibleLevels.includes(decoration.levelId);
  }
  return true;
};

const ensureStyles = (doc: Document) => {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.${WORD_CLASS} {
  --kookit-vocab-color: transparent;
  --kookit-vocab-opacity: 0.35;
  border-radius: 0.12em;
  cursor: pointer;
}
.${WORD_CLASS}[data-decoration="background"] {
  background-color: color-mix(
    in srgb,
    var(--kookit-vocab-color) calc(var(--kookit-vocab-opacity) * 100%),
    transparent
  );
}
.${WORD_CLASS}[data-decoration="underline"] {
  text-decoration-line: underline;
  text-decoration-color: var(--kookit-vocab-color);
  text-decoration-thickness: 0.12em;
  text-underline-offset: 0.12em;
}
.${WORD_CLASS}[data-decoration="border"] {
  box-shadow: inset 0 -0.12em 0 var(--kookit-vocab-color);
}
.${WORD_CLASS}[data-decoration="text-color"] {
  color: var(--kookit-vocab-color) !important;
}
.kookit-note .${WORD_CLASS}[data-decoration="background"] {
  background-color: transparent;
  text-decoration-line: underline;
  text-decoration-color: var(--kookit-vocab-color);
  text-decoration-thickness: 0.12em;
  text-underline-offset: 0.12em;
}
`;
  (doc.head || doc.documentElement).appendChild(style);
};

const setDecorationPresentation = (
  span: HTMLElement,
  decoration: WordDecoration
) => {
  const color =
    decoration.decorationType === "text-color"
      ? decoration.foregroundColor || decoration.backgroundColor || "transparent"
      : decoration.backgroundColor || decoration.foregroundColor || "transparent";
  const opacity = Math.max(0, Math.min(1, decoration.opacity));
  span.dataset.vocabLevel = String(decoration.levelId);
  span.dataset.decoration = decoration.decorationType;
  span.style.setProperty("--kookit-vocab-color", color);
  span.style.setProperty("--kookit-vocab-opacity", String(opacity));
};

const setDecorationAttributes = (
  span: HTMLElement,
  decoration: WordDecoration,
  surface: string,
  normalized: string
) => {
  const previousKey = span.dataset.vocabKey;
  if (previousKey && previousKey !== decoration.key) {
    removeFromWordIndex(span, previousKey);
  }
  span.className = WORD_CLASS;
  span.dataset.vocabKey = decoration.key;
  span.dataset.vocabLemma = decoration.lemma;
  span.dataset.vocabNormalized = normalized;
  span.dataset.vocabSurface = surface;
  setDecorationPresentation(span, decoration);
  addToWordIndex(span, decoration.key);
};

const isSkippedTextNode = (node: Text, allowVocabularyWord = false) => {
  let parent = node.parentElement;
  while (parent) {
    if (SKIPPED_TAGS.has(parent.tagName)) return true;
    if (
      SKIPPED_CLASSES.some((className) =>
        parent?.classList.contains(className) && (className !== WORD_CLASS || !allowVocabularyWord)
      )
    ) {
      return true;
    }
    if (
      parent.hidden ||
      parent.getAttribute("aria-hidden") === "true" ||
      parent.getAttribute("contenteditable") === "true"
    ) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
};

const toClickPayload = (
  target: HTMLElement,
  event: MouseEvent
): WordClickPayload => {
  const rect = target.getBoundingClientRect();
  return {
    key: target.dataset.vocabKey || "",
    surface: target.dataset.vocabSurface || target.textContent || "",
    normalized: target.dataset.vocabNormalized || "",
    lemma: target.dataset.vocabLemma || "",
    instanceId: target.dataset.vocabInstance || "",
    levelId: Number(target.dataset.vocabLevel || 0),
    clientX: event.clientX,
    clientY: event.clientY,
    rect: {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  };
};

const registerWordClickDelegation = (
  doc: Document,
  onWordClick?: (payload: WordClickPayload) => void,
  onWordDoubleClick?: () => void
) => {
  const body = doc.body as any;
  body[CLICK_HANDLER_KEY] = onWordClick;
  body[DOUBLE_CLICK_HANDLER_KEY] = onWordDoubleClick;
  if (body[DELEGATION_KEY]) return;
  body[DELEGATION_KEY] = true;

  body.addEventListener(
    "click",
    (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest?.(
        `.${WORD_CLASS}`
      ) as HTMLElement | null;
      if (!target) return;
      const selection = doc.getSelection()?.toString() || "";
      if (selection.trim()) return;

      const invoke = () => {
        const handler = body[CLICK_HANDLER_KEY] as
          | ((payload: WordClickPayload) => void)
          | undefined;
        handler?.(toClickPayload(target, event));
      };

      // The first click opens the vocabulary popup immediately. A real
      // double-click emits a second click with detail > 1, which is ignored.
      if (event.detail > 1) return;
      invoke();
    },
    true
  );

  body.addEventListener(
    "dblclick",
    (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest?.(
        "." + WORD_CLASS
      );
      if (!target) return;
      const handler = body[DOUBLE_CLICK_HANDLER_KEY] as
        | (() => void)
        | undefined;
      handler?.();
    },
    true
  );
};

const makeDefaultDecoration = (
  template: WordDecoration,
  normalized: string,
  surface: string,
  language: string
): WordDecoration => ({
  ...template,
  key: template.key
    ? template.key.replace("{term}", normalized)
    : `${language}:${normalized}`,
  lemma: normalized,
  surface,
});

const throwIfAborted = (signal?: AbortSignal) => {
  if (!signal?.aborted) return;
  if (typeof DOMException === "function") {
    throw new DOMException("Word decoration was aborted", "AbortError");
  }
  const error = new Error("Word decoration was aborted");
  error.name = "AbortError";
  throw error;
};

const collectTextNodes = (doc: Document, root: Element) => {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) =>
      isSkippedTextNode(node as Text)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  return textNodes;
};

const decorateTextNode = (
  textNode: Text,
  decorationMap: WordDecorationMap,
  doc: Document,
  options: WordDecorationOptions,
  language: string
) => {
  const text = textNode.textContent || "";
  ENGLISH_WORD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let matched = false;
  let decoratedCount = 0;
  const fragment = doc.createDocumentFragment();

  while ((match = ENGLISH_WORD_PATTERN.exec(text)) !== null) {
    throwIfAborted(options.signal);
    const surface = match[0];
    const normalized = normalizeVocabularyToken(surface, language);
    const configured = getDecoration(decorationMap, normalized);
    const decoration =
      configured ||
      options.resolveDecoration?.(surface, normalized) ||
      (options.defaultDecoration
        ? makeDefaultDecoration(
            options.defaultDecoration,
            normalized,
            surface,
            language
          )
        : undefined);
    if (!decoration) continue;
    const renderedDecoration = shouldDisplay(decoration, options)
      ? decoration
      : options.wrapHiddenWords
        ? { ...decoration, decorationType: "none" as const, opacity: 0 }
        : undefined;
    if (!renderedDecoration) continue;

    const before = text.slice(lastIndex, match.index);
    if (before) fragment.appendChild(doc.createTextNode(before));
    const span = doc.createElement("span");
    const body = doc.body as any;
    body[INSTANCE_COUNTER_KEY] = (body[INSTANCE_COUNTER_KEY] || 0) + 1;
    span.dataset.vocabInstance = `vocab-${body[INSTANCE_COUNTER_KEY]}`;
    setDecorationAttributes(span, renderedDecoration, surface, normalized);
    span.appendChild(doc.createTextNode(surface));
    fragment.appendChild(span);
    lastIndex = match.index + surface.length;
    matched = true;
    decoratedCount++;
  }

  if (!matched) return 0;
  const after = text.slice(lastIndex);
  if (after) fragment.appendChild(doc.createTextNode(after));
  textNode.parentNode?.replaceChild(fragment, textNode);
  return decoratedCount;
};

const yieldToMainThread = (doc: Document) =>
  new Promise<void>((resolve) => {
    const view = doc.defaultView as any;
    if (typeof view?.requestIdleCallback === "function") {
      view.requestIdleCallback(() => resolve(), { timeout: 50 });
      return;
    }
    (view?.setTimeout || setTimeout)(resolve, 0);
  });
export const clearWordDecorations = (
  doc: Document,
  rootElement?: Element
) => {
  const root = rootElement || doc.body;
  const spans = Array.from(
    root.querySelectorAll(`.${WORD_CLASS}`)
  ) as HTMLElement[];
  const parents = new Set<Node>();
  for (const span of spans) {
    removeFromWordIndex(span);
    const parent = span.parentNode;
    if (!parent) continue;
    parents.add(parent);
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  }
  parents.forEach((parent) => parent.normalize());
};

export const applyWordDecorations = (
  decorationMap: WordDecorationMap,
  doc: Document,
  options: WordDecorationOptions = {}
) => {
  const root = options.rootElement || doc.body;
  const language = options.language || "en";
  ensureStyles(doc);
  registerWordClickDelegation(
    doc,
    options.onWordClick,
    options.onWordDoubleClick
  );
  throwIfAborted(options.signal);
  const textNodes = collectTextNodes(doc, root);

  let decoratedCount = 0;
  for (const textNode of textNodes) {
    throwIfAborted(options.signal);
    decoratedCount += decorateTextNode(
      textNode,
      decorationMap,
      doc,
      options,
      language
    );
  }
  return decoratedCount;
};

export const applyWordDecorationsBatched = async (
  decorationMap: WordDecorationMap,
  doc: Document,
  options: WordDecorationOptions = {}
) => {
  const root = options.rootElement || doc.body;
  const language = options.language || "en";
  const batchSize = Math.max(1, Math.floor(options.batchSize || 750));
  ensureStyles(doc);
  registerWordClickDelegation(
    doc,
    options.onWordClick,
    options.onWordDoubleClick
  );
  throwIfAborted(options.signal);
  const textNodes = collectTextNodes(doc, root);

  let decoratedCount = 0;
  let firstBatchReported = false;
  for (let start = 0; start < textNodes.length; start += batchSize) {
    const end = Math.min(textNodes.length, start + batchSize);
    for (let index = start; index < end; index++) {
      throwIfAborted(options.signal);
      decoratedCount += decorateTextNode(
        textNodes[index],
        decorationMap,
        doc,
        options,
        language
      );
    }
    if (!firstBatchReported) {
      firstBatchReported = true;
      options.onFirstBatch?.(decoratedCount, end);
    }
    if (end < textNodes.length) {
      await yieldToMainThread(doc);
      throwIfAborted(options.signal);
    }
  }
  if (!firstBatchReported) options.onFirstBatch?.(0, 0);
  return decoratedCount;
};
export const refreshWordDecorations = (
  changedDecorations: WordDecoration[],
  doc: Document,
  options: WordDecorationOptions = {}
) => {
  let refreshedCount = 0;
  const attributeValue = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/[\n\r\f]/g, (character) =>
        `\\${character.codePointAt(0)?.toString(16)} `
      );
  for (const decoration of changedDecorations) {
    const strongSelectors = [
      decoration.key
        ? `.${WORD_CLASS}[data-vocab-key="${attributeValue(
            decoration.key
          )}"]`
        : "",
      decoration.lemma
        ? `.${WORD_CLASS}[data-vocab-lemma="${attributeValue(
            decoration.lemma
          )}"]`
        : "",
    ].filter(Boolean);
    const indexed = decoration.key
      ? WORD_INDEX.get(doc)?.get(decoration.key)
      : undefined;
    let spans: NodeListOf<Element> | HTMLElement[] = indexed?.size
      ? Array.from(indexed).filter((span) => span.isConnected)
      : strongSelectors.length
      ? doc.querySelectorAll(strongSelectors.join(","))
      : doc.querySelectorAll(`.${WORD_CLASS}`);
    // Previously unknown inflections may not yet carry the canonical key/lemma.
    // Only that exceptional path scans every wrapper and asks the resolver.
    if (spans.length === 0 && options.resolveDecoration) {
      spans = doc.querySelectorAll(`.${WORD_CLASS}`);
    } else if (spans.length === 0 && decoration.surface) {
      const normalizedSurface = normalizeVocabularyToken(
        decoration.surface,
        "en"
      );
      spans = doc.querySelectorAll(
        `.${WORD_CLASS}[data-vocab-normalized="${attributeValue(
          normalizedSurface
        )}"]`
      );
    }
    spans.forEach((node) => {
      const span = node as HTMLElement;
      const surface = span.dataset.vocabSurface || span.textContent || "";
      const normalized =
        span.dataset.vocabNormalized ||
        normalizeVocabularyToken(surface, "en");
      // Match against the existing attributes before applying the new ones.
      const resolved = options.resolveDecoration?.(surface, normalized);
      const surfaceMatches =
        Boolean(decoration.surface) &&
        normalized === normalizeVocabularyToken(decoration.surface || "", "en");
      if (
        span.dataset.vocabKey !== decoration.key &&
        span.dataset.vocabLemma !== decoration.lemma &&
        !surfaceMatches &&
        resolved?.key !== decoration.key
      ) {
        return;
      }
      const nextDecoration = resolved || decoration;
      if (shouldDisplay(nextDecoration, options)) {
        if (
          span.dataset.vocabKey === nextDecoration.key &&
          span.dataset.vocabLemma === nextDecoration.lemma
        ) {
          setDecorationPresentation(span, nextDecoration);
        } else {
          setDecorationAttributes(span, nextDecoration, surface, normalized);
        }
      } else if (options.wrapHiddenWords) {
        const hiddenDecoration = {
          ...nextDecoration,
          decorationType: "none" as const,
          opacity: 0,
        };
        if (
          span.dataset.vocabKey === hiddenDecoration.key &&
          span.dataset.vocabLemma === hiddenDecoration.lemma
        ) {
          setDecorationPresentation(span, hiddenDecoration);
        } else {
          setDecorationAttributes(
            span,
            hiddenDecoration,
            surface,
            normalized
          );
        }
      } else {
        removeFromWordIndex(span);
        const parent = span.parentNode;
        if (parent) {
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          parent.removeChild(span);
          parent.normalize();
        }
      }
      refreshedCount++;
    });
  }
  return refreshedCount;
};

const BLOCK_SELECTOR = "p,li,blockquote,h1,h2,h3,h4,h5,h6,figcaption,td,th";

const selectableTextNodes = (root: Element, doc: Document) => {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) =>
      isSkippedTextNode(node as Text, true)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
};

const pointAtOffset = (nodes: Text[], offset: number) => {
  let consumed = 0;
  for (const node of nodes) {
    const length = node.textContent?.length || 0;
    if (offset <= consumed + length) {
      return { node, offset: Math.max(0, offset - consumed) };
    }
    consumed += length;
  }
  const node = nodes[nodes.length - 1];
  return node
    ? { node, offset: node.textContent?.length || 0 }
    : null;
};

const sentenceOffsets = (text: string, targetOffset: number, doc: Document) => {
  const Segmenter = (doc.defaultView?.Intl as any)?.Segmenter;
  if (Segmenter) {
    const segmenter = new Segmenter(undefined, { granularity: "sentence" });
    for (const segment of segmenter.segment(text)) {
      const start = segment.index as number;
      const end = start + (segment.segment as string).length;
      if (targetOffset >= start && targetOffset < end) return { start, end };
    }
  }
  const before = text.slice(0, targetOffset);
  const boundary = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("!"),
    before.lastIndexOf("?"),
    before.lastIndexOf("。"),
    before.lastIndexOf("！"),
    before.lastIndexOf("？"),
    before.lastIndexOf("\n")
  );
  const after = text.slice(targetOffset);
  const next = after.search(/[.!?。！？](?:["'”’)]*)/);
  return {
    start: boundary < 0 ? 0 : boundary + 1,
    end: next < 0 ? text.length : targetOffset + next + 1,
  };
};

export const selectWordDecoration = (
  doc: Document,
  instanceId: string,
  scope: WordSelectionScope
): WordSelectionResult | null => {
  if (!instanceId) return null;
  const target = doc.querySelector(
    `.${WORD_CLASS}[data-vocab-instance="${CSS.escape(instanceId)}"]`
  ) as HTMLElement | null;
  if (!target) return null;

  const range = doc.createRange();
  if (scope === "word") {
    range.selectNodeContents(target);
  } else {
    const block = target.closest(BLOCK_SELECTOR);
    if (!block || block === doc.body || block === doc.documentElement) {
      return null;
    }
    if (scope === "paragraph") {
      range.selectNodeContents(block);
    } else {
      const nodes = selectableTextNodes(block, doc);
      if (nodes.length === 0) return null;
      const fullText = nodes.map((node) => node.textContent || "").join("");
      let consumed = 0;
      let targetOffset = 0;
      for (const node of nodes) {
        if (target.contains(node)) {
          targetOffset = consumed;
          break;
        }
        consumed += node.textContent?.length || 0;
      }
      const offsets = sentenceOffsets(fullText, targetOffset, doc);
      while (offsets.start < offsets.end && /\s/u.test(fullText[offsets.start])) {
        offsets.start++;
      }
      while (offsets.end > offsets.start && /\s/u.test(fullText[offsets.end - 1])) {
        offsets.end--;
      }
      const start = pointAtOffset(nodes, offsets.start);
      const end = pointAtOffset(nodes, offsets.end);
      if (!start || !end) return null;
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    }
  }

  const selection = doc.getSelection();
  if (!selection) return null;
  selection.removeAllRanges();
  selection.addRange(range);
  const selectedText = selection.toString().trim();
  return selectedText
    ? { scope, text: selectedText, instanceId }
    : null;
};
