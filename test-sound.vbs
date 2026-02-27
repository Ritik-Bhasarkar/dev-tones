Set player = CreateObject("WMPlayer.OCX")
player.settings.volume = 50
player.URL = "C:\Users\Legion\ai-workspace\error-tone\dev-chaos-sounds\sounds\faaah.mp3"
player.controls.play()
Do While player.playState <> 1
  WScript.Sleep 100
Loop
