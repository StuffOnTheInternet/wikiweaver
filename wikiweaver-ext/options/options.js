async function init(e) {
  await restore();
}

async function restore() {
  const options = await chrome.storage.local.get()
  document.querySelector("#url").value = options.url;
}

async function save(e) {
  e.preventDefault();

  const urlElem = document.querySelector("#url");

  const url = new URL(urlElem.value.toLowerCase() || urlElem.placeholder);

  await chrome.storage.local.set({ url: url.origin });
  // TODO: show saved succeeded in some way

}

document.addEventListener("DOMContentLoaded", () => init(), false);
document.querySelector("form").addEventListener("submit", save);
