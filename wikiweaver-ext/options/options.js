let Settings;

async function init(e) {
  const settings = await import('../settings.js');
  Settings = settings.Settings;

  await restore();
}

async function restore() {
  const { url, autoOpenStartPage } = await Settings.local.Get();

  document.querySelector("#url").value = url;
  document.querySelector("#auto-open-start-page").checked = autoOpenStartPage;
}

async function save(e) {
  e.preventDefault();

  const urlElem = document.querySelector("#url");

  await Settings.local.Set("url", urlElem.value.toLowerCase() || urlElem.placeholder);
  await Settings.local.Set("autoOpenStartPage", document.querySelector("#auto-open-start-page").checked);

  // TODO: show saved succeeded in some way
}

document.addEventListener("DOMContentLoaded", () => init(), false);
document.querySelector("form").addEventListener("submit", save);
