var numberOfPlayersFinished = 0;

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

  CreateNicerExample();

  document.getElementById("code").innerText = window.location.hash;
  let code = window.location.hash.replace("#", "");
  await JoinLobby(code);
}

async function HandleStartGameClicked() {
  const time = SetValueToPlaceholderIfEmpty("time-input");
  const startPage = SetValueToPlaceholderIfEmpty("start-page-input");
  const goalPage = SetValueToPlaceholderIfEmpty("goal-page-input");

  let startMessage = {
    type: "start",
    code: GetCode(),
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

function ResetLobbyClientSide() {
  ResetGraph();
  ResetPlayers();
  ResetLeaderboard();
  ResetCountdownTimer();
  ResetStartAndGoalPages();
  ResetPlayersOnNextPlayerJoin = false;
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

function GetCode() {
  return document
    .getElementById("code")
    .innerText.replace("#", "")
    .toLocaleLowerCase();
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

document.addEventListener("DOMContentLoaded", () => init(), false);
