function init() {
  connect();
  CreateNicerExample();
}

async function HandleStartGameClicked() {
  let code = localStorage.getItem("code");

  if (code == undefined) {
    console.log("failed to start lobby: code is undefined");
    return;
  }

  if (ResetOnNextPlayerJoin) {
    console.log("failed to start lobby: no players connected to lobby");
    return;
  }

  const time = document.getElementById("time-input").value;
  if (!IsValidTime(time)) {
    console.log("failed to start lobby: invalid time");
    return;
  }

  let startPage = document.getElementById("start-page-input").value;
  let goalPage = document.getElementById("goal-page-input").value;

  if (!startPage) {
    console.log(`failed to start lobby: invalid start page '${startPage}'`);
    return;
  }

  if (!goalPage) {
    console.log(`failed to start lobby: invalid goal page '${goalPage}'`);
    return;
  }

  if (startPage == goalPage) {
    console.log(
      "failed to start lobby: start and goal pages cannot have the same value"
    );
    return;
  }

  let startMessage = JSON.stringify({
    type: "start",
    code: code,
    startpage: startPage,
    goalpage: goalPage,
    countdown: ParseTime(time),
  });

  sendMessage(startMessage);
}

function HandleRedrawClicked() {
  ForceNewLayout();
}

function SetCode(code) {
  let codeElement = document.getElementById("code");
  codeElement.innerHTML = code;

  let color = "--red";
  let textTransform = "none";

  if (code.length === 4) {
    color = "--green";
    textTransform = "uppercase";
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
  <td data-cell="color" style="color: ${color}">⬤</td>
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

function ClearLeaderboard() {
  leaderboard = document.getElementById("leaderboard");

  // Dont not remove the leaderboard header
  const [_, ...rows] = leaderboard.firstElementChild.children;
  for (let elem of rows) {
    elem.remove();
  }
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

function DoCountdown() {
  timeElem = document.getElementById("time-input");

  let time = ParseTime(timeElem.value);
  time -= 1;

  if (time <= 0) {
    time = 0;
    clearInterval(CountdownTimer);
    document.getElementById("time-input").disabled = false;
    document.getElementById("time-input").value = "";
  }

  timeElem.value = FormatTime(time);
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
