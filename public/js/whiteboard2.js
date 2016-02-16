
var socket;
var isDrawing,
    prevX,
    prevY;
var baseCanvas,
    baseContext,
    prevX,
    prevY,
    isDrawing;


init();


function init() {
  initLocalDrawing();
  initMsgPassing();
}

function initMsgPassing() {
  socket = io();
  socket.on('draw line', drawLine);
}

function initLocalDrawing() {
  baseCanvas = document.getElementById('whiteboard-base');
  baseContext = baseCanvas.getContext('2d');
  prevX = null;
  prevY = null;
  isDrawing = false;

  baseCanvas.width = window.innerWidth;
  baseCanvas.height = window.innerHeight;

  baseContext.lineCap = 'round';
  baseContext.lineJoin = 'round';

  baseCanvas.addEventListener('mousedown', onMouseDown, false);
  baseCanvas.addEventListener('mousemove', onMouseMove, false);
  baseCanvas.addEventListener('mouseup', onMouseUp, false);
}

function onMouseDown() {
  isDrawing = true;
}

function onMouseUp() {
  isDrawing = false;
  clearPrevMousePos();
}

function onMouseMove(e) {
  if (isDrawing) {
    var x = e.offsetX || e.pageX - canvas.offsetLeft;
    var y = e.offsetY || e.pageY - canvas.offsetTop;
    var newLine = {
      startX: prevX === null? x : prevX,
      startY: prevY === null? y : prevY,
      endX: x,
      endY: y,
      width: 1,
      color: 'yellowgreen'
    };
    drawLine(newLine);
    socket.emit('draw line', newLine);
    updatePrevMousePos(x, y);
  }
}

function drawLine(line) {
  var ctx = baseContext;
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

function clearPrevMousePos() {
  prevX = null;
  prevY = null;
}
