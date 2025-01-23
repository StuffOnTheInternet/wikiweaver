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

  await Settings.local.Set("autoOpenStartPage", document.querySelector("#auto-open-start-page").checked);

  // For some reason keeping the port here made it so the script was not
  // injected at localhost, when the server was set to http://localhost:3000
  const port = url.port;
  url.port = "";

  const host = `${url.origin}/*`;

  // We must request permissions as the first async function we call in this
  // user input handler for it to work.
  // See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request
  // and https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/User_actions
  await chrome.permissions.request({ origins: [host] });

  // What a mess...
  url.port = port;
  await Settings.local.Set("url", url.origin);

  if ((await chrome.scripting.getRegisteredContentScripts({ ids: ["join-lobby"] })).length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: ["join-lobby"] });
  }

  const scripts = [
    {
      id: "join-lobby",
      js: ["/content/join-lobby.js"],
      matches: [host],
    }
  ]

  await chrome.scripting.registerContentScripts(scripts);

  // TODO: show saved succeeded in some way
}

document.addEventListener("DOMContentLoaded", () => init(), false);
document.querySelector("#submit").addEventListener("click", save);
