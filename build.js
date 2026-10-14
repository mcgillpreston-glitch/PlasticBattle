// Builds the standalone, single-file game at ./index.html from ./src.
// Usage: node build.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const shell = fs.readFileSync(path.join(SRC, '00-shell.html'), 'utf8');
const scripts = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort()
  .map(f => '/* ===== ' + f + ' ===== */\n' + fs.readFileSync(path.join(SRC, f), 'utf8'))
  .join('\n');

const cut = shell.indexOf('</style>') + '</style>'.length;
const head = shell.slice(0, cut);
const body = shell.slice(cut).trim();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Plastic Front: an all-ARAM toy-soldier MOBA playtest on a Normandy sunken road.">
<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}[hidden]{display:none!important}</style>
${head}
</head>
<body>
${body}
<script>
(function () {
'use strict';
${scripts}
})();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('Built index.html (' + Math.round(html.length / 1024) + ' KB)');
