function createWhiteboard(containerElement) {

  var containerZ,
      prevContainerWidth, prevContainerHeight;

  var socket;

  var mousePosTracker,  // relative to container
      spawnPosTracker;  // unprojected 3d world coordinates

  var DRAW_LAYER_RELATIVE_Z = 0,  // bottom layer
      drawCanvas, drawCtx,
      colorVal, penSize,             // colorVal is a number
      cacheCanvas, cacheCtx,      // hidden, used to redraw canvas on resize
      isDrawing;

  var GFX_LAYER_RELATIVE_Z = 1,   // middle layer
      camera, scene, renderer,
      clock, tick,
      particleSystem,
      particleOpts, spawnerOpts;

  var OVERLAY_RELATIVE_Z = 2,     // top layer
      pickerShape,
      uCountSVGText;

  var DEFAULT_COLOR = 0xaa88ff; // alternatively, 0xffffff

  /////////////////// end shared var declarations

  socket = io(); // WAOW! AMAZING!

  recordContainerDimensions();
  initPosTrackers();

  initDrawLayer();
  initGFXLayer();
  initOverlay();

  animate();
  initEventHandlers();


  function recordContainerDimensions() {
    containerZ = getZIndex(containerElement);
    prevContainerWidth = containerElement.offsetWidth;
    prevContainerHeight = containerElement.offsetHeight;
  }

  ////////////////// events

  function initEventHandlers() {
    containerElement.addEventListener('mousedown', handleMousePress, true);
    containerElement.addEventListener('mousemove', handleMouseMove, true);
    containerElement.addEventListener('mouseup', handleMouseRelease, true);

    containerElement.addEventListener('touchstart', handleTouch, true);
    containerElement.addEventListener('touchmove', handleTouch, true);
    containerElement.addEventListener('touchend', handleTouch, true);
    containerElement.addEventListener('touchcancel', handleTouch, true);

    //TODO make it only work when whiteboard container is active
    document.addEventListener('keypress', handleKeypress, true);

    var RESIZE_HANDLING_RATE = 4; // 4fps resizing responsiveness
    window.addEventListener('resize', createThrottledResizeHandler(RESIZE_HANDLING_RATE));
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

    first.target.dispatchEvent(simulatedMouseEvent);
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
    e.preventDefault();
    var targetPagePos = getPagePosition(e.target);
    var containerPagePos = getPagePosition(containerElement);
    var x = e.offsetX + targetPagePos.x - containerPagePos.x;
    var y = e.offsetY + targetPagePos.y - containerPagePos.y;
    updatePosTrackers(x,y);
    isDrawing = true;
  }

  function handleMouseRelease() {
    isDrawing = false;
    resetPosTrackers();
  }

  function handleMouseMove(e) {
    if (!isDrawing) return;

    var targetPagePos = getPagePosition(e.target);
    var containerPagePos = getPagePosition(containerElement);
    var x = e.offsetX + targetPagePos.x - containerPagePos.x;
    var y = e.offsetY + targetPagePos.y - containerPagePos.y;
    updatePosTrackers(x, y);
    
    var newLine = {
      startX: mousePosTracker.prevX,
      startY: mousePosTracker.prevY,
      endX: mousePosTracker.newX,
      endY: mousePosTracker.newY,
      width: penSize,
      color: "#" + colorVal.toString(16)
    };

    drawLine(newLine);
    socket.emit('draw line', newLine);
  }

  /*
   wraps actual resize handling code inside closure and throttles rate of resize
   events triggering and being handled.
   @param targetRate: Number, target rate of resize event handling (per second)
   */
  function createThrottledResizeHandler(targetRate) {
    var resizeTimeout = null; // closure var to track and control resize rate

    return function() {
      if (resizeTimeout != null) return; // resize control timer has not cooled down
      resizeTimeout = setTimeout(
          function() {
            resizeTimeout = null;
            resizeHandler();
          },
          1000/targetRate
      );
    };
  }

  function resizeHandler() {
    var w = containerElement.offsetWidth;
    var h = containerElement.offsetHeight;
    if (w === prevContainerWidth && h === prevContainerHeight) return;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);

    // resize draw canvas and reload image data from cache
    fitCanvasToContainer(drawCanvas);
    var cached = cacheCtx.getImageData(0, 0, w, h);
    drawCtx.putImageData(cached, 0, 0);

    recordContainerDimensions();
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

  //////////////////// overlay (color picker, connection count etc)

  function initOverlay() {
    initUserCount();
    initColorPicker();
  }

  function initColorPicker() {
    var s;
    colorVal = DEFAULT_COLOR;
    
    var pickerPosDiv= document.createElement('div');
    containerElement.appendChild(pickerPosDiv);
    s = pickerPosDiv.style;
    s.position = 'absolute';
    s.width = '100%';

    var pickerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pickerSvg.id = 'wb-overlay-color-picker-svg';
    //pickerSvg.setAttribute('height', '30');
    //pickerSvg.setAttribute('width', '30');
    pickerPosDiv.appendChild(pickerSvg);
    s = pickerSvg.style;
    s.height = '30px';
    s.width = '30px';
    s.display = 'block';
    s.margin = '0 auto';
    s.top = '35px';
    s.position = 'relative';
    s.zIndex = containerZ + OVERLAY_RELATIVE_Z;

    pickerShape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pickerShape.id = 'wb-overlay-color-picker-shape';
    pickerShape.setAttribute('cx', '15');
    pickerShape.setAttribute('cy', '15');
    pickerShape.setAttribute('r', '15');
    pickerShape.setAttribute('fill', '#'+colorVal.toString(16));
    pickerSvg.appendChild(pickerShape);

    $(pickerShape).spectrum({
      color: '#' + colorVal.toString(16),
      showButtons: false,
      change: function(newColor) {
        var colorHex = newColor.toHex();
        pickerShape.setAttribute('fill', '#'+colorHex);
        colorVal = parseInt(colorHex, 16);
        particleOpts.color = colorVal;
      },
      hide: function(color) {
      },
      show: function(color) {
      }
    });

    var hoverRule = '#' + pickerShape.id + ':hover{cursor:pointer;}';
    addRuleCSS(hoverRule);
  }

  function initUserCount() {
    var s;

    var uCountSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    uCountSVG.id = 'wb-overlay-usercount-svg';
    s = uCountSVG.style;
    s.width = '100%';
    s.height = '30px';
    s.position = 'absolute';
    s.left = '10px';
    s.bottom = '10px';
    s.zIndex = containerZ + OVERLAY_RELATIVE_Z;
    containerElement.appendChild(uCountSVG);

    uCountSVGText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    uCountSVGText.id = 'wb-overlay-usercount-text';
    uCountSVGText.textContent = 'Loading user count...';
    uCountSVGText.setAttribute('x', '0');
    uCountSVGText.setAttribute('y', '30');
    s = uCountSVGText.style;
    s.textAnchor = 'start';
    s.fill = '#00D5B0';
    s.fontSize = '24px';
    s.fontFamily = 'sans-serif';
    uCountSVG.appendChild(uCountSVGText);

    socket.on('user count', updateUserCount);
    socket.emit('get user count');
  }

  function updateUserCount(newCount) {
    uCountSVGText.textContent = 'CONNECTED: ' + newCount;
  }

  //////////////////// draw canvas

  function initDrawLayer() {
    drawCanvas = document.createElement('canvas');
    drawCanvas.id = 'wb-draw-layer-canvas';
    containerElement.appendChild(drawCanvas);
    fitCanvasToContainer(drawCanvas);

    drawCanvas.style.position = 'absolute';
    drawCanvas.style.zIndex = containerZ + DRAW_LAYER_RELATIVE_Z;

    drawCtx = drawCanvas.getContext('2d');
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    colorVal = DEFAULT_COLOR;
    penSize = 2;
    isDrawing = false;

    cacheCanvas = document.createElement('canvas'); // this is not in DOM body
    fitCanvasToContainer(cacheCanvas);
    cacheCtx = cacheCanvas.getContext('2d')

    socket.on('draw line', drawLine);
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

  // expands cache if necessary. will not shrink unless cleared (see clearScreen)
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
    fitCanvasToContainer(cacheCanvas); // reset cache size to match draw canvas size
    cacheCtx.clearRect(0, 0, cacheCanvas.width, cacheCanvas.height);
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
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

    // See THREE.js github gpuparticle example
    particleSystem = new THREE.GPUParticleSystem({
      maxParticles: 250000
    });
    scene = new THREE.Scene();
    scene.add(particleSystem);

    containerElement.appendChild(renderer.domElement);
    fitCanvasToContainer(renderer.domElement);
    renderer.domElement.id = 'wb-gfx-layer-canvas';

    renderer.domElement.style.zIndex = containerZ + GFX_LAYER_RELATIVE_Z;
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

  ////////////////// utility

  function fitCanvasToContainer(canvas){
    canvas.width  = containerElement.offsetWidth;
    canvas.height = containerElement.offsetHeight;
  }

  function getZIndex(element) {
    var z = window.document.defaultView.getComputedStyle(element).getPropertyValue('z-index');
    if (element.nodeName == 'BODY') return 0;
    if (isNaN(z)) {
      return getZIndex(element.parentNode);
    }
    return z;
  }

  function getPagePosition(element) {
    var clientRect = element.getBoundingClientRect();
    return {
      x: clientRect.left + window.scrollX,
      y: clientRect.top + window.scrollY
    };
  }

  function addRuleCSS(ruleText) {
    var styleElem = document.createElement('style');
    if (styleElem.styleSheet) {
      styleElem.styleSheet.cssText = ruleText;
    } else {
      styleElem.appendChild(document.createTextNode(ruleText));
    }
    document.getElementsByTagName('head')[0].appendChild(styleElem);
  }
}
