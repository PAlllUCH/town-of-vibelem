'use strict';

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

var bundled = html
  .replace(/<link rel="stylesheet" href="([^"]+)">/g, function (match, href) {
    var css = fs.readFileSync(path.join(root, href), 'utf8');
    return '<style>\n' + css + '\n</style>';
  })
  .replace(/<script src="([^"]+)"><\/script>/g, function (match, src) {
    var js = fs.readFileSync(path.join(root, src), 'utf8');
    if (/<\/script>/i.test(js)) {
      throw new Error(src + ' contains </script> and cannot be inlined');
    }
    return '<script>\n' + js + '\n</script>';
  });

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
var dest = path.join(root, 'dist', 'town-of-vibelm-offline.html');
fs.writeFileSync(dest, bundled);
console.log(Buffer.byteLength(bundled, 'utf8') + ' bytes');
