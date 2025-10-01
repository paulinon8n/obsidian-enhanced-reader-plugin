# Changelog

All notable changes to the Enhanced Reader Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Highlight Context Menu**: Now opens only on right-click (contextmenu) instead of left-click
  - More intuitive - follows standard OS convention for context menus
  - Integrates better with native browser/epub.js text selection menu
  - Cursor changed from `pointer` to `context-menu` for visual clarity
  - Left-click on highlights no longer triggers menu (allows normal reading flow)

## [1.6.1] - 2025-10-01

### Fixed

- **Context Menu Position**: Fixed issue where highlight context menu appeared in the top-left corner instead of at cursor position
  - Proper coordinate translation from ePub iframe to main app window using `getBoundingClientRect` and `showAtPosition`
  - Fallback to synthesized event when `showAtPosition` is unavailable
- **Immediate Clickability**: Newly created highlights are now immediately clickable (no need to close and reopen book)

### Technical

- Unified highlight creation into `addClickableHighlight()` helper for consistent click handlers and styles
- Robust position calculation for split-view layouts and iframe offsets
- Tested in paginated and scrolled flow modes

## [1.6.0] - 2025-10-01

### Added

- **Interactive Highlight Removal System**
  - Context-aware detection when selecting text within existing highlights
  - Visual feedback with green badge "Destaque existente detectado"
  - One-click removal with red "Remover destaque" button
  - Persistent storage with highlights removed from both view and plugin data
- **CFI-Based Highlight Matching**
  - Uses Canonical Fragment Identifiers for reliable highlight identification
  - Handles partial matches and CFI containment
  - Event-driven architecture leveraging epub.js `selected` event

### Technical

- Simplified approach avoiding complex DOM traversal
- Direct CFI string comparison for better reliability
- Removed `setupHighlightClickHandlers()` in favor of simplified detection
- Enhanced `EpubReader.tsx` with `handleHighlightClick()` logic
- Added `removeHighlight()` method to `EpubView.tsx`

### Performance

- Bundle size: ~562.7KB (optimized)
- No new dependencies added
- Fully backward compatible with existing highlights

## [1.5.1] - 2025-09-30

### Fixed

- **Highlight Restoration Issues**
  - Implemented automatic retry system for CFIs that fail on first attempt
  - Added CFI validation before attempting to restore highlights
  - Highlights now restore properly on both initial opening and section navigation
  - Improved logging for diagnosing invalid CFI issues

## [1.5.0] - 2025-09-25

### Added

- **In-Book Search System**
  - Full-text search within entire EPUB books
  - Result navigation with previous/next buttons
  - Context excerpts showing text around search results
  - Chapter information for each result
  - Temporary highlighting of search results
  - Search panel with magnifying glass icon activation
- **Smart Toolbar Persistence**
  - Per-book settings for font size, theme, family, and bionic mode
  - Global defaults applied to new books
  - Automatic restoration when reopening books
  - Settings sync via plugin configuration

### Removed

- Dependency on `use-local-storage-state` (replaced with plugin settings)

### Technical

- Enhanced React controls for search panel integration
- Robust retry system with CFI validation for highlight restoration
- Chapter display for active selections

## [1.4.1] - 2025-09-20

### Fixed

- **Persistent Highlights**: Fixed issue where highlights created with "Destacar" button disappeared when closing and reopening EPUB
  - Highlights now properly saved to plugin settings per file
  - Visual restoration on subsequent openings
  - Export to note functionality remains unchanged

### Technical

- Unified highlight persistence routine to avoid duplication
- Cleaner internal maintenance

## [1.4.0] - 2025-09-15

### Added

- **Embedded OpenDyslexic Font**
  - OpenDyslexic font family now bundled directly in plugin
  - Works 100% offline without system font dependencies
  - Avoids CSP and path issues in iframe
  - No extra files needed for Community Store distribution

### Technical

- Pre-build script (`scripts/generate-open-dyslexic.mjs`) converts WOFF files to data URLs
- Auto-generated `src/assets/OpenDyslexicCss.ts` with `@font-face` rules
- Content hook ensures CSS injection in iframe document
- Consistent font and Bionic application across chapter/section navigation

### Improved

- Font and Bionic mode consistency when navigating between sections

## [1.3.1] - 2025-09-10

### Added

- OpenDyslexic font family option (system-dependent with Sans/Serif fallback)

## [1.3.0] - 2025-09-08

### Added

- **Font Family Selection**: System / Sans / Serif options in toolbar
- **Bionic Reading Mode** (experimental): Highlights word beginnings to aid reading (dyslexia/ADHD support)
- **Per-File Preferences**: Font family and Bionic mode saved per book

### Technical

- `applyFontFamily` applies font-family to Rendition
- Content hook processes text nodes, creating `<span class="br-strong">` and `<span class="br-tail">` elements
- Idempotent section processing with class-based activation
- Obsidian native icons using `setIcon` for consistent UI

## [1.2.0] - 2025-09-05

### Added

- **Theme Toolbar**: Native Obsidian icons for page theme selection
  - Light (sun), Sepia (palette), Dark (moon) themes
  - Per-file theme persistence (path-based key)
  - Per-file font size memory
  - Automatic Obsidian theme following when no explicit choice made

### Technical

- Enhanced `applyTheme` with `light | sepia | dark` support
- `ReaderControls` renders icons with native Obsidian styling
- Improved accessibility and active button states

## [1.1.0] - 2025-09-01

### Added

- **Modular Ports & Adapters Architecture**
  - `core/`: Pure logic (sanitization, logger, storage contracts)
  - `adapters/epubjs/`: epub.js integration (content hooks, theme/font application)
  - `hooks/`: `useDarkMode` for reactive Obsidian theme detection
  - `ui/`: `ErrorBoundary` to prevent reader crashes
  - `EpubReader.tsx` orchestrates components; `EpubView.tsx` wraps with ErrorBoundary

### Testing & Reliability

- Scoped CSP warning suppression to ePub iframe only
- Centralized sanitization: script removal, CSS inlining with `@import` resolution
- Selective `url(blob:)` removal from inline styles
- Unit tests added for `core/sanitizer` (Vitest + jsdom)

### Documentation

- Added `ARCHITECTURE.md` describing architecture and integration points
- Enhanced `README.md` with architecture notes

### Settings & UI

- New "Debug logging" configuration option
- Cleaner reader UI with extracted `ReaderControls` component

### Storage

- Added simple LocalStorage adapter (optional, for tests and future enhancements)

## [1.0.2] - 2025-08-25

### Fixed

- **Loading Issues**: Fixed cases where reader could get stuck on "loading..."
  - Added guards in content hook to ensure iframe `window`/`document` are ready
  - Default reading position now `undefined` instead of `0` to avoid invalid CFI display
  - Removed automatic progress key migration during initialization

### Changed

- **Progress Tracking**: Reading progress now saved per file (path-based key) to avoid title collisions
  - Backward compatible: old keys not automatically deleted
  - Note: In "Scrolled View" mode, pagination API (`prevPage`/`nextPage`) unavailable by design

## [1.0.1] - 2025-08-20

### Fixed

- Scoped CSP log suppression to ePub iframe only (no global console override)
- Preserved CSS and data:/blob: resources with inline stylesheet links when possible
- Selective inline style stripping (only removes `url(blob:)` properties)
- Re-enabled right-click context menu inside ePub content
- Live theme change reaction (re-applies rendition theme overrides)

### Improved

- Reduced console noise
- Better book styling fidelity
- Smooth, predictable experience

## [1.0.0] - 2025-08-15

### Added

- **ePub Reading**: Full `.epub` file support directly in Obsidian
- **Theme Support**: Automatic light/dark theme switching based on Obsidian theme
- **Reading Modes**: Paginated or continuous scrolling view
- **Font Control**: Adjustable font size (80%-160%)
- **Table of Contents**: Interactive TOC for easy navigation
- **Progress Saving**: Automatic reading position saving
- **Note Integration**: Create linked notes for books
- **Tagging System**: Customizable tags for book notes
- **Folder Management**: Flexible note organization options

### Technical Details

- Minimum Obsidian Version: 0.12.0
- Platform Compatibility: Desktop and Mobile
- Author: Dr. Paulo Bernardy
- Based on original ePub Reader Plugin by [caronc](https://github.com/caronc)

---

## Credits

- Original ePub Reader Plugin by [caronc](https://github.com/caronc)
- Enhanced by Dr. Paulo Bernardy
- Community feedback and testing

## License

MIT License - See LICENSE file for details