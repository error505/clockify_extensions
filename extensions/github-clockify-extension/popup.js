const statusEl = document.getElementById("status");
const stopButton = document.getElementById("stop");
const settingsButton = document.getElementById("settings");

function refreshStatus() {
  chrome.storage.sync.get({ lastTimeEntryId: "" }, (data) => {
    statusEl.textContent = data.lastTimeEntryId
      ? "Timer running"
      : "No timer running";
  });
}

stopButton.addEventListener("click", () => {
  stopButton.textContent = "Stopping...";
  chrome.runtime.sendMessage({ type: "STOP_TIMER" }, (response) => {
    stopButton.textContent = "Stop timer";
    if (!response || !response.ok) {
      statusEl.textContent = response && response.error ? response.error : "Stop failed";
      return;
    }
    refreshStatus();
  });
});

settingsButton.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
});

refreshStatus();
