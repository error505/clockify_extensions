function getIssueContext() {
  const pathParts = location.pathname.split("/").filter(Boolean);
  const owner = pathParts[0] || "";
  const repo = pathParts[1] || "";
  const number = pathParts[3] || "";
  const titleNode =
    document.querySelector("h1 span.js-issue-title") ||
    document.querySelector("h1 .js-issue-title");
  const title = titleNode ? titleNode.textContent.trim() : document.title;
  const labelNodes = Array.from(document.querySelectorAll("a.IssueLabel, span.IssueLabel"));
  const labels = labelNodes.map((node) => node.textContent.trim()).filter(Boolean);
  return {
    owner,
    repo,
    number,
    title,
    labels,
    url: location.href,
    repoFullName: owner && repo ? `${owner}/${repo}` : ""
  };
}

function insertButton() {
  if (document.getElementById("clockify-start-btn")) {
    return;
  }

  const container =
    document.querySelector(".gh-header-actions") ||
    document.querySelector(".gh-header-meta") ||
    document.querySelector(".gh-header");
  if (!container) {
    return;
  }

  const button = document.createElement("button");
  button.id = "clockify-start-btn";
  button.textContent = "Start Clockify";
  button.style.marginLeft = "8px";
  button.style.padding = "6px 10px";
  button.style.border = "1px solid #d0d7de";
  button.style.borderRadius = "6px";
  button.style.background = "#f6f8fa";
  button.style.cursor = "pointer";

  button.addEventListener("click", () => {
    button.textContent = "Starting...";
    const payload = getIssueContext();
    chrome.runtime.sendMessage({ type: "START_TIMER", payload }, (response) => {
      if (chrome.runtime.lastError) {
        button.textContent = "Error";
        return;
      }

      if (!response || !response.ok) {
        button.textContent = "Error";
        return;
      }

      button.textContent = "Started";
      setTimeout(() => {
        button.textContent = "Start Clockify";
      }, 1500);
    });
  });

  container.appendChild(button);
}

function init() {
  insertButton();
  const observer = new MutationObserver(() => insertButton());
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
