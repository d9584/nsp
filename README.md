# nsp
Node server pages using FastCGI (with &lt;?nsp ... ?&gt; tags in HTML files)

## Installation

1. Download nsp.js and config.json and place them in a directory
2. Install node-fastcgi and strip-json-comments using npm
3. Change config.json scriptRoot points to your html root directory
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
