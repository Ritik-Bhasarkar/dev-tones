const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const soundFile = path.join(__dirname, 'sounds', 'faaah.mp3');
const batPath = path.join(__dirname, '_test_play.bat');

console.log('Sound file:', soundFile);
console.log('Exists:', fs.existsSync(soundFile));

// Same approach as the extension uses
const bat = `@echo off\nmshta vbscript:Execute("CreateObject(""WMPlayer.OCX"").URL=""${soundFile}"":CreateObject(""WScript.Shell"").Run ""cmd /c timeout 6 >nul"",0,True:close")`;
fs.writeFileSync(batPath, bat);
console.log('Bat content:');
console.log(fs.readFileSync(batPath, 'utf8'));
console.log('---');

const proc = spawn('cmd.exe', ['/c', batPath], { windowsHide: true });
proc.stderr.on('data', (d) => console.log('stderr:', d.toString()));
proc.stdout.on('data', (d) => console.log('stdout:', d.toString()));
proc.on('close', (code) => {
  console.log('exit code:', code);
  process.exit();
});
