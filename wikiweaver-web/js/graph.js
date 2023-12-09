// The graph
var webgraph;

const UNUSED = "UNUSED";

// Color settings
var CMap = {
  Red: {
    group: UNUSED,
    bgcolor: "#d22",
    bordercolor: "#c11",
    linecolor: "#e22",
    arrowcolor: "#c22",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Orange: {
    group: UNUSED,
    bgcolor: "#e90",
    bordercolor: "#d80",
    linecolor: "#fa0",
    arrowcolor: "#d80",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Yellow: {
    group: UNUSED,
    bgcolor: "#fe0",
    bordercolor: "#dc0",
    linecolor: "#fe0",
    arrowcolor: "#cb0",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Lime: {
    group: UNUSED,
    bgcolor: "#ac1",
    bordercolor: "#9b0",
    linecolor: "#ad1",
    arrowcolor: "#ab1",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Green: {
    group: UNUSED,
    bgcolor: "#4b4",
    bordercolor: "#3a3",
    linecolor: "#4c4",
    arrowcolor: "#4a4",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Cyan: {
    group: UNUSED,
    bgcolor: "#0cd",
    bordercolor: "#0bc",
    linecolor: "#0cc",
    arrowcolor: "#0aa",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Blue: {
    group: UNUSED,
    bgcolor: "#44e",
    bordercolor: "#33d",
    linecolor: "#44f",
    arrowcolor: "#44d",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Violet: {
    group: UNUSED,
    bgcolor: "#92c",
    bordercolor: "#81b",
    linecolor: "#92d",
    arrowcolor: "#92b",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Magenta: {
    group: UNUSED,
    bgcolor: "#c0c",
    bordercolor: "#b0b",
    linecolor: "#d0d",
    arrowcolor: "#b0b",
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

var options = {
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

function AddNewPlayer(Player) {
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

function AddNewPage(Player, ToString, timeadded = 200, backmove = false) {
  let color = UsernameToColor(Player);
  if (color === undefined) return;

  AddNewElement(color, ToString, timeadded, backmove);
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
      data: { id: ToString, group: CList.group, time: timeadded },
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

  ForceNewLayout();
}

function ForceNewLayout() {
  webgraph.layout({ name: "cola", ...options }).run();
}

function StartGame(StartNode, GoalNode) {
  webgraph = cytoscape({
    container: document.getElementById("maincanvas"), // container to render in
    style: [
      // the stylesheet for the graph
      {
        selector: "node",
        style: {
          "background-color": "#fff",
          label: "data(id)",
          "font-size": 18,
          "text-outline-color": "#555",
          "text-outline-width": 1.6,
          color: "#fff",
          "border-width": 3,
          "border-color": "#bbb",
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
        },
      },
    ],
  });

  webgraph.add({
    data: { id: StartNode, group: "Start" },
    position: { x: 0, y: 0 },
  });

  webgraph.add({
    data: { id: GoalNode, group: "Goal" },
    position: { x: 0, y: 0 },
  });

  for (let color in CMap) {
    CMap[color].fromnode = StartNode;
  }

  webgraph.nodes('[group = "Start"]').style("shape", "round-rectangle");
  webgraph.nodes('[group = "Start"]').style("text-outline-color", "#000");

  webgraph.nodes('[group = "Goal"]').style("shape", "star");
  webgraph.nodes('[group = "Goal"]').style("text-outline-color", "#000");

  ForceNewLayout();
}

function createExampleGraph() {
  StartGame("That guy in the coca cola commercials", "Fish", 0);

  // A three player example of a race between Santa Claus and Fish
  AddNewPlayer("Bob");
  AddNewPage("Bob", "East-West Schism", 10);
  AddNewPage("Bob", "Lent", 10);
  AddNewPage("Bob", "Lent", 10);
  AddNewPage("Bob", "Lent", 10);
  AddNewPage("Bob", "Lent", 10);
  AddNewPage("Bob", "Lent", 10);
  AddNewPage("Bob", "Fish", 10);

  AddNewPlayer("Charlie");
  AddNewPage("Charlie", "East-West Schism", 10);
  AddNewPage("Charlie", "Lent", 10);
  AddNewPage("Charlie", "Winter", 10);

  AddNewPlayer("Mark");
  AddNewPage("Mark", "Saint Nick", 10);
  AddNewPage("Mark", "Christianty", 10);
  AddNewPage("Mark", "Catholicism", 10);
  AddNewPage("Mark", "Lent", 10);
  AddNewPage("Mark", "Fish", 10);

  AddNewPlayer("Alice");
  AddNewPage("Alice", "Coca Cola", 10);
  AddNewPage("Alice", "Atlanta", 10);
  AddNewPage("Alice", "Georgia", 10);

  AddNewPlayer("Emma");
  AddNewPage("Emma", "East-West Schism", 10);
  AddNewPage("Emma", "Passover", 10);
  AddNewPage("Emma", "Pike", 10);
  AddNewPage("Emma", "Passover", 10);
  AddNewPage("Emma", "Carp", 10);
  AddNewPage("Emma", "Rough Fish", 10);
  AddNewPage("Emma", "Fish", 10);

  AddNewPlayer("Robert");
  AddNewPage("Robert", "Coca Cola", 10);
  AddNewPage("Robert", "United States", 10);
  AddNewPage("Robert", "Fish", 10);

  AddNewPlayer("XXANTSLAYERXX");
  AddNewPage("XXANTSLAYERXX", "Coca Cola", 10);
  AddNewPage("XXANTSLAYERXX", "Pepsi Cola", 10);
  AddNewPage("XXANTSLAYERXX", "Pepsi", 10);

  AddNewPlayer("Your dad");
  AddNewPage("Your dad", "Coca Cola", 10);
  AddNewPage("Your dad", "Pepsi Cola", 10);
  AddNewPage("Your dad", "Pepsi", 10);
  AddNewPage("Your dad", "Soda", 10);
  AddNewPage("Your dad", "United States", 10);

  AddNewPlayer("asdfghjk");
  AddNewPage("asdfghjk", "Beard", 10);
  AddNewPage("asdfghjk", "Hair", 10);
  AddNewPage("asdfghjk", "Head", 10);

  AddNewPlayer("Paul");
  AddNewPage("Paul", "East-West Schism", 10);
  AddNewPage("Paul", "Passover", 10);
  AddNewPage("Paul", "Carp", 10);
  AddNewPage("Paul", "Aquaculture", 10);
  AddNewPage("Paul", "Goldfish", 10);
  AddNewPage("Paul", "Fish", 10);
}

function CreateNicerExample() {
  StartGame("Santa Claus", "Fish", 0);

  // A three player example of a race between Santa Claus and Fish
  AddNewPlayer("Bob");
  AddLeaderboardEntry("Bob", 3, 3);
  AddNewPage("Bob", "East-West Schism", 10);
  AddNewPage("Bob", "Lent", 10);
  AddNewPage("Bob", "Fish", 10);

  AddNewPlayer("Mark");
  AddLeaderboardEntry("Mark", 5, 5);
  AddNewPage("Mark", "Saint Nick", 10);
  AddNewPage("Mark", "Christianity", 10);
  AddNewPage("Mark", "Catholicism", 10);
  AddNewPage("Mark", "Lent", 10);
  AddNewPage("Mark", "Fish", 10);

  AddNewPlayer("Emma");
  AddLeaderboardEntry("Emma", 7, 5);
  AddNewPage("Emma", "East-West Schism", 10);
  AddNewPage("Emma", "Passover", 10);
  AddNewPage("Emma", "Pike", 10);
  AddNewPage("Emma", "Passover", 10, true);
  AddNewPage("Emma", "Carp", 10);
  AddNewPage("Emma", "Rough Fish", 10);
  AddNewPage("Emma", "Fish", 10);

  AddNewPlayer("Robert");
  AddLeaderboardEntry("Robert", 5, 5);
  AddNewPage("Robert", "Pepsi", 10);
  AddNewPage("Robert", "Fat", 10);
  AddNewPage("Robert", "Tuna", 10);
  AddNewPage("Robert", "Game Fish", 10);
  AddNewPage("Robert", "Fish", 10);

  AddNewPlayer("XXANTSLAYERXX");
  AddLeaderboardEntry("XXANTSLAYERXX", 3, 3);
  AddNewPage("XXANTSLAYERXX", "Coca Cola", 10);
  AddNewPage("XXANTSLAYERXX", "Pepsi Cola", 10);
  AddNewPage("XXANTSLAYERXX", "Pepsi", 10);

  AddNewPlayer("Paul");
  AddLeaderboardEntry("Paul", 6, 6);
  AddNewPage("Paul", "East-West Schism", 10);
  AddNewPage("Paul", "Passover", 10);
  AddNewPage("Paul", "Carp", 10);
  AddNewPage("Paul", "Aquaculture", 10);
  AddNewPage("Paul", "Goldfish", 10);
  AddNewPage("Paul", "Fish", 10);
}
