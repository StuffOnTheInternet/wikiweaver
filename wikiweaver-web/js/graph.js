// The graph
var webgraph;

const UNUSED = "UNUSED";

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

// Color settings
var CMap = {
  Red: {
    group: UNUSED,
    bgcolor: "#e44",
    bordercolor: "#d33",
    linecolor: "#e22",
    arrowcolor: "#d33",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Orange: {
    group: UNUSED,
    bgcolor: "#fa0",
    bordercolor: "#e90",
    linecolor: "#fa0",
    arrowcolor: "#d80",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Yellow: {
    group: UNUSED,
    bgcolor: "#fe0",
    bordercolor: "#ed1",
    linecolor: "#fe0",
    arrowcolor: "#db1",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Lime: {
    group: UNUSED,
    bgcolor: "#ce3",
    bordercolor: "#bd2",
    linecolor: "#be2",
    arrowcolor: "#bd2",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Green: {
    group: UNUSED,
    bgcolor: "#6c5",
    bordercolor: "#5b4",
    linecolor: "#6d5",
    arrowcolor: "#6b5",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Cyan: {
    group: UNUSED,
    bgcolor: "#1de",
    bordercolor: "#1cd",
    linecolor: "#1dd",
    arrowcolor: "#1bb",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Blue: {
    group: UNUSED,
    bgcolor: "#66f",
    bordercolor: "#55f",
    linecolor: "#55f",
    arrowcolor: "#55e",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Violet: {
    group: UNUSED,
    bgcolor: "#b4e",
    bordercolor: "#a3d",
    linecolor: "#a3e",
    arrowcolor: "#a3c",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Magenta: {
    group: UNUSED,
    bgcolor: "#e2d",
    bordercolor: "#c2c",
    linecolor: "#f2e",
    arrowcolor: "#d2c",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Brown: {
    group: UNUSED,
    bgcolor: "#b63",
    bordercolor: "#a53",
    linecolor: "#c73",
    arrowcolor: "#a53",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
};

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
    return 10;
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



function ResetGraph() {
  webgraph = cytoscape({
    wheelSensitivity: 0.3,
    container: document.getElementById("maincanvas"), // container to render in
    style: [
      // the stylesheet for the graph
      {
        selector: "node",
        style: {
          "background-color": "#fff",
          label: "data(shortid)",
          "font-size": 18,
          "text-outline-color": "#555",
          "text-outline-width": 1.6,
          color: "#fff",
          "border-width": 3,
          "border-color": "#333",
        },
      },
      {
        selector: "edge",
        style: {
          width: 4,
          //label: "data(group)", //Implement this as colorblind mode as a toggle
          "text-rotation": "autorotate",
          color: "#fff",
          "font-size": 10,
          "text-outline-color": "#000",
          "text-outline-width": 0.6,
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          "control-point-step-size": 15,
        },
      },
    ],
  });

  // document.getElementById("redraw-button").disabled = true;
}

function AddNewPage(Player, ToString, timeadded = 200, backmove = false) {
  let color = UsernameToColor(Player);
  if (color === undefined) return;

  AddNewElement(color, ToString, timeadded, backmove);
}

function RemovePlayer(Player) {
  for (let color of ColorArray) {
    if (CMap[color].group == Player) {
      CMap[color].group = UNUSED;
      break;
    }
  }
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

function AddNewElement(PColor, ToString, timeadded, backmove) {
  // Add a new edge and possibly a new node for a player click
  var CList = CMap[PColor];

  if (CList.fromnode == ToString) {
    return;
  }

  // Add a new node if it does not already exist
  if (!webgraph.getElementById(ToString).inside()) {
    webgraph.add({
      data: { id: ToString, group: CList.group, time: timeadded, shortid: ShortenString(ToString), isshort: true },
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
      time: timeadded,
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
    data: { id: StartNode, group: "Start", shortid: ShortenString(StartNode), isshort: true },
    position: { x: 0, y: 0 },
  });

  webgraph.add({
    data: { id: GoalNode, group: "Goal", shortid: ShortenString(GoalNode), isshort: true },
    position: { x: 0, y: 0 },
  });

  for (let color in CMap) {
    CMap[color].fromnode = StartNode;
  }

  webgraph.nodes('[group = "Start"]').style("shape", "round-diamond");
  webgraph.nodes('[group = "Start"]').style("text-outline-color", "#000");
  webgraph.nodes('[group = "Start"]').style("width", 45);
  webgraph.nodes('[group = "Start"]').style("height", 45);

  webgraph.nodes('[group = "Goal"]').style("shape", "star");
  webgraph.nodes('[group = "Goal"]').style("text-outline-color", "#000");
  webgraph.nodes('[group = "Goal"]').style("width", 40);
  webgraph.nodes('[group = "Goal"]').style("height", 40);

  webgraph.nodes('[group = "Goal"]').hide()

  ForceNewLayout(StartupOptions);

  // Activate the context menu, so something happens when you rightclick
  let menu = webgraph.cxtmenu(MenuNode);
  webgraph.cxtmenu(MenuEdge);
  webgraph.cxtmenu(MenuBG);

  // document.getElementById("redraw-button").disabled = false;
}



function ShortenString(InString) {
  let MaxLength = 30;
  if (InString.length > MaxLength) {
    return InString.substring(0, MaxLength - 3) + "...";
  }
  return InString;
}

var menucolor;
function UpdateMenuColor(element) {
  menucolor = CMap[UsernameToColor(element.data("group"))].bgcolor
}

function ShowOnePlayer(element) {
  webgraph.edges().hide()
  webgraph.edges('[group = "' + CMap[UsernameToColor(element.data("group"))].group + '"]').show()
}

let MenuNode = {
  menuRadius: function (ele) {
    return 100;
  }, // the outer radius (node center to the end of the menu) in pixels. It is added to the rendered size of the node. Can either be a number or function as in the example.
  selector: 'node', // elements matching this Cytoscape.js selector will trigger cxtmenus
  commands: [ // an array of commands to list in the menu or a function that returns the array
    {
      // Link to website command
      fillColor: 'rgba(150, 150, 150, 0.95)', // the background colour of the menu
      content: 'Go to Article', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        window.open(Urlify(ele.id())) // `ele` holds the reference to the active element
      }
    },
    {
      // Toggle between long and short node id
      fillColor: 'rgba(130, 130, 130, 0.95)',
      content: 'Toggle short/long name', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ") // `ele` holds the reference to the active element
      }
    },
    {
      // Third command
      fillColor: 'rgba(110, 110, 110, 0.95)',
      content: 'Show player path', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        ShowOnePlayer(ele)
      }
    }
  ],
  activeFillColor: 'rgba(0, 120, 230, 0.75)', // the colour used to indicate the selected command
  activePadding: 10, // additional size in pixels for the active command
  indicatorSize: 24, // the size in pixels of the pointer to the active command, will default to the node size if the node size is smaller than the indicator size, 
  separatorWidth: 3, // the empty spacing in pixels between successive commands
  spotlightPadding: 5, // extra spacing in pixels between the element and the spotlight
  adaptativeNodeSpotlightRadius: false, // specify whether the spotlight radius should adapt to the node size
  minSpotlightRadius: 20, // the minimum radius in pixels of the spotlight (ignored for the node if adaptativeNodeSpotlightRadius is enabled but still used for the edge & background)
  maxSpotlightRadius: 30, // the maximum radius in pixels of the spotlight (ignored for the node if adaptativeNodeSpotlightRadius is enabled but still used for the edge & background)
  openMenuEvents: 'cxttapstart taphold', // space-separated cytoscape events that will open the menu; only `cxttapstart` and/or `taphold` work here
  itemColor: 'white', // the colour of text in the command's content
  itemTextShadowColor: 'transparent', // the text shadow colour of the command's content
  atMouse: false, // draw menu at mouse position
  outsideMenuCancel: false // if set to a number, this will cancel the command if the pointer is released outside of the spotlight, padded by the number given 
};

let MenuEdge = {
  menuRadius: function (ele) {
    return 100;
  }, // the outer radius (node center to the end of the menu) in pixels. It is added to the rendered size of the node. Can either be a number or function as in the example.
  selector: 'edge', // elements matching this Cytoscape.js selector will trigger cxtmenus
  commands: [ // an array of commands to list in the menu or a function that returns the array
    {
      // Toggle between long and short node id
      fillColor: 'rgba(130, 130, 130, 0.95)',
      content: 'Toggle edge names', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ") // `ele` holds the reference to the active element
      }
    },
    {
      // Third command
      fillColor: 'rgba(110, 110, 110, 0.95)',
      content: 'Show player  path', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        ShowOnePlayer(ele)
      }
    }
  ],

  activeFillColor: 'rgba(0, 120, 230, 0.75)', // the colour used to indicate the selected command
  activePadding: 10, // additional size in pixels for the active command
  indicatorSize: 24, // the size in pixels of the pointer to the active command, will default to the node size if the node size is smaller than the indicator size, 
  separatorWidth: 3, // the empty spacing in pixels between successive commands
  spotlightPadding: 5, // extra spacing in pixels between the element and the spotlight
  adaptativeNodeSpotlightRadius: false, // specify whether the spotlight radius should adapt to the node size
  minSpotlightRadius: 20, // the minimum radius in pixels of the spotlight (ignored for the node if adaptativeNodeSpotlightRadius is enabled but still used for the edge & background)
  maxSpotlightRadius: 30, // the maximum radius in pixels of the spotlight (ignored for the node if adaptativeNodeSpotlightRadius is enabled but still used for the edge & background)
  openMenuEvents: 'cxttapstart taphold', // space-separated cytoscape events that will open the menu; only `cxttapstart` and/or `taphold` work here
  itemColor: 'white', // the colour of text in the command's content
  itemTextShadowColor: 'transparent', // the text shadow colour of the command's content
  atMouse: false, // draw menu at mouse position
  outsideMenuCancel: false // if set to a number, this will cancel the command if the pointer is released outside of the spotlight, padded by the number given 
};


let MenuBG = {
  menuRadius: function (ele) {
    return 100;
  }, // the outer radius (node center to the end of the menu) in pixels. It is added to the rendered size of the node. Can either be a number or function as in the example.
  selector: 'core', // elements matching this Cytoscape.js selector will trigger cxtmenus
  commands: [ // an array of commands to list in the menu or a function that returns the array
    {
      // Toggle between long and short node id
      fillColor: 'rgba(130, 130, 130, 0.95)',
      content: 'Toggle edge names', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ") // `ele` holds the reference to the active element
      }
    },
    {
      // Third command
      fillColor: 'rgba(110, 110, 110, 0.95)',
      content: 'Show all players', // html/text content to be displayed in the menu
      contentStyle: {}, // css key:value pairs to set the command's css in js if you want
      select: function (ele) { // a function to execute when the command is selected
        webgraph.edges().show()
      }
    }
  ],

  activeFillColor: 'rgba(0, 120, 230, 0.75)', // the colour used to indicate the selected command
  activePadding: 10, // additional size in pixels for the active command
  indicatorSize: 24, // the size in pixels of the pointer to the active command, will default to the node size if the node size is smaller than the indicator size, 
  separatorWidth: 3, // the empty spacing in pixels between successive commands
  spotlightPadding: 5, // extra spacing in pixels between the element and the spotlight
  adaptativeNodeSpotlightRadius: false, // specify whether the spotlight radius should adapt to the node size
  minSpotlightRadius: 20, // the minimum radius in pixels of the spotlight (ignored for the node if adaptativeNodeSpotlightRadius is enabled but still used for the edge & background)
  maxSpotlightRadius: 30, // the maximum radius in pixels of the spotlight (ignored for the node if adaptativeNodeSpotlightRadius is enabled but still used for the edge & background)
  openMenuEvents: 'cxttapstart taphold', // space-separated cytoscape events that will open the menu; only `cxttapstart` and/or `taphold` work here
  itemColor: 'white', // the colour of text in the command's content
  itemTextShadowColor: 'transparent', // the text shadow colour of the command's content
  atMouse: false, // draw menu at mouse position
  outsideMenuCancel: false // if set to a number, this will cancel the command if the pointer is released outside of the spotlight, padded by the number given 
};

// Turns an id back into a URL
function Urlify(InString) {
  return "https://en.wikipedia.org/wiki/" + InString
}

// A full sized test for the maximum amount of players
function createColorTest() {
  // Added at the end of NicerExample to provide the final extra colors needed
  AddNewPlayer("TEST1");
  AddLeaderboardEntry("TEST1", 2, 2);
  AddNewPage("TEST1", "a", 10);
  AddNewPage("TEST1", "b", 10);

  AddNewPlayer("TEST2");
  AddLeaderboardEntry("TEST2", 2, 2);
  AddNewPage("TEST2", "c", 10);
  AddNewPage("TEST2", "d", 10);

  AddNewPlayer("TEST3");
  AddLeaderboardEntry("TEST3", 2, 2);
  AddNewPage("TEST3", "e", 10);
  AddNewPage("TEST3", "f", 10);
}

// The example shown for the released product
function CreateNicerExample() {
  StartGame("Santa Claus", "Fish", 0);

  document.getElementById("start-page-input").value = "Santa Claus";
  document.getElementById("goal-page-input").value = "Fish";

  // A three player example of a race between Santa Claus and Fish
  AddNewPlayer("l0fen");
  AddLeaderboardEntry("l0fen", 3, 3);
  AddNewPage("l0fen", "East-West Schism", 10);
  AddNewPage("l0fen", "Lent", 10);
  AddNewPage("l0fen", "Fish", 10);
  UpdateLeaderboardEntry("l0fen", 3, 3, 97);

  AddNewPlayer("SomeRandomDude");
  AddLeaderboardEntry("SomeRandomDude", 5, 5);
  AddNewPage("SomeRandomDude", "Saint Nicholas", 10);
  AddNewPage("SomeRandomDude", "Early Christianity", 10);
  AddNewPage("SomeRandomDude", "Jesus in Christianity", 10);
  AddNewPage("SomeRandomDude", "Christianity", 10);
  AddNewPage("SomeRandomDude", "Lent", 10);
  AddNewPage("SomeRandomDude", "Fish", 10);
  UpdateLeaderboardEntry("SomeRandomDude", 5, 5, 165);

  AddNewPlayer("BEE");
  AddLeaderboardEntry("BEE", 7, 5);
  AddNewPage("BEE", "East-West Schism", 10);
  AddNewPage("BEE", "Passover", 10);
  AddNewPage("BEE", "Pike", 10);
  AddNewPage("BEE", "Passover", 10, true);
  AddNewPage("BEE", "Carp", 10);
  AddNewPage("BEE", "Rough fish", 10);
  AddNewPage("BEE", "Fish", 10);
  UpdateLeaderboardEntry("BEE", 7, 5, 192);

  AddNewPlayer("Retroducky");
  AddLeaderboardEntry("Retroducky", 5, 5);
  AddNewPage("Retroducky", "Pepsi", 10);
  AddNewPage("Retroducky", "Fat", 10);
  AddNewPage("Retroducky", "Tuna", 10);
  AddNewPage("Retroducky", "Game Fish", 10);
  AddNewPage("Retroducky", "Fish", 10);
  UpdateLeaderboardEntry("Retroducky", 5, 5, 239);

  AddNewPlayer("vi9ke");
  AddLeaderboardEntry("vi9ke", 2, 2);
  AddNewPage("vi9ke", "Pepsi", 10);
  AddNewPage("vi9ke", "Pepsiman (video game)", 10);

  AddNewPlayer("Paul");
  AddLeaderboardEntry("Paul", 6, 6);
  AddNewPage("Paul", "East-West Schism", 10);
  AddNewPage("Paul", "Passover", 10);
  AddNewPage("Paul", "Carp", 10);
  AddNewPage("Paul", "Aquaculture", 10);
  AddNewPage("Paul", "Goldfish", 10);
  AddNewPage("Paul", "Fish", 10);
  UpdateLeaderboardEntry("Paul", 6, 6, 323);
  MoveLeaderboardEntry("Paul", 4);

  AddNewPlayer("username");
  AddLeaderboardEntry("username", 8, 4);
  AddNewPage("username", "East-West Schism", 10);
  AddNewPage("username", "Lent", 10);
  AddNewPage("username", "East-West Schism", 10, true);
  AddNewPage("username", "Passover", 10);
  AddNewPage("username", "Sheep", 10);
  AddNewPage("username", "Mesopotamia", 10);
  AddNewPage("username", "Sheep", 10, true);
  AddNewPage("username", "Passover sacrifice", 10);

  ForceNewLayout(ExampleGraphOptions);
}
