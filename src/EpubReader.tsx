import * as React from "react";
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { WorkspaceLeaf } from "obsidian";
import { ReactReader, ReactReaderStyle, type IReactReaderStyle } from "react-reader";
import type { Contents, Rendition } from "epubjs";
import { useDarkMode } from "./hooks/useDarkMode";
import { applyFontSize, applyTheme, applyFontFamily, type ThemeMode, type FontFamilyChoice } from "./adapters/epubjs/theme";
import { createDefaultSanitizer } from "./core/sanitizer";
import { registerContentHook, updateBionicMode, updateOpenDyslexicMode } from "./adapters/epubjs/contentHook";
import { createConsoleLogger } from "./core/logger";
import { ReaderControls } from "./ui/ReaderControls";
import type { HighlightEntry, ToolbarState } from "./EpubPluginSettings";
import { HighlightIndex } from "./core/highlightIndex";
import { CfiComparator } from "./core/cfiComparator";
import { debounce } from "./utils/performance";
import { showHighlightContextMenu, copyToClipboard } from "./ui/HighlightContextMenu";

const DEFAULT_TOOLBAR_STATE: ToolbarState = {
  fontSize: 100,
  fontFamily: "system",
  bionic: false,
  theme: undefined,
};

const SEARCH_RESULT_LIMIT = 100;

const truncateExcerpt = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 177)}…`;
};

type SelectionState = { cfi: string; text: string; chapter?: string; existingHighlightCfi?: string | null };
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

  const [fontSize, setFontSize] = useState<number>(() => initialToolbarState?.fontSize ?? DEFAULT_TOOLBAR_STATE.fontSize);
  const [fontFamily, setFontFamily] = useState<FontFamilyChoice>(() => initialToolbarState?.fontFamily ?? DEFAULT_TOOLBAR_STATE.fontFamily);
  const [bionic, setBionic] = useState<boolean>(() => initialToolbarState?.bionic ?? DEFAULT_TOOLBAR_STATE.bionic);
  const [userTheme, setUserTheme] = useState<ThemeMode | undefined>(() => initialToolbarState?.theme);

  const fontFamilyRef = useRef<FontFamilyChoice>(fontFamily);
  const bionicRef = useRef<boolean>(bionic);

  const isDarkMode = useDarkMode();
  const effectiveTheme: ThemeMode = userTheme ?? (isDarkMode ? "dark" : "light");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);

  // NEW: Create spatial index for highlights (performance optimization)
  const highlightIndex = useMemo(
    () => new HighlightIndex(initialHighlights || []),
    [initialHighlights]
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
      onRemoveHighlight?.(cfi);
      setSelection(null); // Clear selection after removing highlight
    } catch (error) {
      logger.warn?.(`Failed to remove highlight: ${cfi}`, error);
    }
  }, [onRemoveHighlight, logger]);

  // Helper: add a clickable highlight at a CFI with consistent styles and menu
  const addClickableHighlight = useCallback((cfi: string, entry: { cfi: string; text: string; chapter?: string }) => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const highlight: HighlightEntry = {
      cfi: entry.cfi,
      text: entry.text,
      chapter: entry.chapter,
      createdAt: new Date().toISOString(),
    };

    const clickHandler = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showHighlightContextMenu(event, {
        highlight,
        onEdit: undefined,
        onRemove: (hCfi) => handleRemoveHighlight(hCfi),
        onCopy: (text) => copyToClipboard(text),
        onNavigate: (goCfi) => rendition.display(goCfi),
      });
    };

    try {
      rendition.annotations.add(
        "highlight",
        cfi,
        { highlightId: cfi },
        clickHandler,
        "highlight-clickable",
        {
          fill: "yellow",
          "fill-opacity": 0.2,
          cursor: "pointer",
        }
      );
    } catch (error) {
      logger.warn?.("Failed to add clickable highlight", error);
    }
  }, [handleRemoveHighlight, logger]);

  const handleHighlightClick = useCallback((cfiRange: string, contents: Contents) => {
    const selectedText = contents.window?.getSelection?.()?.toString() ?? "";
    const text = selectedText.trim();
    
    logger.debug?.(`Selection event - text: "${text.substring(0, 50)}...", cfi: ${cfiRange}`);
    
    // NEW: Use CfiComparator for accurate overlap detection
    const overlappingHighlights = CfiComparator.findOverlapping(
      cfiRange,
      initialHighlights || []
    );
    
    if (overlappingHighlights.length > 0) {
      // User selected text that overlaps with existing highlight(s)
      const existingHighlight = overlappingHighlights[0]; // Use first match
      logger.debug?.(`Found existing highlight: ${existingHighlight.cfi}`);
      
      setSelection({
        cfi: existingHighlight.cfi,
        text: existingHighlight.text || text,
        chapter: existingHighlight.chapter,
        existingHighlightCfi: existingHighlight.cfi
      });
    } else if (text) {
      // New selection, not on existing highlight
      logger.debug?.("New selection, not on existing highlight");
      const section = (contents as unknown as { section?: { href?: string; canonical?: string } }).section;
      const chapter = resolveChapterFromHref(section?.href ?? section?.canonical);
      
      setSelection({ 
        cfi: cfiRange, 
        text, 
        chapter, 
        existingHighlightCfi: null 
      });
    }
  }, [resolveChapterFromHref, logger, initialHighlights]);



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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
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
        onSelectionHighlight={() => {
          if (!selection) return;
          try {
            addClickableHighlight(selection.cfi, { cfi: selection.cfi, text: selection.text, chapter: selection.chapter });
          } catch (error) {
            logger.warn?.("Failed to add highlight", error);
          }
          onSaveHighlight?.({
            cfi: selection.cfi,
            text: selection.text,
            chapter: selection.chapter,
            createdAt: new Date().toISOString(),
          });
          setSelection(null);
        }}
        onSelectionExport={() => {
          if (!selection) return;
          onExportSelection?.({
            cfi: selection.cfi,
            text: selection.text,
            chapter: selection.chapter,
            createdAt: new Date().toISOString(),
          });
          try {
            addClickableHighlight(selection.cfi, { cfi: selection.cfi, text: selection.text, chapter: selection.chapter });
          } catch (error) {
            logger.warn?.("Failed to add export highlight", error);
          }
          setSelection(null);
        }}
        onSelectionCancel={() => setSelection(null)}
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
            rendition.hooks.content.register((c: Contents) =>
              registerContentHook(c, sanitizer, logger, {
                bionicEnabled: bionicRef.current,
                fontFamily: fontFamilyRef.current,
              })
            );

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

                // Add highlights with retry logic and click handlers
                for (const highlight of initialHighlights) {
                  // Basic CFI validation
                  if (!highlight.cfi || typeof highlight.cfi !== 'string' || !highlight.cfi.startsWith('epubcfi(')) {
                    logger.warn?.(`Invalid CFI format: ${highlight.cfi}`);
                    continue;
                  }

                  // NEW: Click handler for context menu
                  const clickHandler = (event: MouseEvent) => {
                    event.preventDefault();
                    event.stopPropagation();
                    logger.debug?.('Highlight clicked:', highlight.cfi);
                    
                    // Show context menu
                    showHighlightContextMenu(event, {
                      highlight,
                      onEdit: undefined, // TODO: Will implement in next phase
                      onRemove: (cfi) => {
                        handleRemoveHighlight(cfi);
                      },
                      onCopy: (text) => {
                        copyToClipboard(text);
                      },
                      onNavigate: (cfi) => {
                        rendition.display(cfi);
                      },
                    });
                  };

                  try {
                    await rendition.annotations.add(
                      "highlight", 
                      highlight.cfi, 
                      { highlightId: highlight.cfi }, // Store ID in data
                      clickHandler, // NEW: Click callback
                      "highlight-clickable", // NEW: CSS class for styling
                      {
                        fill: highlight.color || "yellow",
                        "fill-opacity": 0.2,
                        cursor: "pointer", // NEW: Show pointer cursor
                      }
                    );
                    logger.debug?.(`Successfully restored highlight: ${highlight.cfi}`);
                  } catch (error) {
                    logger.warn?.(`Failed to restore highlight for CFI: ${highlight.cfi}`, error);
                    // Try again after a short delay - sometimes the content needs more time
                    setTimeout(async () => {
                      try {
                        await rendition.annotations.add(
                          "highlight", 
                          highlight.cfi, 
                          { highlightId: highlight.cfi },
                          clickHandler,
                          "highlight-clickable",
                          {
                            fill: highlight.color || "yellow",
                            "fill-opacity": 0.2,
                            cursor: "pointer",
                          }
                        );
                        logger.debug?.(`Retry successful for CFI: ${highlight.cfi}`);
                      } catch (retryError) {
                        logger.warn?.(`Retry failed for CFI: ${highlight.cfi}`, retryError);
                      }
                    }, 1000);
                  }
                }
              };

              // NEW: Optimized restoration using spatial index + debounce
              // Only restores highlights for current section (performance optimization)
              const restoreHighlightsOnLocationChange = debounce((location: string) => {
                // Get highlights for current section only
                const sectionHighlights = highlightIndex.getForSection(location);
                logger.debug?.(`Restoring ${sectionHighlights.length} highlights for current section`);
                
                sectionHighlights.forEach(highlight => {
                  if (!highlight.cfi || typeof highlight.cfi !== 'string' || !highlight.cfi.startsWith('epubcfi(')) {
                    return;
                  }
                  
                  // Click handler for context menu
                  const clickHandler = (event: MouseEvent) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    showHighlightContextMenu(event, {
                      highlight,
                      onEdit: undefined,
                      onRemove: (cfi) => handleRemoveHighlight(cfi),
                      onCopy: (text) => copyToClipboard(text),
                      onNavigate: (cfi) => rendition.display(cfi),
                    });
                  };
                  
                  try {
                    rendition.annotations.add(
                      "highlight", 
                      highlight.cfi, 
                      { highlightId: highlight.cfi },
                      clickHandler,
                      "highlight-clickable",
                      {
                        fill: highlight.color || "yellow",
                        "fill-opacity": 0.2,
                        cursor: "pointer",
                      }
                    );
                  } catch (error) {
                    // Silently fail for location changes - this is expected for highlights not in current view
                  }
                });
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