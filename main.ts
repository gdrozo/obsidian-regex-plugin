// main.ts
import {
	App,
	Modal,
	Plugin,
	PluginSettingTab,
	Setting,
	Editor,
	Notice,
} from "obsidian";

interface RegexReplacePair {
	regex: string;
	replacement: string;
}

interface SearchReplaceSettings {
	recentExpressions: RegexReplacePair[];
	maxRecent: number;
}

const DEFAULT_SETTINGS: Partial<SearchReplaceSettings> = {
	recentExpressions: [],
	maxRecent: 5,
};

export default class SearchReplacePlugin extends Plugin {
	settings: SearchReplaceSettings;

	async onload() {
		await this.loadSettings();

		// Command to open the Search and Replace modal
		this.addCommand({
			id: "open-search-replace-modal",
			name: "Search and Replace",
			editorCallback: (editor: Editor) => {
				new SearchReplaceModal(this.app, editor, this).open();
			},
		});

		this.addCommand({
			id: "search-replace-command",
			name: "Search and Replace",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "H" }], // Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on Mac
			editorCallback: (editor: Editor) => {
				new SearchReplaceModal(this.app, editor, this).open();
			},
		});

		// Settings tab
		this.addSettingTab(new SearchReplaceSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	addToHistory(regex: string, replacement: string) {
		const newPair: RegexReplacePair = { regex, replacement };

		// Avoid duplicate entries
		const existingIndex = this.settings.recentExpressions.findIndex(
			(pair) => pair.regex === regex && pair.replacement === replacement
		);

		if (existingIndex === -1) {
			this.settings.recentExpressions.unshift(newPair);
			if (
				this.settings.recentExpressions.length > this.settings.maxRecent
			) {
				this.settings.recentExpressions.pop();
			}
			this.saveSettings();
		}
	}
}

// Updated modal to store regex and replacement pairs
class SearchReplaceModal extends Modal {
	plugin: SearchReplacePlugin;
	editor: Editor;

	constructor(app: App, editor: Editor, plugin: SearchReplacePlugin) {
		super(app);
		this.plugin = plugin;
		this.editor = editor;
	}

	onOpen() {
		const { contentEl, containerEl } = this;

		containerEl.addClass("search-replace-modal");

		contentEl.createEl("h2", {
			text: "Search and Replace",
			cls: "modal-title",
		});

		let searchPattern = "";
		let replaceWith = "";

		// Input for search pattern
		const regexContainer = contentEl.createEl("div", {
			cls: "search-replace-container",
		});
		regexContainer.createEl("label", { text: "Search Pattern:" });
		const regexInput = regexContainer.createEl("textarea", {
			cls: "regex-input",
			attr: {
				placeholder: "Enter regex pattern here...",
				style: "width: 100%; height: 2rem;",
			},
		});
		regexInput.addEventListener("input", (e) => {
			searchPattern = (e.target as HTMLTextAreaElement).value;
		});

		// Input for replacement text
		const replaceContainer = contentEl.createEl("div", {
			cls: "search-replace-container",
		});
		replaceContainer.createEl("label", { text: "Replace With:" });
		const replaceInput = replaceContainer.createEl("textarea", {
			cls: "replace-input",
			attr: {
				placeholder: "Enter replacement text here...",
				style: "width: 100%; height: 2rem;",
			},
		});
		replaceInput.addEventListener("input", (e) => {
			replaceWith = (e.target as HTMLTextAreaElement).value;
		});

		// Scrollable list for recent expressions
		const recentContainer = contentEl.createEl("div", {
			cls: "recent-container",
			attr: {
				style: "max-height: 150px; overflow-y: auto;",
			},
		});
		recentContainer.createEl("label", { text: "Recently Used:" });

		this.plugin.settings.recentExpressions.forEach((pair, index) => {
			if (!pair.regex || !pair.replacement) return;

			const listItem = recentContainer.createEl("div", {
				cls: "recent-item",
				attr: {
					style: `padding: 5px; cursor: pointer; display: flex; justify-content: space-between; 
							align-items: center; width: 100%;`,
				},
			});

			const textContainer = listItem.createEl("button", {
				text: `${pair.regex} -> ${pair.replacement}`,
				cls: "recent-item",
			});

			const deleteButton = listItem.createEl("button", {
				text: "X",
				cls: "delete-button",
			});

			// Delete functionality for each entry
			deleteButton.addEventListener("click", () => {
				this.plugin.settings.recentExpressions.splice(index, 1);
				this.plugin.saveSettings();
				listItem.remove(); // Remove the item from the DOM
			});

			listItem.addEventListener("click", () => {
				regexInput.value = pair.regex;
				replaceInput.value = pair.replacement;
				searchPattern = pair.regex;
				replaceWith = pair.replacement;
			});
		});

		// Execute button
		const executeButton = contentEl.createEl("button", {
			text: "Execute",
			cls: "execute-button",
		});
		executeButton.addEventListener("click", () => {
			if (!searchPattern) {
				new Notice("Please enter a valid search pattern.");
				return;
			}
			try {
				const regex = new RegExp(searchPattern, "g");
				const cursor = this.editor.getCursor();
				const content = this.editor.getValue();
				const replacedContent = content.replace(regex, replaceWith);

				this.plugin.addToHistory(searchPattern, replaceWith);
				this.editor.setValue(replacedContent);
				this.editor.setCursor(cursor);
				this.close();
			} catch (err) {
				new Notice(`Invalid regex: ${err.message}`);
			}
		});
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

class SearchReplaceSettingTab extends PluginSettingTab {
	plugin: SearchReplacePlugin;

	constructor(app: App, plugin: SearchReplacePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Search and Replace Settings" });

		// Setting for maximum number of recent expressions
		new Setting(containerEl)
			.setName("Max Recent Expressions")
			.setDesc("Number of recent search patterns to retain.")
			.addText((text) =>
				text
					.setPlaceholder("Enter a number")
					.setValue(this.plugin.settings.maxRecent.toString())
					.onChange(async (value) => {
						const num = parseInt(value);
						if (isNaN(num) || num < 1) {
							new Notice("Please enter a valid positive number.");
							return;
						}
						this.plugin.settings.maxRecent = num;
						await this.plugin.saveSettings();
					})
			);
	}
}
