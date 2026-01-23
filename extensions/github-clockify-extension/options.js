const form = document.getElementById("settings-form");
const statusEl = document.getElementById("status");

const fields = {
  apiKey: document.getElementById("apiKey"),
  quickStartEnabled: document.getElementById("quickStartEnabled")
};

function loadSettings() {
  chrome.storage.sync.get(
    {
      apiKey: "",
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  statusEl.textContent = "";

  const data = {
    apiKey: fields.apiKey.value.trim(),
    quickStartEnabled: fields.quickStartEnabled.checked,
    workspaceId: "",
    defaultProjectId: "",
    defaultTaskId: "",
    defaultTagIds: "[]",
    repoMappings: "[]",
    labelTagMap: "{}"
  };

  chrome.storage.sync.set(data, () => {
    statusEl.textContent = "Saved";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 1200);
  });
});

loadSettings();
