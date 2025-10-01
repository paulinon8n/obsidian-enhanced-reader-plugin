# Changelog v1.6.1 - Context Menu & Clickable Highlights

## ✅ Fixes

- Context menu for highlights now opens at the correct cursor position even when clicking inside the ePub iframe.
- Newly created highlights are immediately clickable (no need to close and reopen the book).

## 🔧 Technical

- Position translation from iframe to app window using `getBoundingClientRect` and `showAtPosition` (fallback to synthesized event).
- Unified highlight creation into a helper (`addClickableHighlight`) to attach click handlers and consistent styles.

## 🧪 Validation

- Tested in paginated and scrolled flow modes.
- Verified in split-view layouts (pane offsets accounted for).

## 📦 Version

- Bumped to `1.6.1` and updated `manifest.json` and `versions.json`.
