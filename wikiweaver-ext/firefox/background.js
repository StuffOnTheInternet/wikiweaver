chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    if (event.url.includes("#")) return;
    if (event.transitionType == "reload") return;

    const domain = await GetDomain();
    const page = pageNameFromWikipediaURL(event.url);
    const options = await chrome.storage.local.get();

    const response = await fetch(domain + "/api/ext/page", {
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

  const response = await fetch(domain + "/api/ext/join", {
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
  const domain = (await chrome.storage.local.get("domain")).domain;

  if (domain == "") {
    return "https://lofen.tplinkdns.com";
  } else if (domain == "localhost") {
    return "http://localhost:4242";
  } else {
    return domain;
  }
}
