async function init() {
  const options = await chrome.storage.local.get();

  if (options.code != undefined) {
    const codeElem = document.getElementById("code");
    codeElem.value = options.code;
  }

  if (options.username != undefined) {
    const usernameElem = document.getElementById("username");
    usernameElem.value = options.username;
  }

  if (options.domain != undefined) {
    const domainElem = document.getElementById("domain");
    domainElem.value = options.domain;
  }
}

document.addEventListener("click", async (e) => {
  if (e.target.id != "join") return;

  const codeElem = document.getElementById("code");
  const usernameElem = document.getElementById("username");
  const domainElem = document.getElementById("domain");

  chrome.storage.local.set({
    code: codeElem.value.toLowerCase(),
    username: usernameElem.value,
    domain: domainElem.value,
  });

  await browser.runtime.sendMessage({ type: "connect" });
});

document.addEventListener("DOMContentLoaded", () => init(), false);
