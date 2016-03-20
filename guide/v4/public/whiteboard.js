var socket = io();

// whiteboard ------------------------------------------

// size the whiteboard to parent container
var container = document.getElementById('whiteboard-container');
var wb = container.querySelector('canvas.whiteboard');
wb.height = container.clientHeight;
wb.width = container.clientWidth;

// set stroke style
var colorString = '#aa88ff';
var ctx = wb.getContext('2d');
ctx.strokeStyle = colorString;
ctx.lineWidth = 2;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// draw logic ------------------------------------------

var prevX, prevY,
    isDrawing = false;

container.onmousedown = function(e){
  e.preventDefault();
  isDrawing = true;
  var pos = getMouseEventContainerPos(e);
  prevX = pos.x;
  prevY = pos.y;
};

container.onmousemove = function(e){
  if (!isDrawing) return;
  var pos = getMouseEventContainerPos(e);
  var newLine = {
    startX: prevX,
    startY: prevY,
    endX: pos.x,
    endY: pos.y,
    colorString: colorString
  };
  drawLine(newLine);
  socket.emit('draw line', newLine);
  prevX = pos.x;
  prevY = pos.y;
};

document.onmouseup = function(){
  isDrawing = false;
};

container.onmouseleave = function(e) {
  if (!isDrawing) return;
  container.onmousedown(e);
};

function getMouseEventContainerPos(e) {
  return {
    x: e.offsetX + e.target.getBoundingClientRect().left - container.getBoundingClientRect().left,
    y: e.offsetY + e.target.getBoundingClientRect().top - container.getBoundingClientRect().top
  };
}

socket.on('draw line', drawLine);
function drawLine(line) {
  ctx.strokeStyle = line.colorString;
  ctx.beginPath();
  ctx.moveTo(line.startX, line.startY);
  ctx.lineTo(line.endX, line.endY);
  ctx.stroke();
  unanimatedLines.push(line);
}

// user count ------------------------------------------

socket.on('user count', updateUserCount);
var userCountText = container.querySelector('text.user-count');
function updateUserCount(count) {
  userCountText.textContent = 'CONNECTED: ' + count;
}

// color picker ----------------------------------------

var colorPickerWrapper = container.querySelector('.color-picker-wrapper');
var colorPickerInput = colorPickerWrapper.querySelector('input.color-picker');
colorPickerInput.onchange = function() {
  colorPickerWrapper.style.backgroundColor = colorPickerInput.value;
  colorString = colorPickerInput.value;
};

// particle effects ------------------------------------

var unanimatedLines = [];
var tick = 0, clock = new THREE.Clock(true);
var gfxCanvas = container.querySelector('canvas.gfx-layer');

var camera = new THREE.PerspectiveCamera(
      28,
      container.offsetWidth / container.offsetHeight,
      1,
      10000
    ),
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      canvas: gfxCanvas
    }),
    scene = new THREE.Scene();

var particleSystem = new THREE.GPUParticleSystem({maxParticles: 250000}),
    spawnerOpts = {
      spawnRate: 3000,
      timeScale: 1
},
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

camera.position.z = 100;
renderer.setSize(container.offsetWidth, container.offsetHeight);
renderer.setClearColor(0x000000, 0);
scene.add(particleSystem);

animate();
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
  for (var i = 0; i < number; i++) { // ensure uniform distribution
    var percent = i / number;
    var pos = getWorldPosFromCameraPos( // position particle on correct part of line
        line.startX * (1 - percent) + line.endX * percent,
        line.startY * (1 - percent) + line.endY * percent
    );
    // convert our colorString into RGB hex for the particle system
    particleOpts.color = parseInt(line.colorString.substr(1), 16);
    // start position of this particle
    particleOpts.position = new THREE.Vector3(pos.x, pos.y, 0);
    particleSystem.spawnParticle(particleOpts); // Let it gooo..
  }
}

function getWorldPosFromCameraPos(x, y) {
  var vector = new THREE.Vector3();
  vector.set(
      (x / wb.width) * 2 - 1, -(y / wb.height) * 2 + 1,
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
