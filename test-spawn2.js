const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const soundFile = path.join(__dirname, 'sounds', 'faaah.mp3');

// Approach: use a .vbs file with WMPlayer, launched via cscript
const vbsPath = path.join(__dirname, '_test_play.vbs');
const vbs = `Set p = CreateObject("WMPlayer.OCX")
p.settings.volume = 50
p.URL = "${soundFile}"
Do While p.playState <> 1
  WScript.Sleep 100
Loop
`;
fs.writeFileSync(vbsPath, vbs);

console.log('Starting cscript...');
const start = Date.now();

const proc = spawn('cscript', ['//nologo', '//B', vbsPath], { windowsHide: true });
proc.stderr.on('data', (d) => console.log('stderr:', d.toString()));
proc.stdout.on('data', (d) => console.log('stdout:', d.toString()));
proc.on('close', (code) => {
  console.log(`exit code: ${code}, took: ${Date.now() - start}ms`);
  process.exit();
});
