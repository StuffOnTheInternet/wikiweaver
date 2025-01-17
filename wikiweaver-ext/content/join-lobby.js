const btn = document.getElementById("join-button");
btn.onclick = HandleJoinLobbyClicked;
btn.hidden = false;

async function HandleJoinLobbyClicked() {
  const { username } = await chrome.storage.local.get();

  let code = window.location.hash.replace("#", "").toLocaleLowerCase().trim();

  await chrome.runtime.sendMessage({
    type: "connect",
    code,
    username,
  });
}
