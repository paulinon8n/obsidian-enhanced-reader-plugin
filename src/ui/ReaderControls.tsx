import * as React from "react";
import { useEffect, useRef, useCallback } from "react";
import type { ThemeMode, FontFamilyChoice } from "../adapters/epubjs/theme";

const barStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px",
  padding: "8px 10px",
  background: "var(--background-secondary)",
  borderBottom: "1px solid var(--background-modifier-border)",
};

const iconBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 4,
  cursor: "pointer",
  userSelect: "none",
};

function IconButton({
  name,
  label,
  active,
  disabled,
  onClick,
}: {
  name: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setIcon = (window as any)?.setIcon;
    if (setIcon && ref.current) {
      setIcon(ref.current, name);
    }
  }, [name]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    onClick?.();
  }, [disabled, onClick]);

  return (
    <div
      className={`clickable-icon ${active ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
      aria-label={label}
      aria-disabled={disabled}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !disabled) {
          event.preventDefault();
          onClick?.();
        }
      }}
      style={{
        ...iconBtnStyle,
        outline: active ? "1px solid var(--interactive-accent)" : undefined,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div ref={ref} />
    </div>
  );
}

type ReaderControlsProps = {
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  theme: ThemeMode;
  onThemeChange: (value: ThemeMode | undefined) => void;
  fontFamily: FontFamilyChoice;
  onFontFamilyChange: (value: FontFamilyChoice) => void;
  bionic: boolean;
  onBionicChange: (value: boolean) => void;
  selectionActive?: boolean;
  selectionText?: string;
  selectionChapter?: string;
  selectionExistingHighlight?: string | null;
  onSelectionHighlight?: () => void;
  onSelectionExport?: () => void;
  onSelectionCancel?: () => void;
  onRemoveHighlight?: (cfi: string) => void;
  searchOpen: boolean;
  searchQuery: string;
  searching: boolean;
  searchResultCount: number;
  activeSearchIndex: number | null;
  onSearchToggle: () => void;
  onSearchClose: () => void;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  onSearchNext: () => void;
  onSearchPrev: () => void;
};

export function ReaderControls({
  fontSize,
  onFontSizeChange,
  theme,
  onThemeChange,
  fontFamily,
  onFontFamilyChange,
  bionic,
  onBionicChange,
  selectionActive,
  selectionText,
  selectionChapter,
  selectionExistingHighlight,
  onSelectionHighlight,
  onSelectionExport,
  onSelectionCancel,
  onRemoveHighlight,
  searchOpen,
  searchQuery,
  searching,
  searchResultCount,
  activeSearchIndex,
  onSearchToggle,
  onSearchClose,
  onSearchQueryChange,
  onSearchSubmit,
  onSearchClear,
  onSearchNext,
  onSearchPrev,
}: ReaderControlsProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [searchOpen]);

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSearchSubmit();
    },
    [onSearchSubmit]
  );

  const handleSelectionHighlight = useCallback(() => {
    onSelectionHighlight?.();
  }, [onSelectionHighlight]);

  const handleSelectionExport = useCallback(() => {
    onSelectionExport?.();
  }, [onSelectionExport]);

  const handleSelectionCancel = useCallback(() => {
    onSelectionCancel?.();
  }, [onSelectionCancel]);

  const resultPosition = activeSearchIndex != null && searchResultCount > 0 ? activeSearchIndex + 1 : 0;

  return (
    <div style={barStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <IconButton name="sun" label="Tema claro" active={theme === "light"} onClick={() => onThemeChange("light")} />
        <IconButton name="palette" label="Tema sépia" active={theme === "sepia"} onClick={() => onThemeChange("sepia")} />
        <IconButton name="moon" label="Tema escuro" active={theme === "dark"} onClick={() => onThemeChange("dark")} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label htmlFor="fontSizeSlider" style={{ marginRight: 4 }}>Tamanho</label>
        <input
          id="fontSizeSlider"
          type="range"
          min="80"
          max="160"
          value={fontSize}
          onChange={(event) => onFontSizeChange(parseInt(event.target.value, 10))}
        />
        <select
          aria-label="Família tipográfica"
          value={fontFamily}
          onChange={(event) => onFontFamilyChange(event.target.value as FontFamilyChoice)}
        >
          <option value="system">System</option>
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
          <option value="opendyslexic">OpenDyslexic</option>
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={bionic} onChange={(event) => onBionicChange(event.target.checked)} />
          Bionic
        </label>
      </div>

      {selectionActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div
            style={{
              maxWidth: 320,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectionChapter && <strong style={{ marginRight: 6 }}>{selectionChapter}:</strong>}
            {selectionText}
          </div>
          {selectionExistingHighlight ? (
            // Show remove option for existing highlights
            <>
              <div style={{ 
                color: "var(--text-accent)", 
                fontSize: "12px",
                background: "var(--background-modifier-success)",
                padding: "2px 6px",
                borderRadius: "3px"
              }}>
                Destaque existente detectado
              </div>
              <button 
                onClick={() => onRemoveHighlight?.(selectionExistingHighlight)}
                style={{ 
                  color: "var(--text-error)",
                  background: "var(--background-modifier-error-hover)",
                  border: "1px solid var(--background-modifier-error)",
                  borderRadius: "3px",
                  padding: "4px 8px"
                }}
              >
                Remover destaque
              </button>
              <button className="mod-cta" onClick={handleSelectionExport}>Enviar para a nota</button>
              <button onClick={handleSelectionCancel}>Cancelar</button>
            </>
          ) : (
            // Show normal highlight/export options for new selections
            <>
              <button className="mod-cta" onClick={handleSelectionExport}>Enviar para a nota</button>
              <button onClick={handleSelectionHighlight}>Destacar</button>
              <button onClick={handleSelectionCancel}>Cancelar</button>
            </>
          )}
        </div>
      )}

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <IconButton
          name="search"
          label="Pesquisar no livro"
          active={searchOpen}
          onClick={searchOpen ? onSearchClose : onSearchToggle}
        />
        {searchOpen && (
          <form
            onSubmit={handleSearchSubmit}
            style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
          >
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Buscar no livro"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              style={{ minWidth: 180 }}
            />
            <button type="submit" disabled={searching}>
              {searching ? "Buscando…" : "Buscar"}
            </button>
            <button
              type="button"
              onClick={onSearchClear}
              disabled={!searchQuery && searchResultCount === 0}
            >
              Limpar
            </button>
            {searchResultCount > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <button type="button" onClick={onSearchPrev} disabled={searchResultCount === 0}>
                  Anterior
                </button>
                <span style={{ color: "var(--text-muted)" }}>
                  {resultPosition}/{searchResultCount}
                </span>
                <button type="button" onClick={onSearchNext} disabled={searchResultCount === 0}>
                  Próximo
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
