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

var isDrawing = false;
var prevX = null;
var prevY = null;

// event handlers
wb.onmousedown = function(e){
  isDrawing = true;
  prevX = e.offsetX;
  prevY = e.offsetY;
};
wb.onmousemove = function(e){
  if (!isDrawing) return;
  ctx.beginPath();
  ctx.moveTo(prevX, prevY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  prevX = e.offsetX;
  prevY = e.offsetY;
};
wb.onmouseup = function(e){
  isDrawing = false;
  prevX = prevY = null;
};