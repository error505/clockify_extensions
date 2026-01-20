const vscode = require("vscode");
const https = require("https");
const { exec } = require("child_process");

const API_BASE = "https://api.clockify.me/api/v1";

function execPromise(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function parseRepoFromRemote(remoteUrl) {
  if (!remoteUrl) {
    return "";
  }
  const cleaned = remoteUrl.replace(/\.git$/, "");
  const sshMatch = cleaned.match(/github.com[:/](.+\/[^/]+)$/i);
  return sshMatch ? sshMatch[1] : "";
}

async function getRepoContext() {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!folder) {
    return { repo: "", branch: "" };
  }

  try {
    const cwd = folder.uri.fsPath;
    const branch = await execPromise("git rev-parse --abbrev-ref HEAD", cwd);
    const remote = await execPromise("git config --get remote.origin.url", cwd);
    const repo = parseRepoFromRemote(remote);
    return { repo, branch };
  } catch (error) {
    return { repo: "", branch: "" };
  }
}

function clockifyRequest(apiKey, method, path, body) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey
    }
  };

  return new Promise((resolve, reject) => {
    const request = https.request(`${API_BASE}${path}`, options, (response) => {
      let data = "";
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Clockify error ${response.statusCode}: ${data}`));
          return;
        }
        resolve(data ? JSON.parse(data) : {});
      });
    });

    request.on("error", (error) => reject(error));
    if (body) {
      request.write(JSON.stringify(body));
    }
    request.end();
  });
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

function fetchWorkspaces(apiKey) {
  return clockifyRequest(apiKey, "GET", "/workspaces");
}

function fetchProjects(apiKey, workspaceId) {
  return clockifyRequest(apiKey, "GET", `/workspaces/${workspaceId}/projects`);
}

function fetchTasks(apiKey, workspaceId, projectId) {
  return clockifyRequest(apiKey, "GET", `/workspaces/${workspaceId}/projects/${projectId}/tasks`);
}

function fetchTags(apiKey, workspaceId) {
  return clockifyRequest(apiKey, "GET", `/workspaces/${workspaceId}/tags`);
}

async function getApiKey(context) {
  let apiKey = await context.secrets.get("clockify.apiKey");
  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      prompt: "Enter Clockify API key",
      password: true,
      ignoreFocusOut: true
    });
    if (apiKey) {
      await context.secrets.store("clockify.apiKey", apiKey);
    }
  }
  return apiKey;
}

async function getRepoSelections(context) {
  const raw = context.globalState.get("clockify.repoSelections", "{}");
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

async function saveRepoSelection(context, repo, selection) {
  if (!repo) {
    return;
  }
  const selections = await getRepoSelections(context);
  selections[repo] = selection;
  await context.globalState.update("clockify.repoSelections", JSON.stringify(selections));
}

async function pickFromList(items, options) {
  const quickPickItems = items.map((item) => ({
    label: item.name,
    description: item.description || "",
    id: item.id,
    name: item.name
  }));
  if (options && options.emptyLabel) {
    quickPickItems.unshift({ label: options.emptyLabel, description: "", id: "", name: "" });
  }
  const selected = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: options && options.placeholder ? options.placeholder : "Select an item",
    ignoreFocusOut: true,
    canPickMany: options && options.canPickMany
  });
  return selected;
}

function findNameById(items, id) {
  const match = items.find((item) => item.id === id);
  return match ? match.name : "";
}

async function startTimer(context) {
  const config = vscode.workspace.getConfiguration("clockify");
  const quickStart = config.get("quickStartWithLastSelection", false);
  const skipPickIfSingle = config.get("skipPickIfSingle", true);
  const defaultWorkspaceId =
    config.get("defaultWorkspaceId", "") || config.get("workspaceId", "");
  const defaultProjectId = config.get("defaultProjectId", "");
  const defaultTaskId = config.get("defaultTaskId", "");
  const defaultTagIds = config.get("defaultTagIds", []);

  const apiKey = await getApiKey(context);
  if (!apiKey) {
    vscode.window.showErrorMessage("Clockify API key is required.");
    return;
  }

  const repoContext = await getRepoContext();
  const selections = await getRepoSelections(context);
  const savedSelection = selections[repoContext.repo] || null;

  if (quickStart && savedSelection && savedSelection.workspaceId) {
    try {
      const startIso = new Date().toISOString();
      const entry = await clockifyRequest(
        apiKey,
        "POST",
        `/workspaces/${savedSelection.workspaceId}/time-entries`,
        {
          start: startIso,
          description: savedSelection.description || `Working on ${repoContext.repo}`,
          projectId: savedSelection.projectId || undefined,
          taskId: savedSelection.taskId || undefined,
          tagIds: Array.isArray(savedSelection.tagIds) ? savedSelection.tagIds : undefined
        }
      );
      await context.globalState.update("clockify.lastTimeEntryId", entry.id || "running");
      await context.globalState.update("clockify.lastWorkspaceId", savedSelection.workspaceId);
      await context.globalState.update("clockify.lastTimeEntryStart", startIso);
      vscode.window.showInformationMessage("Clockify timer started.");
    } catch (error) {
      vscode.window.showErrorMessage(error.message || "Clockify start failed.");
    }
    return;
  }

  let workspaces;
  try {
    workspaces = await fetchWorkspaces(apiKey);
  } catch (error) {
    vscode.window.showErrorMessage(error.message || "Failed to load workspaces.");
    return;
  }
  if (!workspaces.length) {
    vscode.window.showErrorMessage("No Clockify workspaces found.");
    return;
  }

  let workspaceId = defaultWorkspaceId;
  let workspaceName = "";
  if (savedSelection && savedSelection.workspaceId) {
    workspaceId = savedSelection.workspaceId;
    workspaceName = savedSelection.workspaceName || "";
  }
  if (!workspaceId) {
    if (workspaces.length === 1 && skipPickIfSingle) {
      workspaceId = workspaces[0].id;
    } else {
      const selectedWorkspace = await pickFromList(workspaces, {
        placeholder: "Select a workspace"
      });
      if (!selectedWorkspace) {
        return;
      }
      workspaceId = selectedWorkspace.id;
      workspaceName = selectedWorkspace.name || selectedWorkspace.label || "";
    }
  }
  if (!workspaceName) {
    workspaceName = findNameById(workspaces, workspaceId);
  }

  let projectId = savedSelection ? savedSelection.projectId : defaultProjectId;
  let taskId = savedSelection ? savedSelection.taskId : defaultTaskId;
  let tagIds = savedSelection && Array.isArray(savedSelection.tagIds)
    ? savedSelection.tagIds
    : defaultTagIds;
  let projectName = savedSelection ? savedSelection.projectName || "" : "";
  let taskName = savedSelection ? savedSelection.taskName || "" : "";
  let tagNames = savedSelection && Array.isArray(savedSelection.tagNames)
    ? savedSelection.tagNames
    : [];

  let projects = [];
  try {
    projects = await fetchProjects(apiKey, workspaceId);
  } catch (error) {
    vscode.window.showErrorMessage(error.message || "Failed to load projects.");
    return;
  }

  if (projects.length) {
    const selectedProject = await pickFromList(projects, {
      placeholder: "Select a project (optional)",
      emptyLabel: "No project"
    });
    if (!selectedProject && !projectId) {
      return;
    }
    projectId = selectedProject ? selectedProject.id : projectId;
    projectName = selectedProject ? selectedProject.name || "" : projectName;
  }
  if (projectId && !projectName) {
    projectName = findNameById(projects, projectId);
  }

  if (projectId) {
    let tasks = [];
    try {
      tasks = await fetchTasks(apiKey, workspaceId, projectId);
    } catch (error) {
      vscode.window.showErrorMessage(error.message || "Failed to load tasks.");
      return;
    }
    if (tasks.length) {
      const selectedTask = await pickFromList(tasks, {
        placeholder: "Select a task (optional)",
        emptyLabel: "No task"
      });
      if (selectedTask) {
        taskId = selectedTask.id;
        taskName = selectedTask.name || "";
      }
    }
  } else {
    taskId = "";
    taskName = "";
  }
  if (taskId && !taskName) {
    taskName = findNameById(tasks, taskId);
  }

  let tags = [];
  try {
    tags = await fetchTags(apiKey, workspaceId);
  } catch (error) {
    vscode.window.showErrorMessage(error.message || "Failed to load tags.");
    return;
  }
  if (tags.length) {
    const selectedTags = await pickFromList(tags, {
      placeholder: "Select tags (optional)",
      canPickMany: true
    });
    if (Array.isArray(selectedTags)) {
      tagIds = selectedTags.map((tag) => tag.id);
      tagNames = selectedTags.map((tag) => tag.name || tag.label || "").filter(Boolean);
    }
  }
  if (tagIds.length && !tagNames.length) {
    tagNames = tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name);
  }

  const descriptionParts = [repoContext.repo, repoContext.branch].filter(Boolean);
  const defaultDescription = descriptionParts.length
    ? `Working on ${descriptionParts.join(" ")}`
    : "Working in VS Code";
  const description =
    (await vscode.window.showInputBox({
      prompt: "Time entry description",
      value: defaultDescription,
      ignoreFocusOut: true
    })) || defaultDescription;

  const startIso = new Date().toISOString();
  const body = {
    start: startIso,
    description
  };
  if (projectId) {
    body.projectId = projectId;
  }
  if (taskId) {
    body.taskId = taskId;
  }
  if (Array.isArray(tagIds) && tagIds.length) {
    body.tagIds = tagIds;
  }

  try {
    const entry = await clockifyRequest(
      apiKey,
      "POST",
      `/workspaces/${workspaceId}/time-entries`,
      body
    );
    await context.globalState.update("clockify.lastTimeEntryId", entry.id);
    await context.globalState.update("clockify.lastWorkspaceId", workspaceId);
    await context.globalState.update("clockify.lastTimeEntryStart", startIso);
    await saveRepoSelection(context, repoContext.repo, {
      workspaceId,
      workspaceName,
      projectId,
      projectName,
      taskId,
      taskName,
      tagIds,
      tagNames,
      description
    });
    vscode.window.showInformationMessage("Clockify timer started.");
  } catch (error) {
    vscode.window.showErrorMessage(error.message || "Clockify start failed.");
  }
}

async function stopTimer(context) {
  const config = vscode.workspace.getConfiguration("clockify");
  const apiKey = await getApiKey(context);
  if (!apiKey) {
    vscode.window.showErrorMessage("Clockify API key is required.");
    return;
  }

  const workspaceId =
    (await context.globalState.get("clockify.lastWorkspaceId")) ||
    config.get("workspaceId", "");
  const entryId = await context.globalState.get("clockify.lastTimeEntryId");
  if (!workspaceId || !entryId) {
    vscode.window.showErrorMessage("No running timer recorded.");
    return;
  }

  try {
    await clockifyRequest(
      apiKey,
      "PATCH",
      `/workspaces/${workspaceId}/time-entries/${entryId}`,
      { end: new Date().toISOString() }
    );
    await context.globalState.update("clockify.lastTimeEntryId", "");
    await context.globalState.update("clockify.lastTimeEntryStart", "");
    vscode.window.showInformationMessage("Clockify timer stopped.");
  } catch (error) {
    vscode.window.showErrorMessage(error.message || "Clockify stop failed.");
  }
}

async function setApiKey(context) {
  const apiKey = await vscode.window.showInputBox({
    prompt: "Enter Clockify API key",
    password: true,
    ignoreFocusOut: true
  });
  if (apiKey) {
    await context.secrets.store("clockify.apiKey", apiKey);
    vscode.window.showInformationMessage("Clockify API key saved.");
  }
}

async function buildSidebarState(context) {
  const repoContext = await getRepoContext();
  const selections = await getRepoSelections(context);
  const selection = repoContext.repo ? selections[repoContext.repo] : null;
  const entryId = context.globalState.get("clockify.lastTimeEntryId");
  const entryStart = context.globalState.get("clockify.lastTimeEntryStart");
  const elapsed = entryId ? formatElapsed(entryStart) : "";

  return {
    running: Boolean(entryId),
    elapsed,
    repo: repoContext.repo,
    branch: repoContext.branch,
    workspace: selection ? selection.workspaceName || "" : "",
    project: selection ? selection.projectName || "" : "",
    task: selection ? selection.taskName || "" : "",
    tags: selection && Array.isArray(selection.tagNames) ? selection.tagNames : [],
    description: selection ? selection.description || "" : ""
  };
}

function getWebviewHtml() {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Clockify</title>
        <style>
          :root {
            color-scheme: light;
          }
          body {
            font-family: Segoe UI, Arial, sans-serif;
            margin: 0;
            padding: 12px;
            color: #24292f;
          }
          .card {
            border: 1px solid #d0d7de;
            border-radius: 10px;
            padding: 12px;
            background: #ffffff;
          }
          .title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 6px;
          }
          .muted {
            font-size: 12px;
            color: #57606a;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin-top: 8px;
            font-size: 12px;
          }
          .pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 2px 8px;
            border-radius: 999px;
            border: 1px solid #d0d7de;
            background: #f6f8fa;
            font-size: 12px;
          }
          .actions {
            display: grid;
            gap: 8px;
            margin-top: 12px;
          }
          button {
            border: 1px solid #d0d7de;
            border-radius: 6px;
            background: #f6f8fa;
            padding: 6px 10px;
            font-weight: 600;
            cursor: pointer;
          }
          button.primary {
            background: #1f6feb;
            border-color: #1f6feb;
            color: #ffffff;
          }
          ul {
            margin: 6px 0 0;
            padding-left: 16px;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">Clockify</div>
          <div class="muted" id="repo">No repo detected</div>
          <div class="row">
            <span class="pill" id="status">Idle</span>
            <span class="pill" id="elapsed">00:00</span>
          </div>
          <div class="row">
            <div>
              <div class="muted">Workspace</div>
              <div id="workspace">—</div>
            </div>
            <div>
              <div class="muted">Project</div>
              <div id="project">—</div>
            </div>
          </div>
          <div class="row">
            <div>
              <div class="muted">Task</div>
              <div id="task">—</div>
            </div>
            <div>
              <div class="muted">Tags</div>
              <ul id="tags"></ul>
            </div>
          </div>
          <div class="row">
            <div>
              <div class="muted">Description</div>
              <div id="description">—</div>
            </div>
          </div>
          <div class="actions">
            <button class="primary" id="start">Start timer</button>
            <button id="stop">Stop timer</button>
            <button id="settings">Open settings</button>
            <button id="apiKey">Set API key</button>
          </div>
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          const startButton = document.getElementById("start");
          const stopButton = document.getElementById("stop");
          const settingsButton = document.getElementById("settings");
          const apiKeyButton = document.getElementById("apiKey");

          function setText(id, value) {
            document.getElementById(id).textContent = value || "—";
          }

          function setTags(tags) {
            const list = document.getElementById("tags");
            list.innerHTML = "";
            if (!tags || !tags.length) {
              const item = document.createElement("li");
              item.textContent = "—";
              list.appendChild(item);
              return;
            }
            tags.forEach((tag) => {
              const item = document.createElement("li");
              item.textContent = tag;
              list.appendChild(item);
            });
          }

          startButton.addEventListener("click", () => vscode.postMessage({ type: "start" }));
          stopButton.addEventListener("click", () => vscode.postMessage({ type: "stop" }));
          settingsButton.addEventListener("click", () => vscode.postMessage({ type: "settings" }));
          apiKeyButton.addEventListener("click", () => vscode.postMessage({ type: "apiKey" }));

          window.addEventListener("message", (event) => {
            const state = event.data;
            if (!state || state.type !== "state") return;
            setText("repo", state.repo ? \`\${state.repo} \${state.branch ? "• " + state.branch : ""}\` : "No repo detected");
            setText("workspace", state.workspace);
            setText("project", state.project);
            setText("task", state.task);
            setTags(state.tags);
            setText("description", state.description);
            document.getElementById("status").textContent = state.running ? "Running" : "Idle";
            document.getElementById("elapsed").textContent = state.running ? state.elapsed : "00:00";
            stopButton.disabled = !state.running;
          });

          vscode.postMessage({ type: "ready" });
        </script>
      </body>
    </html>
  `;
}

function activate(context) {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = "clockify.startTimer";
  context.subscriptions.push(statusBar);
  let statusInterval = null;
  let sidebarView = null;

  const viewProvider = {
    resolveWebviewView(view) {
      sidebarView = view;
      view.webview.options = { enableScripts: true };
      view.webview.html = getWebviewHtml();

      view.webview.onDidReceiveMessage(async (message) => {
        if (!message || !message.type) {
          return;
        }
        if (message.type === "start") {
          await startTimer(context);
        } else if (message.type === "stop") {
          await stopTimer(context);
        } else if (message.type === "settings") {
          await vscode.commands.executeCommand("workbench.action.openSettings", "clockify");
        } else if (message.type === "apiKey") {
          await setApiKey(context);
        }
        updateStatusBar();
        updateSidebar();
      });

      updateSidebar();
    }
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("clockifyView", viewProvider)
  );

  async function updateSidebar() {
    if (!sidebarView) {
      return;
    }
    const state = await buildSidebarState(context);
    sidebarView.webview.postMessage({ type: "state", ...state });
  }

  function updateStatusBar() {
    const entryId = context.globalState.get("clockify.lastTimeEntryId");
    const entryStart = context.globalState.get("clockify.lastTimeEntryStart");
    if (entryId) {
      const elapsed = formatElapsed(entryStart);
      statusBar.text = `$(watch) Clockify: ${elapsed}`;
      statusBar.tooltip = "Stop Clockify timer";
      statusBar.command = "clockify.stopTimer";
      if (!statusInterval) {
        statusInterval = setInterval(updateStatusBar, 1000);
      }
    } else {
      statusBar.text = "$(watch) Clockify: Idle";
      statusBar.tooltip = "Start Clockify timer";
      statusBar.command = "clockify.startTimer";
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }
    }
    statusBar.show();
    updateSidebar();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.startTimer", async () => {
      await startTimer(context);
      updateStatusBar();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.stopTimer", async () => {
      await stopTimer(context);
      updateStatusBar();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.setApiKey", () => setApiKey(context))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.openSettings", () =>
      vscode.commands.executeCommand("workbench.action.openSettings", "clockify")
    )
  );

  updateStatusBar();
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
