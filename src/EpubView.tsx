import { WorkspaceLeaf, FileView, TFile, Menu, moment, Notice } from "obsidian";
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { EpubPluginSettings, HighlightEntry, ToolbarState } from "./EpubPluginSettings";
import { EpubReader } from "./EpubReader";
import { ErrorBoundary } from './ui/ErrorBoundary';
import type EpubPlugin from './EpubPlugin';

export const EPUB_FILE_EXTENSION = "epub";
export const VIEW_TYPE_EPUB = "epub";
export const ICON_EPUB = "doc-epub";

const DEFAULT_TOOLBAR_STATE: ToolbarState = {
  fontSize: 100,
  fontFamily: 'system',
  bionic: false,
  theme: undefined,
};

export class EpubView extends FileView {
  allowNoFile: false;
  // Will be set by protocol handler to jump to a specific CFI
  pendingCfi?: string;

  constructor(leaf: WorkspaceLeaf, private settings: EpubPluginSettings, private plugin: EpubPlugin) {
    super(leaf);
  }

  onPaneMenu(menu: Menu, source: 'more-options' | 'tab-header' | string): void {
    menu.addItem((item) => {
      item
        .setTitle("Create new epub note")
        .setIcon("document")
        .onClick(async () => {
          const fileName = this.getFileName();
          let file = this.app.vault.getAbstractFileByPath(fileName);
          if (file == null || !(file instanceof TFile)) {
            file = await this.app.vault.create(fileName, this.getFileContent());
          }
          const fileLeaf = this.app.workspace.createLeafBySplit(this.leaf);
          fileLeaf.openFile(file as TFile, {
            active: true
          });
        });
    });
    // Per-book tags editor
    menu.addItem((item) => {
      item
        .setTitle("Editar tags deste livro")
        .setIcon("hashtag")
        .onClick(async () => {
          const current = this.getPerBookTags();
          const input = await this.prompt("Tags para este livro (separadas por vírgula)", current ?? this.settings.tags);
          if (input == null) return;
          const key = this.file?.path ?? '';
          if (!key) return;
          this.settings.perBookTags = this.settings.perBookTags ?? {};
          this.settings.perBookTags[key] = input;
          // persist via plugin owner (settings saved externally)
          // try calling save if available through leaf owner
          try { await this.plugin.saveSettings(); } catch (e) { console.warn(e); }
          new Notice('Tags atualizadas para este livro');
        });
    });
    menu.addSeparator();
    super.onPaneMenu(menu, source);
  }

  private async prompt(title: string, value: string): Promise<string | null> {
    // Minimal prompt using window.prompt to avoid UI boilerplate
    // eslint-disable-next-line no-alert
    const v = window.prompt(title, value);
    if (v == null) return null;
    return v.trim();
  }

  getFileName() {
    let filePath;
    if (this.settings.useSameFolder) {
      filePath = `${this.file.parent.path}/`;
    } else {
      filePath = this.settings.notePath.endsWith('/')
        ? this.settings.notePath
        : `${this.settings.notePath}/`;
    }
    return `${filePath}${this.file.basename}.md`;
  }

  getFileContent() {
    const perBook = this.getPerBookTags();
    const tags = perBook && perBook.trim().length > 0 ? perBook : this.settings.tags;
    return `---
Tags: ${tags}
Date: ${moment().toLocaleString()}
---

# ${this.file.basename}
`;
  }

  async onLoadFile(file: TFile): Promise<void> {
    ReactDOM.unmountComponentAtNode(this.contentEl);
    this.contentEl.empty();
    const viewHeaderStyle = getComputedStyle(this.containerEl.parentElement.querySelector('div.view-header'));
    const viewHeaderHeight = parseFloat(viewHeaderStyle.height);
    const viewHeaderWidth = parseFloat(viewHeaderStyle.width);

    const viewContentStyle = getComputedStyle(this.containerEl.parentElement.querySelector('div.view-content'));
    const viewContentPaddingBottom = parseFloat(viewContentStyle.paddingBottom);
    const viewContentPaddingTop = parseFloat(viewContentStyle.paddingTop);

    const tocOffset = (viewHeaderHeight < viewHeaderWidth ? viewHeaderHeight : 0) + viewContentPaddingTop + 1;
    const tocBottomOffset = viewContentPaddingBottom;

  const contents = await this.app.vault.adapter.readBinary(file.path);
    // Ensure side-note exists automatically
    await this.ensureNoteExists();

    const initialLocation = this.pendingCfi ?? this.settings.locations?.[file.path];
  const toolbarState = this.getToolbarState(file.path);
    // Clear pending after consuming
    this.pendingCfi = undefined;

    ReactDOM.render(
      <ErrorBoundary>
        <EpubReader
          contents={contents}
          title={file.basename}
          debugLogging={this.settings.debugLogging}
          scrolled={this.settings.scrolledView}
          tocOffset={tocOffset}
          tocBottomOffset={tocBottomOffset}
          leaf={this.leaf}
          initialLocation={initialLocation}
          initialHighlights={this.settings.highlights?.[file.path] ?? []}
          initialToolbarState={toolbarState}
          onLocationChange={(loc: string | number | undefined) => {
            this.settings.locations = this.settings.locations ?? {};
            if (loc !== undefined) this.settings.locations[file.path] = loc;
            this.plugin.saveSettings().catch(() => {});
          }}
          onExportSelection={async (payload: { cfi: string; text: string; chapter?: string; createdAt: string; }) => {
            await this.appendHighlightToNote(payload);
          }}
          onSaveHighlight={async (payload: { cfi: string; text: string; chapter?: string; createdAt: string; }) => {
            await this.persistHighlight(payload);
          }}
          onRemoveHighlight={async (cfi: string) => {
            await this.removeHighlight(cfi);
          }}
          onToolbarStateChange={(state: ToolbarState) => {
            this.persistToolbarState(file.path, state).catch(() => {});
          }}
        />
      </ErrorBoundary>,
      this.contentEl
    );
  }

  onunload(): void {
    ReactDOM.unmountComponentAtNode(this.contentEl);
  }

  getDisplayText() {
    if (this.file) {
      return this.file.basename;
    } else {
      return 'No File';
    }
  }

  canAcceptExtension(extension: string) {
    return extension == EPUB_FILE_EXTENSION;
  }

  getViewType() {
    return VIEW_TYPE_EPUB;
  }

  getIcon() {
    return ICON_EPUB;
  }

  private getPerBookTags(): string | undefined {
    const key = this.file?.path ?? '';
    return key ? this.settings.perBookTags?.[key] : undefined;
  }

  private async ensureNoteExists() {
    const target = this.getFileName();
    const file = this.app.vault.getAbstractFileByPath(target);
    if (!file || !(file instanceof TFile)) {
      await this.app.vault.create(target, this.getFileContent());
    }
  }

  private getNotePath(): string {
    return this.getFileName();
  }

  private async appendHighlightToNote(entry: { cfi: string; text: string; chapter?: string; createdAt: string; }) {
    // Always persist to settings first to avoid duplicates and to restore on reopen
    await this.persistHighlight(entry);

    const notePath = this.getNotePath();
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!file || !(file instanceof TFile)) {
      await this.ensureNoteExists();
    }
    const tfile = this.app.vault.getAbstractFileByPath(notePath) as TFile;
    const content = await this.app.vault.read(tfile);
    const section = '## Highlights';
    const link = this.buildCfiDeepLink(entry.cfi);
    const chapterInfo = entry.chapter ? ` — ${entry.chapter}` : '';
    const block = `- [${moment().toLocaleString()}] \n  > ${entry.text.replace(/\n/g, '\\n')}\n  >${chapterInfo}\n  >\n  > ${link}\n`;
    let newContent: string;
    if (content.includes(section)) {
      newContent = content.replace(section, `${section}\n${block}`);
    } else {
      newContent = `${content}\n\n${section}\n${block}`;
    }
    await this.app.vault.modify(tfile, newContent);
  }

  private async persistHighlight(entry: { cfi: string; text: string; chapter?: string; createdAt: string; }) {
    const path = this.file?.path ?? '';
    if (!path) return;
    this.settings.highlights = this.settings.highlights ?? {};
    const list = this.settings.highlights[path] ?? [];
    if (!list.find(h => h.cfi === entry.cfi)) {
      list.unshift({ cfi: entry.cfi, text: entry.text, chapter: entry.chapter, createdAt: entry.createdAt } as HighlightEntry);
      this.settings.highlights[path] = list;
      try { await this.plugin.saveSettings(); } catch (e) { console.warn(e); }
    }
  }

  private async removeHighlight(cfi: string) {
    const path = this.file?.path ?? '';
    if (!path) return;
    this.settings.highlights = this.settings.highlights ?? {};
    const list = this.settings.highlights[path] ?? [];
    const index = list.findIndex(h => h.cfi === cfi);
    if (index !== -1) {
      list.splice(index, 1);
      this.settings.highlights[path] = list;
      try { 
        await this.plugin.saveSettings(); 
        new Notice('Destaque removido');
      } catch (e) { 
        console.warn(e); 
        new Notice('Erro ao remover destaque');
      }
    }
  }

  private buildCfiDeepLink(cfi: string): string {
    const filePath = this.file?.path ?? '';
    const encodedFile = encodeURIComponent(filePath);
    const encodedCfi = encodeURIComponent(cfi);
    return `[Voltar ao trecho](obsidian://enhanced-reader?file=${encodedFile}&cfi=${encodedCfi})`;
  }

  private getToolbarState(filePath: string): ToolbarState {
    const defaults = this.settings.toolbarDefaults ?? DEFAULT_TOOLBAR_STATE;
    const perBook = filePath ? this.settings.toolbarState?.[filePath] : undefined;
    return {
      fontSize: perBook?.fontSize ?? defaults.fontSize ?? DEFAULT_TOOLBAR_STATE.fontSize,
      fontFamily: perBook?.fontFamily ?? defaults.fontFamily ?? DEFAULT_TOOLBAR_STATE.fontFamily,
      bionic: perBook?.bionic ?? defaults.bionic ?? DEFAULT_TOOLBAR_STATE.bionic,
      theme: perBook?.theme ?? defaults.theme ?? DEFAULT_TOOLBAR_STATE.theme,
    };
  }

  private async persistToolbarState(filePath: string, state: ToolbarState): Promise<void> {
    const snapshot: ToolbarState = {
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,
      bionic: state.bionic,
      theme: state.theme,
    };

    this.settings.toolbarDefaults = snapshot;
    if (filePath) {
      this.settings.toolbarState = this.settings.toolbarState ?? {};
      this.settings.toolbarState[filePath] = snapshot;
    }
    await this.plugin.saveSettings();
  }
}
