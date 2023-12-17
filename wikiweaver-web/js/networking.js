const connectionFailMessage = "disconnected";

const backend = "s://stuffontheinter.net"; // Use this for production
// const backend = "://localhost:4242"; // Use this for local development

const pingInterval = 30000; // milliseconds

var ResetOnNextPlayerJoin = true;

function sendMessage(message) {
  if (!globalThis.socket) {
    console.log("failed to send message, not connected to server: " + message);
    return;
  }

  globalThis.socket.send(message);
}

function HandleMessageGameover(msg) {
  if (msg.IsHost) {
    SetInputEnabled(true);
  }

  SetTime(msg.Countdown);
}

function HandleMessageJoin(msg) {
  if (ResetOnNextPlayerJoin) {
    ResetLobbyClientSide();
  }

  AddNewPlayer(msg.Username);
  AddLeaderboardEntry(msg.Username, msg.Clicks, msg.Pages, msg.FinishTime);
  MaybeEnableStartButton();
}

function HandleMessageLobby(msg) {
  if (!msg.IsHost) {
    SetInputEnabled(false);
  }
  SetCode(msg.Code, "connected");
  window.location.hash = `#${msg.Code}`;
}

function HandleMessageStart(msg) {
  if (!msg.Success) {
    console.log("server failed to start lobby");
    return;
  }

  document.getElementById("start-page-input").value = msg.StartPage;
  document.getElementById("goal-page-input").value = msg.GoalPage;
  document.getElementById("time-input").value = FormatTime(msg.Countdown);
  StartGame(msg.StartPage, msg.GoalPage);
  ResetLeaderboardScores();
  StartCountdownTimer();
}

function HandleMessagePage(msg) {
  AddNewPage(msg.Username, msg.Page, msg.TimeAdded, msg.Backmove);
  UpdateLeaderboardEntry(msg.Username, msg.Clicks, msg.Pages, msg.FinishTime);

  if (msg.FinishTime) {
    MoveLeaderboardEntry(msg.Username, numberOfPlayersFinished);
    numberOfPlayersFinished += 1;
  }
}

function HandleMessageReset(msg) {
  ResetLobbyClientSide();

  if (msg.IsHost) {
    SetInputEnabled(true);
  }
}

async function JoinLobby(code) {
  if (globalThis.socket) {
    await globalThis.socket.close();
  }

  SetCode("connecting...", "pending");

  globalThis.socket = new WebSocket(
    "ws" + backend + "/api/ws/web/join" + "?code=" + code
  );

  let interval = undefined;

  globalThis.socket.addEventListener("open", (event) => {
    // Send ping every so often to keep the websocket connection alive
    interval = setInterval(() => {
      sendMessage(JSON.stringify({ type: "ping" }));
    }, pingInterval);
  });

  globalThis.socket.addEventListener("close", (event) => {
    if (interval) clearInterval(interval);
    SetCode(connectionFailMessage, "disconnected");
    ResetCountdownTimer();
  });

  globalThis.socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.Type) {
      case "gameover":
        HandleMessageGameover(msg);
        break;

      case "join":
        HandleMessageJoin(msg);
        break;

      case "lobby":
        HandleMessageLobby(msg);
        break;

      case "page":
        HandleMessagePage(msg);
        break;

      case "pong":
        // Server is alive, good. Ignore.
        break;

      case "reset":
        HandleMessageReset(msg);
        break;

      case "start":
        HandleMessageStart(msg);
        break;

      default:
        console.log("Unrecognized message: ", msg);
        break;
    }
  });
}
