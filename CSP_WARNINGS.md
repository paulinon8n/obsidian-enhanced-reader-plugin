# CSP (Content Security Policy) Warnings - Enhanced Reader Plugin

## About the Warnings

When using the Enhanced Reader Plugin, you may see Content Security Policy (CSP) warnings in the Obsidian console. These warnings are **expected and do not affect functionality**.

## Common Warnings

### 1. Stylesheet Blob URL Warnings

```text
Refused to load the stylesheet 'blob:app://obsidian.md/...' because it violates the following Content Security Policy directive
```

### 2. Sandboxed Script Warnings  

```text
Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set
```

## Why These Warnings Occur

1. **epub.js Architecture**: The epub.js library renders ePub content in sandboxed iframes for security
2. **Obsidian's Security**: Obsidian has strict CSP rules to protect user data
3. **ePub Content**: Some ePub files contain CSS and JavaScript that triggers these warnings

## Impact on Functionality

✅ **No functional impact**: The plugin works correctly despite these warnings
✅ **Reading experience**: All core features (reading, navigation, themes) work normally  
✅ **Security maintained**: Obsidian's security is not compromised

## Technical Details

- The plugin automatically sanitizes problematic scripts and external resources
- CSS blob URLs are blocked but fallback styling ensures readability
- Interactive ePub features may be limited, but basic reading is unaffected

## Suppressing Warnings (Optional)

The plugin includes built-in warning suppression for known CSP issues. These warnings are cosmetic and don't indicate actual problems with the plugin.

### Implementation details

- The suppression is scoped to the ePub iframe only (does not override the global console)
- The DOM sanitizer removes scripts and inlines stylesheets when possible, reducing CSP noise
- Inline styles using `url(blob:...)` are stripped selectively to avoid violations without losing layout

---

*If you experience actual functionality issues (not just console warnings), please report them on the GitHub repository.*
