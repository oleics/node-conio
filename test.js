
var loremIpsum = require('lorem-ipsum');

var conio = require('./conio')(),
    xy = conio.getWindowSize();

//conio.setMaxXY(xy[0], xy[1]);
conio.setMaxXY(32, 32);

setInterval(function() {
  conio.write(loremIpsum({count: 50}));
},10000);

//for(var i=0; i<xy[0]; i++) {
//  conio.write(i);
//}
//conio.writeln();

conio.writeln(loremIpsum({count: 5}));
conio.position(function(){});
//conio.position(console.log);
//conio.clear();
