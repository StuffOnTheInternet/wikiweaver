async function init(e) {
  await restore();
}

async function restore() {
  const options = await chrome.storage.local.get()
  document.querySelector("#url").value = options.url || "";
}

async function save(e) {
  e.preventDefault();
  await chrome.storage.local.set({
    url: document.querySelector("#url").value.toLowerCase(),
  });
  // todo: show saved succeeded in some way
}

document.addEventListener("DOMContentLoaded", () => init(), false);
document.querySelector("form").addEventListener("submit", save);
