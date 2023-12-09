const connectionFailMessage = "disconnected";

// const backend = "s://lofen.tplinkdns.com"; // Use this for production
const backend = "://localhost:4242"; // Use this for local development

const pingInterval = 30000; // milliseconds

async function API_lobbyCreate() {
  return await fetch("http" + backend + "/api/web/create")
    .then((response) => response.text())
    .then((code) => {
      return code;
    })
    .catch((_) => {
      return null;
    });
}

function sendMessage(message) {
  if (!globalThis.socket) {
    console.log("failed to send message, not connected to server: " + message);
    return;
  }

  globalThis.socket.send(message);
}

function API_lobbyJoin(code) {
  globalThis.socket = new WebSocket(
    "ws" + backend + "/api/ws/web/join" + "?code=" + code
  );

  globalThis.socket.addEventListener("open", (event) => {
    // Send ping every so often to keep the websocket connection alive
    interval = setInterval(() => {
      sendMessage(JSON.stringify({ type: "ping" }));
    }, pingInterval);
  });

  globalThis.socket.addEventListener("close", (event) => {
    clearInterval(interval);
    SetCode(connectionFailMessage);
  });

  globalThis.socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.Type) {
      case "pong":
        // Server is alive, good. Ignore.
        break;
      case "join":
        AddNewPlayer(msg.Username);
        AddLeaderboardEntry(msg.Username, msg.Clicks, msg.Pages);
        break;
      case "joinResponse":
        if (!msg.IsHost) {
          document.getElementById("start-page-input").disabled = true;
          document.getElementById("goal-page-input").disabled = true;
          document.getElementById("start-button").disabled = true;
          document.getElementById("pause-button").disabled = true;
        }
        break;
      case "page":
        AddNewPage(msg.Username, msg.Page, msg.TimeAdded, msg.Backmove);
        UpdateLeaderboardEntry(msg.Username, msg.Clicks, msg.Pages);
        break;
      case "start":
        document.getElementById("start-page-input").value = msg.StartPage;
        document.getElementById("goal-page-input").value = msg.GoalPage;
        StartGame(msg.StartPage, msg.GoalPage);
        break;
      case "startResponse":
        if (!msg.Success) {
          console.log("server failed to start lobby: " + msg.Reason);
          break;
        }
        startPage = document.getElementById("start-page-input").value;
        goalPage = document.getElementById("goal-page-input").value;
        StartGame(startPage, goalPage);
        break;
      default:
        console.log("Unrecognized message: ", msg);
        break;
    }
  });
}

async function API_lobbyStatus(code) {
  return await fetch("http" + backend + "/api/web/status?code=" + code)
    .then((response) => response.json())
    .then((json) => json)
    .catch((_) => {
      return null;
    });
}

async function connect() {
  if (globalThis.socket) {
    await globalThis.socket.close();
  }

  SetCode("connecting...");

  code = localStorage.getItem("code");

  lobbyStatus = await API_lobbyStatus(code);
  if (lobbyStatus == null) {
    SetCode(connectionFailMessage);
    return;
  }

  if (!lobbyStatus.Active) {
    code = await API_lobbyCreate();
    if (code == null) {
      SetCode(connectionFailMessage);
      return;
    }
  }

  API_lobbyJoin(code);

  SetCode(code);

  localStorage.setItem("code", code);
}
