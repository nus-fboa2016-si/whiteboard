var baseCanvas = document.getElementById('whiteboard-base');
var baseContext = baseCanvas.getContext('2d');

baseContext.canvas.width = window.innerWidth;
baseContext.canvas.height = window.innerHeight;

baseContext.lineCap = 'round';
baseContext.lineJoin = 'round';

baseCanvas.addEventListener('mousedown', startDraw, false);
baseCanvas.addEventListener('mousemove', draw, false);
baseCanvas.addEventListener('mouseup', endDraw, false);


function startDraw() {
  isDrawing = true;
}

function endDraw() {
  isDrawing = false;
  clearPrevMousePos();
}

var isDrawing = false;
var prevX = null;
var prevY = null;

function draw(e) {
  if (isDrawing) {
    var x = e.offsetX || e.pageX - canvas.offsetLeft;
    var y = e.offsetY || e.pageY - canvas.offsetTop;
    drawLine({
      startX: prevX === null? x : prevX,
      startY: prevY === null? y : prevY,
      endX: x,
      endY: y,
      width: 1,
      color: 'yellowgreen',
    });
    updatePrevMousePos(x, y);
  }
}

function drawLine(line) {
  baseContext.strokeStyle = line.color;
  baseContext.lineWidth = line.width;
  baseContext.beginPath();
  baseContext.moveTo(line.startX, line.startY);
  baseContext.lineTo(line.endX, line.endY);
  baseContext.stroke();
}

function updatePrevMousePos(x, y) {
  prevX = x;
  prevY = y;
}

function clearPrevMousePos() {
  prevX = null;
  prevY = null;
}