export type WordDecorationType =
  | "background"
  | "underline"
  | "border"
  | "text-color"
  | "none";

export interface WordDecoration {
  key: string;
  surface?: string;
  lemma: string;
  levelId: number;
  foregroundColor?: string;
  backgroundColor?: string;
  decorationType: WordDecorationType;
  opacity: number;
  userAdded?: boolean;
}

export type WordDecorationMap =
  | Map<string, WordDecoration>
  | Record<string, WordDecoration>;

export type WordDecorationMode = "all" | "learning" | "user-added";

export interface WordClickPayload {
  key: string;
  surface: string;
  normalized: string;
  lemma: string;
  instanceId: string;
  levelId: number;
  clientX: number;
  clientY: number;
  rect: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  };
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export type WordSelectionScope = "word" | "sentence" | "paragraph";

export interface WordSelectionResult {
  scope: WordSelectionScope;
  text: string;
  instanceId: string;
}

export interface WordDecorationOptions {
  language?: string;
  rootElement?: Element;
  mode?: WordDecorationMode;
  learningLevelIds?: number[];
  /** Keep filtered words as unstyled spans so single-click lookup still works. */
  wrapHiddenWords?: boolean;
  /**
   * A positive value asks GeneralRender to process text nodes in asynchronous
   * batches. The standalone applyWordDecorations utility remains synchronous.
   */
  batchSize?: number;
  signal?: AbortSignal;
  onFirstBatch?: (decoratedCount: number, processedNodeCount: number) => void;
  defaultDecoration?: WordDecoration;
  resolveDecoration?: (
    surface: string,
    normalized: string
  ) => WordDecoration | undefined;
  onWordClick?: (payload: WordClickPayload) => void;
  onWordDoubleClick?: () => void;
}
