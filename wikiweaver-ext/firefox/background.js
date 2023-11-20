const pingInterval = 1000; // milliseconds

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
      }),
    });
  },
  { url: [{ hostSuffix: ".wikipedia.org" }] }
);

function pageNameFromWikipediaURL(url) {
  return decodeURI(url).split("wiki/")[1].split("#")[0].replace(/_/g, " ");
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.type == "ping") {
    console.log("just got pinged!");
    return;
  }

  if (message.type != "connect") return;

  const options = await chrome.storage.local.get();

  let domain = "s://lofen.tplinkdns.com";
  if (options.domain == "dev") {
    domain = "://localhost:4242";
  }

  socket = new WebSocket(
    "ws" + domain + "/api/ws/ext/lobby/join" + "?code=" + options.lobby
  );

  socket.addEventListener("open", (event) => {
    // Send ping every so often to keep the websocket connection alive
    interval = setInterval(() => {
      const ping = JSON.stringify({ type: "ping" });
      socket.send(ping);
    }, pingInterval);
  });

  socket.addEventListener("close", (event) => {
    clearInterval(interval);
  });

  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.Type) {
      case "pong":
        // Server is alive, good. Ignore.
        break;
      case "page":
        AddNewPage(msg.Username, msg.Page);
        break;
      default:
        console.log("Unrecognized message: ", msg);
        break;
    }
  });

  // chrome.storage.session.set({ socket: socket });

  // console.log("background script: ", await chrome.session.storage.get());
});

// hmm, det verkar inte vara problem att background scriptet inte stängs utan att websocket stänger ned av sig själv

// browser.alarms.create({ periodInMinutes: 0.5 });

// browser.alarms.onAlarm.addListener(() => {
//   console.log("hello from alarm");
// });
