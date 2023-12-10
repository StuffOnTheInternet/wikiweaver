chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    if (event.url.includes("#")) return;
    if (event.transitionType == "reload") return;

    const domain = await GetDomain();
    const page = pageNameFromWikipediaURL(event.url);
    const options = await chrome.storage.local.get();

    const response = await fetch("http" + domain + "/api/ext/page", {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        code: options.code,
        username: options.username,
        page: page,
        backmove: event.transitionQualifiers.includes("forward_back"),
      }),
    });
  },
  { url: [{ hostSuffix: ".wikipedia.org" }] }
);

browser.runtime.onMessage.addListener(async (message, sender) => {
  const domain = await GetDomain();
  const options = await chrome.storage.local.get();

  const response = await fetch("http" + domain + "/api/ext/join", {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({
      code: options.code,
      username: options.username,
    }),
  });
});

function pageNameFromWikipediaURL(url) {
  return decodeURI(url).split("wiki/")[1].split("#")[0].replace(/_/g, " ");
}

async function GetDomain() {
  const options = await chrome.storage.local.get();

  let domain = "s://lofen.tplinkdns.com";
  if (options.domain == "dev") {
    domain = "://localhost:4242";
  }

  return domain;
}
