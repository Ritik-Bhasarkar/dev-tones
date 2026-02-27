Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinMM {
    [DllImport("winmm.dll")]
    public static extern int mciSendStringA(string cmd, StringBuilder ret, int retLen, IntPtr hwnd);
}
"@

$file = $args[0]
$null = [WinMM]::mciSendStringA("open `"$file`" type mpegvideo alias snd", $null, 0, [IntPtr]::Zero)
$null = [WinMM]::mciSendStringA("play snd wait", $null, 0, [IntPtr]::Zero)
$null = [WinMM]::mciSendStringA("close snd", $null, 0, [IntPtr]::Zero)
