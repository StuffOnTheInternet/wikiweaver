chrome.webNavigation.onCommitted.addListener(
    async (event) => {
        console.log("Intercepted in Service worker:", event);
        const page = location.pathname.split("wiki/")[1].split("#")[0];
        const response = await fetch("https://localhost:4242/move", {
            method: "POST",
            mode: "no-cors",
        });
    },
    { url: { hostsSuffix: ".wikipedia.org" } }
);
