const defaultdomain = "https://wikiweaver.stuffontheinter.net";

var eventSource = null;

function Matches(url, filters) {
  for (let filter of filters) {
    if (url.match(filter)) {
      return true;
    }
  }

  return false;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tabInfo) => {
  const url = changeInfo.url;

  if (url === undefined) {
    return;
  }

  const filters = [
    new RegExp(".*://.*.thewikipediagame.com/.+"),
    new RegExp(".*://.*.thewikigame.com/group/wiki/.+"),
  ];

  if (!Matches(url, filters)) {
    // Firefox takes an optional filter argument to the addListener functions
    // that does this, but Chrome does not support it sadly. So we have to do
    // it manually.
    return;
  }

  const currentPage = await GetWikipediaArticleTitle(url);
  const previousPage = await GetPreviousPageOnTab(tabId);

  if (previousPage === currentPage) {
    // These events fire more than once for redirects, so after an url change
    // we sometimes end up on the same page. We get the exact same page name
    // since we use the Wikipedia API to disambiguate these, so we can simply
    // check here if they have the same name.
    return;
  }

  await SetPreviousPageOnTab(tabId, currentPage);

  console.log("Transition:", previousPage, "->", currentPage);

  if (!(await GetConnectionStatus())) {
    return;
  }

  // We sadly do not have any backmove information in this case
  const response = await SendPage(previousPage, currentPage);

  await IncrementPageCount(response.Success);
  await UpdateBadge(response.Success);
});

chrome.webNavigation.onCommitted.addListener(
  async (event) => {
    if (!event.url.includes("/wiki/")) {
      // Filter out Wikipedia pages which are not actually articles.
      return;
    }

    const currentPage = await GetWikipediaArticleTitle(event.url);
    const previousPage = await GetPreviousPageOnTab(event.tabId);

    if (previousPage === currentPage) {
      // Sometimes when we go to pages like
      // https://en.wikipedia.org/w/index.php?title=Stem_(linguistics)&redirect=no
      // it will seem like we went from page A -> page A, which is incorrect.
      // We basically went nowhere, so ignore this case. Links like this will
      // be disabled if the content script is allowed to run, but users will
      // have to explicitly allow it in Firefox, so we cannot rely on it.
      return;
    }

    await SetPreviousPageOnTab(event.tabId, currentPage);

    console.log("Transition:", previousPage, "->", currentPage);

    if (!(await GetConnectionStatus())) {
      return;
    }

    const backmove = event.transitionQualifiers.includes("forward_back");
    const response = await SendPage(previousPage, currentPage, backmove);

    await IncrementPageCount(response.Success);
    await UpdateBadge(response.Success);
  },
  {
    url: [{ hostSuffix: ".wikipedia.org" }],
  }
);

chrome.tabs.onCreated.addListener(async (event) => {
  if (event.openerTabId == undefined) return;

  const previousPage = await GetPreviousPageOnTab(event.openerTabId);
  if (previousPage == "") return;

  SetPreviousPageOnTab(event.id, previousPage);
});

chrome.webNavigation.onDOMContentLoaded.addListener(async (details) => {
  if (!(await GetConnectionStatus())) {
    return;
  }

  await chrome.tabs.sendMessage(details.tabId, { type: "hide" });
});

async function SendPage(previousPage, currentPage, backmove = false) {
  const options = await chrome.storage.local.get();

  const body = {
    code: options.code,
    username: options.username,
    page: currentPage,
    previous: previousPage,
    backmove: backmove,
  };

  return await SendPOSTRequestToServer(options.url, "/api/ext/page", body);
}

async function HandleMessageConnect(msg) {
  const options = await chrome.storage.local.get();
  const userid = await GetUserIdForLobby(options.code);

  const body = {
    code: options.code,
    username: options.username,
    userid: userid,
  };

  const response = await SendPOSTRequestToServer(options.url, "/api/ext/join", body);

  if (response.Success) {
    await SetPageCount(0);
    await SetUserIdForLobby(options.code, response.UserID);

    if (eventSource != null) {
      eventSource.close();
      eventSource = null;
    }

    // Server sent event reference: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
    eventSource = new EventSource(`${options.url}/api/ext/events?code=${options.code}&userid=${response.UserID}`);
    eventSource.addEventListener("start", async (e) => {
      const data = JSON.parse(e.data);
      const options = await chrome.storage.local.get();

      chrome.storage.session.set({ startPage: data.StartPage });

      if (options.autoOpenStartPage) {
        chrome.tabs.create({
          active: true,
          url: Urlify(data.StartPage)
        })
      }
    });
  }

  await UpdateBadge(response.Success);
  await SetConnectionStatus(response.Success);

  await chrome.runtime.sendMessage({
    type: "connect",
    ...response,
  });
}

async function HandleMessageDisconnect(msg) {
  const options = await chrome.storage.local.get();
  const userid = await GetUserIdForLobby(options.code);

  const body = {
    code: options.code,
    username: options.username,
    userid: userid,
  };

  // TODO: Right now we dont care about the response
  await SendPOSTRequestToServer(options.url, "/api/ext/leave", body);
}

chrome.runtime.onMessage.addListener(async (msg) => {
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

async function SendPOSTRequestToServer(url, endpoint, body) {
  console.log("sent:", body);

  let response = await fetch(`${url}${endpoint}`, {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((response) => response.json())
    .then((json) => json)
    .catch((e) => {
      return { Success: false };
    });

  console.log("recv:", response);

  return response;
}

function Urlify(InString) {
  // Turns an id back into a URL
  return "https://en.wikipedia.org/wiki/" + InString
}

async function GetWikipediaArticleTitle(url) {
  title = decodeURIComponent(url)
    .split("/")
    .pop()
    .split("#")[0]
    .replace(/_/g, " ");

  return await SearchForWikipediaTitle(title);
}

async function SearchForWikipediaTitle(title) {
  // See documentation: https://en.wikipedia.org/w/api.php?action=help&modules=query

  let url = "https://en.wikipedia.org/w/api.php";

  const params = {
    action: "query", // Query Wikipedia
    gpssearch: encodeURIComponent(title), // For this title
    generator: "prefixsearch", // Using prefixssearch
    gpsnamespace: 0, // Regular Wikipedia
    gpslimit: 5, // Ask for 5 pages
    redirects: "", // Resolve redirects
    format: "json", // In json format
  };

  url = url + "?origin=*";
  Object.keys(params).forEach(function(key) {
    url += "&" + key + "=" + params[key];
  });

  response = await fetch(url)
    .then((response) => response.json())
    .then((json) => json)
    .catch(function(error) {
      return { error: error };
    });

  if (!response || !response.query || response.error) {
    console.log(`warning: no result for Wikipedia search for '${title}'`);
    return title;
  }

  // Results are returned unordered, so find the best result

  const pages = response.query.pages;

  for (let [_, page] of Object.entries(pages)) {
    if (page.index === 1) return page.title;
  }

  console.log(`warning: no good page for Wikipedia search for '${title}'`);
  return title;
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

chrome.runtime.onInstalled.addListener(async () => {
  let options = await chrome.storage.local.get();

  const url = options.url || defaultdomain;
  const autoOpenStartPage = options.autoOpenStartPage || true;
  await chrome.storage.local.set({ url, autoOpenStartPage });
});
