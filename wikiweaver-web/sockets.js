async function connect() {
  if (globalThis.socket) {
    // Do not try to connect again if we are already connected
    return;
  }

  await fetch("http://localhost:4242/api/lobby/create")
    .then((response) => response.text())
    .then((code) => {
      document.getElementById("code").innerHTML = code;

      globalThis.socket = new WebSocket(
        "ws://localhost:4242/api/lobby/join/web" + "?code=" + code
      );

      globalThis.socket.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        AddNewPage(msg.Username, msg.Page);
      });
    })
    .catch((_) => {
      document.getElementById("code").innerHTML = "Failed to connect to server";
    });
}

document.addEventListener("DOMContentLoaded", () => connect(), false);
