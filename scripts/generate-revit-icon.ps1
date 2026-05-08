Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile('e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\Square44x44Logo.png')
$out = 'e:\New folder (5)\Anarchy Ai 0.07\src-tauri\resources\revit-plugin'
New-Item -ItemType Directory -Path $out -Force | Out-Null

function Save-Png($w, $h, $path) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.SmoothingMode = 'HighQuality'
    $g.CompositingMode = 'SourceCopy'
    $g.DrawImage($src, 0, 0, $w, $h)
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Save-Png 32 32 "$out\AnarchyLogo_32.png"
Save-Png 16 16 "$out\AnarchyLogo_16.png"

$src.Dispose()
Get-ChildItem $out | Select-Object Name, Length
