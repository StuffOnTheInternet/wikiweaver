var CMap = {
  red: {
    group: "Red",
    bgcolor: "#b00",
    linecolor: "#c00",
    arrowcolor: "#a00",
  },
  green: {
    group: "Green",
    bgcolor: "#0b0",
    linecolor: "#0c0",
    arrowcolor: "#0a0",
  },
  blue: {
    group: "Blue",
    bgcolor: "#00b",
    linecolor: "#00c",
    arrowcolor: "#00a",
  },
};

var defaults = {
  animate: true, // whether to show the layout as it's running
  refresh: 1, // number of ticks per frame; higher is faster but more jerky
  maxSimulationTime: 5000, // max length in ms to run the layout
  ungrabifyWhileSimulating: true, // so you can't drag nodes during layout
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

var FromRed;
var FromGreen;
var FromBlue;

function AddNewPage(Player, ToString) {
  // The server calls this function to add new pages
  AddNewElement(Player, ToString);
}

function AddNewElement(PColor, ToString) {
  var CList = CMap.red;
  if (PColor == "Green") {
    CList = CMap.green;
  } else if (PColor == "Blue") {
    CList = CMap.blue;
  }

  if (!webgraph.getElementById(ToString).inside()) {
    var FromNode = FromRed;
    if (PColor == "Blue") {
      var FromNode = FromBlue;
    } else if (PColor == "Green") {
      var FromNode = FromGreen;
    }
    webgraph.add({
      data: { id: ToString, group: PColor },
      position: {
        x: webgraph.getElementById(FromNode).position("x"),
        y: webgraph.getElementById(FromNode).position("y"),
      },
    });
    webgraph
      .nodes('[group = "' + CList.group + '"]')
      .style("background-color", CList.bgcolor);
  }

  var FromString;
  if (PColor == "Red") {
    FromString = FromRed;
    FromRed = ToString;
  } else if (PColor == "Green") {
    FromString = FromGreen;
    FromGreen = ToString;
  } else if (PColor == "Blue") {
    FromString = FromBlue;
    FromBlue = ToString;
  }

  webgraph.add({
    data: {
      group: PColor,
      source: FromString,
      target: ToString,
    },
  });

  webgraph
    .edges('[group = "' + CList.group + '"]')
    .style("line-color", CList.linecolor);
  webgraph
    .edges('[group = "' + CList.group + '"]')
    .style("target-arrow-color", CList.arrowcolor);

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

FromRed = "Santa Claus";
FromGreen = "Santa Claus";
FromBlue = "Santa Claus";

webgraph.nodes('[group = "Start"]').style("shape", "round-rectangle");
webgraph.nodes('[group = "Start"]').style("text-outline-color", "#000");
webgraph.nodes('[group = "Goal"]').style("shape", "star");
webgraph.nodes('[group = "Goal"]').style("text-outline-color", "#000");

// A three player example of a race between Santa Claus and Fish
AddNewPage("Red", "East-West Schism");
AddNewPage("Red", "Lent");
AddNewPage("Red", "Fish");

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
