function init() {
  connect();
  CreateNicerExample();
}

function HandleStartGameClicked() {
  startPage = document.getElementById("start-page-input").value;
  goalPage = document.getElementById("goal-page-input").value;
  StartGame(startPage, goalPage);
}

document.addEventListener("DOMContentLoaded", () => init(), false);
