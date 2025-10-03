import type { HighlightEntry } from "../../EpubPluginSettings";

const HIGHLIGHT_CLASS = "highlight-mark";
const SHAPE_SELECTOR = "rect, path, polygon, polyline";
const DEFAULT_BASE_OPACITY = 0.35;
const DEFAULT_UNDERLINE_COLOR = "rgba(0, 0, 0, 0.4)";
const DEFAULT_UNDERLINE_HEIGHT = 1.8;
const DEFAULT_UNDERLINE_OFFSET = -0.4;
const UNDERLINE_ATTRIBUTE = "data-hover-underline";

export interface HighlightHoverConfig {
  baseOpacity?: number;
  fillColor?: string;
  underlineColor?: string;
  underlineHeight?: number;
  underlineOffset?: number;
}

type HighlightDataset = DOMStringMap & {
  baseOpacity?: string;
  fillColor?: string;
  hoverReady?: string;
  underlineColor?: string;
  underlineHeight?: string;
  underlineOffset?: string;
};

type HoverableSvgElement = SVGElement & { dataset: HighlightDataset };

type DocumentWithHoverState = Document & {
  __enhancedReaderHoverInstalled__?: boolean;
  __enhancedReaderHoverCleanup__?: () => void;
};

type HoverRoot = (Document | DocumentFragment | HTMLElement) & {
  ownerDocument?: Document;
};

const svgElementFrom = (element: Element): HoverableSvgElement | null => {
  if (element instanceof SVGElement) {
    return element as HoverableSvgElement;
  }
  return null;
};

const collectHighlightShapes = (element: SVGElement): SVGGraphicsElement[] => {
  const shapes = Array.from(element.querySelectorAll<SVGGraphicsElement>(SHAPE_SELECTOR));
  if (shapes.length === 0 && element instanceof SVGGraphicsElement) {
    shapes.push(element);
  }
  return shapes;
};

const coerceNumber = (value: string | number | undefined, fallback: number): number => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const clampOpacity = (value: number): number => {
  if (Number.isNaN(value)) return DEFAULT_BASE_OPACITY;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const clampLength = (value: number, fallback: number): number => {
  if (Number.isNaN(value)) return fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value);
};

const resolveFillColor = (element: HoverableSvgElement, highlight?: HighlightEntry, override?: HighlightHoverConfig): string => {
  if (override?.fillColor) return override.fillColor;
  if (highlight?.color) return highlight.color;
  if (element.dataset.fillColor) return element.dataset.fillColor;
  const attr = element.getAttribute("fill") || element.style.fill;
  if (attr && attr.trim().length > 0) return attr;
  return "rgba(255, 235, 59, 1)";
};

const removeHoverUnderlines = (element: HoverableSvgElement): void => {
  element.querySelectorAll(`[${UNDERLINE_ATTRIBUTE}="true"]`).forEach((node) => {
    node.remove();
  });
};

interface ShapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const parseNumberAttr = (attr: string | null | undefined, fallback = 0): number => {
  if (!attr) return fallback;
  const parsed = Number.parseFloat(attr);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const measureShapeBounds = (shape: SVGGraphicsElement): ShapeBounds | null => {
  const tag = shape.tagName?.toLowerCase();

  if (tag === "rect") {
    const x = parseNumberAttr(shape.getAttribute("x"));
    const y = parseNumberAttr(shape.getAttribute("y"));
    const width = parseNumberAttr(shape.getAttribute("width"));
    const height = parseNumberAttr(shape.getAttribute("height"));
    if (width <= 0 || height <= 0) return null;
    return { x, y, width, height };
  }

  if (tag === "line") {
    const x1 = parseNumberAttr(shape.getAttribute("x1"));
    const x2 = parseNumberAttr(shape.getAttribute("x2"));
    const y1 = parseNumberAttr(shape.getAttribute("y1"));
    const y2 = parseNumberAttr(shape.getAttribute("y2"));
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    if (width === 0 && height === 0) return null;
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.max(width, 1), height: Math.max(height, 1) };
  }

  try {
    const box = shape.getBBox();
    if (box.width <= 0 || box.height <= 0) return null;
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  } catch (err) {
    void err;
    return null;
  }
};

const drawHoverUnderlines = (
  element: HoverableSvgElement,
  color: string,
  height: number,
  offset: number
): void => {
  const doc = element.ownerDocument;
  if (!doc) return;

  removeHoverUnderlines(element);

  const shapes = collectHighlightShapes(element);
  for (let i = 0; i < shapes.length; i += 1) {
    const shape = shapes[i];
    const bounds = measureShapeBounds(shape);
    if (!bounds) continue;

    const underline = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
  underline.setAttribute(UNDERLINE_ATTRIBUTE, "true");
    underline.setAttribute("x", bounds.x.toString());
    underline.setAttribute("width", bounds.width.toString());
    const underlineHeight = Math.max(0.5, height);
    const underlineY = bounds.y + bounds.height - underlineHeight + offset;
    underline.setAttribute("y", underlineY.toString());
    underline.setAttribute("height", underlineHeight.toString());
    underline.setAttribute("fill", color);
    const radius = Math.min(underlineHeight / 2, 3);
    underline.setAttribute("rx", radius.toString());
    underline.setAttribute("ry", radius.toString());
    underline.style.pointerEvents = "none";
    underline.style.transition = "opacity 140ms ease";
    element.appendChild(underline);
  }
};

const ensureHoverPrepared = (
  element: HoverableSvgElement,
  highlight?: HighlightEntry,
  override?: HighlightHoverConfig
): void => {
  if (element.dataset.hoverReady === "true") {
    return;
  }

  const baseOpacity = clampOpacity(
    coerceNumber(
      override?.baseOpacity ?? element.dataset.baseOpacity ?? element.getAttribute("fill-opacity"),
      DEFAULT_BASE_OPACITY
    )
  );

  const fillColor = resolveFillColor(element, highlight, override);
  const underlineColor =
    override?.underlineColor ?? element.dataset.underlineColor ?? highlight?.color ?? DEFAULT_UNDERLINE_COLOR;
  const underlineHeight = clampLength(
    coerceNumber(override?.underlineHeight ?? element.dataset.underlineHeight, DEFAULT_UNDERLINE_HEIGHT),
    DEFAULT_UNDERLINE_HEIGHT
  );
  const underlineOffset = coerceNumber(
    override?.underlineOffset ?? element.dataset.underlineOffset,
    DEFAULT_UNDERLINE_OFFSET
  );

  element.dataset.baseOpacity = baseOpacity.toString();
  element.dataset.fillColor = fillColor;
  element.dataset.underlineColor = underlineColor;
  element.dataset.underlineHeight = underlineHeight.toString();
  element.dataset.underlineOffset = underlineOffset.toString();
  element.dataset.hoverReady = "true";

  collectHighlightShapes(element).forEach((shape) => {
    shape.style.setProperty("fill", fillColor);
    shape.style.setProperty("fill-opacity", baseOpacity.toString());
    shape.style.setProperty("transition", "fill-opacity 140ms ease");
    shape.style.setProperty("pointer-events", "none");
  });
};

const applyHoverVisualState = (
  element: HoverableSvgElement,
  hovered: boolean,
  highlight?: HighlightEntry,
  override?: HighlightHoverConfig
): void => {
  ensureHoverPrepared(element, highlight, override);

  const baseOpacity = clampOpacity(coerceNumber(element.dataset.baseOpacity, DEFAULT_BASE_OPACITY));
  const fillColor = resolveFillColor(element, highlight, override);
  const underlineColor = element.dataset.underlineColor ?? DEFAULT_UNDERLINE_COLOR;
  const underlineHeight = clampLength(
    coerceNumber(element.dataset.underlineHeight, DEFAULT_UNDERLINE_HEIGHT),
    DEFAULT_UNDERLINE_HEIGHT
  );
  const underlineOffset = coerceNumber(element.dataset.underlineOffset, DEFAULT_UNDERLINE_OFFSET);

  collectHighlightShapes(element).forEach((shape) => {
    shape.style.setProperty("fill", fillColor);
    shape.style.setProperty("fill-opacity", baseOpacity.toString());
  });

  if (hovered) {
    drawHoverUnderlines(element, underlineColor, underlineHeight, underlineOffset);
    element.setAttribute("data-hovered", "true");
  } else {
    removeHoverUnderlines(element);
    element.removeAttribute("data-hovered");
  }
};

const pointWithinRect = (rect: DOMRect, x: number, y: number): boolean => {
  if (rect.width === 0 || rect.height === 0) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
};

const findHighlightAtPoint = (root: ParentNode, x: number, y: number): HoverableSvgElement | null => {
  const nodes = root.querySelectorAll<SVGElement>(`.${HIGHLIGHT_CLASS}`);
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const candidate = svgElementFrom(nodes[i]);
    if (!candidate) continue;
    const shapes = collectHighlightShapes(candidate);
    if (shapes.length === 0) {
      const rect = candidate.getBoundingClientRect();
      if (pointWithinRect(rect, x, y)) {
        return candidate;
      }
      continue;
    }
    for (let j = shapes.length - 1; j >= 0; j -= 1) {
      const rect = shapes[j].getBoundingClientRect();
      if (pointWithinRect(rect, x, y)) {
        return candidate;
      }
    }
  }
  return null;
};

export const getHighlightElementAtGlobalPoint = (root: ParentNode, x: number, y: number): SVGElement | null => {
  const found = findHighlightAtPoint(root, x, y);
  return found ?? null;
};

const watchHighlightMutations = (root: HoverRoot, callback: (element: HoverableSvgElement) => void): MutationObserver | null => {
  if (!(root instanceof Element) && !(root instanceof Document) && !(root instanceof DocumentFragment)) {
    return null;
  }
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.classList.contains(HIGHLIGHT_CLASS)) {
          const svg = svgElementFrom(node);
          if (svg) callback(svg);
        }
        node.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((child) => {
          const svg = svgElementFrom(child);
          if (svg) callback(svg);
        });
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
};

const updateHoveredElement = (
  root: ParentNode,
  next: HoverableSvgElement | null,
  state: { current: HoverableSvgElement | null }
): void => {
  const current = state.current;

  if (current && !root.contains(current)) {
    applyHoverVisualState(current, false);
    state.current = null;
  }

  if (state.current && next && state.current === next) {
    return;
  }

  if (state.current && state.current !== next) {
    applyHoverVisualState(state.current, false);
    state.current = null;
  }

  if (next && root.contains(next)) {
    applyHoverVisualState(next, true);
    state.current = next;
  }
};

export const configureHighlightElement = (
  element: SVGElement,
  highlight?: HighlightEntry,
  override?: HighlightHoverConfig
): void => {
  const svg = svgElementFrom(element);
  if (!svg) return;
  ensureHoverPrepared(svg, highlight, override);
};

export const applyHighlightHoverState = (
  element: SVGElement,
  hovered: boolean,
  highlight?: HighlightEntry,
  override?: HighlightHoverConfig
): void => {
  const svg = svgElementFrom(element);
  if (!svg) return;
  applyHoverVisualState(svg, hovered, highlight, override);
};

export const installHighlightHover = (doc: Document): void => {
  const docWithState = doc as DocumentWithHoverState;
  if (docWithState.__enhancedReaderHoverInstalled__) {
    return;
  }

  const frameElement = doc.defaultView?.frameElement as HTMLElement | null;
  if (!frameElement) {
    return;
  }

  const root = frameElement.parentElement;
  if (!root) {
    return;
  }

  const win = doc.defaultView;
  if (!win) return;

  docWithState.__enhancedReaderHoverInstalled__ = true;

  const refreshAll = () => {
    const highlights = root.querySelectorAll<SVGElement>(`.${HIGHLIGHT_CLASS}`);
    highlights.forEach((element) => {
      configureHighlightElement(element);
    });
  };

  refreshAll();

  const hoveredState: { current: HoverableSvgElement | null } = { current: null };
  let rafId: number | null = null;

  const pointerHandler = (event: PointerEvent | MouseEvent) => {
    const { clientX, clientY } = event;
    if (rafId !== null) {
      win.cancelAnimationFrame(rafId);
    }
    rafId = win.requestAnimationFrame(() => {
      rafId = null;
      const iframeRect = frameElement.getBoundingClientRect();
      const globalX = clientX + iframeRect.left;
      const globalY = clientY + iframeRect.top;
      const target = findHighlightAtPoint(root, globalX, globalY);
      updateHoveredElement(root, target, hoveredState);
    });
  };

  const clearHover = () => {
    if (rafId !== null) {
      win.cancelAnimationFrame(rafId);
      rafId = null;
    }
    updateHoveredElement(root, null, hoveredState);
  };

  doc.addEventListener("pointermove", pointerHandler, { passive: true });
  doc.addEventListener("pointerdown", pointerHandler, { passive: true });
  doc.addEventListener("mousemove", pointerHandler as EventListener, { passive: true });
  doc.addEventListener("pointerleave", clearHover, { passive: true });
  doc.addEventListener("scroll", clearHover, { passive: true });
  win.addEventListener("blur", clearHover);

  const observer = watchHighlightMutations(root, (element) => {
    configureHighlightElement(element);
  });

  docWithState.__enhancedReaderHoverCleanup__ = () => {
    doc.removeEventListener("pointermove", pointerHandler as EventListener);
    doc.removeEventListener("pointerdown", pointerHandler as EventListener);
  doc.removeEventListener("mousemove", pointerHandler as EventListener);
    doc.removeEventListener("pointerleave", clearHover);
    doc.removeEventListener("scroll", clearHover);
    win.removeEventListener("blur", clearHover);
    if (observer) observer.disconnect();
    if (rafId !== null) {
      win.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (hoveredState.current) {
      applyHoverVisualState(hoveredState.current, false);
      hoveredState.current = null;
    }
  };
};

export { HIGHLIGHT_CLASS };
