const API_BASE = "https://api.clockify.me/api/v1";

function getSettings() {
  return chrome.storage.sync.get({
    apiKey: "",
    workspaceId: "",
    defaultProjectId: "",
    defaultTaskId: "",
    repoMappings: "[]",
    labelTagMap: "{}",
    defaultTagIds: "[]"
  });
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeRepo(repo) {
  return (repo || "").toLowerCase();
}

function resolveMatch(payload, settings) {
  const repoMappings = parseJson(settings.repoMappings, []);
  const labelTagMap = parseJson(settings.labelTagMap, {});
  const defaultTagIds = parseJson(settings.defaultTagIds, []);
  let projectId = settings.defaultProjectId || "";
  let taskId = settings.defaultTaskId || "";
  let tagIds = Array.isArray(defaultTagIds) ? defaultTagIds.slice(0) : [];
  const repoKey = normalizeRepo(payload.repoFullName || payload.repo);

  if (Array.isArray(repoMappings)) {
    const match = repoMappings.find((item) => normalizeRepo(item.repo) === repoKey);
    if (match) {
      projectId = match.projectId || projectId;
      taskId = match.taskId || taskId;
      if (Array.isArray(match.tagIds)) {
        tagIds = match.tagIds.slice(0);
      }
    }
  }

  if (payload.labels && labelTagMap && typeof labelTagMap === "object") {
    payload.labels.forEach((label) => {
      const id = labelTagMap[label];
      if (id && !tagIds.includes(id)) {
        tagIds.push(id);
      }
    });
  }

  return { projectId, taskId, tagIds };
}

async function startTimer(payload) {
  const settings = await getSettings();
  if (!settings.apiKey || !settings.workspaceId) {
    throw new Error("Missing API key or workspace id. Open settings.");
  }

  const match = resolveMatch(payload, settings);
  const body = {
    start: new Date().toISOString(),
    description: `${payload.title} (${payload.url})`
  };

  if (match.projectId) {
    body.projectId = match.projectId;
  }
  if (match.taskId) {
    body.taskId = match.taskId;
  }
  if (match.tagIds && match.tagIds.length) {
    body.tagIds = match.tagIds;
  }

  const response = await fetch(`${API_BASE}/workspaces/${settings.workspaceId}/time-entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": settings.apiKey
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Clockify error ${response.status}: ${text}`);
  }

  const data = JSON.parse(text);
  await chrome.storage.sync.set({
    lastTimeEntryId: data.id,
    lastTimeEntryWorkspaceId: settings.workspaceId
  });
  return data;
}

async function stopTimer() {
  const settings = await getSettings();
  const storage = await chrome.storage.sync.get({
    lastTimeEntryId: "",
    lastTimeEntryWorkspaceId: ""
  });
  if (!settings.apiKey || !settings.workspaceId) {
    throw new Error("Missing API key or workspace id. Open settings.");
  }

  const timeEntryId = storage.lastTimeEntryId;
  const workspaceId = storage.lastTimeEntryWorkspaceId || settings.workspaceId;
  if (!timeEntryId) {
    throw new Error("No running timer recorded.");
  }

  const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/time-entries/${timeEntryId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": settings.apiKey
    },
    body: JSON.stringify({ end: new Date().toISOString() })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Clockify error ${response.status}: ${text}`);
  }

  await chrome.storage.sync.set({ lastTimeEntryId: "" });
  return JSON.parse(text);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === "START_TIMER") {
    startTimer(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "STOP_TIMER") {
    stopTimer()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
});
