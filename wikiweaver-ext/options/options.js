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
  const url = new URL(urlElem.value.toLowerCase() || urlElem.placeholder);

  await Settings.local.Set("url", url.toString());
  await Settings.local.Set("autoOpenStartPage", document.querySelector("#auto-open-start-page").checked);

  // TODO: show saved succeeded in some way

  if ((await chrome.scripting.getRegisteredContentScripts({ ids: ["join-lobby"] })).length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: ["join-lobby"] });
  }

  // For some reason keeping the port here made it so the script was not
  // injected at localhost, when the server was set to http://localhost:3000
  url.port = "";

  const scripts = [
    {
      id: "join-lobby",
      js: ["/content/join-lobby.js"],
      matches: [`${url.origin}/*`],
    }
  ]

  await chrome.scripting.registerContentScripts(scripts);
}

document.addEventListener("DOMContentLoaded", () => init(), false);
document.querySelector("form").addEventListener("submit", save);
