const btn = document.getElementById("join-button");
btn.onclick = JoinLobby;
btn.hidden = false;

async function JoinLobby() {
  let code = window.location.hash.replace("#", "").toLocaleLowerCase().trim();

  await chrome.runtime.sendMessage({
    type: "connect",
    code,
  });
}

