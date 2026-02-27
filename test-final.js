const { spawn } = require('child_process');
const path = require('path');

const soundFile = path.join(__dirname, 'sounds', 'faaah.mp3');
const vbsPath = path.join(__dirname, '_test_play.vbs');

console.log('Starting wscript (silent, no GUI)...');
const start = Date.now();

const proc = spawn('wscript', ['//B', vbsPath, soundFile, '50'], { windowsHide: true });
proc.on('close', (code) => {
  console.log(`exit code: ${code}, took: ${Date.now() - start}ms`);
  process.exit();
});
