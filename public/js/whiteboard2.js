function createWhiteboard(containerElement) {

  var socket;

  var drawCanvasElement, drawContext,
      colorVal, size, // colorVal is a number
      prevX, prevY,
      newX, newY,
      isDrawing,
      DRAW_LAYER_RELATIVE_Z = 0,   // bottom layer
      COLOR_PICKER_RELATIVE_Z = 2; // top layer

  var camera, scene, renderer,
      clock, tick,
      particleSystem,
      particleOpts,
      spawnerOpts,
      FX_LAYER_RELATIVE_Z = 1;  // middle layer

  var containerZ;


  init();


  function init() {
    containerZ = getZIndex(containerElement);
    initBoard();
    initGraphics();
    initSocket();
    animate();
  }

  //////////////////// draw canvas

  function initBoard() {
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
    prevX = null;
    prevY = null;
    isDrawing = false;

    initColorPicker();
    initEventListeners();
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

  function initEventListeners() {
    containerElement.addEventListener('mousedown', handleMousePress);
    containerElement.addEventListener('mousemove', handleMouseMove);
    containerElement.addEventListener('mouseup', handleMouseRelease);

    containerElement.addEventListener('touchstart', handleTouch, true);
    containerElement.addEventListener('touchmove', handleTouch, true);
    containerElement.addEventListener('touchend', handleTouch, true);
    containerElement.addEventListener('touchcancel', handleTouch, true);

    containerElement.addEventListener('keypress', handleKeypress, true);

    function handleMousePress() {
      isDrawing = true;
    }

    function handleMouseRelease() {
      isDrawing = false;
      prevX = null;
      prevY = null;
      newX = null;
      newY = null;
    }

    function handleMouseMove(e) {
      if (isDrawing) {
        var x = e.clientX;//e.offsetX || e.pageX - drawCanvasElement.offsetLeft;
        var y = e.clientY;//e.offsetY || e.pageY - drawCanvasElement.offsetTop;
        newX = x;
        newY = y;
        var newLine = {
          startX: prevX === null ? x : prevX,
          startY: prevY === null ? y : prevY,
          endX: x,
          endY: y,
          width: size,
          color: "#" + colorVal.toString(16)
        };
        drawLine(newLine);
        socket.emit('draw line', newLine);
        updatePrevMousePos(x, y);
      }
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

    function handleKeypress(event) {
      var key = event.which || event.keyCode;
      if (key === 99) {
        // "c" pressed
        clearScreen();
      }
    }

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

  function updatePrevMousePos(x, y) {
    prevX = x;
    prevY = y;
  }

  function clearScreen() {
  //TODO
  }

  ////////////////// 3d effects

  function initGraphics() {

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

    particleOpts = {
      position: new THREE.Vector3(),
      positionRandomness: .3,
      velocity: new THREE.Vector3(),
      velocityRandomness: .5,
      color: colorVal,
      colorRandomness: .2,
      turbulence: 0.1,
      lifetime: 0.4,
      size: 10,
      sizeRandomness: 1
    };
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
    tick += delta;

    if (tick < 0) tick = 0;
    if (isDrawing && delta > 0) {
      var maxSpawn = spawnerOpts.spawnRate * delta;
      for (var i = 0; i < maxSpawn; i++) {
        var percent = i / maxSpawn;
        particleOpts.position.x = prevX * (1 - percent) + newX * percent;
        particleOpts.position.y = prevY * (1 - percent) + newY * percent;
        particleSystem.spawnParticle(particleOpts);
      }
    }
    particleSystem.update(tick);
    renderer.render(scene, camera);
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