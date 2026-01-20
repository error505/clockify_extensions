const form = document.getElementById("settings-form");
const statusEl = document.getElementById("status");

const fields = {
  apiKey: document.getElementById("apiKey"),
  workspaceId: document.getElementById("workspaceId"),
  defaultProjectId: document.getElementById("defaultProjectId"),
  defaultTaskId: document.getElementById("defaultTaskId"),
  defaultTagIds: document.getElementById("defaultTagIds"),
  repoMappings: document.getElementById("repoMappings"),
  labelTagMap: document.getElementById("labelTagMap")
};

function loadSettings() {
  chrome.storage.sync.get(
    {
      apiKey: "",
      workspaceId: "",
      defaultProjectId: "",
      defaultTaskId: "",
      defaultTagIds: "[]",
      repoMappings: "[]",
      labelTagMap: "{}"
    },
    (settings) => {
      Object.keys(fields).forEach((key) => {
        fields[key].value = settings[key];
      });
    }
  );
}

function validateJson(value, fallback) {
  if (!value.trim()) {
    return fallback;
  }
  return JSON.parse(value);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  statusEl.textContent = "";

  try {
    validateJson(fields.defaultTagIds.value, []);
    validateJson(fields.repoMappings.value, []);
    validateJson(fields.labelTagMap.value, {});
  } catch (error) {
    statusEl.textContent = "Invalid JSON in one of the fields.";
    return;
  }

  const data = {
    apiKey: fields.apiKey.value.trim(),
    workspaceId: fields.workspaceId.value.trim(),
    defaultProjectId: fields.defaultProjectId.value.trim(),
    defaultTaskId: fields.defaultTaskId.value.trim(),
    defaultTagIds: fields.defaultTagIds.value.trim() || "[]",
    repoMappings: fields.repoMappings.value.trim() || "[]",
    labelTagMap: fields.labelTagMap.value.trim() || "{}"
  };

  chrome.storage.sync.set(data, () => {
    statusEl.textContent = "Saved";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 1200);
  });
});

loadSettings();
