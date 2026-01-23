function getIssueContext() {
  const pathParts = location.pathname.split("/").filter(Boolean);
  const owner = pathParts[0] || "";
  const repo = pathParts[1] || "";
  const number = pathParts[3] || "";
  const titleNode =
    document.querySelector("[data-testid='issue-title']") ||
    document.querySelector("[data-testid='issue-title-sticky']") ||
    document.querySelector("h1 span[data-component='issue-title']") ||
    document.querySelector("h1 span.js-issue-title") ||
    document.querySelector("h1 .js-issue-title");
  const metaTitle = document.querySelector("meta[property='og:title']");
  const metaText = metaTitle ? metaTitle.content : "";
  let titleFromMeta = metaText ? metaText.trim() : "";
  if (metaText) {
    const dotIndex = metaText.indexOf("\u00b7");
    if (dotIndex > 0) {
      titleFromMeta = metaText.slice(0, dotIndex).trim();
    } else if (metaText.includes("GitHub")) {
      titleFromMeta = metaText.split("GitHub")[0].trim();
    }
  }
  const title = titleNode
    ? titleNode.textContent.trim()
    : titleFromMeta || document.title;
  const labelNodes = Array.from(
    document.querySelectorAll(
      "a.IssueLabel, span.IssueLabel, [data-testid='issue-labels'] span"
    )
  );
  const labels = labelNodes.map((node) => node.textContent.trim()).filter(Boolean);
  return {
    owner,
    repo,
    number,
    title,
    labels,
    url: location.href,
    repoFullName: owner && repo ? `${owner}/${repo}` : ""
  };
}

function insertButton() {
  if (document.getElementById("clockify-start-btn")) {
    return;
  }

  if (!document.getElementById("clockify-style")) {
    const style = document.createElement("style");
    style.id = "clockify-style";
    style.textContent = `
      #clockify-start-btn {
        appearance: none;
        border: 1px solid #d0d7de;
        border-radius: 6px;
        background: #f6f8fa;
        color: #24292f;
        font-size: 12px;
        font-weight: 600;
        line-height: 20px;
        padding: 4px 10px;
        cursor: pointer;
        white-space: nowrap;
      }
      #clockify-start-btn:hover {
        background: #f3f4f6;
        border-color: #bcc2c9;
      }
      #clockify-start-btn:active {
        background: #edeff2;
      }
      #clockify-stop-btn {
        appearance: none;
        border: 1px solid #cf222e;
        border-radius: 6px;
        background: #fff5f5;
        color: #cf222e;
        font-size: 12px;
        font-weight: 600;
        line-height: 20px;
        padding: 4px 10px;
        cursor: pointer;
        white-space: nowrap;
      }
      #clockify-stop-btn:hover {
        background: #ffe7e9;
      }
      #clockify-status {
        font-size: 12px;
        color: #57606a;
        background: #f6f8fa;
        border: 1px solid #d0d7de;
        border-radius: 999px;
        padding: 2px 8px;
      }
      #clockify-action-bar {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .clockify-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(27, 31, 36, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .clockify-modal {
        width: 100%;
        max-width: 520px;
        background: #ffffff;
        border: 1px solid #d0d7de;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(27, 31, 36, 0.2);
        font-family: "Segoe UI", Arial, sans-serif;
        color: #24292f;
      }
      .clockify-modal header {
        padding: 16px 20px 8px 20px;
        border-bottom: 1px solid #eaeef2;
      }
      .clockify-modal h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .clockify-modal .subtitle {
        margin: 4px 0 0;
        font-size: 12px;
        color: #57606a;
      }
      .clockify-modal .content {
        padding: 16px 20px;
        display: grid;
        gap: 12px;
      }
      .clockify-modal label {
        font-size: 12px;
        font-weight: 600;
        color: #57606a;
        display: block;
        margin-bottom: 6px;
      }
      .clockify-modal select,
      .clockify-modal textarea,
      .clockify-modal input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #d0d7de;
        border-radius: 6px;
        font-size: 13px;
        background: #f6f8fa;
        color: #24292f;
      }
      .clockify-modal textarea {
        min-height: 70px;
        resize: vertical;
      }
      .clockify-modal .row {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }
      .clockify-modal .search {
        margin-bottom: 6px;
      }
      .clockify-modal select[multiple] {
        min-height: 96px;
        background: #ffffff;
      }
      .clockify-modal .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 12px 20px 16px 20px;
        border-top: 1px solid #eaeef2;
      }
      .clockify-modal .btn {
        border: 1px solid #d0d7de;
        border-radius: 6px;
        background: #f6f8fa;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .clockify-modal .btn.primary {
        background: #1f6feb;
        border-color: #1f6feb;
        color: #ffffff;
      }
      .clockify-modal .error {
        color: #cf222e;
        font-size: 12px;
      }
      .clockify-modal .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #57606a;
      }
      .clockify-modal .toggle input {
        width: auto;
        margin: 0;
      }
      .clockify-modal .field-group {
        position: relative;
      }
      .clockify-modal .searchable-dropdown {
        position: relative;
      }
      .clockify-modal .dropdown-label-row {
        display: flex;
        gap: 6px;
        align-items: center;
        margin-bottom: 6px;
      }
      .clockify-modal .dropdown-label-row label {
        margin: 0;
        flex: 1;
      }
      .clockify-modal .btn-create-new {
        padding: 4px 8px;
        font-size: 11px;
        background: #f0f6fc;
        border: 1px solid #0969da;
        color: #0969da;
        cursor: pointer;
        border-radius: 4px;
        font-weight: 600;
        white-space: nowrap;
      }
      .clockify-modal .btn-create-new:hover {
        background: #f3f5ff;
      }
      .clockify-modal .btn-create-new:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .clockify-modal .search-input {
        padding: 8px 10px;
        border: 1px solid #d0d7de;
        border-radius: 6px;
        font-size: 13px;
        background: #ffffff;
        color: #24292f;
        width: 100%;
        box-sizing: border-box;
      }
      .clockify-modal .search-input:focus {
        outline: none;
        border-color: #0969da;
        box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.1);
      }
      .clockify-modal .dropdown-options {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: #ffffff;
        border: 1px solid #d0d7de;
        border-top: none;
        border-radius: 0 0 6px 6px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        display: none;
        margin-top: -1px;
      }
      .clockify-modal .dropdown-options.show {
        display: block;
      }
      .clockify-modal .dropdown-option {
        padding: 8px 10px;
        cursor: pointer;
        border-bottom: 1px solid #eaeef2;
        font-size: 13px;
        color: #24292f;
      }
      .clockify-modal .dropdown-option:last-child {
        border-bottom: none;
      }
      .clockify-modal .dropdown-option:hover {
        background: #f6f8fa;
      }
      .clockify-modal .dropdown-option.selected {
        background: #f0f6fc;
        color: #0969da;
        font-weight: 600;
      }
      .clockify-modal .selected-items {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
        padding: 8px;
        background: #f6f8fa;
        border: 1px solid #d0d7de;
        border-radius: 6px;
        min-height: 32px;
      }
      .clockify-modal .selected-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #0969da;
        color: #ffffff;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
      }
      .clockify-modal .selected-tag .remove-tag {
        cursor: pointer;
        font-weight: bold;
        margin-left: 2px;
      }
      .clockify-modal .selected-tag .remove-tag:hover {
        opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
  }

  const headerRegion = document.querySelector("[data-testid='issue-header']");
  const headerActions =
    headerRegion && headerRegion.querySelector("[data-component='PH_Actions']");
  const headerTitle =
    headerRegion && headerRegion.querySelector("[data-component='PH_Title']");
  const issueContainer = document.querySelector("[data-testid='issue-viewer-issue-container']");
  const container =
    headerActions ||
    document.querySelector(".gh-header-actions") ||
    document.querySelector(".gh-header-meta") ||
    document.querySelector(".gh-header") ||
    issueContainer;
  if (!container) {
    return;
  }

  const bar = document.createElement("div");
  bar.id = "clockify-action-bar";
  bar.style.justifyContent = headerActions ? "flex-start" : "flex-end";
  bar.style.margin = headerActions ? "0 0 0 8px" : "8px 0";

  const button = document.createElement("button");
  button.id = "clockify-start-btn";
  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;margin-right:6px;vertical-align:middle;">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
    Start Clockify
  `;

  const stopButton = document.createElement("button");
  stopButton.id = "clockify-stop-btn";
  stopButton.textContent = "Stop";
  stopButton.style.display = "none";

  const statusBadge = document.createElement("span");
  statusBadge.id = "clockify-status";
  statusBadge.textContent = "Idle";

  button.addEventListener("click", async () => {
    const context = getIssueContext();
    const quickStartEnabled = await getStorageValue("quickStartEnabled", false);
    const selectionsRaw = await getStorageValue("repoSelections", "{}");
    let repoSelections = {};
    try {
      repoSelections = JSON.parse(selectionsRaw || "{}");
    } catch (error) {
      repoSelections = {};
    }
    const repoKey = context.repoFullName || context.repo;
    const savedSelection = repoKey && repoSelections[repoKey] ? repoSelections[repoKey] : null;

    if (quickStartEnabled && savedSelection && savedSelection.workspaceId) {
      const response = await sendMessage({
        type: "START_TIMER_WITH_SELECTION",
        selection: {
          workspaceId: savedSelection.workspaceId,
          projectId: savedSelection.projectId,
          taskId: savedSelection.taskId,
          tagIds: Array.isArray(savedSelection.tagIds) ? savedSelection.tagIds : [],
          description: `${context.title} (${context.url})`
        }
      });
      if (!response || !response.ok) {
        alert(response && response.error ? response.error : "Failed to start timer.");
        return;
      }
      updateHeaderStatus();
      return;
    }

    openClockifyModal(context);
  });

  stopButton.addEventListener("click", async () => {
    stopButton.textContent = "Stopping...";
    try {
      const response = await sendMessage({ type: "STOP_TIMER" });
      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "Stop failed.");
      }
    } catch (error) {
      alert(error.message);
    } finally {
      stopButton.textContent = "Stop";
      await updateHeaderStatus();
    }
  });

  bar.appendChild(button);
  bar.appendChild(stopButton);
  bar.appendChild(statusBadge);

  if (headerActions) {
    container.appendChild(bar);
  } else if (headerTitle && headerTitle.parentElement) {
    headerTitle.parentElement.appendChild(bar);
  } else if (container.matches("[data-testid='issue-viewer-issue-container']")) {
    container.prepend(bar);
  } else {
    container.appendChild(bar);
  }

  updateHeaderStatus();
}

function init() {
  console.log("[Clockify] Content script loaded - initializing");
  document.documentElement.setAttribute("data-clockify-extension", "loaded");
  insertButton();
  const observer = new MutationObserver(() => insertButton());
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes) => {
    console.log("[Clockify] Storage changed:", Object.keys(changes));
    if (changes.lastTimeEntryId || changes.lastTimeEntryStart) {
      console.log("[Clockify] Timer-related storage changed, updating UI");
      updateHeaderStatus();
    }
  });

  // Immediate check for running timers on page load
  setTimeout(async () => {
    try {
      console.log("[Clockify] Starting initial timer check...");
      const lastTimeEntryId = await getStorageValue("lastTimeEntryId", "");
      console.log("[Clockify] Last time entry ID:", lastTimeEntryId || "none");
      if (!lastTimeEntryId) {
        console.log("[Clockify] No local timer, checking API...");
        const runningEntry = await fetchRunningEntryFromApi();
        console.log("[Clockify] API response:", runningEntry);
        if (runningEntry && runningEntry.id) {
          console.log("[Clockify] Found running timer on page load:", runningEntry.id);
          await setStorageValue("lastTimeEntryId", runningEntry.id);
          await setStorageValue("lastTimeEntryStart", runningEntry.timeInterval?.start || new Date().toISOString());
          await setStorageValue("lastTimeEntryDescription", runningEntry.description || "Running");
          await setStorageValue("lastTimeEntryWorkspaceId", runningEntry.workspaceId || "");
          await setStorageValue("lastTimeEntryUserId", runningEntry.userId || "");
          updateHeaderStatus();
        }
      }
    } catch (error) {
      console.log("[Clockify] Initial timer check failed:", error.message);
    }
  }, 2000);

  // Periodic check for running timers (every 30 seconds)
  // This detects if a timer was started externally in Clockify
  setInterval(async () => {
    try {
      const lastTimeEntryId = await getStorageValue("lastTimeEntryId", "");
      if (!lastTimeEntryId) {
        // No timer currently tracked locally, check if one is running in Clockify
        const runningEntry = await fetchRunningEntryFromApi();
        if (runningEntry && runningEntry.id) {
          // A timer is running in Clockify but we don't know about it locally
          console.log("[Clockify] Found running timer in periodic check:", runningEntry.id);
          await setStorageValue("lastTimeEntryId", runningEntry.id);
          await setStorageValue("lastTimeEntryStart", runningEntry.timeInterval?.start || new Date().toISOString());
          await setStorageValue("lastTimeEntryDescription", runningEntry.description || "Running");
          await setStorageValue("lastTimeEntryWorkspaceId", runningEntry.workspaceId || "");
          await setStorageValue("lastTimeEntryUserId", runningEntry.userId || "");
          updateHeaderStatus();
        }
      }
    } catch (error) {
      // Silently fail - API might be unavailable or key might not be set
      console.log("[Clockify] Timer check failed:", error.message);
    }
  }, 30000);

  let attempts = 0;
  const maxAttempts = 10;
  const intervalId = setInterval(() => {
    attempts += 1;
    insertButton();
    if (document.getElementById("clockify-start-btn") || attempts >= maxAttempts) {
      clearInterval(intervalId);
    }
  }, 1000);
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message || "Extension context invalidated.";
        if (errorMessage.toLowerCase().includes("context invalidated")) {
          resolve({ ok: false, error: "Extension context invalidated." });
          return;
        }
        reject(new Error(errorMessage));
        return;
      }
      resolve(response);
    });
  });
}

function normalizeName(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatElapsed(startIso) {
  const startMs = Date.parse(startIso);
  if (!startMs) {
    return "00:00";
  }
  const diff = Date.now() - startMs;
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildOption(value, label) {
  const option = document.createElement("option");
  option.value = value || "";
  option.textContent = label || "Unspecified";
  return option;
}

function getStorageValue(key, fallback) {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [key]: fallback }, (result) => {
      if (chrome.runtime.lastError) {
        resolve(fallback);
        return;
      }
      resolve(result[key]);
    });
  });
}

function setStorageValue(key, value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [key]: value }, () => resolve());
  });
}

async function fetchRunningEntryFromApi() {
  const response = await sendMessage({ type: "FETCH_RUNNING_ENTRY" });
  if (!response || !response.ok) {
    return null;
  }
  return response.data || null;
}

async function updateHeaderStatus() {
  // Prevent concurrent execution - if already running, skip
  if (updateHeaderStatus.isRunning) {
    console.log("[Clockify] updateHeaderStatus already running, skipping");
    return;
  }
  updateHeaderStatus.isRunning = true;
  
  console.log("[Clockify] updateHeaderStatus called");
  const lastTimeEntryId = await getStorageValue("lastTimeEntryId", "");
  const lastTimeEntryStart = await getStorageValue("lastTimeEntryStart", "");
  const lastTimeEntryDescription = await getStorageValue("lastTimeEntryDescription", "");
  console.log("[Clockify] Storage state - ID:", lastTimeEntryId ? "present" : "empty", "Start:", lastTimeEntryStart ? "present" : "empty");
  const statusBadge = document.getElementById("clockify-status");
  const stopButton = document.getElementById("clockify-stop-btn");

  if (!statusBadge || !stopButton) {
    updateHeaderStatus.isRunning = false;
    return;
  }

  // Clear any existing intervals
  if (updateHeaderStatus.intervalId) {
    console.log("[Clockify] Clearing existing elapsed time interval");
    clearInterval(updateHeaderStatus.intervalId);
    updateHeaderStatus.intervalId = null;
  }

  if (updateHeaderStatus.syncCheckId) {
    console.log("[Clockify] Clearing existing sync check interval");
    clearInterval(updateHeaderStatus.syncCheckId);
    updateHeaderStatus.syncCheckId = null;
  }

  if (lastTimeEntryId && lastTimeEntryStart) {
    console.log("[Clockify] Timer is running - setting up UI updates");
    let startIso = lastTimeEntryStart;
    let description = lastTimeEntryDescription;
    // Check API more frequently to detect when timer is stopped (every 5 seconds instead of 60)
    if (!updateHeaderStatus.lastApiFetch || Date.now() - updateHeaderStatus.lastApiFetch > 5000) {
      try {
        const apiEntry = await fetchRunningEntryFromApi();
        console.log("[Clockify] Initial API check - entry:", apiEntry ? `{id: ${apiEntry.id}}` : "null");
        if (apiEntry && apiEntry.start) {
          startIso = apiEntry.start;
          description = apiEntry.description || description;
          await setStorageValue("lastTimeEntryStart", startIso);
          await setStorageValue("lastTimeEntryDescription", description);
        } else if (!apiEntry) {
          // Timer was stopped in Clockify but extension still thinks it's running
          console.log("[Clockify] Timer stopped - clearing storage and UI");
          await setStorageValue("lastTimeEntryId", "");
          await setStorageValue("lastTimeEntryStart", "");
          await setStorageValue("lastTimeEntryDescription", "");
          statusBadge.textContent = "Clockify: Idle";
          statusBadge.title = "No timer running";
          stopButton.style.display = "none";
          updateHeaderStatus.isRunning = false;
          return;
        }
      } catch (error) {
        console.error("[Clockify] API check error:", error);
      }
      updateHeaderStatus.lastApiFetch = Date.now();
    }

    const updateElapsed = () => {
      const elapsed = formatElapsed(startIso);
      statusBadge.textContent = `Clockify: ${elapsed}`;
      statusBadge.title = description
        ? `Running ${elapsed} - ${description}`
        : `Running ${elapsed}`;
    };
    updateElapsed();
    updateHeaderStatus.intervalId = setInterval(updateElapsed, 1000);
    
    // Check for timer sync every 5 seconds (faster detection of stopped timers)
    console.log("[Clockify] Setting up sync check interval");
    updateHeaderStatus.syncCheckId = setInterval(async () => {
      // Double-check that syncCheckId still exists (may have been cleared already)
      if (!updateHeaderStatus.syncCheckId) return;
      
      try {
        const apiEntry = await fetchRunningEntryFromApi();
        console.log("[Clockify] Sync check - API entry:", apiEntry ? `{id: ${apiEntry.id}}` : "null");
        if (!apiEntry) {
          console.log("[Clockify] Timer stopped in Clockify - clearing storage and UI immediately");
          // Timer was stopped in Clockify - update UI immediately, don't wait for storage events
          statusBadge.textContent = "Clockify: Idle";
          statusBadge.title = "No timer running (synced from Clockify)";
          stopButton.style.display = "none";
          if (updateHeaderStatus.intervalId) {
            clearInterval(updateHeaderStatus.intervalId);
            updateHeaderStatus.intervalId = null;
          }
          // Stop the sync check interval immediately - this is key!
          if (updateHeaderStatus.syncCheckId) {
            clearInterval(updateHeaderStatus.syncCheckId);
            updateHeaderStatus.syncCheckId = null;
            console.log("[Clockify] Sync check interval cleared");
          }
          // Clear storage after UI update
          console.log("[Clockify] Clearing storage values");
          await setStorageValue("lastTimeEntryId", "");
          await setStorageValue("lastTimeEntryStart", "");
          await setStorageValue("lastTimeEntryDescription", "");
          console.log("[Clockify] Storage cleared - sync check stopped");
          return;
        }
      } catch (error) {
        // Handle extension context invalidated (happens on reload)
        if (error.message && error.message.includes("Extension context invalidated")) {
          console.log("[Clockify] Extension context invalidated - stopping sync check");
          if (updateHeaderStatus.syncCheckId) {
            clearInterval(updateHeaderStatus.syncCheckId);
            updateHeaderStatus.syncCheckId = null;
          }
          if (updateHeaderStatus.intervalId) {
            clearInterval(updateHeaderStatus.intervalId);
            updateHeaderStatus.intervalId = null;
          }
          return;
        }
        console.error("[Clockify] Sync check error:", error);
      }
      updateHeaderStatus.lastApiFetch = Date.now();
    }, 5000);
    
    stopButton.style.display = "inline-flex";
  } else {
    console.log("[Clockify] No timer running - showing idle state");
    statusBadge.textContent = "Clockify: Idle";
    statusBadge.title = "No timer running";
    stopButton.style.display = "none";
  }
  
  updateHeaderStatus.isRunning = false;
}

function applySearchFilter(inputEl, selectEl) {
  const query = normalizeName(inputEl.value);
  const listType = selectEl.getAttribute("data-list");
  const listMap = {
    projects: applySearchFilter.projects || [],
    tasks: applySearchFilter.tasks || [],
    tags: applySearchFilter.tags || []
  };
  const source = listMap[listType] || [];
  const filtered = query
    ? source.filter((item) => normalizeName(item.name).includes(query))
    : source;
  renderSelectOptions(selectEl, filtered, listType !== "tags");
}

function selectTagsByLabels(tagsSelect, labels) {
  if (!labels.length) {
    return;
  }
  const normalizedLabels = labels.map(normalizeName);
  Array.from(tagsSelect.options).forEach((option) => {
    if (!option.value) {
      return;
    }
    const optionName = normalizeName(option.textContent);
    if (normalizedLabels.includes(optionName)) {
      option.selected = true;
    }
  });
}

function renderSelectOptions(selectEl, items, includeEmpty) {
  const currentValue = selectEl.value;
  selectEl.innerHTML = "";
  if (includeEmpty) {
    selectEl.appendChild(buildOption("", selectEl.id === "clockify-task" ? "No task" : "No project"));
  }
  items.forEach((item) => {
    selectEl.appendChild(buildOption(item.id, item.name));
  });
  if (currentValue) {
    const match = Array.from(selectEl.options).find((opt) => opt.value === currentValue);
    if (match) {
      selectEl.value = currentValue;
    }
  }
}

async function openClockifyModal(context) {
  if (document.getElementById("clockify-backdrop")) {
    return;
  }

  const backdrop = document.createElement("div");
  backdrop.id = "clockify-backdrop";
  backdrop.className = "clockify-backdrop";

  const modal = document.createElement("div");
  modal.className = "clockify-modal";
  modal.innerHTML = `
    <header>
      <h2>Start Clockify timer</h2>
      <p class="subtitle">${context.title}</p>
    </header>
    <div class="content">
      <div>
        <label for="clockify-workspace">Workspace</label>
        <select id="clockify-workspace"></select>
      </div>
      <div class="field-group">
        <div class="dropdown-label-row">
          <label for="clockify-project-search">Project</label>
          <button class="btn-create-new" id="clockify-new-project-btn" type="button" style="display:none;">+ New</button>
        </div>
        <div class="searchable-dropdown" id="clockify-project-dropdown">
          <input class="search-input" id="clockify-project-search" type="text" placeholder="Search projects...">
          <div class="dropdown-options" id="clockify-project-options"></div>
        </div>
      </div>
      <div class="field-group">
        <div class="dropdown-label-row">
          <label for="clockify-task-search">Task</label>
          <button class="btn-create-new" id="clockify-new-task-btn" type="button" style="display:none;">+ New</button>
        </div>
        <div class="searchable-dropdown" id="clockify-task-dropdown">
          <input class="search-input" id="clockify-task-search" type="text" placeholder="Search tasks...">
          <div class="dropdown-options" id="clockify-task-options"></div>
        </div>
      </div>
      <div class="field-group">
        <div class="dropdown-label-row">
          <label for="clockify-tags-search">Tags</label>
          <button class="btn-create-new" id="clockify-new-tag-btn" type="button" style="display:none;">+ New</button>
        </div>
        <div class="searchable-dropdown" id="clockify-tags-dropdown">
          <input class="search-input" id="clockify-tags-search" type="text" placeholder="Search tags...">
          <div class="dropdown-options" id="clockify-tags-options"></div>
        </div>
        <div class="selected-items" id="clockify-selected-tags"></div>
      </div>
      <div>
        <label for="clockify-description">Description</label>
        <textarea id="clockify-description"></textarea>
      </div>
      <div class="toggle">
        <input type="checkbox" id="clockify-quick-start">
        <label for="clockify-quick-start">Start with last selection next time</label>
      </div>
      <div class="error" id="clockify-error"></div>
    </div>
    <div class="actions">
      <button class="btn" id="clockify-discard">Discard</button>
      <button class="btn" id="clockify-cancel">Cancel</button>
      <button class="btn primary" id="clockify-start">Start timer</button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const workspaceSelect = modal.querySelector("#clockify-workspace");
  const projectSearch = modal.querySelector("#clockify-project-search");
  const projectOptions = modal.querySelector("#clockify-project-options");
  const taskSearch = modal.querySelector("#clockify-task-search");
  const taskOptions = modal.querySelector("#clockify-task-options");
  const tagsSearch = modal.querySelector("#clockify-tags-search");
  const tagsOptions = modal.querySelector("#clockify-tags-options");
  const selectedTagsContainer = modal.querySelector("#clockify-selected-tags");
  const descriptionField = modal.querySelector("#clockify-description");
  const quickStartToggle = modal.querySelector("#clockify-quick-start");
  const errorEl = modal.querySelector("#clockify-error");
  const startButton = modal.querySelector("#clockify-start");
  const cancelButton = modal.querySelector("#clockify-cancel");
  const discardButton = modal.querySelector("#clockify-discard");
  const newProjectBtn = modal.querySelector("#clockify-new-project-btn");
  const newTaskBtn = modal.querySelector("#clockify-new-task-btn");
  const newTagBtn = modal.querySelector("#clockify-new-tag-btn");

  // State tracking
  let selectedProjectId = "";
  let selectedProjectName = "";
  let selectedTaskId = "";
  let selectedTaskName = "";
  let selectedTagIds = [];
  let selectedTagNames = [];

  descriptionField.value = `${context.title} (${context.url})`;

  const repoKey = context.repoFullName || context.repo;
  const selectionsRaw = await getStorageValue("repoSelections", "{}");
  const quickStartEnabled = await getStorageValue("quickStartEnabled", false);
  let repoSelections = {};
  try {
    repoSelections = JSON.parse(selectionsRaw || "{}");
  } catch (error) {
    repoSelections = {};
  }
  const savedSelection = repoKey && repoSelections[repoKey] ? repoSelections[repoKey] : null;
  quickStartToggle.checked = Boolean(quickStartEnabled);

  function closeModal() {
    document.removeEventListener("keydown", handleKeydown);
    backdrop.remove();
  }

  function discardForm() {
    projectSearch.value = "";
    taskSearch.value = "";
    tagsSearch.value = "";
    descriptionField.value = `${context.title} (${context.url})`;
    quickStartToggle.checked = Boolean(quickStartEnabled);
    selectedProjectId = "";
    selectedProjectName = "";
    selectedTaskId = "";
    selectedTaskName = "";
    selectedTagIds = [];
    selectedTagNames = [];
    updateSelectedTags();
    projectOptions.classList.remove("show");
    taskOptions.classList.remove("show");
    tagsOptions.classList.remove("show");
    setError("");
  }

  cancelButton.addEventListener("click", closeModal);
  discardButton.addEventListener("click", discardForm);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeModal();
    }
  });

  function handleKeydown(event) {
    if (event.key === "Escape") {
      closeModal();
      return;
    }
    const isEnter = event.key === "Enter";
    const isMeta = event.metaKey || event.ctrlKey;
    if (isEnter && isMeta) {
      startButton.click();
    }
    const isD = event.key === "d" || event.key === "D";
    if (isD && isMeta) {
      event.preventDefault();
      discardForm();
    }
  }

  document.addEventListener("keydown", handleKeydown);

  function setError(message) {
    errorEl.textContent = message || "";
  }

  function updateSelectedTags() {
    selectedTagsContainer.innerHTML = selectedTagNames
      .map((name, idx) => `
        <div class="selected-tag">
          ${name}
          <span class="remove-tag" data-index="${idx}">×</span>
        </div>
      `)
      .join("");
    
    selectedTagsContainer.querySelectorAll(".remove-tag").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"));
        selectedTagIds.splice(idx, 1);
        selectedTagNames.splice(idx, 1);
        updateSelectedTags();
      });
    });
  }

  function renderDropdownOptions(search, items, optionsContainer, selectedId, onSelect) {
    const query = normalizeName(search);
    const itemsList = items || [];
    const filtered = query
      ? itemsList.filter((item) => normalizeName(item.name).includes(query))
      : itemsList;
    
    optionsContainer.innerHTML = filtered.length
      ? filtered
          .map(
            (item) => `
            <div class="dropdown-option ${item.id === selectedId ? "selected" : ""}" data-id="${item.id}" data-name="${item.name}">
              ${item.name}
            </div>
          `
          )
          .join("")
      : '<div style="padding: 8px 10px; color: #57606a; text-align: center;">No options</div>';

    optionsContainer.querySelectorAll(".dropdown-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        onSelect(opt.getAttribute("data-id"), opt.getAttribute("data-name"));
        optionsContainer.classList.remove("show");
        if (search === projectSearch.value) projectSearch.value = "";
        if (search === taskSearch.value) taskSearch.value = "";
        if (search === tagsSearch.value) tagsSearch.value = "";
      });
    });
  }

  async function loadWorkspaces() {
    const response = await sendMessage({ type: "FETCH_WORKSPACES" });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Failed to load workspaces.");
    }
    workspaceSelect.innerHTML = "";
    response.data.forEach((workspace) => {
      workspaceSelect.appendChild(buildOption(workspace.id, workspace.name));
    });
  }

  async function loadProjects(workspaceId) {
    applySearchFilter.projects = [];
    applySearchFilter.tasks = [];
    projectOptions.innerHTML = "";
    taskOptions.innerHTML = "";
    newProjectBtn.style.display = workspaceId ? "block" : "none";
    if (!workspaceId) {
      return;
    }
    const response = await sendMessage({ type: "FETCH_PROJECTS", workspaceId });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Failed to load projects.");
    }
    applySearchFilter.projects = response.data;
  }

  async function loadTags(workspaceId) {
    applySearchFilter.tags = [];
    tagsOptions.innerHTML = "";
    newTagBtn.style.display = workspaceId ? "block" : "none";
    if (!workspaceId) {
      return;
    }
    const response = await sendMessage({ type: "FETCH_TAGS", workspaceId });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Failed to load tags.");
    }
    applySearchFilter.tags = response.data;
  }

  async function loadTasks(workspaceId, projectId) {
    applySearchFilter.tasks = [];
    taskOptions.innerHTML = "";
    newTaskBtn.style.display = (workspaceId && projectId) ? "block" : "none";
    if (!workspaceId || !projectId) {
      return;
    }
    const response = await sendMessage({
      type: "FETCH_TASKS",
      workspaceId,
      projectId
    });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Failed to load tasks.");
    }
    applySearchFilter.tasks = response.data;
  }

  newProjectBtn.addEventListener("click", async () => {
    const name = projectSearch.value.trim();
    if (!name) {
      setError("Enter a project name");
      return;
    }
    newProjectBtn.disabled = true;
    newProjectBtn.textContent = "Creating...";
    try {
      const response = await sendMessage({
        type: "CREATE_PROJECT",
        workspaceId: workspaceSelect.value,
        name
      });
      if (!response || !response.ok) {
        throw new Error(response?.error || "Failed to create project.");
      }
      const newProject = response.data;
      applySearchFilter.projects.push(newProject);
      selectedProjectId = newProject.id;
      selectedProjectName = newProject.name;
      projectSearch.value = "";
      projectOptions.classList.remove("show");
      await loadTasks(workspaceSelect.value, newProject.id);
      setError("");
    } catch (error) {
      setError(error.message);
    } finally {
      newProjectBtn.disabled = false;
      newProjectBtn.textContent = "+ New";
    }
  });

  newTaskBtn.addEventListener("click", async () => {
    const name = taskSearch.value.trim();
    if (!name) {
      setError("Enter a task name");
      return;
    }
    newTaskBtn.disabled = true;
    newTaskBtn.textContent = "Creating...";
    try {
      const response = await sendMessage({
        type: "CREATE_TASK",
        workspaceId: workspaceSelect.value,
        projectId: selectedProjectId,
        name
      });
      if (!response || !response.ok) {
        throw new Error(response?.error || "Failed to create task.");
      }
      const newTask = response.data;
      applySearchFilter.tasks.push(newTask);
      selectedTaskId = newTask.id;
      selectedTaskName = newTask.name;
      taskSearch.value = "";
      taskOptions.classList.remove("show");
      setError("");
    } catch (error) {
      setError(error.message);
    } finally {
      newTaskBtn.disabled = false;
      newTaskBtn.textContent = "+ New";
    }
  });

  newTagBtn.addEventListener("click", async () => {
    const name = tagsSearch.value.trim();
    if (!name) {
      setError("Enter a tag name");
      return;
    }
    newTagBtn.disabled = true;
    newTagBtn.textContent = "Creating...";
    try {
      const response = await sendMessage({
        type: "CREATE_TAG",
        workspaceId: workspaceSelect.value,
        name
      });
      if (!response || !response.ok) {
        throw new Error(response?.error || "Failed to create tag.");
      }
      const newTag = response.data;
      applySearchFilter.tags.push(newTag);
      if (!selectedTagIds.includes(newTag.id)) {
        selectedTagIds.push(newTag.id);
        selectedTagNames.push(newTag.name);
        updateSelectedTags();
      }
      tagsSearch.value = "";
      tagsOptions.classList.remove("show");
      setError("");
    } catch (error) {
      setError(error.message);
    } finally {
      newTagBtn.disabled = false;
      newTagBtn.textContent = "+ New";
    }
  });

  projectSearch.addEventListener("focus", () => {
    renderDropdownOptions(projectSearch.value, applySearchFilter.projects, projectOptions, selectedProjectId, (id, name) => {
      selectedProjectId = id;
      selectedProjectName = name;
      projectSearch.value = name;
      selectedTaskId = "";
      selectedTaskName = "";
      taskSearch.value = "";
      loadTasks(workspaceSelect.value, id);
    });
    projectOptions.classList.add("show");
  });

  projectSearch.addEventListener("input", () => {
    renderDropdownOptions(projectSearch.value, applySearchFilter.projects, projectOptions, selectedProjectId, (id, name) => {
      selectedProjectId = id;
      selectedProjectName = name;
      projectSearch.value = name;
      selectedTaskId = "";
      selectedTaskName = "";
      taskSearch.value = "";
      loadTasks(workspaceSelect.value, id);
    });
    projectOptions.classList.add("show");
  });

  projectSearch.addEventListener("blur", () => {
    setTimeout(() => projectOptions.classList.remove("show"), 200);
  });

  taskSearch.addEventListener("focus", () => {
    if (selectedProjectId) {
      renderDropdownOptions(taskSearch.value, applySearchFilter.tasks, taskOptions, selectedTaskId, (id, name) => {
        selectedTaskId = id;
        selectedTaskName = name;
        taskSearch.value = name;
      });
      taskOptions.classList.add("show");
    }
  });

  taskSearch.addEventListener("input", () => {
    if (selectedProjectId) {
      renderDropdownOptions(taskSearch.value, applySearchFilter.tasks, taskOptions, selectedTaskId, (id, name) => {
        selectedTaskId = id;
        selectedTaskName = name;
        taskSearch.value = name;
      });
      taskOptions.classList.add("show");
    }
  });

  taskSearch.addEventListener("blur", () => {
    setTimeout(() => taskOptions.classList.remove("show"), 200);
  });

  tagsSearch.addEventListener("focus", () => {
    renderDropdownOptions(tagsSearch.value, applySearchFilter.tags, tagsOptions, null, (id, name) => {
      if (!selectedTagIds.includes(id)) {
        selectedTagIds.push(id);
        selectedTagNames.push(name);
        updateSelectedTags();
      }
      tagsSearch.value = "";
    });
    tagsOptions.classList.add("show");
  });

  tagsSearch.addEventListener("input", () => {
    renderDropdownOptions(tagsSearch.value, applySearchFilter.tags, tagsOptions, null, (id, name) => {
      if (!selectedTagIds.includes(id)) {
        selectedTagIds.push(id);
        selectedTagNames.push(name);
        updateSelectedTags();
      }
      tagsSearch.value = "";
    });
    tagsOptions.classList.add("show");
  });

  tagsSearch.addEventListener("blur", () => {
    setTimeout(() => tagsOptions.classList.remove("show"), 200);
  });

  workspaceSelect.addEventListener("change", async () => {
    setError("");
    try {
      await loadProjects(workspaceSelect.value);
      await loadTags(workspaceSelect.value);
      if (savedSelection) {
        selectedProjectId = savedSelection.projectId || "";
        selectedProjectName = savedSelection.projectName || "";
        projectSearch.value = selectedProjectName;
        await loadTasks(workspaceSelect.value, selectedProjectId);
        selectedTaskId = savedSelection.taskId || "";
        selectedTaskName = savedSelection.taskName || "";
        taskSearch.value = selectedTaskName;
        if (Array.isArray(savedSelection.tagIds)) {
          const tagMap = {};
          applySearchFilter.tags.forEach(tag => {
            tagMap[tag.id] = tag.name;
          });
          selectedTagIds = savedSelection.tagIds.filter(id => tagMap[id]);
          selectedTagNames = selectedTagIds.map(id => tagMap[id]);
          updateSelectedTags();
        }
      } else {
        if (context.labels.length) {
          const normalizedLabels = context.labels.map(normalizeName);
          applySearchFilter.tags.forEach((tag) => {
            if (normalizedLabels.includes(normalizeName(tag.name))) {
              if (!selectedTagIds.includes(tag.id)) {
                selectedTagIds.push(tag.id);
                selectedTagNames.push(tag.name);
              }
            }
          });
          updateSelectedTags();
        }
      }
    } catch (error) {
      setError(error.message);
    }
  });

  startButton.addEventListener("click", async () => {
    setError("");
    startButton.textContent = "Starting...";
    startButton.disabled = true;

    const selection = {
      workspaceId: workspaceSelect.value,
      projectId: selectedProjectId,
      taskId: selectedTaskId,
      tagIds: selectedTagIds,
      description: descriptionField.value.trim()
    };

    try {
      await setStorageValue("quickStartEnabled", quickStartToggle.checked);
      const response = await sendMessage({
        type: "START_TIMER_WITH_SELECTION",
        selection
      });
      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "Failed to start timer.");
      }
      if (repoKey) {
        repoSelections[repoKey] = selection;
        await setStorageValue("repoSelections", JSON.stringify(repoSelections));
      }
      closeModal();
      updateHeaderStatus();
    } catch (error) {
      setError(error.message);
    } finally {
      startButton.textContent = "Start timer";
      startButton.disabled = false;
    }
  });

  try {
    await loadWorkspaces();
    if (savedSelection) {
      workspaceSelect.value = savedSelection.workspaceId;
    }
    if (!workspaceSelect.value && workspaceSelect.options.length === 1) {
      workspaceSelect.selectedIndex = 0;
    }
    if (workspaceSelect.value) {
      await loadProjects(workspaceSelect.value);
      await loadTags(workspaceSelect.value);
      if (savedSelection) {
        selectedProjectId = savedSelection.projectId || "";
        selectedProjectName = savedSelection.projectName || "";
        projectSearch.value = selectedProjectName;
        await loadTasks(workspaceSelect.value, selectedProjectId);
        selectedTaskId = savedSelection.taskId || "";
        selectedTaskName = savedSelection.taskName || "";
        taskSearch.value = selectedTaskName;
        if (Array.isArray(savedSelection.tagIds)) {
          const tagMap = {};
          applySearchFilter.tags.forEach(tag => {
            tagMap[tag.id] = tag.name;
          });
          selectedTagIds = savedSelection.tagIds.filter(id => tagMap[id]);
          selectedTagNames = selectedTagIds.map(id => tagMap[id]);
          updateSelectedTags();
        }
      } else {
        if (context.labels.length) {
          const normalizedLabels = context.labels.map(normalizeName);
          applySearchFilter.tags.forEach((tag) => {
            if (normalizedLabels.includes(normalizeName(tag.name))) {
              if (!selectedTagIds.includes(tag.id)) {
                selectedTagIds.push(tag.id);
                selectedTagNames.push(tag.name);
              }
            }
          });
          updateSelectedTags();
        }
      }
    }
  } catch (error) {
    setError(error.message);
    if (error.message.toLowerCase().includes("api key")) {
      sendMessage({ type: "OPEN_OPTIONS" });
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}





