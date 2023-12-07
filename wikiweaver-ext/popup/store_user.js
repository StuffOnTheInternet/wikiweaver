async function init() {
  const form = document.querySelector("#connect_form");

  form.addEventListener("submit", (event) => {
    chrome.storage.local.set({
      username: form.input_username.value,
      lobby: form.input_lobby.value,
      domain: form.input_domain.value,
    });
  });

  const options = await chrome.storage.local.get();

  if (options.username != undefined) {
    form.input_username.value = options.username;
  }

  if (options.lobby != undefined) {
    form.input_lobby.value = options.lobby;
  }

  if (options.domain != undefined) {
    form.input_domain.value = options.domain;
  }
}

document.addEventListener("click", async (e) => {
  if (e.target.id != "connect") return;

  await browser.runtime.sendMessage({ type: "connect" });
});

document.addEventListener("DOMContentLoaded", () => init(), false);
