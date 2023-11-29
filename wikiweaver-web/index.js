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

  startPage = document.getElementById("start-page-input").value;
  goalPage = document.getElementById("goal-page-input").value;

  if (!startPage) {
    console.log(`failed to start lobby: invalid start page '${startPage}'`);
    return;
  }

  if (!goalPage) {
    console.log(`failed to start lobby: invalid goal page '${goalPage}'`);
    return;
  }

  let success = await API_lobbyStart(code);
  if (!success) {
    console.log("failed to start lobby: server failed to start lobby");
    return;
  }

  StartGame(startPage, goalPage);

  document.getElementById("start-button").disabled = true;
}

document.addEventListener("DOMContentLoaded", () => init(), false);
