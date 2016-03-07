var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var numConnected = 0;

var BUFFER_MAX = 500;

var drawingBuffer = [];

function addToBuffer(line) {
  drawingBuffer.push(line);
  if (drawingBuffer.length > BUFFER_MAX) {
    drawingBuffer.shift();
  }
}

app.use(express.static('public'));
app.use(express.static('guide'));

io.on('connection', function(socket) {
  numConnected++;
  console.log('connected: ' + numConnected);

  io.emit('user count', numConnected);

  // send buffered lines to client
  console.log('buffered draw line for new user');
  // for (var i = drawingBuffer.length - 1; i >= 0; i--) {
  //   socket.emit('draw line', drawingBuffer[i]);
  // }
  socket.emit('buffered lines', drawingBuffer);

  socket.on('disconnect', function() {
    numConnected--;
    console.log('connected: ' + numConnected);
    io.emit('user count', numConnected);
  });

  socket.on('draw line', function(line) {
    addToBuffer(line);
    socket.broadcast.emit('draw line', line);
  });

  socket.on('get user count', function() {
    socket.emit('user count', numConnected);
  });
});

http.listen(3000, function() {
  console.log('listening on *:3000');
});
