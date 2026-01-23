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
    lastTimeEntryUserId: data.userId || "",
    lastTimeEntryStart: body.start,
    lastTimeEntryDescription: description,
    lastTimeEntryProjectId: body.projectId || "",
    lastTimeEntryTaskId: body.taskId || "",
    lastTimeEntryTagIds: Array.isArray(body.tagIds) ? body.tagIds : []
  });
  return data;
}

async function stopTimer() {
  const settings = await getSettings();
  const storage = await chrome.storage.sync.get({
    lastTimeEntryId: "",
    lastTimeEntryWorkspaceId: "",
    lastTimeEntryUserId: "",
    lastTimeEntryStart: "",
    lastTimeEntryDescription: "",
    lastTimeEntryProjectId: "",
    lastTimeEntryTaskId: "",
    lastTimeEntryTagIds: []
  });
  if (!settings.apiKey || !settings.workspaceId) {
    throw new Error("Missing API key or workspace id. Open settings.");
  }

  const workspaceId = storage.lastTimeEntryWorkspaceId || settings.workspaceId;
  const userId = storage.lastTimeEntryUserId;
  if (!userId) {
    throw new Error("Missing user ID. Please start a new timer.");
  }

  const endIso = new Date().toISOString();

  // Use the proper endpoint for stopping the timer: PATCH /user/{userId}/time-entries
  const stopResponse = await fetch(
    `${API_BASE}/workspaces/${workspaceId}/user/${userId}/time-entries`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": settings.apiKey
      },
      body: JSON.stringify({ end: endIso })
    }
  );

  const text = await stopResponse.text();
  if (!stopResponse.ok) {
    throw new Error(`Clockify error ${stopResponse.status}: ${text}`);
  }

  await chrome.storage.sync.set({
    lastTimeEntryId: "",
    lastTimeEntryStart: "",
    lastTimeEntryDescription: "",
    lastTimeEntryProjectId: "",
    lastTimeEntryTaskId: "",
    lastTimeEntryTagIds: []
  });
  return text ? JSON.parse(text) : {};
}

function buildStopPutBody({
  start,
  end,
  runningEntry,
  fallbackDescription,
  fallbackProjectId,
  fallbackTaskId,
  fallbackTagIds
}) {
  // For PUT request, only send start and end times to avoid permission issues
  // The entry was already created with the correct details, we just need to stop it
  const body = {
    start,
    end
  };

  return body;
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

async function fetchCurrentUser(apiKey) {
  const response = await clockifyGet(`/user`, apiKey);
  return response;
}

async function fetchRunningEntry(apiKey, workspaceId, userId = null) {
  try {
    // If no userId provided, fetch current user
    if (!userId) {
      const user = await fetchCurrentUser(apiKey);
      userId = user.id;
    }
    // Use the user endpoint instead of workspace endpoint (avoids 403 Forbidden)
    const params = new URLSearchParams();
    params.append("in-progress", "true");
    params.append("page-size", "50");
    const entries = await clockifyGet(
      `/workspaces/${workspaceId}/user/${userId}/time-entries?${params.toString()}`,
      apiKey
    );
    return Array.isArray(entries) && entries.length > 0 ? entries[0] : null;
  } catch (error) {
    console.error("[Clockify] fetchRunningEntry error:", error.message);
    return null;
  }
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
    lastTimeEntryUserId: data.userId || "",
    lastTimeEntryStart: body.start,
    lastTimeEntryDescription: description,
    lastTimeEntryProjectId: body.projectId || "",
    lastTimeEntryTaskId: body.taskId || "",
    lastTimeEntryTagIds: Array.isArray(body.tagIds) ? body.tagIds : []
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
        let workspaceId = settings.workspaceId;
        
        // If no workspace ID is stored, fetch the first workspace
        if (!workspaceId) {
          try {
            const workspaces = await fetchWorkspaces(settings.apiKey);
            if (Array.isArray(workspaces) && workspaces.length > 0) {
              workspaceId = workspaces[0].id;
              // Cache it for future use
              await chrome.storage.sync.set({ workspaceId });
            }
          } catch (e) {
            // Continue without caching
          }
        }
        
        if (!workspaceId) {
          throw new Error("Workspace is required.");
        }
        // Get userId from storage if available
        const storage = await chrome.storage.sync.get({
          lastTimeEntryUserId: ""
        });
        const userId = storage.lastTimeEntryUserId || null;
        const runningEntry = await fetchRunningEntry(settings.apiKey, workspaceId, userId);
        console.log("[Clockify] Running entry response:", runningEntry);
        return runningEntry;
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => {
        console.error("[Clockify] FETCH_RUNNING_ENTRY error:", error.message);
        sendResponse({ ok: false, error: error.message });
      });
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

  if (message.type === "CREATE_PROJECT") {
    getSettings()
      .then((settings) => {
        if (!settings.apiKey) {
          throw new Error("Missing API key. Open settings.");
        }
        return fetch(`${API_BASE}/workspaces/${message.workspaceId}/projects`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": settings.apiKey
          },
          body: JSON.stringify({ name: message.name })
        }).then(async (res) => {
          const text = await res.text();
          if (!res.ok) {
            throw new Error(`Clockify error ${res.status}: ${text}`);
          }
          return JSON.parse(text);
        });
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CREATE_TASK") {
    getSettings()
      .then((settings) => {
        if (!settings.apiKey) {
          throw new Error("Missing API key. Open settings.");
        }
        return fetch(`${API_BASE}/workspaces/${message.workspaceId}/projects/${message.projectId}/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": settings.apiKey
          },
          body: JSON.stringify({ name: message.name })
        }).then(async (res) => {
          const text = await res.text();
          if (!res.ok) {
            throw new Error(`Clockify error ${res.status}: ${text}`);
          }
          return JSON.parse(text);
        });
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CREATE_TAG") {
    getSettings()
      .then((settings) => {
        if (!settings.apiKey) {
          throw new Error("Missing API key. Open settings.");
        }
        return fetch(`${API_BASE}/workspaces/${message.workspaceId}/tags`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": settings.apiKey
          },
          body: JSON.stringify({ name: message.name })
        }).then(async (res) => {
          const text = await res.text();
          if (!res.ok) {
            throw new Error(`Clockify error ${res.status}: ${text}`);
          }
          return JSON.parse(text);
        });
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CHECK_TIMER_SYNC") {
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
        const runningEntry = await fetchRunningEntry(settings.apiKey, workspaceId);
        return { hasRunning: !!runningEntry };
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
