chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    if (event.transitionType != "link") return;

    const domain = await GetDomain();
    const page = pageNameFromWikipediaURL(event.url);
    const options = await chrome.storage.local.get();

    let lastPage = (await chrome.storage.session.get("lastPage")).lastPage;
    if (lastPage === undefined) lastPage = {};

    if (lastPage[event.tabId] === undefined) {
      // The first page we send in each new tab will have the same previous
      // page and current page. This is so that we can show the badge as
      // green already on the first page.
      lastPage[event.tabId] = page;
      await chrome.storage.session.set({ lastPage: lastPage });
    }

    const response = await fetch(domain + "/api/ext/page", {
      method: "POST",
      body: JSON.stringify({
        code: options.code,
        username: options.username,
        page: page,
        backmove: event.transitionQualifiers.includes("forward_back"),
        previous: lastPage[event.tabId],
      }),
    })
      .then((response) => response.json())
      .then((json) => json)
      .catch((e) => {
        return { Success: false };
      });

    console.log("page response: ", response);

    await SetPageCount((await GetPageCount()) + Number(response.Success));
    await UpdateBadge(response.Success);

    lastPage[event.tabId] = page;
    await chrome.storage.session.set({ lastPage: lastPage });
  },
  { url: [{ hostSuffix: ".wikipedia.org" }] }
);

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type != "connect") return;

  const domain = await GetDomain();
  const options = await chrome.storage.local.get();

  let sessionStorage = await chrome.storage.session.get("lobbies");
  if (!("lobbies" in sessionStorage)) sessionStorage = { lobbies: {} };
  lobbies = sessionStorage.lobbies;

  const userid = options.code in lobbies ? lobbies[options.code] : "";

  const response = await fetch(domain + "/api/ext/join", {
    method: "POST",
    body: JSON.stringify({
      code: options.code,
      username: options.username,
      userid: userid,
    }),
  })
    .then((response) => response.json())
    .then((json) => json)
    .catch((_) => {
      return { Success: false };
    });

  console.log("join response: ", response);

  if ((await GetPageCount()) === undefined) SetPageCount(0);

  if (response.Success && !response.AlreadyInLobby) {
    await SetPageCount(0);
  }

  await UpdateBadge(response.Success);

  await browser.runtime.sendMessage({
    type: "connectResponse",
    response: response,
  });
});

function pageNameFromWikipediaURL(url) {
  return decodeURIComponent(url)
    .split("wiki/")[1]
    .split("#")[0]
    .replace(/_/g, " ");
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

async function GetPageCount() {
  return (await chrome.storage.session.get("pageCount")).pageCount;
}

async function SetPageCount(pageCount) {
  await chrome.storage.session.set({ pageCount });
}

async function UpdateBadge(success) {
  let color;
  if (success) {
    color = [220, 253, 151, 255];
  } else {
    color = [250, 189, 189, 255];
  }

  chrome.action.setBadgeBackgroundColor({ color: color });
  chrome.action.setBadgeText({ text: String(await GetPageCount()) });
}
