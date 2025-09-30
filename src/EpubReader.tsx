import * as React from "react";
import { useEffect, useRef, useState, useCallback } from 'react';
import { WorkspaceLeaf } from 'obsidian';
import { ReactReader, ReactReaderStyle, type IReactReaderStyle } from 'react-reader';
import type { Contents, Rendition } from 'epubjs';
import useLocalStorageState from 'use-local-storage-state';
import { useDarkMode } from './hooks/useDarkMode';
import { applyFontSize, applyTheme } from './adapters/epubjs/theme';
import { createDefaultSanitizer } from './core/sanitizer';
import { registerContentHook } from './adapters/epubjs/contentHook';
import { createConsoleLogger } from './core/logger';
import { ReaderControls } from './ui/ReaderControls';

export const EpubReader = ({ contents, title, scrolled, tocOffset, tocBottomOffset, leaf, storageKey, debugLogging }: {
  contents: ArrayBuffer;
  title: string;
  scrolled: boolean;
  tocOffset: number;
  tocBottomOffset: number;
  leaf: WorkspaceLeaf;
  storageKey?: string; // optional unique key for saving location (defaults to title-based)
  debugLogging?: boolean;
}) => {
  // Prefer a unique key per file to avoid collisions; fallback keeps backward compatibility
  const resolvedStorageKey = storageKey ?? `epub-${title}`;
  const [location, setLocation] = useLocalStorageState<string | number | undefined>(resolvedStorageKey, { defaultValue: undefined });
  const renditionRef = useRef<Rendition | null>(null);
  const [fontSize, setFontSize] = useState(100);
  const isDarkMode = useDarkMode();

  const locationChanged = useCallback((epubcifi: string | number) => {
    setLocation(epubcifi);
  }, [setLocation]);

  const updateTheme = useCallback((rendition: Rendition, theme: 'light' | 'dark') => {
    applyTheme(rendition, theme);
  }, []);

  const updateFontSize = useCallback((size: number) => {
    if (renditionRef.current) applyFontSize(renditionRef.current, size);
  }, []);

  useEffect(() => {
    updateFontSize(fontSize);
  }, [fontSize, updateFontSize]);

  // Re-apply theme overrides when Obsidian theme changes
  useEffect(() => {
    if (renditionRef.current) {
      updateTheme(renditionRef.current, isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode, updateTheme]);

  useEffect(() => {
    const handleResize = () => {
      const epubContainer = leaf.view.containerEl.querySelector('div.epub-container');
      if (!epubContainer || !epubContainer.parentElement) return;

      const viewContentStyle = getComputedStyle(epubContainer.parentElement);
      renditionRef.current?.resize(
        parseFloat(viewContentStyle.width),
        parseFloat(viewContentStyle.height)
      );
    };

    leaf.view.app.workspace.on('resize', handleResize);
    return () => leaf.view.app.workspace.off('resize', handleResize);
  }, [leaf]);

  const readerStyles = isDarkMode ? darkReaderTheme : lightReaderTheme;

  const sanitizer = React.useMemo(() => createDefaultSanitizer({
    inlineStylesheets: true,
    removeScripts: true,
    stripBlobUrlsInInlineStyles: true,
  }), []);

  // Note: We intentionally avoid migrating old storage keys at runtime to keep initialization simple and stable.
  // If needed later, we can provide a manual migration or dual-write strategy.

  const logger = createConsoleLogger(!!debugLogging);

  return (
    <div style={{ height: "100vh" }}>
      <ReaderControls fontSize={fontSize} onFontSizeChange={setFontSize} />
      <ReactReader
        title={title}
        showToc={true}
        location={location}
        locationChanged={locationChanged}
        swipeable={false}
        url={contents}
        getRendition={(rendition: Rendition) => {
          renditionRef.current = rendition;
          // Configure rendition to handle CSP issues via adapter-hook and core sanitizer
          rendition.hooks.content.register((c: Contents) => registerContentHook(c, sanitizer, logger));

          updateTheme(rendition, isDarkMode ? 'dark' : 'light');
          updateFontSize(fontSize);
        }}
        epubOptions={scrolled ? {
          allowPopups: false, // Disable popups to avoid CSP issues
          allowScriptedContent: false, // Disable scripts to avoid sandbox issues
          flow: "scrolled",
          manager: "continuous",
        } : {
          allowPopups: false, // Disable popups to avoid CSP issues
          allowScriptedContent: false, // Disable scripts to avoid sandbox issues
        }}
        readerStyles={readerStyles}
      />
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
    color: 'white',
  },
  arrowHover: {
    ...ReactReaderStyle.arrowHover,
    color: '#ccc',
  },
  readerArea: {
    ...ReactReaderStyle.readerArea,
    backgroundColor: '#000',
    transition: undefined,
  },
  titleArea: {
    ...ReactReaderStyle.titleArea,
    color: '#ccc',
  },
  tocArea: {
    ...ReactReaderStyle.tocArea,
    background: '#111',
  },
  tocButtonExpanded: {
    ...ReactReaderStyle.tocButtonExpanded,
    background: '#222',
  },
  tocButtonBar: {
    ...ReactReaderStyle.tocButtonBar,
    background: '#fff',
  },
  tocButton: {
    ...ReactReaderStyle.tocButton,
    color: 'white',
  },
};