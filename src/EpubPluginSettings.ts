import { App, PluginSettingTab, Setting, TFolder, Vault } from "obsidian";
import EpubPlugin from "./EpubPlugin";
import type { FontFamilyChoice, ThemeMode } from "./adapters/epubjs/theme";

export type ToolbarState = {
	fontSize: number;
	fontFamily: FontFamilyChoice;
	bionic: boolean;
	theme?: ThemeMode;
};

export interface EpubPluginSettings {
	scrolledView: boolean;
	notePath: string;
	useSameFolder: boolean;
	tags: string;
	debugLogging?: boolean;
	// New: per-book overrides and synced state
	perBookTags?: Record<string, string>; // filePath -> tags string
	highlights?: Record<string, HighlightEntry[]>; // filePath -> list
	locations?: Record<string, string | number>; // filePath -> epub cfi or number
	toolbarState?: Record<string, ToolbarState>;
	toolbarDefaults?: ToolbarState;
}

export type HighlightEntry = {
	cfi: string;
	text: string;
	chapter?: string;
	createdAt: string; // ISO
	// New fields for enhanced functionality (all optional for backward compatibility)
	comment?: string;      // User's comment/note about this highlight
	tags?: string[];       // User-defined tags for organization
	updatedAt?: string;    // ISO timestamp of last edit
	color?: string;        // Highlight color (future feature)
};

export const DEFAULT_SETTINGS: EpubPluginSettings = {
	scrolledView: false,
	notePath: '/',
	useSameFolder: true,
	tags: 'notes/booknotes',
	debugLogging: false,
	perBookTags: {},
	highlights: {},
	locations: {},
	toolbarState: {},
	toolbarDefaults: {
		fontSize: 100,
		fontFamily: 'system',
		bionic: false,
		theme: undefined,
	},
}

export class EpubSettingTab extends PluginSettingTab {
	plugin: EpubPlugin;

	constructor(app: App, plugin: EpubPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'EPUB Settings' });

		new Setting(containerEl)
			.setName("Scrolled View")
			.setDesc("This enables seamless scrolling between pages.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.scrolledView)
				.onChange(async (value) => {
					this.plugin.settings.scrolledView = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Same Folder")
			.setDesc("When toggle on, the epub note file will be created in the same folder.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useSameFolder)
				.onChange(async (value) => {
					this.plugin.settings.useSameFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Note Folder")
			.setDesc("Choose the default epub note folder. When the Same Folder toggled on, this setting is ineffective.")
			.addDropdown(dropdown => dropdown
				.addOptions(getFolderOptions(this.app))
				.setValue(this.plugin.settings.notePath)
				.onChange(async (value) => {
					this.plugin.settings.notePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Tags")
			.setDesc("Tags added to new note metadata.")
			.addText(text => {
				text.inputEl.size = 50;
				text
					.setValue(this.plugin.settings.tags)
					.onChange(async (value) => {
						this.plugin.settings.tags = value;
						await this.plugin.saveSettings();
					})
			});

    new Setting(containerEl)
      .setName("Debug logging")
      .setDesc("Enable verbose debug logs to help diagnose issues.")
      .addToggle(toggle => toggle
        .setValue(!!this.plugin.settings.debugLogging)
        .onChange(async (value) => {
          this.plugin.settings.debugLogging = value;
          await this.plugin.saveSettings();
        }));
	}
}

function getFolderOptions(app: App) {
	const options: Record<string, string> = {};

	Vault.recurseChildren(app.vault.getRoot(), (f) => {
		if (f instanceof TFolder) {
			options[f.path] = f.path;
		}
	});

	return options;
}