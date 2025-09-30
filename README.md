![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/paulinon8n/obsidian-enhanced-reader-plugin) ![GitHub all releases](https://img.shields.io/github/downloads/paulinon8n/obsidian-enhanced-reader-plugin/total) ![GitHub Release Date](https://img.shields.io/github/release-date/paulinon8n/obsidian-enhanced-reader-plugin) ![GitHub last commit](https://img.shields.io/github/last-commit/paulinon8n/obsidian-enhanced-reader-plugin)

## Obsidian Enhanced Reader Plugin

This is an enhanced ePub reader plugin for Obsidian (https://obsidian.md). Can open document with `.epub` file extension.

- [Obsidian Enhanced Reader Plugin](#obsidian-enhanced-reader-plugin)
  - [How to use](#how-to-use)
    - [1. Put books into any vault folder](#1-put-books-into-any-vault-folder)
    - [2. Click book to open an epub view](#2-click-book-to-open-an-epub-view)
    - [3. Reading](#3-reading)
  - [Manually installing the plugin](#manually-installing-the-plugin)

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

### Architecture notes

This plugin follows a lightweight Ports & Adapters structure:

- Core (pure TS): logging, storage contract, sanitizer
- Adapters (epub.js): content hook and theme application
- Hooks: dark-mode detection
- UI: ErrorBoundary

See `ARCHITECTURE.md` for details. This layout reduces regressions and makes features easier to evolve.
