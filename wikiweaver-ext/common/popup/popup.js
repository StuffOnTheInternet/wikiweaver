async function init() {
  const options = await chrome.storage.local.get();

  if (options.code != undefined) {
    document.getElementById("code").value = options.code;
  }

  if (options.username != undefined) {
    document.getElementById("username").value = options.username;
  }

  if ((await chrome.storage.session.get()).connected) {
    // If we think we are connected, attempt to join again just to make sure
    await HandleJoinClicked();
  } else {
    // Otherwise show that we are disconnected
    await HandleLeaveClicked();
  }
}

function IndicateConnectionStatus(connected) {
  let color = "";
  if (connected.status == "connected") {
    document.getElementById("explanation-text").hidden = true;
    document.getElementById("connected-text").hidden = false;
    color = "--green";
    UpdateBadgeColor(true);
  } else if (connected.status == "disconnected") {
    document.getElementById("explanation-text").hidden = false;
    document.getElementById("connected-text").hidden = true;
    color = "--red";
    UpdateBadgeColor(false);
  } else if (connected.status == "pending") {
    document.getElementById("explanation-text").hidden = false;
    document.getElementById("connected-text").hidden = true;
    color = "--yellow";
    UpdateBadgeColor(false);
  } else {
    console.log("invalid connected status:", connected);
  }

  document.getElementById("code").style.background = getComputedStyle(
    document.documentElement
  ).getPropertyValue(color);
}

async function UpdateBadgeColor(success) {
  let color;
  if (success) {
    color = [220, 253, 151, 255];
  } else {
    color = [250, 189, 189, 255];
  }

  chrome.action.setBadgeBackgroundColor({ color: color });
}

async function HandleJoinClicked(e) {
  const codeElem = document.getElementById("code");
  const usernameElem = document.getElementById("username");

  await chrome.storage.local.set({
    code: codeElem.value.toLowerCase(),
    username: usernameElem.value,
  });

  IndicateConnectionStatus({ status: "pending" });
  await chrome.runtime.sendMessage({ type: "connect" });
}

async function HandleLeaveClicked(e) {
  await chrome.storage.session.set({ connected: false });

  IndicateConnectionStatus({ status: "disconnected" });

  let elements = {
    join: true,
    leave: false,
  };
  EnableElements(elements);

  await UnregisterContentScripts();
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
  IndicateConnectionStatus({
    status: msg.Success ? "connected" : "disconnected",
  });

  let elements = {
    join: !msg.Success,
    leave: msg.Success,
  };
  EnableElements(elements);

  if (msg.Success) {
    await RegisterContentScripts();
  } else {
    await UnregisterContentScripts();
  }
}

chrome.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case "connect":
      await HandleMessageConnect(msg);
      break;

    default:
      console.log("Unrecognized message: ", msg);
      break;
  }
});

const ContentScripts = [
  {
    id: "content",
    css: ["../content/style.css"],
    js: ["../content/content.js"],
    matches: ["*://*.wikipedia.org/*"],
    runAt: "document_start",
  },
];

async function RegisterContentScripts() {
  if ((await chrome.scripting.getRegisteredContentScripts()).length <= 0) {
    await chrome.scripting.registerContentScripts(ContentScripts);
  }
}

async function UnregisterContentScripts() {
  await browser.scripting.unregisterContentScripts();
}

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
