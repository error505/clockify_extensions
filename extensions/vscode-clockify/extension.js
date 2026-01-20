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
    id: item.id
  }));
  if (options && options.emptyLabel) {
    quickPickItems.unshift({ label: options.emptyLabel, description: "", id: "" });
  }
  const selected = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: options && options.placeholder ? options.placeholder : "Select an item",
    ignoreFocusOut: true,
    canPickMany: options && options.canPickMany
  });
  return selected;
}

async function startTimer(context) {
  const apiKey = await getApiKey(context);
  if (!apiKey) {
    vscode.window.showErrorMessage("Clockify API key is required.");
    return;
  }

  const repoContext = await getRepoContext();
  const selections = await getRepoSelections(context);
  const savedSelection = selections[repoContext.repo] || null;

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

  let workspaceId = "";
  if (savedSelection && savedSelection.workspaceId) {
    workspaceId = savedSelection.workspaceId;
  }
  if (!workspaceId) {
    if (workspaces.length === 1) {
      workspaceId = workspaces[0].id;
    } else {
      const selectedWorkspace = await pickFromList(workspaces, {
        placeholder: "Select a workspace"
      });
      if (!selectedWorkspace) {
        return;
      }
      workspaceId = selectedWorkspace.id;
    }
  }

  let projectId = savedSelection ? savedSelection.projectId : "";
  let taskId = savedSelection ? savedSelection.taskId : "";
  let tagIds = savedSelection && Array.isArray(savedSelection.tagIds) ? savedSelection.tagIds : [];

  let projects = [];
  try {
    projects = await fetchProjects(apiKey, workspaceId);
  } catch (error) {
    vscode.window.showErrorMessage(error.message || "Failed to load projects.");
    return;
  }

  const selectedProject = await pickFromList(projects, {
    placeholder: "Select a project (optional)",
    emptyLabel: "No project"
  });
  if (!selectedProject && !projectId) {
    return;
  }
  projectId = selectedProject ? selectedProject.id : projectId;

  let tasks = [];
  if (projectId) {
    try {
      tasks = await fetchTasks(apiKey, workspaceId, projectId);
    } catch (error) {
      vscode.window.showErrorMessage(error.message || "Failed to load tasks.");
      return;
    }
    const selectedTask = await pickFromList(tasks, {
      placeholder: "Select a task (optional)",
      emptyLabel: "No task"
    });
    if (selectedTask) {
      taskId = selectedTask.id;
    }
  } else {
    taskId = "";
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
    }
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

  const body = {
    start: new Date().toISOString(),
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
    await saveRepoSelection(context, repoContext.repo, {
      workspaceId,
      projectId,
      taskId,
      tagIds,
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

function activate(context) {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = "clockify.startTimer";
  context.subscriptions.push(statusBar);

  function updateStatusBar() {
    const entryId = context.globalState.get("clockify.lastTimeEntryId");
    if (entryId) {
      statusBar.text = "$(watch) Clockify: Running";
      statusBar.tooltip = "Stop Clockify timer";
      statusBar.command = "clockify.stopTimer";
    } else {
      statusBar.text = "$(watch) Clockify: Idle";
      statusBar.tooltip = "Start Clockify timer";
      statusBar.command = "clockify.startTimer";
    }
    statusBar.show();
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

  updateStatusBar();
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
