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
  button.textContent = "Start Clockify";

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
  document.documentElement.setAttribute("data-clockify-extension", "loaded");
  insertButton();
  const observer = new MutationObserver(() => insertButton());
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lastTimeEntryId || changes.lastTimeEntryStart) {
      updateHeaderStatus();
    }
  });

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
  const lastTimeEntryId = await getStorageValue("lastTimeEntryId", "");
  const lastTimeEntryStart = await getStorageValue("lastTimeEntryStart", "");
  const lastTimeEntryDescription = await getStorageValue("lastTimeEntryDescription", "");
  const statusBadge = document.getElementById("clockify-status");
  const stopButton = document.getElementById("clockify-stop-btn");

  if (!statusBadge || !stopButton) {
    return;
  }

  if (updateHeaderStatus.intervalId) {
    clearInterval(updateHeaderStatus.intervalId);
    updateHeaderStatus.intervalId = null;
  }

  if (lastTimeEntryId) {
    let startIso = lastTimeEntryStart;
    let description = lastTimeEntryDescription;
    if (!updateHeaderStatus.lastApiFetch || Date.now() - updateHeaderStatus.lastApiFetch > 60000) {
      const apiEntry = await fetchRunningEntryFromApi();
      if (apiEntry && apiEntry.start) {
        startIso = apiEntry.start;
        description = apiEntry.description || description;
        await setStorageValue("lastTimeEntryStart", startIso);
        await setStorageValue("lastTimeEntryDescription", description);
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
    stopButton.style.display = "inline-flex";
  } else {
    statusBadge.textContent = "Clockify: Idle";
    statusBadge.title = "No timer running";
    stopButton.style.display = "none";
  }
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
      <div class="row">
        <div>
          <label for="clockify-project">Project</label>
          <input class="search" id="clockify-project-search" type="text" placeholder="Search projects">
          <select id="clockify-project" data-list="projects">
            <option value="">No project</option>
          </select>
        </div>
        <div>
          <label for="clockify-task">Task</label>
          <input class="search" id="clockify-task-search" type="text" placeholder="Search tasks">
          <select id="clockify-task" data-list="tasks">
            <option value="">No task</option>
          </select>
        </div>
      </div>
      <div>
        <label for="clockify-tags">Tags</label>
        <input class="search" id="clockify-tags-search" type="text" placeholder="Search tags">
        <select id="clockify-tags" data-list="tags" multiple size="4"></select>
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
      <button class="btn" id="clockify-cancel">Cancel</button>
      <button class="btn primary" id="clockify-start">Start timer</button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const workspaceSelect = modal.querySelector("#clockify-workspace");
  const projectSelect = modal.querySelector("#clockify-project");
  const taskSelect = modal.querySelector("#clockify-task");
  const tagsSelect = modal.querySelector("#clockify-tags");
  const projectSearch = modal.querySelector("#clockify-project-search");
  const taskSearch = modal.querySelector("#clockify-task-search");
  const tagsSearch = modal.querySelector("#clockify-tags-search");
  const descriptionField = modal.querySelector("#clockify-description");
  const quickStartToggle = modal.querySelector("#clockify-quick-start");
  const errorEl = modal.querySelector("#clockify-error");
  const startButton = modal.querySelector("#clockify-start");
  const cancelButton = modal.querySelector("#clockify-cancel");

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

  cancelButton.addEventListener("click", closeModal);
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
  }

  document.addEventListener("keydown", handleKeydown);

  function setError(message) {
    errorEl.textContent = message || "";
  }

  function setSelectValue(selectEl, value) {
    if (!value) {
      return;
    }
    const match = Array.from(selectEl.options).find((opt) => opt.value === value);
    if (match) {
      selectEl.value = value;
    }
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
    renderSelectOptions(projectSelect, [], true);
    renderSelectOptions(taskSelect, [], true);
    if (!workspaceId) {
      return;
    }
    const response = await sendMessage({ type: "FETCH_PROJECTS", workspaceId });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Failed to load projects.");
    }
    applySearchFilter.projects = response.data;
    renderSelectOptions(projectSelect, response.data, true);
  }

  async function loadTags(workspaceId) {
    applySearchFilter.tags = [];
    renderSelectOptions(tagsSelect, [], false);
    if (!workspaceId) {
      return;
    }
    const response = await sendMessage({ type: "FETCH_TAGS", workspaceId });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Failed to load tags.");
    }
    applySearchFilter.tags = response.data;
    renderSelectOptions(tagsSelect, response.data, false);
  }

  async function loadTasks(workspaceId, projectId) {
    applySearchFilter.tasks = [];
    renderSelectOptions(taskSelect, [], true);
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
    renderSelectOptions(taskSelect, response.data, true);
  }

  workspaceSelect.addEventListener("change", async () => {
    setError("");
    try {
      await loadProjects(workspaceSelect.value);
      await loadTags(workspaceSelect.value);
      if (savedSelection) {
        setSelectValue(projectSelect, savedSelection.projectId);
        await loadTasks(workspaceSelect.value, projectSelect.value);
        setSelectValue(taskSelect, savedSelection.taskId);
        if (Array.isArray(savedSelection.tagIds)) {
          Array.from(tagsSelect.options).forEach((opt) => {
            opt.selected = savedSelection.tagIds.includes(opt.value);
          });
        }
      } else {
        selectTagsByLabels(tagsSelect, context.labels);
      }
    } catch (error) {
      setError(error.message);
    }
  });

  projectSelect.addEventListener("change", async () => {
    setError("");
    try {
      await loadTasks(workspaceSelect.value, projectSelect.value);
    } catch (error) {
      setError(error.message);
    }
  });

  projectSearch.addEventListener("input", () => applySearchFilter(projectSearch, projectSelect));
  taskSearch.addEventListener("input", () => applySearchFilter(taskSearch, taskSelect));
  tagsSearch.addEventListener("input", () => applySearchFilter(tagsSearch, tagsSelect));

  startButton.addEventListener("click", async () => {
    setError("");
    startButton.textContent = "Starting...";
    startButton.disabled = true;

    const selectedTagIds = Array.from(tagsSelect.selectedOptions).map((opt) => opt.value);
    const selection = {
      workspaceId: workspaceSelect.value,
      projectId: projectSelect.value,
      taskId: taskSelect.value,
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
      setSelectValue(workspaceSelect, savedSelection.workspaceId);
    }
    if (!workspaceSelect.value && workspaceSelect.options.length === 1) {
      workspaceSelect.selectedIndex = 0;
    }
    if (workspaceSelect.value) {
      await loadProjects(workspaceSelect.value);
      await loadTags(workspaceSelect.value);
      if (savedSelection) {
        setSelectValue(projectSelect, savedSelection.projectId);
        await loadTasks(workspaceSelect.value, projectSelect.value);
        setSelectValue(taskSelect, savedSelection.taskId);
        if (Array.isArray(savedSelection.tagIds)) {
          Array.from(tagsSelect.options).forEach((opt) => {
            opt.selected = savedSelection.tagIds.includes(opt.value);
          });
        }
      } else {
        selectTagsByLabels(tagsSelect, context.labels);
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





