const API_BASE = "https://api.clockify.me/api/v1";
const ISSUE_URL_REGEX = /^https:\/\/github\.com\/[^/]+\/[^/]+\/(issues|pull)\/\d+/i;

function maybeInjectContentScript(tabId, url) {
  if (!url || !ISSUE_URL_REGEX.test(url)) {
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: ["content.js"]
    },
    () => {
      if (chrome.runtime.lastError) {
        console.warn("Clockify inject failed:", chrome.runtime.lastError.message);
      }
    }
  );
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    maybeInjectContentScript(tabId, tab.url);
  }
});

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
  const description = `${payload.title} (${payload.url})`;
  const body = buildTimeEntryBody({
    description,
    projectId: match.projectId,
    taskId: match.taskId,
    tagIds: match.tagIds
  });

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
    lastTimeEntryWorkspaceId: settings.workspaceId,
    lastTimeEntryStart: body.start,
    lastTimeEntryDescription: description
  });
  return data;
}

async function stopTimer() {
  const settings = await getSettings();
  const storage = await chrome.storage.sync.get({
    lastTimeEntryId: "",
    lastTimeEntryWorkspaceId: "",
    lastTimeEntryStart: ""
  });
  if (!settings.apiKey || !settings.workspaceId) {
    throw new Error("Missing API key or workspace id. Open settings.");
  }

  const timeEntryId = storage.lastTimeEntryId;
  const workspaceId = storage.lastTimeEntryWorkspaceId || settings.workspaceId;
  if (!timeEntryId) {
    throw new Error("No running timer recorded.");
  }

  const endIso = new Date().toISOString();
  let startIso = storage.lastTimeEntryStart;
  try {
    const runningEntry = await fetchRunningEntry(settings.apiKey, workspaceId);
    if (runningEntry && runningEntry.start) {
      startIso = runningEntry.start;
    }
  } catch (error) {
    // Fallback to stored start if API lookup fails.
  }
  const patchResponse = await fetch(
    `${API_BASE}/workspaces/${workspaceId}/time-entries/${timeEntryId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": settings.apiKey
      },
      body: JSON.stringify({ end: endIso })
    }
  );

  let text = await patchResponse.text();
  if (!patchResponse.ok && patchResponse.status === 405) {
    if (!startIso) {
      throw new Error("Missing start time for running entry.");
    }
    const putResponse = await fetch(
      `${API_BASE}/workspaces/${workspaceId}/time-entries/${timeEntryId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": settings.apiKey
        },
        body: JSON.stringify({ start: startIso, end: endIso })
      }
    );
    text = await putResponse.text();
    if (!putResponse.ok) {
      throw new Error(`Clockify error ${putResponse.status}: ${text}`);
    }
  } else if (!patchResponse.ok) {
    throw new Error(`Clockify error ${patchResponse.status}: ${text}`);
  }

  await chrome.storage.sync.set({
    lastTimeEntryId: "",
    lastTimeEntryStart: "",
    lastTimeEntryDescription: ""
  });
  return text ? JSON.parse(text) : {};
}

function buildTimeEntryBody({ description, projectId, taskId, tagIds }) {
  const body = {
    start: new Date().toISOString(),
    description: description || ""
  };

  if (projectId) {
    body.projectId = projectId;
  }
  if (taskId) {
    body.taskId = taskId;
  }
  if (tagIds && tagIds.length) {
    body.tagIds = tagIds;
  }

  return body;
}

async function clockifyGet(path, apiKey) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Clockify error ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function fetchWorkspaces(apiKey) {
  return clockifyGet("/workspaces", apiKey);
}

async function fetchProjects(apiKey, workspaceId) {
  return clockifyGet(`/workspaces/${workspaceId}/projects`, apiKey);
}

async function fetchTags(apiKey, workspaceId) {
  return clockifyGet(`/workspaces/${workspaceId}/tags`, apiKey);
}

async function fetchTasks(apiKey, workspaceId, projectId) {
  return clockifyGet(`/workspaces/${workspaceId}/projects/${projectId}/tasks`, apiKey);
}

async function fetchRunningEntry(apiKey, workspaceId) {
  return clockifyGet(`/workspaces/${workspaceId}/time-entries/in-progress`, apiKey);
}

async function startTimerWithSelection(selection) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    throw new Error("Missing API key. Open settings.");
  }
  if (!selection.workspaceId) {
    throw new Error("Workspace is required.");
  }

  const description = selection.description || "";
  const body = buildTimeEntryBody({
    description,
    projectId: selection.projectId,
    taskId: selection.taskId,
    tagIds: selection.tagIds
  });

  const response = await fetch(
    `${API_BASE}/workspaces/${selection.workspaceId}/time-entries`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": settings.apiKey
      },
      body: JSON.stringify(body)
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Clockify error ${response.status}: ${text}`);
  }

  const data = JSON.parse(text);
  await chrome.storage.sync.set({
    lastTimeEntryId: data.id,
    lastTimeEntryWorkspaceId: selection.workspaceId,
    lastTimeEntryStart: body.start,
    lastTimeEntryDescription: description
  });
  return data;
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

  if (message.type === "FETCH_WORKSPACES") {
    getSettings()
      .then((settings) => {
        if (!settings.apiKey) {
          throw new Error("Missing API key. Open settings.");
        }
        return fetchWorkspaces(settings.apiKey);
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "FETCH_PROJECTS") {
    getSettings()
      .then((settings) => {
        if (!settings.apiKey) {
          throw new Error("Missing API key. Open settings.");
        }
        return fetchProjects(settings.apiKey, message.workspaceId);
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "FETCH_TAGS") {
    getSettings()
      .then((settings) => {
        if (!settings.apiKey) {
          throw new Error("Missing API key. Open settings.");
        }
        return fetchTags(settings.apiKey, message.workspaceId);
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "FETCH_TASKS") {
    getSettings()
      .then((settings) => {
        if (!settings.apiKey) {
          throw new Error("Missing API key. Open settings.");
        }
        return fetchTasks(settings.apiKey, message.workspaceId, message.projectId);
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "FETCH_RUNNING_ENTRY") {
    getSettings()
      .then(async (settings) => {
        if (!settings.apiKey) {
          throw new Error("Missing API key. Open settings.");
        }
        const storage = await chrome.storage.sync.get({
          lastTimeEntryWorkspaceId: "",
          workspaceId: settings.workspaceId || ""
        });
        const workspaceId =
          storage.lastTimeEntryWorkspaceId || storage.workspaceId || settings.workspaceId;
        if (!workspaceId) {
          throw new Error("Workspace is required.");
        }
        return fetchRunningEntry(settings.apiKey, workspaceId);
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "START_TIMER_WITH_SELECTION") {
    startTimerWithSelection(message.selection)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
});
