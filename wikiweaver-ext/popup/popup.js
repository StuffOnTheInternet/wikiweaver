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

  const sessionStorage = await chrome.storage.session.get("lobbies");
  if (sessionStorage === undefined) sessionStorage = {};
  if (!("lobbies" in sessionStorage)) sessionStorage["lobbies"] = {};
  const lobbies = sessionStorage.lobbies;

  if (options.code) {
    IndicateConnectionStatus({ status: "pending" });
    await browser.runtime.sendMessage({ type: "connect" });
  }
}

function IndicateConnectionStatus(connected) {
  let color = "";
  if (connected.status == "connected") {
    color = "--green";
  } else if (connected.status == "disconnected") {
    color = "--red";
  } else if (connected.status == "pending") {
    color = "--yellow";
  } else {
    console.log("invalid connected status:", connected);
  }

  document.getElementById("code").style.background = getComputedStyle(
    document.documentElement
  ).getPropertyValue(color);
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

  IndicateConnectionStatus({ status: "pending" });
  await browser.runtime.sendMessage({ type: "connect" });
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type != "connectResponse") return;

  response = message.response;

  const code = (await chrome.storage.local.get("code")).code;
  let sessionStorage = await chrome.storage.session.get("lobbies");
  if (sessionStorage === undefined) sessionStorage = {};
  if (!("lobbies" in sessionStorage)) sessionStorage["lobbies"] = {};
  const lobbies = sessionStorage.lobbies;

  if (response.Success) {
    lobbies[code] = response.UserID;
  } else {
    delete lobbies[code];
  }

  await chrome.storage.session.set({ lobbies: lobbies });

  IndicateConnectionStatus({
    status: response.Success ? "connected" : "disconnected",
  });
});

document.addEventListener("DOMContentLoaded", () => init(), false);
