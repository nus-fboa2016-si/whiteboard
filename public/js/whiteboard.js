var createWhiteboard = function(containerElement) {
  var prevContainerWidth, prevContainerHeight;

  var socket;

  var prevX, prevY;

  var drawCanvas, drawCtx,
    colorString, penSize, // colorString is a DOM color string
    cacheCanvas, cacheCtx, // hidden, used to redraw canvas on resize
    isDrawing;

  var camera, scene, renderer,
    clock, tick,
    particleSystem, spawnerOpts, particleOpts,
    unanimatedLines;

  var pickerShape,
    uCountSVGText;

  var DEFAULT_COLOR = '#aa88ff'; // alternatively, 0xffffff

  // ---------------- end shared var declarations

  socket = io(); // WAOW! AMAZING!

  recordContainerDimensions();

  initDrawLayer();
  initGFXLayer();
  initOverlay();

  animate();
  initEventHandlers();

  function recordContainerDimensions() {
    prevContainerWidth = containerElement.offsetWidth;
    prevContainerHeight = containerElement.offsetHeight;
  }

  // ---------------- events

  function initEventHandlers() {
    containerElement.onmousedown = handleMousePress;
    containerElement.onmousemove = handleMouseMove;
    document.onmouseup = handleMouseRelease;

    containerElement.addEventListener('touchstart', handleTouch, true);
    containerElement.addEventListener('touchmove', handleTouch, true);
    containerElement.addEventListener('touchend', handleTouch, true);
    containerElement.addEventListener('touchcancel', handleTouch, true);

    // Detect mouse release outside the window
    //document.addEventListener('mouseup', handleMouseRelease, true);
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

    var simulatedMouseEvent = new MouseEvent(type, {
      screenX: first.screenX,
      screenY: first.screenY,
      clientX: first.clientX,
      clientY: first.clientY,
      bubbles: true
    });
    console.log(simulatedMouseEvent);
    first.target.dispatchEvent(simulatedMouseEvent);
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
    var pos = getMouseEventContainerPos(e);
    prevX = pos.x;
    prevY = pos.y;
    isDrawing = true;
  }

  function handleMouseRelease() {
    isDrawing = false;
  }

  function handleMouseMove(e) {
    if (!isDrawing) return;

    var pos = getMouseEventContainerPos(e);
    var newLine = {
      startX: prevX,
      startY: prevY,
      endX: pos.x,
      endY: pos.y,
      width: penSize,
      colorString: colorString
    };
    prevX = pos.x;
    prevY = pos.y;
    drawLine(newLine);
    unanimatedLines.push(newLine);
    socket.emit('draw line', newLine);
  }

  function handleMouseOut(e) {
    e = e || window.event;
    var from = e.relatedTarget || e.toElement;
    if (!from || from.nodeName === 'HTML') {
      // handleMouseRelease();
      var pos = getMouseEventContainerPos(e);
      prevX = pos.x;
      prevY = pos.y;
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

  function getMouseEventContainerPos(e) {
    // FF <39 fix
    var offsetX = e.offsetX === undefined
        ? (e.originalEvent === undefined ? e.layerX : e.originalEvent.layerX) : e.offsetX;
    var offsetY = e.offsetY === undefined
        ? (e.originalEvent === undefined ? e.layerY : e.originalEvent.layerY) : e.offsetY;
    var targetPagePos = getPagePosition(e.target);
    var containerPagePos = getPagePosition(containerElement);
    return {
      x: offsetX + targetPagePos.x - containerPagePos.x,
      y: offsetY + targetPagePos.y - containerPagePos.y
    };
  }

  // ---------------- overlay (color picker, connection count etc)

  function initOverlay() {
    initUserCount();
    initColorPicker();
  }

  function initColorPicker() {
    var pickerElem = initPickerElement();
    var hoverRule = 'circle.' + pickerElem.className + ':hover{cursor:pointer;}';
    addRuleCSS(hoverRule);

    $(pickerElem).spectrum({
      color: colorString,
      showButtons: false,
      clickoutFiresChange: true,
      change: function(newColor) {
        colorString = '#' + newColor.toHex();
        pickerElem.setAttribute('fill', colorString);
      },
      hide: function(color) {},
      show: function(color) {}
    });
  }

  function initPickerElement() {
    var s;
    colorString = DEFAULT_COLOR;

    var pickerPosDiv = document.createElement('div');
    containerElement.appendChild(pickerPosDiv);
    s = pickerPosDiv.style;
    s.position = 'absolute';
    s.width = '100%';

    var pickerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pickerSvg.className = 'wb-overlay-color-picker-svg';
    pickerPosDiv.appendChild(pickerSvg);
    s = pickerSvg.style;
    s.height = '30px';
    s.width = '30px';
    s.display = 'block';
    s.margin = '0 auto';
    s.top = '20px';
    s.position = 'relative';

    pickerShape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pickerShape.className = 'wb-overlay-color-picker-shape';
    pickerShape.setAttribute('cx', '15');
    pickerShape.setAttribute('cy', '15');
    pickerShape.setAttribute('r', '15');
    pickerShape.setAttribute('fill', colorString);
    pickerSvg.appendChild(pickerShape);
    return pickerShape;
  }

  function initUserCount() {
    var s;

    var uCountSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    uCountSVG.className = 'wb-overlay-usercount-svg';
    s = uCountSVG.style;
    s.width = '100%';
    s.height = '30px';
    s.position = 'absolute';
    s.left = '10px';
    s.bottom = '10px';
    containerElement.appendChild(uCountSVG);

    uCountSVGText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    uCountSVGText.className = 'wb-overlay-usercount-text';
    uCountSVGText.textContent = 'Loading user count...';
    uCountSVGText.setAttribute('x', '0');
    uCountSVGText.setAttribute('y', '30');
    s = uCountSVGText.style;
    s.textAnchor = 'start';
    s.fill = '#00D5B0';
    s.stroke = '#000000';
    s.strokeWidth = '1.5px';
    s.fontSize = '24px';
    s.fontFamily = 'sans-serif';
    s.fontWeight = 'bold';
    uCountSVG.appendChild(uCountSVGText);

    socket.on('user count', updateUserCount);
  }

  function updateUserCount(newCount) {
    uCountSVGText.textContent = 'CONNECTED: ' + newCount;
  }

  // ---------------- draw canvas

  function initDrawLayer() {
    drawCanvas = document.createElement('canvas');
    drawCanvas.className = 'wb-draw-layer-canvas';
    drawCanvas.textContent = 'HTTP Canvas not supported :(';
    containerElement.appendChild(drawCanvas);
    fitCanvasToContainer(drawCanvas);

    drawCanvas.style.position = 'absolute';

    drawCtx = drawCanvas.getContext('2d');
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    colorString = DEFAULT_COLOR;
    penSize = 2;
    isDrawing = false;

    cacheCanvas = document.createElement('canvas'); // this is not in DOM body
    fitCanvasToContainer(cacheCanvas);
    cacheCtx = cacheCanvas.getContext('2d');

    socket.on('buffered lines', function(lines) {
      lines.forEach(drawLine);
    });
    socket.on('draw line', function(line){
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
    ctx.strokeStyle = line.colorString;
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

    camera = new THREE.PerspectiveCamera(
        28,
        containerElement.offsetWidth / containerElement.offsetHeight,
        1,
        10000);
    camera.position.z = 100;

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.domElement.className = 'wb-gfx-layer-canvas';
    renderer.domElement.style.position = 'absolute';
    renderer.setSize(containerElement.offsetWidth, containerElement.offsetHeight);
    renderer.setClearColor(0x000000, 0);
    containerElement.appendChild(renderer.domElement);

    // See THREE.js github gpuparticle example
    particleSystem = new THREE.GPUParticleSystem({
      maxParticles: 250000
    });
    scene = new THREE.Scene();
    scene.add(particleSystem);

    spawnerOpts = {
      spawnRate: 3000,
      timeScale: 1
    };
    particleOpts = {
      positionRandomness: 0.5,
      velocity: new THREE.Vector3(),
      velocityRandomness: 0.5,
      colorRandomness: 0.2,
      turbulence: 0.4,
      lifetime: 0.8,
      size: 16,
      sizeRandomness: 1
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
      particleOpts.color = parseInt(line.colorString.substr(1), 16);
      particleOpts.position = new THREE.Vector3(pos.x, pos.y, 0);
      particleSystem.spawnParticle(particleOpts);
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
