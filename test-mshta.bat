@echo off
mshta vbscript:Execute("CreateObject(""WMPlayer.OCX"").URL=""C:\Users\Legion\ai-workspace\error-tone\dev-chaos-sounds\sounds\faaah.mp3"":CreateObject(""WScript.Shell"").Run ""cmd /c timeout 4 >nul"",0,True:close")
