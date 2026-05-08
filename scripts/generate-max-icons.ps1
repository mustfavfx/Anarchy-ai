Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile('e:\New folder (5)\Anarchy Ai 0.07\src-tauri\icons\Square44x44Logo.png')

function Get-Resized32($w, $h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.SmoothingMode = 'HighQuality'
    $g.CompositingMode = 'SourceCopy'
    $g.DrawImage($src, 0, 0, $w, $h)
    $g.Dispose()
    return $bmp
}

function Save-Color($w, $h, $path) {
    $resized = Get-Resized32 $w $h
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $p = $resized.GetPixel($x, $y)
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
        }
    }
    $resized.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
}

function Save-Alpha($w, $h, $path) {
    $resized = Get-Resized32 $w $h
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $a = $resized.GetPixel($x, $y).A
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $a, $a, $a))
        }
    }
    $resized.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
}

$out = 'e:\New folder (5)\Anarchy Ai 0.07\src-tauri\resources\maxicons'
New-Item -ItemType Directory -Path $out -Force | Out-Null

Save-Color 24 24 "$out\AnarchyLogo_24i.bmp"
Save-Color 16 15 "$out\AnarchyLogo_16i.bmp"
Save-Alpha 24 24 "$out\AnarchyLogo_24a.bmp"
Save-Alpha 16 15 "$out\AnarchyLogo_16a.bmp"

$src.Dispose()
Get-ChildItem $out | Select-Object Name, Length
