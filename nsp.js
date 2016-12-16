// Requires the node-fastcgi module (https://www.npmjs.com/package/node-fastcgi)
var port = 9000; // FastCGI port number
var scriptRoot = '../html'; // Relative or absolute path, no trailing slash
var printErrors = true; // Print errors on the page
var printErrorsToConsole = false; // Print errors in the console
var scriptTimeout = 30000; // Ends script with an error after this time. Set to -1 to disable. setTimeout can escape this, though: https://github.com/nodejs/node/issues/3020
var printPartial = true; // Not yet implemented (always true). If an error occurs, print all html up to that error. This might make errors harder to see so it's better to leave this off.
var openTags = ['<?nsp', '<?']; // <?nsp needs to go first since nsp starts with <?
var closeTags = ['?>'];
var autoCloseLastTag = false; // Allow a file to end while inside a script
var ignoredOpenTokens = ['"', "'", '`', '//', '/*']; // Ignore tags that occur within comments and strings inside scripts
var ignoredCloseTokens = [['"', '\n'], ["'", '\n'], ['`'], ['\n'], ['*/']]; // Closing tokens for those comments and strings
var scriptEncoding = 'utf-8'; // The whole file will have to be of this encoding.
var precompileScripts = false; // Not yet implemented. This option will make the server keep a mapping between the script's hash and a precompiled script
var ctrlCScripts = true; // Use Ctrl-C to end the first script that started rather than ending the server
var debug = true; // Print time taken to run a script to the console

var fcgi = require('node-fastcgi');
var fs = require('fs');
var vm = require('vm');


fcgi.createServer(function(req, res) {
  var startTime = new Date().getTime();
  var scriptPath = scriptRoot + req.url;
  var result = "";
  function error(msg) { if(printErrors) { res.end(msg); } else { res.end(); } if(printErrorsToConsole) { console.error(msg) } };
  fs.readFile(scriptPath, scriptEncoding, (err, data) => {
    if (err) {
      error("An error occured while reading file " + scriptPath + ": " + err.message);
      return;
    }
    
    var context = {'clearImmediate': clearImmediate, 'clearInterval': clearInterval, 'clearTimeout': clearTimeout,
    'require': require, 'setImmediate': setImmediate, 'setInterval': setInterval, 'setTimeout': setTimeout,
    'req': req, 'res': res, 'console': console}; // TODO: globals
    vm.createContext(context);
    function evaluate(code, offset) {
      try {
        var timeLeft = scriptTimeout - (new Date().getTime() - startTime);
        if(scriptTimeout == -1) {
          vm.runInContext(code, context, {filename: req.url, breakOnSigint: ctrlCScripts, lineOffset: offset});
        } else if (timeLeft > 0) {
          vm.runInContext(code, context, {filename: req.url, breakOnSigint: ctrlCScripts, lineOffset: offset, timeout: timeLeft});
        }
        timeLeft = scriptTimeout - (new Date().getTime() - startTime);
      } catch (err) {
        if (timeLeft <= 0) {
          error('Script timeout reached');
        } else {
          error(err.toString());
        }
      }
    }
    
    function isStr(data, pos, strList) { // returns 1-based index
      for (var i = 1; i <= strList.length; i++) {
        var str = strList[i - 1];
        if (data.length - pos >= str.length && data.slice(pos, pos + str.length) == str) {
          return i;
        }
      }
      return 0;
    }
    
    var inScript = false;
    var inIgnored = false; // inside a comment or a string
    var ignoreCloseToken = [];
    var fromPos = 0;
    var lineNumber = 1;
    var fromLine = 0;
    var ti = 0;
    for (var pos = 0; pos <= data.length; pos++) {
      if (data.charAt(pos) == '\n') {
          lineNumber++;
      }
      if (!inScript) { // outside of a script
        if (ti = isStr(data, pos, openTags)) {
          res.write(data.slice(fromPos, pos));
          pos += openTags[ti - 1].length; // skip over the tag
          fromPos = pos;
          fromLine = lineNumber;
          inScript = true;
        } else if (ti = isStr(data, pos, closeTags)) {
          error("Unmatched close tag on line " + lineNumber);
          return;
        }
      } else if (inScript && !inIgnored) { // inside a script
        if (ti = isStr(data, pos, closeTags) || (autoCloseLastTag && pos == str.length)) {
          code = data.slice(fromPos, pos);
          pos += closeTags[ti - 1].length;
          fromPos = pos;
          inScript = false;
          inIgnored = false;
          ignoreCloseToken = [];
          
          // evaluate the script
          evaluate(code, lineNumber - 1);
          if (res.finished) {
            if (debug) { var time = new Date().getTime() - startTime; console.log("Took " + time + "ms for " + req.url); }
            return;
          }
        } else if (isStr(data, pos, openTags)) {
          error("Unmatched open tag on line " + fromLine + " (tried to open another on line " + lineNumber + ")");
          return;
        } else if (ti = isStr(data, pos, ignoredOpenTokens)) {
          inIgnored = true;
          ignoreCloseToken = ignoredCloseTokens[ti - 1];
          console.log(ignoreCloseToken);
        }
      } else if (inScript && inIgnored && isStr(data, pos, ignoreCloseToken)) {
        inIgnored = false;
        ignoreCloseToken = [];
      }
    }
    if (inScript) {
      error("Tag on line " + fromLine + " not closed before end of file (and autoCloseLastTag = false)");
      return;
    }
    if(fromPos < pos) {
      res.write(data.slice(fromPos, pos));
    }
    
    if(!res.finished) {
      res.end();
    }
    if (debug) { var time = new Date().getTime() - startTime; console.log("Took " + time + "ms for " + req.url); }
  });
}).listen(port);
