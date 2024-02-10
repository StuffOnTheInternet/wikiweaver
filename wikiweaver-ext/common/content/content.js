function HandleMessageHide() {
  const ClassNamesToHide = [
    "vector-header-container",
    "vector-page-toolbar",
    "mw-editsection",
  ];

  const IDsToHide = ["p-lang-btn"];

  ClassNamesToHide.forEach((className) => {
    for (elem of document.getElementsByClassName(className)) {
      elem.style.visibility = "hidden";
    }
  });

  IDsToHide.forEach((elemID) => {
    const elem = document.getElementById(elemID);
    if (elem != null) {
      elem.style.visibility = "hidden";
    }
  });
}

chrome.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case "hide":
      HandleMessageHide(msg);
      break;

    default:
      console.log("Unrecognized message: ", msg);
      break;
  }
});
