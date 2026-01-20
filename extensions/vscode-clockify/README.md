# VS Code Clockify Extension

Start and stop Clockify timers based on GitHub repo context with interactive selection.

## Install
1) In VS Code, open the Command Palette
2) Run: "Developer: Install Extension from Location..."
3) Select:
   `C:\Users\iric_\OneDrive\Dokument\clockify_extensions\extensions\vscode-clockify`
4) Run "Clockify: Set API Key"
5) Open the Clockify icon in the Activity Bar for quick actions

## Features
- Workspace/project/task/tag selection via Quick Pick
- Remembers last selection per repo
- Status bar timer with elapsed time
- Quick-start with saved selection (optional)
- Defaults via settings
- Explorer context menu and editor title actions for Start/Stop
- Activity Bar view with Start/Stop/Settings shortcuts

## Usage
- Run "Clockify: Start Timer for Issue"
- Run "Clockify: Stop Timer"
- Click the status bar item to start/stop quickly
- Run "Clockify: Open Settings" to adjust defaults
- Right-click in the Explorer for Start/Stop
- Use the editor title buttons for Start/Stop

## Settings
- `clockify.quickStartWithLastSelection`: start immediately with saved selection
- `clockify.skipPickIfSingle`: skip workspace picker if only one workspace exists
- `clockify.defaultWorkspaceId`: preselect a workspace
- `clockify.defaultProjectId`, `clockify.defaultTaskId`, `clockify.defaultTagIds`: defaults for new timers
