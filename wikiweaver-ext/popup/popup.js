async function init() {
  const options = await chrome.storage.local.get();

  if (options.code != undefined) {
    const codeElem = document.getElementById("code");
    codeElem.value = options.code;
  }

  if (options.username != undefined) {
    const usernameElem = document.getElementById("username");
    usernameElem.value = options.username;
  }

  if (options.domain != undefined) {
    const domainElem = document.getElementById("domain");
    domainElem.value = options.domain;
  }
}

document.addEventListener("click", async (e) => {
  if (e.target.id != "join") return;

  const codeElem = document.getElementById("code");
  const usernameElem = document.getElementById("username");
  const domainElem = document.getElementById("domain");

  chrome.storage.local.set({
    code: codeElem.value.toLowerCase(),
    username: usernameElem.value,
    domain: domainElem.value,
  });

  await browser.runtime.sendMessage({ type: "connect" });
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type != "connectResponse") return;

  response = message.response;

  if (response.Success) {
    var color = "--green";

    const code = (await chrome.storage.local.get("code")).code;
    let lobbies = (await chrome.storage.session.get("lobbies")).lobbies;
    if (lobbies === undefined) lobbies = {};
    lobbies[code] = response.UserID;
    await chrome.storage.session.set({ lobbies: lobbies });
  } else {
    var color = "--red";
  }

  document.getElementById("code").style.background = getComputedStyle(
    document.documentElement
  ).getPropertyValue(color);
});

document.addEventListener("DOMContentLoaded", () => init(), false);
