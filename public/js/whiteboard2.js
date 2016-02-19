function createWhiteboard(containerElement) {

  var containerZ;

  var socket;

  var drawCanvasElement, drawContext,
      colorVal, size, // colorVal is a number
      mousePosTracker,       // relative to container
      isDrawing,
      DRAW_LAYER_RELATIVE_Z = 0,   // bottom layer
      COLOR_PICKER_RELATIVE_Z = 2; // top layer

  var camera, scene, renderer,
      clock, tick,
      particleSystem,
      particleOpts,
      spawnPosTracker,
      spawnerOpts,
      FX_LAYER_RELATIVE_Z = 1;  // middle layer


  init();


  function init() {
    containerZ = getZIndex(containerElement);
    initDrawLayer();
    initGFXLayer();
    initPosTrackers();
    animate();
    initSocket();
    initEventHandlers();
    //window.ps = particleSystem;
  }

  ////////////////// events

  function initPosTrackers() {
    mousePosTracker = {};
    spawnPosTracker = {};
    resetPosTrackers();
  }

  function initEventHandlers() {
    containerElement.addEventListener('mousedown', handleMousePress);
    containerElement.addEventListener('mousemove', handleMouseMove);
    containerElement.addEventListener('mouseup', handleMouseRelease);

    containerElement.addEventListener('touchstart', handleTouch, true);
    containerElement.addEventListener('touchmove', handleTouch, true);
    containerElement.addEventListener('touchend', handleTouch, true);
    containerElement.addEventListener('touchcancel', handleTouch, true);

    containerElement.addEventListener('keypress', handleKeypress, true);

    window.addEventListener('resize', handleResize, true);
  }

  function handleTouch(e) {
    var touches = e.changedTouches,
        first = touches[0],
        type = "";
    switch (e.type) {
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
    var simulatedMouseEvent = document.createEvent('MouseEvent');
    simulatedMouseEvent.initMouseEvent(type, true, true, window, 1,
        first.screenX, first.screenY,
        first.clientX, first.clientY, false,
        false, false, false, 0 /*left*/ , null);

    first.target.dispatchEvent(simulatedEvent);
    event.preventDefault();
  }

  function handleKeypress(e) {
    var key = e.which || e.keyCode;
    if (key === 99) {
      // "c" pressed
      clearScreen();
    }
  }

  function handleResize(e) {
    
  }

  function handleMousePress(e) {
    var x = e.offsetX || e.pageX - drawCanvasElement.offsetLeft;
    var y = e.offsetY || e.pageY - drawCanvasElement.offsetTop;
    updatePosTrackers(x,y);
    isDrawing = true;
  }

  function handleMouseRelease(e) {
    isDrawing = false;
    resetPosTrackers();
  }

  function handleMouseMove(e) {
    if (!isDrawing) return;

    var x = e.offsetX || e.pageX - containerElement.offsetLeft;
    var y = e.offsetY || e.pageY - containerElement.offsetTop;
    console.log(x + ' ' + y);
    updatePosTrackers(x, y);
    
    var newLine = {
      startX: mousePosTracker.prevX,
      startY: mousePosTracker.prevY,
      endX: mousePosTracker.newX,
      endY: mousePosTracker.newY,
      width: size,
      color: "#" + colorVal.toString(16)
    };

    drawLine(newLine);
    socket.emit('draw line', newLine);
  }

  function updatePosTrackers(offsetX, offsetY) {
    updateTracker(mousePosTracker, offsetX, offsetY);
    var newSpawnPos = getWorldPosFromCameraPos(offsetX, offsetY);
    updateTracker(spawnPosTracker, newSpawnPos.x, newSpawnPos.y);
  }

  function resetPosTrackers() {
    var m = mousePosTracker;
    var s = spawnPosTracker;
    m.newX = 
      m.newY =
        m.prevX =
          m.prevY =
            null;
    s.newX =
      s.newY =
        s.prevX =
          s.prevY =
            null;
  }

  function updateTracker(tracker, x, y) {
    tracker.prevX = tracker.newX === null ? x : tracker.newX;
    tracker.prevY = tracker.newY === null ? y : tracker.newY;
    tracker.newX = x;
    tracker.newY = y;
  }

  //////////////////// draw canvas

  function initDrawLayer() {
    drawCanvasElement = document.createElement('canvas');
    containerElement.appendChild(drawCanvasElement);
    fitCanvasToParent(drawCanvasElement);

    drawCanvasElement.style.position = 'absolute';
    drawCanvasElement.style.zIndex = containerZ + DRAW_LAYER_RELATIVE_Z;

    drawContext = drawCanvasElement.getContext('2d');
    drawContext.lineCap = 'round';
    drawContext.lineJoin = 'round';

    colorVal = 0xffffff;
    size = 1;
    isDrawing = false;

    initColorPicker();
  }

  function initColorPicker() {

    var svg = document.createElement('svg');
    containerElement.appendChild(svg);
    svg.height = '100px';
    svg.width = '100px';
    svg.style.display = 'block';
    svg.style.margin = '0 auto';

    svg.style.position = 'absolute';
    svg.style.zIndex = containerZ + COLOR_PICKER_RELATIVE_Z;

    var picker = document.createElement('circle');
    svg.appendChild(picker);
    picker.setAttribute('cx', '50');
    picker.setAttribute('cy', '50');
    picker.setAttribute('r', '15');
    picker.style.fill = colorVal.toString(16);


    $(picker).spectrum({
      color: '#' + colorVal.toString(16),
      showButtons: false,
      change: function(newColor) {
        var colorHex = newColor.toHex();
        picker.style.fill(colorHex);
        colorVal = parseInt(colorHex, 16);
        particleOpts.color = colorVal;
        colorVal = colorVal;
      },
      hide: function(color) {
        agents[localDrawingAgent].stopConfiguring();
      },
      show: function(color) {
        agents[localDrawingAgent].startConfiguring();
      }
    });
  }

  function drawLine(line) {
    var ctx = drawContext;
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;
    ctx.beginPath();
    ctx.moveTo(line.startX, line.startY);
    ctx.lineTo(line.endX, line.endY);
    ctx.stroke();
  }

  function clearScreen() {
  //TODO
  }

  ////////////////// 3d effects

  function initGFXLayer() {

    tick = 0;
    clock = new THREE.Clock(true);

    camera = new THREE.PerspectiveCamera(28, containerElement.clientWidth / containerElement.clientHeight, 1, 10000);
    camera.position.z = 100;

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
    renderer.setClearColor(0x000000, 0);


    // The GPU Particle system extends THREE.Object3D, and so you can use it
    // as you would any other scene graph component.  Particle positions will be
    // relative to the position of the particle system, but you will probably only need one
    // system for your whole scene
    particleSystem = new THREE.GPUParticleSystem({
      maxParticles: 250000
    });
    scene = new THREE.Scene();
    scene.add(particleSystem);

    containerElement.appendChild(renderer.domElement);
    fitCanvasToParent(renderer.domElement);

    renderer.domElement.style.zIndex = containerZ + FX_LAYER_RELATIVE_Z;
    renderer.domElement.style.position = 'absolute';

    spawnPosTracker = {
      prevX: null,
      newX: null,
      prevY: null,
      newY: null
    };
    particleOpts = {
      position: new THREE.Vector3(),
      positionRandomness: .3,
      velocity: new THREE.Vector3(),
      velocityRandomness: .5,
      color: colorVal,
      colorRandomness: .2,
      turbulence: 0.4,
      lifetime: 1.5,
      size: 20,
      sizeRandomness: 1
    };
    spawnerOpts = {
      spawnRate: 1500,
      horizontalSpeed: 0,
      verticalSpeed: 0,
      timeScale: 1
    };
  }

  function animate() {

    requestAnimationFrame(animate);

    var delta = clock.getDelta() * spawnerOpts.timeScale;
    tick += delta;

    if (isDrawing && delta > 0) {
      var maxSpawn = spawnerOpts.spawnRate * delta;
      for (var i = 0; i < maxSpawn; i++) {
        var percent = i / maxSpawn;
        particleOpts.position.x = spawnPosTracker.prevX*(1 - percent) + spawnPosTracker.newX*percent;
        particleOpts.position.y = spawnPosTracker.prevY*(1 - percent) + spawnPosTracker.newY*percent;
        particleSystem.spawnParticle(particleOpts);
      }
    }

    if (tick < 0) tick = 0;
    particleSystem.update(tick);
    renderer.render(scene, camera);
  }

  function getWorldPosFromCameraPos(x, y) {
    var vector = new THREE.Vector3();
    vector.set(
        (x / window.innerWidth) * 2 - 1,
        -(y / window.innerHeight) * 2 + 1,
        0.5
    );

    vector.unproject(camera);

    var dir = vector.sub(camera.position).normalize();
    var distance = -camera.position.z / dir.z;
    var pos = camera.position.clone().add(dir.multiplyScalar(distance));
    return {
      x: pos.x,
      y: pos.y,
      z: pos.z
    }
  }

  ////////////////// network

  function initSocket() {
    socket = io();
    socket.on('draw line', drawLine);
    //socket.on('user count', );
  }

  ////////////////// utility

  function fitCanvasToParent(canvas){
    canvas.width  = canvas.parentNode.clientWidth;
    canvas.height = canvas.parentNode.clientHeight;
  }

  function getZIndex(element) {
    var z = window.document.defaultView.getComputedStyle(element).getPropertyValue('z-index');
    if (isNaN(z)) {
      return getZIndex(element.parentNode);
    }
    return z;
  }

}
function part(x, y) {
for (var i = 0; i < 500; i++) {
  var pos = new THREE.Vector3();
  pos.x = x;
  pos.y = y;
ps.spawnParticle({
  position: pos,
  positionRandomness: .3,
  velocity: new THREE.Vector3(),
  velocityRandomness: .5,
  color: 0x999999,
  colorRandomness: .2,
  turbulence: 0.1,
  lifetime: 5,
  size: 10,
  sizeRandomness: 1
});}}