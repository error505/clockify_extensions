# GitHub Clockify Starter Extension

Chrome extension that adds Clockify controls to GitHub issue and PR pages.

## Install (Chrome)
1) Open `chrome://extensions`
2) Enable Developer mode
3) Click "Load unpacked" and select:
   `C:\Users\iric_\OneDrive\Dokument\clockify_extensions\extensions\github-clockify-extension`
4) Open the extension Options page and paste your Clockify API key

## Features
- Start/stop timers directly on GitHub issues and PRs
- Modal picker for workspace, project, task, and tags
- Searchable lists for projects, tasks, and tags
- Remembers last selection per repo
- Optional quick-start with last selection (skip modal)
- Auto-match GitHub labels to Clockify tags
- Header badge shows elapsed time with API-verified start time

## Usage
- Click "Start Clockify" on an issue/PR
- Use `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (macOS) to start from the modal
- Press `Esc` to close the modal
- Use "Stop" in the header to end the running timer

## Configuration
- Options page:
  - API Key
  - Label-to-tag map (optional, tag IDs)
  - Quick-start toggle

## Auto-match
- Label-to-tag map: map issue labels to Clockify tag IDs
