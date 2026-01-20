const form = document.getElementById("settings-form");
const statusEl = document.getElementById("status");

const fields = {
  apiKey: document.getElementById("apiKey"),
  labelTagMap: document.getElementById("labelTagMap"),
  quickStartEnabled: document.getElementById("quickStartEnabled")
};

function loadSettings() {
  chrome.storage.sync.get(
    {
      apiKey: "",
      labelTagMap: "{}",
      quickStartEnabled: false
    },
    (settings) => {
      Object.keys(fields).forEach((key) => {
        if (key === "quickStartEnabled") {
          fields[key].checked = Boolean(settings[key]);
        } else {
          fields[key].value = settings[key];
        }
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
    validateJson(fields.labelTagMap.value, {});
  } catch (error) {
    statusEl.textContent = "Invalid JSON in one of the fields.";
    return;
  }

  const data = {
    apiKey: fields.apiKey.value.trim(),
    labelTagMap: fields.labelTagMap.value.trim() || "{}",
    quickStartEnabled: fields.quickStartEnabled.checked,
    workspaceId: "",
    defaultProjectId: "",
    defaultTaskId: "",
    defaultTagIds: "[]",
    repoMappings: "[]"
  };

  chrome.storage.sync.set(data, () => {
    statusEl.textContent = "Saved";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 1200);
  });
});

loadSettings();
