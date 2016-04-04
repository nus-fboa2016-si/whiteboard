# Adding graphical effects: 3D particles
 <p align="center">[(Augmenting user strokes: color) &lt; previous](GUIDE-v3.md)  |</p>
 
---
#### Introduction

This is the last in a series of four tutorials that walk you through the creation of a real-time collaborative whiteboard with Socket.IO. A fully featured demo can be found [here](paradite.com:3000).

In our [previous](GUIDE-v3.md) installment of the guide, we augmented the user's "brush" with color. Some of you might have added even more features, like pen size, gradients, etc. 

We are now at the final tutorial of this guide, so let us end on a special note. Up till now we have only been working with 2D graphics. If you've played with the [demo](paradite.com:3000) then you've noticed the most glaring difference between it and our own whiteboard: fancy 3D particle effects. 
```
> VIDEO PLACEHOLDER: browser view, demo version, draw randomly
```
Let's do the same here.

---
#### Integrating `THREE.js`

[`THREE.js`](http://threejs.org/) is a powerful and popular library for rendering 3D graphics on HTML5's `canvas` element. 

First let us include the library script for `THREE.js` before the `/whiteboard.js` script in our `public/index.html` file. We can use the version hosted on the CDN:
```html
...
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r74/three.min.js"></script>
  <script src="/socket.io/socket.io.js"></script>
  <script src="/whiteboard.js"></script>
</body>
</html>
```

Next, in `public/index.html`, we add a canvas to the whiteboard container `<div>` to serve as the rendering canvas for `THREE.js`. Put it right between the whiteboard `<canvas>` and the user count `<svg>`:
```html
...
<canvas class="whiteboard">Canvas not supported :(</canvas>
<canvas class="gfx-layer"></canvas> // new
<svg height="30px" width="100%" class="user-count">
...
```

Then, we append the following code at the bottom of `public/whiteboard.js` to initialise the 3D world:
```javascript
// particle effects

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

camera.position.z = 100;
renderer.setSize(container.offsetWidth, container.offsetHeight);
renderer.setClearColor(0x000000, 0);
```

---
#### Integrating `GPUParticleSystem.js`

`THREE.js` is poweful, but we'd rather not write a particle system from scratch. Luckily, we can use the particle system from [this](http://threejs.org/examples/#webgl_gpu_particle_system) example (credit: [Charlie Hoey](http://charliehoey.com/)). 

Just like before, we include the library script for `GPUParticleSystem.js` after the `THREE.js` script and before the `/whiteboard.js` script in our `public/index.html` file. We can use the version hosted on the CDN:
```html
...
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r74/three.min.js"></script>
  <script src="https://cdn.rawgit.com/mrdoob/three.js/master/examples/js/GPUParticleSystem.js"></script>
  <script src="/socket.io/socket.io.js"></script>
  <script src="/whiteboard.js"></script>
</body>
</html>
```

This particle library requires some texture files to work. Create a new directory `textures` inside `public/`. Then, save these two image files inside `public/textures/` with these names:

`particle2.png`, which can be found [here](public/textures/particle2.png).

`perlin-512.png`, which can be found [here](public/textures/perlin-512.png).

Then we append the following code at the bottom of `public/whiteboard.js` to initialise the particle system:
```javascript
var particleSystem = new THREE.GPUParticleSystem({maxParticles: 250000}),
var spawnerOpts = {
      spawnRate: 3000,
      timeScale: 1
};
var particleOpts = {
      positionRandomness: 0.5,
      velocity: new THREE.Vector3(),
      velocityRandomness: 0.5,
      colorRandomness: 0.2,
      turbulence: 0.4,
      lifetime: 0.8,
      size: 16,
      sizeRandomness: 1
};

scene.add(particleSystem);
```

Take note of `particleSystem` and `particleOpts`. If you experience perfomance issues when using the whiteboard, or want to turn up the seizure inducing lights, tweak the options here. You can see the results of changing these options at the [official GPUParticleSystem demo](http://threejs.org/examples/#webgl_gpu_particle_system). Play around to find your ideal settings!

---
#### Adding particle effects when drawing

There are many strategies we can use for spawning the particles. The most obvious way is to spawn them at the user's current mouse position, but if we do that the particles don't follow the mouse trail nicely. You can try it out yourself and compare the animation with the [demo](paradite.com:3000).

With that in mind, let's use a slightly different particle spawning strategy:

1. Every line segment drawn will emit a burst of particles uniformly along its length.
2. Every line segment is animated in this way only once.
3. The particles match the line segment's color.
4. We see particle effects when other users draw too.

We will keep track of fresh line segments that have not yet been animated in an array, and pop them from the array when they have been animated. Let us call the array `unanimatedLines` and declare it at the top of the `// particle effects` section in `public/whiteboardjs`:
```javascript
// particle effects

var unanimatedLines = [];
var tick = 0, clock = new THREE.Clock(true);
...
```

We want fresh line segments to be pushed into that array, so add this statement to the bottom of the `drawLine` function body:
```javascript
function drawLine(line) {
  ...
  ctx.stroke();
  unanimatedLines.push(line);
}
```
Since this function is also called when other users' strokes are received, we can fulfill condition **#4** of our strategy.

Now we need to consume those unanimated lines in our animation loop. Copy this code to the bottom of the `// particle effects` section in `public/whiteboard.js`:
```javascript
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
```
Focus on the middle section of `animate`. The `forEach` callback calls the as yet undeclared `spawnParticlesAlongLine` function on each line in `unanimatedLines` to animate them. Once the loop is complete, we clear the `unanimatedLines` array to fulfill condition **#2** of our strategy.

We are left with conditions **#1** and **#3** of our particle spawning strategy. Let us write our `spawnParticlesAlongLine` function to fulfill them. Add this code to the bottom of the `// particle effects` section in `public/whiteboard.js`:
```javascript
function spawnParticlesAlongLine(number, line) {
  for (var i = 0; i < number; i++) { // ensure uniform distribution
    var percent = i / number;
    var pos = { // position particle on correct part of line
        x: line.startX * (1 - percent) + line.endX * percent,
        y: line.startY * (1 - percent) + line.endY * percent
    };
    particleOpts.color = parseInt(line.colorString.substr(1), 16); // convert our colorString into RGB hex for the particle system
    particleOpts.position = new THREE.Vector3(pos.x, pos.y, 0); // start position of this particle
    particleSystem.spawnParticle(particleOpts);
  }
}
```

That looks correct, but when we try drawing on the whiteboard...
```
> VIDEO PLACEHOLDER: multiple browser view, drawing to show no particle effects
```

What's wrong? It turns out the spawn positions of our missing particles were based on the 2D line's position. However, the particles are in a 3D "world", and we have to map the 2D screen position to the 3D world position so they spawn where we want them. Let's use the undeclared function `getWorldPosFromCameraPos` to perform the mapping for us. Change the `var pos = {x: ... y: ...};` in `spawnParticlesAlongLine` as such:
```javascript
var pos = getWorldPosFromCameraPos( // position particle on correct part of line
        line.startX * (1 - percent) + line.endX * percent,
        line.startY * (1 - percent) + line.endY * percent
    );
```

Then we declare the `getWorldPosFromCameraPos` function under the `spawnParticlesAlongLine` function:
```javascript
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
```

Now let's try drawing on the whiteboard again:
```
> VIDEO PLACEHOLDER: multiple browser view, drawing, change color, drawing
```

Awesome. We did it! Good job!

---
#### Final code

Here is what your code should look like at this point:

`index.js` (no change)
```javascript
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var userCount = 0;

io.on('connection', function(socket){
  userCount++;
  console.log('Users connected: ' + userCount);
  io.emit('user count', userCount);

  socket.on('disconnect', function(){
    userCount--;
    console.log('Users connected: ' + userCount);
    io.emit('user count', userCount);
  });

  socket.on('draw line', function(line){
    socket.broadcast.emit('draw line', line);
  });
});

app.use(express.static('public'));

http.listen(parseInt(process.argv[2]), function(){
  console.log('listening on port ' + process.argv[2]);
});
```

`public/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Collaborative Whiteboard</title>
  <link rel="stylesheet" type="text/css" href="index.css">
</head>

<body>
  <div id="whiteboard-container">
    <canvas class="whiteboard">Canvas not supported :(</canvas>
    <canvas class="gfx-layer"></canvas>
    <svg height="30px" width="100%" class="user-count">
      <text x="0" y="30" class="user-count">Loading user count...</text>
    </svg>
    <div style="width: 100%; position: absolute;">
      <div class="color-picker-wrapper" style="background-color: #aa88ff;">
        <input class="color-picker" type="color" value="#aa88ff">
      </div>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r74/three.min.js"></script>
  <script src="https://cdn.rawgit.com/mrdoob/three.js/master/examples/js/GPUParticleSystem.js"></script>
  <script src="/socket.io/socket.io.js"></script>
  <script src="/whiteboard.js"></script>
</body>
</html>
```

`public/index.css` (no change)
```css
body {
  background-color: #101010;
  margin: 0px;
  overflow: hidden;
}
#whiteboard-container {
  height: 600px;
  width: 900px;
  border: 2px solid white;
  position: absolute;
  top: 0px;
  bottom: 0px;
  left: 0px;
  right: 0px;
  margin: auto;
}
#whiteboard-container canvas {
  position: absolute;
}
#whiteboard-container > svg.user-count {
  height: 30px;
  width: 100%;
  position: absolute;
  left: 10px;
  bottom: 10px;
  cursor: default;
}
#whiteboard-container text.user-count {
  fill: #00D5B0;
  font-size: 12px;
  font-family: sans-serif;
  text-anchor: start;
}
#whiteboard-container .color-picker-wrapper {
  border-radius: 100%;
  margin-top: 20px;
  margin-left: auto;
  margin-right: auto;
  height: 32px;
  width: 32px;
  border: 1.5px solid #101010;
}
#whiteboard-container .color-picker {
  opacity: 0;
  width: inherit;
  height: inherit;
  padding: 0;
}
.color-picker:hover {
  cursor: pointer;
}
```

`public/whiteboard.js`
```javascript
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

camera.position.z = 100;
renderer.setSize(container.offsetWidth, container.offsetHeight);
renderer.setClearColor(0x000000, 0);

var particleSystem = new THREE.GPUParticleSystem({maxParticles: 250000}),
var spawnerOpts = {
      spawnRate: 3000,
      timeScale: 1
};
var particleOpts = {
      positionRandomness: 0.5,
      velocity: new THREE.Vector3(),
      velocityRandomness: 0.5,
      colorRandomness: 0.2,
      turbulence: 0.4,
      lifetime: 0.8,
      size: 16,
      sizeRandomness: 1
};

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
    particleOpts.color = parseInt(line.colorString.substr(1), 16); // convert our colorString into RGB hex for the particle system
    particleOpts.position = new THREE.Vector3(pos.x, pos.y, 0); // start position of this particle
    particleSystem.spawnParticle(particleOpts);
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

```

---
#### Thank you

And that completes our collaborative whiteboard app. We've covered a lot of ground, and we've come up with a fairly pretty and complete app from scratch, so pat yourself on the back; you've earned it. Take a look at the **Homework** sections at the bottom of each tutorial and try implementing them. Share your personal whiteboard and let us hear about it on [twitter](https://twitter.com/socketio?lang=en) or [slack](http://slack.socket.io/)!

---
#### Homework

Here are some ideas to improve the application:
- Lower the strength of other user's particles in relation to the local user to reduce clutter
- Add more of your own 3D effects
- Multiple whiteboards on the same page
- The sky's the limit!

---
#### Getting this example

You can find it on GitHub [here](.).
```
git clone https://github.com/nus-fboa2016-si/whiteboard.git
```
```
cd whiteboard/guide/v4
```

---
 <p align="center">[(Augmenting user strokes: color) &lt; previous](GUIDE-v3.md)  |</p>
