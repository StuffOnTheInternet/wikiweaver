const connectionFailMessage = "Connection failure";

const backend = "lofen.tplinkdns.com/api";

async function API_lobbyCreate() {
  return await fetch("https://" + backend + "/web/lobby/create")
    .then((response) => response.text())
    .then((code) => {
      return code;
    })
    .catch((_) => {
      return null;
    });
}

function API_lobbyJoin(code) {
  globalThis.socket = new WebSocket(
    "wss://" + backend + "/ws/web/lobby/join" + "?code=" + code
  );

  globalThis.socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    AddNewPage(msg.Username, msg.Page);
  });
}

async function API_lobbyStatus(code) {
  return await fetch("https://" + backend + "/web/lobby/status?code=" + code)
    .then((response) => response.json())
    .then((json) => json)
    .catch((_) => {
      return null;
    });
}

async function connect() {
  document.getElementById("code").innerHTML = "Connecting to server...";

  code = localStorage.getItem("code");

  lobbyStatus = await API_lobbyStatus(code);
  if (lobbyStatus == null) {
    document.getElementById("code").innerHTML = connectionFailMessage;
    return;
  }

  if (!lobbyStatus.Active) {
    code = await API_lobbyCreate();
    if (code == null) {
      document.getElementById("code").innerHTML = connectionFailMessage;
      return;
    }
  }

  API_lobbyJoin(code);

  document.getElementById("code").innerHTML = code;
  localStorage.setItem("code", code);
}
