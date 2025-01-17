const fragment = document.createDocumentFragment();

const div = document.createElement("div");
div.classList.add("flex-horizontal-container")

// TODO: There is probably a better way to do all this
const btn = document.createElement("btn");
btn.id = "join-lobby";
btn.classList.add("button", "box", "text");
btn.onclick = HandleJoinLobbyClicked;
btn.style = "margin-top: 0.5rem; background: var(--green);";
btn.textContent = "join";

const reference = document.getElementById("leaderboard-wrapper");
const parent = document.getElementById("sidepane");

fragment.appendChild(div);
div.appendChild(btn);
parent.insertBefore(fragment, reference);

async function HandleJoinLobbyClicked() {
  const { username } = await chrome.storage.local.get();

  let code = window.location.hash.replace("#", "").toLocaleLowerCase().trim();

  await chrome.runtime.sendMessage({
    type: "connect",
    code,
    username,
  });
}
