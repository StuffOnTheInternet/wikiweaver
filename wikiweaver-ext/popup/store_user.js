const form = document.querySelector("#connect_form");

form.addEventListener("submit", (event) => {
  chrome.storage.local.set({
    username: form.input_username.value,
    lobby: form.input_lobby.value,
    domain: form.input_domain.value,
  });
});
