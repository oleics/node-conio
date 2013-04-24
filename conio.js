
var ansi = require('ansi'),
    EventEmitter = require('events').EventEmitter;

module.exports = conio();

function conio() {
  return function(stdin, stdout) {
    if(stdin == null) stdin = process.stdin;
    if(stdout == null) stdout = process.stdout;
    
    var cursor,
        em = new EventEmitter(),
        nl = '\n',
        cr = '\r',
        outputBuffer = [''],
        inputBuffer = '',
        inputHistory = [],
        inputHistoryPosition = -1,
        maxX = 32,
        maxY = 32,
        fitToScreen = true;
    
    if(fitToScreen) {
      stdout.on('resize', function() {
        maxX = stdout.columns - 1;
        maxY = stdout.rows - 2;
      });
      maxX = stdout.columns - 1;
      maxY = stdout.rows - 2;
    }
    
    cursor = ansi(stdout);
    
    // setup
    
    em.start = function() {
      stdin.resume();
      stdin.setRawMode(true);
      stdin.on('data', onDataInput);
      setTimeout(function() {
        em.emit('start');
      });
      return em;
    };
    
    em.stop = function() {
      stdin.removeListener('data', onDataInput);
      stdin.setRawMode(false);
      stdin.pause();
      em.emit('stop');
      return em;
    };
    
    var KEY_ETX = 3,
        KEY_BS = 8,
        KEY_ESC = 27,
        KEY_CR = 13,
        KEY_US = 31,
        KEY_OPENING_SQUARE_BRACKET = 91,
        KEY_DEL = 127;
    
    function onDataInput(b) {
      switch(b[0]) {
        case KEY_ETX: // [Ctrl+C]
          em.stop();
          stdout.write(nl + 'Hit [Ctrl+C] again to quit.' + nl);
          break;
        case KEY_CR:
          pushToHistory(inputBuffer);
          em.emit('line', inputBuffer);
          inputBuffer = '';
          displayRefresh();
          break;
        case KEY_BS:
        case KEY_DEL:
          inputBuffer = inputBuffer.slice(0, -1);
          displayRefresh();
          break;
        case KEY_ESC:
          onEscapeSeqInput(b);
          break;
        default:
          if(KEY_US < b[0] && b[0] < 127) { // Printable ascii chars
            inputBuffer += b.toString();
          } else {
            em.writeln(b.length + ': ' + b[0] + ' ' + b[1] + ' ' + b[2]);
          }
          displayRefresh();
          break;
      }
    }
    
    var ESC_SEQ_UP = 65,
        ESC_SEQ_DOWN = 66,
        ESC_SEQ_RIGHT = 67,
        ESC_SEQ_LEFT = 68;
    
    function onEscapeSeqInput(b) {
      if(
        b[0] === KEY_ESC &&
        b[1] === KEY_OPENING_SQUARE_BRACKET
      ) {
        switch(b[2]) {
          case ESC_SEQ_UP:
            inputBuffer = getPreviousFromHistory();
            break;
          case ESC_SEQ_DOWN:
            inputBuffer = getNextFromHistory();
            break;
          case ESC_SEQ_RIGHT:
            em.writeln('ESC_SEQ_RIGHT');
            em.position(function(err, pos) {
              em.writeln(pos[0]);
            });
            break;
          case ESC_SEQ_LEFT:
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
      cursor.eraseData(2);
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
        if(match) {
          var xy = match.slice(1, 3).reverse().map(Number);
          cb(null, xy);
        } else {
          cb(new Error('Could not retrieve cursor position.'));
        }
      });
      cursor.queryPosition();
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
      data = wrapLines(data);
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
    
    function wrapLines(lines) {
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