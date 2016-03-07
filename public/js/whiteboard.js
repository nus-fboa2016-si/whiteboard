var createWhiteboard = function(containerElement) {
  var containerZ,
    prevContainerWidth, prevContainerHeight;

  var socket;

  var mouse2dPosTracker; // relative to container

  var DRAW_LAYER_RELATIVE_Z = 0; // bottom layer
  var drawCanvas, drawCtx,
    colorHex, penSize, // colorHex is a hex string
    cacheCanvas, cacheCtx, // hidden, used to redraw canvas on resize
    isDrawing;

  var GFX_LAYER_RELATIVE_Z = 1; // middle layer
  var camera, scene, renderer,
    clock, tick,
    particleSystem,
    spawnerOpts,
    unanimatedLines;

  var OVERLAY_RELATIVE_Z = 2; // top layer
  var pickerShape,
    uCountSVGText;

  var DEFAULT_COLORHEX = 'aa88ff'; // alternatively, 0xffffff

  // ---------------- end shared var declarations

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

  // ---------------- events

  function initEventHandlers() {
    containerElement.onmousedown = handleMousePress;
    containerElement.onmousemove = handleMouseMove;
    containerElement.onmouseup = handleMouseRelease;

    containerElement.addEventListener('touchstart', handleTouch, true);
    containerElement.addEventListener('touchmove', handleTouch, true);
    containerElement.addEventListener('touchend', handleTouch, true);
    containerElement.addEventListener('touchcancel', handleTouch, true);

    // Detect mouse release outside the window
    document.addEventListener('mouseup', handleMouseRelease, true);
    // Clear position when mouse outside window but continue drawing when come back
    document.onmouseout = handleMouseOut;

    // TODO make it only work when whiteboard container is active
    document.addEventListener('keypress', handleKeypress, true);

    var RESIZE_HANDLING_RATE = 4; // 4fps resizing responsiveness
    window.addEventListener('resize', createThrottledResizeHandler(RESIZE_HANDLING_RATE));
  }

  function handleTouch(e) {
    var touches = e.changedTouches;
    var first = touches[0];
    var type = '';
    switch (e.type) {
      case 'touchstart':
        type = 'mousedown';
        break;
      case 'touchmove':
        type = 'mousemove';
        break;
      case 'touchend':
        type = 'mouseup';
        break;
      default:
        return;
    }
    var simulatedMouseEvent = document.createEvent('MouseEvent');
    simulatedMouseEvent.initMouseEvent(type, true, true, window, 1,
      first.screenX, first.screenY,
      first.clientX, first.clientY, false,
      false, false, false, 0 /* left*/, null);

    first.target.dispatchEvent(simulatedMouseEvent);
    // Don't prevent default for color picker
    // event.preventDefault();
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
    // Compatibility fix for firefox
    var xpos = e.offsetX === undefined ?
        (e.originalEvent === undefined ? e.layerX : e.originalEvent.layerX) : e.offsetX;
    var ypos = e.offsetY === undefined ?
        (e.originalEvent === undefined ? e.layerY : e.originalEvent.layerY) : e.offsetY;
    var targetPagePos = getPagePosition(e.target);
    var containerPagePos = getPagePosition(containerElement);
    var x = xpos + targetPagePos.x - containerPagePos.x;
    var y = ypos + targetPagePos.y - containerPagePos.y;
    updateTracker(mouse2dPosTracker, x, y);
    isDrawing = true;
  }

  function handleMouseRelease() {
    isDrawing = false;
    resetPosTrackers();
  }

  function handleMouseMove(e) {
    if (!isDrawing) return;
    // Compatibility fix for firefox
    var xpos = e.offsetX === undefined
      ? (e.originalEvent === undefined ? e.layerX : e.originalEvent.layerX) : e.offsetX;
    var ypos = e.offsetY === undefined
      ? (e.originalEvent === undefined ? e.layerY : e.originalEvent.layerY) : e.offsetY;
    var targetPagePos = getPagePosition(e.target);
    var containerPagePos = getPagePosition(containerElement);
    var x = xpos + targetPagePos.x - containerPagePos.x;
    var y = ypos + targetPagePos.y - containerPagePos.y;
    updateTracker(mouse2dPosTracker, x, y);
    var newLine = {
      startX: mouse2dPosTracker.prevX,
      startY: mouse2dPosTracker.prevY,
      endX: mouse2dPosTracker.newX,
      endY: mouse2dPosTracker.newY,
      width: penSize,
      colorHex: colorHex
    };

    drawLine(newLine);
    unanimatedLines.push(newLine);
    socket.emit('draw line', newLine);
  }

  function handleMouseOut(e) {
    e = e || window.event;
    var from = e.relatedTarget || e.toElement;
    if (!from || from.nodeName === 'HTML') {
      // handleMouseRelease();
      resetPosTrackers();
    }
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
        1000 / targetRate
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

  // ---------------- coordinate trackers

  function initPosTrackers() {
    mouse2dPosTracker = {};
    resetPosTrackers();
  }

  function resetPosTrackers() {
    var m = mouse2dPosTracker;
    m.newX =
      m.newY =
      m.prevX =
      m.prevY =
      null;
  }

  function updateTracker(tracker, x, y) {
    tracker.prevX = tracker.newX === null ? x : tracker.newX;
    tracker.prevY = tracker.newY === null ? y : tracker.newY;
    tracker.newX = x;
    tracker.newY = y;
  }

  // ---------------- overlay (color picker, connection count etc)

  function initOverlay() {
    initUserCount();
    initColorPicker();
  }

  function initColorPicker() {
    var pickerElem = initPickerElement();
    var hoverRule = '#' + pickerElem.id + ':hover{cursor:pointer;}';
    addRuleCSS(hoverRule);

    $(pickerElem).spectrum({
      color: '#' + colorHex,
      showButtons: false,
      clickoutFiresChange: true,
      change: function(newColor) {
        colorHex = newColor.toHex();
        pickerElem.setAttribute('fill', '#' + colorHex);
      },
      hide: function(color) {},
      show: function(color) {}
    });
  }

  function initPickerElement() {
    var s;
    colorHex = DEFAULT_COLORHEX;

    var pickerPosDiv = document.createElement('div');
    containerElement.appendChild(pickerPosDiv);
    s = pickerPosDiv.style;
    s.position = 'absolute';
    s.width = '100%';

    var pickerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pickerSvg.id = 'wb-overlay-color-picker-svg';
    // pickerSvg.setAttribute('height', '30');
    // pickerSvg.setAttribute('width', '30');
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
    pickerShape.setAttribute('fill', '#' + colorHex);
    pickerSvg.appendChild(pickerShape);
    return pickerShape;
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

  // ---------------- draw canvas

  function initDrawLayer() {
    drawCanvas = document.createElement('canvas');
    drawCanvas.id = 'wb-draw-layer-canvas';
    drawCanvas.textContent = 'HTTP Canvas not supported :(';
    containerElement.appendChild(drawCanvas);
    fitCanvasToContainer(drawCanvas);

    drawCanvas.style.position = 'absolute';
    drawCanvas.style.zIndex = containerZ + DRAW_LAYER_RELATIVE_Z;

    drawCtx = drawCanvas.getContext('2d');
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    colorHex = DEFAULT_COLORHEX;
    penSize = 2;
    isDrawing = false;

    cacheCanvas = document.createElement('canvas'); // this is not in DOM body
    fitCanvasToContainer(cacheCanvas);
    cacheCtx = cacheCanvas.getContext('2d');

    socket.on('buffered lines', function(lines) {
      lines.forEach(drawLine);
    });
    socket.on('draw line', function(line) {
      drawLine(line);
      unanimatedLines.push(line);
    });
  }

  function drawLine(line) {
    // board update
    drawLineTo2dCtx(line, drawCtx);
    // cache update
    expandCache(
        Math.max(line.startX, line.endX),
        Math.max(line.startY, line.endY)
    );
    drawLineTo2dCtx(line, cacheCtx);
  }

  function drawLineTo2dCtx(line, ctx) {
    ctx.strokeStyle = '#' + line.colorHex;
    ctx.lineWidth = line.width;
    ctx.beginPath();
    ctx.moveTo(line.startX, line.startY);
    ctx.lineTo(line.endX, line.endY);
    ctx.stroke();
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

  // ---------------- 3d effects

  function initGFXLayer() {
    tick = 0;
    clock = new THREE.Clock(true);
    unanimatedLines = [];

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

    spawnerOpts = {
      spawnRate: 3000,
      horizontalSpeed: 0,
      verticalSpeed: 0,
      timeScale: 1
    };
  }

  function animate() {
    requestAnimationFrame(animate);
    var delta = clock.getDelta() * spawnerOpts.timeScale;
    var maxSpawn = spawnerOpts.spawnRate * delta;
    tick += delta;

    unanimatedLines.forEach(function(line) {
      spawnParticlesAlongLine(maxSpawn / unanimatedLines.length, line);
    });
    unanimatedLines = [];

    if (tick < 0) tick = 0;
    particleSystem.update(tick);
    renderer.render(scene, camera);
  }

  function spawnParticlesAlongLine(number, line) {
    for (var i = 0; i < number; i++) {
      var percent = i / number;
      var pos = getWorldPosFromCameraPos(
          line.startX * (1 - percent) + line.endX * percent,
          line.startY * (1 - percent) + line.endY * percent
      );
      particleSystem.spawnParticle({
        position: new THREE.Vector3(pos.x, pos.y, 0),
        positionRandomness: 0.5,
        velocity: new THREE.Vector3(),
        velocityRandomness: 0.5,
        color: parseInt(line.colorHex, 16),
        colorRandomness: 0.2,
        turbulence: 0.4,
        lifetime: 0.8,
        size: 16,
        sizeRandomness: 1
      });
    }
  }

  function getWorldPosFromCameraPos(x, y) {
    var vector = new THREE.Vector3();
    vector.set(
        (x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1,
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
    };
  }

  // ---------------- utility

  function fitCanvasToContainer(canvas) {
    canvas.width = containerElement.clientWidth;
    canvas.height = containerElement.clientHeight;
  }

  function getZIndex(element) {
    var z = window.document.defaultView.getComputedStyle(element).getPropertyValue('z-index');
    if (element.nodeName === 'BODY') return 0;
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
};

$(function() {
  createWhiteboard(document.getElementById('whiteboard'));
});
