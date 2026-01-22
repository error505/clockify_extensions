# Clockify Pro - VS Code Extension

Advanced Clockify timer management directly from VS Code with workspace selection, templates, idle detection, timesheet export, and calendar week view.

## Quick Start

### Getting Your Clockify API Key

1. Go to [Clockify](https://clockify.me) and log in to your account
2. Click on your **Profile** (top right corner)
3. Select **Settings**
4. Navigate to the **API** section (or find the API token option)
5. Click **Generate** to create your API token
6. Copy the API token (you'll only see it once)
7. In VS Code, run the command `Clockify: Set API Key` and paste your token

### Initial Setup

1. Install the extension from VS Code Marketplace
2. Run `Clockify: Set API Key` and paste your Clockify API token
3. Click the **Clockify Pro** icon in the Activity Bar
4. Select your workspace, project, and tags
5. Click **▶ Start** to begin tracking time

## Features

### Core Timer Features
- ⏱️ **Start/Stop Timer** - Quick timer control from the sidebar with live elapsed time
- 🏢 **Workspace Selection** - Choose workspace and project from dropdowns
- 🏷️ **Tags Support** - Select multiple tags for each time entry
- 📝 **Templates** - Save and load timer templates for recurring tasks
- ⚡ **Recent Entries** - Quick access to your 5 most recent time entries with resume option

### Advanced Features
- 🔔 **Idle Detection** - Get a notification if your timer runs for 2+ hours ("Still working on this?")
- 📊 **Today's Progress** - Visual progress bar showing hours worked today vs. daily goal
- 📅 **This Week View** - Calendar timeline showing all entries grouped by day with times and durations
- 📄 **Export Timesheet** - Export last 7 or 30 days to CSV for reporting and invoicing
- 💾 **Daily Goal** - Set and track your daily hour target

### Smart Features
- 🧠 **Smart Selection Memory** - Remembers your workspace/project selection per repository
- ⚙️ **Global Settings** - Configure defaults via VS Code settings
- 📌 **Status Bar** - Quick timer status and elapsed time in the status bar

## Usage Guide

### Starting a Timer
1. Open the **Clockify Pro** sidebar view
2. Select workspace, project, and tags (optional)
3. Enter a description for your work
4. Click **▶ Start**

### Stopping the Timer
- Click **⏹ Stop** in the sidebar, or
- Click the timer in the status bar

### Using Templates
1. Start a timer with the configuration you want to save
2. Click **Save** under "Save as Template" and give it a name
3. Later, find your template under "⭐ Templates" and click **Load** to apply it
4. Or click **Delete** to remove a template

### Exporting Your Timesheet
1. Select the date range (Last 7 days or Last 30 days)
2. Click **CSV** to download
3. Choose where to save the file
4. Use the CSV for invoicing, reporting, or import to accounting software

### Viewing This Week
1. Scroll to "📅 This Week"
2. Click **Refresh** to load your entries for the current calendar week
3. Entries are grouped by day with start times and durations

### Setting Your Daily Goal
1. Scroll to "⚙️ Settings"
2. Enter your target hours (e.g., 8 for 8 hours)
3. Click **Set**
4. The progress bar at the top will reflect your goal

## Screenshots

### Main Timer View
![Timer View](https://github.com/error505/clockify_extensions/blob/main/extensions/vscode-clockify/image.png?raw=true)

### Features Overview
![Features](https://github.com/error505/clockify_extensions/blob/main/extensions/vscode-clockify/image-1.png?raw=true)

## Settings

Configure via VS Code Settings (`Ctrl+,` → search "clockify"):

- `clockify.quickStartWithLastSelection` - Start immediately with your last workspace/project (boolean, default: false)
- `clockify.skipPickIfSingle` - Skip workspace picker if you only have one (boolean, default: true)
- `clockify.defaultWorkspaceId` - Preselect a workspace (string)
- `clockify.defaultProjectId` - Preselect a project (string)
- `clockify.defaultTaskId` - Preselect a task (string)
- `clockify.defaultTagIds` - Preselect tags (array of strings)

## Troubleshooting

**"Clockify API key is required"**
- Run `Clockify: Set API Key` in VS Code and paste your API token from Clockify Settings → API

**Timer not starting**
- Make sure a workspace is selected in the dropdown
- Check your API key is valid by verifying it in Clockify Settings

**No entries showing in "This Week"**
- Click **Refresh** to load entries
- Make sure you have time entries logged in Clockify for this week

**Idle warning not appearing**
- The warning triggers after 2 hours of continuous timer running
- Check your timer is actually running in the sidebar

## License

MIT

## Support

For issues or feature requests, visit [GitHub Issues](https://github.com/error505/clockify_extensions/issues)
