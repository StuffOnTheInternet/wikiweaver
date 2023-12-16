chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    if (event.url.includes("#")) return;
    if (event.transitionType == "reload") return;
    if (event.transitionQualifiers.includes("from_address_bar")) return;

    const domain = await GetDomain();
    const page = pageNameFromWikipediaURL(event.url);
    const options = await chrome.storage.local.get();

    let lastPage = (await chrome.storage.session.get("lastPage")).lastPage;
    if (lastPage === undefined) lastPage = {};

    if (lastPage[event.tabId] === undefined) {
      lastPage[event.tabId] = page;
      await chrome.storage.session.set({ lastPage: lastPage });
      return;
    }

    const response = await fetch(domain + "/api/ext/page", {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        code: options.code,
        username: options.username,
        page: page,
        backmove: event.transitionQualifiers.includes("forward_back"),
        previous: lastPage[event.tabId],
      }),
    });

    lastPage[event.tabId] = page;
    await chrome.storage.session.set({ lastPage: lastPage });
  },
  { url: [{ hostSuffix: ".wikipedia.org" }] }
);

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type != "connect") return;

  const domain = await GetDomain();
  const options = await chrome.storage.local.get();

  const connected = await fetch(domain + "/api/ext/join", {
    method: "POST",
    body: JSON.stringify({
      code: options.code,
      username: options.username,
    }),
  })
    .then((response) => response.ok)
    .catch((_) => false);

  await browser.runtime.sendMessage({
    type: "connectResponse",
    connected: connected,
  });
});

function pageNameFromWikipediaURL(url) {
  return decodeURI(url).split("wiki/")[1].split("#")[0].replace(/_/g, " ");
}

async function GetDomain() {
  const domain = (await chrome.storage.local.get("domain")).domain;

  if (domain == "") {
    return "https://stuffontheinter.net";
  } else if (domain == "localhost") {
    return "http://localhost:4242";
  } else {
    return domain;
  }
}
