import * as React from "react";
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { WorkspaceLeaf } from "obsidian";
import { ReactReader, ReactReaderStyle, type IReactReaderStyle } from "react-reader";
import type { Contents, Rendition } from "epubjs";
import { useDarkMode } from "./hooks/useDarkMode";
import { applyFontSize, applyTheme, applyFontFamily, type ThemeMode, type FontFamilyChoice } from "./adapters/epubjs/theme";
import { createDefaultSanitizer } from "./core/sanitizer";
import { registerContentHook, updateBionicMode, updateOpenDyslexicMode } from "./adapters/epubjs/contentHook";
import { getHighlightElementAtGlobalPoint } from "./adapters/epubjs/highlightHover";
import { createConsoleLogger } from "./core/logger";
import { ReaderControls } from "./ui/ReaderControls";
import { SelectionDropdown } from "./ui/SelectionDropdown";
import type { HighlightEntry, ToolbarState } from "./EpubPluginSettings";
import { HighlightIndex } from "./core/highlightIndex";
import { CfiComparator } from "./core/cfiComparator";
import { debounce } from "./utils/performance";
import { calculateDropdownPosition, type SelectionRect } from "./utils/selectionMenu";

const DEFAULT_TOOLBAR_STATE: ToolbarState = {
  fontSize: 100,
  fontFamily: "system",
  bionic: false,
  theme: undefined,
};

const SEARCH_RESULT_LIMIT = 100;
const HIGHLIGHT_CLASS = "highlight-mark";

const truncateExcerpt = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 177)}…`;
};

type SelectionState = {
  cfi: string;
  text: string;
  chapter?: string;
  existingHighlightCfi?: string | null;
  rects: SelectionRect[];
  bounds: SelectionRect | null;
  createdAt: number;
};
type SearchResult = { cfi: string; excerpt: string; chapter?: string };

type BookNavigationItem = { href?: string; label?: string; text?: string };
type BookMatch = { cfiRange?: string; cfi?: string; excerpt?: string; chapter?: BookNavigationItem; href?: string };
type BookSpineItem = {
  href?: string;
  find?: (query: string) => Promise<BookMatch[] | undefined> | BookMatch[] | undefined;
  load?: (loader: unknown) => Promise<unknown>;
  unload?: () => void;
};
type InternalBook = {
  find?: (query: string) => Promise<BookMatch[] | undefined> | BookMatch[] | undefined;
  spine?: { spineItems?: BookSpineItem[] };
  load?: (...args: unknown[]) => unknown;
  navigation?: {
    toc?: BookNavigationItem[];
    get?: (href: string) => BookNavigationItem | undefined;
  };
};

type HighlightAwareDocument = Document & {
  __enhancedHighlightPointerCleanup__?: () => void;
};

type EpubReaderProps = {
  contents: ArrayBuffer;
  title: string;
  scrolled: boolean;
  tocOffset: number;
  tocBottomOffset: number;
  leaf: WorkspaceLeaf;
  debugLogging?: boolean;
  initialLocation?: string | number;
  initialHighlights?: HighlightEntry[];
  initialToolbarState?: ToolbarState;
  onLocationChange?: (loc: string | number | undefined) => void;
  onExportSelection?: (payload: { cfi: string; text: string; chapter?: string; createdAt: string }) => void;
  onSaveHighlight?: (payload: { cfi: string; text: string; chapter?: string; createdAt: string }) => void;
  onRemoveHighlight?: (cfi: string) => void;
  onToolbarStateChange?: (state: ToolbarState) => void;
};

export const EpubReader: React.FC<EpubReaderProps> = ({
  contents,
  title,
  scrolled,
  tocOffset: _tocOffset,
  tocBottomOffset: _tocBottomOffset,
  leaf,
  debugLogging,
  initialLocation,
  initialHighlights,
  initialToolbarState,
  onLocationChange,
  onExportSelection,
  onSaveHighlight,
  onRemoveHighlight,
  onToolbarStateChange,
}) => {
  const renditionRef = useRef<Rendition | null>(null);
  const searchHighlightRef = useRef<string | null>(null);

  const [location, setLocation] = useState<string | number | undefined>(() => initialLocation);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [highlights, setHighlights] = useState<HighlightEntry[]>(() => initialHighlights ?? []);

  const [fontSize, setFontSize] = useState<number>(() => initialToolbarState?.fontSize ?? DEFAULT_TOOLBAR_STATE.fontSize);
  const [fontFamily, setFontFamily] = useState<FontFamilyChoice>(() => initialToolbarState?.fontFamily ?? DEFAULT_TOOLBAR_STATE.fontFamily);
  const [bionic, setBionic] = useState<boolean>(() => initialToolbarState?.bionic ?? DEFAULT_TOOLBAR_STATE.bionic);
  const [userTheme, setUserTheme] = useState<ThemeMode | undefined>(() => initialToolbarState?.theme);

  const fontFamilyRef = useRef<FontFamilyChoice>(fontFamily);
  const bionicRef = useRef<boolean>(bionic);
  const highlightIndexRef = useRef<HighlightIndex>(new HighlightIndex(initialHighlights ?? []));
  const readerContainerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectionListenerCleanupRef = useRef<(() => void)[]>([]);

  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [selectionMenuPlacement, setSelectionMenuPlacement] = useState<"above" | "below">("above");

  const isDarkMode = useDarkMode();
  const effectiveTheme: ThemeMode = userTheme ?? (isDarkMode ? "dark" : "light");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);

  useEffect(() => {
    setHighlights(initialHighlights ?? []);
    highlightIndexRef.current.rebuild(initialHighlights ?? []);
  }, [initialHighlights]);

  useEffect(() => {
    highlightIndexRef.current.rebuild(highlights);
  }, [highlights]);

  const registerHighlight = useCallback((entry: HighlightEntry) => {
    setHighlights((prev) => {
      const existingIndex = prev.findIndex((highlight) => highlight.cfi === entry.cfi);
      if (existingIndex !== -1) {
        const next = [...prev];
        next[existingIndex] = entry;
        return next;
      }
      return [entry, ...prev];
    });
    highlightIndexRef.current.add(entry);
  }, []);

  const unregisterHighlight = useCallback((cfiToRemove: string) => {
    setHighlights((prev) => prev.filter((highlight) => highlight.cfi !== cfiToRemove));
    highlightIndexRef.current.remove(cfiToRemove);
  }, []);

  const addSelectionListener = useCallback(
    (target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      target.addEventListener(type, handler, options);
      selectionListenerCleanupRef.current.push(() => {
        target.removeEventListener(type, handler, options);
      });
    },
    []
  );

  const clearSelectionListeners = useCallback(() => {
    selectionListenerCleanupRef.current.forEach((cleanup) => {
      try {
        cleanup();
      } catch {
        /* ignore */
      }
    });
    selectionListenerCleanupRef.current = [];
  }, []);

  const closeSelectionMenu = useCallback(() => {
    setSelectionMenuOpen(false);
    setSelectionMenuPosition(null);
    setSelectionMenuPlacement("above");
  }, []);

  const openSelectionMenuAtRect = useCallback(
    (rect: SelectionRect) => {
      const containerEl = readerContainerRef.current;
      if (!containerEl) return;

      const containerRect = containerEl.getBoundingClientRect();
      const { left, top, placement } = calculateDropdownPosition(rect, containerRect.width, containerRect.height);
      setSelectionMenuPosition({ left, top });
      setSelectionMenuPlacement(placement);
      setSelectionMenuOpen(true);
    },
    []
  );

  useEffect(() => {
    return () => {
      clearSelectionListeners();
    };
  }, [clearSelectionListeners]);

  useEffect(() => {
    if (!selection) {
      clearSelectionListeners();
      closeSelectionMenu();
    }
  }, [selection, clearSelectionListeners, closeSelectionMenu]);

  const setupSelectionGuards = useCallback(
    (
      selectionData: SelectionState,
      context: {
        document: Document | null;
        window: Window | null;
        iframeElement: HTMLIFrameElement | null;
        overlayDocument?: Document | null;
        overlayWindow?: Window | null;
      }
    ) => {
      const containerEl = readerContainerRef.current;
      if (!containerEl) return;

      const iframeElement =
        context.iframeElement ??
        (context.document?.defaultView?.frameElement as HTMLIFrameElement | null) ??
        (context.window?.frameElement as HTMLIFrameElement | null);
      const iframeWindow = context.window ?? context.document?.defaultView ?? iframeElement?.contentWindow ?? null;
      const targetDocument = context.document ?? iframeWindow?.document ?? null;
      const overlayDocument = context.overlayDocument ?? undefined;
      const overlayWindow = context.overlayWindow ?? overlayDocument?.defaultView ?? undefined;

      if (!targetDocument) {
        return;
      }

      const pointFromEvent = (event: MouseEvent) => {
        const containerRect = containerEl.getBoundingClientRect();
        const iframeRect = iframeElement?.getBoundingClientRect();
        const currentTarget = event.currentTarget as EventTarget | null;
        const isOverlayContext =
          (!!overlayDocument && currentTarget === overlayDocument) ||
          (!!overlayWindow && currentTarget === overlayWindow) ||
          currentTarget === document ||
          currentTarget === window;
        const x = iframeRect && !isOverlayContext
          ? event.clientX + iframeRect.left - containerRect.left
          : event.clientX - containerRect.left;
        const y = iframeRect && !isOverlayContext
          ? event.clientY + iframeRect.top - containerRect.top
          : event.clientY - containerRect.top;
        return { x, y, containerRect };
      };

      const isPointWithinRect = (pointX: number, pointY: number, rect: SelectionRect) => {
        return (
          pointX >= rect.left &&
          pointX <= rect.left + rect.width &&
          pointY >= rect.top &&
          pointY <= rect.top + rect.height
        );
      };

      const handleIframeMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;

        const now = Date.now();
        if (now - selectionData.createdAt < 200) {
          return;
        }

        const { x, y } = pointFromEvent(event);
        const hitRect = selectionData.rects.find((rect) => isPointWithinRect(x, y, rect));
        const fallbackRect =
          !hitRect && selectionData.bounds && isPointWithinRect(x, y, selectionData.bounds)
            ? selectionData.bounds
            : null;
        const targetRect = hitRect ?? fallbackRect;

        if (targetRect) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
          }
          openSelectionMenuAtRect(targetRect);
        } else {
          closeSelectionMenu();
        }
      };

      const handleIframeSelectionChange = () => {
        if (!iframeWindow || !iframeElement) return;
        const activeSelection = iframeWindow.getSelection?.();
        if (!activeSelection || activeSelection.isCollapsed) {
          setSelection(null);
          closeSelectionMenu();
        }
      };

      const handleHostMouseDown = (event: MouseEvent) => {
        if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
          return;
        }
        closeSelectionMenu();
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          closeSelectionMenu();
          event.stopPropagation();
        }
      };

      const handleScroll = () => {
        closeSelectionMenu();
      };

      addSelectionListener(targetDocument, "mousedown", handleIframeMouseDown, true);
      if (iframeWindow && iframeElement) {
        addSelectionListener(targetDocument, "selectionchange", handleIframeSelectionChange);
      }
      if (overlayDocument && overlayDocument !== targetDocument) {
        addSelectionListener(overlayDocument, "mousedown", handleIframeMouseDown, true);
      }
      addSelectionListener(document, "mousedown", handleHostMouseDown, true);
      addSelectionListener(document, "keydown", handleEscape, true);
      if (targetDocument !== document) {
        addSelectionListener(targetDocument, "keydown", handleEscape, true);
      }
      if (overlayDocument && overlayDocument !== targetDocument && overlayDocument !== document) {
        addSelectionListener(overlayDocument, "keydown", handleEscape, true);
      }
      addSelectionListener(window, "keydown", handleEscape, true);
      if (iframeWindow && iframeWindow !== window) {
        addSelectionListener(iframeWindow, "keydown", handleEscape, true);
      }
      if (overlayWindow && overlayWindow !== window) {
        addSelectionListener(overlayWindow, "keydown", handleEscape, true);
      }
      addSelectionListener(window, "resize", handleScroll);
      addSelectionListener(window, "scroll", handleScroll, true);
      addSelectionListener(targetDocument, "scroll", handleScroll, { passive: true });
      if (overlayDocument && overlayDocument !== targetDocument) {
        addSelectionListener(overlayDocument, "scroll", handleScroll, { passive: true });
      }
      if (iframeWindow) {
        addSelectionListener(iframeWindow, "scroll", handleScroll, { passive: true });
      }
      if (overlayWindow && overlayWindow !== window) {
        addSelectionListener(overlayWindow, "scroll", handleScroll, { passive: true });
      }
    },
    [addSelectionListener, closeSelectionMenu, openSelectionMenuAtRect]
  );

  const sanitizer = useMemo(
    () =>
      createDefaultSanitizer({
        inlineStylesheets: true,
        removeScripts: true,
        stripBlobUrlsInInlineStyles: true,
      }),
    []
  );

  const logger = useMemo(() => createConsoleLogger(!!debugLogging), [debugLogging]);

  const readerStyles = isDarkMode ? darkReaderTheme : lightReaderTheme;

  const resolveChapterFromHref = useCallback((href?: string): string | undefined => {
    if (!href) return undefined;
    const book = (renditionRef.current as unknown as { book?: InternalBook })?.book;
    const navigation = book?.navigation;
    if (!navigation) return href;
    const normalized = href.startsWith("/") ? href.slice(1) : href;
    const toc = navigation.toc ?? [];
    const match =
      toc.find((item) => item?.href === href || item?.href === normalized || item?.href?.endsWith(normalized));
    if (match) {
      return match.label ?? match.text ?? href;
    }
    if (typeof navigation.get === "function") {
      const entry = navigation.get(normalized) ?? navigation.get(href);
      if (entry) {
        return entry.label ?? entry.text ?? href;
      }
    }
    return href;
  }, []);

  const updateTheme = useCallback((rendition: Rendition, theme: ThemeMode) => {
    applyTheme(rendition, theme);
  }, []);

  const updateFontSize = useCallback((size: number) => {
    if (renditionRef.current) {
      applyFontSize(renditionRef.current, size);
    }
  }, []);

  const updateFont = useCallback((family: FontFamilyChoice) => {
    if (renditionRef.current) {
      applyFontFamily(renditionRef.current, family);
    }
  }, []);

  useEffect(() => {
    if (initialLocation !== undefined) {
      setLocation(initialLocation);
    }
  }, [initialLocation]);

  useEffect(() => {
    updateFontSize(fontSize);
  }, [fontSize, updateFontSize]);

  useEffect(() => {
    updateFont(fontFamily);
    fontFamilyRef.current = fontFamily;
    try {
      const rendition = renditionRef.current as unknown as { _views?: Array<Record<string, unknown>> } | null;
      const views = rendition?._views;
      if (Array.isArray(views)) {
        const enableOD = fontFamily === "opendyslexic";
        views.forEach((view) => {
          const contents = view?.["contents"] as unknown;
          const hasWindow = typeof (contents as { window?: unknown } | undefined)?.window !== "undefined";
          if (contents && hasWindow) {
            updateOpenDyslexicMode(contents as unknown as Contents, enableOD);
          }
        });
      }
    } catch {
      /* ignore */
    }
  }, [fontFamily, updateFont]);

  useEffect(() => {
    if (renditionRef.current) {
      updateTheme(renditionRef.current, effectiveTheme);
    }
  }, [effectiveTheme, updateTheme]);

  useEffect(() => {
    bionicRef.current = bionic;
  }, [bionic]);

  useEffect(() => {
    const handleResize = () => {
      const epubContainer = leaf.view.containerEl.querySelector("div.epub-container");
      if (!epubContainer || !epubContainer.parentElement) return;

      const viewContentStyle = getComputedStyle(epubContainer.parentElement);
      renditionRef.current?.resize(
        parseFloat(viewContentStyle.width),
        parseFloat(viewContentStyle.height)
      );
    };

    leaf.view.app.workspace.on("resize", handleResize);
    return () => leaf.view.app.workspace.off("resize", handleResize);
  }, [leaf]);

  useEffect(() => {
    onToolbarStateChange?.({
      fontSize,
      fontFamily,
      bionic,
      theme: userTheme,
    });
  }, [fontSize, fontFamily, bionic, userTheme, onToolbarStateChange]);

  const clearSearchHighlight = useCallback(() => {
    if (!renditionRef.current || !searchHighlightRef.current) return;
    try {
      renditionRef.current.annotations.remove(searchHighlightRef.current, "underline");
    } catch (error) {
      logger.warn?.("Failed to remove search annotation", error);
    }
    searchHighlightRef.current = null;
  }, [logger]);

  const clearSearchState = useCallback(
    (preserveQuery = false) => {
      clearSearchHighlight();
      setSearchResults([]);
      setActiveSearchIndex(null);
      setSearchError(null);
      setLastSearch("");
      if (!preserveQuery) {
        setSearchQuery("");
      }
    },
    [clearSearchHighlight]
  );

  const performSearch = useCallback(
    async (query: string): Promise<SearchResult[]> => {
      const rendition = renditionRef.current;
      const book = (rendition as unknown as { book?: InternalBook })?.book;
      if (!book) return [];
      const normalized = query.trim();
      if (!normalized) return [];

      const results: SearchResult[] = [];

      if (typeof book.find === "function") {
        try {
          const matches = await book.find(normalized);
          if (Array.isArray(matches)) {
            for (const match of matches as BookMatch[]) {
              const cfi: string | undefined = match.cfiRange ?? match.cfi;
              if (!cfi) continue;
              const excerpt = typeof match.excerpt === "string" ? truncateExcerpt(match.excerpt) : "";
              const chapterLabel =
                match.chapter?.label ??
                resolveChapterFromHref(match.chapter?.href ?? match.href);
              results.push({ cfi, excerpt, chapter: chapterLabel });
              if (results.length >= SEARCH_RESULT_LIMIT) {
                return results;
              }
            }
          }
        } catch (error) {
          logger.warn?.("Book.find search failed", error);
        }
      }

      const spineItems = book.spine?.spineItems ?? [];
      for (const item of spineItems as BookSpineItem[]) {
        if (results.length >= SEARCH_RESULT_LIMIT) break;
        try {
          if (typeof item.load === "function" && typeof book.load === "function") {
            await item.load(book.load.bind(book));
          }
          const itemMatches = typeof item.find === "function" ? await item.find(normalized) : undefined;
          if (!Array.isArray(itemMatches)) continue;
          for (const match of itemMatches as BookMatch[]) {
            const cfi: string | undefined = match.cfiRange ?? match.cfi;
            if (!cfi) continue;
            const excerpt = typeof match.excerpt === "string" ? truncateExcerpt(match.excerpt) : "";
            const chapterLabel =
              match.chapter?.label ??
              resolveChapterFromHref(match.chapter?.href ?? item.href ?? match.href);
            results.push({ cfi, excerpt, chapter: chapterLabel });
            if (results.length >= SEARCH_RESULT_LIMIT) break;
          }
        } catch (error) {
          logger.warn?.("Spine search failed", error);
        } finally {
          try {
            if (typeof item.unload === "function") {
              item.unload();
            }
          } catch {
            /* ignore */
          }
        }
      }

      return results;
    },
    [logger, resolveChapterFromHref]
  );

  const handleSearchToggle = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        clearSearchState();
      }
      return !prev;
    });
  }, [clearSearchState]);

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false);
    clearSearchState();
  }, [clearSearchState]);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSearchError(null);
  }, []);

  const handleSearchSubmit = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      clearSearchState(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const results = await performSearch(trimmed);
      setSearchResults(results);
      setLastSearch(trimmed);
      if (results.length > 0) {
        setActiveSearchIndex(0);
      } else {
        setActiveSearchIndex(null);
        clearSearchHighlight();
      }
    } catch (error) {
      logger.warn?.("Search failed", error);
      setSearchError("Não foi possível concluir a busca. Tente novamente.");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, performSearch, logger, clearSearchState, clearSearchHighlight]);

  const handleSearchClear = useCallback(() => {
    clearSearchState(false);
  }, [clearSearchState]);

  const handleSearchNext = useCallback(() => {
    if (!searchResults.length) return;
    setActiveSearchIndex((prev) => {
      if (prev === null) return 0;
      return (prev + 1) % searchResults.length;
    });
  }, [searchResults.length]);

  const handleSearchPrev = useCallback(() => {
    if (!searchResults.length) return;
    setActiveSearchIndex((prev) => {
      if (prev === null) return searchResults.length - 1;
      return (prev - 1 + searchResults.length) % searchResults.length;
    });
  }, [searchResults.length]);

  const handleSearchResultSelect = useCallback(
    (index: number) => {
      if (index < 0 || index >= searchResults.length) return;
      setActiveSearchIndex(index);
    },
    [searchResults.length]
  );

  const handleRemoveHighlight = useCallback((cfi: string) => {
    try {
      if (renditionRef.current) {
        renditionRef.current.annotations.remove(cfi, "highlight");
        logger.debug?.(`Removed highlight: ${cfi}`);
      }
      unregisterHighlight(cfi);
      void onRemoveHighlight?.(cfi);
      closeSelectionMenu();
      setSelection(null);
    } catch (error) {
      logger.warn?.(`Failed to remove highlight: ${cfi}`, error);
    }
  }, [onRemoveHighlight, logger, unregisterHighlight, closeSelectionMenu]);

  const openHighlightContextMenu = useCallback(
    (highlight: HighlightEntry, event: MouseEvent, sourceElement?: Element | null) => {
      if ("button" in event && event.button !== 0) return;

      event.preventDefault?.();
      event.stopPropagation?.();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      const containerEl = readerContainerRef.current;
      if (!containerEl) return;

      const candidateElements: Element[] = [];
      if (sourceElement instanceof Element) {
        candidateElements.push(sourceElement);
      }
      if (event.currentTarget instanceof Element) {
        candidateElements.push(event.currentTarget);
      }
      if (event.target instanceof Element) {
        candidateElements.push(event.target as Element);
      }

      const resolvedHighlightElement =
        candidateElements
          .map((el) => (typeof el.closest === "function" ? el.closest("[data-highlight-cfi]") : null))
          .find((el): el is Element => !!el) ?? null;

      // ========== CORREÇÃO PRINCIPAL ==========
      // Detectar iframe relacionado ao highlight
      const viewRoot = resolvedHighlightElement?.closest?.(".epub-view") as HTMLElement | null;
      const iframeElement = (viewRoot?.querySelector("iframe") as HTMLIFrameElement | null) ?? null;
      const iframeWindow = iframeElement?.contentWindow ?? null;
      const iframeDocument = iframeWindow?.document ?? null;

      const overlayDocument = resolvedHighlightElement?.ownerDocument ?? null;
      const overlayWindow = overlayDocument?.defaultView ?? null;

      // Determinar se o elemento está dentro do iframe
      const isInsideIframe = resolvedHighlightElement && iframeDocument &&
                            iframeDocument.contains(resolvedHighlightElement);

      const containerRect = containerEl.getBoundingClientRect();
      const iframeRect = iframeElement?.getBoundingClientRect();
      // ========================================

      const highlightRect = (() => {
        const rect = resolvedHighlightElement?.getBoundingClientRect() ?? null;
        if (!rect) return null;
        if (rect.width <= 0 || rect.height <= 0) {
          return null;
        }
        return rect;
      })();

      const resolveRectFromChildren = (): SelectionRect[] => {
        if (!resolvedHighlightElement) return [];
        const shapeNodes = Array.from(
          resolvedHighlightElement.querySelectorAll<SVGGraphicsElement>("rect, path, polygon, polyline")
        );
        if (shapeNodes.length === 0) return [];
        return shapeNodes.map((shape) => {
          const rect = shape.getBoundingClientRect();

          // ========== CORREÇÃO: Adicionar offset do iframe ==========
          const leftOffset = isInsideIframe && iframeRect ? iframeRect.left : 0;
          const topOffset = isInsideIframe && iframeRect ? iframeRect.top : 0;

          return {
            left: rect.left + leftOffset - containerRect.left,
            top: rect.top + topOffset - containerRect.top,
            width: rect.width,
            height: rect.height,
          } as SelectionRect;
          // ==========================================================
        });
      };

      const rectsFromChildren = resolveRectFromChildren();
      const fallbackRect: SelectionRect | null = rectsFromChildren.length > 0 ? rectsFromChildren[0] : null;

      // ========== CORREÇÃO: Calcular anchorRect com offset do iframe ==========
      const leftOffset = isInsideIframe && iframeRect ? iframeRect.left : 0;
      const topOffset = isInsideIframe && iframeRect ? iframeRect.top : 0;

      const anchorRect: SelectionRect = highlightRect
        ? {
            left: highlightRect.left + leftOffset - containerRect.left,
            top: highlightRect.top + topOffset - containerRect.top,
            width: Math.max(highlightRect.width, 1),
            height: Math.max(highlightRect.height, 1),
          }
        : fallbackRect ?? {
            left: event.clientX + leftOffset - containerRect.left,
            top: event.clientY + topOffset - containerRect.top,
            width: 1,
            height: 1,
          };
      // ========================================================================

      const selectionRects = rectsFromChildren.length > 0 ? rectsFromChildren : [anchorRect];

      clearSelectionListeners();
      closeSelectionMenu();

      const selectionData: SelectionState = {
        cfi: highlight.cfi,
        text: highlight.text ?? "",
        chapter: highlight.chapter,
        existingHighlightCfi: highlight.cfi,
        rects: selectionRects,
        bounds: anchorRect,
        createdAt: Date.now(),
      };

      setSelection(selectionData);
      openSelectionMenuAtRect(anchorRect);
      setupSelectionGuards(selectionData, {
        document: iframeDocument ?? overlayDocument,
        window: iframeWindow ?? (overlayWindow ?? null),
        iframeElement,
        overlayDocument,
        overlayWindow,
      });
    },
    [
      clearSelectionListeners,
      closeSelectionMenu,
      openSelectionMenuAtRect,
      setupSelectionGuards,
    ]
  );

  const decorateHighlightElement = useCallback(
    (annotation: unknown, highlight: HighlightEntry) => {
      const element = (annotation as { element?: Element | null } | null)?.element;
      if (!(element instanceof Element)) {
        return;
      }

      if (!element.getAttribute("data-highlight-cfi")) {
        element.setAttribute("data-highlight-cfi", highlight.cfi);
      }

      const currentText = highlight.text?.trim() ?? "";
      if (currentText.length > 0) {
        element.setAttribute("data-highlight-text", currentText);
      } else {
        element.removeAttribute("data-highlight-text");
      }

      if (highlight.chapter) {
        element.setAttribute("data-highlight-chapter", highlight.chapter);
      } else {
        element.removeAttribute("data-highlight-chapter");
      }

      if (highlight.color) {
        element.setAttribute("data-highlight-color", highlight.color);
      } else {
        element.removeAttribute("data-highlight-color");
      }

      if (highlight.createdAt) {
        element.setAttribute("data-highlight-created-at", highlight.createdAt);
      }

      element.classList.add("enhanced-highlight-clickable");

      if ("style" in element) {
        const styledElement = element as Element & { style: CSSStyleDeclaration };
        styledElement.style.cursor = "pointer";
        styledElement.style.pointerEvents = "auto";
      }

      if (!element.getAttribute("data-enhanced-bind")) {
        element.setAttribute("data-enhanced-bind", "true");
        const handler = (event: Event) => {
          if (event instanceof MouseEvent) {
            openHighlightContextMenu(highlight, event, element);
          }
        };

        element.addEventListener("mousedown", handler, true);
        element.addEventListener("click", handler, true);
      }
    },
    [openHighlightContextMenu]
  );

  const registerHighlightPointerHandler = useCallback(
    (contents: Contents) => {
      const doc = contents.document;
      if (!doc) return;

      const docWithState = doc as HighlightAwareDocument;
      docWithState.__enhancedHighlightPointerCleanup__?.();

      const frameElement = doc.defaultView?.frameElement as HTMLElement | null;
      if (!frameElement) {
        return;
      }

      const root = frameElement.parentElement;
      if (!root) {
        return;
      }

      const win = doc.defaultView ?? window;

      const pointerHandler = (event: PointerEvent) => {
        if (event.button !== 0) return;
        if (event.defaultPrevented) return;
        if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") {
          return;
        }

        try {
          const frameRect = frameElement.getBoundingClientRect();
          const highlightElement = getHighlightElementAtGlobalPoint(
            root,
            event.clientX + frameRect.left,
            event.clientY + frameRect.top
          );

          if (!highlightElement) {
            return;
          }

          const cfi = highlightElement.getAttribute("data-highlight-cfi");
          if (!cfi) {
            return;
          }

          const highlightFromIndex = highlightIndexRef.current.findByCfi(cfi);

          const highlightEntry: HighlightEntry = highlightFromIndex ?? {
            cfi,
            text: highlightElement.getAttribute("data-highlight-text") ?? "",
            chapter: highlightElement.getAttribute("data-highlight-chapter") ?? undefined,
            color: highlightElement.getAttribute("data-highlight-color") ?? undefined,
            createdAt:
              highlightElement.getAttribute("data-highlight-created-at") ?? new Date().toISOString(),
          };

          openHighlightContextMenu(highlightEntry, event as unknown as MouseEvent, highlightElement);
        } catch (error) {
          logger.debug?.("Highlight pointer detection failed", error);
        }
      };

      doc.addEventListener("pointerdown", pointerHandler, true);

      const cleanup = () => {
        doc.removeEventListener("pointerdown", pointerHandler, true);
        doc.removeEventListener("unload", cleanup);
        win?.removeEventListener("pagehide", cleanup as EventListener);
      };

      doc.addEventListener("unload", cleanup);
      win?.addEventListener("pagehide", cleanup as EventListener);

      docWithState.__enhancedHighlightPointerCleanup__ = cleanup;
    },
    [logger, openHighlightContextMenu]
  );

  // Helper: render a highlight in the current rendition with consistent styles
  const addHighlightToRendition = useCallback((highlight: HighlightEntry) => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    try {
      const highlightSvg = rendition.annotations.highlight(
        highlight.cfi,
        { highlightId: highlight.cfi, highlightData: highlight },
        (event: Event) => {
          if (event instanceof MouseEvent) {
            const sourceEl = event.currentTarget instanceof Element ? event.currentTarget : null;
            openHighlightContextMenu(highlight, event, sourceEl);
          }
        },
        HIGHLIGHT_CLASS,
        {
          fill: highlight.color || "yellow",
          "fill-opacity": 0.25,
        }
      );

      decorateHighlightElement(highlightSvg, highlight);

      logger.debug?.(`✅ DEBUG: Highlight SVG criado com sucesso!`, highlightSvg);

      setTimeout(() => {
        try {
          const contents = rendition.getContents?.();
          const firstContent = Array.isArray(contents) ? contents[0] : contents;
          const iframe = firstContent?.document?.defaultView?.frameElement as HTMLIFrameElement;
          if (!iframe) {
            logger.warn?.("❌ DEBUG: Iframe não encontrado");
            return;
          }

          const doc = iframe.contentDocument;
          if (!doc) {
            logger.warn?.("❌ DEBUG: Documento do iframe não encontrado");
            return;
          }

          const svgHighlights = Array.from(doc.querySelectorAll('svg[class*="highlight"]')).filter(svg =>
            !svg.parentElement || svg.parentElement.tagName === 'HTML' || !doc.body.contains(svg)
          );

          logger.debug?.(`🔍 DEBUG: SVG highlights encontrados: ${svgHighlights.length}`);

          if (svgHighlights.length > 0) {
            const contentContainer = doc.body.querySelector('[id*="epubjs"], body > div, body') as HTMLElement;

            if (contentContainer) {
              svgHighlights.forEach((svg, index) => {
                try {
                  contentContainer.appendChild(svg);
                  logger.debug?.(`✅ DEBUG: SVG ${index + 1} anexado ao DOM com sucesso`);
                } catch (attachError) {
                  logger.warn?.(`❌ DEBUG: Erro ao anexar SVG ${index + 1}:`, attachError);
                }
              });
            } else {
              logger.warn?.("❌ DEBUG: Container de conteúdo não encontrado");
            }
          }
        } catch (domError) {
          logger.warn?.("❌ DEBUG: Erro no acesso ao DOM:", domError);
        }
      }, 100);

      logger.debug?.(`✅ DEBUG: Highlight adicionado: ${highlight.cfi}`);
    } catch (error) {
      logger.warn?.("❌ DEBUG: Falha ao adicionar highlight:", error);
    }
  }, [logger, decorateHighlightElement]);

  const handleHighlightClick = useCallback((cfiRange: string, contents: Contents) => {
    const selectionObj = contents.window?.getSelection?.();
    const selectedText = selectionObj?.toString() ?? "";
    const text = selectedText.trim();

    logger.debug?.(`Selection event - text: "${text.substring(0, 50)}...", cfi: ${cfiRange}`);

    const containerEl = readerContainerRef.current;
    const iframeElement = contents.document?.defaultView?.frameElement as HTMLIFrameElement | null;

    let rects: SelectionRect[] = [];
    let bounds: SelectionRect | null = null;

    if (selectionObj && selectionObj.rangeCount > 0 && containerEl && iframeElement) {
      const range = selectionObj.getRangeAt(0).cloneRange();
      const containerRect = containerEl.getBoundingClientRect();
      const iframeRect = iframeElement.getBoundingClientRect();

      rects = Array.from(range.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          left: rect.left + iframeRect.left - containerRect.left,
          top: rect.top + iframeRect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        }));

      if (rects.length > 0) {
        const boundingRect = range.getBoundingClientRect();
        bounds = {
          left: boundingRect.left + iframeRect.left - containerRect.left,
          top: boundingRect.top + iframeRect.top - containerRect.top,
          width: boundingRect.width,
          height: boundingRect.height,
        };
      }
    }

    clearSelectionListeners();
    closeSelectionMenu();

    const overlappingHighlights = CfiComparator.findOverlapping(cfiRange, highlights);
    const createdAt = Date.now();

    if (overlappingHighlights.length > 0) {
      const existingHighlight = overlappingHighlights[0];
      logger.debug?.(`Found existing highlight: ${existingHighlight.cfi}`);

      const nextSelection: SelectionState = {
        cfi: existingHighlight.cfi,
        text: existingHighlight.text || text,
        chapter: existingHighlight.chapter,
        existingHighlightCfi: existingHighlight.cfi,
        rects,
        bounds,
        createdAt,
      };
      setSelection(nextSelection);
      setupSelectionGuards(nextSelection, {
        document: contents.document ?? null,
        window:
          (contents as unknown as { window?: Window | null }).window ?? contents.document?.defaultView ?? null,
        iframeElement: (contents.document?.defaultView?.frameElement as HTMLIFrameElement | null) ?? null,
      });
      return;
    }

    if (text) {
      logger.debug?.("New selection, not on existing highlight");
      const section = (contents as unknown as { section?: { href?: string; canonical?: string } }).section;
      const chapter = resolveChapterFromHref(section?.href ?? section?.canonical);

      const nextSelection: SelectionState = {
        cfi: cfiRange,
        text,
        chapter,
        existingHighlightCfi: null,
        rects,
        bounds,
        createdAt,
      };
      setSelection(nextSelection);
      setupSelectionGuards(nextSelection, {
        document: contents.document ?? null,
        window:
          (contents as unknown as { window?: Window | null }).window ?? contents.document?.defaultView ?? null,
        iframeElement: (contents.document?.defaultView?.frameElement as HTMLIFrameElement | null) ?? null,
      });
    } else {
      setSelection(null);
    }
  }, [resolveChapterFromHref, logger, highlights, clearSelectionListeners, closeSelectionMenu, setupSelectionGuards]);


  const handleSelectionHighlightAction = useCallback(() => {
    if (!selection) return;
    const newHighlight: HighlightEntry = {
      cfi: selection.cfi,
      text: selection.text,
      chapter: selection.chapter,
      createdAt: new Date().toISOString(),
    };

    try {
      addHighlightToRendition(newHighlight);
    } catch (error) {
      logger.warn?.("Failed to add highlight", error);
    }
    registerHighlight(newHighlight);
    onSaveHighlight?.(newHighlight);
    closeSelectionMenu();
    setSelection(null);
  }, [selection, addHighlightToRendition, logger, registerHighlight, onSaveHighlight, closeSelectionMenu]);

  const handleSelectionExportAction = useCallback(() => {
    if (!selection) return;
    const newHighlight: HighlightEntry = {
      cfi: selection.cfi,
      text: selection.text,
      chapter: selection.chapter,
      createdAt: new Date().toISOString(),
    };
    onExportSelection?.(newHighlight);
    try {
      addHighlightToRendition(newHighlight);
    } catch (error) {
      logger.warn?.("Failed to add export highlight", error);
    }
    registerHighlight(newHighlight);
    closeSelectionMenu();
    setSelection(null);
  }, [selection, onExportSelection, addHighlightToRendition, logger, registerHighlight, closeSelectionMenu]);

  const handleSelectionCancelAction = useCallback(() => {
    closeSelectionMenu();
    setSelection(null);
  }, [closeSelectionMenu]);



  useEffect(() => {
    if (activeSearchIndex === null) return;
    if (activeSearchIndex >= searchResults.length) {
      setActiveSearchIndex(searchResults.length ? searchResults.length - 1 : null);
    }
  }, [activeSearchIndex, searchResults.length]);

  useEffect(() => {
    if (searchResults.length === 0) {
      clearSearchHighlight();
    }
  }, [searchResults.length, clearSearchHighlight]);

  useEffect(() => {
    if (activeSearchIndex === null) return;
    const result = searchResults[activeSearchIndex];
    if (!result || !renditionRef.current) return;

    let cancelled = false;

    const displayResult = async () => {
      try {
        await renditionRef.current?.display(result.cfi);
        if (cancelled) return;
        clearSearchHighlight();
        try {
          renditionRef.current?.annotations.add(
            "underline",
            result.cfi,
            {},
            undefined,
            "search-highlight",
            {
              stroke: "var(--interactive-accent)",
              "stroke-width": "1px",
            }
          );
          searchHighlightRef.current = result.cfi;
        } catch (annotationError) {
          logger.warn?.("Failed to annotate search result", annotationError);
        }
      } catch (error) {
        if (!cancelled) {
          logger.warn?.("Failed to open search result", error);
          setSearchError("Não foi possível navegar até este resultado.");
        }
      }
    };

    displayResult();

    return () => {
      cancelled = true;
    };
  }, [activeSearchIndex, searchResults, clearSearchHighlight, logger]);

  const locationChanged = useCallback(
    (epubcifi: string | number) => {
      setLocation(epubcifi);
      onLocationChange?.(epubcifi);
    },
    [onLocationChange]
  );

  return (
    <div
      ref={readerContainerRef}
      style={{ height: "100vh", display: "flex", flexDirection: "column", position: "relative" }}
    >
      <ReaderControls
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        theme={effectiveTheme}
        onThemeChange={setUserTheme}
        fontFamily={fontFamily}
        onFontFamilyChange={setFontFamily}
        bionic={bionic}
        onBionicChange={(value) => {
          setBionic(value);
          try {
            const rendition = renditionRef.current as unknown as { _views?: Array<Record<string, unknown>> } | null;
            const views = rendition?._views;
            if (Array.isArray(views)) {
              views.forEach((view) => {
                const viewContents = view?.["contents"] as unknown;
                const hasWindow = typeof (viewContents as { window?: unknown } | undefined)?.window !== "undefined";
                if (viewContents && hasWindow) {
                  updateBionicMode(viewContents as unknown as Contents, value);
                }
              });
            }
          } catch (error) {
            logger.warn?.("Failed to update bionic mode on current views", error);
          }
        }}
        onSelectionHighlight={handleSelectionHighlightAction}
        onSelectionExport={handleSelectionExportAction}
        onSelectionCancel={handleSelectionCancelAction}
        selectionActive={!!selection}
        selectionText={selection?.text}
        selectionChapter={selection?.chapter}
        selectionExistingHighlight={selection?.existingHighlightCfi}
        onRemoveHighlight={handleRemoveHighlight}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searching={searching}
        searchResultCount={searchResults.length}
        activeSearchIndex={activeSearchIndex}
        onSearchToggle={handleSearchToggle}
        onSearchClose={handleSearchClose}
        onSearchQueryChange={handleSearchQueryChange}
        onSearchSubmit={handleSearchSubmit}
        onSearchClear={handleSearchClear}
        onSearchNext={handleSearchNext}
        onSearchPrev={handleSearchPrev}
      />

      {selection && selectionMenuOpen && selectionMenuPosition && (
        <SelectionDropdown
          ref={dropdownRef}
          position={selectionMenuPosition}
          placement={selectionMenuPlacement}
          hasExistingHighlight={!!selection.existingHighlightCfi}
          onHighlight={handleSelectionHighlightAction}
          onRemoveHighlight={
            selection.existingHighlightCfi
              ? () => handleRemoveHighlight(selection.existingHighlightCfi as string)
              : undefined
          }
          onExport={handleSelectionExportAction}
          onCancel={handleSelectionCancelAction}
        />
      )}

      {searchOpen && (
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "var(--background-secondary)",
            borderBottom: "1px solid var(--background-modifier-border)",
            maxHeight: "30vh",
            overflowY: "auto",
          }}
        >
          {searchError && (
            <div style={{ color: "var(--text-error)" }}>{searchError}</div>
          )}
          {!searchError && lastSearch && !searching && searchResults.length === 0 && (
            <div style={{ color: "var(--text-muted)" }}>
              Nenhum resultado para “{lastSearch}”.
            </div>
          )}
          {searchResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ color: "var(--text-muted)" }}>
                {searchResults.length} resultado{searchResults.length > 1 ? "s" : ""} para “{lastSearch}”.
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {searchResults.map((result, index) => {
                  const isActive = index === activeSearchIndex;
                  return (
                    <li key={`${result.cfi}-${index}`}>
                      <button
                        type="button"
                        onClick={() => handleSearchResultSelect(index)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          backgroundColor: isActive
                            ? "var(--background-modifier-accent)"
                            : "var(--background-primary)",
                          color: "var(--text-normal)",
                          cursor: "pointer",
                        }}
                      >
                        {result.chapter && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 2 }}>
                            {result.chapter}
                          </div>
                        )}
                        <div style={{ fontSize: "0.9rem" }}>{result.excerpt}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {searching && (
            <div style={{ color: "var(--text-muted)" }}>Buscando…</div>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactReader
          title={title}
          showToc={true}
          location={location}
          locationChanged={locationChanged}
          swipeable={false}
          url={contents}
          getRendition={(rendition: Rendition) => {
            renditionRef.current = rendition;
            rendition.hooks.content.register((c: Contents) => {
              registerContentHook(c, sanitizer, logger, {
                bionicEnabled: bionicRef.current,
                fontFamily: fontFamilyRef.current,
              });
              registerHighlightPointerHandler(c);
            });

            // Restore highlights after content is ready
            if (initialHighlights && Array.isArray(initialHighlights)) {
              const restoreHighlights = async () => {
                // Wait for rendition to be ready
                await new Promise<void>(resolve => {
                  const internalRendition = rendition as unknown as { manager?: { views?: unknown[] } };
                  if (internalRendition.manager?.views && internalRendition.manager.views.length > 0) {
                    resolve();
                  } else {
                    const checkReady = () => {
                      const currentManager = (rendition as unknown as { manager?: { views?: unknown[] } }).manager;
                      if (currentManager?.views && currentManager.views.length > 0) {
                        resolve();
                      } else {
                        setTimeout(checkReady, 50);
                      }
                    };
                    checkReady();
                  }
                });

                const storedHighlights = highlightIndexRef.current.getAll();

                // Add highlights using BREAKTHROUGH approach
                for (const highlight of storedHighlights) {
                  // Basic CFI validation
                  if (!highlight.cfi || typeof highlight.cfi !== 'string' || !highlight.cfi.startsWith('epubcfi(')) {
                    logger.warn?.(`❌ DEBUG: CFI inválido: ${highlight.cfi}`);
                    continue;
                  }

                  try {
                    // BREAKTHROUGH: Use annotations.highlight() for restoration
                    const highlightSvg = rendition.annotations.highlight(
                      highlight.cfi,
                      { highlightId: highlight.cfi, highlightData: highlight },
                      (event: Event) => {
                        if (event instanceof MouseEvent) {
                          const sourceEl = event.currentTarget instanceof Element ? event.currentTarget : null;
                          openHighlightContextMenu(highlight, event, sourceEl);
                        }
                      },
                      HIGHLIGHT_CLASS,
                      {
                        fill: highlight.color || "yellow",
                        "fill-opacity": 0.25,
                      }
                    );

                    decorateHighlightElement(highlightSvg, highlight);
                    
                    logger.debug?.(`✅ DEBUG: Highlight restaurado: ${highlight.cfi}`, highlightSvg);
                  } catch (error) {
                    logger.warn?.(`❌ DEBUG: Falha ao restaurar highlight: ${highlight.cfi}`, error);
                  }
                }

                // AUTOMATIC SVG ATTACHMENT for restored highlights
                setTimeout(() => {
                  try {
                    const contents = rendition.getContents?.();
                    const firstContent = Array.isArray(contents) ? contents[0] : contents;
                    const iframe = firstContent?.document?.defaultView?.frameElement as HTMLIFrameElement;
                    if (!iframe) {
                      logger.warn?.("❌ DEBUG: Iframe não encontrado durante restauração");
                      return;
                    }

                    const doc = iframe.contentDocument;
                    if (!doc) {
                      logger.warn?.("❌ DEBUG: Documento do iframe não encontrado durante restauração");
                      return;
                    }

                    // Find all unattached SVG highlights
                    const svgHighlights = Array.from(doc.querySelectorAll('svg[class*="highlight"]')).filter(svg => 
                      !svg.parentElement || svg.parentElement.tagName === 'HTML' || !doc.body.contains(svg)
                    );

                    logger.debug?.(`🔍 DEBUG: SVG highlights encontrados para restauração: ${svgHighlights.length}`);
                    
                    if (svgHighlights.length > 0) {
                      // Get the main content container
                      const contentContainer = doc.body.querySelector('[id*="epubjs"], body > div, body') as HTMLElement;
                      
                      if (contentContainer) {
                        svgHighlights.forEach((svg, index) => {
                          try {
                            contentContainer.appendChild(svg);
                            logger.debug?.(`✅ DEBUG: SVG restaurado ${index + 1} anexado ao DOM`);
                          } catch (attachError) {
                            logger.warn?.(`❌ DEBUG: Erro ao anexar SVG restaurado ${index + 1}:`, attachError);
                          }
                        });
                      } else {
                        logger.warn?.("❌ DEBUG: Container de conteúdo não encontrado durante restauração");
                      }
                    }
                  } catch (domError) {
                    logger.warn?.("❌ DEBUG: Erro no acesso ao DOM durante restauração:", domError);
                  }
                }, 300); // Delay to ensure SVGs are created
              };

              // NEW: Optimized restoration using spatial index + debounce
              // Only restores highlights for current section (performance optimization)
              const restoreHighlightsOnLocationChange = debounce((location: string) => {
                // Get highlights for current section only
                const sectionHighlights = highlightIndexRef.current.getForSection(location);
                logger.debug?.(`🔄 DEBUG: Restaurando ${sectionHighlights.length} highlights para a seção atual`);
                
                sectionHighlights.forEach((highlight: HighlightEntry) => {
                  if (!highlight.cfi || typeof highlight.cfi !== 'string' || !highlight.cfi.startsWith('epubcfi(')) {
                    return;
                  }
                  
                  try {
                    // BREAKTHROUGH: Use annotations.highlight() for location-based restoration too
                    rendition.annotations.highlight(
                      highlight.cfi,
                      { highlightId: highlight.cfi, highlightData: highlight },
                      undefined,
                      HIGHLIGHT_CLASS,
                      {
                        fill: highlight.color || "yellow",
                        "fill-opacity": 0.25,
                      }
                    );
                    
                    logger.debug?.(`✅ DEBUG: Highlight da seção restaurado: ${highlight.cfi}`);
                  } catch (error) {
                    // Silently fail for location changes - this is expected for highlights not in current view
                    logger.debug?.(`⚠️ DEBUG: Highlight não disponível na vista atual: ${highlight.cfi}`);
                  }
                });

                // AUTOMATIC SVG ATTACHMENT for location-based highlights
                setTimeout(() => {
                  try {
                    const contents = rendition.getContents?.();
                    const firstContent = Array.isArray(contents) ? contents[0] : contents;
                    const iframe = firstContent?.document?.defaultView?.frameElement as HTMLIFrameElement;
                    
                    if (!iframe) return;

                    const doc = iframe.contentDocument;
                    if (!doc) return;

                    // Find unattached SVG highlights
                    const svgHighlights = Array.from(doc.querySelectorAll('svg[class*="highlight"]')).filter(svg => 
                      !svg.parentElement || svg.parentElement.tagName === 'HTML' || !doc.body.contains(svg)
                    );

                    if (svgHighlights.length > 0) {
                      const contentContainer = doc.body.querySelector('[id*="epubjs"], body > div, body') as HTMLElement;

                      if (contentContainer) {
                        svgHighlights.forEach((svg, index) => {
                          try {
                            contentContainer.appendChild(svg);
                            logger.debug?.(`✅ DEBUG: SVG da seção ${index + 1} anexado ao DOM`);
                          } catch (attachError) {
                            logger.debug?.(`⚠️ DEBUG: Erro ao anexar SVG da seção:`, attachError);
                          }
                        });
                      }
                    }
                  } catch (domError) {
                    logger.debug?.("⚠️ DEBUG: Erro no DOM durante mudança de seção:", domError);
                  }
                }, 100); // Quick attachment for location changes
              }, 300); // Debounce by 300ms

              rendition.on("locationChanged", (location: { start?: { cfi?: string; toString?: () => string } }) => {
                // NEW: Pass location.start.cfi for section-based lookup
                const locationCfi = location?.start?.cfi || location?.start?.toString?.() || '';
                if (locationCfi) {
                  restoreHighlightsOnLocationChange(locationCfi);
                }
              });

              // Start initial restoration process
              restoreHighlights().catch(error => {
                logger.warn?.("Failed to restore highlights", error);
              });
            }

            try {
              logger.debug?.("Attaching 'selected' event handler to rendition");
              rendition.on("selected", handleHighlightClick);
            } catch (error) {
              logger.warn?.("Failed to attach selection handler", error);
            }

            updateTheme(rendition, effectiveTheme);
            applyFontSize(rendition, fontSize);
            applyFontFamily(rendition, fontFamily);
          }}
          epubOptions={
            scrolled
              ? {
                  allowPopups: false,
                  allowScriptedContent: false,
                  flow: "scrolled",
                  manager: "continuous",
                }
              : {
                  allowPopups: false,
                  allowScriptedContent: false,
                }
          }
          readerStyles={readerStyles}
        />
      </div>
    </div>
  );
};

const lightReaderTheme: IReactReaderStyle = {
  ...ReactReaderStyle,
  readerArea: {
    ...ReactReaderStyle.readerArea,
    transition: undefined,
  },
};

const darkReaderTheme: IReactReaderStyle = {
  ...ReactReaderStyle,
  arrow: {
    ...ReactReaderStyle.arrow,
    color: "white",
  },
  arrowHover: {
    ...ReactReaderStyle.arrowHover,
    color: "#ccc",
  },
  readerArea: {
    ...ReactReaderStyle.readerArea,
    backgroundColor: "#000",
    transition: undefined,
  },
  titleArea: {
    ...ReactReaderStyle.titleArea,
    color: "#ccc",
  },
  tocArea: {
    ...ReactReaderStyle.tocArea,
    background: "#111",
  },
  tocButtonExpanded: {
    ...ReactReaderStyle.tocButtonExpanded,
    background: "#222",
  },
  tocButtonBar: {
    ...ReactReaderStyle.tocButtonBar,
    background: "#fff",
  },
  tocButton: {
    ...ReactReaderStyle.tocButton,
    color: "white",
  },
};