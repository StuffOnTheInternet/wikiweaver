const domain = "https://wikiweaver.stuffontheinter.net"; // Use this for production
// const domain = "http://localhost:4242"; // Use this for local development

chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    const page = await GetWikipediaArticleTitle(event.url);

    if (!(await GetConnectionStatus()) || event.transitionType != "link") {
      await SetPreviousPageOnTab(event.tabId, page);
      return;
    }

    const previousPage = await GetPreviousPageOnTab(event.tabId);

    const options = await chrome.storage.local.get();

    const response = await fetch(`${domain}/api/ext/page`, {
      method: "POST",
      body: JSON.stringify({
        code: options.code,
        username: options.username,
        page: page,
        backmove: event.transitionQualifiers.includes("forward_back"),
        previous: previousPage,
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
    await SetPreviousPageOnTab(event.tabId, page);
  },
  { url: [{ hostSuffix: ".wikipedia.org" }] }
);

chrome.tabs.onCreated.addListener(async (event) => {
  if (event.openerTabId == undefined) return;

  const previousPage = await GetPreviousPageOnTab(event.openerTabId);
  if (previousPage == "") return;

  SetPreviousPageOnTab(event.id, previousPage);
});

async function HandleMessageConnect(msg) {
  const options = await chrome.storage.local.get();

  const userid = await GetUserIdForLobby(options.code);

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

  if (response.Success) {
    await SetPageCount(0);
    await SetUserIdForLobby(options.code, response.UserID);
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

    case "disconnect":
      await HandleMessageDisconnect(msg);
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

  return await SearchForWikipediaTitle(title);
}

async function SearchForWikipediaTitle(title) {
  // See documentation: https://en.wikipedia.org/w/api.php?action=help&modules=query

  let url = "https://en.wikipedia.org/w/api.php";

  const params = {
    action: "query", // Query Wikipedia
    gpssearch: title, // For this title
    generator: "prefixsearch", // Using prefixssearch
    gpsnamespace: 0, // Regular Wikipedia
    gpslimit: 5, // Ask for 5 pages
    redirects: "", // Resolve redirects
    format: "json", // In json format
  };

  url = url + "?origin=*";
  Object.keys(params).forEach(function (key) {
    url += "&" + key + "=" + params[key];
  });

  response = await fetch(url)
    .then((response) => response.json())
    .then((json) => json)
    .catch(function (error) {
      return { error: error };
    });

  if (!response) return "";

  if (response.error != undefined) return "";

  // Results are returned unordered, so find the best result

  const pages = response.query.pages;

  for (let [_, page] of Object.entries(pages)) {
    if (page.index === 1) return page.title;
  }

  return "";
}

async function GetStorageValue(keys, defaultValue) {
  let obj = await chrome.storage.session.get();

  for (let key of keys.slice(0, keys.length - 1)) {
    obj = obj[key];
    if (obj === undefined) obj = {};
  }

  let value = obj[keys.slice(-1)];
  if (value === undefined) value = defaultValue;

  return value;
}

async function SetStorageValue(keys, value) {
  let storage = await chrome.storage.session.get();
  let obj = storage;

  for (let key of keys.slice(0, keys.length - 1)) {
    if (obj[key] === undefined) obj[key] = {};
    obj = obj[key];
  }

  obj[keys.slice(-1)] = value;

  await chrome.storage.session.set(storage);
}

async function GetUserIdForLobby(code) {
  return await GetStorageValue(["lobbies", code], "");
}

async function SetUserIdForLobby(code, userId) {
  return await SetStorageValue(["lobbies", code], userId);
}

async function GetPreviousPageOnTab(tabId) {
  return await GetStorageValue(["previous", tabId], "");
}

async function SetPreviousPageOnTab(tabId, page) {
  return await SetStorageValue(["previous", tabId], page);
}

async function GetConnectionStatus() {
  return await GetStorageValue(["connected"], false);
}

async function SetConnectionStatus(connected) {
  return await SetStorageValue(["connected"], connected);
}

async function GetPageCount() {
  return await GetStorageValue(["pageCount"], 0);
}

async function SetPageCount(pageCount) {
  return await SetStorageValue(["pageCount"], pageCount);
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
