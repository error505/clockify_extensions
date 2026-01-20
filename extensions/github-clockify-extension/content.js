function getIssueContext() {
  const pathParts = location.pathname.split("/").filter(Boolean);
  const owner = pathParts[0] || "";
  const repo = pathParts[1] || "";
  const number = pathParts[3] || "";
  const titleNode =
    document.querySelector("[data-testid='issue-title']") ||
    document.querySelector("h1 span[data-component='issue-title']") ||
    document.querySelector("h1 span.js-issue-title") ||
    document.querySelector("h1 .js-issue-title");
  const title = titleNode ? titleNode.textContent.trim() : document.title;
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

  button.addEventListener("click", () => {
    openClockifyModal(getIssueContext());
  });

  bar.appendChild(button);

  if (headerActions) {
    container.appendChild(bar);
  } else if (headerTitle && headerTitle.parentElement) {
    headerTitle.parentElement.appendChild(bar);
  } else if (container.matches("[data-testid='issue-viewer-issue-container']")) {
    container.prepend(bar);
  } else {
    container.appendChild(bar);
  }
}

function init() {
  document.documentElement.setAttribute("data-clockify-extension", "loaded");
  insertButton();
  const observer = new MutationObserver(() => insertButton());
  observer.observe(document.body, { childList: true, subtree: true });

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
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function buildOption(value, label) {
  const option = document.createElement("option");
  option.value = value || "";
  option.textContent = label || "Unspecified";
  return option;
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
          <select id="clockify-project">
            <option value="">No project</option>
          </select>
        </div>
        <div>
          <label for="clockify-task">Task</label>
          <select id="clockify-task">
            <option value="">No task</option>
          </select>
        </div>
      </div>
      <div>
        <label for="clockify-tags">Tags</label>
        <select id="clockify-tags" multiple size="4"></select>
      </div>
      <div>
        <label for="clockify-description">Description</label>
        <textarea id="clockify-description"></textarea>
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
  const descriptionField = modal.querySelector("#clockify-description");
  const errorEl = modal.querySelector("#clockify-error");
  const startButton = modal.querySelector("#clockify-start");
  const cancelButton = modal.querySelector("#clockify-cancel");

  descriptionField.value = `${context.title} (${context.url})`;

  function closeModal() {
    backdrop.remove();
  }

  cancelButton.addEventListener("click", closeModal);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeModal();
    }
  });

  function setError(message) {
    errorEl.textContent = message || "";
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
    projectSelect.innerHTML = "";
    projectSelect.appendChild(buildOption("", "No project"));
    taskSelect.innerHTML = "";
    taskSelect.appendChild(buildOption("", "No task"));
    if (!workspaceId) {
      return;
    }
    const response = await sendMessage({ type: "FETCH_PROJECTS", workspaceId });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Failed to load projects.");
    }
    response.data.forEach((project) => {
      projectSelect.appendChild(buildOption(project.id, project.name));
    });
  }

  async function loadTags(workspaceId) {
    tagsSelect.innerHTML = "";
    if (!workspaceId) {
      return;
    }
    const response = await sendMessage({ type: "FETCH_TAGS", workspaceId });
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Failed to load tags.");
    }
    response.data.forEach((tag) => {
      tagsSelect.appendChild(buildOption(tag.id, tag.name));
    });
  }

  async function loadTasks(workspaceId, projectId) {
    taskSelect.innerHTML = "";
    taskSelect.appendChild(buildOption("", "No task"));
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
    response.data.forEach((task) => {
      taskSelect.appendChild(buildOption(task.id, task.name));
    });
  }

  workspaceSelect.addEventListener("change", async () => {
    setError("");
    try {
      await loadProjects(workspaceSelect.value);
      await loadTags(workspaceSelect.value);
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
      const response = await sendMessage({
        type: "START_TIMER_WITH_SELECTION",
        selection
      });
      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "Failed to start timer.");
      }
      closeModal();
    } catch (error) {
      setError(error.message);
    } finally {
      startButton.textContent = "Start timer";
      startButton.disabled = false;
    }
  });

  try {
    await loadWorkspaces();
    if (workspaceSelect.value) {
      await loadProjects(workspaceSelect.value);
      await loadTags(workspaceSelect.value);
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
