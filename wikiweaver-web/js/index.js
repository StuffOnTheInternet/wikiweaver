var numberOfPlayersFinished = 0;

function init() {
  connect();
  CreateNicerExample();
}

async function HandleStartGameClicked() {
  if (!StartButtonShouldBeEnabled()) return;

  const code = localStorage.getItem("code");
  const time = document.getElementById("time-input").value;
  const startPage = document.getElementById("start-page-input").value;
  const goalPage = document.getElementById("goal-page-input").value;

  let startMessage = JSON.stringify({
    type: "start",
    code: code,
    startpage: startPage,
    goalpage: goalPage,
    countdown: ParseTime(time),
  });
  sendMessage(startMessage);

  SetInputEnabled(false);
  document.getElementById("reset-button").disabled = false;
}

async function HandleResetClicked() {
  ResetLobbyClientSide();
  let resetMessage = JSON.stringify({
    type: "reset",
  });
  sendMessage(resetMessage);
}

function ResetLobbyClientSide() {
  ResetGraph();
  ResetPlayers();
  ResetLeaderboard();
  ResetCountdownTimer();
  ResetStartAndGoalPages();
  ResetOnNextPlayerJoin = false;
}

function ResetStartAndGoalPages() {
  document.getElementById("start-page-input").value = "";
  document.getElementById("goal-page-input").value = "";
}

function HandleRedrawClicked() {
  ForceNewLayout();
}

function SetInputEnabled(enabled) {
  document.getElementById("start-page-input").disabled = !enabled;
  document.getElementById("goal-page-input").disabled = !enabled;
  document.getElementById("time-input").disabled = !enabled;
  MaybeEnableStartButton();
  document.getElementById("reset-button").disabled = !enabled;
}

function HandleInputChanged() {
  MaybeEnableStartButton();
}

function StartButtonShouldBeEnabled() {
  let code = localStorage.getItem("code");
  if (code == undefined) return false;

  if (ResetOnNextPlayerJoin) return false;
  if (NumberOfPlayersInLobby() < 1) return false;

  const time = document.getElementById("time-input").value;
  if (!IsValidTime(time)) return false;

  let startPage = document.getElementById("start-page-input").value;
  let goalPage = document.getElementById("goal-page-input").value;
  if (!startPage) return false;
  if (!goalPage) return false;
  if (startPage == goalPage) return false;

  return true;
}

function MaybeEnableStartButton() {
  document.getElementById("start-button").disabled =
    !StartButtonShouldBeEnabled();
}

function HandleNewPlayer(p) {
  AddNewPlayer(p.Username);
  AddLeaderboardEntry(p.Username, p.Clicks, p.Pages, p.FinishTime);
}

function HandleNewPage(p) {
  AddNewPage(p.Username, p.Page, p.TimeAdded, p.Backmove);
  UpdateLeaderboardEntry(p.Username, p.Clicks, p.Pages, p.FinishTime);

  if (p.FinishTime) {
    MoveLeaderboardEntry(p.Username, numberOfPlayersFinished);
    numberOfPlayersFinished += 1;
  }
}

function SetCode(code, status) {
  let codeElement = document.getElementById("code");
  codeElement.innerHTML = code;

  let color = "";
  let textTransform = "";

  if (status == "connected") {
    color = "--green";
    textTransform = "uppercase";
    SetInputEnabled(true);
  } else if (status == "disconnected") {
    color = "--red";
    textTransform = "none";
    SetInputEnabled(false);
    document.getElementById("reset-button").disabled = false;
  } else if (status == "pending") {
    color = "--yellow";
    textTransform = "none";
    SetInputEnabled(false);
    document.getElementById("reset-button").disabled = false;
  } else {
    console.log("unrecognized connection status", status);
  }

  codeElement.style.background = getComputedStyle(
    document.documentElement
  ).getPropertyValue(color);
  codeElement.style.textTransform = textTransform;
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
}

var CountdownTimer;

function StartCountdownTimer() {
  clearInterval(CountdownTimer);
  CountdownTimer = setInterval(DoCountdown, 1000);
  document.getElementById("time-input").disabled = true;
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
    time = 0;
    ResetCountdownTimer();

    let resetMessage = JSON.stringify({
      type: "gameover",
    });
    sendMessage(resetMessage);
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

document.addEventListener("DOMContentLoaded", () => init(), false);
