function createWhiteboard(containerElement) {

  var containerZ,
      containerWidth, containerHeight;

  var socket;

  var mousePosTracker,  // relative to container
      spawnPosTracker;  // unprojected 3d world coordinates

  var drawCanvas, drawCtx,
      colorVal, size,   // colorVal is a number
      cacheCanvas, cacheCtx,        // hidden, used to redraw canvas on resize
      isDrawing,
      DRAW_LAYER_RELATIVE_Z = 0,   // bottom layer
      COLOR_PICKER_RELATIVE_Z = 2; // top layer

  var camera, scene, renderer,
      clock, tick,
      particleSystem,
      particleOpts,
      spawnerOpts,
      FX_LAYER_RELATIVE_Z = 1;  // middle layer


  init();


  function init() {
    initContainerDimensions();

    initDrawLayer();
    initGFXLayer();

    initPosTrackers();
    animate();

    initSocket();
    initEventHandlers();
  }

  function initContainerDimensions() {
    containerZ = getZIndex(containerElement);
    containerWidth = containerElement.offsetWidth;
    containerHeight = containerElement.offsetHeight;
  }

  ////////////////// events

  function initEventHandlers() {
    containerElement.addEventListener('mousedown', handleMousePress);
    containerElement.addEventListener('mousemove', handleMouseMove);
    containerElement.addEventListener('mouseup', handleMouseRelease);

    containerElement.addEventListener('touchstart', handleTouch, true);
    containerElement.addEventListener('touchmove', handleTouch, true);
    containerElement.addEventListener('touchend', handleTouch, true);
    containerElement.addEventListener('touchcancel', handleTouch, true);

    containerElement.addEventListener('keypress', handleKeypress, true);

    var RESIZE_HANDLING_RATE = 25; // 25fps resizing responsiveness
    window.addEventListener('resize', createResizeHandler(RESIZE_HANDLING_RATE)); // createResizeHandler must be evaluated!
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

  function handleMousePress(e) {
    var x = e.offsetX || e.pageX - drawCanvas.offsetLeft;
    var y = e.offsetY || e.pageY - drawCanvas.offsetTop;
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

  // wraps actual resize handling code inside closure that throttles rate of resize
  // events triggering and being handled.
  // @param targetRate: Number, target rate of resize event handling (per second)
  function createResizeHandler(targetRate) {
    var resizeTimeout = null; // closure var to track and control resize rate

    return function() {
      if (resizeTimeout != null) return; // resize control timer has not cooled down
      resizeTimeout = setTimeout(
          function() {
            resizeTimeout = null;
            resizeCanvases();
          },
          1000/targetRate
      );
    };
  }

  function resizeCanvases() {
    var w = containerElement.offsetWidth;
    var h = containerElement.offsetHeight;
    if (w === containerWidth && h === containerHeight) return;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);

    fitCanvasToContainer(drawCanvas);
    var cached = cacheCtx.getImageData(0, 0, w, h);
    drawCtx.putImageData(cached, 0, 0);
  }

  //////////////////// coordinate trackers

  function initPosTrackers() {
    mousePosTracker = {};
    spawnPosTracker = {};
    resetPosTrackers();
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
    drawCanvas = document.createElement('canvas');
    containerElement.appendChild(drawCanvas);
    fitCanvasToContainer(drawCanvas);

    drawCanvas.style.position = 'absolute';
    drawCanvas.style.zIndex = containerZ + DRAW_LAYER_RELATIVE_Z;

    drawCtx = drawCanvas.getContext('2d');
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    colorVal = 0xffffff;
    size = 1;
    isDrawing = false;

    cacheCanvas = document.createElement('canvas'); // this is not in DOM body
    fitCanvasToContainer(cacheCanvas);
    cacheCtx = cacheCanvas.getContext('2d');

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
    drawLineOnBoard(line);
    drawLineToCache(line);
  }

  function drawLineOnBoard(line) {
    drawCtx.strokeStyle = line.color;
    drawCtx.lineWidth = line.width;
    drawCtx.beginPath();
    drawCtx.moveTo(line.startX, line.startY);
    drawCtx.lineTo(line.endX, line.endY);
    drawCtx.stroke();
  }

  function drawLineToCache(line) {
    expandCache(
        Math.max(line.startX, line.endX),
        Math.max(line.startY, line.endY)
    );
    cacheCtx.strokeStyle = line.color;
    cacheCtx.lineWidth = line.width;
    cacheCtx.beginPath();
    cacheCtx.moveTo(line.startX, line.startY);
    cacheCtx.lineTo(line.endX, line.endY);
    cacheCtx.stroke();
  }

  // expands cache if necessary.
  function expandCache(maxX, maxY) {
    var width = cacheCanvas.width;
    var height = cacheCanvas.height;
    // only resize if new line out of bounds
    if (height >= maxY && width >= maxX) return;

    var snapshot = cacheCtx.getImageData(0, 0, cacheCanvas.width, cacheCanvas.height);
    // double dimensions (don't keep resizing for small movements)
    while (maxX > width || maxY > height) {
      width *= 2;
      height *= 2;
    }
    cacheCanvas.width = width;
    cacheCanvas.height = height;
    cacheCtx.putImageData(snapshot, 0, 0);
  }

  function clearScreen() {
  //TODO
  }

  ////////////////// 3d effects

  function initGFXLayer() {

    tick = 0;
    clock = new THREE.Clock(true);

    camera = new THREE.PerspectiveCamera(28, containerElement.offsetWidth / containerElement.offsetHeight, 1, 10000);
    camera.position.z = 100;

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setSize(containerElement.offsetWidth, containerElement.offsetHeight);
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
    fitCanvasToContainer(renderer.domElement);

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
      lifetime: 1,
      size: 20,
      sizeRandomness: 1
    };
    spawnerOpts = {
      spawnRate: 1000,
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

  function fitCanvasToContainer(canvas){
    canvas.width  = containerElement.offsetWidth;
    canvas.height = containerElement.offsetHeight;
  }

  function getZIndex(element) {
    var z = window.document.defaultView.getComputedStyle(element).getPropertyValue('z-index');
    if (isNaN(z)) {
      return getZIndex(element.parentNode);
    }
    return z;
  }

}
//
//WRITE TO CACHE
//CACHE RESIZE
//CACHE LOAD ON RESIZE
//COLOR PICKER
