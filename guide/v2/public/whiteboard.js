var socket = io();

// whiteboard ------------------------------------------

// size the whiteboard to parent container
var container = document.getElementById('whiteboard-container');
var wb = container.querySelector('canvas.whiteboard');
wb.height = container.clientHeight;
wb.width = container.clientWidth;

// set stroke style
var ctx = wb.getContext('2d');
ctx.strokeStyle = '#aa88ff';
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
    endY: pos.y
  };
  drawLine(newLine);
  socket.emit('draw line', newLine);
  prevX = pos.x;
  prevY = pos.y;
};

document.onmouseup = function(e){
  isDrawing = false;
};

container.onmouseenter = function(e) {
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
  ctx.beginPath();
  ctx.moveTo(line.startX, line.startY);
  ctx.lineTo(line.endX, line.endY);
  ctx.stroke();
}

// user count ------------------------------------------

socket.on('user count', updateUserCount);
var userCountText = container.querySelector('text.user-count');
function updateUserCount(count) {
  userCountText.textContent = 'CONNECTED: ' + count;
}