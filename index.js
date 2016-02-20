var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var numConnected = 0;

app.use(express.static('public'));

io.on('connection', function(socket) {

    console.log('connected: ' + ++numConnected);

    io.emit('user count', numConnected);

    socket.on('disconnect', function() {
        console.log('connected: ' + --numConnected);
        io.emit('user count', numConnected);
    });

    socket.on('draw line', function(line) {
        socket.broadcast.emit('draw line', line);
    });

    socket.on('get user count', function() {
      socket.emit('user count', numConnected);
    });
});

http.listen(3000, function() {
    console.log('listening on *:3000');
});
