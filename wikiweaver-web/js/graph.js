
var webgraph; // The graph

var edgenameson = false; // Used for toggling edge labels

// GRAPH SETTINGS

var GraphStyle = [
  // the stylesheet for the graph
  {
    selector: "node",
    style: {
      "background-color": "#fff",
      label: "data(shortid)",
      "font-size": 21,
      color: "#222",
      "font-family": "Rubik",
      "border-width": 3,
      "border-color": "#333",
      "text-background-opacity": 0.6,
      "text-background-color": "#fff",
      "text-background-shape": "round-rectangle",
      "text-background-padding": 2
    },
  },
  {
    // Start or goal node
    selector: ".SG",
    style: {
      "font-size": 22,
      width: 45,
      height: 45,
    },
  },
  {
    selector: "edge",
    style: {
      width: 4,
      label: "data(shortgroup)",
      "text-rotation": "autorotate",
      color: "#000",
      "font-size": 0,
      "text-background-opacity": 0,
      "text-background-color": "#fff",
      "text-background-shape": "round-rectangle",
      "text-background-padding": 1,
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "control-point-step-size": 15,
    },
  },
  {
    // Used for toggling short/long node name
    selector: ".FullNode",
    style: {
      label: "data(id)",
    },
  },
]

// COLOR SETTINGS

var ColorArray = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Cyan",
  "Orange",
  "Violet",
  "Magenta",
  "Lime",
  "Brown",
];

const UNUSED = "";

var CMap = {
  Red: {
    group: UNUSED,
    bgcolor: "#e44",
    bordercolor: "#d33",
    linecolor: "#e22",
    arrowcolor: "#d33",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
    showon: true, // Used for toggling player paths with ctxmenu
  },
  Orange: {
    group: UNUSED,
    bgcolor: "#fa0",
    bordercolor: "#e90",
    linecolor: "#fa0",
    arrowcolor: "#d80",
    arrowshape: "chevron",
    fromnode: "",
    showon: true,
  },
  Yellow: {
    group: UNUSED,
    bgcolor: "#fe0",
    bordercolor: "#ed1",
    linecolor: "#fe0",
    arrowcolor: "#db1",
    arrowshape: "triangle",
    fromnode: "",
    showon: true,
  },
  Lime: {
    group: UNUSED,
    bgcolor: "#ce3",
    bordercolor: "#bd2",
    linecolor: "#be2",
    arrowcolor: "#bd2",
    arrowshape: "chevron",
    fromnode: "",
    showon: true,
  },
  Green: {
    group: UNUSED,
    bgcolor: "#6c5",
    bordercolor: "#5b4",
    linecolor: "#6d5",
    arrowcolor: "#6b5",
    arrowshape: "triangle",
    fromnode: "",
    showon: true,
  },
  Cyan: {
    group: UNUSED,
    bgcolor: "#1de",
    bordercolor: "#1cd",
    linecolor: "#1dd",
    arrowcolor: "#1bb",
    arrowshape: "chevron",
    fromnode: "",
    showon: true,
  },
  Blue: {
    group: UNUSED,
    bgcolor: "#66f",
    bordercolor: "#55f",
    linecolor: "#55f",
    arrowcolor: "#55e",
    arrowshape: "triangle",
    fromnode: "",
    showon: true,
  },
  Violet: {
    group: UNUSED,
    bgcolor: "#b4e",
    bordercolor: "#a3d",
    linecolor: "#a3e",
    arrowcolor: "#a3c",
    arrowshape: "chevron",
    fromnode: "",
    showon: true,
  },
  Magenta: {
    group: UNUSED,
    bgcolor: "#e2d",
    bordercolor: "#c2c",
    linecolor: "#f2e",
    arrowcolor: "#d2c",
    arrowshape: "triangle",
    fromnode: "",
    showon: true,
  },
  Brown: {
    group: UNUSED,
    bgcolor: "#b63",
    bordercolor: "#a53",
    linecolor: "#c73",
    arrowcolor: "#a53",
    arrowshape: "chevron",
    fromnode: "",
    showon: true,
  },
};


// LAYOUT OPTIONS

var DefaultOptions = {
  animate: true, // whether to show the layout as it's running
  refresh: 1, // number of ticks per frame; higher is faster but more jerky
  maxSimulationTime: 3000, // max length in ms to run the layout
  ungrabifyWhileSimulating: false, // so you can't drag nodes during layout
  fit: true, // on every layout reposition of nodes, fit the viewport
  padding: 50, // padding around the simulation
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  nodeDimensionsIncludeLabels: false, // whether labels should be included in determining the space used by a node

  // layout event callbacks
  ready: function () { }, // on layoutready
  stop: function () { }, // on layoutstop

  // positioning options
  randomize: false, // use random node positions at beginning of layout
  avoidOverlap: false, // if true, prevents overlap of node bounding boxes
  handleDisconnected: true, // if true, avoids disconnected components from overlapping
  convergenceThreshold: 0.01, // when the alpha value (system energy) falls below this value, the layout stops
  nodeSpacing: function (node) {
    return 15;
  }, // extra spacing around nodes
  flow: undefined, // use DAG/tree flow layout if specified, e.g. { axis: 'y', minSeparation: 30 }
  alignment: undefined, // relative alignment constraints on nodes, e.g. {vertical: [[{node: node1, offset: 0}, {node: node2, offset: 5}]], horizontal: [[{node: node3}, {node: node4}], [{node: node5}, {node: node6}]]}
  gapInequalities: undefined, // list of inequality constraints for the gap between the nodes, e.g. [{"axis":"y", "left":node1, "right":node2, "gap":25}]
  centerGraph: true, // adjusts the node positions initially to center the graph (pass false if you want to start the layout from the current position)

  // different methods of specifying edge length
  // each can be a constant numerical value or a function like `function( edge ){ return 2; }`
  edgeLength: undefined, // sets edge length directly in simulation
  edgeSymDiffLength: undefined, // symmetric diff edge length in simulation
  edgeJaccardLength: undefined, // jaccard edge length in simulation

  // iterations of cola algorithm; uses default values on undefined
  unconstrIter: undefined, // unconstrained initial layout iterations
  userConstIter: undefined, // initial layout iterations with user-specified constraints
  allConstIter: undefined, // initial layout iterations with all constraints including non-overlap
};

var NewNodeOptions = {
  // Layout options when adding a new node
  fit: false,
};

var StartupOptions = {
  // Layout options when starting a new game
  fit: false,
};

var ExampleGraphOptions = {
  // Layout options for the example graph
  maxSimulationTime: 8000,
  refresh: 2,
};


// PLAYER HANDLING

function AddNewPlayer(Player) {
  for (let color of ColorArray) {
    if (CMap[color].group == UNUSED) {
      CMap[color].group = Player;
      break;
    }
  }
}

function ResetPlayers() {
  for (let color in CMap) {
    CMap[color].group = UNUSED;
  }
}

function NumberOfPlayersInLobby() {
  let i = 0;
  for (let color of ColorArray) {
    if (CMap[color].group === UNUSED) break;
    i++;
  }

  return i;
}

function RemovePlayer(Player) {
  for (let color of ColorArray) {
    if (CMap[color].group == Player) {
      CMap[color].group = UNUSED;
      break;
    }
  }
}


// GRAPH CONSTRUCTION

function AddNewPage(Player, Fromstring, ToString, backmove = false) {
  let color = UsernameToColor(Player);
  if (color === undefined) return;

  AddNewElement(color, Fromstring, ToString, backmove);
}

function UsernameToColor(username) {
  // The server calls this function to add new pages
  for (let color in CMap) {
    if (CMap[color].group == username) {
      return color;
    }
  }

  console.log("failed to find player " + username + " in CMap: " + CMap);
  return undefined;
}

function AddNewElement(PColor, Fromstring, ToString, backmove) {
  // Add a new edge and possibly a new node for a player click
  var CList = CMap[PColor];

  CList.fromnode = Fromstring;

  if (CList.fromnode == ToString) {
    return;
  }

  // Add a new node if it does not already exist
  if (!webgraph.getElementById(ToString).inside()) {
    webgraph.add({
      data: { id: ToString, group: CList.group, shortid: ShortenString(ToString, 25), isshort: true },
      position: {
        x: webgraph.getElementById(CList.fromnode).position("x"),
        y: webgraph.getElementById(CList.fromnode).position("y"),
      },
    });
    webgraph
      .nodes('[group = "' + CList.group + '"]')
      .style("background-color", CList.bgcolor);
    webgraph
      .nodes('[group = "' + CList.group + '"]')
      .style("border-color", CList.bordercolor);
  }

  // Always add a new edge
  webgraph.add({
    data: {
      group: CList.group,
      source: CList.fromnode,
      target: ToString,
      shortgroup: ShortenString(CList.group, 10),
    },
  });
  webgraph
    .edges('[group = "' + CList.group + '"]')
    .style("line-color", CList.linecolor);
  webgraph
    .edges('[group = "' + CList.group + '"]')
    .style("target-arrow-color", CList.arrowcolor);
  webgraph
    .edges('[group = "' + CList.group + '"]')
    .style("target-arrow-shape", CList.arrowshape);

  if (backmove) {
    webgraph
      .edges('[target = "' + ToString + '"][source = "' + CList.fromnode + '"][group = "' + CList.group + '"]')
      .style("line-style", "dashed");
  }

  // If we are hiding a player path, hide the edges but not the nodes
  if (!CList.showon) {
    webgraph.edges('[group = "' + CList.group + '"]').hide();
  }

  // Reposition the player to the new node
  CList.fromnode = ToString;

  // If goal node has been found, show it
  if (webgraph.nodes('[group = "Goal"]').degree() > 0) {
    webgraph.nodes('[group = "Goal"]').show();
  }

  ForceNewLayout(NewNodeOptions);
}

function ForceNewLayout(OverrideOptions) {
  webgraph.layout({ name: "cola", ...DefaultOptions, ...OverrideOptions }).run();
}

function StartGame(StartNode, GoalNode) {
  ResetGraph();

  webgraph.add({
    data: { id: StartNode, group: "Start", shortid: ShortenString(StartNode, 25), isshort: true },
    position: { x: 0, y: 0 },
  });

  webgraph.add({
    data: { id: GoalNode, group: "Goal", shortid: ShortenString(GoalNode, 25), isshort: true },
    position: { x: 0, y: 0 },
  });

  for (let color in CMap) {
    CMap[color].fromnode = StartNode;
  }

  webgraph.nodes('[group = "Start"]').addClass("SG");
  webgraph.nodes('[group = "Goal"]').addClass("SG");

  webgraph.nodes('[group = "Start"]').style("shape", "round-diamond");
  webgraph.nodes('[group = "Goal"]').style("shape", "star");

  webgraph.nodes('[group = "Goal"]').hide()

  ForceNewLayout(StartupOptions);

  // Activate the context menu, so something happens when you rightclick
  let menu = webgraph.cxtmenu({ ...MenuStyle, ...MenuNode });
  webgraph.cxtmenu({ ...MenuStyle, ...MenuEdge });
  webgraph.cxtmenu({ ...MenuStyle, ...MenuBG });


  // Guarantee proper zoom level
  webgraph.zoom({ level: 1 });

  // document.getElementById("redraw-button").disabled = false;
}

function ResetGraph() {
  webgraph = cytoscape({
    wheelSensitivity: 0.3,
    container: document.getElementById("maincanvas"), // container to render in
    style: GraphStyle,
  });
  // document.getElementById("redraw-button").disabled = true;
}


// CONTEXT MENU FUNCTIONS

function ShortenString(InString, MaxLength) {
  if (InString.length > MaxLength) {
    return InString.substring(0, MaxLength - 3) + "...";
  }
  return InString;
}

function ToggleFullString(element) {
  element.toggleClass("FullNode");
}

function ToggleOnePlayer(element) {
  // Toggles showing the path of a specific player
  if (element.data("group") == "Start" || element.data("group") == "Goal") {
    // Don't attempt to look at Start or Goal ""Path""
    return
  }

  if (CMap[UsernameToColor(element.data("group"))].showon) {
    webgraph.edges('[group = "' + CMap[UsernameToColor(element.data("group"))].group + '"]').hide();
    CMap[UsernameToColor(element.data("group"))].showon = false;
  }
  else {
    webgraph.edges('[group = "' + CMap[UsernameToColor(element.data("group"))].group + '"]').show();
    CMap[UsernameToColor(element.data("group"))].showon = true;
  }
}

function ShowAllPlayers() {
  // Shows the path for every player
  webgraph.edges().show()
  for (let color of ColorArray) {
    CMap[color].showon = true;
  }
}

function HideAllPlayers() {
  // hides the path for every player
  webgraph.edges().hide()
  for (let color of ColorArray) {
    CMap[color].showon = false;
  }
}

function ToggleEdgeNames() {
  if (edgenameson) {
    // Turn off edge names
    webgraph.edges().style("font-size", 0);
    webgraph.edges().style("text-background-opacity", 0);
    webgraph.edges().style("control-point-step-size", 15);
    edgenameson = false;
  }
  else {
    // Turn on edge names
    webgraph.edges().style("font-size", 15);
    webgraph.edges().style("text-background-opacity", 0.8);
    webgraph.edges().style("control-point-step-size", 25);
    edgenameson = true;
  }
}

function Urlify(InString) {
  // Turns an id back into a URL
  return "https://en.wikipedia.org/wiki/" + InString
}


// CONTEXT MENU OPTIONS

let MenuNode = {
  selector: 'node', // elements matching this Cytoscape.js selector will trigger cxtmenus
  commands: [ // an array of commands to list in the menu or a function that returns the array
    {
      // Link to website command
      fillColor: 'rgba(190, 150, 150, 0.95)', // the background colour of the menu
      content: 'Go to Article', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected

        window.open(Urlify(ele.id())) // `ele` holds the reference to the active element
      }
    },
    {
      // Toggle between long and short node id
      fillColor: 'rgba(170, 130, 130, 0.95)',
      content: 'Toggle short/long name', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        ToggleFullString(ele)
      }
    },
    {
      // Show the path for one specific player
      fillColor: 'rgba(150, 110, 110, 0.95)',
      content: 'Toggle player path', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        ToggleOnePlayer(ele)
      }
    }
  ],
};

let MenuEdge = {
  selector: 'edge', // elements matching this Cytoscape.js selector will trigger cxtmenus
  commands: [ // an array of commands to list in the menu or a function that returns the array
    {
      // Show the path for one specific player
      fillColor: 'rgba(150, 150, 190, 0.95)',
      content: 'Toggle player path', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        ToggleOnePlayer(ele)
      }
    }
  ],
  minSpotlightRadius: 10,
  maxSpotlightRadius: 10,
};

let MenuBG = {
  selector: 'core', // elements matching this Cytoscape.js selector will trigger cxtmenus
  commands: [ // an array of commands to list in the menu or a function that returns the array
    {
      // Toggle between showing usernames on edges and not
      fillColor: 'rgba(150, 190, 150, 0.95)',
      content: 'Toggle edge names', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        ToggleEdgeNames(); // `ele` holds the reference to the active element
      }
    },
    {
      // Show all player paths
      fillColor: 'rgba(130, 170, 130, 0.95)',
      content: 'Show all players', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        ShowAllPlayers();
      }
    },
    {
      // Hide all player paths
      fillColor: 'rgba(110, 150, 110, 0.95)',
      content: 'Hide all players', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) {
        HideAllPlayers();
      }
    }
  ],
  minSpotlightRadius: 10,
  maxSpotlightRadius: 10,
};

let MenuStyle = {
  // The default menu style for all cxt menus. Can be overriden by MenuNode/MenuEdge/MenuBG
  menuRadius: function (ele) {
    return 100;
  }, // the outer radius (node center to the end of the menu) in pixels. It is added to the rendered size of the node. Can either be a number or function as in the example.
  activeFillColor: 'rgba(0, 120, 230, 0.75)', // the colour used to indicate the selected command
  activePadding: 10, // additional size in pixels for the active command
  indicatorSize: 24, // the size in pixels of the pointer to the active command, will default to the node size if the node size is smaller than the indicator size, 
  separatorWidth: 3, // the empty spacing in pixels between successive commands
  spotlightPadding: 5, // extra spacing in pixels between the element and the spotlight
  adaptativeNodeSpotlightRadius: false, // specify whether the spotlight radius should adapt to the node size
  minSpotlightRadius: 20, // the minimum radius in pixels of the spotlight (ignored for the node if adaptativeNodeSpotlightRadius is enabled but still used for the edge & background)
  maxSpotlightRadius: 30, // the maximum radius in pixels of the spotlight (ignored for the node if adaptativeNodeSpotlightRadius is enabled but still used for the edge & background)
  openMenuEvents: 'cxttapstart taphold', // space-separated cytoscape events that will open the menu; only `cxttapstart` and/or `taphold` work here
  itemTextShadowColor: 'transparent', // the text shadow colour of the command's content
  atMouse: false, // draw menu at mouse position
  outsideMenuCancel: false // if set to a number, this will cancel the command if the pointer is released outside of the spotlight, padded by the number given 
};

// EXAMPLE GRAPHS

function createColorTest() {
  // A full sized test for the maximum amount of players
  // Added at the end of NicerExample to provide the final extra colors needed
  AddNewPlayer("TEST1");
  AddLeaderboardEntry("TEST1", 2, 2);
  AddNewPage("TEST1", "a");
  AddNewPage("TEST1", "b");

  AddNewPlayer("TEST2");
  AddLeaderboardEntry("TEST2", 2, 2);
  AddNewPage("TEST2", "c");
  AddNewPage("TEST2", "d");

  AddNewPlayer("TEST3");
  AddLeaderboardEntry("TEST3", 2, 2);
  AddNewPage("TEST3", "e");
  AddNewPage("TEST3", "f");
}

function CreateNicerExample() {
  // The example shown for the released product
  StartGame("Santa Claus", "Fish");

  document.getElementById("start-page-input").value = "Santa Claus";
  document.getElementById("goal-page-input").value = "Fish";

  // A three player example of a race between Santa Claus and Fish
  AddNewPlayer("l0fen");
  AddLeaderboardEntry("l0fen", 3, 3);
  AddNewPage("l0fen", "Santa Claus", "East-West Schism");
  AddNewPage("l0fen", "East-West Schism", "Lent");
  AddNewPage("l0fen", "Lent", "Fish");
  UpdateLeaderboardEntry("l0fen", 3, 3, 97);

  AddNewPlayer("SomeRandomDude");
  AddLeaderboardEntry("SomeRandomDude", 5, 5);
  AddNewPage("SomeRandomDude", "Santa Claus", "Saint Nicholas");
  AddNewPage("SomeRandomDude", "Saint Nicholas", "Early Christianity");
  AddNewPage("SomeRandomDude", "Early Christianity", "Jesus in Christianity");
  AddNewPage("SomeRandomDude", "Jesus in Christianity", "Adam");
  AddNewPage("SomeRandomDude", "Jesus in Christianity", "Jerusalem");
  AddNewPage("SomeRandomDude", "Jesus in Christianity", "Christianity");
  AddNewPage("SomeRandomDude", "Christianity", "Lent");
  AddNewPage("SomeRandomDude", "Lent", "Fish");
  UpdateLeaderboardEntry("SomeRandomDude", 5, 5, 165);

  AddNewPlayer("BEE");
  AddLeaderboardEntry("BEE", 7, 5);
  AddNewPage("BEE", "Santa Claus", "East-West Schism");
  AddNewPage("BEE", "East-West Schism", "Passover");
  AddNewPage("BEE", "Passover", "Pike");
  AddNewPage("BEE", "Pike", "Passover", true);
  AddNewPage("BEE", "Passover", "Carp");
  AddNewPage("BEE", "Carp", "Rough fish");
  AddNewPage("BEE", "Rough fish", "Fish");
  UpdateLeaderboardEntry("BEE", 7, 5, 192);

  AddNewPlayer("Retroducky");
  AddLeaderboardEntry("Retroducky", 5, 5);
  AddNewPage("Retroducky", "Santa Claus", "Pepsi");
  AddNewPage("Retroducky", "Pepsi", "Fat");
  AddNewPage("Retroducky", "Fat", "Tuna");
  AddNewPage("Retroducky", "Tuna", "Game fish");
  AddNewPage("Retroducky", "Game fish", "Fish");
  UpdateLeaderboardEntry("Retroducky", 5, 5, 239);

  AddNewPlayer("vi9ke");
  AddLeaderboardEntry("vi9ke", 2, 2);
  AddNewPage("vi9ke", "Santa Claus", "Pepsi");
  AddNewPage("vi9ke", "Pepsi", "Pepsiman (video game)");

  AddNewPlayer("Paul");
  AddLeaderboardEntry("Paul", 6, 6);
  AddNewPage("Paul", "Santa Claus", "East-West Schism");
  AddNewPage("Paul", "East-West Schism", "Passover");
  AddNewPage("Paul", "Passover", "Carp");
  AddNewPage("Paul", "Carp", "Aquaculture");
  AddNewPage("Paul", "Aquaculture", "Goldfish");
  AddNewPage("Paul", "Goldfish", "Fish");
  UpdateLeaderboardEntry("Paul", 6, 6, 323);
  MoveLeaderboardEntry("Paul", 4);

  AddNewPlayer("username");
  AddLeaderboardEntry("username", 8, 4);
  AddNewPage("username", "Santa Claus", "East-West Schism");
  AddNewPage("username", "East-West Schism", "Lent");
  AddNewPage("username", "Lent", "East-West Schism", true);
  AddNewPage("username", "East-West Schism", "Passover");
  AddNewPage("username", "Passover", "Sheep");
  AddNewPage("username", "Sheep", "Mesopotamia");
  AddNewPage("username", "Mesopotamia", "Sheep", true);
  AddNewPage("username", "Sheep", "Food and Agriculture Organization");

  ForceNewLayout(ExampleGraphOptions);

  //createColorTest()

}
