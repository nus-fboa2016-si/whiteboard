var socket = io();

var camera, tick = 0,
    scene, renderer, clock = new THREE.Clock(true),
    container,
    options, spawnerOptions, particleSystem;

var defaultColor = currentColor = "#aa88ff";
var currentColorHex = 0xaa88ff;

var localDrawingAgent = "local";
var agents = {};


function DrawingAgent(name, color) {
  this.name = name;
  this.color = color;
  this.mousePos = [];
  this.isDrawing = false;
  this.isConfiguring = false;

  this.updatePos = function(newX, newY) {
    newX = Math.round(newX * 100) / 100;
    newY = Math.round(newY * 100) / 100;
    if (this.mousePos.length === 0) {
      // this.mousePos = {
      //   x: newX,
      //   y: newY,
      //   ex_x: newX,
      //   ex_y: newY
      // }
      this.mousePos.push([newX, newY]);
      this.mousePos.push([newX, newY]);
    } else {
      this.mousePos.push([newX, newY]);
      // this.mousePos.ex_x = this.mousePos.x;
      // this.mousePos.ex_y = this.mousePos.y;
      // this.mousePos.x = newX;
      // this.mousePos.y = newY;
    }
  };

  this.startDrawing = function() {
    this.isDrawing = true;
  };

  this.stopDrawing = function() {
    this.isDrawing = false;

    // clear previous mouse positions
    this.mousePos = [];
  }

  this.startConfiguring = function() {
    this.isConfiguring = true;
  };

  this.stopConfiguring = function() {
    this.isConfiguring = false;
  }

}

agents[localDrawingAgent] = new DrawingAgent(localDrawingAgent, currentColorHex);

$("#circle").spectrum({
  color: defaultColor,
  showButtons: false,
  change: function(color) {
    currentColor = color.toHexString(); // #ff0000
    $("#circle").attr("fill", currentColor);
    currentColorHex = parseInt(currentColor.replace(/^#/, ''), 16);
    options.color = currentColorHex;
    agents[localDrawingAgent].color = currentColorHex;
  },
  hide: function(color) {
    console.log("hide");
    agents[localDrawingAgent].stopConfiguring();
  },
  show: function(color) {
    console.log("show");
    agents[localDrawingAgent].startConfiguring();
  }
});

function handleMouseUp(event) {
  agents[localDrawingAgent].stopDrawing();
}

function handleMouseDown(event) {
  agents[localDrawingAgent].startDrawing();
}

function handleMouseMove(event) {
  var dot, eventDoc, doc, body, pageX, pageY;

  event = event || window.event; // IE-ism

  // If pageX/Y aren't available and clientX/Y are,
  // calculate pageX/Y - logic taken from jQuery.
  // (This is to support old IE)
  if (event.pageX == null && event.clientX != null) {
    eventDoc = (event.target && event.target.ownerDocument) || document;
    doc = eventDoc.documentElement;
    body = eventDoc.body;

    event.pageX = event.clientX +
      (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
      (doc && doc.clientLeft || body && body.clientLeft || 0);
    event.pageY = event.clientY +
      (doc && doc.scrollTop || body && body.scrollTop || 0) -
      (doc && doc.clientTop || body && body.clientTop || 0);
  }

  // Use event.pageX / event.pageY here
  var vector = new THREE.Vector3();

  vector.set(
    (event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1,
    0.5
  );

  vector.unproject(camera);

  var dir = vector.sub(camera.position).normalize();

  var distance = -camera.position.z / dir.z;

  var pos = camera.position.clone().add(dir.multiplyScalar(distance));

  if (agents[localDrawingAgent].isDrawing) {
    agents[localDrawingAgent].updatePos(pos.x, pos.y);
  }
}

// Map touch events to mouse events
function touchHandler(event) {
  var touches = event.changedTouches,
      first = touches[0],
      type = "";
  switch (event.type) {
    case "touchstart":
      type = "mousedown";
      break;
    case "touchmove":
      type = "mousemove";
      break;
    case "touchend":
      type = "mouseup";
      break;
    default:
      return;
  }

  // initMouseEvent(type, canBubble, cancelable, view, clickCount,
  //                screenX, screenY, clientX, clientY, ctrlKey,
  //                altKey, shiftKey, metaKey, button, relatedTarget);

  var simulatedEvent = document.createEvent("MouseEvent");
  simulatedEvent.initMouseEvent(type, true, true, window, 1,
      first.screenX, first.screenY,
      first.clientX, first.clientY, false,
      false, false, false, 0 /*left*/ , null);

  first.target.dispatchEvent(simulatedEvent);
  event.preventDefault();
}

function keypressHandler(event) {
  var key = event.which || event.keyCode;
  if (key === 99) {
    // "c" pressed
    clearScreen();
  }
}

function initEventListeners() {
  document.onmousemove = handleMouseMove;
  document.onmousedown = handleMouseDown;
  document.onmouseup = handleMouseUp;

  document.addEventListener("touchstart", touchHandler, true);
  document.addEventListener("touchmove", touchHandler, true);
  document.addEventListener("touchend", touchHandler, true);
  document.addEventListener("touchcancel", touchHandler, true);

  document.addEventListener("keypress", keypressHandler, true);
}

initEventListeners();

init();
animate();
var msgcount = 0;
socket.on("draw line", function() {
  drawLine.apply(null, arguments);
});

socket.on("user count", function(count) {
  console.log(count);
  updateCount(count);
});

function init() {
  initCount();
  container = document.createElement('div');
  document.body.appendChild(container);

  camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 100;

  scene = new THREE.Scene();

  // The GPU Particle system extends THREE.Object3D, and so you can use it
  // as you would any other scene graph component.  Particle positions will be
  // relative to the position of the particle system, but you will probably only need one
  // system for your whole scene
  particleSystem = new THREE.GPUParticleSystem({
    maxParticles: 250000
  });
  scene.add(particleSystem);


  // options passed during each spawned
  options = {
    position: new THREE.Vector3(),
    positionRandomness: .3,
    // positionRandomness: 0,
    velocity: new THREE.Vector3(),
    // velocityRandomness: 0,
    velocityRandomness: .5,
    color: currentColorHex,
    colorRandomness: .2,
    turbulence: 0.1,
    lifetime: 0.4,
    // size: 5,
    size: 10,
    sizeRandomness: 1
  };

  spawnerOptions = {
    spawnRate: 3000,
    horizontalSpeed: 0,
    verticalSpeed: 0,
    timeScale: 1
  };

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  //renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', onWindowResize, false);

}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

}

function animate() {

  requestAnimationFrame(animate);

  var delta = clock.getDelta() * spawnerOptions.timeScale;
  tick += delta;

  if (tick < 0) tick = 0;

  if (delta > 0) {
    maxSpawn = spawnerOptions.spawnRate * delta;

    var mousePos = agents[localDrawingAgent].mousePos;
    if (mousePos && agents[localDrawingAgent].isDrawing && mousePos.length >= 1) {
      var posEx = mousePos[0];
      var pos = mousePos[mousePos.length - 1];
      for (var x = 0; x < maxSpawn; x++) {
        percent = x / maxSpawn;
        options.position.x = posEx[0] * (1 - percent) + pos[0] * percent;
        options.position.y = posEx[1] * (1 - percent) + pos[1] * percent;

        particleSystem.spawnParticle(options);
      }
    }
  }
  for (var key in agents) {
    if (agents.hasOwnProperty(key)) {
      drawForAgent(agents[key]);
    }
  }

  particleSystem.update(tick);
  render();

}

function drawForAgent(agent) {
  if (!agent.isDrawing || agent.isConfiguring) {
    return;
  }
  if (agent.mousePos.length >= 2) {
    var posEx = agent.mousePos.shift();
    var pos = agent.mousePos[agent.mousePos.length - 1];
    // Interpolate between points
    drawLine(agent.color, posEx[0], posEx[1], pos[0], pos[1]);
    socket.emit('draw line', agent.color, posEx[0], posEx[1], pos[0], pos[1]);

    // Leave only the last point
    agent.mousePos = [pos];
    // drawLine(agent.color, agent.mousePos.ex_x, agent.mousePos.ex_y, agent.mousePos.x, agent.mousePos.y);
    // socket.emit('draw line', agent.color, agent.mousePos.ex_x, agent.mousePos.ex_y, agent.mousePos.x, agent.mousePos.y);
  }
}

function drawLine(color, x0, y0, x1, y1) {

  var material = new THREE.PointsMaterial({
    color: color,
    size: 0.5
  });
  //    console.log(x0 + "," + y0 + " " + x1 + "," + y1);

  // Two points at start and end of the line to smooth turning points
  // var geometryPointS = new THREE.Geometry();
  // geometryPointS.vertices.push(
  //   new THREE.Vector3(x0, y0, -1)
  // );
  // var pointStart = new THREE.Points(geometryPointS, material);
  // scene.add(pointStart);

  // var geometryPointE = new THREE.Geometry();
  // geometryPointE.vertices.push(
  //   new THREE.Vector3(x1, y1, -1)
  // );
  // var pointEnd = new THREE.Points(geometryPointE, material);
  // scene.add(pointEnd);

  var materialLine = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 2
  });
  var geometry = new THREE.Geometry();
  geometry.vertices.push(
    new THREE.Vector3(x0, y0, -1),
    new THREE.Vector3(x1, y1, -1)
  );
  var line = new THREE.Line(geometry, materialLine);
  scene.add(line);
}

function render() {
  //requestAnimationFrame(render);
  renderer.render(scene, camera);

}

function clearScreen() {
  for (var i = scene.children.length - 1; i > 0; i--) {
    // first element is THREE.GPUParticleSystem which should not be removed
    // console.log(obj instanceof THREE.GPUParticleSystem);
    scene.remove(scene.children[i]);
  }
}
