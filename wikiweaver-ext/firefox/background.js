chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    if (event.url.includes("#")) return;
    if (event.transitionType == "reload") return;

    const options = await chrome.storage.local.get();
    const page = event.url.split("wiki/")[1].split("#")[0].replace(/_/g, " ");

    const response = await fetch("http://localhost:4242/api/ext/page", {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        code: options.lobby,
        username: options.username,
        page: page,
      }),
    });
  },
  { url: [{ hostSuffix: ".wikipedia.org" }] }
);
