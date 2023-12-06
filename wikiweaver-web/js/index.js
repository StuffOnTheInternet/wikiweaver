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

  if (startPage == goalPage) {
    console.log(
      "failed to start lobby: start and goal pages cannot have the same value"
    );
    return;
  }

  startMessage = JSON.stringify({
    type: "start",
    code: code,
    startpage: startPage,
    goalpage: goalPage,
  });

  sendMessage(startMessage);
}

function SetCode(code) {
  codeElement = document.getElementById("code");
  codeElement.innerHTML = code;

  codeElement.style.background = getComputedStyle(
    document.documentElement
  ).getPropertyValue(code.length === 4 ? "--green" : "--red");
}

document.addEventListener("DOMContentLoaded", () => init(), false);
