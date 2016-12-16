// Requires the node-fastcgi and strip-json-comments modules
var fcgi = require('node-fastcgi');
var fs = require('fs');
var vm = require('vm');
var sjc = require('strip-json-comments');

var config = JSON.parse(sjc(fs.readFileSync('config.json', 'utf-8')));

fcgi.createServer(function(req, res) {
  var startTime = new Date().getTime();
  var scriptPath = config.scriptRoot + req.url;
  var result = "";
  var errorOccured = false;
  
  function error(msg, canContinue) {
    if(config.printErrorsToConsole || (config.debug && !canContinue)) {
      console.error(msg)
    }
    errorOccured = true;
    if(config.printErrors) {
      if(config.htmlErrors) {
        msg = '<pre class="nsp-error">' + msg + '</pre>';
      }
      if (config.printRemainingOnError && canContinue) {
        res.write(msg);
      } else {
        res.end(msg);
      }
    } else if(config.printRemainingOnError && canContinue) {
      res.end();
    }
  }
  
  fs.readFile(scriptPath, config.scriptEncoding, (err, data) => {
    if (err) {
      error("An error occured while reading file " + scriptPath + ": " + err.message, false);
      return;
    }
    
    var context = {'clearImmediate': clearImmediate, 'clearInterval': clearInterval, 'clearTimeout': clearTimeout,
    'require': require, 'setImmediate': setImmediate, 'setInterval': setInterval, 'setTimeout': setTimeout,
    'req': req, 'res': res, 'console': console}; // TODO: globals
    vm.createContext(context);
    function evaluate(code, offset) {
      try {
        var timeLeft = config.scriptTimeout - (new Date().getTime() - startTime);
        if(config.scriptTimeout == -1) {
          vm.runInContext(code, context, {filename: req.url, breakOnSigint: config.ctrlCScripts, lineOffset: offset});
        } else if (timeLeft > 0) {
          vm.runInContext(code, context, {filename: req.url, breakOnSigint: config.ctrlCScripts, lineOffset: offset, timeout: timeLeft});
        }
        timeLeft = config.scriptTimeout - (new Date().getTime() - startTime);
      } catch (err) {
        if (timeLeft <= 0) {
          error('Script timeout reached', false);
        } else {
          error(err.stack.split("at realRunInContextScript")[0], true);
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
        if (ti = isStr(data, pos, config.openTags)) {
          res.write(data.slice(fromPos, pos));
          pos += config.openTags[ti - 1].length; // skip over the tag
          fromPos = pos;
          fromLine = lineNumber;
          inScript = true;
        } else if (ti = isStr(data, pos, config.closeTags)) {
          error("Unmatched close tag on line " + lineNumber, false);
          return;
        }
      } else if (inScript && !inIgnored) { // inside a script
        if (ti = isStr(data, pos, config.closeTags) || (config.autoCloseLastTag && pos == str.length)) {
          code = data.slice(fromPos, pos);
          pos += config.closeTags[ti - 1].length;
          fromPos = pos;
          inScript = false;
          inIgnored = false;
          ignoreCloseToken = [];
          
          // evaluate the script
          if (!errorOccured) {
            evaluate(code, fromLine - 1);
            if (res.finished) {
              if (config.debug) { var time = new Date().getTime() - startTime; console.log("Took " + time + "ms for " + req.url); }
              return;
            }
          } else if (config.errorOnScriptSkipped) {
            error("Skipping script on line " + fromLine, true);
          }
        } else if (isStr(data, pos, config.openTags)) {
          error("Unmatched open tag on line " + fromLine + " (tried to open another on line " + lineNumber + ")", false);
          return;
        } else if (ti = isStr(data, pos, config.ignoredOpenTokens)) {
          inIgnored = true;
          ignoreCloseToken = config.ignoredCloseTokens[ti - 1];
        }
      } else if (inScript && inIgnored && isStr(data, pos, ignoreCloseToken)) {
        inIgnored = false;
        ignoreCloseToken = [];
      }
    }
    if (inScript) {
      error("Tag on line " + fromLine + " not closed before end of file (and autoCloseLastTag = false)", false);
      return;
    }
    if(fromPos < pos) {
      res.write(data.slice(fromPos, pos));
    }
    
    if(!res.finished) {
      res.end();
    }
    if (config.debug) { var time = new Date().getTime() - startTime; console.log("Took " + time + "ms for " + req.url); }
  });
}).listen(config.port);