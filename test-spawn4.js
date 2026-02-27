const { execFile } = require('child_process');
const path = require('path');

const soundFile = path.join(__dirname, 'sounds', 'faaah.mp3').replace(/\\/g, '/');

// Test: use rundll32 to play via shell association
console.log('Starting rundll32...');
const start = Date.now();

execFile('rundll32', ['url.dll,FileProtocolHandler', soundFile], (err, stdout, stderr) => {
  console.log(`Done: ${Date.now() - start}ms`, err ? err.message : 'ok');
  if (stderr) console.log('stderr:', stderr);
});
