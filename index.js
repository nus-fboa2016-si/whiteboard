var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var numConnected = 0;
var msgCount = 0;
app.use(express.static('public'));

//app.get('/', function(req, res) {
//    res.sendFile(__dirname + '/index.html');
//});

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
});

http.listen(3000, function() {
    console.log('listening on *:3000');
});
