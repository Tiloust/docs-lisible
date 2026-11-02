const fs = require('fs');
const src = fs.readFileSync('core/format-core.js', 'utf8');
fs.mkdirSync('apps-script', { recursive: true });
fs.mkdirSync('extension', { recursive: true });
fs.writeFileSync('apps-script/Core.gs', src);
fs.writeFileSync('extension/core.js', src);
console.log('core synchronisé');
