# nsp
Node server pages using FastCGI (with &lt;?nsp ... ?&gt; tags in HTML files)

## Installation

1. Download nsp.js and config.json and place them in a directory
2. Install node-fastcgi and strip-json-comments using npm
3. Modify config.json such that scriptRoot points to your html root directory
4. Configure your web server to pass .nsp files to FastCGI on port 9000. On Nginx, for example, place this inside the server section of nginx.conf:

   ```
   location ~ \.nsp$ {
    try_files $uri @error_page;
     root           html;
     fastcgi_pass   127.0.0.1:9000;
     fastcgi_index  index.nsp;
     fastcgi_param  SCRIPT_FILENAME  /scripts$fastcgi_script_name;
     include        fastcgi_params;
   }
   ```

5. Start both nginx and nsp.js

## Configuration

Configuration is located in the config.json file, which should be located in the same directory as nsp.js. It has the following options:

### port

Description: The FastCGI port that should be used by the nsp.js server.    
Type: Integer    
Default: 9000

### scriptRoot

Description: Absolute or relative path to the html root folder, without any trailing slash    
Type: String    
Default: "../html"

### printErrors

Description: Whether to print errors in the output. Errors are printed along with their stack trace, which could reveal unwanted information, so it's better to leave this on only when debugging.    
Type: Boolean    
Default: true

### htmlErrors

Description: If printErrors is enabled, format errors to be more readable when embedded in HTML by wrapping them with a &lt;pre&gt; ... &lt;/pre&gt; tag.    
Type: Boolean    
Default: true

### printErrorsToConsole

Description: Use console.error to log errors along with their stack trace in the console (stderr).    
Type: Boolean    
Default: false    

### printRemainingOnError

Description: When an error or timeout occurs in a script, print the remaining data, skipping any following scripts. This gives the page a better chance of being valid HTML even when an error occurs.    
Type: Boolean    
Default: true

### printRemainingOnError

Description: When an error or timeout occurs in a script, print the remaining data, skipping any following scripts. This gives the page a better chance of being valid HTML even when an error occurs.    
Type: Boolean    
Default: true

### errorOnScriptSkipped

Description: If printRemainingOnError is enabled, prints a message in the place of following scripts, and print an error to the console too if printErrorsToConsole is enabled.    
Type: Boolean    
Default: true

### scriptTimeout

Description: Time in milliseconds after which to kill the script. This is currently broken, and async methods and setTimeout can be used to escape the timeout. Set to -1 to disable.    
Type: Integer    
Default: 30000 (30 seconds)

### openTags

Description: List of valid script opening tags. For the moment, any opening tag can be matched with any closing tag. If a tag starts with another one, the longer tag must be placed first such that it can be parsed.    
Type: List of strings    
Default: ["<?nsp", "<?"]

### closeTags

Description: List of valid script closing tags. For the moment, any opening tag can be matched with any closing tag. If a tag starts with another one, the longer tag must be placed first such that it can be parsed.    
Type: List of strings    
Default: ["?>"]

### autoCloseLastTag

Description: If enabled, a file can end while inside a script.    
Type: Boolean    
Default: false    

### ignoredOpenTokens

Description: List of tokens inside scripts that start a sequence of ignored characters. Within this sequence, the parser will ignore any script start/script end tags.    
Type: List of strings    
Default: ["\\"", "'", "\`", "//", "/\*"]

### ignoredCloseTokens

Description: List of list of tokens that will end sequences of ignored characters. Each sublist is associated with a token in the same position as it in ignoreOpenTokens.    
Type: List of list of strings    
Default: [["\\"", "\\n"], ["'", "\\n"], ["\`"], ["\\n"], ["\*/"]]

### scriptEncoding

Description: Encoding of script files. Even what's not in script tags should be of this encoding to make sure that open and close tags are parsed correctly.    
Type: Valid node.js encoding type string (ascii, base64, binary, hex, ucs2/ucs-2/utf16le/utf-16le, utf8/utf-8)    
Default: "utf-8"

### ctrlCScripts

Description: If enabled, SIGINT (Ctrl-C) will end scripts that are running, ending them in the order that they started. Once no more scripts are running, Ctrl-C will end the server. If disabled, Ctrl-C will immediately end the server.    
Type: Boolean    
Default: true    

### debug

Description: Print time taken to run a script, timeout errors, and mismatched tag errors to the console.    
Type: Boolean    
Default: ture

## Example

Save this file as example.nsp: 
```html
<!DOCTYPE html>
<?nsp
var querystring = require('querystring');
var get = querystring.parse(req.url.split('?')[1]);
?>
<html>

<head>
  <title>NSP test page</title>
  <style>
    body {
      font-family: Tahoma, Verdana, Arial, sans-serif;
    }
  </style>
</head>
<body>
  <h1>NSP test</h1>
  <code>
<?nsp
res.write('Hello, ' + req.connection.remoteAddress + '!<br/>');
for (var i = 1; i <= 10; i++) { // Print numbers 1 to 10
  res.write(i + (i == 10 ? '' : ', '))
}
?>
  </code>
  <form>
<?nsp
var fs = require('fs');
if (get['message']) {
  res.write('You sent this message: ' + get['message'] + '! Click <a href="messages.txt">here</a> to see all messages!<br/>');
  res.write('<button type="submit">Reset</button>');
  fs.appendFile('../html/messages.txt', get['message'] + '\n', function() {});
} else {
  res.write('Send me a message: <input type="text" name="message"></input> <button type="submit">Send!</button>');
}
?>
  </form>
</body>

</html>
```
