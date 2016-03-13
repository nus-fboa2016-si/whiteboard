var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var userCount = 0;

app.use(express.static('public'));

io.on('connection', function(socket){

  // update connection count
  userCount++;
  console.log('Users connected: ' + userCount);
  io.emit('user count', userCount); //update all clients

  socket.on('disconnect', function(){
    userCount--;
    console.log('Users connected: ' + userCount);
    io.emit('user count', userCount);
  });

  socket.on('draw line', function(line){
    socket.broadcast.emit('draw line', line);
  });
});

http.listen(3000, function(){
  console.log('listening on port 3000');
});