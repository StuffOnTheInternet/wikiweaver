chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    if (event.url.includes("#")) return;
    if (event.transitionType == "reload") return;

    const options = await chrome.storage.local.get();

    let domain = "s://lofen.tplinkdns.com";
    if (options.domain == "dev") {
      domain = "://localhost:4242";
    }

    const page = pageNameFromWikipediaURL(event.url);

    const response = await fetch("http" + domain + "/api/ext/page", {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        code: options.lobby,
        username: options.username,
        page: page,
        backmove: event.transitionQualifiers.includes("forward_back"),
      }),
    });
  },
  { url: [{ hostSuffix: ".wikipedia.org" }] }
);

function pageNameFromWikipediaURL(url) {
  return decodeURI(url).split("wiki/")[1].split("#")[0].replace(/_/g, " ");
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  const options = await chrome.storage.local.get();

  let domain = "s://lofen.tplinkdns.com";
  if (options.domain == "dev") {
    domain = "://localhost:4242";
  }

  const response = await fetch("http" + domain + "/api/ext/join", {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({
      code: options.lobby,
      username: options.username,
    }),
  });
});
