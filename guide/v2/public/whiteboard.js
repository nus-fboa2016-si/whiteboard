var socket = io();

// whiteboard ------------------------------------------

// size the whiteboard to parent container
var container = document.getElementById('whiteboard-container');
var wb = container.querySelector('canvas.whiteboard');
wb.height = container.clientHeight;
wb.width = container.clientWidth;

var isDrawing = false;
var prevX = null;
var prevY = null;

// set stroke style
var ctx = wb.getContext('2d');
ctx.strokeStyle = '#aa88ff';
ctx.lineWidth = 2;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// event handlers --------------------------------------

container.onmousedown = function(e){
  e.preventDefault();
  isDrawing = true;
  var x = e.offsetX + e.target.getBoundingClientRect().left - container.getBoundingClientRect().left;
  var y = e.offsetY + e.target.getBoundingClientRect().top - container.getBoundingClientRect().top;
  prevX = x;
  prevY = y;
};

container.onmousemove = function(e){
  if (!isDrawing) return;
  var x = e.offsetX + e.target.getBoundingClientRect().left - container.getBoundingClientRect().left;
  var y = e.offsetY + e.target.getBoundingClientRect().top - container.getBoundingClientRect().top;
  var newLine = {
    startX: prevX,
    startY: prevY,
    endX: x,
    endY: y
  };
  drawLine(newLine);
  socket.emit('draw line', newLine);
  prevX = x;
  prevY = y;
};

container.onmouseup = function(e){
  isDrawing = false;
};

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