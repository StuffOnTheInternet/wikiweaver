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

  data.lobbyState = LobbyState.IDLE;
  data.startPage = "";
  data.goalPage = "";
  ResetCountdownTimer();
}

function HandleMessageJoin(msg) {
  AddNewPlayer(msg.Username);
  UpdateLeaderboard(msg.Username, msg.Clicks, msg.Pages, msg.FinishTime);
}

function HandleMessageLobby(msg) {
  data.code = msg.Code;
  data.connectionStatus = ConnectionStatus.CONNECTED;
  data.isHost = msg.IsHost;
  data.lobbyState = msg.State;
}

function HandleMessageStart(msg) {
  if (!msg.Success) return;

  data.lobbyState = LobbyState.RACING;
  data.startPage = msg.StartPage;
  data.goalPage = msg.GoalPage;

  StartGame(msg.StartPage, msg.GoalPage);
  ResetLeaderboardScores();
  StartCountdownTimer(msg.StartTime, msg.Countdown);
}

function HandleMessagePage(msg) {
  AddNewPage(msg.Username, msg.Previous, msg.Page, msg.Backmove);
  UpdateLeaderboard(msg.Username, msg.Clicks, msg.Pages, msg.FinishTime);

  // Get rid of this?
  if (msg.FinishTime) {
    UpdateLeaderboard(msg.Username, msg.Clicks, GetPlayerDistance(msg.Username), msg.FinishTime);
  }
}

function HandleMessageReset(msg) {
  if (!msg.Success) return;

  ResetLobbyClientSide();
}

async function JoinLobby() {
  const { code } = data;

  if (globalThis.socket) {
    await globalThis.socket.close();
  }

  data.connectionStatus = ConnectionStatus.PENDING;

  globalThis.socket = new WebSocket(`/api/ws/web/join?code=${code}`);

  let PingTimer;

  globalThis.socket.addEventListener("open", (event) => {
    // Send ping every so often to keep the websocket connection alive
    PingTimer = setInterval(() => {
      SendMessage({ type: "ping" });
    }, 30000);
  });

  globalThis.socket.addEventListener("close", (event) => {
    if (PingTimer) clearInterval(PingTimer);
    if (CountdownTimer) clearInterval(CountdownTimer);
    if (PagePlaceholderTimer) clearInterval(PagePlaceholderTimer);

    data.connectionStatus = ConnectionStatus.DISCONNECTED;
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
  Object.keys(params).forEach(function(key) {
    url += "&" + key + "=" + params[key];
  });

  articles = await fetch(url)
    .then((response) => response.json())
    .then((json) => json.query.random)
    .catch(function(error) {
      console.log(error);
      return [{ title: "Gingerbread", title: "League of Legends" }];
    });

  return articles.map((article) => article.title);
}

async function SearchForWikipediaTitle(title) {
  // See documentation: https://en.wikipedia.org/w/api.php?action=help&modules=query

  let url = "https://en.wikipedia.org/w/api.php";

  const params = {
    action: "query", // Query Wikipedia
    gpssearch: encodeURIComponent(title), // For this title
    generator: "prefixsearch", // Using prefixssearch
    gpsnamespace: 0, // Regular Wikipedia
    gpslimit: 5, // Ask for 5 pages
    redirects: "", // Resolve redirects
    format: "json", // In json format
  };

  url = url + "?origin=*";
  Object.keys(params).forEach(function(key) {
    url += "&" + key + "=" + params[key];
  });

  response = await fetch(url)
    .then((response) => response.json())
    .then((json) => json)
    .catch(function(error) {
      return { error: error };
    });

  if (!response) return "";

  if (response.error != undefined) return "";

  // Results are returned unordered, so find the best result

  const pages = response.query.pages;

  for (let [_, page] of Object.entries(pages)) {
    if (page.index === 1) return page.title;
  }

  return "";
}
