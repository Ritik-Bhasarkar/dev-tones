Set p = CreateObject("WMPlayer.OCX")
p.settings.volume = 50
p.URL = "C:\Users\Legion\ai-workspace\error-tone\dev-chaos-sounds\sounds\faaah.mp3"
Do While p.playState <> 1
  WScript.Sleep 100
Loop
