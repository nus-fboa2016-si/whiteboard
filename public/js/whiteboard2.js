var canvas = document.getElementById('whiteboard');
var whiteboard = canvas.getContext('2d');

whiteboard.canvas.width = window.innerWidth;
whiteboard.canvas.height = window.innerHeight;

var socket = io();

whiteboard.lineWidth = '10';
whiteboard.lineCap = 'round';
whiteboard.lineJoin = 'round';

var color = 'yellowgreen';

canvas.addEventListener('mousedown', startDraw, false);
canvas.addEventListener('mousemove', draw, false);
canvas.addEventListener('mouseup', endDraw, false);

function drawOnCanvas(color, plots) {
  whiteboard.strokeStyle = color;
  whiteboard.beginPath();
  whiteboard.moveTo(plots[0].x, plots[0].y);

  for(var i=1; i<plots.length; i++) {
    whiteboard.lineTo(plots[i].x, plots[i].y);
  }
  whiteboard.stroke();
}

function drawFromStream(message) {
  if(!message || message.plots.length < 1) return;
  drawOnCanvas(message.color, message.plots);
}

var isActive = false;
var plots = [];

function draw(e) {
  if(!isActive) return;

  var x = e.offsetX || e.layerX - canvas.offsetLeft;
  var y = e.offsetY || e.layerY - canvas.offsetTop;

  plots.push({x: x, y: y});
  drawOnCanvas(color, plots);
}

function startDraw(e) {
  isActive = true;
}

function endDraw(e) {
  isActive = false;
  plots = [];
}