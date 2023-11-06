// The graph
var webgraph;

// Color settings
var CMap = {
  Red: {
    group: "Red",
    bgcolor: "#d22",
    bordercolor: "#c11",
    linecolor: "#e22",
    arrowcolor: "#c22",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Orange: {
    group: "Orange",
    bgcolor: "#e90",
    bordercolor: "#d80",
    linecolor: "#fa0",
    arrowcolor: "#d80",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Yellow: {
    group: "Yellow",
    bgcolor: "#fe0",
    bordercolor: "#dc0",
    linecolor: "#fe0",
    arrowcolor: "#cb0",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Lime: {
    group: "Lime",
    bgcolor: "#ac1",
    bordercolor: "#9b0",
    linecolor: "#ad1",
    arrowcolor: "#ab1",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Green: {
    group: "Green",
    bgcolor: "#4b4",
    bordercolor: "#3a3",
    linecolor: "#4c4",
    arrowcolor: "#4a4",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Cyan: {
    group: "Cyan",
    bgcolor: "#0cd",
    bordercolor: "#0bc",
    linecolor: "#0cc",
    arrowcolor: "#0aa",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Blue: {
    group: "Blue",
    bgcolor: "#44e",
    bordercolor: "#33d",
    linecolor: "#44f",
    arrowcolor: "#44d",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Violet: {
    group: "Violet",
    bgcolor: "#92c",
    bordercolor: "#81b",
    linecolor: "#92d",
    arrowcolor: "#92b",
    arrowshape: "chevron",
    fromnode: "", // Assigned at startup
  },
  Magenta: {
    group: "Magenta",
    bgcolor: "#c0c",
    bordercolor: "#b0b",
    linecolor: "#d0d",
    arrowcolor: "#b0b",
    arrowshape: "triangle",
    fromnode: "", // Assigned at startup
  },
  Brown: {
    group: "Brown",
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
  ready: function () {}, // on layoutready
  stop: function () {}, // on layoutstop

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

function AddNewPage(Player, ToString) {
  // The server calls this function to add new pages
  AddNewElement(Player, ToString);
}

function AddNewElement(PColor, ToString) {
  // Add a new edge and possibly a new node for a player click
  var CList = CMap[PColor];

  // Add a new node if it does not already exist
  if (!webgraph.getElementById(ToString).inside()) {
    webgraph.add({
      data: { id: ToString, group: CList.group },
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

  // Reposition the player to the new node
  CList.fromnode = ToString;

  // Force a new layout
  var layout = webgraph.layout({ name: "cola", ...options });
  layout.run();
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
  });
  webgraph.add({
    data: { id: GoalNode, group: "Goal" },
  });

  CMap.Red.fromnode = StartNode;
  CMap.Orange.fromnode = StartNode;
  CMap.Yellow.fromnode = StartNode;
  CMap.Lime.fromnode = StartNode;
  CMap.Green.fromnode = StartNode;
  CMap.Cyan.fromnode = StartNode;
  CMap.Blue.fromnode = StartNode;
  CMap.Violet.fromnode = StartNode;
  CMap.Magenta.fromnode = StartNode;
  CMap.Brown.fromnode = StartNode;

  webgraph.nodes('[group = "Start"]').style("shape", "round-rectangle");
  webgraph.nodes('[group = "Start"]').style("text-outline-color", "#000");

  webgraph.nodes('[group = "Goal"]').style("shape", "star");
  webgraph.nodes('[group = "Goal"]').style("text-outline-color", "#000");
}

StartGame("That guy in the coca cola commercials", "Fish");

function createExampleGraph() {
  // A three player example of a race between Santa Claus and Fish
  AddNewPage("Red", "East-West Schism");
  AddNewPage("Red", "Lent");
  AddNewPage("Red", "Fish");

  AddNewPage("Magenta", "East-West Schism");
  AddNewPage("Magenta", "Lent");
  AddNewPage("Magenta", "Winter");

  AddNewPage("Yellow", "Saint Nick");
  AddNewPage("Yellow", "Christianty");
  AddNewPage("Yellow", "Catholicism");
  AddNewPage("Yellow", "Lent");
  AddNewPage("Yellow", "Fish");

  AddNewPage("Lime", "Coca Cola");
  AddNewPage("Lime", "Atlanta");
  AddNewPage("Lime", "Georgia");

  AddNewPage("Green", "East-West Schism");
  AddNewPage("Green", "Passover");
  AddNewPage("Green", "Pike");
  AddNewPage("Green", "Passover");
  AddNewPage("Green", "Carp");
  AddNewPage("Green", "Rough Fish");
  AddNewPage("Green", "Fish");

  AddNewPage("Cyan", "Coca Cola");
  AddNewPage("Cyan", "United States");
  AddNewPage("Cyan", "Fish");

  AddNewPage("Violet", "Coca Cola");
  AddNewPage("Violet", "Pepsi Cola");
  AddNewPage("Violet", "Pepsi");

  AddNewPage("Brown", "Coca Cola");
  AddNewPage("Brown", "Pepsi Cola");
  AddNewPage("Brown", "Pepsi");
  AddNewPage("Brown", "Soda");
  AddNewPage("Brown", "United States");

  AddNewPage("Orange", "Beard");
  AddNewPage("Orange", "Hair");
  AddNewPage("Orange", "Head");

  AddNewPage("Blue", "East-West Schism");
  AddNewPage("Blue", "Passover");
  AddNewPage("Blue", "Carp");
  AddNewPage("Blue", "Aquaculture");
  AddNewPage("Blue", "Goldfish");
  AddNewPage("Blue", "Fish");
}
