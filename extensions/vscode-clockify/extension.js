const vscode = require("vscode");
const https = require("https");
const { exec } = require("child_process");

const API_BASE = "https://api.clockify.me/api/v1";

// Simple cache for API responses with TTL
const apiCache = new Map();
function getCacheKey(apiKey, path) {
  return `${apiKey}:${path}`;
}
function getFromCache(apiKey, path) {
  const key = getCacheKey(apiKey, path);
  const cached = apiCache.get(key);
  if (cached && cached.expires > Date.now()) {
    console.log("[CACHE] Hit for:", path);
    return cached.data;
  }
  if (cached) apiCache.delete(key);
  return null;
}
function setCache(apiKey, path, data, ttlMs = 3000) {
  const key = getCacheKey(apiKey, path);
  apiCache.set(key, { data, expires: Date.now() + ttlMs });
  console.log("[CACHE] Set for:", path, "TTL:", ttlMs);
}

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

// Parse ISO 8601 duration format (e.g., PT8H, PT3M, PT30S, PT1H30M)
function parseIsoDuration(durationStr) {
  if (!durationStr) return 0;
  
  // If it's already a number, return it as milliseconds
  if (typeof durationStr === 'number') {
    return durationStr;
  }
  
  // Handle ISO 8601 duration format: PT[n]H[n]M[n]S
  const iso8601Regex = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
  const match = durationStr.match(iso8601Regex);
  
  if (!match) {
    console.warn("[DURATION-PARSE] Could not parse ISO 8601 duration:", durationStr);
    return 0;
  }
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const totalMilliseconds = totalSeconds * 1000;
  
  console.log("[DURATION-PARSE] ISO 8601 duration:", durationStr, "->", totalSeconds, "seconds ->", totalMilliseconds, "ms");
  return totalMilliseconds;
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
        console.log(`[API] ${method} ${path} - Status: ${response.statusCode}, Response length: ${data.length}`);
        if (data) {
          console.log(`[API] Response data: ${data.substring(0, 500)}`);
        }
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

function formatDuration(durationMs) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getDateRangeIso(daysBack = 0) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack);
  const endOfDay = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), startOfDay.getDate() + 1);
  return {
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString()
  };
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString();
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

async function fetchCurrentUser(apiKey) {
  return clockifyRequest(apiKey, "GET", "/user");
}

async function getWorkspaceId(context, apiKey, user) {
  let workspaceId = context.globalState.get("clockify.workspaceId");
  if (workspaceId) return workspaceId;
  
  try {
    const workspaces = await fetchWorkspaces(apiKey);
    if (Array.isArray(workspaces) && workspaces.length > 0) {
      workspaceId = workspaces[0].id;
      await context.globalState.update("clockify.workspaceId", workspaceId);
      return workspaceId;
    }
  } catch (error) {
    console.error("Error fetching workspaces:", error);
  }
  return null;
}

function fetchUserTimeEntries(apiKey, workspaceId, userId, startDate, endDate, inProgressOnly = false) {
  const params = new URLSearchParams();
  if (startDate) params.append("start", startDate);
  if (endDate) params.append("end", endDate);
  if (inProgressOnly) params.append("in-progress", "true");
  params.append("page-size", "50");
  const queryString = params.toString();
  const path = `/workspaces/${workspaceId}/user/${userId}/time-entries${queryString ? "?" + queryString : ""}`;
  return clockifyRequest(apiKey, "GET", path);
}

async function fetchRecentEntries(apiKey, workspaceId, userId) {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    const entries = await fetchUserTimeEntries(apiKey, workspaceId, userId, startDate.toISOString(), endDate.toISOString());
    if (!Array.isArray(entries)) return [];
    // Sort by most recent first, limit to 5
    return entries
      .sort((a, b) => new Date(b.timeInterval.start) - new Date(a.timeInterval.start))
      .slice(0, 5)
      .map(entry => ({
        id: entry.id,
        description: entry.description || "No description",
        projectId: entry.projectId,
        taskId: entry.taskId,
        duration: entry.timeInterval.duration || 0,
        date: new Date(entry.timeInterval.start).toLocaleDateString()
      }));
  } catch (error) {
    console.error("Error fetching recent entries:", error);
    return [];
  }
}

async function calculateTodaysTotal(apiKey, workspaceId, userId) {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const startIso = startOfDay.toISOString();
    const endIso = endOfDay.toISOString();
    console.log("[TODAY-TOTAL] Fetching entries for", userId, "from", startIso, "to", endIso);
    
    const entries = await fetchUserTimeEntries(apiKey, workspaceId, userId, startIso, endIso);
    console.log("[TODAY-TOTAL] Received entries:", entries ? entries.length : "null", "entries");
    
    if (!Array.isArray(entries)) {
      console.log("[TODAY-TOTAL] ERROR: Response is not an array, type:", typeof entries, "value:", entries);
      return 0;
    }
    
    if (entries.length === 0) {
      console.log("[TODAY-TOTAL] No entries found for today");
      return 0;
    }
    
    let totalSeconds = 0;
    entries.forEach((entry, idx) => {
      // duration is in ISO 8601 format (e.g., "PT8H", "PT3M")
      const duration = entry.timeInterval?.duration || 0;
      const durationMs = parseIsoDuration(duration);
      const seconds = Math.floor(durationMs / 1000); // Convert ms to seconds
      console.log("[TODAY-TOTAL] Entry", idx, ":", duration, "->", durationMs, "ms =", seconds, "seconds");
      totalSeconds += seconds || 0;
    });
    
    const hours = Math.round(totalSeconds / 3600 * 100) / 100;
    console.log("[TODAY-TOTAL] Total: ", totalSeconds, "seconds =", hours, "hours");
    return hours;
  } catch (error) {
    console.error("[TODAY-TOTAL] Error:", error);
    return 0;
  }
}

function getTemplates(context) {
  const raw = context.globalState.get("clockify.templates", "[]");
  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

async function saveTemplate(context, name, template) {
  const templates = getTemplates(context);
  const index = templates.findIndex(t => t.name === name);
  if (index >= 0) {
    templates[index] = { name, ...template };
  } else {
    templates.push({ name, ...template });
  }
  await context.globalState.update("clockify.templates", JSON.stringify(templates));
}

async function deleteTemplate(context, name) {
  const templates = getTemplates(context);
  const filtered = templates.filter(t => t.name !== name);
  await context.globalState.update("clockify.templates", JSON.stringify(filtered));
}

function getDailyGoal(context) {
  return context.globalState.get("clockify.dailyGoal", 8); // Default 8 hours
}

async function setDailyGoal(context, hours) {
  await context.globalState.update("clockify.dailyGoal", hours);
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

async function startTimer(context, overrideDescription) {
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

  if (quickStart && savedSelection && savedSelection.workspaceId && !overrideDescription) {
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
      await context.globalState.update("clockify.lastTimeEntryUserId", entry.userId || "");
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
  const description = overrideDescription
    ? overrideDescription
    : (await vscode.window.showInputBox({
        prompt: "Time entry description",
        value: savedSelection && savedSelection.description ? savedSelection.description : defaultDescription,
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
    await context.globalState.update("clockify.lastTimeEntryUserId", entry.userId || "");
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
  const userId = await context.globalState.get("clockify.lastTimeEntryUserId");
  if (!workspaceId || !userId) {
    vscode.window.showErrorMessage("No running timer recorded.");
    return;
  }

  const endIso = new Date().toISOString();

  try {
    // Use the proper endpoint for stopping the timer: PATCH /user/{userId}/time-entries
    await clockifyRequest(
      apiKey,
      "PATCH",
      `/workspaces/${workspaceId}/user/${userId}/time-entries`,
      { end: endIso }
    );
    await context.globalState.update("clockify.lastTimeEntryId", "");
    await context.globalState.update("clockify.lastTimeEntryUserId", "");
    await context.globalState.update("clockify.lastTimeEntryStart", "");
    vscode.window.showInformationMessage("Clockify timer stopped.");
  } catch (error) {
    // Handle 404 - timer already stopped in Clockify
    if (error.message && error.message.includes("404")) {
      await context.globalState.update("clockify.lastTimeEntryId", "");
      await context.globalState.update("clockify.lastTimeEntryUserId", "");
      await context.globalState.update("clockify.lastTimeEntryStart", "");
      vscode.window.showInformationMessage("Timer was already stopped in Clockify. Cleared local state.");
    } else {
      vscode.window.showErrorMessage(error.message || "Clockify stop failed.");
    }
  }
}

async function showDailySummary(context) {
  const apiKey = await getApiKey(context);
  if (!apiKey) {
    vscode.window.showErrorMessage("Clockify API key is required.");
    return;
  }

  try {
    const user = await fetchCurrentUser(apiKey);
    const workspaceId = user.activeWorkspace;
    const userId = user.id;

    // Fetch today's entries
    const todayRange = getDateRangeIso(0);
    const todayEntries = await fetchUserTimeEntries(apiKey, workspaceId, userId, todayRange.start, todayRange.end);
    
    // Fetch this week's entries
    const weekStart = getWeekStart();
    const now = new Date().toISOString();
    const weekEntries = await fetchUserTimeEntries(apiKey, workspaceId, userId, weekStart, now);
    console.log("[SUMMARY] Fetched", todayEntries, "today entries and", weekEntries, "week entries");
    // Calculate totals
    const calculateTotal = (entries) => {
      return entries.reduce((sum, entry) => {
        if (entry.timeInterval && entry.timeInterval.duration) {
          return sum + entry.timeInterval.duration;
        }
        return sum;
      }, 0);
    };

    const todayMs = calculateTotal(todayEntries);
    const weekMs = calculateTotal(weekEntries);

    // Group by project
    const byProject = {};
    todayEntries.forEach((entry) => {
      const projectName = entry.projectId ? `Project ${entry.projectId.substring(0, 8)}` : "No Project";
      const duration = entry.timeInterval?.duration || 0;
      byProject[projectName] = (byProject[projectName] || 0) + duration;
    });

    let summary = `📊 Today: ${formatDuration(todayMs)} | Week: ${formatDuration(weekMs)}\n\n`;
    summary += "By Project:\n";
    Object.entries(byProject)
      .sort((a, b) => b[1] - a[1])
      .forEach(([project, duration]) => {
        summary += `  • ${project}: ${formatDuration(duration)}\n`;
      });

    vscode.window.showInformationMessage(summary);
  } catch (error) {
    vscode.window.showErrorMessage(error.message || "Failed to load summary.");
  }
}

async function showTimeEntryHistory(context) {
  const apiKey = await getApiKey(context);
  if (!apiKey) {
    vscode.window.showErrorMessage("Clockify API key is required.");
    return;
  }

  try {
    const user = await fetchCurrentUser(apiKey);
    const workspaceId = user.activeWorkspace;
    const userId = user.id;

    // Fetch recent entries (last 7 days)
    const lastWeekStart = new Date();
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const entries = await fetchUserTimeEntries(apiKey, workspaceId, userId, lastWeekStart.toISOString(), new Date().toISOString());

    if (!entries || entries.length === 0) {
      vscode.window.showInformationMessage("No recent time entries found.");
      return;
    }

    const quickPickItems = entries.map((entry) => ({
      label: entry.description || "(No description)",
      description: `${formatDuration(entry.timeInterval?.duration || 0)} • ${new Date(entry.timeInterval?.start).toLocaleDateString()}`,
      entry
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "Select a time entry to resume",
      matchOnDescription: true
    });

    if (!selected) return;

    const resume = await vscode.window.showQuickPick(["Resume", "View Details"], {
      placeHolder: "What would you like to do?"
    });

    if (resume === "Resume") {
      await startTimerFromEntry(context, selected.entry);
    } else if (resume === "View Details") {
      const entry = selected.entry;
      let details = `Description: ${entry.description || "(None)"}\n`;
      if (entry.projectId) details += `Project: ${entry.projectId}\n`;
      if (entry.taskId) details += `Task: ${entry.taskId}\n`;
      if (entry.tagIds?.length) details += `Tags: ${entry.tagIds.join(", ")}\n`;
      details += `Duration: ${formatDuration(entry.timeInterval?.duration || 0)}\n`;
      details += `Date: ${new Date(entry.timeInterval?.start).toLocaleString()}`;
      vscode.window.showInformationMessage(details);
    }
  } catch (error) {
    vscode.window.showErrorMessage(error.message || "Failed to load history.");
  }
}

async function startTimerFromEntry(context, entry) {
  const config = vscode.workspace.getConfiguration("clockify");
  const apiKey = await getApiKey(context);
  if (!apiKey) {
    vscode.window.showErrorMessage("Clockify API key is required.");
    return;
  }

  const user = await fetchCurrentUser(apiKey);
  const workspaceId = user.activeWorkspace;

  const startIso = new Date().toISOString();
  const body = {
    start: startIso,
    description: entry.description || "Resumed from history"
  };
  if (entry.projectId) body.projectId = entry.projectId;
  if (entry.taskId) body.taskId = entry.taskId;
  if (entry.tagIds?.length) body.tagIds = entry.tagIds;

  try {
    const newEntry = await clockifyRequest(apiKey, "POST", `/workspaces/${workspaceId}/time-entries`, body);
    await context.globalState.update("clockify.lastTimeEntryId", newEntry.id);
    await context.globalState.update("clockify.lastWorkspaceId", workspaceId);
    await context.globalState.update("clockify.lastTimeEntryUserId", newEntry.userId || "");
    await context.globalState.update("clockify.lastTimeEntryStart", startIso);
    vscode.window.showInformationMessage("Timer resumed from history.");
  } catch (error) {
    vscode.window.showErrorMessage(error.message || "Failed to resume timer.");
  }
}

function exportToCSV(entries, fileName = "timesheet.csv") {
  if (!Array.isArray(entries) || entries.length === 0) {
    return "";
  }
  const headers = ["Date", "Description", "Project", "Duration (hours)", "Tags"];
  const rows = entries.map(e => [
    new Date(e.timeInterval?.start).toLocaleDateString(),
    e.description || "(no description)",
    e.projectId || "(no project)",
    ((parseIsoDuration(e.timeInterval?.duration) / 1000 / 3600).toFixed(2)),
    (e.tagIds || []).join("; ")
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  return csv;
}

async function fetchRunningEntry(apiKey, workspaceId, userId = null) {
  try {
    console.log("[FETCH-RUNNING] Fetching running entry");
    // Use user endpoint (workspace endpoint returns 403 Forbidden)
    if (!userId) {
      const user = await fetchCurrentUser(apiKey);
      userId = user.id;
    }
    const entries = await fetchUserTimeEntries(apiKey, workspaceId, userId, null, null, true);
    const entry = Array.isArray(entries) && entries.length > 0 ? entries[0] : null;
    console.log("[FETCH-RUNNING] Got entry:", entry?.id || "none");
    return entry;
  } catch (error) {
    console.warn("[FETCH-RUNNING] Failed to fetch running entry:", error.message);
    return null;
  }
}

function fetchWorkspaceSettings(apiKey, workspaceId) {
  // Check cache first (60 second TTL)
  const cached = getFromCache(apiKey, `/workspaces/${workspaceId}/settings`);
  if (cached) return Promise.resolve(cached);
  
  return clockifyRequest(apiKey, "GET", `/workspaces/${workspaceId}/settings`)
    .then(result => {
      setCache(apiKey, `/workspaces/${workspaceId}/settings`, result, 60000);
      return result;
    })
    .catch(error => {
      console.warn("[SETTINGS] Fetch failed, using defaults:", error.message);
      // Return default settings if endpoint doesn't exist or fails
      const defaults = { projectRequired: false, taskRequired: false };
      setCache(apiKey, `/workspaces/${workspaceId}/settings`, defaults, 60000);
      return defaults;
    });
}

async function getWeekEntries(apiKey, workspaceId, userId, daysBack = 7) {
  try {
    // Get current week (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mondayOfWeek = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
    mondayOfWeek.setHours(0, 0, 0, 0);
    
    const sundayOfWeek = new Date(mondayOfWeek);
    sundayOfWeek.setDate(sundayOfWeek.getDate() + 6);
    sundayOfWeek.setHours(23, 59, 59, 999);
    
    const entries = await fetchUserTimeEntries(apiKey, workspaceId, userId, mondayOfWeek.toISOString(), sundayOfWeek.toISOString());
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.error("Error fetching week entries:", error);
    return [];
  }
}

async function syncTimerState(context) {
  try {
    const apiKey = await context.secrets.get("clockify.apiKey");
    const workspaceId = await context.globalState.get("clockify.lastWorkspaceId");
    const localEntryId = await context.globalState.get("clockify.lastTimeEntryId");
    const localStartTime = await context.globalState.get("clockify.lastTimeEntryStart");
    
    if (!apiKey || !workspaceId || !localEntryId) {
      return false; // No active timer locally
    }

    console.log("[SYNC] Checking timer state - local entry:", localEntryId, "started at:", localStartTime);

    // Check what's actually running on Clockify
    const userId = await context.globalState.get("clockify.lastTimeEntryUserId");
    const runningEntry = await fetchRunningEntry(apiKey, workspaceId, userId);
    console.log("[SYNC] Clockify running entry:", runningEntry?.id || "none");
    
    // Only clear state if we successfully fetched and found NO running entry
    // Don't clear if fetch failed (API error) - that might be temporary
    if (runningEntry === null) {
      // Fetch returned null (successful API call, no running entry)
      // Timer was stopped on Clockify but we think it's running locally
      console.log("[SYNC] No timer running on Clockify, clearing local state");
      await context.globalState.update("clockify.lastTimeEntryId", "");
      await context.globalState.update("clockify.lastTimeEntryStart", "");
      await context.globalState.update("clockify.lastTimeEntryUserId", "");
      return true; // State changed, update UI
    }
    
    if (runningEntry && runningEntry.id && runningEntry.id !== localEntryId) {
      // Different timer is running (shouldn't happen but just in case)
      console.log("[SYNC] Different timer running on Clockify, updating local state");
      await context.globalState.update("clockify.lastTimeEntryId", runningEntry.id);
      await context.globalState.update("clockify.lastTimeEntryStart", runningEntry.timeInterval?.start);
      await context.globalState.update("clockify.lastTimeEntryUserId", runningEntry.userId);
      return true; // State changed, update UI
    }

    return false; // State is in sync or fetch failed (keep local state)
  } catch (error) {
    console.warn("[SYNC] Error syncing timer state:", error);
    return false;
  }
}

function setApiKey(context) {
  (async () => {
    const apiKey = await vscode.window.showInputBox({
      prompt: "Enter Clockify API key",
      password: true,
      ignoreFocusOut: true
    });
    if (apiKey) {
      await context.secrets.store("clockify.apiKey", apiKey);
      vscode.window.showInformationMessage("Clockify API key saved.");
    }
  })();
}

async function buildSidebarState(context) {
  // NOTE: syncTimerState is called from the periodic interval, not here to avoid rate limiting
  console.log("[SIDEBAR] Building sidebar state");

  const repoContext = await getRepoContext();
  const selections = await getRepoSelections(context);
  const selection = repoContext.repo ? selections[repoContext.repo] : null;
  const entryId = context.globalState.get("clockify.lastTimeEntryId");
  const entryStart = context.globalState.get("clockify.lastTimeEntryStart");
  const elapsed = entryId ? formatElapsed(entryStart) : "";

  // Fetch additional data for sidebar
  let recentEntries = [];
  let todaysTotal = 0;
  let templates = [];
  let dailyGoal = 8;
  let workspaces = [];
  let projects = [];
  let tasks = [];
  let tags = [];
  let selectedWorkspaceId = null;
  let selectedProjectId = null;

  try {
    const apiKey = await context.secrets.get("clockify.apiKey");
    if (apiKey) {
      console.log("[SIDEBAR] API key found, fetching data");
      // Try to get from cache first
      let user = getFromCache(apiKey, "/user");
      if (!user) {
        user = await fetchCurrentUser(apiKey);
        setCache(apiKey, "/user", user, 5000); // Cache for 5 seconds
      }
      if (user && user.id) {
        console.log("[SIDEBAR] User found:", user.id);
        // Fetch workspaces and determine selected workspace
        workspaces = Array.isArray(await fetchWorkspaces(apiKey)) ? await fetchWorkspaces(apiKey) : [];
        // Prefer repo selection, then last workspace, then user's active workspace
        const repoSel = selection || null;
        selectedWorkspaceId = (repoSel && repoSel.workspaceId) || context.globalState.get("clockify.lastWorkspaceId") || user.activeWorkspace || (workspaces[0] && workspaces[0].id) || null;
        console.log("[SIDEBAR] Selected workspace:", selectedWorkspaceId);
        if (selectedWorkspaceId) {
          // Fetch projects and tags for selected workspace
          projects = Array.isArray(await fetchProjects(apiKey, selectedWorkspaceId)) ? await fetchProjects(apiKey, selectedWorkspaceId) : [];
          tags = Array.isArray(await fetchTags(apiKey, selectedWorkspaceId)) ? await fetchTags(apiKey, selectedWorkspaceId) : [];
          selectedProjectId = (repoSel && repoSel.projectId) || context.globalState.get("clockify.lastProjectId") || null;
          
          // Fetch tasks for selected project
          if (selectedProjectId) {
            tasks = Array.isArray(await fetchTasks(apiKey, selectedWorkspaceId, selectedProjectId)) ? await fetchTasks(apiKey, selectedWorkspaceId, selectedProjectId) : [];
          }

          // Recent entries and today's total
          console.log("[SIDEBAR] Fetching recent entries and today's total for user:", user.id);
          recentEntries = await fetchRecentEntries(apiKey, selectedWorkspaceId, user.id);
          todaysTotal = await calculateTodaysTotal(apiKey, selectedWorkspaceId, user.id);
          console.log("[SIDEBAR] Today's total:", todaysTotal);
        }
      }
    }
  } catch (error) {
    console.error("[SIDEBAR] Error fetching sidebar data:", error);
  }

  templates = getTemplates(context);
  dailyGoal = getDailyGoal(context);

  return {
    running: Boolean(entryId),
    elapsed,
    repo: repoContext.repo,
    branch: repoContext.branch,
    workspaces: workspaces.map(w => ({ id: w.id, name: w.name })),
    projects: projects.map(p => ({ id: p.id, name: p.name })),
    tasks: tasks.map(t => ({ id: t.id, name: t.name })),
    tagsList: tags.map(t => ({ id: t.id, name: t.name })),
    workspace: selection ? selection.workspaceName || (workspaces.find(w => w.id === selectedWorkspaceId) || {}).name || "" : (workspaces.find(w => w.id === selectedWorkspaceId) || {}).name || "",
    project: selection ? selection.projectName || (projects.find(p => p.id === selectedProjectId) || {}).name || "" : (projects.find(p => p.id === selectedProjectId) || {}).name || "",
    task: selection ? selection.taskName || "" : "",
    tags: selection && Array.isArray(selection.tagNames) ? selection.tagNames : [],
    description: selection ? selection.description || "" : "",
    recentEntries,
    todaysTotal,
    templates,
    dailyGoal
  };
}

function getWebviewHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 16px;
      background-color: var(--vscode-editor-background);
    }
    .card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--vscode-foreground);
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .info-item {
      flex: 1;
    }
    .label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .value {
      font-size: 13px;
      color: var(--vscode-foreground);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .status-badge.running {
      background: var(--vscode-terminal-ansiGreen);
      color: var(--vscode-button-foreground);
    }
    .timer {
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      padding: 16px 0;
      color: var(--vscode-foreground);
    }
    .field {
      margin-bottom: 12px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--vscode-foreground);
    }
    input, textarea {
      width: 100%;
      padding: 8px 10px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }
    select {
      width: 100%;
      padding: 8px 10px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      -webkit-appearance: none;
      appearance: none;
    }
    .tags-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .tag-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 999px;
      background: var(--vscode-input-background);
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-input-border);
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    }
    .tag-chip.selected {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-color: transparent;
    }
    input:focus, textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }
    textarea {
      resize: vertical;
      min-height: 64px;
    }
    .button-group {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    button {
      padding: 10px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .inline-group {
      display: flex;
      gap: 8px;
    }
    .inline-group input {
      flex: 1;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      font-size: 12px;
      padding: 2px 0;
      color: var(--vscode-foreground);
    }
    .divider {
      height: 1px;
      background: var(--vscode-panel-border);
      margin: 16px 0;
    }
    .progress-bar {
      width: 100%;
      height: 6px;
      background: var(--vscode-progressBar-background);
      border-radius: 3px;
      overflow: hidden;
      margin: 8px 0;
    }
    .progress-fill {
      height: 100%;
      background: var(--vscode-terminal-ansiGreen);
      transition: width 0.3s;
    }
    .entry-item {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .template-row {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .week-day {
      margin-bottom: 12px;
      padding: 8px;
      background: var(--vscode-input-background);
      border-left: 3px solid var(--vscode-badge-background);
      border-radius: 2px;
    }
    .week-day-title {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 4px;
      color: var(--vscode-foreground);
    }
    .week-entry {
      font-size: 11px;
      padding: 2px 0;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">📊 Today: <span id="todayHours">0.0</span>h / <span id="dailyGoal">8</span>h</div>
    <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
  </div>

  <div class="card">
    <div class="title">⏱️ Timer</div>
    <div class="timer" id="elapsed">00:00:00</div>
    <div style="text-align: center; margin-bottom: 12px;">
      <span class="status-badge" id="status">Idle</span>
    </div>
    <div class="info-row">
      <div class="info-item"><div class="label">Workspace</div><div><select id="workspaceSelect"><option>Not set</option></select></div></div>
      <div class="info-item"><div class="label">Project</div><div style="display: flex; gap: 4px;"><select id="projectSelect" style="flex: 1;"><option>None</option></select><button id="createProjectBtn" class="secondary" style="padding: 8px 6px;">+</button></div></div>
    </div>
    <div class="info-row">
      <div class="info-item"><div class="label">Task</div><div style="display: flex; gap: 4px;"><select id="taskSelect" style="flex: 1;"><option value="">No task</option></select><button id="createTaskBtn" class="secondary" style="padding: 8px 6px;">+</button></div></div>
      <div class="info-item"><div class="label">Tags</div><div style="display: flex; gap: 4px;"><select id="tagsSelect" multiple style="flex: 1;"><option value="">No tags</option></select><button id="createTagBtn" class="secondary" style="padding: 8px 6px;">+</button></div></div>
    </div>
    <div class="field">
      <label for="descriptionInput">Description</label>
      <textarea id="descriptionInput"></textarea>
    </div>
    <div class="button-group">
      <button id="start">▶ Start</button>
      <button id="stop" disabled>⏹ Stop</button>
      <button id="discard" class="secondary">🗑️ Discard</button>
    </div>
  </div>

  <div class="divider"></div>

  <div class="card">
    <div class="title">⚡ Recent</div>
    <div id="recentList" style="font-size: 12px;"></div>
  </div>

  <div class="divider"></div>

  <div class="card">
    <div class="title">⭐ Templates</div>
    <div class="field">
      <label>Save as Template</label>
      <div class="inline-group">
        <input id="templateName" type="text" placeholder="Name">
        <button id="saveTemplate" class="secondary">Save</button>
      </div>
    </div>
    <div id="templateList" style="font-size: 12px;"></div>
  </div>

  <div class="divider"></div>

  <div class="card">
    <div class="title">⚙️ Settings</div>
    <div class="field">
      <label>Daily Goal</label>
      <div class="inline-group">
        <input id="dailyGoalInput" type="number" min="1" max="24" value="8">
        <button id="setGoal" class="secondary">Set</button>
      </div>
    </div>
    <div class="field">
      <label>API Key</label>
      <div class="inline-group">
        <input id="apiKeyInput" type="password" placeholder="API key">
        <button id="saveApiKey" class="secondary">Save</button>
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="card">
    <div class="title">📅 This Week</div>
    <div id="weekView" style="font-size: 12px;"></div>
    <button id="loadWeekView" class="secondary" style="margin-top: 8px;">Refresh</button>
  </div>

  <div class="divider"></div>

  <div class="card">
    <div class="title">📊 Export</div>
    <div class="field">
      <label>Export Timesheet</label>
      <div class="inline-group">
        <select id="exportRange" style="flex: 1;">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <button id="exportCsv" class="secondary">CSV</button>
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <script>
    const vscode = acquireVsCodeApi();
    
    document.getElementById("start").onclick = () => {
      const description = document.getElementById("descriptionInput").value;
      const workspaceId = (document.getElementById("workspaceSelect") || {}).value || null;
      const projectId = (document.getElementById("projectSelect") || {}).value || null;
      const taskId = (document.getElementById("taskSelect") || {}).value || null;
      const tagsSelect = document.getElementById("tagsSelect");
      const tagIds = tagsSelect ? Array.from(tagsSelect.selectedOptions).map(o => o.value).filter(v => v !== "") : [];
      vscode.postMessage({ type: "startWithSelection", description, selection: { workspaceId, projectId, taskId, tagIds } });
    };
    document.getElementById("stop").onclick = () => vscode.postMessage({ type: "stop" });
    document.getElementById("saveTemplate").onclick = () => {
      const name = document.getElementById("templateName").value;
      if (name) vscode.postMessage({ type: "saveTemplate", name, description: document.getElementById("descriptionInput").value });
    };
    document.getElementById("setGoal").onclick = () => vscode.postMessage({ type: "setGoal", goal: parseInt(document.getElementById("dailyGoalInput").value) });
    document.getElementById("saveApiKey").onclick = () => vscode.postMessage({ type: "saveApiKey", apiKey: document.getElementById("apiKeyInput").value });
    // notify extension when workspace/project changes
    const wsSel = document.getElementById("workspaceSelect");
    if (wsSel) wsSel.onchange = () => vscode.postMessage({ type: 'workspaceChanged', workspaceId: wsSel.value });
    const prSel = document.getElementById("projectSelect");
    if (prSel) prSel.onchange = () => vscode.postMessage({ type: 'projectChanged', projectId: prSel.value });
    const taskSel = document.getElementById("taskSelect");
    if (taskSel) taskSel.onchange = () => vscode.postMessage({ type: 'taskChanged', taskId: taskSel.value });
    
    const createTaskBtn = document.getElementById("createTaskBtn");
    if (createTaskBtn) {
      createTaskBtn.onclick = () => {
        vscode.postMessage({ type: 'requestTaskInput' });
      };
    }
    const createProjectBtn = document.getElementById("createProjectBtn");
    if (createProjectBtn) {
      createProjectBtn.onclick = () => {
        vscode.postMessage({ type: 'requestProjectInput' });
      };
    }
    const createTagBtn = document.getElementById("createTagBtn");
    if (createTagBtn) {
      createTagBtn.onclick = () => {
        vscode.postMessage({ type: 'requestTagInput' });
      };
    }
    document.getElementById("loadWeekView").onclick = () => vscode.postMessage({ type: "getWeekView" });
    document.getElementById("exportCsv").onclick = () => {
      const range = parseInt(document.getElementById("exportRange").value) || 7;
      vscode.postMessage({ type: "exportTimesheet", daysBack: range });
    };
    document.getElementById("discard").onclick = () => {
      document.getElementById("descriptionInput").value = "";
      document.getElementById("taskSelect").value = "";
      document.getElementById("tagsSelect").selectedIndex = 0;
      vscode.postMessage({ type: "discardEntry" });
    };

    window.addEventListener("message", event => {
      const state = event.data;
      if (!state) return;

      // Handle week view separately
      if (state.type === "weekView" && state.weekData) {
        const weekView = document.getElementById("weekView");
        weekView.innerHTML = "";
        const days = Object.keys(state.weekData).sort();
        if (days.length === 0) {
          weekView.innerHTML = "<div style='color: var(--vscode-descriptionForeground);'>No entries this week</div>";
        } else {
          days.forEach(day => {
            const entries = state.weekData[day];
            const dayDiv = document.createElement("div");
            dayDiv.className = "week-day";
            const dayTitle = document.createElement("div");
            dayTitle.className = "week-day-title";
            dayTitle.textContent = day;
            dayDiv.appendChild(dayTitle);
            entries.forEach(entry => {
              const entryDiv = document.createElement("div");
              entryDiv.className = "week-entry";
              entryDiv.textContent = entry.start + " - " + entry.description + " (" + entry.duration + "h)";
              dayDiv.appendChild(entryDiv);
            });
            weekView.appendChild(dayDiv);
          });
        }
        return; // Don't process other state properties
      }

      if (state.type !== "state") return;

      // Basic stats
      document.getElementById("todayHours").textContent = (state.todaysTotal || 0).toFixed(1);
      document.getElementById("dailyGoal").textContent = state.dailyGoal || 8;
      document.getElementById("progressFill").style.width = Math.min(100, ((state.todaysTotal || 0) / (state.dailyGoal || 8)) * 100) + "%";

      if (document.activeElement && document.activeElement.id !== "descriptionInput") document.getElementById("descriptionInput").value = state.description || "";

      const isRunning = state.running === true;
      document.getElementById("status").textContent = isRunning ? "Running" : "Idle";
      document.getElementById("status").className = isRunning ? "status-badge running" : "status-badge";
      document.getElementById("elapsed").textContent = state.elapsed || "00:00:00";
      document.getElementById("start").disabled = isRunning;
      document.getElementById("stop").disabled = !isRunning;

      // Workspaces
      const workspaceSelect = document.getElementById("workspaceSelect");
      if (workspaceSelect && Array.isArray(state.workspaces)) {
        const prev = workspaceSelect.value;
        workspaceSelect.innerHTML = "";
        state.workspaces.forEach(w => {
          const opt = document.createElement("option");
          opt.value = w.id;
          opt.textContent = w.name;
          workspaceSelect.appendChild(opt);
        });
        // set selected by id or name
        if (state.workspace) {
          let set = false;
          for (const o of workspaceSelect.options) {
            if (o.value === state.workspace || o.textContent === state.workspace) {
              workspaceSelect.value = o.value;
              set = true;
              break;
            }
          }
          if (!set && prev) workspaceSelect.value = prev;
        }
      }

      // Projects
      const projectSelect = document.getElementById("projectSelect");
      if (projectSelect && Array.isArray(state.projects)) {
        const prevP = projectSelect.value;
        projectSelect.innerHTML = "";
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "(No project)";
        projectSelect.appendChild(emptyOpt);
        state.projects.forEach(p => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.name;
          projectSelect.appendChild(opt);
        });
        if (state.project) {
          let setp = false;
          for (const o of projectSelect.options) {
            if (o.value === state.project || o.textContent === state.project) {
              projectSelect.value = o.value;
              setp = true;
              break;
            }
          }
          if (!setp && prevP) projectSelect.value = prevP;
        }
      }

      // Tasks
      const taskSelect = document.getElementById("taskSelect");
      if (taskSelect && Array.isArray(state.tasks)) {
        const prevT = taskSelect.value;
        taskSelect.innerHTML = "";
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "No task";
        taskSelect.appendChild(emptyOpt);
        state.tasks.forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.textContent = t.name;
          taskSelect.appendChild(opt);
        });
        if (state.task) {
          let sett = false;
          for (const o of taskSelect.options) {
            if (o.value === state.task || o.textContent === state.task) {
              taskSelect.value = o.value;
              sett = true;
              break;
            }
          }
          if (!sett && prevT) taskSelect.value = prevT;
        }
      }

      // Tags dropdown
      const tagsSelect = document.getElementById("tagsSelect");
      if (tagsSelect && Array.isArray(state.tagsList)) {
        tagsSelect.innerHTML = "";
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "No tags";
        tagsSelect.appendChild(emptyOpt);
        state.tagsList.forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.textContent = t.name;
          tagsSelect.appendChild(opt);
        });
      }

      // Recent entries
      const recentList = document.getElementById("recentList");
      recentList.innerHTML = "";
      if (state.recentEntries && state.recentEntries.length > 0) {
        state.recentEntries.forEach(entry => {
          const div = document.createElement("div");
          div.className = "entry-item";
          div.innerHTML = '<div><strong>' + (entry.description || '(no description)') + '</strong><br><small>' + (entry.date || '') + '</small></div>';
          const btn = document.createElement('button');
          btn.className = 'secondary';
          btn.textContent = 'Restart';
          btn.onclick = () => vscode.postMessage({ type: 'loadEntry', entry });
          div.appendChild(btn);
          recentList.appendChild(div);
        });
      } else {
        recentList.innerHTML = "<div style='color: var(--vscode-descriptionForeground);'>No recent entries</div>";
      }

      // Templates
      const templateList = document.getElementById("templateList");
      templateList.innerHTML = "";
      if (state.templates && state.templates.length > 0) {
        state.templates.forEach(template => {
          const div = document.createElement("div");
          div.className = "template-row";
          const name = document.createElement('strong'); name.textContent = template.name;
          const btns = document.createElement('div');
          const loadBtn = document.createElement('button'); loadBtn.className = 'secondary'; loadBtn.textContent = 'Load'; loadBtn.onclick = () => vscode.postMessage({ type: 'loadTemplate', name: template.name });
          const delBtn = document.createElement('button'); delBtn.className = 'secondary'; delBtn.textContent = 'Delete'; delBtn.onclick = () => vscode.postMessage({ type: 'deleteTemplate', name: template.name });
          btns.appendChild(loadBtn); btns.appendChild(document.createTextNode(' ')); btns.appendChild(delBtn);
          div.appendChild(name); div.appendChild(btns);
          templateList.appendChild(div);
        });
      } else {
        templateList.innerHTML = "<div style='color: var(--vscode-descriptionForeground);'>No templates</div>";
      }
    });
    // Request initial state
    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
}

function activate(context) {
  console.log("Clockify extension activating...");
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = "clockify.startTimer";
  context.subscriptions.push(statusBar);
  let statusInterval = null;
  let idleCheckInterval = null;
  let syncInterval = null;
  const sidebarViews = new Map();

  const viewProvider = {
    resolveWebviewView(view) {
      console.log("Resolving Clockify webview...");
      const viewType = view.viewType || "clockifyView";
      sidebarViews.set(viewType, view);
      view.onDidDispose(() => sidebarViews.delete(viewType));
      view.webview.options = { enableScripts: true };
      
      try {
        view.webview.html = getWebviewHtml();
        console.log("Webview HTML set successfully");
      } catch (error) {
        console.error("Error setting webview HTML:", error);
      }

      view.webview.onDidReceiveMessage(async (message) => {
        console.log("Webview message received:", message.type);
        if (!message || !message.type) {
          return;
        }
        if (message.type === "start") {
          await startTimer(context, message.description);
        } else if (message.type === "startWithSelection") {
          // Start directly with provided selection from webview
          try {
            const apiKey = await getApiKey(context);
            if (!apiKey) {
              vscode.window.showErrorMessage("Clockify API key is required.");
            } else if (!message.selection || !message.selection.workspaceId) {
              vscode.window.showErrorMessage("Workspace selection is required to start timer.");
            } else {
              // Check workspace settings for mandatory fields (with 2 second timeout)
              let settings = {};
              try {
                settings = await Promise.race([
                  fetchWorkspaceSettings(apiKey, message.selection.workspaceId),
                  new Promise((_, reject) => setTimeout(() => reject(new Error("Settings fetch timeout")), 2000))
                ]);
              } catch (e) {
                console.warn("Could not fetch workspace settings, proceeding without validation:", e.message);
              }

              // Validate mandatory fields
              if (settings.projectRequired && !message.selection.projectId) {
                vscode.window.showErrorMessage("Project is mandatory in this workspace. Please select a project.");
                return;
              }
              if (settings.taskRequired && !message.selection.taskId) {
                vscode.window.showErrorMessage("Task is mandatory in this workspace. Please select a task.");
                return;
              }

              const repoContext = await getRepoContext();
              const startIso = new Date().toISOString();
              const body = {
                start: startIso,
                description: message.description || `Working on ${repoContext.repo}`
              };
              if (message.selection.projectId) body.projectId = message.selection.projectId;
              if (message.selection.taskId) body.taskId = message.selection.taskId;
              if (Array.isArray(message.selection.tagIds) && message.selection.tagIds.length) body.tagIds = message.selection.tagIds;
              const entry = await clockifyRequest(apiKey, "POST", `/workspaces/${message.selection.workspaceId}/time-entries`, body);
              await context.globalState.update("clockify.lastTimeEntryId", entry.id || "running");
              await context.globalState.update("clockify.lastWorkspaceId", message.selection.workspaceId);
              await context.globalState.update("clockify.lastTimeEntryUserId", entry.userId || "");
              await context.globalState.update("clockify.lastTimeEntryStart", startIso);
              // persist selection for this repo
              if (repoContext && repoContext.repo) {
                await saveRepoSelection(context, repoContext.repo, {
                  workspaceId: message.selection.workspaceId,
                  workspaceName: "",
                  projectId: message.selection.projectId || "",
                  projectName: "",
                  taskId: message.selection.taskId || "",
                  taskName: "",
                  tagIds: message.selection.tagIds || [],
                  tagNames: []
                });
              }
              vscode.window.showInformationMessage("Clockify timer started.");
              updateStatusBar();
              updateSidebar();
            }
          } catch (error) {
            vscode.window.showErrorMessage(error.message || "Clockify start failed.");
          }
        } else if (message.type === "stop") {
        
          await stopTimer(context);
        } else if (message.type === "dailySummary") {
          await showDailySummary(context);
        } else if (message.type === "history") {
          await showTimeEntryHistory(context);
        } else if (message.type === "settings") {
          await vscode.commands.executeCommand("workbench.action.openSettings", "clockify");
        } else if (message.type === "saveApiKey") {
          if (message.apiKey) {
            await context.secrets.store("clockify.apiKey", message.apiKey);
            vscode.window.showInformationMessage("Clockify API key saved.");
          }
        } else if (message.type === "apiKey") {
          await setApiKey(context);
        } else if (message.type === "saveTemplate") {
          if (message.name && message.description !== undefined) {
            await saveTemplate(context, message.name, {
              description: message.description
            });
            vscode.window.showInformationMessage("Template \"" + message.name + "\" saved.");
          }
        } else if (message.type === "deleteTemplate") {
          if (message.name) {
            await deleteTemplate(context, message.name);
            vscode.window.showInformationMessage("Template \"" + message.name + "\" deleted.");
          }
        } else if (message.type === "workspaceChanged") {
          if (message.workspaceId) {
            await context.globalState.update("clockify.lastWorkspaceId", message.workspaceId);
            // clear project cache for new workspace
            await context.globalState.update("clockify.lastProjectId", "");
            vscode.window.showInformationMessage("Workspace changed.");
          }
        } else if (message.type === "projectChanged") {
          if (message.projectId !== undefined) {
            await context.globalState.update("clockify.lastProjectId", message.projectId || "");
            vscode.window.showInformationMessage("Project changed.");
          }
        } else if (message.type === "taskChanged") {
          if (message.taskId !== undefined) {
            await context.globalState.update("clockify.lastTaskId", message.taskId || "");
            updateSidebar();
          }
        } else if (message.type === "requestTaskInput") {
          const taskName = await vscode.window.showInputBox({
            prompt: "Enter new task name",
            placeHolder: "Task name...",
            ignoreFocusOut: true
          });
          if (taskName) {
            webviewProvider.postMessage({ type: 'createTask', taskName });
          }
        } else if (message.type === "requestProjectInput") {
          const projectName = await vscode.window.showInputBox({
            prompt: "Enter new project name",
            placeHolder: "Project name...",
            ignoreFocusOut: true
          });
          if (projectName) {
            webviewProvider.postMessage({ type: 'createProject', projectName });
          }
        } else if (message.type === "requestTagInput") {
          const tagName = await vscode.window.showInputBox({
            prompt: "Enter new tag name",
            placeHolder: "Tag name...",
            ignoreFocusOut: true
          });
          if (tagName) {
            webviewProvider.postMessage({ type: 'createTag', tagName });
          }
        } else if (message.type === "createTask") {
          if (message.taskName) {
            try {
              const apiKey = await getApiKey(context);
              const workspaceId = context.globalState.get("clockify.lastWorkspaceId");
              const projectId = context.globalState.get("clockify.lastProjectId");
              if (!apiKey || !workspaceId || !projectId) {
                vscode.window.showErrorMessage("Workspace and project must be selected to create a task.");
              } else {
                const task = await clockifyRequest(apiKey, "POST", `/workspaces/${workspaceId}/projects/${projectId}/tasks`, {
                  name: message.taskName
                });
                await context.globalState.update("clockify.lastTaskId", task.id);
                vscode.window.showInformationMessage(`Task '${task.name}' created.`);
                await updateSidebar();
              }
            } catch (error) {
              vscode.window.showErrorMessage(error.message || "Failed to create task.");
            }
          }
        } else if (message.type === "createProject") {
          if (message.projectName) {
            try {
              const apiKey = await getApiKey(context);
              const workspaceId = context.globalState.get("clockify.lastWorkspaceId");
              if (!apiKey || !workspaceId) {
                vscode.window.showErrorMessage("Workspace must be selected to create a project.");
              } else {
                const project = await clockifyRequest(apiKey, "POST", `/workspaces/${workspaceId}/projects`, {
                  name: message.projectName,
                  isPublic: true
                });
                await context.globalState.update("clockify.lastProjectId", project.id);
                vscode.window.showInformationMessage(`Project '${project.name}' created.`);
                await updateSidebar();
              }
            } catch (error) {
              vscode.window.showErrorMessage(error.message || "Failed to create project.");
            }
          }
        } else if (message.type === "createTag") {
          if (message.tagName) {
            try {
              const apiKey = await getApiKey(context);
              const workspaceId = context.globalState.get("clockify.lastWorkspaceId");
              if (!apiKey || !workspaceId) {
                vscode.window.showErrorMessage("Workspace must be selected to create a tag.");
              } else {
                const tag = await clockifyRequest(apiKey, "POST", `/workspaces/${workspaceId}/tags`, {
                  name: message.tagName
                });
                vscode.window.showInformationMessage(`Tag '${tag.name}' created.`);
                await updateSidebar();
              }
            } catch (error) {
              vscode.window.showErrorMessage(error.message || "Failed to create tag.");
            }
          }
        } else if (message.type === "loadTemplate") {
          if (message.name) {
            const templates = getTemplates(context);
            const template = templates.find(t => t.name === message.name);
            if (template && template.description) {
              // TODO: Load template into timer
              vscode.window.showInformationMessage("Loaded template: " + message.name);
            }
          }
        } else if (message.type === "setGoal") {
          if (message.goal && message.goal > 0) {
            await setDailyGoal(context, message.goal);
          }
        } else if (message.type === "loadEntry") {
          // TODO: Load previous entry
          vscode.window.showInformationMessage("Loading previous entry...");
        } else if (message.type === "exportTimesheet") {
          // Export timesheet to CSV
          try {
            const apiKey = await getApiKey(context);
            if (!apiKey) {
              vscode.window.showErrorMessage("Clockify API key is required.");
              return;
            }
            const user = await fetchCurrentUser(apiKey);
            const workspaceId = user.activeWorkspace;
            const entries = await getWeekEntries(apiKey, workspaceId, user.id, message.daysBack || 7);
            const csv = exportToCSV(entries, "timesheet.csv");
            const savePath = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(`timesheet_${new Date().toISOString().split('T')[0]}.csv`),
              filters: { "CSV Files": ["csv"] }
            });
            if (savePath) {
              const fs = require("fs");
              fs.writeFileSync(savePath.fsPath, csv);
              vscode.window.showInformationMessage("Timesheet exported successfully.");
            }
          } catch (error) {
            vscode.window.showErrorMessage(error.message || "Failed to export timesheet.");
          }
        } else if (message.type === "getWeekView") {
          // Fetch week entries for calendar view
          try {
            const apiKey = await getApiKey(context);
            if (!apiKey) {
              vscode.window.showErrorMessage("Clockify API key is required.");
              return;
            }
            const user = await fetchCurrentUser(apiKey);
            const workspaceId = user.activeWorkspace;
            const entries = await getWeekEntries(apiKey, workspaceId, user.id, 7);
            // Group entries by day
            const byDay = {};
            entries.forEach(e => {
              const day = new Date(e.timeInterval?.start).toLocaleDateString();
              if (!byDay[day]) byDay[day] = [];
              // Convert duration from ISO 8601 format to hours
              const durationMs = parseIsoDuration(e.timeInterval?.duration);
              const hours = (durationMs / 1000 / 3600).toFixed(2);
              byDay[day].push({
                description: e.description || "(no description)",
                duration: hours,
                start: new Date(e.timeInterval?.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              });
            });
            sidebarViews.forEach(view => {
              view.webview.postMessage({ type: "weekView", weekData: byDay });
            });
          } catch (error) {
            console.error("Error fetching week view:", error);
          }
        } else if (message.type === "discardEntry") {
          // Stop timer if running, then clear form
          const entryId = context.globalState.get("clockify.lastTimeEntryId");
          if (entryId) {
            await stopTimer(context);
          }
          // Clear form selections
          await context.globalState.update("clockify.lastTaskId", "");
          vscode.window.showInformationMessage("Timer stopped and form cleared.");
        }
        updateStatusBar();
        updateSidebar();
      });

      updateSidebar();
    }
  };

  ["clockifyView", "clockifyViewSecondary"].forEach((viewType) => {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(viewType, viewProvider)
    );
  });

  let updateSidebarTimeout = null;
  async function updateSidebar() {
    if (updateSidebarTimeout) {
      clearTimeout(updateSidebarTimeout);
    }
    updateSidebarTimeout = setTimeout(async () => {
      if (!sidebarViews.size) {
        return;
      }
      const state = await buildSidebarState(context);
      sidebarViews.forEach((view) => {
        view.webview.postMessage({ type: "state", ...state });
      });
    }, 500); // Debounce for 500ms
  }

  async function updateStatusBar() {
    try {
      await syncTimerState(context);
    } catch (e) {
      console.warn("Sync timer error:", e);
    }
    const entryId = context.globalState.get("clockify.lastTimeEntryId");
    const entryStart = context.globalState.get("clockify.lastTimeEntryStart");
    if (entryId) {
      const elapsed = formatElapsed(entryStart);
      statusBar.text = `$(watch) Clockify: ${elapsed}`;
      statusBar.tooltip = "Stop Clockify timer";
      statusBar.command = "clockify.stopTimer";
      if (!statusInterval) {
        statusInterval = setInterval(() => updateStatusBar(), 1000);
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

  function startIdleDetection() {
    if (idleCheckInterval) clearInterval(idleCheckInterval);
    idleCheckInterval = setInterval(async () => {
      const entryId = context.globalState.get("clockify.lastTimeEntryId");
      const entryStart = context.globalState.get("clockify.lastTimeEntryStart");
      if (!entryId || !entryStart) return;
      
      const startMs = Date.parse(entryStart);
      const elapsedMs = Date.now() - startMs;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      
      // Alert if running for 2+ hours
      if (elapsedHours >= 2) {
        const response = await vscode.window.showWarningMessage(
          "⏱️ Timer running for 2+ hours. Still working on this?",
          "Yes, continue", "Stop timer"
        );
        if (response === "Stop timer") {
          await stopTimer(context);
          updateStatusBar();
        }
        // Reset check so it doesn't spam
        await context.globalState.update("clockify.idleCheckTime", Date.now());
      }
    }, 60000); // Check every minute
  }

  function stopIdleDetection() {
    if (idleCheckInterval) {
      clearInterval(idleCheckInterval);
      idleCheckInterval = null;
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.startTimer", async () => {
      await startTimer(context);
      updateStatusBar();
      startIdleDetection();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.stopTimer", async () => {
      await stopTimer(context);
      updateStatusBar();
      stopIdleDetection();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.dailySummary", () => showDailySummary(context))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("clockify.timeEntryHistory", () => showTimeEntryHistory(context))
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

  // Start periodic sync check - only when timer is running, check every 10 seconds
  syncInterval = setInterval(async () => {
    try {
      const entryId = context.globalState.get("clockify.lastTimeEntryId");
      if (!entryId) {
        console.log("[SYNC-INTERVAL] No timer running locally, skipping sync");
        return; // Only sync if timer is running
      }
      
      console.log("[SYNC-INTERVAL] Running sync check");
      const stateChanged = await syncTimerState(context);
      if (stateChanged) {
        console.log("[SYNC-INTERVAL] State changed, updating UI");
        updateStatusBar();
        updateSidebar();
      }
    } catch (error) {
      console.warn("[SYNC-INTERVAL] Error:", error);
    }
  }, 10000);

  // Clean up sync interval on deactivation
  context.subscriptions.push({
    dispose: () => {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    }
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
