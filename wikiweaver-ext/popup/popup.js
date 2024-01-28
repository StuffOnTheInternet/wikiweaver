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

  let connected = await (
    await chrome.runtime.getBackgroundPage()
  ).GetConnectionStatus();

  let elements = {
    join: !connected,
    leave: connected,
  };
  EnableElements(elements);

  IndicateConnectionStatus({
    status: connected ? "connected" : "disconnected",
  });
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

async function ShouldLeavePreviousLobby() {
  const options = await chrome.storage.local.get();

  const codeElem = document.getElementById("code");
  const usernameElem = document.getElementById("username");

  if (!(await (await chrome.runtime.getBackgroundPage()).GetConnectionStatus()))
    return false;

  if (options.code != undefined && options.code != codeElem.value.toLowerCase())
    return true;

  if (options.username != undefined && options.username != usernameElem.value)
    return true;

  return false;
}

async function HandleJoinClicked(e) {
  if (await ShouldLeavePreviousLobby()) {
    HandleLeaveClicked(e);
  }

  const codeElem = document.getElementById("code");
  const usernameElem = document.getElementById("username");

  chrome.storage.local.set({
    code: codeElem.value.toLowerCase(),
    username: usernameElem.value,
  });

  IndicateConnectionStatus({ status: "pending" });
  await browser.runtime.sendMessage({ type: "connect" });
}

async function HandleLeaveClicked(e) {
  await browser.runtime.sendMessage({ type: "disconnect" });
}

document.addEventListener("click", async (e) => {
  switch (e.target.id) {
    case "join":
      await HandleJoinClicked(e);
      break;

    case "leave":
      await HandleLeaveClicked(e);
      break;

    default:
      console.log("Unhandled click event: ", e);
      break;
  }
});

async function HandleMessageConnect(msg) {
  await (
    await chrome.runtime.getBackgroundPage()
  ).SetConnectionStatus(msg.Success);

  IndicateConnectionStatus({
    status: msg.Success ? "connected" : "disconnected",
  });

  let elements = {
    join: !msg.Success,
    leave: msg.Success,
  };
  EnableElements(elements);
}

async function HandleMessageDisconnect(msg) {
  await (await chrome.runtime.getBackgroundPage()).SetConnectionStatus(false);

  IndicateConnectionStatus({ status: "disconnected" });

  let elements = {
    join: true,
    leave: false,
  };
  EnableElements(elements);
}

browser.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case "connect":
      await HandleMessageConnect(msg);
      break;

    case "disconnect":
      await HandleMessageDisconnect(msg);
      break;

    default:
      console.log("Unrecognized message: ", msg);
      break;
  }
});

function EnableElements(elements) {
  for (const elemID in elements) {
    const elem = document.getElementById(elemID);

    if (elem === undefined) {
      console.log("EnableElements: no element with ID: ", elemID);
      continue;
    }

    elem.disabled = !elements[elemID];
  }
}

document.addEventListener("DOMContentLoaded", () => init(), false);
