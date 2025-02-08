let Settings;

const ConnectionStatus = Object.freeze({
  DISCONNECTED: "red",
  PENDING: "yellow",
  CONNECTED: "green",
});

let data = reef.signal({
  connectionStatus: ConnectionStatus.DISCONNECTED,
  code: "",
  username: "",
  startPage: "",
});

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await import('../settings.js');
  Settings = settings.Settings;

  const { connected } = await Settings.session.Get();

  data.connectionStatus = connected ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED;
  data.code = await Settings.session.Get("code", "");
  data.username = await Settings.local.Get("username", "");
  data.startPage = await Settings.session.Get("startPage", "");

  if (connected) {
    await JoinLobby();
  } else {
    await LeaveLobby();
  }
}, false);

document.addEventListener("reef:signal", async (event) => {
  switch (event.detail.prop) {

    case "connectionStatus":
      switch (data.connectionStatus) {

        case ConnectionStatus.DISCONNECTED:
          data.startPage = "";
          break;
      }
      break;

    case "username":
      await Settings.local.Set("username", data.username);
      break;
  }
});

function template_main() {
  return `
    <div class="title-row">
      <img id="logo" src="../icons/48.png" height="48" width="48" />
      <span id="title" class="text">WikiWeaver</span>
    </div>
    ${template_info_text()}
    ${template_username()}
    ${template_code()}
    ${template_join_leave_button()}
    ${template_open_lobby_button()}
    ${template_open_start_page_button()}
    <button id="open-settings" class="button box text">
      Open Settings
      <span class="material-symbols-outlined">open_in_new</span>
    </button>
`;
}

function template_info_text() {
  function Text() {
    if (data.connectionStatus === ConnectionStatus.CONNECTED)
      return "Connected to lobby";
    else
      return "Create a lobby using the button below or join one using its code";
  }

  return `
    <div id="info-text" class="text">
      ${Text()}
    </div>
`;
}

function template_code() {
  const { code, connectionStatus } = data;

  function Disabled() {
    return (
      connectionStatus === ConnectionStatus.CONNECTED
    ) ? "disabled" : "";
  }

  return `
    <input
      id="code"
      class="box text"
      placeholder="code"
      maxlength="4"
      @value="${code}"
      ${Disabled()}>
    </input>
`;
}

function template_username() {
  const { connectionStatus, username } = data;

  function Disabled() {
    return (
      connectionStatus === ConnectionStatus.CONNECTED
    ) ? "disabled" : "";
  }

  return `
    <input id="username" class="box text" placeholder="username" maxlength="12" @value="${username}" ${Disabled()}>
    </input>
`;
}

function template_join_leave_button() {
  const { code, connectionStatus, username } = data;

  function Disabled() {
    return (
      code.length != 4
      || !username
    ) ? "disabled" : "";
  }

  function IsJoin() {
    return connectionStatus !== ConnectionStatus.CONNECTED;
  }

  return `
    <button id="${IsJoin() ? "join" : "leave"}" class="button box text" ${Disabled()}>
     ${IsJoin() ? "Join Lobby" : "Leave Lobby"}
    </button>
`;
}

function template_open_lobby_button() {
  let { connectionStatus } = data;

  function Text() {
    return (connectionStatus === ConnectionStatus.CONNECTED) ? "Open Lobby" : "Create Lobby";
  }

  return `
    <button id="open-lobby" class="button box text">
      ${Text()}
      <span class="material-symbols-outlined">open_in_new</span>
    </button>
`;
}

function template_open_start_page_button() {
  let { connectionStatus, startPage } = data;

  function Disabled() {
    return (
      connectionStatus !== ConnectionStatus.CONNECTED
      || !startPage
    ) ? "disabled" : "";
  }

  // TODO: if the host starts the lobby, we should enable this button
  // right now it does not react to the startPage being changed, since
  // the background script will write it to session storage, our data variable

  // TODO: right now we can open the start page even though the lobby may have
  // already ended and the start page is irrelevant

  return `
    <button id="open-start-page" class="button box text" ${Disabled()}>
      Open First Page
      <span class="material-symbols-outlined">open_in_new</span>
    </button>
`;
}

let mainElem = document.querySelector("#main");

reef.component(mainElem, template_main);

mainElem.addEventListener("input", e => {
  switch (e.target.id) {
    case "code":
      data.code = e.target.value;
      break;

    case "username":
      data.username = e.target.value;
      break;
  }
});

mainElem.addEventListener("click", async (e) => {
  switch (e.target.id) {
    case "join":
      // TODO: improve feedback when trying to join a lobby that does not exist
      data.connectionStatus = ConnectionStatus.PENDING;
      await JoinLobby();
      break;

    case "leave":
      await LeaveLobby();
      break;

    case "open-lobby":
      await OpenLobbyWebsite();
      break;

    case "open-start-page":
      await OpenFirstPage();
      break;

    case "open-settings":
      await chrome.runtime.openOptionsPage();
      break;

    default:
      // Quietly ignore
      break;
  }
});

async function JoinLobby() {
  let { code, username } = data;

  await chrome.runtime.sendMessage(
    {
      type: "connect",
      code,
      username,
    }
  );
}

async function LeaveLobby() {
  let { code, username } = data;

  data.code = "";
  data.connectionStatus = ConnectionStatus.DISCONNECTED;

  await UnregisterContentScripts();

  if (!code || !username)
    return;

  await chrome.runtime.sendMessage(
    {
      type: "disconnect",
      code,
      username,
    }
  );
}

async function OpenLobbyWebsite() {
  let { url } = await Settings.local.Get();
  let { code, connected } = await Settings.session.Get();

  await chrome.tabs.create({
    active: true,
    url: `${url}/#${connected ? code : ""}`,
  })
}

function Urlify(InString) {
  // Turns an id back into a URL
  return "https://en.wikipedia.org/wiki/" + InString
}

async function OpenFirstPage() {
  const { startPage } = await Settings.session.Get();

  if (startPage) {
    chrome.tabs.create({
      active: true,
      url: Urlify(startPage),
    })
  }
}

async function HandleMessageConnect(msg) {
  let connected = msg.Success;

  // TODO: hmm, is it only possible to register content scripts from the popup?
  // i feel like its more appropriate to do it in the background script oterhwise

  if (connected) {
    data.connectionStatus = ConnectionStatus.CONNECTED;
    await RegisterContentScripts();
  } else {
    data.connectionStatus = ConnectionStatus.DISCONNECTED;
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
    css: ["/content/style.css"],
    js: ["/content/content.js"],
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
  await chrome.scripting.unregisterContentScripts();
}

