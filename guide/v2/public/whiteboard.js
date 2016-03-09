// size the whiteboard to parent container
var wb = document.getElementById('whiteboard');
var container = document.getElementById('whiteboard-container');
wb.height = container.clientHeight;
wb.width = container.clientWidth;

// set stroke style
var ctx = wb.getContext('2d');
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 2;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

var svgText = container.querySelector('text.user-count');

var isDrawing = false;
var prevX = null;
var prevY = null;

var socket = io();

// event handlers
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
socket.on('user count', updateUserCount);

function drawLine(line) {
  ctx.beginPath();
  ctx.moveTo(line.startX, line.startY);
  ctx.lineTo(line.endX, line.endY);
  ctx.stroke();
}

function updateUserCount(count) {
  svgText.textContent = 'CONNECTED: ' + count;
}