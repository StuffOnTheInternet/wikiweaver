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
    document.getElementById("explanation-text").hidden = true;
    document.getElementById("connected-text").hidden = false;
    color = "--green";
  } else if (connected.status == "disconnected") {
    document.getElementById("explanation-text").hidden = false;
    document.getElementById("connected-text").hidden = true;
    color = "--red";
  } else if (connected.status == "pending") {
    document.getElementById("explanation-text").hidden = false;
    document.getElementById("connected-text").hidden = true;
    color = "--yellow";
  } else {
    console.log("invalid connected status:", connected);
  }

  document.getElementById("code").style.background = getComputedStyle(
    document.documentElement
  ).getPropertyValue(color);
}

async function HandleJoinClicked(e) {
  const codeElem = document.getElementById("code");
  const usernameElem = document.getElementById("username");

  chrome.storage.local.set({
    code: codeElem.value.toLowerCase(),
    username: usernameElem.value,
  });

  IndicateConnectionStatus({ status: "pending" });
  await browser.runtime.sendMessage({ type: "connect" });
}

document.addEventListener("click", async (e) => {
  switch (e.target.id) {
    case "join":
      await HandleJoinClicked(e);
      break;

    default:
      console.log("Unhandled click event: ", e);
      break;
  }
});

async function HandleMessageConnect(msg) {
  const code = (await chrome.storage.local.get("code")).code;
  let sessionStorage = await chrome.storage.session.get("lobbies");
  if (sessionStorage === undefined) sessionStorage = {};
  if (!("lobbies" in sessionStorage)) sessionStorage["lobbies"] = {};
  const lobbies = sessionStorage.lobbies;

  if (msg.Success) {
    lobbies[code] = msg.UserID;
  }

  await chrome.storage.session.set({ lobbies: lobbies });

  IndicateConnectionStatus({
    status: msg.Success ? "connected" : "disconnected",
  });
}

browser.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case "connect":
      await HandleMessageConnect(msg);
      break;

    default:
      console.log("Unrecognized message: ", msg);
      break;
  }
});

document.addEventListener("DOMContentLoaded", () => init(), false);
