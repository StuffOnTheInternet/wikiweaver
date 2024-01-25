const domain = "https://stuffontheinter.net"; // Use this for production
// const domain = "http://localhost:4242"; // Use this for local development

chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    if (event.transitionType != "link") return;

    const page = await GetWikipediaArticleTitle(event.url);
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

    const response = await fetch(`${domain}/api/ext/page`, {
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

    await IncrementPageCount(response.Success);
    await UpdateBadge(response.Success);

    lastPage[event.tabId] = page;
    await chrome.storage.session.set({ lastPage: lastPage });
  },
  { url: [{ hostSuffix: ".wikipedia.org" }] }
);

async function HandleMessageConnect(msg) {
  const options = await chrome.storage.local.get();

  let sessionStorage = await chrome.storage.session.get("lobbies");
  if (!("lobbies" in sessionStorage)) sessionStorage = { lobbies: {} };
  lobbies = sessionStorage.lobbies;

  const userid = options.code in lobbies ? lobbies[options.code] : "";

  const response = await fetch(`${domain}/api/ext/join`, {
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
    type: "connect",
    ...response,
  });
}

browser.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case "connect":
      await HandleMessageConnect(msg);
      break;

    default:
      console.log("Unrecognized message: ", msg);
      break;
  }
});

async function GetWikipediaArticleTitle(url) {
  title = decodeURIComponent(url)
    .split("wiki/")[1]
    .split("#")[0]
    .replace(/_/g, " ");

  return await SearchForWikipediaArticle(title);
}

async function SearchForWikipediaArticle(title) {
  var url = "https://en.wikipedia.org/w/api.php";

  var params = {
    action: "query",
    list: "search",
    srsearch: title,
    format: "json",
    srlimit: 1,
  };

  url = url + "?origin=*";
  Object.keys(params).forEach(function (key) {
    url += "&" + key + "=" + params[key];
  });

  response = await fetch(url)
    .then((response) => response.json())
    .then((json) => json)
    .catch(function (error) {
      console.log(error);
      return {};
    });

  if (response.query.search.length < 1) {
    return title;
  }

  return response.query.search[0].title;
}

async function GetPageCount() {
  return (await chrome.storage.session.get("pageCount")).pageCount;
}

async function SetPageCount(pageCount) {
  await chrome.storage.session.set({ pageCount });
}

async function IncrementPageCount(success) {
  await SetPageCount(((await GetPageCount()) + Number(success)) % 100);
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
