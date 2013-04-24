
var loremIpsum = require('lorem-ipsum');

var conio = require('./conio')();

conio.on('line', function(line) {
  if(line === 'exit') {
    conio.writeln();
    conio.writeln('Good bye!');
    process.exit();
  } else {
    conio.writeln();
    conio.writeln(line);
  }
});

setInterval(function() {
  conio.writeln(loremIpsum({count: 10}));
}, 20000);

conio.writeln(loremIpsum({count: 5}));

conio.position(console.log);
