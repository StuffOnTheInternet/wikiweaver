const ConnectionStatus = Object.freeze({
  DISCONNECTED: "red",
  PENDING: "yellow",
  CONNECTED: "green",
});

// This type is also defined server side
const LobbyState = Object.freeze({
  SHOWING_EXAMPLE: 0,
  RESET: 1,
  RACING: 2,
  INDLE: 3,
})

var DebounceTimeouts = {};

function Debounce(func, timeout = 500) {
  clearTimeout(DebounceTimeouts[func.name]);
  DebounceTimeouts[func.name] = setTimeout(func, timeout);
}

// ===== BEGIN REEF STUFF =====

// TODO: Would it be cleaner or more practical in some way to define multiple
// objects instead with smaller scope?
let data = reef.signal({
  code: undefined,
  isHost: false,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  lobbyState: undefined,
  countdownLeft: 0,
  countdownTotal: 0,
  countdownPlaceholder: 600,
  countdownStart: 0,
  countdownInput: "",
  startPage: "",
  startPagePlaceholder: "Gingerbread",
  startPageSuggestions: [],
  goalPage: "",
  goalPagePlaceholder: "League of Legends",
  goalPageSuggestions: [],
  players: {},
});

function template_code_and_countdown() {
  return `
    ${template_code()}
    ${template_countdown()}`
}

function template_code() {
  let { code, connectionStatus } = data;

  return `
    <div id="code" class="box text" style="background: var(--${connectionStatus})">
      ${code}
    </div>`;
}

function template_countdown() {
  let { connectionStatus, countdownInput, countdownLeft, countdownPlaceholder, countdownTotal, isHost, lobbyState } = data;

  function Value() {
    if (lobbyState === LobbyState.RACING)
      return FormatTime(countdownLeft);
    else
      return countdownTotal ? FormatTime(countdownTotal) : countdownInput;
  }

  function Disabled() {
    return (connectionStatus !== ConnectionStatus.CONNECTED
      || !isHost
      || lobbyState === LobbyState.RACING) ? "disabled" : "";
  }

  return `
    <input
      id="countdown-input"
      class="box text"
      placeholder="${FormatTime(countdownPlaceholder)}"
      @value="${Value()}"
      ${Disabled()}>
    </input>`;
}

function template_start_and_goal_page() {
  return `
    <div class="text">Start a race from</div>
      <div class="flex-vertical-container">
        ${template_start_page()}
        ${template_start_page_suggestions()}
      </div>
    <div class="text">to</div>
      <div class="flex-vertical-container">
        ${template_goal_page()}
        ${template_goal_page_suggestions()}
      </div>`;
}

function storeInputValue(event) {
  // Store values entered into input box in the appropriate variables

  if (event.target.id === "start-page-input")
    data.startPage = event.target.value;

  if (event.target.id === "goal-page-input")
    data.goalPage = event.target.value;

  if (event.target.id === "countdown-input")
    data.countdownInput = event.target.value;
}

function template_start_page() {
  let { connectionStatus, isHost, lobbyState, startPage, startPagePlaceholder } = data;

  function Disabled() {
    return (connectionStatus !== ConnectionStatus.CONNECTED
      || !isHost
      || lobbyState === LobbyState.RACING) ? "disabled" : "";
  }

  return `
    <input
      id="start-page-input"
      class="box text"
      placeholder="${startPagePlaceholder}"
      @value="${startPage}"
      ${Disabled()}>
    </input>`;
}

function template_start_page_suggestions() {
  let { startPageSuggestions } = data;
  if (startPageSuggestions.length <= 0) return "";

  function template_suggestion_items() {
    return startPageSuggestions.map(suggestion => {
      return `
      <div class="text suggestion-item">
        ${suggestion}
      </div>
`
    }).join("");
  }

  return `
    <div id="start-page-suggestions" class="suggestions">
      ${template_suggestion_items()}
    </div>
  `;
}

function template_goal_page_suggestions() {
  let { goalPageSuggestions } = data;
  if (goalPageSuggestions.length <= 0) return "";

  function template_suggestion_items() {
    return goalPageSuggestions.map(suggestion => {
      return `
      <div class="text suggestion-item">
        ${suggestion}
      </div>
`
    }).join("");
  }

  return `
    <div id="goal-page-suggestions" class="suggestions">
      ${template_suggestion_items()}
    </div>
  `;
}

function template_goal_page() {
  let { connectionStatus, isHost, lobbyState, goalPage, goalPagePlaceholder } = data;

  function Disabled() {
    return (connectionStatus !== ConnectionStatus.CONNECTED
      || !isHost
      || lobbyState === LobbyState.RACING) ? "disabled" : "";
  }

  return `
    <input
      id="goal-page-input"
      class="box text"
      placeholder="${goalPagePlaceholder}"
      @value="${goalPage}"
      ${Disabled()}>
    </input>`;
}

function SelectSuggestion(event) {
  switch (event.target.parentNode.id) {

    case "start-page-suggestions":
      data.startPage = event.target.innerText;
      data.startPageSuggestions = [];
      break;

    case "goal-page-suggestions":
      data.goalPage = event.target.innerText;
      data.goalPageSuggestions = [];
      break;
  }
}

function dispatchClick(event) {
  if (event.target.id === "start-button")
    StartRace();

  if (event.target.id === "end-button")
    EndRace();

  if (event.target.id === "reset-button")
    HandleResetClicked();

  if (event.target.classList.contains("suggestion-item"))
    SelectSuggestion(event);
}

function template_primary_buttons() {
  return `
    ${template_start_button()}
    ${template_end_button()}
    ${template_reset_button()}`;
}

function template_start_button() {
  let { connectionStatus, isHost, lobbyState } = data;

  function Disabled() {
    return (connectionStatus !== ConnectionStatus.CONNECTED
      || !isHost
      || lobbyState === LobbyState.SHOWING_EXAMPLE
      || lobbyState === LobbyState.RACING) ? "disabled" : "";
  }

  return `
    <button
      id="start-button"
      class="button box text"
      ${Disabled()}>
        start
    </button>`
}

function template_end_button() {
  let { connectionStatus, isHost, lobbyState } = data;

  function Disabled() {
    return (connectionStatus !== ConnectionStatus.CONNECTED
      || !isHost
      || lobbyState !== LobbyState.RACING) ? "disabled" : "";
  }

  return `
    <button
      id="end-button"
      class="button box text"
      ${Disabled()}>
        end
    </button>`
}

function template_reset_button() {
  let { isHost } = data;

  function Disabled() {
    return (!isHost) ? "disabled" : "";
  }

  return `
    <button
      id="reset-button"
      class="button box text"
      ${Disabled()}>
        reset
    </button>`
}

function template_leaderboard() {
  return `
    <tr>
        <th>
            <img src="assets/colors-icon.svg" height="36" width="36" />
        </th>
        <th id="leaderboard-header-username">
            <img src="assets/profile-girl-icon.svg" height="36" width="36" />
        </th>
        <th>
            <img src="assets/touch-icon.svg" height="36" width="36" />
        </th>
        <th>
            <img src="assets/page-file-icon.svg" height="36" width="36" />
        </th>
        <th>
            <img src="assets/clock-line-icon.svg" height="36" width="36" />
        </th>
    </tr>
    ${template_leaderboard_entries()}`
}

function template_leaderboard_entries() {
  let { players } = data;

  function PlayerSort(p1, p2) {
    let t1 = p1.finishTime ? p1.finishTime : Number.MAX_SAFE_INTEGER;
    let t2 = p2.finishTime ? p2.finishTime : Number.MAX_SAFE_INTEGER;
    return -((t1 !== t2 ? t1 < t2 : p1.username < p2.username) * 2 - 1);
  }


  return Object.values(players).toSorted(PlayerSort).map(({ username, clicks, pages, finishTime, color }) => {
    function Time() {
      return finishTime ? FormatTime(finishTime) : "--:--";
    }

    return `
  <tr>
    <td data-cell="color" style="color: ${CMap[color].bgcolor}">⬤</td>
    <td data-cell="username">${username}</td>
    <td data-cell="clicks">${clicks}</td>
    <td data-cell="pages">${pages}</td>
    <td data-cell="time">${Time()}</td>
  </tr>`
  }).join("");
}

let codeCountdownElem = document.querySelector("#code-and-countdown");
reef.component(codeCountdownElem, template_code_and_countdown);
codeCountdownElem.addEventListener("input", storeInputValue);

let startGoalPageElem = document.querySelector("#start-and-goal-page");
reef.component(startGoalPageElem, template_start_and_goal_page);
startGoalPageElem.addEventListener("input", storeInputValue);
startGoalPageElem.addEventListener("click", dispatchClick);

let primaryButtons = document.querySelector("#primary-buttons");
reef.component(primaryButtons, template_primary_buttons);
primaryButtons.addEventListener("click", dispatchClick);

reef.component("#leaderboard", template_leaderboard);

document.addEventListener("reef:signal", async (event) => {
  switch (event.detail.prop) {
    case "code":
      history.replaceState(null, "", `${window.location.origin}/#${data.code}`);
      break;

    case "countdownLeft":
      if (event.detail.value <= 0 && data.lobbyState === LobbyState.RACING)
        EndRace();
      break;

    case "finishTime":
      if (NumberOfPlayersFinished() >= Object.values(data.players).length)
        EndRace();
      break;

    case "lobbyState":
      data.startPageSuggestions = [];
      data.goalPageSuggestions = [];

      switch (event.detail.value) {
        case LobbyState.SHOWING_EXAMPLE:
          ResetGraph();
          ResetPlayers();
          ResetCountdownTimer();
          ResetStartAndGoalPages();
          CreateNicerExample();
          await UpdatePagePlaceholderEveryFewSeconds(10);
          break;

        case LobbyState.RESET:
          await UpdatePagePlaceholderEveryFewSeconds(10);
          break;

        case LobbyState.IDLE:
          await UpdatePagePlaceholderEveryFewSeconds(10);
          break;

        case LobbyState.RACING:
          ResetPagePlaceholderTimer();
          break;
      }
      break;

    case "startPage":
      Debounce(UpdateStartPageSuggestions);
      break;

    case "goalPage":
      Debounce(UpdateGoalPageSuggestions);
      break;
  }
});

async function GetSuggestions(title) {
  if (data.lobbyState == LobbyState.SHOWING_EXAMPLE)
    return [];

  if (data.lobbyState == LobbyState.RACING)
    return [];

  if (!title || data.startPage.startsWith("http"))
    return [];

  const suggestions = await FindSuggestions(title);

  if (suggestions.includes(title))
    return [];

  return suggestions;
}

async function UpdateStartPageSuggestions() {
  data.startPageSuggestions = await GetSuggestions(data.startPage);
}

async function UpdateGoalPageSuggestions() {
  data.goalPageSuggestions = await GetSuggestions(data.goalPage);
}

// ===== END REEF STUFF =====

async function StartRace() {
  if (!data.isHost) return;

  let startPageInput = data.startPage ? data.startPage : data.startPagePlaceholder;
  let goalPageInput = data.goalPage ? data.goalPage : data.goalPagePlaceholder;

  function GetArticleTitleFromPotentialUrl(maybeURL) {
    if (!maybeURL.startsWith("http")) {
      return maybeURL;
    }

    if (!maybeURL.includes("wikipedia")) {
      return maybeURL;
    }

    title = decodeURIComponent(maybeURL)
      .split("wiki/")[1]
      .split("#")[0]
      .replace(/_/g, " ");

    return title;
  }

  let startPageTitle = GetArticleTitleFromPotentialUrl(startPageInput);
  let goalPageTitle = GetArticleTitleFromPotentialUrl(goalPageInput);

  let startPage = await SearchForWikipediaTitle(startPageTitle);
  let goalPage = await SearchForWikipediaTitle(goalPageTitle);

  if (!startPage || !goalPage)
    return;

  if (startPage === goalPage)
    return;

  data.startPage = startPage;
  data.goalPage = goalPage;

  data.countdownTotal = data.countdownInput ? ParseTime(data.countdownInput) : data.countdownPlaceholder;

  let startMessage = {
    type: "start",
    startpage: startPage,
    goalpage: goalPage,
    countdown: data.countdownTotal,
  };
  SendMessage(startMessage);
}

async function EndRace() {
  if (!data.isHost) return;

  let endMessage = {
    type: "end",
  };
  SendMessage(endMessage);
}

async function HandleResetClicked() {
  if (!data.isHost) return;

  let resetMessage = {
    type: "reset",
  };
  SendMessage(resetMessage);
}

function HandleRedrawClicked() {
  ForceNewLayout();
}

async function HandleExportClicked() {
  // Code generated by ChatGPT

  // Convert the png data from cytoscape into a blob
  const pngData = webgraph.png();
  const byteCharacters = atob(pngData.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "image/png" });

  // Generate an invisible button that will download the blob on click, and
  // automatically click it, then remove it
  const downloadButton = document.createElement("a");
  downloadButton.href = URL.createObjectURL(blob);
  downloadButton.download = GetExportFilename();
  document.body.appendChild(downloadButton);
  downloadButton.click();
  document.body.removeChild(downloadButton);
}

function GetExportFilename() {
  let filename = "wikiweaver";

  filename = filename.concat("_");

  const d = new Date();
  filename = filename.concat(d.getFullYear());
  filename = filename.concat("-");
  filename = filename.concat(String(d.getMonth()).padStart(2, "0"));
  filename = filename.concat("-");
  filename = filename.concat(String(d.getDay()).padStart(2, "0"));

  filename = filename.concat("_");

  for (let color of ColorArray) {
    if (CMap[color].group == UNUSED) break;
    filename = filename.concat(CMap[color].group);
    filename = filename.concat("-");
  }
  filename = filename.slice(0, -1);

  filename = filename.concat("_");

  filename = filename.concat(data.startPage);

  filename = filename.concat("-");

  filename = filename.concat(data.goalPage);

  filename = filename.concat(".png");

  return filename;
}

function GetCodeFromUrl() {
  let code = window.location.hash.replace("#", "").toLocaleLowerCase().trim();

  // Make sure that the code is correctly formatted. i.e. exactly 4 letters
  const re = /^[a-zA-Z]+$/;
  if (code.length != 4 || !re.test(code)) {
    return "";
  }

  return code;
}

function ResetLobbyClientSide() {
  data.players = {};
  data.lobbyState = LobbyState.RESET;

  ResetGraph();
  ResetPlayers();
  ResetCountdownTimer();
  ResetStartAndGoalPages();
}

function ResetStartAndGoalPages() {
  data.startPage = "";
  data.goalPage = "";
}

function UpdateLeaderboard(username, clicks, pages, finishTime) {
  let player = data.players[username];


  if (!player) {
    player = { username, color: UsernameToColor(username) };
    data.players[username] = player;
  }

  player.clicks = clicks;
  player.pages = pages;
  player.finishTime = finishTime;
}

function ResetLeaderboardScores() {
  for (player of Object.values(data.players)) {
    player.clicks = 0;
    player.pages = 0;
    player.finishTime = 0;
  }
}

function NumberOfPlayersFinished() {
  return Object.values(data.players).filter(p => p.finishTime).length;
}

// ==== COUNTDOWN ===== 

var CountdownTimer;

function ZeroPad(num) {
  return String(num).padStart(2, "0");
}

function FormatTime(total) {
  const minutes = ZeroPad(Math.floor(total / 60));
  const seconds = ZeroPad(total % 60);

  return `${minutes}:${seconds}`
}

function StartCountdownTimer(StartTime, Countdown) {
  data.countdownStart = StartTime;
  data.countdownTotal = Countdown;

  clearInterval(CountdownTimer);
  CountdownTimer = setInterval(DoCountdown, 1000);
  DoCountdown();
}

function ResetCountdownTimer() {
  clearInterval(CountdownTimer);
  data.countdownTotal = 0;
  data.countdownLeft = 0;
  data.countdownStart = 0;
}

function DoCountdown() {
  const now = Math.floor(Date.now() / 1000);
  data.countdownLeft = Math.max(data.countdownTotal - (now - data.countdownStart), 0);
}

function ParseTime(time) {
  if (time.indexOf(":") == -1) {
    return Number(time);
  } else {
    const [minutes, seconds] = time.split(":");
    return Number(minutes) * 60 + Number(seconds);
  }
}

function IsNumber(time) {
  return /^\d+$/.test(time);
}

// ===== PAGE PLACEHOLDER =====

var PagePlaceholderTimer;

function ResetPagePlaceholderTimer() {
  clearInterval(PagePlaceholderTimer);
}

async function UpdatePagePlaceholderEveryFewSeconds(n) {
  await SetPagePlaceholderToRandomArticles();

  ResetPagePlaceholderTimer();
  PagePlaceholderTimer = setInterval(
    SetPagePlaceholderToRandomArticles,
    n * 1_000
  );
}

async function SetPagePlaceholderToRandomArticles() {
  let [startPage, goalPage] = await GetRandomWikipediaArticles(2);
  data.startPagePlaceholder = startPage;
  data.goalPagePlaceholder = goalPage;
}

document.addEventListener("DOMContentLoaded", async () => {
  data.lobbyState = LobbyState.SHOWING_EXAMPLE;
  data.code = GetCodeFromUrl();
  await JoinLobby();
});

