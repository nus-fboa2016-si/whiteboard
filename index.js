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
    socket.on('disconnect', function() {
        console.log('connected: ' + --numConnected);
    });
    socket.on('draw line', function(color, x0, y0, x1, y1) {
        //console.log(color + "  " + x0 + "," + y0 + " " + x1 + "," + y1);
        console.log()
        socket.broadcast.emit('draw line', color, x0, y0, x1, y1);
    });
});

http.listen(3000, function() {
    console.log('listening on *:3000');
});
