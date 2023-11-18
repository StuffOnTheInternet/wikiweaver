chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    if (event.url.includes("#")) return;
    if (event.transitionType == "reload") return;

    const options = await chrome.storage.local.get();
    const page = event.url.split("wiki/")[1].split("#")[0].replace(/_/g, " ");

    let domain = options.domain;
    if (domain == null) {
      domain = "s://lofen.tplinkdns.com";
    }

    const response = await fetch("http" + domain + "/api/ext/page", {
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
