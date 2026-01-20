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

function resolveProjectTask(config, repoName) {
  const repoMappings = config.get("repoMappings", []);
  let projectId = config.get("defaultProjectId", "");
  let taskId = config.get("defaultTaskId", "");
  let tagIds = config.get("defaultTagIds", []);

  if (Array.isArray(repoMappings)) {
    const match = repoMappings.find((item) => item.repo === repoName);
    if (match) {
      projectId = match.projectId || projectId;
      taskId = match.taskId || taskId;
      if (Array.isArray(match.tagIds)) {
        tagIds = match.tagIds;
      }
    }
  }

  return { projectId, taskId, tagIds };
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

async function startTimer(context) {
  const config = vscode.workspace.getConfiguration("clockify");
  const workspaceId = config.get("workspaceId", "");
  if (!workspaceId) {
    vscode.window.showErrorMessage("Clockify workspace id is required.");
    return;
  }

  const apiKey = await getApiKey(context);
  if (!apiKey) {
    vscode.window.showErrorMessage("Clockify API key is required.");
    return;
  }

  const repoContext = await getRepoContext();
  const match = resolveProjectTask(config, repoContext.repo);
  const descriptionParts = [repoContext.repo, repoContext.branch].filter(Boolean);
  const description = descriptionParts.length
    ? `Working on ${descriptionParts.join(" ")}`
    : "Working in VS Code";

  const body = {
    start: new Date().toISOString(),
    description
  };
  if (match.projectId) {
    body.projectId = match.projectId;
  }
  if (match.taskId) {
    body.taskId = match.taskId;
  }
  if (Array.isArray(match.tagIds) && match.tagIds.length) {
    body.tagIds = match.tagIds;
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
  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.startTimer", () => startTimer(context))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.stopTimer", () => stopTimer(context))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.setApiKey", () => setApiKey(context))
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
