import { Settings } from './settings.js';

var eventSource = null;

function Matches(url, filters) {
  for (let filter of filters) {
    if (url.match(filter)) {
      return true;
    }
  }

  return false;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
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
  const previousPage = await Settings.session.Get(["previous-page-on-tab", tabId]);

  if (previousPage === currentPage) {
    // These events fire more than once for redirects, so after an url change
    // we sometimes end up on the same page. We get the exact same page name
    // since we use the Wikipedia API to disambiguate these, so we can simply
    // check here if they have the same name.
    return;
  }

  await Settings.session.Set(["previous-page-on-tab", tabId], currentPage);

  console.log("Transition:", previousPage, "->", currentPage);

  const { connected } = await Settings.session.Get();

  if (!connected) {
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
    const previousPage = await Settings.session.Get(["previous-page-on-tab", event.tabId], "");

    if (previousPage === currentPage) {
      // Sometimes when we go to pages like
      // https://en.wikipedia.org/w/index.php?title=Stem_(linguistics)&redirect=no
      // it will seem like we went from page A -> page A, which is incorrect.
      // We basically went nowhere, so ignore this case. Links like this will
      // be disabled if the content script is allowed to run, but users will
      // have to explicitly allow it in Firefox, so we cannot rely on it.
      return;
    }

    await Settings.session.Set(["previous-page-on-tab", event.tabId], currentPage);

    console.log("Transition:", previousPage, "->", currentPage);

    const { connected } = await Settings.session.Get();

    if (!connected) {
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

  const previousPage = await Settings.session.Get(["previous-page-on-tab", event.openerTabId]);
  if (!previousPage) return;

  await Settings.session.Set(["previous-page-on-tab", event.id], previousPage);
});

chrome.webNavigation.onDOMContentLoaded.addListener(async (details) => {
  const { connected } = await Settings.session.Get();

  if (!connected) {
    return;
  }

  await chrome.tabs.sendMessage(details.tabId, { type: "hide" });
});

async function SendPage(previousPage, currentPage, backmove = false) {
  const { url, username } = await Settings.local.Get();
  const { code } = await Settings.session.Get();

  const body = {
    code: code,
    username: username,
    page: currentPage,
    previous: previousPage,
    backmove: backmove,
  };

  return await SendRequestPOST(url, "/api/ext/page", body);
}

async function TryConnectToLobby(msg) {
  const { code, username } = msg;
  const { url } = await Settings.local.Get();
  const userid = await Settings.session.Get(["userid-for-lobby", code], "");

  const body = {
    code,
    username,
    userid,
  };

  const response = await SendRequestPOST(url, "/api/ext/join", body);

  await UpdateBadge(response.Success);
  await Settings.session.Set("connected", response.Success);

  if (response.Success) {
    await Settings.session.Set("code", code);
    await Settings.session.Set("pageCount", 0);
    await Settings.session.Set(["userid-for-lobby", code], response.UserID);

    if (!response.AlreadyInLobby) {

      if (eventSource != null) {
        eventSource.close();
        eventSource = null;
      }

      // Server sent event reference: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
      eventSource = new EventSource(`${url}/api/ext/events?code=${code}&userid=${response.UserID}`);
      eventSource.addEventListener("start", async (e) => {
        const data = JSON.parse(e.data);

        const { autoOpenStartPage } = await Settings.local.Get();

        await Settings.session.Set("startPage", data.StartPage);

        if (autoOpenStartPage) {
          chrome.tabs.create({
            active: true,
            url: Urlify(data.StartPage)
          });
        }
      });
    }
  } else {
    await Settings.session.Remove("code");
  }

  await chrome.runtime.sendMessage({
    type: "connect",
    ...response,
  });
}

async function DisconnectFromLobby(msg) {
  const { code, username } = msg;
  const { url } = await Settings.local.Get();
  const userid = await Settings.session.Get(["userid-for-lobby", code]);

  await Settings.session.Set("connected", false);
  await Settings.session.Remove("code");

  const body = {
    code,
    username,
    userid,
  };

  // TODO: Right now we dont care about the response
  await SendRequestPOST(url, "/api/ext/leave", body);
}

chrome.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case "connect":
      await TryConnectToLobby(msg);
      break;

    case "disconnect":
      await DisconnectFromLobby(msg);
      break;

    default:
      console.log("Unrecognized message: ", msg);
      break;
  }
});

async function SendRequestPOST(url, endpoint, body) {
  console.log("sent:", body);

  let response = await fetch(`${url}${endpoint}`, {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((response) => response.json())
    .then((json) => json)
    .catch(() => {
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
  let title = decodeURIComponent(url)
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

  let response = await fetch(url)
    .then((response) => response.json())
    .then((json) => json);

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

async function IncrementPageCount(success) {
  const pageCount = await Settings.session.Get("pageCount", 0);
  await Settings.session.Set("pageCount", (pageCount + Number(success)) % 100);
}

async function UpdateBadge(success) {
  const pageCount = await Settings.session.Get("pageCount", 0);

  let color;
  if (success) {
    color = [220, 253, 151, 255];
  } else {
    color = [250, 189, 189, 255];
  }

  chrome.action.setBadgeBackgroundColor({ color: color });
  chrome.action.setBadgeText({ text: String(pageCount) });
}

chrome.runtime.onInstalled.addListener(async () => {
  await Settings.local.Defaults({
    url: "https://wikiweaver.stuffontheinter.net",
    autoOpenStartPage: true,
  });

  await Settings.session.Defaults({
    connected: false,
    pageCount: 0,
  });
});
