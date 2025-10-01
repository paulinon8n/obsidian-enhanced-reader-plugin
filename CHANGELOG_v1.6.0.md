# Changelog v1.6.0 - Highlight Management System

## 🎯 Overview

Version 1.6.0 introduces a comprehensive highlight management system, allowing users to not only create highlights but also remove them interactively. This complements the existing search and toolbar persistence features from v1.5.0.

## ✨ New Features

### Interactive Highlight Removal

- **Context-Aware Detection**: Automatically detects when selected text is within an existing highlight
- **Visual Feedback**: Green badge "Destaque existente detectado" appears when highlighting existing text
- **One-Click Removal**: Red "Remover destaque" button removes the highlight permanently
- **Persistent Storage**: Highlights properly removed from both view and plugin data

### Technical Implementation

#### CFI-Based Matching
- Uses Canonical Fragment Identifiers (CFI) for reliable highlight identification
- Compares selection CFI with stored highlights to determine overlap
- Handles partial matches and CFI containment

#### Event-Driven Architecture
- Leverages epub.js `selected` event for text selection detection
- Simplified approach avoiding complex DOM traversal
- Direct comparison of CFI strings for better reliability

#### Code Changes

**Files Modified:**
- `src/EpubReader.tsx`: Main reader component with highlight detection logic
- `src/EpubView.tsx`: Added `removeHighlight()` method for persistence
- `src/ui/ReaderControls.tsx`: Updated UI to show context-aware buttons
- `src/EpubPluginSettings.ts`: Types for selection state with existing highlight info

**Key Functions:**
- `handleHighlightClick()`: Detects if selection overlaps with existing highlight
- `removeHighlight()`: Removes highlight from rendition and storage
- `setupHighlightClickHandlers()`: Removed (simplified approach)

## 🐛 Bug Fixes

- Fixed highlight restoration issues with invalid CFIs (from v1.5.1)
- Improved reliability of highlight detection
- Better handling of edge cases in text selection

## 📊 Technical Details

- **Version**: 1.6.0
- **Bundle Size**: ~562.7KB (optimized)
- **Minimum Obsidian Version**: 0.12.0
- **Dependencies**: No new dependencies added

## 🔄 Migration Notes

- No migration needed - fully backward compatible
- Existing highlights from previous versions continue to work
- All settings and data structures remain unchanged

## 🧪 Testing

- Tested with multiple EPUB files containing various highlight configurations
- Verified CFI matching with different text selections
- Confirmed persistence across plugin reloads and Obsidian restarts

## 📝 Usage Instructions

### Creating Highlights
1. Select text in the EPUB
2. Click "Destacar" button
3. Highlight appears in yellow

### Removing Highlights
1. Select text within an existing highlight
2. Green badge appears: "Destaque existente detectado"
3. Click red "Remover destaque" button
4. Highlight is removed

## 🚀 Future Enhancements

Potential improvements for future versions:
- Highlight color selection
- Highlight annotations/notes
- Export all highlights to a note
- Highlight search and filtering
- Keyboard shortcuts for highlight operations

## 👥 Credits

- Original ePub Reader Plugin by [caronc](https://github.com/caronc)
- Enhanced by Dr. Paulo Bernardy
- Community feedback and testing

## 📄 License

MIT License - See LICENSE file for details

---

**Release Date**: October 1, 2025
**Commit**: To be tagged as v1.6.0
