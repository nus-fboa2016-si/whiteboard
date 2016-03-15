var express = require('express');
var app = express();
var http = require('http').Server(app);

app.get('/', function(req, res){
  res.sendFile('index.html', {root: __dirname});
});

http.listen(parseInt(process.argv[2]), function(){
  console.log('listening on port ' + process.argv[2]);
});