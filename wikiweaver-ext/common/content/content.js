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
  // "Category:",
  "Draft:",
  "File:",
  "Help:",
  "MediaWiki:",
  "Module:",
  // "Portal:",
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

const NumSpecialReasons = 2;

function IsLinkAllowed(link) {
  if (!link.match(ValidWikipediaUrl)) {
    return [false, 1];
  }

  for (const [index, text] of InvalidStringsInUrl.entries()) {
    if (link.includes(text)) {
      return [false, NumSpecialReasons + index];
    }
  }

  return [true, 0];
}

function HideDisallowedLinks() {
  const LinksCount = new Array(
    NumSpecialReasons + InvalidStringsInUrl.length
  ).fill(0);

  for (let elem of document.getElementsByTagName("a")) {
    const [isAllowed, reason] = IsLinkAllowed(elem.href);

    LinksCount[reason] += 1;

    if (isAllowed) {
      continue;
    }

    elem.removeAttribute("href");
    elem.style.color = "black";
    elem.style.pointerEvents = "none";
    elem.style.cursor = "default";
  }

  const total = LinksCount.reduce((x, y) => x + y);
  const allowed = LinksCount[0];
  const nonWikipedia = LinksCount[1];
  const disallowed = total - allowed;

  console.log(`Links: ${total}`);
  console.log(`  Allowed:    ${allowed}`);
  console.log(`  Disallowed: ${disallowed}`);
  console.log(`    Non-Wikipedia URL: ${nonWikipedia}`);
  for (const [index, count] of LinksCount.slice(NumSpecialReasons).entries()) {
    console.log(`    Contains '${InvalidStringsInUrl[index]}': ${count}`);
  }
}

function HandleMessageHide() {
  // HideSuperfluousElements();
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
