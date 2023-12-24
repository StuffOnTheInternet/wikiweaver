var numberOfPlayersFinished = 0;
var isHost = false;

async function init() {
  const elements = {
    "time-input": false,
    "start-page-input": false,
    "goal-page-input": false,
    "start-button": false,
    "end-button": false,
    "reset-button": false,
  };
  EnableElements(elements);

  UpdatePagePlaceholderEveryFewSeconds(10);

  CreateNicerExample();

  let code = GetCodeFromHash();
  SetCode(code);
  await JoinLobby(code);
}

async function HandleStartGameClicked() {
  const time = SetValueToPlaceholderIfEmpty("time-input");
  const startPage = SetValueToPlaceholderIfEmpty("start-page-input");
  const goalPage = SetValueToPlaceholderIfEmpty("goal-page-input");

  let startMessage = {
    type: "start",
    startpage: startPage,
    goalpage: goalPage,
    countdown: ParseTime(time),
  };
  SendMessage(startMessage);
}

async function HandleEndClicked() {
  let endMessage = {
    type: "end",
  };
  SendMessage(endMessage);
}

function HandleRedrawClicked() {
  ForceNewLayout();
}

async function HandleResetClicked() {
  let resetMessage = {
    type: "reset",
  };
  SendMessage(resetMessage);
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

  filename = filename.concat(".png");

  return filename;
}

function SetValueToPlaceholderIfEmpty(elementID) {
  elem = document.getElementById(elementID);
  if (elem.value === "") elem.value = elem.placeholder;
  return elem.value;
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

function ShowElements(elements) {
  for (const elemID in elements) {
    const elem = document.getElementById(elemID);

    if (elem === undefined) {
      console.log("EnableElements: no element with ID: ", elemID);
      continue;
    }

    elem.hidden = !elements[elemID];
  }
}

function ResetLobbyClientSide() {
  ResetGraph();
  ResetPlayers();
  ResetLeaderboard();
  ResetCountdownTimer();
  ResetStartAndGoalPages();
}

function ResetStartAndGoalPages() {
  document.getElementById("start-page-input").value = "";
  document.getElementById("goal-page-input").value = "";
}

function UpdateConnectionStatusIndication(status) {
  let codeElement = document.getElementById("code");

  let color = "";

  if (status == "connected") {
    color = "--green";
  } else if (status == "disconnected") {
    color = "--red";
  } else if (status == "pending") {
    color = "--yellow";
  } else {
    console.log("unrecognized connection status", status);
  }

  codeElement.style.background = getComputedStyle(
    document.documentElement
  ).getPropertyValue(color);
}

function GetCodeFromHash() {
  return window.location.hash.replace("#", "").toLocaleLowerCase();
}

function SetCode(code) {
  window.location.hash = `#${code}`;
  document.getElementById("code").innerText = code;
}

function AddLeaderboardEntry(username, clicks, pages) {
  let color = UsernameToColor(username);
  if (color === undefined) return;

  leaderboard = document.getElementById("leaderboard");
  leaderboard.firstElementChild.insertAdjacentHTML(
    "beforeend",
    `<tr id="leaderboard-row-${username}">
  <td data-cell="color" style="color: ${CMap[color].bgcolor}">⬤</td>
  <td data-cell="username">${username}</td>
  <td data-cell="clicks">${clicks}</td>
  <td data-cell="pages">${pages}</td>
  <td data-cell="time">--:--</td>
</tr>`
  );
}

function UpdateLeaderboardEntry(username, clicks, pages, time) {
  row = document.getElementById(`leaderboard-row-${username}`).children;
  row[2].innerHTML = clicks;
  row[3].innerHTML = pages;

  if (time) {
    row[4].innerHTML = FormatTime(time);
  }
}

function MoveLeaderboardEntry(username, position) {
  const row = document.getElementById(`leaderboard-row-${username}`);
  row.remove();

  const leaderboard = document.getElementById("leaderboard");
  const rows = leaderboard.firstElementChild.children;

  if (position >= rows.length) position = rows.length - 1;

  rows[position].after(row);
}

function ResetLeaderboard() {
  leaderboard = document.getElementById("leaderboard");

  // Do not remove the leaderboard header
  const [_, ...rows] = leaderboard.firstElementChild.children;
  for (let elem of rows) {
    elem.remove();
  }

  numberOfPlayersFinished = 0;
}

function ResetLeaderboardScores() {
  leaderboard = document.getElementById("leaderboard");

  const [_, ...rows] = leaderboard.firstElementChild.children;
  for (let row of rows) {
    let [_, __, clicks, pages, time] = row.children;
    clicks.innerHTML = 0;
    pages.innerHTML = 0;
    time.innerHTML = "--:--";
  }

  numberOfPlayersFinished = 0;
}

var CountdownTimer;

function StartCountdownTimer() {
  clearInterval(CountdownTimer);
  CountdownTimer = setInterval(DoCountdown, 1000);
}

function ResetCountdownTimer() {
  clearInterval(CountdownTimer);
  document.getElementById("time-input").value = "";
}

function DoCountdown() {
  timeElem = document.getElementById("time-input");

  if (timeElem.value == "") {
    ResetCountdownTimer();
    return;
  }

  let time = ParseTime(timeElem.value);
  time -= 1;

  if (time <= 0) {
    HandleEndClicked();
    return;
  }

  timeElem.value = FormatTime(time);
}

function SetTime(time) {
  document.getElementById("time-input").value = FormatTime(time);
}

function ZeroPad(num, places) {
  return String(num).padStart(places, "0");
}

function FormatTime(time) {
  const minutes = ZeroPad(Math.floor(time / 60), 2);
  const seconds = ZeroPad(time % 60, 2);
  return `${minutes}:${seconds}`;
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

function IsValidTime(time) {
  time = time.trim();

  if (!time) return false;

  if (time.indexOf(":") == -1) {
    // A maximum of three digits long, interpreted as seconds
    return (
      0 <= time.length &&
      time.length <= 4 &&
      IsNumber(time) &&
      Number(time) < 6000
    );
  } else {
    // Two numbers separated by a colon, e.g. 10:00
    const [minutes, seconds] = time.split(":");
    return (
      minutes.length <= 2 &&
      IsNumber(minutes) &&
      seconds.length <= 2 &&
      IsNumber(seconds)
    );
  }
}

var PagePlaceholderTimer;

function UpdatePagePlaceholderEveryFewSeconds(n) {
  SetPagePlaceholderToRandomArticles();

  clearInterval(PagePlaceholderTimer);
  PagePlaceholderTimer = setInterval(
    SetPagePlaceholderToRandomArticles,
    n * 1_000
  );
}

async function SetPagePlaceholderToRandomArticles() {
  let [startPage, goalPage] = await GetRandomWikipediaArticles(2);
  document.getElementById("start-page-input").placeholder = startPage;
  document.getElementById("goal-page-input").placeholder = goalPage;
}

document.addEventListener("DOMContentLoaded", () => init(), false);
