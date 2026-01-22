================================================
FILE: webview-view-sample/README.md
================================================
# Calico Colors — Webview View API Sample

Demonstrates VS Code's [webview view API](https://github.com/microsoft/vscode/issues/46585). This includes:

- Contributing a webview based view to the explorer.
- Posting messages from an extension to a webview view
- Posting message from a webview to an extension  
- Persisting state in the view.
- Contributing commands to the view title.

## VS Code API

### `vscode` module

- [`window.registerWebviewViewProvider`](https://code.visualstudio.com/api/references/vscode-api#window.registerWebviewViewProvider)

## Running the example

- Open this example in VS Code 1.49+
- `npm install`
- `npm run watch` or `npm run compile`
- `F5` to start debugging

In the explorer, expand the `Calico Colors` view.


================================================
FILE: webview-view-sample/eslint.config.mjs
================================================
/**
 * ESLint configuration for the project.
 * 
 * See https://eslint.style and https://typescript-eslint.io for additional linting options.
 */
// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
	{
		ignores: [
			'out',
			'media',
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.stylistic,
	{
		plugins: {
			'@stylistic': stylistic
		},
		rules: {
			'curly': 'warn',
			'@stylistic/semi': ['warn', 'always'],
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					'selector': 'import',
					'format': ['camelCase', 'PascalCase']
				}
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					'argsIgnorePattern': '^_'
				}
			]
		}
	}
);


================================================
FILE: webview-view-sample/package.json
================================================
{
	"name": "calico-colors",
	"description": "Calico Colors - A Webview View API Sample",
	"version": "0.0.1",
	"publisher": "vscode-samples",
	"private": true,
	"license": "MIT",
	"repository": {
		"type": "git",
		"url": "https://github.com/Microsoft/vscode-extension-samples"
	},
	"engines": {
		"vscode": "^1.100.0"
	},
	"extensionKind": [
		"ui",
		"workspace"
	],
	"categories": [
		"Other"
	],
	"activationEvents": [],
	"main": "./out/extension.js",
	"contributes": {
		"views": {
			"explorer": [
				{
					"type": "webview",
					"id": "calicoColors.colorsView",
					"name": "Calico Colors"
				}
			]
		},
		"commands": [
			{
				"command": "calicoColors.addColor",
				"category": "Calico Colors",
				"title": "Add Color"
			},
			{
				"command": "calicoColors.clearColors",
				"category": "Calico Colors",
				"title": "Clear Colors",
				"icon": "$(clear-all)"
			}
		],
		"menus": {
			"view/title": [
				{
					"command": "calicoColors.clearColors",
					"group": "navigation",
					"when": "view == calicoColors.colorsView"
				}
			]
		}
	},
	"scripts": {
		"vscode:prepublish": "npm run compile",
		"compile": "tsc -p ./",
		"lint": "eslint",
		"watch": "tsc -w -p ./"
	},
	"devDependencies": {
		"@eslint/js": "^9.13.0",
		"@stylistic/eslint-plugin": "^2.9.0",
		"@types/vscode": "^1.100.0",
		"eslint": "^9.13.0",
		"typescript": "^5.9.2",
		"typescript-eslint": "^8.39.0"
	}
}


================================================
FILE: webview-view-sample/tsconfig.json
================================================
{
	"compilerOptions": {
		"module": "commonjs",
		"target": "ES2024",
		"lib": [
			"ES2024"
		],
		"outDir": "out",
		"sourceMap": true,
		"strict": true,
		"rootDir": "src"
	},
	"exclude": [
		"node_modules",
		".vscode-test"
	]
}


================================================
FILE: webview-view-sample/media/main.css
================================================
body {
	background-color: transparent;
}

.color-list {
	list-style: none;
	padding: 0;
}

.color-entry {
	width: 100%;
	display: flex;
	margin-bottom: 0.4em;
	border: 1px solid var(--vscode-input-border);
}

.color-preview {
	width: 2em;
	height: 2em;
}

.color-preview:hover {
	outline: inset white;
}

.color-input {
	display: block;
	flex: 1;
	width: 100%;
	color: var(--vscode-input-foreground);
	background-color: var(--vscode-input-background);
	border: none;
	padding: 0 0.6em;
}

.add-color-button {
	display: block;
	border: none;
	margin: 0 auto;
}



================================================
FILE: webview-view-sample/media/main.js
================================================
//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { colors: [] };

    /** @type {Array<{ value: string }>} */
    let colors = oldState.colors;

    updateColorList(colors);

    document.querySelector('.add-color-button').addEventListener('click', () => {
        addColor();
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'addColor':
                {
                    addColor();
                    break;
                }
            case 'clearColors':
                {
                    colors = [];
                    updateColorList(colors);
                    break;
                }

        }
    });

    /**
     * @param {Array<{ value: string }>} colors
     */
    function updateColorList(colors) {
        const ul = document.querySelector('.color-list');
        ul.textContent = '';
        for (const color of colors) {
            const li = document.createElement('li');
            li.className = 'color-entry';

            const colorPreview = document.createElement('div');
            colorPreview.className = 'color-preview';
            colorPreview.style.backgroundColor = `#${color.value}`;
            colorPreview.addEventListener('click', () => {
                onColorClicked(color.value);
            });
            li.appendChild(colorPreview);

            const input = document.createElement('input');
            input.className = 'color-input';
            input.type = 'text';
            input.value = color.value;
            input.addEventListener('change', (e) => {
                const value = e.target.value;
                if (!value) {
                    // Treat empty value as delete
                    colors.splice(colors.indexOf(color), 1);
                } else {
                    color.value = value;
                }
                updateColorList(colors);
            });
            li.appendChild(input);

            ul.appendChild(li);
        }

        // Update the saved state
        vscode.setState({ colors: colors });
    }

    /** 
     * @param {string} color 
     */
    function onColorClicked(color) {
        vscode.postMessage({ type: 'colorSelected', value: color });
    }

    /**
     * @returns string
     */
    function getNewCalicoColor() {
        const colors = ['020202', 'f1eeee', 'a85b20', 'daab70', 'efcb99'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function addColor() {
        colors.push({ value: getNewCalicoColor() });
        updateColorList(colors);
    }
}());





================================================
FILE: webview-view-sample/media/reset.css
================================================
html {
	box-sizing: border-box;
	font-size: 13px;
}

*,
*:before,
*:after {
	box-sizing: inherit;
}

body,
h1,
h2,
h3,
h4,
h5,
h6,
p,
ol,
ul {
	margin: 0;
	padding: 0;
	font-weight: normal;
}

img {
	max-width: 100%;
	height: auto;
}



================================================
FILE: webview-view-sample/media/vscode.css
================================================
:root {
	--container-paddding: 20px;
	--input-padding-vertical: 6px;
	--input-padding-horizontal: 4px;
	--input-margin-vertical: 4px;
	--input-margin-horizontal: 0;
}

body {
	padding: 0 var(--container-paddding);
	color: var(--vscode-foreground);
	font-size: var(--vscode-font-size);
	font-weight: var(--vscode-font-weight);
	font-family: var(--vscode-font-family);
	background-color: var(--vscode-editor-background);
}

ol,
ul {
	padding-left: var(--container-paddding);
}

body > *,
form > * {
	margin-block-start: var(--input-margin-vertical);
	margin-block-end: var(--input-margin-vertical);
}

*:focus {
	outline-color: var(--vscode-focusBorder) !important;
}

a {
	color: var(--vscode-textLink-foreground);
}

a:hover,
a:active {
	color: var(--vscode-textLink-activeForeground);
}

code {
	font-size: var(--vscode-editor-font-size);
	font-family: var(--vscode-editor-font-family);
}

button {
	border: none;
	padding: var(--input-padding-vertical) var(--input-padding-horizontal);
	width: 100%;
	text-align: center;
	outline: 1px solid transparent;
	outline-offset: 2px !important;
	color: var(--vscode-button-foreground);
	background: var(--vscode-button-background);
}

button:hover {
	cursor: pointer;
	background: var(--vscode-button-hoverBackground);
}

button:focus {
	outline-color: var(--vscode-focusBorder);
}

button.secondary {
	color: var(--vscode-button-secondaryForeground);
	background: var(--vscode-button-secondaryBackground);
}

button.secondary:hover {
	background: var(--vscode-button-secondaryHoverBackground);
}

input:not([type='checkbox']),
textarea {
	display: block;
	width: 100%;
	border: none;
	font-family: var(--vscode-font-family);
	padding: var(--input-padding-vertical) var(--input-padding-horizontal);
	color: var(--vscode-input-foreground);
	outline-color: var(--vscode-input-border);
	background-color: var(--vscode-input-background);
}

input::placeholder,
textarea::placeholder {
	color: var(--vscode-input-placeholderForeground);
}



================================================
FILE: webview-view-sample/src/extension.ts
================================================
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	const provider = new ColorsViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ColorsViewProvider.viewType, provider));

	context.subscriptions.push(
		vscode.commands.registerCommand('calicoColors.addColor', () => {
			provider.addColor();
		}));

	context.subscriptions.push(
		vscode.commands.registerCommand('calicoColors.clearColors', () => {
			provider.clearColors();
		}));
}

class ColorsViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'calicoColors.colorsView';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'colorSelected':
					{
						vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
						break;
					}
			}
		});
	}

	public addColor() {
		if (this._view) {
			this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
			this._view.webview.postMessage({ type: 'addColor' });
		}
	}

	public clearColors() {
		if (this._view) {
			this._view.webview.postMessage({ type: 'clearColors' });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Cat Colors</title>
			</head>
			<body>
				<ul class="color-list">
				</ul>

				<button class="add-color-button">Add Color</button>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}



================================================
FILE: webview-codicons-sample/README.md
================================================
# Cat Codicons 

Demonstrates loading [codicons](https://github.com/microsoft/vscode-codicons) in a [webview](https://code.visualstudio.com/api/extension-guides/webview).

## VS Code API

### `vscode` module

- [`window.createWebviewPanel`](https://code.visualstudio.com/api/references/vscode-api#window.createWebviewPanel)

## Running the example

- Open this example in VS Code 1.47+
- `npm install`
- `npm run watch` or `npm run compile`
- `F5` to start debugging

Run the `Cat Codicons: Show Cat Codicons` command to create the webview.



================================================
FILE: webview-codicons-sample/eslint.config.mjs
================================================
/**
 * ESLint configuration for the project.
 * 
 * See https://eslint.style and https://typescript-eslint.io for additional linting options.
 */
// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
	{
		ignores: [
			'.vscode-test',
			'out',
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.stylistic,
	{
		plugins: {
			'@stylistic': stylistic
		},
		rules: {
			'curly': 'warn',
			'@stylistic/semi': ['warn', 'always'],
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					'selector': 'import',
					'format': ['camelCase', 'PascalCase']
				}
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					'argsIgnorePattern': '^_'
				}
			]
		}
	}
);


================================================
FILE: webview-codicons-sample/package.json
================================================
{
	"name": "cat-codicons",
	"description": "Cat Codicons - Using codicons in webviews",
	"version": "0.0.1",
	"publisher": "vscode-samples",
	"private": true,
	"license": "MIT",
	"engines": {
		"vscode": "^1.100.0"
	},
	"categories": [
		"Other"
	],
	"activationEvents": [],
	"repository": {
		"type": "git",
		"url": "https://github.com/microsoft/vscode-extension-samples.git"
	},
	"main": "./out/extension.js",
	"contributes": {
		"commands": [
			{
				"command": "catCodicons.show",
				"title": "Show Cat Codicons",
				"category": "Cat Codicons"
			}
		]
	},
	"scripts": {
		"vscode:prepublish": "npm run compile",
		"compile": "tsc -p ./",
		"lint": "eslint",
		"watch": "tsc -w -p ./"
	},
	"devDependencies": {
		"@eslint/js": "^9.13.0",
		"@stylistic/eslint-plugin": "^2.9.0",
		"@types/node": "^22",
		"@types/vscode": "^1.100.0",
		"eslint": "^9.13.0",
		"typescript": "^5.9.2",
		"typescript-eslint": "^8.39.0"
	},
	"dependencies": {
		"@vscode/codicons": "0.0.20"
	}
}


================================================
FILE: webview-codicons-sample/tsconfig.json
================================================
{
	"compilerOptions": {
		"module": "commonjs",
		"target": "ES2024",
		"lib": [
			"ES2024"
		],
		"outDir": "out",
		"sourceMap": true,
		"strict": true,
		"rootDir": "src"
	},
	"exclude": [
		"node_modules",
		".vscode-test"
	]
}


================================================
FILE: webview-codicons-sample/media/styles.css
================================================
html {
	box-sizing: border-box;
	font-size: 16px;
}

*, *:before, *:after {
	box-sizing: inherit;
}

body, h1, h2, h3, h4, h5, h6, p, ol, ul {
	margin: 0;
	padding: 0;
	font-weight: normal;
}

ol, ul {
	list-style: none;
}

img {
	max-width: 100%;
	height: auto;
}

/* Demo Styles */

body {
	font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji;
	margin: 0;
	padding: 10px 20px;
	text-align: center;
	color: var(--vscode-foreground);
	background-color: var(--vscode-editor-background);
}

h1 {
	font-weight: bold;
	margin: 24px;
}

#icons {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
    justify-content: center;
}

#icons .icon {
	width: 140px;
	padding: 20px;
	font-size: 14px;
	display: flex;
	flex-direction: column;
	text-align: center;
}

#icons .icon .codicon {
	font-size: 32px;
	padding-bottom: 16px;
}


================================================
FILE: webview-codicons-sample/src/extension.ts
================================================
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('catCodicons.show', () => {
			CatCodiconsPanel.show(context.extensionUri);
		})
	);
}


class CatCodiconsPanel {

	public static readonly viewType = 'catCodicons';

	public static show(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		const panel = vscode.window.createWebviewPanel(
			CatCodiconsPanel.viewType,
			"Cat Codicons",
			column || vscode.ViewColumn.One
		);

		panel.webview.html = this._getHtmlForWebview(panel.webview, extensionUri);
	}

	private static _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {

		// Get resource paths
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'styles.css'));
		const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading specific resources in the webview
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource};">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Cat Coding</title>

				<link href="${styleUri}" rel="stylesheet" />
				<link href="${codiconsUri}" rel="stylesheet" />
			</head>
			<body>
				<h1>codicons</h1>
				<div id="icons">
					<div class="icon"><i class="codicon codicon-account"></i> account</div>
					<div class="icon"><i class="codicon codicon-activate-breakpoints"></i> activate-breakpoints</div>
					<div class="icon"><i class="codicon codicon-add"></i> add</div>
					<div class="icon"><i class="codicon codicon-archive"></i> archive</div>
					<div class="icon"><i class="codicon codicon-arrow-both"></i> arrow-both</div>
					<div class="icon"><i class="codicon codicon-arrow-down"></i> arrow-down</div>
					<div class="icon"><i class="codicon codicon-arrow-left"></i> arrow-left</div>
					<div class="icon"><i class="codicon codicon-arrow-right"></i> arrow-right</div>
					<div class="icon"><i class="codicon codicon-arrow-small-down"></i> arrow-small-down</div>
					<div class="icon"><i class="codicon codicon-arrow-small-left"></i> arrow-small-left</div>
					<div class="icon"><i class="codicon codicon-arrow-small-right"></i> arrow-small-right</div>
					<div class="icon"><i class="codicon codicon-arrow-small-up"></i> arrow-small-up</div>
					<div class="icon"><i class="codicon codicon-arrow-up"></i> arrow-up</div>
					<div class="icon"><i class="codicon codicon-beaker"></i> beaker</div>
					<div class="icon"><i class="codicon codicon-bell-dot"></i> bell-dot</div>
					<div class="icon"><i class="codicon codicon-bell"></i> bell</div>
					<div class="icon"><i class="codicon codicon-bold"></i> bold</div>
					<div class="icon"><i class="codicon codicon-book"></i> book</div>
					<div class="icon"><i class="codicon codicon-bookmark"></i> bookmark</div>
					<div class="icon"><i class="codicon codicon-briefcase"></i> briefcase</div>
					<div class="icon"><i class="codicon codicon-broadcast"></i> broadcast</div>
					<div class="icon"><i class="codicon codicon-browser"></i> browser</div>
					<div class="icon"><i class="codicon codicon-bug"></i> bug</div>
					<div class="icon"><i class="codicon codicon-calendar"></i> calendar</div>
					<div class="icon"><i class="codicon codicon-call-incoming"></i> call-incoming</div>
					<div class="icon"><i class="codicon codicon-call-outgoing"></i> call-outgoing</div>
					<div class="icon"><i class="codicon codicon-case-sensitive"></i> case-sensitive</div>
					<div class="icon"><i class="codicon codicon-check"></i> check</div>
					<div class="icon"><i class="codicon codicon-checklist"></i> checklist</div>
					<div class="icon"><i class="codicon codicon-chevron-down"></i> chevron-down</div>
					<div class="icon"><i class="codicon codicon-chevron-left"></i> chevron-left</div>
					<div class="icon"><i class="codicon codicon-chevron-right"></i> chevron-right</div>
					<div class="icon"><i class="codicon codicon-chevron-up"></i> chevron-up</div>
					<div class="icon"><i class="codicon codicon-chrome-close"></i> chrome-close</div>
					<div class="icon"><i class="codicon codicon-chrome-maximize"></i> chrome-maximize</div>
					<div class="icon"><i class="codicon codicon-chrome-minimize"></i> chrome-minimize</div>
					<div class="icon"><i class="codicon codicon-chrome-restore"></i> chrome-restore</div>
					<div class="icon"><i class="codicon codicon-circle-filled"></i> circle-filled</div>
					<div class="icon"><i class="codicon codicon-circle-outline"></i> circle-outline</div>
					<div class="icon"><i class="codicon codicon-circle-slash"></i> circle-slash</div>
					<div class="icon"><i class="codicon codicon-circuit-board"></i> circuit-board</div>
					<div class="icon"><i class="codicon codicon-clear-all"></i> clear-all</div>
					<div class="icon"><i class="codicon codicon-clippy"></i> clippy</div>
					<div class="icon"><i class="codicon codicon-close-all"></i> close-all</div>
					<div class="icon"><i class="codicon codicon-close"></i> close</div>
					<div class="icon"><i class="codicon codicon-cloud-download"></i> cloud-download</div>
					<div class="icon"><i class="codicon codicon-cloud-upload"></i> cloud-upload</div>
					<div class="icon"><i class="codicon codicon-cloud"></i> cloud</div>
					<div class="icon"><i class="codicon codicon-code"></i> code</div>
					<div class="icon"><i class="codicon codicon-collapse-all"></i> collapse-all</div>
					<div class="icon"><i class="codicon codicon-color-mode"></i> color-mode</div>
					<div class="icon"><i class="codicon codicon-comment-discussion"></i> comment-discussion</div>
					<div class="icon"><i class="codicon codicon-comment"></i> comment</div>
					<div class="icon"><i class="codicon codicon-credit-card"></i> credit-card</div>
					<div class="icon"><i class="codicon codicon-dash"></i> dash</div>
					<div class="icon"><i class="codicon codicon-dashboard"></i> dashboard</div>
					<div class="icon"><i class="codicon codicon-database"></i> database</div>
					<div class="icon"><i class="codicon codicon-debug-alt-small"></i> debug-alt-small</div>
					<div class="icon"><i class="codicon codicon-debug-alt"></i> debug-alt</div>
					<div class="icon"><i class="codicon codicon-debug-breakpoint-conditional-unverified"></i> debug-breakpoint-conditional-unverified</div>
					<div class="icon"><i class="codicon codicon-debug-breakpoint-conditional"></i> debug-breakpoint-conditional</div>
					<div class="icon"><i class="codicon codicon-debug-breakpoint-data-unverified"></i> debug-breakpoint-data-unverified</div>
					<div class="icon"><i class="codicon codicon-debug-breakpoint-data"></i> debug-breakpoint-data</div>
					<div class="icon"><i class="codicon codicon-debug-breakpoint-function-unverified"></i> debug-breakpoint-function-unverified</div>
					<div class="icon"><i class="codicon codicon-debug-breakpoint-function"></i> debug-breakpoint-function</div>
					<div class="icon"><i class="codicon codicon-debug-breakpoint-log-unverified"></i> debug-breakpoint-log-unverified</div>
					<div class="icon"><i class="codicon codicon-debug-breakpoint-log"></i> debug-breakpoint-log</div>
					<div class="icon"><i class="codicon codicon-debug-breakpoint-unsupported"></i> debug-breakpoint-unsupported</div>
					<div class="icon"><i class="codicon codicon-debug-console"></i> debug-console</div>
					<div class="icon"><i class="codicon codicon-debug-continue"></i> debug-continue</div>
					<div class="icon"><i class="codicon codicon-debug-disconnect"></i> debug-disconnect</div>
					<div class="icon"><i class="codicon codicon-debug-pause"></i> debug-pause</div>
					<div class="icon"><i class="codicon codicon-debug-restart-frame"></i> debug-restart-frame</div>
					<div class="icon"><i class="codicon codicon-debug-restart"></i> debug-restart</div>
					<div class="icon"><i class="codicon codicon-debug-reverse-continue"></i> debug-reverse-continue</div>
					<div class="icon"><i class="codicon codicon-debug-stackframe-active"></i> debug-stackframe-active</div>
					<div class="icon"><i class="codicon codicon-debug-stackframe-dot"></i> debug-stackframe-dot</div>
					<div class="icon"><i class="codicon codicon-debug-stackframe"></i> debug-stackframe</div>
					<div class="icon"><i class="codicon codicon-debug-start"></i> debug-start</div>
					<div class="icon"><i class="codicon codicon-debug-step-back"></i> debug-step-back</div>
					<div class="icon"><i class="codicon codicon-debug-step-into"></i> debug-step-into</div>
					<div class="icon"><i class="codicon codicon-debug-step-out"></i> debug-step-out</div>
					<div class="icon"><i class="codicon codicon-debug-step-over"></i> debug-step-over</div>
					<div class="icon"><i class="codicon codicon-debug-stop"></i> debug-stop</div>
					<div class="icon"><i class="codicon codicon-debug"></i> debug</div>
					<div class="icon"><i class="codicon codicon-desktop-download"></i> desktop-download</div>
					<div class="icon"><i class="codicon codicon-device-camera-video"></i> device-camera-video</div>
					<div class="icon"><i class="codicon codicon-device-camera"></i> device-camera</div>
					<div class="icon"><i class="codicon codicon-device-mobile"></i> device-mobile</div>
					<div class="icon"><i class="codicon codicon-diff-added"></i> diff-added</div>
					<div class="icon"><i class="codicon codicon-diff-ignored"></i> diff-ignored</div>
					<div class="icon"><i class="codicon codicon-diff-modified"></i> diff-modified</div>
					<div class="icon"><i class="codicon codicon-diff-removed"></i> diff-removed</div>
					<div class="icon"><i class="codicon codicon-diff-renamed"></i> diff-renamed</div>
					<div class="icon"><i class="codicon codicon-diff"></i> diff</div>
					<div class="icon"><i class="codicon codicon-discard"></i> discard</div>
					<div class="icon"><i class="codicon codicon-edit"></i> edit</div>
					<div class="icon"><i class="codicon codicon-editor-layout"></i> editor-layout</div>
					<div class="icon"><i class="codicon codicon-ellipsis"></i> ellipsis</div>
					<div class="icon"><i class="codicon codicon-empty-window"></i> empty-window</div>
					<div class="icon"><i class="codicon codicon-error"></i> error</div>
					<div class="icon"><i class="codicon codicon-exclude"></i> exclude</div>
					<div class="icon"><i class="codicon codicon-expand-all"></i> expand-all</div>
					<div class="icon"><i class="codicon codicon-extensions"></i> extensions</div>
					<div class="icon"><i class="codicon codicon-eye-closed"></i> eye-closed</div>
					<div class="icon"><i class="codicon codicon-eye"></i> eye</div>
					<div class="icon"><i class="codicon codicon-feedback"></i> feedback</div>
					<div class="icon"><i class="codicon codicon-file-binary"></i> file-binary</div>
					<div class="icon"><i class="codicon codicon-file-code"></i> file-code</div>
					<div class="icon"><i class="codicon codicon-file-media"></i> file-media</div>
					<div class="icon"><i class="codicon codicon-file-pdf"></i> file-pdf</div>
					<div class="icon"><i class="codicon codicon-file-submodule"></i> file-submodule</div>
					<div class="icon"><i class="codicon codicon-file-symlink-directory"></i> file-symlink-directory</div>
					<div class="icon"><i class="codicon codicon-file-symlink-file"></i> file-symlink-file</div>
					<div class="icon"><i class="codicon codicon-file-zip"></i> file-zip</div>
					<div class="icon"><i class="codicon codicon-file"></i> file</div>
					<div class="icon"><i class="codicon codicon-files"></i> files</div>
					<div class="icon"><i class="codicon codicon-filter"></i> filter</div>
					<div class="icon"><i class="codicon codicon-flame"></i> flame</div>
					<div class="icon"><i class="codicon codicon-fold-down"></i> fold-down</div>
					<div class="icon"><i class="codicon codicon-fold-up"></i> fold-up</div>
					<div class="icon"><i class="codicon codicon-fold"></i> fold</div>
					<div class="icon"><i class="codicon codicon-folder-active"></i> folder-active</div>
					<div class="icon"><i class="codicon codicon-folder-opened"></i> folder-opened</div>
					<div class="icon"><i class="codicon codicon-folder"></i> folder</div>
					<div class="icon"><i class="codicon codicon-gear"></i> gear</div>
					<div class="icon"><i class="codicon codicon-gift"></i> gift</div>
					<div class="icon"><i class="codicon codicon-gist-secret"></i> gist-secret</div>
					<div class="icon"><i class="codicon codicon-gist"></i> gist</div>
					<div class="icon"><i class="codicon codicon-git-commit"></i> git-commit</div>
					<div class="icon"><i class="codicon codicon-git-compare"></i> git-compare</div>
					<div class="icon"><i class="codicon codicon-git-merge"></i> git-merge</div>
					<div class="icon"><i class="codicon codicon-git-pull-request"></i> git-pull-request</div>
					<div class="icon"><i class="codicon codicon-github-action"></i> github-action</div>
					<div class="icon"><i class="codicon codicon-github-alt"></i> github-alt</div>
					<div class="icon"><i class="codicon codicon-github-inverted"></i> github-inverted</div>
					<div class="icon"><i class="codicon codicon-github"></i> github</div>
					<div class="icon"><i class="codicon codicon-globe"></i> globe</div>
					<div class="icon"><i class="codicon codicon-go-to-file"></i> go-to-file</div>
					<div class="icon"><i class="codicon codicon-grabber"></i> grabber</div>
					<div class="icon"><i class="codicon codicon-graph"></i> graph</div>
					<div class="icon"><i class="codicon codicon-gripper"></i> gripper</div>
					<div class="icon"><i class="codicon codicon-group-by-ref-type"></i> group-by-ref-type</div>
					<div class="icon"><i class="codicon codicon-heart"></i> heart</div>
					<div class="icon"><i class="codicon codicon-history"></i> history</div>
					<div class="icon"><i class="codicon codicon-home"></i> home</div>
					<div class="icon"><i class="codicon codicon-horizontal-rule"></i> horizontal-rule</div>
					<div class="icon"><i class="codicon codicon-hubot"></i> hubot</div>
					<div class="icon"><i class="codicon codicon-inbox"></i> inbox</div>
					<div class="icon"><i class="codicon codicon-info"></i> info</div>
					<div class="icon"><i class="codicon codicon-issue-closed"></i> issue-closed</div>
					<div class="icon"><i class="codicon codicon-issue-reopened"></i> issue-reopened</div>
					<div class="icon"><i class="codicon codicon-issues"></i> issues</div>
					<div class="icon"><i class="codicon codicon-italic"></i> italic</div>
					<div class="icon"><i class="codicon codicon-jersey"></i> jersey</div>
					<div class="icon"><i class="codicon codicon-json"></i> json</div>
					<div class="icon"><i class="codicon codicon-kebab-vertical"></i> kebab-vertical</div>
					<div class="icon"><i class="codicon codicon-key"></i> key</div>
					<div class="icon"><i class="codicon codicon-law"></i> law</div>
					<div class="icon"><i class="codicon codicon-library"></i> library</div>
					<div class="icon"><i class="codicon codicon-lightbulb-autofix"></i> lightbulb-autofix</div>
					<div class="icon"><i class="codicon codicon-lightbulb"></i> lightbulb</div>
					<div class="icon"><i class="codicon codicon-link-external"></i> link-external</div>
					<div class="icon"><i class="codicon codicon-link"></i> link</div>
					<div class="icon"><i class="codicon codicon-list-filter"></i> list-filter</div>
					<div class="icon"><i class="codicon codicon-list-flat"></i> list-flat</div>
					<div class="icon"><i class="codicon codicon-list-ordered"></i> list-ordered</div>
					<div class="icon"><i class="codicon codicon-list-selection"></i> list-selection</div>
					<div class="icon"><i class="codicon codicon-list-tree"></i> list-tree</div>
					<div class="icon"><i class="codicon codicon-list-unordered"></i> list-unordered</div>
					<div class="icon"><i class="codicon codicon-live-share"></i> live-share</div>
					<div class="icon"><i class="codicon codicon-loading"></i> loading</div>
					<div class="icon"><i class="codicon codicon-location"></i> location</div>
					<div class="icon"><i class="codicon codicon-lock"></i> lock</div>
					<div class="icon"><i class="codicon codicon-mail-read"></i> mail-read</div>
					<div class="icon"><i class="codicon codicon-mail"></i> mail</div>
					<div class="icon"><i class="codicon codicon-markdown"></i> markdown</div>
					<div class="icon"><i class="codicon codicon-megaphone"></i> megaphone</div>
					<div class="icon"><i class="codicon codicon-mention"></i> mention</div>
					<div class="icon"><i class="codicon codicon-menu"></i> menu</div>
					<div class="icon"><i class="codicon codicon-merge"></i> merge</div>
					<div class="icon"><i class="codicon codicon-milestone"></i> milestone</div>
					<div class="icon"><i class="codicon codicon-mirror"></i> mirror</div>
					<div class="icon"><i class="codicon codicon-mortar-board"></i> mortar-board</div>
					<div class="icon"><i class="codicon codicon-move"></i> move</div>
					<div class="icon"><i class="codicon codicon-multiple-windows"></i> multiple-windows</div>
					<div class="icon"><i class="codicon codicon-mute"></i> mute</div>
					<div class="icon"><i class="codicon codicon-new-file"></i> new-file</div>
					<div class="icon"><i class="codicon codicon-new-folder"></i> new-folder</div>
					<div class="icon"><i class="codicon codicon-no-newline"></i> no-newline</div>
					<div class="icon"><i class="codicon codicon-note"></i> note</div>
					<div class="icon"><i class="codicon codicon-octoface"></i> octoface</div>
					<div class="icon"><i class="codicon codicon-open-preview"></i> open-preview</div>
					<div class="icon"><i class="codicon codicon-organization"></i> organization</div>
					<div class="icon"><i class="codicon codicon-output"></i> output</div>
					<div class="icon"><i class="codicon codicon-package"></i> package</div>
					<div class="icon"><i class="codicon codicon-paintcan"></i> paintcan</div>
					<div class="icon"><i class="codicon codicon-pass"></i> pass</div>
					<div class="icon"><i class="codicon codicon-person"></i> person</div>
					<div class="icon"><i class="codicon codicon-pin"></i> pin</div>
					<div class="icon"><i class="codicon codicon-pinned"></i> pinned</div>
					<div class="icon"><i class="codicon codicon-play-circle"></i> play-circle</div>
					<div class="icon"><i class="codicon codicon-play"></i> play</div>
					<div class="icon"><i class="codicon codicon-plug"></i> plug</div>
					<div class="icon"><i class="codicon codicon-preserve-case"></i> preserve-case</div>
					<div class="icon"><i class="codicon codicon-preview"></i> preview</div>
					<div class="icon"><i class="codicon codicon-primitive-square"></i> primitive-square</div>
					<div class="icon"><i class="codicon codicon-project"></i> project</div>
					<div class="icon"><i class="codicon codicon-pulse"></i> pulse</div>
					<div class="icon"><i class="codicon codicon-question"></i> question</div>
					<div class="icon"><i class="codicon codicon-quote"></i> quote</div>
					<div class="icon"><i class="codicon codicon-radio-tower"></i> radio-tower</div>
					<div class="icon"><i class="codicon codicon-reactions"></i> reactions</div>
					<div class="icon"><i class="codicon codicon-record-keys"></i> record-keys</div>
					<div class="icon"><i class="codicon codicon-record"></i> record</div>
					<div class="icon"><i class="codicon codicon-references"></i> references</div>
					<div class="icon"><i class="codicon codicon-refresh"></i> refresh</div>
					<div class="icon"><i class="codicon codicon-regex"></i> regex</div>
					<div class="icon"><i class="codicon codicon-remote-explorer"></i> remote-explorer</div>
					<div class="icon"><i class="codicon codicon-remote"></i> remote</div>
					<div class="icon"><i class="codicon codicon-remove"></i> remove</div>
					<div class="icon"><i class="codicon codicon-replace-all"></i> replace-all</div>
					<div class="icon"><i class="codicon codicon-replace"></i> replace</div>
					<div class="icon"><i class="codicon codicon-reply"></i> reply</div>
					<div class="icon"><i class="codicon codicon-repo-clone"></i> repo-clone</div>
					<div class="icon"><i class="codicon codicon-repo-force-push"></i> repo-force-push</div>
					<div class="icon"><i class="codicon codicon-repo-forked"></i> repo-forked</div>
					<div class="icon"><i class="codicon codicon-repo-pull"></i> repo-pull</div>
					<div class="icon"><i class="codicon codicon-repo-push"></i> repo-push</div>
					<div class="icon"><i class="codicon codicon-repo"></i> repo</div>
					<div class="icon"><i class="codicon codicon-report"></i> report</div>
					<div class="icon"><i class="codicon codicon-request-changes"></i> request-changes</div>
					<div class="icon"><i class="codicon codicon-rocket"></i> rocket</div>
					<div class="icon"><i class="codicon codicon-root-folder-opened"></i> root-folder-opened</div>
					<div class="icon"><i class="codicon codicon-root-folder"></i> root-folder</div>
					<div class="icon"><i class="codicon codicon-rss"></i> rss</div>
					<div class="icon"><i class="codicon codicon-ruby"></i> ruby</div>
					<div class="icon"><i class="codicon codicon-run-all"></i> run-all</div>
					<div class="icon"><i class="codicon codicon-save-all"></i> save-all</div>
					<div class="icon"><i class="codicon codicon-save-as"></i> save-as</div>
					<div class="icon"><i class="codicon codicon-save"></i> save</div>
					<div class="icon"><i class="codicon codicon-screen-full"></i> screen-full</div>
					<div class="icon"><i class="codicon codicon-screen-normal"></i> screen-normal</div>
					<div class="icon"><i class="codicon codicon-search-stop"></i> search-stop</div>
					<div class="icon"><i class="codicon codicon-search"></i> search</div>
					<div class="icon"><i class="codicon codicon-server-environment"></i> server-environment</div>
					<div class="icon"><i class="codicon codicon-server-process"></i> server-process</div>
					<div class="icon"><i class="codicon codicon-server"></i> server</div>
					<div class="icon"><i class="codicon codicon-settings-gear"></i> settings-gear</div>
					<div class="icon"><i class="codicon codicon-settings"></i> settings</div>
					<div class="icon"><i class="codicon codicon-shield"></i> shield</div>
					<div class="icon"><i class="codicon codicon-sign-in"></i> sign-in</div>
					<div class="icon"><i class="codicon codicon-sign-out"></i> sign-out</div>
					<div class="icon"><i class="codicon codicon-smiley"></i> smiley</div>
					<div class="icon"><i class="codicon codicon-sort-precedence"></i> sort-precedence</div>
					<div class="icon"><i class="codicon codicon-source-control"></i> source-control</div>
					<div class="icon"><i class="codicon codicon-split-horizontal"></i> split-horizontal</div>
					<div class="icon"><i class="codicon codicon-split-vertical"></i> split-vertical</div>
					<div class="icon"><i class="codicon codicon-squirrel"></i> squirrel</div>
					<div class="icon"><i class="codicon codicon-star-empty"></i> star-empty</div>
					<div class="icon"><i class="codicon codicon-star-full"></i> star-full</div>
					<div class="icon"><i class="codicon codicon-star-half"></i> star-half</div>
					<div class="icon"><i class="codicon codicon-stop-circle"></i> stop-circle</div>
					<div class="icon"><i class="codicon codicon-symbol-array"></i> symbol-array</div>
					<div class="icon"><i class="codicon codicon-symbol-boolean"></i> symbol-boolean</div>
					<div class="icon"><i class="codicon codicon-symbol-class"></i> symbol-class</div>
					<div class="icon"><i class="codicon codicon-symbol-color"></i> symbol-color</div>
					<div class="icon"><i class="codicon codicon-symbol-constant"></i> symbol-constant</div>
					<div class="icon"><i class="codicon codicon-symbol-enum-member"></i> symbol-enum-member</div>
					<div class="icon"><i class="codicon codicon-symbol-enum"></i> symbol-enum</div>
					<div class="icon"><i class="codicon codicon-symbol-event"></i> symbol-event</div>
					<div class="icon"><i class="codicon codicon-symbol-field"></i> symbol-field</div>
					<div class="icon"><i class="codicon codicon-symbol-file"></i> symbol-file</div>
					<div class="icon"><i class="codicon codicon-symbol-interface"></i> symbol-interface</div>
					<div class="icon"><i class="codicon codicon-symbol-key"></i> symbol-key</div>
					<div class="icon"><i class="codicon codicon-symbol-keyword"></i> symbol-keyword</div>
					<div class="icon"><i class="codicon codicon-symbol-method"></i> symbol-method</div>
					<div class="icon"><i class="codicon codicon-symbol-misc"></i> symbol-misc</div>
					<div class="icon"><i class="codicon codicon-symbol-namespace"></i> symbol-namespace</div>
					<div class="icon"><i class="codicon codicon-symbol-numeric"></i> symbol-numeric</div>
					<div class="icon"><i class="codicon codicon-symbol-operator"></i> symbol-operator</div>
					<div class="icon"><i class="codicon codicon-symbol-parameter"></i> symbol-parameter</div>
					<div class="icon"><i class="codicon codicon-symbol-property"></i> symbol-property</div>
					<div class="icon"><i class="codicon codicon-symbol-ruler"></i> symbol-ruler</div>
					<div class="icon"><i class="codicon codicon-symbol-snippet"></i> symbol-snippet</div>
					<div class="icon"><i class="codicon codicon-symbol-string"></i> symbol-string</div>
					<div class="icon"><i class="codicon codicon-symbol-structure"></i> symbol-structure</div>
					<div class="icon"><i class="codicon codicon-symbol-variable"></i> symbol-variable</div>
					<div class="icon"><i class="codicon codicon-sync-ignored"></i> sync-ignored</div>
					<div class="icon"><i class="codicon codicon-sync"></i> sync</div>
					<div class="icon"><i class="codicon codicon-tag"></i> tag</div>
					<div class="icon"><i class="codicon codicon-tasklist"></i> tasklist</div>
					<div class="icon"><i class="codicon codicon-telescope"></i> telescope</div>
					<div class="icon"><i class="codicon codicon-terminal"></i> terminal</div>
					<div class="icon"><i class="codicon codicon-text-size"></i> text-size</div>
					<div class="icon"><i class="codicon codicon-three-bars"></i> three-bars</div>
					<div class="icon"><i class="codicon codicon-thumbsdown"></i> thumbsdown</div>
					<div class="icon"><i class="codicon codicon-thumbsup"></i> thumbsup</div>
					<div class="icon"><i class="codicon codicon-tools"></i> tools</div>
					<div class="icon"><i class="codicon codicon-trash"></i> trash</div>
					<div class="icon"><i class="codicon codicon-triangle-down"></i> triangle-down</div>
					<div class="icon"><i class="codicon codicon-triangle-left"></i> triangle-left</div>
					<div class="icon"><i class="codicon codicon-triangle-right"></i> triangle-right</div>
					<div class="icon"><i class="codicon codicon-triangle-up"></i> triangle-up</div>
					<div class="icon"><i class="codicon codicon-twitter"></i> twitter</div>
					<div class="icon"><i class="codicon codicon-unfold"></i> unfold</div>
					<div class="icon"><i class="codicon codicon-ungroup-by-ref-type"></i> ungroup-by-ref-type</div>
					<div class="icon"><i class="codicon codicon-unlock"></i> unlock</div>
					<div class="icon"><i class="codicon codicon-unmute"></i> unmute</div>
					<div class="icon"><i class="codicon codicon-unverified"></i> unverified</div>
					<div class="icon"><i class="codicon codicon-verified"></i> verified</div>
					<div class="icon"><i class="codicon codicon-versions"></i> versions</div>
					<div class="icon"><i class="codicon codicon-vm-active"></i> vm-active</div>
					<div class="icon"><i class="codicon codicon-vm-connect"></i> vm-connect</div>
					<div class="icon"><i class="codicon codicon-vm-outline"></i> vm-outline</div>
					<div class="icon"><i class="codicon codicon-vm-running"></i> vm-running</div>
					<div class="icon"><i class="codicon codicon-vm"></i> vm</div>
					<div class="icon"><i class="codicon codicon-warning"></i> warning</div>
					<div class="icon"><i class="codicon codicon-watch"></i> watch</div>
					<div class="icon"><i class="codicon codicon-whitespace"></i> whitespace</div>
					<div class="icon"><i class="codicon codicon-whole-word"></i> whole-word</div>
					<div class="icon"><i class="codicon codicon-window"></i> window</div>
					<div class="icon"><i class="codicon codicon-word-wrap"></i> word-wrap</div>
					<div class="icon"><i class="codicon codicon-zoom-in"></i> zoom-in</div>
					<div class="icon"><i class="codicon codicon-zoom-out"></i> zoom-out</div>
				</div>
			</body>
			</html>`;
	}
}




================================================
FILE: webview-sample/README.md
================================================
# Cat Coding — A Webview API Sample

Demonstrates VS Code's [webview API](https://code.visualstudio.com/api/extension-guides/webview). This includes:

- Creating and showing a basic webview.
- Dynamically updating a webview's content.
- Loading local content in a webview.
- Running scripts in a webview.
- Sending message from an extension to a webview.
- Sending messages from a webview to an extension.
- Using a basic content security policy.
- Webview lifecycle and handling dispose.
- Saving and restoring state when the panel goes into the background.
- Serialization and persistence across VS Code reboots.

## Demo

![demo](demo.gif)

## VS Code API

### `vscode` module

- [`window.createWebviewPanel`](https://code.visualstudio.com/api/references/vscode-api#window.createWebviewPanel)
- [`window.registerWebviewPanelSerializer`](https://code.visualstudio.com/api/references/vscode-api#window.registerWebviewPanelSerializer)

## Running the example

- Open this example in VS Code 1.47+
- `npm install`
- `npm run watch` or `npm run compile`
- `F5` to start debugging

Run the `Cat Coding: Start cat coding session` to create the webview.

## Commands

This extension provides the following commands:

- `Cat Coding: Start cat coding session`: Creates and displays the Cat Coding webview.
- `Cat Coding: Do refactor`: Halves the count of lines of code displayed in the Cat Coding webview.

## Messages

The Cat Coding webview can send the following messages to the extension:

- `alert`: Sent when the cat introduces a bug. The message includes the text '🐛  on line ' followed by the current line count.


================================================
FILE: webview-sample/eslint.config.mjs
================================================
/**
 * ESLint configuration for the project.
 * 
 * See https://eslint.style and https://typescript-eslint.io for additional linting options.
 */
// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
	{
		ignores: [
			'out',
			'media',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.stylistic,
	{
		plugins: {
			'@stylistic': stylistic,
		},
		rules: {
			'curly': 'warn',
			'@stylistic/semi': ['warn', 'always'],
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					'selector': 'import',
					'format': ['camelCase', 'PascalCase']
				}
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					'argsIgnorePattern': '^_'
				}
			]
		}
	}
);



================================================
FILE: webview-sample/package.json
================================================
{
	"name": "cat-coding",
	"description": "Cat Coding - A Webview API Sample",
	"version": "0.0.1",
	"publisher": "vscode-samples",
	"private": true,
	"license": "MIT",
	"repository": {
		"type": "git",
		"url": "https://github.com/Microsoft/vscode-extension-samples"
	},
	"engines": {
		"vscode": "^1.100.0"
	},
	"categories": [
		"Other"
	],
	"activationEvents": [
		"onWebviewPanel:catCoding"
	],
	"main": "./out/extension.js",
	"contributes": {
		"commands": [
			{
				"command": "catCoding.start",
				"title": "Start cat coding session",
				"category": "Cat Coding"
			},
			{
				"command": "catCoding.doRefactor",
				"title": "Do some refactoring",
				"category": "Cat Coding"
			}
		]
	},
	"scripts": {
		"vscode:prepublish": "npm run compile",
		"compile": "tsc -p ./",
		"lint": "eslint",
		"watch": "tsc -w -p ./"
	},
	"devDependencies": {
		"@eslint/js": "^9.13.0",
		"@stylistic/eslint-plugin": "^2.9.0",
		"@types/node": "^22",
		"@types/vscode": "^1.100.0",
		"@types/vscode-webview": "^1.57.0",
		"eslint": "^9.13.0",
		"typescript": "^5.9.2",
		"typescript-eslint": "^8.39.0"
	}
}


================================================
FILE: webview-sample/tsconfig.json
================================================
{
	"compilerOptions": {
		"module": "commonjs",
		"target": "ES2024",
		"lib": [
			"ES2024"
		],
		"outDir": "out",
		"sourceMap": true,
		"strict": true,
		"rootDir": "src"
	},
	"exclude": [
		"node_modules",
		".vscode-test"
	]
}


================================================
FILE: webview-sample/media/jsconfig.json
================================================
{
	"compilerOptions": {
		"module": "commonjs",
		"target": "es2020",
		"jsx": "preserve",
		"checkJs": true,
		"strict": true,
		"strictFunctionTypes": true,
		"lib": [
			"dom"
		]
	},
	"exclude": [
		"node_modules",
		"**/node_modules/*"
	],
	"typeAcquisition": {
		"include": [
			"@types/vscode-webview"
		]
	}
}


================================================
FILE: webview-sample/media/main.js
================================================
// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
    const vscode = acquireVsCodeApi();

    const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());

    const counter = /** @type {HTMLElement} */ (document.getElementById('lines-of-code-counter'));
    console.log('Initial state', oldState);

    let currentCount = (oldState && oldState.count) || 0;
    counter.textContent = `${currentCount}`;

    setInterval(() => {
        counter.textContent = `${currentCount++} `;

        // Update state
        vscode.setState({ count: currentCount });

        // Alert the extension when the cat introduces a bug
        if (Math.random() < Math.min(0.001 * currentCount, 0.05)) {
            // Send a message back to the extension
            vscode.postMessage({
                command: 'alert',
                text: '🐛  on line ' + currentCount
            });
        }
    }, 100);

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'refactor':
                currentCount = Math.ceil(currentCount * 0.5);
                counter.textContent = `${currentCount}`;
                break;
        }
    });
}());



================================================
FILE: webview-sample/media/reset.css
================================================
html {
	box-sizing: border-box;
	font-size: 13px;
}

*,
*:before,
*:after {
	box-sizing: inherit;
}

body,
h1,
h2,
h3,
h4,
h5,
h6,
p,
ol,
ul {
	margin: 0;
	padding: 0;
	font-weight: normal;
}

img {
	max-width: 100%;
	height: auto;
}



================================================
FILE: webview-sample/media/vscode.css
================================================
:root {
	--container-padding: 20px;
	--input-padding-vertical: 6px;
	--input-padding-horizontal: 4px;
	--input-margin-vertical: 4px;
	--input-margin-horizontal: 0;
}

body {
	padding: 0 var(--container-padding);
	color: var(--vscode-foreground);
	font-size: var(--vscode-font-size);
	font-weight: var(--vscode-font-weight);
	font-family: var(--vscode-font-family);
	background-color: var(--vscode-editor-background);
}

ol,
ul {
	padding-left: var(--container-padding);
}

body > *,
form > * {
	margin-block-start: var(--input-margin-vertical);
	margin-block-end: var(--input-margin-vertical);
}

*:focus {
	outline-color: var(--vscode-focusBorder) !important;
}

a {
	color: var(--vscode-textLink-foreground);
}

a:hover,
a:active {
	color: var(--vscode-textLink-activeForeground);
}

code {
	font-size: var(--vscode-editor-font-size);
	font-family: var(--vscode-editor-font-family);
}

button {
	border: none;
	padding: var(--input-padding-vertical) var(--input-padding-horizontal);
	width: 100%;
	text-align: center;
	outline: 1px solid transparent;
	outline-offset: 2px !important;
	color: var(--vscode-button-foreground);
	background: var(--vscode-button-background);
}

button:hover {
	cursor: pointer;
	background: var(--vscode-button-hoverBackground);
}

button:focus {
	outline-color: var(--vscode-focusBorder);
}

button.secondary {
	color: var(--vscode-button-secondaryForeground);
	background: var(--vscode-button-secondaryBackground);
}

button.secondary:hover {
	background: var(--vscode-button-secondaryHoverBackground);
}

input:not([type='checkbox']),
textarea {
	display: block;
	width: 100%;
	border: none;
	font-family: var(--vscode-font-family);
	padding: var(--input-padding-vertical) var(--input-padding-horizontal);
	color: var(--vscode-input-foreground);
	outline-color: var(--vscode-input-border);
	background-color: var(--vscode-input-background);
}

input::placeholder,
textarea::placeholder {
	color: var(--vscode-input-placeholderForeground);
}



================================================
FILE: webview-sample/src/extension.ts
================================================
import * as vscode from 'vscode';

const cats = {
	'Coding Cat': 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
	'Compiling Cat': 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif',
	'Testing Cat': 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif'
};

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('catCoding.start', () => {
			CatCodingPanel.createOrShow(context.extensionUri);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('catCoding.doRefactor', () => {
			if (CatCodingPanel.currentPanel) {
				CatCodingPanel.currentPanel.doRefactor();
			}
		})
	);

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(CatCodingPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: unknown) {
				console.log(`Got state: ${state}`);
				// Reset the webview options so we use latest uri for `localResourceRoots`.
				webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
				CatCodingPanel.revive(webviewPanel, context.extensionUri);
			}
		});
	}
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,

		// And restrict the webview to only loading content from our extension's `media` directory.
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
	};
}

/**
 * Manages cat coding webview panels
 */
class CatCodingPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: CatCodingPanel | undefined;

	public static readonly viewType = 'catCoding';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (CatCodingPanel.currentPanel) {
			CatCodingPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			CatCodingPanel.viewType,
			'Cat Coding',
			column || vscode.ViewColumn.One,
			getWebviewOptions(extensionUri),
		);

		CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionUri);
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			() => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public doRefactor() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' });
	}

	public dispose() {
		CatCodingPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;

		// Vary the webview's content based on where it is located in the editor.
		switch (this._panel.viewColumn) {
			case vscode.ViewColumn.Two:
				this._updateForCat(webview, 'Compiling Cat');
				return;

			case vscode.ViewColumn.Three:
				this._updateForCat(webview, 'Testing Cat');
				return;

			case vscode.ViewColumn.One:
			default:
				this._updateForCat(webview, 'Coding Cat');
				return;
		}
	}

	private _updateForCat(webview: vscode.Webview, catName: keyof typeof cats) {
		this._panel.title = catName;
		this._panel.webview.html = this._getHtmlForWebview(webview, cats[catName]);
	}

	private _getHtmlForWebview(webview: vscode.Webview, catGifPath: string) {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Local path to css styles
		const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
		const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');

		// Uri to load styles into webview
		const stylesResetUri = webview.asWebviewUri(styleResetPath);
		const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">

				<title>Cat Coding</title>
			</head>
			<body>
				<img src="${catGifPath}" width="300" />
				<h1 id="lines-of-code-counter">0</h1>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}


