const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const soundFile = path.join(__dirname, 'sounds', 'faaah.mp3');

const vbsPath = path.join(__dirname, '_test_play.vbs');
const vbs = `Set p = CreateObject("WMPlayer.OCX")
p.settings.volume = 50
p.URL = "${soundFile}"
Do While p.playState <> 1
  WScript.Sleep 100
Loop
`;
fs.writeFileSync(vbsPath, vbs);

console.log('Starting wscript...');
const start = Date.now();

const proc = spawn('wscript', ['//B', vbsPath], { windowsHide: true });
proc.on('close', (code) => {
  console.log(`exit code: ${code}, took: ${Date.now() - start}ms`);
  process.exit();
});
