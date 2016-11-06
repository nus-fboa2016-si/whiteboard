var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var numConnected = 0;

var BUFFER_MAX = 500;

var drawingBuffer = [];

// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 3000;

function addToBuffer(line) {
  drawingBuffer.push(line);
  if (drawingBuffer.length > BUFFER_MAX) {
    drawingBuffer.shift();
  }
}

app.use(express.static('public'));

io.on('connection', function(socket) {
  numConnected++;
  console.log('connected: ' + numConnected);
  io.emit('user count', numConnected);

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
});

http.listen(port, function() {
  console.log('listening on *:' + port);
});
