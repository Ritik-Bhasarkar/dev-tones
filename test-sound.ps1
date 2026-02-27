Add-Type -AssemblyName PresentationCore
$p = New-Object System.Windows.Media.MediaPlayer
$p.Open([Uri]"C:/Users/Legion/ai-workspace/error-tone/dev-chaos-sounds/sounds/sad-trombone.mp3")
$p.Volume = 0.5
$p.Play()
Start-Sleep -Seconds 4
