const domain = "wss://stuffontheinter.net"; // Use this for production
// const domain = "ws://localhost:4242"; // Use this for local development

const pingInterval = 30000; // milliseconds

function SendMessage(msg) {
  if (!globalThis.socket) {
    console.log("not connected to server, wont send message: " + msg);
    return;
  }

  globalThis.socket.send(JSON.stringify(msg));

  console.log("sent message:", msg);
}

function HandleMessageEnd(msg) {
  if (!msg.Success) return;

  const elements = {
    "time-input": isHost,
    "start-page-input": isHost,
    "goal-page-input": isHost,
    "start-button": isHost,
    "end-button": false,
  };
  EnableElements(elements);

  ResetCountdownTimer();
  SetTime(msg.Countdown);
}

function HandleMessageJoin(msg) {
  let elements = {
    "no-players-text": false,
    "extension-text": false,
  };
  ShowElements(elements);

  AddNewPlayer(msg.Username);
  AddLeaderboardEntry(msg.Username, msg.Clicks, msg.Pages, msg.FinishTime);
}

function HandleMessageLobby(msg) {
  isHost = msg.IsHost;

  let elements = {
    "time-input": false,
    "start-page-input": false,
    "goal-page-input": false,
    "start-button": false,
    "end-button": false,
    "reset-button": isHost,
  };
  EnableElements(elements);

  elements = {
    "extension-text": false,
    "disconnect-text": false,
    "spectator-text": !isHost,
    "example-text": isHost,
  };
  ShowElements(elements);

  UpdateConnectionStatusIndication("connected");

  SetCode(msg.Code);
}

function HandleMessageStart(msg) {
  if (!msg.Success) return;

  const elements = {
    "time-input": false,
    "start-page-input": false,
    "goal-page-input": false,
    "start-button": false,
    "redraw-button": true,
    "export-button": true,
    "end-button": isHost,
  };
  EnableElements(elements);

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

    if (numberOfPlayersFinished == NumberOfPlayersInLobby()) {
      HandleEndClicked();
    }
  }
}

function HandleMessageReset(msg) {
  if (!msg.Success) return;

  let elements = {
    "time-input": isHost,
    "start-page-input": isHost,
    "goal-page-input": isHost,
    "start-button": isHost,
    "redraw-button": false,
    "export-button": false,
    "end-button": false,
  };
  EnableElements(elements);

  elements = {
    "extension-text": isHost,
    "disconnect-text": false,
    "spectator-text": !isHost,
    "example-text": false,
    "no-players-text": true,
  };
  ShowElements(elements);

  ResetLobbyClientSide();
}

async function JoinLobby(code) {
  if (globalThis.socket) {
    await globalThis.socket.close();
  }

  UpdateConnectionStatusIndication("pending");

  globalThis.socket = new WebSocket(`${domain}/api/ws/web/join?code=${code}`);

  let PingTimer;

  globalThis.socket.addEventListener("open", (event) => {
    // Send ping every so often to keep the websocket connection alive
    PingTimer = setInterval(() => {
      SendMessage({ type: "ping" });
    }, pingInterval);
  });

  globalThis.socket.addEventListener("close", (event) => {
    if (PingTimer) clearInterval(PingTimer);
    if (CountdownTimer) clearInterval(CountdownTimer);
    if (PagePlaceholderTimer) clearInterval(PagePlaceholderTimer);

    UpdateConnectionStatusIndication("disconnected");

    let elements = {
      "time-input": false,
      "start-page-input": false,
      "goal-page-input": false,
      "start-button": false,
      "end-button": false,
      "reset-button": false,
    };
    EnableElements(elements);

    elements = {
      "extension-text": false,
      "disconnect-text": true,
      "spectator-text": false,
      "example-text": false,
      "no-players-text": false,
    };
    ShowElements(elements);
  });

  globalThis.socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);

    console.log("recv message:", msg);

    switch (msg.Type) {
      case "end":
        HandleMessageEnd(msg);
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

async function GetRandomWikipediaArticles(n) {
  let url = "https://en.wikipedia.org/w/api.php";

  let params = {
    action: "query",
    format: "json",
    list: "random",
    rnlimit: n,
    rnnamespace: "0",
  };

  url = url + "?origin=*";
  Object.keys(params).forEach(function (key) {
    url += "&" + key + "=" + params[key];
  });

  articles = await fetch(url)
    .then((response) => response.json())
    .then((json) => json.query.random)
    .catch(function (error) {
      console.log(error);
      return [{ title: "Gingerbread", title: "League of Legends" }];
    });

  return articles.map((article) => article.title);
}
