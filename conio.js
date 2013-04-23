
var ansi = require('ansi'),
    EventEmitter = require('events').EventEmitter;

module.exports = conio();

function conio() {
  return function(stdin, stdout) {
    if(stdin == null) stdin = process.stdin;
    if(stdout == null) stdout = process.stdout;
    
    console.log(stdout.columns);
    console.log(stdout.rows);
    stdout.on('resize', function() {
      console.log('screen size has changed!');
    });
//    process.exit();
    
    var cursor = ansi(stdout),
        em = new EventEmitter(),
        nl = '\n',
        cr = '\r',
        outputBuffer = [''],
        inputBuffer = '',
        inputHistory = [],
        inputHistoryPosition = -1,
        maxX = 32,
        maxY = 32;
    
    // setup
    
    em.start = function() {
      stdin.resume();
      stdin.setRawMode(true);
      stdin.on('data', onDataInput);
      return em;
    };
    
    em.stop = function() {
      stdin.removeListener('data', onDataInput);
      stdin.setRawMode(false);
      stdin.pause();
      return em;
    };
    
    function onDataInput(b) {
      switch(b[0]) {
        case 3: // [Ctrl+C]
          em.stop();
          stdout.write(nl + 'Hit [Ctrl+C] again to quit.' + nl);
          break;
        case 127: // Backspace
          inputBuffer = inputBuffer.slice(0, -1);
          displayRefresh();
          break;
        case 13: // Return
          pushToHistory(inputBuffer);
          em.emit('line', inputBuffer);
          inputBuffer = '';
          displayRefresh();
          break;
        case 27: // Escape
          onEscapeCodeInput(b);
          break;
        default:
          if(31 < b[0] && b[0] < 127) { // Printable ascii chars
            inputBuffer += b.toString();
          } else {
            em.writeln(b.length + ': ' + b[0] + ' ' + b[1] + ' ' + b[2]);
          }
          displayRefresh();
          break;
      }
    }
    
    function onEscapeCodeInput(b) {
      if(b[1] === 91) {
        switch(b[2]) {
          case 65: // Up
            inputBuffer = getPreviousFromHistory();
            break;
          case 66: // Down
            inputBuffer = getNextFromHistory();
            break;
          case 67: // Right
          case 68: // Left
          default:
            debugPrint(b);
          break;
        }
        displayRefresh();
      } else {
        debugPrint(b);
      }
    }
    
    // functions
    
    em.getWindowSize = function() {
      return stdout.getWindowSize();
    };
    
    em.clear = function() {
      cursor.eraseData(1);
      return em;
    };
    
    em.write = function(data) {
      writeToOuptuBuffer(data);
      displayRefresh();
      return em;
    };
    
    em.writeln = function(data) {
      if(data == null) data = '';
      writeToOuptuBuffer(data.toString() + nl);
      displayRefresh();
      return em;
    };
    
    em.position = function(cb) {
      stdin.once('data', function(b) {
        var match = /\[(\d+)\;(\d+)R$/.exec(b.toString());
        if (match) {
          var xy = match.slice(1, 3).reverse().map(Number);
          cb(null, xy);
        }
      });
      return cursor.queryPosition();
    };
    
    em.goto = function(x, y) {
      cursor.goto(x, y);
      return em;
    };
    
    em.setMaxXY = function(x, y) {
      maxX = x;
      maxY = y;
      return em;
    };
   
    // ---
    
    function writeToOuptuBuffer(data) {
      data = data.toString().split(nl);
      data[0] = outputBuffer[outputBuffer.length-1] + data[0];
      data = expandLines(data);
      outputBuffer[outputBuffer.length-1] = data.shift();
      outputBuffer = outputBuffer.concat(data);
    }
    
    function displayRefresh() {
      trimOutputBuffer();
      cursor
        .eraseData(1)
        .goto(1, 1)
        .write(outputBuffer.join(nl))
        .write(nl + prompt() + inputBuffer);
    }
    
    function expandLines(lines) {
      var pos = 0, newLines = [];
      lines.forEach(function(line) {
        if(line.length <= maxX) {
          newLines.push(line);
        } else {
          pos = 0;
          while(pos < line.length) {
            newLines.push(line.slice(pos, pos + maxX));
            pos += maxX + 1;
          }
        }
      });
      return newLines;
    }
    
    function trimOutputBuffer() {
      if(outputBuffer.length > maxY) {
        outputBuffer = outputBuffer.slice(outputBuffer.length - maxY);
      }
    }
    
    // Prompt
    var promptPrefix = '$ ';
    
    function prompt(prefix) {
      if(prefix != null) {
        promptPrefix = prefix;
      }
      return promptPrefix;
    }
    
    function debugPrint(chunk) {
      var c = Array.prototype.slice.call(chunk, 0);
      em.writeln(chunk.slice(1).toString());
      em.writeln(c.join(', '));
    }
    
    // History
    
    function pushToHistory(line) {
      if(line.length > 0) {
        if(inputHistory.indexOf(line) !== -1) {
          inputHistory.splice(inputHistory.indexOf(line), 1);
        }
        inputHistory.push(line);
        inputHistoryPosition = inputHistory.length;
      }
    }
    
    function getPreviousFromHistory() {
      if(inputHistory[--inputHistoryPosition] == null) ++inputHistoryPosition;
      return getFromHistory(inputHistoryPosition);
    }
    
    function getNextFromHistory() {
      if(inputHistory[++inputHistoryPosition] == null) {
        inputHistoryPosition = inputHistory.length;
        return '';
      }
      return getFromHistory(inputHistoryPosition);
    }
    
    function getFromHistory(index) {
      if(index == null) index = inputHistoryPosition;
      if(inputHistory[index] == null) return '';
      return inputHistory[index];
    }
    
    // Exports
    
    em.prompt = prompt;
    
    return em.start();
  };
}