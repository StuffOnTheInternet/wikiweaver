// Color settings
var CMap = {
  Red: {
    group: "Red",
    bgcolor: "#b00",
    linecolor: "#c00",
    arrowcolor: "#a00",
    fromnode: "", // Assigned at startup
  },
  Yellow: {
    group: "Yellow",
    bgcolor: "#dc0",
    linecolor: "#dc0",
    arrowcolor: "#ba0",
    fromnode: "", // Assigned at startup
  },
  Green: {
    group: "Green",
    bgcolor: "#0b0",
    linecolor: "#0c0",
    arrowcolor: "#0a0",
    fromnode: "", // Assigned at startup
  },
  Blue: {
    group: "Blue",
    bgcolor: "#00b",
    linecolor: "#00c",
    arrowcolor: "#00a",
    fromnode: "", // Assigned at startup
  },
  Magenta: {
    group: "Magenta",
    bgcolor: "#b0b",
    linecolor: "#c0c",
    arrowcolor: "#a0a",
    fromnode: "", // Assigned at startup
  },
};

var defaults = {
  animate: true, // whether to show the layout as it's running
  refresh: 1, // number of ticks per frame; higher is faster but more jerky
  maxSimulationTime: 5000, // max length in ms to run the layout
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
  avoidOverlap: true, // if true, prevents overlap of node bounding boxes
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

  // Reposition the player to the new node
  CList.fromnode = ToString;

  // Force a new layout
  var layout = webgraph.layout({ name: "cola", ...defaults });
  layout.run();
}

var webgraph = cytoscape({
  container: document.getElementById("maincanvas"), // container to render in
  elements: [
    // list of graph elements to start with
    {
      // Start node
      data: { id: "Santa Claus", group: "Start" },
    },
    {
      // Goal node
      data: { id: "Fish", group: "Goal" },
    },
  ],
  style: [
    // the stylesheet for the graph
    {
      selector: "node",
      style: {
        "background-color": "#666",
        label: "data(id)",
        "font-size": 18,
        "text-outline-color": "#555",
        "text-outline-width": 1.6,
        color: "#fff",
      },
    },
    {
      selector: "edge",
      style: {
        width: 4,
        // label: "data(group)", Implement this as colorblind mode as a toggle
        "text-rotation": "autorotate",
        color: "#fff",
        "font-size": 10,
        "text-outline-color": "#000",
        "text-outline-width": 0.6,
        "line-color": "#abc",
        "target-arrow-color": "#abc",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
      },
    },
  ],
  layout: {
    name: "grid",
    rows: 1,
  },
});

CMap.Red.fromnode = "Santa Claus";
CMap.Green.fromnode = "Santa Claus";
CMap.Blue.fromnode = "Santa Claus";
CMap.Yellow.fromnode = "Santa Claus";
CMap.Magenta.fromnode = "Santa Claus";

webgraph.nodes('[group = "Start"]').style("shape", "round-rectangle");
webgraph.nodes('[group = "Start"]').style("text-outline-color", "#000");
webgraph.nodes('[group = "Goal"]').style("shape", "star");
webgraph.nodes('[group = "Goal"]').style("text-outline-color", "#000");

// A three player example of a race between Santa Claus and Fish
AddNewPage("Red", "East-West Schism");
AddNewPage("Red", "Lent");
AddNewPage("Red", "Fish");

AddNewPage("Magenta", "East-West Schism");
AddNewPage("Magenta", "Lent");
AddNewPage("Magenta", "Fish");

AddNewPage("Yellow", "Saint Nick");
AddNewPage("Yellow", "Christianty");
AddNewPage("Yellow", "Catholicism");
AddNewPage("Yellow", "Lent");
AddNewPage("Yellow", "Fish");

AddNewPage("Green", "East-West Schism");
AddNewPage("Green", "Passover");
AddNewPage("Green", "Pike");
AddNewPage("Green", "Passover");
AddNewPage("Green", "Carp");
AddNewPage("Green", "Rough Fish");
AddNewPage("Green", "Fish");

AddNewPage("Blue", "East-West Schism");
AddNewPage("Blue", "Passover");
AddNewPage("Blue", "Carp");
AddNewPage("Blue", "Aquaculture");
AddNewPage("Blue", "Goldfish");
AddNewPage("Blue", "Fish");

console.log(webgraph);
