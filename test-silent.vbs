Set args = WScript.Arguments
If args.Count < 2 Then WScript.Quit 1
Set p = CreateObject("WMPlayer.OCX")
p.settings.autoStart = False
p.settings.volume = CInt(args(1))
p.URL = args(0)
p.controls.play()
Do While p.playState <> 1
  WScript.Sleep 100
Loop
p.close
