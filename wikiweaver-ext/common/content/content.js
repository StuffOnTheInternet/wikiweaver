function HideSuperfluousElements() {
  const ClassNamesToHide = [
    "vector-header-container",
    "vector-body-before-content",
    "vector-page-toolbar",
  ];

  ClassNamesToHide.forEach((className) => {
    for (elem of document.getElementsByClassName(className)) {
      elem.style.visibility = "hidden";
    }
  });

  const ClassNamesToRemove = ["mw-editsection", "reference"];

  ClassNamesToRemove.forEach((className) => {
    for (elem of document.getElementsByClassName(className)) {
      elem.hidden = true;
    }
  });

  const IDsToHide = ["p-lang-btn"];

  IDsToHide.forEach((elemID) => {
    const elem = document.getElementById(elemID);
    if (elem != null) {
      elem.style.visibility = "hidden";
    }
  });
}

const ValidWikipediaUrl = RegExp(".*://en.wikipedia.org/wiki/.+");

const InvalidStringsInUrl = [
  "Category:",
  "Draft:",
  "File:",
  "Help:",
  "MediaWiki:",
  "Module:",
  "Portal:",
  "Special:",
  "Talk:",
  "Template:",
  "TimedText:",
  "User:",
  "Wikipedia:",
  "_talk:",
  "#cite_ref",
  "#cite_note",
  "(identifier)",
];

function IsLinkAllowed(link) {
  if (!link.match(ValidWikipediaUrl)) {
    return false;
  }

  for (text of InvalidStringsInUrl) {
    if (link.includes(text)) return false;
  }

  return true;
}

function HideDisallowedLinks() {
  let total = 0;
  let invalid = 0;

  for (let elem of document.getElementsByTagName("a")) {
    total += 1;

    if (IsLinkAllowed(elem.href)) {
      continue;
    }

    invalid += 1;

    elem.removeAttribute("href");
    elem.style.color = "black";
    elem.style.pointerEvents = "none";
    elem.style.cursor = "default";
  }

  console.log(`Hidden ${invalid} out of ${total} links on page`);
}

function HandleMessageHide() {
  HideSuperfluousElements();
  HideDisallowedLinks();
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
