![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/paulinon8n/obsidian-enhanced-reader-plugin) ![GitHub all releases](https://img.shields.io/github/downloads/paulinon8n/obsidian-enhanced-reader-plugin/total) ![GitHub Release Date](https://img.shields.io/github/release-date/paulinon8n/obsidian-enhanced-reader-plugin) ![GitHub last commit](https://img.shields.io/github/last-commit/paulinon8n/obsidian-enhanced-reader-plugin)

## Obsidian Enhanced Reader Plugin

This is an enhanced ePub reader plugin for Obsidian (https://obsidian.md). Can open document with `.epub` file extension.

### ✨ Key Features

- 📚 **Full EPUB Support**: Read `.epub` files directly in Obsidian
- 🔍 **In-Book Search**: Search within the entire book with result navigation and excerpts
- ✏️ **Highlight Management**: Create, view, and remove highlights with context-aware interface
- 🎨 **Theme Control**: Light, Dark, or Sepia themes (auto-follows Obsidian theme)
- 🔤 **Font Customization**: Adjustable size (80-160%) and family (System/Sans/Serif/OpenDyslexic)
- 🧠 **Bionic Reading**: Experimental mode to assist with dyslexia/ADHD
- 💾 **Persistent Settings**: Per-book preferences for reading position, theme, font, and highlights
- 📝 **Note Integration**: Export selections to notes with citations and deep links
- 📑 **Table of Contents**: Interactive navigation through book chapters

### Table of Contents

- [How to use](#how-to-use)
- [Features](#features)
  - [Highlight Management](#highlight-management)
  - [Search Functionality](#search-functionality)
  - [Toolbar and Preferences](#toolbar-and-preferences)
- [Installation](#manually-installing-the-plugin)
- [Settings](#settings)
- [Development](#development)
- [Changelog](#changelog)

### How to use

#### 1. Put books into any vault folder
<img width="326" alt="image" src="https://user-images.githubusercontent.com/150803/166110556-32f43b3c-fb54-4767-a8e1-005740359ade.png">

#### 2. Click book to open an epub view
![687BE408-BC9A-4AAC-915F-2CA77DE6516D](https://user-images.githubusercontent.com/150803/166110865-bcf2bade-f88b-40b9-855d-cffbd115132d.png)

#### 3. Reading
![DD6C75EE-3805-43FE-9A86-4CFDF88DBB75](https://user-images.githubusercontent.com/150803/166111153-637ed20c-c49d-4c75-90b8-14ebf4e30172.png)

**TOC**
![260FB389-0503-488B-860D-3535A4F7CACF](https://user-images.githubusercontent.com/150803/166111158-cde58136-8a8a-4d93-96bf-14b7d3f80ab2.png)

### Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-enhanced-reader-plugin/`.

## Features

### Highlight Management

**Creating Highlights:**
1. Select any text in the EPUB
2. Click the "Destacar" (Highlight) button in the toolbar
3. The text is highlighted in yellow and saved automatically

**Removing Highlights:**
1. Select text within an existing highlight (drag to select)
2. Notice the green badge: "Destaque existente detectado" (Existing highlight detected)
3. Click the red "Remover destaque" (Remove highlight) button
4. The highlight is permanently removed

**Features:**
- ✅ Highlights persist across reading sessions
- ✅ Automatic detection of existing highlights when selecting text
- ✅ Visual feedback (green badge) when highlighting existing text
- ✅ Context-aware toolbar that adapts to selection type
- ✅ Export highlighted text to notes with citations

### Search Functionality

**How to Search:**
1. Click the search icon (magnifying glass) in the toolbar
2. Enter your search query
3. Navigate through results with Previous/Next buttons
4. Click "Clear" to remove search highlights

**Features:**
- ✅ Full-text search across the entire book
- ✅ Result count and current position indicator
- ✅ Excerpts showing context around matches
- ✅ Chapter information for each result
- ✅ Temporary highlighting of search results
- ✅ Keyboard navigation support

### Toolbar and preferences

- Theme selector in the reader toolbar (native Obsidian icons):
  - Light (sun), Sepia (palette), Dark (moon)
  - If you don't pick a theme, the reader follows Obsidian's light/dark automatically
- Font size slider (80%–160%)
- Font family selector: System / Sans / Serif / OpenDyslexic (embutida e 100% offline)
- Bionic Reading mode (experimental): emphasizes the start of words to assist dyslexia/ADHD — can be toggled on/off
- In-book search: open the magnifier icon to search the current title, jump through the matches, and preview excerpts before navigating
- Your preferences are saved per book (per-file):
  - Reading position (where you stopped)
  - Font size
  - Theme choice (if you explicitly select one)
  - Font family and Bionic mode
  - Latest toolbar adjustments become the default for newly opened books (you can still override per title)
  - Highlights: your manual highlights are persisted per book and restored on reopen. You can also export a selection to the companion note with an automatic citation and a deep link back to the exact location in the book.
  - **Highlight management**: Click on any existing highlight to remove it. A toolbar will appear with removal options.

### Architecture notes

This plugin follows a lightweight Ports & Adapters structure:

- Core (pure TS): logging, storage contract, sanitizer
- Adapters (epub.js): content hook and theme application
- Hooks: dark-mode detection
- UI: ErrorBoundary

See `ARCHITECTURE.md` for details. This layout reduces regressions and makes features easier to evolve.

### Development

- Run production build: `npm run build`
- Build embeds the OpenDyslexic font rules into the bundle during the `prebuild` step.
- Run tests (optional): `npm run test`

### Settings

- Scrolled View: ativa leitura por rolagem contínua
- Same Folder: cria a nota do livro na mesma pasta do arquivo .epub
- Note Folder: pasta padrão das notas (quando Same Folder está desligado)
- Tags: tags adicionadas no frontmatter da nota criada
- Debug logging: habilita logs detalhados para diagnóstico

### Changelog

- Consulte o arquivo `RELEASE_NOTES.md` para ver o histórico de mudanças.
